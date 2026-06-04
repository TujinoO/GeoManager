from __future__ import annotations

import hashlib
import json
import math
import re
import sqlite3
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from io import BytesIO
from pathlib import Path
from typing import Any

import pandas as pd
from django.db import transaction
from django.utils.text import slugify
from shapely.geometry import Point

from apps.catalog.models import DataResource, MapLayer
from apps.catalog.services import stable_catalog_code
from apps.core.storage import table_data_path, vector_geopackage_path


class ImportDataError(ValueError):
    pass


MAX_PREVIEW_ROWS = 8
MAX_TABLE_NAME_LENGTH = 63
TABLE_NAME_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$")
LATITUDE_ALIASES = {
    "lat",
    "latitude",
    "纬度",
    "y",
    "decimal_latitude",
    "lat_deg",
    "lat_dd",
}
LONGITUDE_ALIASES = {
    "lon",
    "lng",
    "long",
    "longitude",
    "经度",
    "x",
    "decimal_longitude",
    "lon_deg",
    "lon_dd",
}
NORMALIZED_LATITUDE_ALIASES = {
    re.sub(r"[\s\-_()（）]+", "", alias.strip().lower()) for alias in LATITUDE_ALIASES
}
NORMALIZED_LONGITUDE_ALIASES = {
    re.sub(r"[\s\-_()（）]+", "", alias.strip().lower()) for alias in LONGITUDE_ALIASES
}


@dataclass(frozen=True)
class CoordinateStats:
    total_rows: int
    valid_rows: int
    missing_rows: int
    error_min_meters: float | None
    error_max_meters: float | None


def preview_uploaded_table(uploaded_file) -> dict[str, Any]:
    df = read_uploaded_table(uploaded_file)
    columns = list(df.columns)
    longitude_column, latitude_column = infer_coordinate_columns(df)
    coordinate_stats = None
    if longitude_column and latitude_column:
        coordinate_stats = coordinate_stats_for(df, longitude_column, latitude_column)
    return {
        "columns": columns,
        "rows": _preview_rows(df),
        "rowCount": int(len(df)),
        "suggestedTableName": suggest_table_name(Path(uploaded_file.name).stem),
        "suggestedName": Path(uploaded_file.name).stem,
        "detected": {
            "isGeographic": bool(longitude_column and latitude_column),
            "longitudeColumn": longitude_column,
            "latitudeColumn": latitude_column,
            "coordinateStats": _serialize_coordinate_stats(coordinate_stats),
        },
        "limitations": [
            "仅支持 Excel 或 CSV 文件，Excel 只读取第一张表。",
            "导入时所有字段按文本读取，以保留经纬度记录的小数位数。",
            "带经纬度的数据写入统一 GeoPackage：vector/vector.gpkg。",
            "不带经纬度的数据写入表格库：table/data.sqlite。",
            "字段元数据可留空，但建议填写中文名称、单位、计算方式和数据来源。",
        ],
    }


@transaction.atomic
def import_uploaded_table(
    uploaded_file, payload: dict[str, Any], user
) -> dict[str, Any]:
    df = read_uploaded_table(uploaded_file)
    name = _required_text(payload.get("name"), "数据名称")
    table_name = validate_import_table_name(
        _required_text(payload.get("tableName"), "入库表名")
    )
    metadata = _metadata_map(payload.get("fieldMetadata"), set(df.columns))
    import_mode = str(payload.get("importMode") or "").strip()
    longitude_column = str(payload.get("longitudeColumn") or "").strip()
    latitude_column = str(payload.get("latitudeColumn") or "").strip()
    missing_policy = str(payload.get("missingCoordinatePolicy") or "cancel").strip()
    overwrite = bool(payload.get("overwrite", False))

    if import_mode not in {"geographic", "table"}:
        raise ImportDataError("导入方式必须是 geographic 或 table")

    if import_mode == "geographic":
        if longitude_column not in df.columns or latitude_column not in df.columns:
            raise ImportDataError("地理数据必须指定有效的经度列和纬度列")
        return import_geographic_table(
            df=df,
            name=name,
            table_name=table_name,
            longitude_column=longitude_column,
            latitude_column=latitude_column,
            metadata=metadata,
            missing_policy=missing_policy,
            overwrite=overwrite,
            user=user,
        )

    return import_plain_table(
        df=df,
        name=name,
        table_name=table_name,
        metadata=metadata,
        overwrite=overwrite,
        user=user,
    )


def import_geographic_table(
    *,
    df: pd.DataFrame,
    name: str,
    table_name: str,
    longitude_column: str,
    latitude_column: str,
    metadata: dict[str, str],
    missing_policy: str,
    overwrite: bool,
    user,
) -> dict[str, Any]:
    stats = coordinate_stats_for(df, longitude_column, latitude_column)
    if stats.missing_rows and missing_policy == "cancel":
        raise ImportDataError("存在空或非法坐标，请选择忽略、强行导入或取消导入")
    if missing_policy not in {"cancel", "ignore", "force"}:
        raise ImportDataError("空坐标处理方式必须是 cancel、ignore 或 force")

    import geopandas as gpd

    working = df.copy()
    valid_mask = _valid_coordinate_mask(working, longitude_column, latitude_column)
    if missing_policy == "ignore":
        working = working[valid_mask].copy()
        valid_mask = _valid_coordinate_mask(working, longitude_column, latitude_column)

    geometries = []
    for index, row in working.iterrows():
        if bool(valid_mask.loc[index]):
            geometries.append(
                Point(float(row[longitude_column]), float(row[latitude_column]))
            )
        else:
            geometries.append(None)

    gdf = gpd.GeoDataFrame(working, geometry=geometries, crs="EPSG:4326")
    path = vector_geopackage_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    _ensure_table_can_be_written(path, table_name, overwrite, geographic=True)
    gdf.to_file(path, layer=table_name, driver="GPKG")
    write_geopackage_field_metadata(path, table_name, metadata)

    bounds = (
        [
            round(float(value), 6)
            for value in gdf[gdf.geometry.notna()].total_bounds.tolist()
        ]
        if stats.valid_rows
        else []
    )
    code = stable_catalog_code("vector", table_name)
    spatial_extent = ",".join(f"{value:.6f}" for value in bounds) if bounds else ""
    resource, _ = DataResource.objects.update_or_create(
        code=code,
        defaults={
            "name": name,
            "data_type": DataResource.DataType.VECTOR,
            "source": "用户导入",
            "provider": "",
            "spatial_extent": spatial_extent,
            "coordinate_system": "EPSG:4326",
            "file_format": "GPKG",
            "storage_path": table_name,
            "description": "由 Excel/CSV 导入的点位数据",
            "quality_note": _quality_note(stats, missing_policy),
            "maintainer": user if getattr(user, "is_authenticated", False) else None,
            "status": DataResource.Status.ACTIVE,
        },
    )
    layer, _ = MapLayer.objects.update_or_create(
        code=code,
        defaults={
            "name": name,
            "layer_type": MapLayer.LayerType.VECTOR,
            "geometry_type": MapLayer.GeometryType.POINT,
            "data_resource": resource,
            "source_path": table_name,
            "default_visible": True,
            "default_opacity": 85,
            "bounds": bounds,
            "legend": "",
            "is_active": True,
        },
    )
    return {
        "mode": "geographic",
        "resourceId": resource.id,
        "layerId": layer.id,
        "tableName": table_name,
        "importedRows": int(len(gdf)),
        "skippedRows": int(stats.missing_rows if missing_policy == "ignore" else 0),
        "coordinateStats": _serialize_coordinate_stats(stats),
    }


def import_plain_table(
    *,
    df: pd.DataFrame,
    name: str,
    table_name: str,
    metadata: dict[str, str],
    overwrite: bool,
    user,
) -> dict[str, Any]:
    path = table_data_path("data.sqlite")
    path.parent.mkdir(parents=True, exist_ok=True)
    _ensure_table_can_be_written(path, table_name, overwrite, geographic=False)
    with sqlite3.connect(path) as connection:
        df.to_sql(table_name, connection, if_exists="replace", index=False)
        write_sqlite_field_metadata(connection, table_name, metadata)

    code = stable_catalog_code("table", table_name)
    resource, _ = DataResource.objects.update_or_create(
        code=code,
        defaults={
            "name": name,
            "data_type": DataResource.DataType.TABLE,
            "source": "用户导入",
            "provider": "",
            "spatial_extent": "",
            "coordinate_system": "",
            "file_format": "SQLITE",
            "storage_path": table_name,
            "description": f"由 Excel/CSV 导入的非地理表：{table_name}",
            "quality_note": "",
            "maintainer": user if getattr(user, "is_authenticated", False) else None,
            "status": DataResource.Status.ACTIVE,
        },
    )
    return {
        "mode": "table",
        "resourceId": resource.id,
        "layerId": None,
        "tableName": table_name,
        "importedRows": int(len(df)),
        "skippedRows": 0,
        "coordinateStats": None,
    }


def read_uploaded_table(uploaded_file) -> pd.DataFrame:
    filename = str(uploaded_file.name or "")
    suffix = Path(filename).suffix.lower()
    raw = uploaded_file.read()
    if not raw:
        raise ImportDataError("上传文件为空")

    try:
        if suffix == ".csv":
            df = _read_csv_bytes(raw)
        elif suffix in {".xls", ".xlsx"}:
            df = pd.read_excel(
                BytesIO(raw),
                sheet_name=0,
                dtype=str,
                keep_default_na=False,
                na_filter=False,
            )
        else:
            raise ImportDataError("仅支持 .csv、.xls、.xlsx 文件")
    except ImportDataError:
        raise
    except ImportError as exc:
        raise ImportDataError(f"缺少读取该文件格式所需的 Python 依赖：{exc}") from exc
    except Exception as exc:
        raise ImportDataError(f"读取上传表格失败：{exc}") from exc

    if df.empty and not list(df.columns):
        raise ImportDataError("表格没有可导入的字段")
    return normalize_dataframe(df)


def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    normalized = df.copy()
    normalized.columns = _unique_column_names(normalized.columns)
    normalized = normalized.fillna("")
    for column in normalized.columns:
        normalized[column] = normalized[column].map(
            lambda value: "" if pd.isna(value) else str(value).strip()
        )
    return normalized


def infer_coordinate_columns(df: pd.DataFrame) -> tuple[str | None, str | None]:
    longitude = _best_coordinate_column(df, LONGITUDE_ALIASES, is_longitude=True)
    latitude = _best_coordinate_column(df, LATITUDE_ALIASES, is_longitude=False)
    if longitude and latitude and longitude != latitude:
        return longitude, latitude
    return None, None


def coordinate_stats_for(
    df: pd.DataFrame, longitude_column: str, latitude_column: str
) -> CoordinateStats:
    valid_mask = _valid_coordinate_mask(df, longitude_column, latitude_column)
    errors = []
    for _, row in df[valid_mask].iterrows():
        lon_text = str(row[longitude_column]).strip()
        lat_text = str(row[latitude_column]).strip()
        errors.append(_position_error_meters(lon_text, lat_text))
    return CoordinateStats(
        total_rows=int(len(df)),
        valid_rows=int(valid_mask.sum()),
        missing_rows=int(len(df) - valid_mask.sum()),
        error_min_meters=round(min(errors), 6) if errors else None,
        error_max_meters=round(max(errors), 6) if errors else None,
    )


def validate_import_table_name(table_name: str) -> str:
    table_name = table_name.strip()
    if not TABLE_NAME_PATTERN.fullmatch(table_name):
        raise ImportDataError(
            "入库表名只能使用英文字母、数字和下划线，且必须以字母或下划线开头，最长 63 个字符"
        )
    return table_name


def suggest_table_name(source_name: str) -> str:
    stem = slugify(source_name, allow_unicode=False).replace("-", "_")
    stem = re.sub(r"[^A-Za-z0-9_]+", "_", stem).strip("_").lower()
    if not stem or not re.match(r"^[A-Za-z_]", stem):
        stem = "import_data"
    digest = hashlib.sha256(source_name.encode("utf-8")).hexdigest()[:8]
    candidate = f"{stem}_{digest}"
    return candidate[:MAX_TABLE_NAME_LENGTH]


def write_geopackage_field_metadata(
    path: Path, table_name: str, metadata: dict[str, str]
) -> None:
    with sqlite3.connect(path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS gpkg_data_columns (
                table_name TEXT NOT NULL,
                column_name TEXT NOT NULL,
                name TEXT,
                title TEXT,
                description TEXT,
                mime_type TEXT,
                constraint_name TEXT,
                CONSTRAINT pk_gpkg_data_columns PRIMARY KEY (table_name, column_name)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS gpkg_extensions (
                table_name TEXT,
                column_name TEXT,
                extension_name TEXT NOT NULL,
                definition TEXT NOT NULL,
                scope TEXT NOT NULL,
                CONSTRAINT ge_tce UNIQUE (table_name, column_name, extension_name)
            )
            """
        )
        connection.execute(
            """
            INSERT OR IGNORE INTO gpkg_extensions
                (table_name, column_name, extension_name, definition, scope)
            VALUES
                (?, NULL, 'gpkg_schema', 'http://www.geopackage.org/spec/#extension_schema', 'read-write')
            """,
            (table_name,),
        )
        _replace_field_metadata(connection, "gpkg_data_columns", table_name, metadata)


def write_sqlite_field_metadata(
    connection: sqlite3.Connection, table_name: str, metadata: dict[str, str]
) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS data_columns (
            table_name TEXT NOT NULL,
            column_name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            CONSTRAINT pk_data_columns PRIMARY KEY (table_name, column_name)
        )
        """
    )
    connection.execute("DELETE FROM data_columns WHERE table_name = ?", (table_name,))
    connection.executemany(
        "INSERT INTO data_columns (table_name, column_name, description) VALUES (?, ?, ?)",
        [
            (table_name, column_name, description)
            for column_name, description in metadata.items()
        ],
    )


def _read_csv_bytes(raw: bytes) -> pd.DataFrame:
    last_error: Exception | None = None
    for encoding in ("utf-8-sig", "gb18030"):
        try:
            return pd.read_csv(
                BytesIO(raw),
                dtype=str,
                keep_default_na=False,
                na_filter=False,
                encoding=encoding,
            )
        except UnicodeDecodeError as exc:
            last_error = exc
    raise ImportDataError(f"CSV 编码无法识别：{last_error}")


def _replace_field_metadata(
    connection: sqlite3.Connection,
    table_name: str,
    data_table: str,
    metadata: dict[str, str],
) -> None:
    connection.execute(f"DELETE FROM {table_name} WHERE table_name = ?", (data_table,))
    connection.executemany(
        f"INSERT INTO {table_name} (table_name, column_name, name, title, description, mime_type, constraint_name) VALUES (?, ?, NULL, NULL, ?, NULL, NULL)",
        [
            (data_table, column_name, description)
            for column_name, description in metadata.items()
        ],
    )


def _metadata_map(raw: Any, columns: set[str]) -> dict[str, str]:
    if raw in (None, ""):
        return {column: "" for column in columns}
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ImportDataError("字段元数据不是有效 JSON") from exc
    if not isinstance(raw, dict):
        raise ImportDataError("字段元数据必须是对象")
    metadata = {column: str(raw.get(column) or "").strip() for column in columns}
    return metadata


def _valid_coordinate_mask(
    df: pd.DataFrame, longitude_column: str, latitude_column: str
) -> pd.Series:
    lon = pd.to_numeric(df[longitude_column], errors="coerce")
    lat = pd.to_numeric(df[latitude_column], errors="coerce")
    return lon.between(-180, 180) & lat.between(-90, 90)


def _position_error_meters(lon_text: str, lat_text: str) -> float:
    lon_error_degrees = float(_half_unit_degree(lon_text))
    lat_error_degrees = float(_half_unit_degree(lat_text))
    latitude = float(Decimal(lat_text))
    lat_meters = lat_error_degrees * 111_320
    lon_meters = lon_error_degrees * 111_320 * abs(math.cos(math.radians(latitude)))
    return math.hypot(lat_meters, lon_meters)


def _half_unit_degree(value: str) -> Decimal:
    text = value.strip()
    match = re.match(r"^[+-]?\d+(?:\.(\d+))?$", text)
    if match:
        decimals = len(match.group(1) or "")
        return Decimal("0.5") * (Decimal(10) ** Decimal(-decimals))
    try:
        decimal = Decimal(text)
    except InvalidOperation:
        return Decimal("0")
    decimals = max(-decimal.as_tuple().exponent, 0)
    return Decimal("0.5") * (Decimal(10) ** Decimal(-decimals))


def _best_coordinate_column(
    df: pd.DataFrame, aliases: set[str], *, is_longitude: bool
) -> str | None:
    normalized_aliases = (
        NORMALIZED_LONGITUDE_ALIASES if is_longitude else NORMALIZED_LATITUDE_ALIASES
    )
    candidates: list[tuple[float, str]] = []
    for column in df.columns:
        normalized = _normalize_column_name(column)
        score = 0.0
        if normalized in normalized_aliases:
            score += 8.0
        elif any(alias in normalized for alias in normalized_aliases if len(alias) > 1):
            score += 5.0
        elif normalized in {"x", "y"}:
            score += 2.0
        if score <= 0:
            continue
        values = pd.to_numeric(df[column], errors="coerce")
        in_range = (
            values.between(-180, 180) if is_longitude else values.between(-90, 90)
        )
        valid_ratio = float(in_range.sum()) / max(len(df), 1)
        if valid_ratio <= 0:
            continue
        candidates.append((score + valid_ratio, column))
    if not candidates:
        return None
    return sorted(candidates, key=lambda item: (-item[0], item[1]))[0][1]


def _normalize_column_name(column: str) -> str:
    return re.sub(r"[\s\-_()（）]+", "", str(column).strip().lower())


def _unique_column_names(columns) -> list[str]:
    seen: dict[str, int] = {}
    names = []
    for index, column in enumerate(columns):
        base = str(column).strip() or f"column_{index + 1}"
        count = seen.get(base, 0)
        seen[base] = count + 1
        names.append(base if count == 0 else f"{base}_{count + 1}")
    return names


def _preview_rows(df: pd.DataFrame) -> list[dict[str, str]]:
    return df.head(MAX_PREVIEW_ROWS).to_dict(orient="records")


def _serialize_coordinate_stats(stats: CoordinateStats | None) -> dict[str, Any] | None:
    if stats is None:
        return None
    return {
        "totalRows": stats.total_rows,
        "validRows": stats.valid_rows,
        "missingRows": stats.missing_rows,
        "quantizationErrorMeters": {
            "min": stats.error_min_meters,
            "max": stats.error_max_meters,
        },
    }


def _ensure_table_can_be_written(
    path: Path, table_name: str, overwrite: bool, *, geographic: bool
) -> None:
    if not path.exists():
        return
    if geographic:
        import geopandas as gpd

        layers = gpd.list_layers(path)
        existing_names = (
            set(layers["name"].astype(str).tolist())
            if hasattr(layers, "columns") and "name" in layers.columns
            else set()
        )
        if table_name in existing_names and not overwrite:
            raise ImportDataError(f"GeoPackage 图层已存在：{table_name}")
        return
    with sqlite3.connect(path) as connection:
        exists = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
            (table_name,),
        ).fetchone()
    if exists and not overwrite:
        raise ImportDataError(f"SQLite 表已存在：{table_name}")


def _quality_note(stats: CoordinateStats, missing_policy: str) -> str:
    error_range = ""
    if stats.error_min_meters is not None and stats.error_max_meters is not None:
        error_range = f"坐标量化误差范围约 {stats.error_min_meters:.6f} - {stats.error_max_meters:.6f} 米。"
    missing_note = f"坐标有效 {stats.valid_rows}/{stats.total_rows} 行，空或非法坐标 {stats.missing_rows} 行，处理方式：{missing_policy}。"
    return f"{missing_note}{error_range}"


def _required_text(value: Any, label: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise ImportDataError(f"{label}不能为空")
    return text
