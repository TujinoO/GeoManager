from __future__ import annotations

import json
import math
import re
import sqlite3
import uuid
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from io import BytesIO
from pathlib import Path
from typing import Any

import pandas as pd
from django.contrib.auth.models import Group
from django.db import transaction
from django.utils.text import slugify
from shapely.geometry import Point

from apps.catalog.models import DataResource
from apps.catalog.services import stable_catalog_code
from apps.core.initialization import ensure_superadmin_defaults
from apps.core.principal_visibility import selectable_access_groups_for
from apps.core.storage import table_data_path, vector_geopackage_path


class ImportDataError(ValueError):
    pass


MAX_PREVIEW_ROWS = 8
MAX_TABLE_NAME_LENGTH = 63
COORDINATE_UNCERTAINTY_RATIO_THRESHOLD = 200
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


@dataclass(frozen=True)
class ImportValidationIssue:
    code: str
    message: str
    count: int | None = None
    blocking: bool = True
    min_meters: float | None = None
    max_meters: float | None = None
    ratio: float | None = None
    target_type: str | None = None
    target_name: str | None = None


def preview_uploaded_table(uploaded_file) -> dict[str, Any]:
    df = read_uploaded_table(uploaded_file)
    columns = list(df.columns)
    longitude_column, latitude_column = infer_coordinate_columns(df)
    suggested_table_name = suggest_table_name(Path(uploaded_file.name).stem)
    return {
        "columns": columns,
        "rows": _preview_rows(df),
        "rowCount": int(len(df)),
        "suggestedTableName": suggested_table_name,
        "suggestedName": Path(uploaded_file.name).stem,
        "duplicateTarget": duplicate_target_for_display_name(
            Path(uploaded_file.name).stem
        ),
        "detected": {
            "isGeographic": bool(longitude_column and latitude_column),
            "longitudeColumn": longitude_column,
            "latitudeColumn": latitude_column,
            "coordinateStats": None,
            "validationIssues": [],
        },
        "limitations": [
            "仅支持 Excel 或 CSV 文件，Excel 只读取第一张表。",
            "导入时所有字段按文本读取，以保留经纬度记录的小数位数。",
            "字段元数据可留空，但建议填写中文名称、单位、计算方式和数据来源。",
        ],
    }


def validate_uploaded_table(uploaded_file, payload: dict[str, Any]) -> dict[str, Any]:
    df = read_uploaded_table(uploaded_file)
    import_mode = str(payload.get("importMode") or "").strip()
    table_name = str(payload.get("tableName") or "").strip()
    display_name = str(payload.get("name") or "").strip()
    longitude_column = str(payload.get("longitudeColumn") or "").strip()
    latitude_column = str(payload.get("latitudeColumn") or "").strip()

    if import_mode not in {"geographic", "table"}:
        raise ImportDataError("导入方式必须是 geographic 或 table")
    duplicate_target = (
        duplicate_target_for_display_name(display_name) if display_name else None
    )
    if table_name:
        table_name = validate_import_table_name(table_name)
    if import_mode == "table":
        return {
            "coordinateStats": None,
            "validationIssues": [],
            "duplicateTarget": duplicate_target,
        }
    if longitude_column not in df.columns or latitude_column not in df.columns:
        raise ImportDataError("地理数据必须指定有效的经度列和纬度列")

    stats = coordinate_stats_for(df, longitude_column, latitude_column)
    issues = validate_coordinate_columns(df, longitude_column, latitude_column)
    return {
        "coordinateStats": _serialize_coordinate_stats(stats),
        "validationIssues": _serialize_validation_issues(issues),
        "duplicateTarget": duplicate_target,
    }


@transaction.atomic
def import_uploaded_table(
    uploaded_file, payload: dict[str, Any], user
) -> dict[str, Any]:
    df = read_uploaded_table(uploaded_file)
    name = _required_text(payload.get("name"), "数据名称")
    requested_table_name = validate_import_table_name(
        _required_text(payload.get("tableName"), "后台存储标识")
    )
    import_mode = str(payload.get("importMode") or "").strip()
    longitude_column = str(payload.get("longitudeColumn") or "").strip()
    latitude_column = str(payload.get("latitudeColumn") or "").strip()
    ignore_coordinate_uncertainty = bool(
        payload.get("ignoreCoordinateUncertainty", False)
    )
    duplicate_confirmed = bool(payload.get("duplicateConfirmed", False))
    file_size = int(getattr(uploaded_file, "size", 0) or 0)
    access_group_ids = _access_group_ids(payload.get("accessGroupIds"))

    if import_mode not in {"geographic", "table"}:
        raise ImportDataError("导入方式必须是 geographic 或 table")
    _ensure_display_name_can_be_imported(name, duplicate_confirmed)
    table_name = unique_import_table_name(requested_table_name, import_mode)

    if import_mode == "geographic":
        if longitude_column not in df.columns or latitude_column not in df.columns:
            raise ImportDataError("地理数据必须指定有效的经度列和纬度列")
        included_columns = _included_columns(
            payload.get("includedColumns"),
            df.columns,
            required_columns={longitude_column, latitude_column},
        )
        df = df[included_columns].copy()
        metadata = _metadata_map(payload.get("fieldMetadata"), set(included_columns))
        return import_geographic_table(
            df=df,
            name=name,
            table_name=table_name,
            longitude_column=longitude_column,
            latitude_column=latitude_column,
            metadata=metadata,
            ignore_coordinate_uncertainty=ignore_coordinate_uncertainty,
            source_size_bytes=file_size,
            user=user,
            access_group_ids=access_group_ids,
        )

    included_columns = _included_columns(payload.get("includedColumns"), df.columns)
    df = df[included_columns].copy()
    metadata = _metadata_map(payload.get("fieldMetadata"), set(included_columns))
    return import_plain_table(
        df=df,
        name=name,
        table_name=table_name,
        metadata=metadata,
        source_size_bytes=file_size,
        user=user,
        access_group_ids=access_group_ids,
    )


def import_geographic_table(
    *,
    df: pd.DataFrame,
    name: str,
    table_name: str,
    longitude_column: str,
    latitude_column: str,
    metadata: dict[str, str],
    ignore_coordinate_uncertainty: bool,
    source_size_bytes: int,
    user,
    access_group_ids: set[int],
) -> dict[str, Any]:
    stats = coordinate_stats_for(df, longitude_column, latitude_column)
    validation_issues = validate_coordinate_columns(
        df, longitude_column, latitude_column
    )
    blocking_issues = [
        issue
        for issue in validation_issues
        if issue.blocking
        or (
            issue.code == "coordinate_uncertainty" and not ignore_coordinate_uncertainty
        )
    ]
    if blocking_issues:
        raise ImportDataError(
            "数据校验未通过", _serialize_validation_issues(validation_issues)
        )

    import geopandas as gpd

    working = df.copy()
    valid_mask = _valid_coordinate_mask(working, longitude_column, latitude_column)

    geometries = []
    for index, row in working.iterrows():
        if not bool(valid_mask.loc[index]):
            continue
        geometries.append(
            Point(float(row[longitude_column]), float(row[latitude_column]))
        )

    working = working[valid_mask].copy()

    gdf = gpd.GeoDataFrame(working, geometry=geometries, crs="EPSG:4326")
    path = vector_geopackage_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    _ensure_table_can_be_written(path, table_name, geographic=True)
    _write_geopackage_layer(path, table_name, gdf)
    write_geopackage_field_metadata(path, table_name, metadata)

    bounds = (
        [
            round(float(value), 6)
            for value in gdf[gdf.geometry.notna()].total_bounds.tolist()
        ]
        if stats.valid_rows
        else []
    )
    resource = _upsert_geographic_resource(
        name=name,
        table_name=table_name,
        bounds=bounds,
        stats=stats,
        ignore_coordinate_uncertainty=ignore_coordinate_uncertainty,
        source_size_bytes=source_size_bytes,
        user=user,
    )
    set_resource_access_groups(resource, access_group_ids, viewer=user)
    return {
        "mode": "geographic",
        "resourceId": resource.id,
        "resourceName": resource.name,
        "layerName": table_name,
        "tableName": table_name,
        "importedRows": int(len(gdf)),
        "skippedRows": 0,
        "bounds": bounds,
        "coordinateStats": _serialize_coordinate_stats(stats),
        "validationIssues": _serialize_validation_issues(validation_issues),
    }


def import_plain_table(
    *,
    df: pd.DataFrame,
    name: str,
    table_name: str,
    metadata: dict[str, str],
    source_size_bytes: int,
    user,
    access_group_ids: set[int],
) -> dict[str, Any]:
    path = table_data_path("data.sqlite")
    path.parent.mkdir(parents=True, exist_ok=True)
    _ensure_table_can_be_written(path, table_name, geographic=False)
    with sqlite3.connect(path) as connection:
        df.to_sql(table_name, connection, if_exists="fail", index=False)
        write_sqlite_field_metadata(connection, table_name, metadata)

    code = _unique_resource_code(stable_catalog_code("table", table_name))
    resource = DataResource.objects.create(
        code=code,
        name=name,
        data_type=DataResource.DataType.TABLE,
        source="用户导入",
        provider="",
        spatial_extent="",
        coordinate_system="",
        file_format="SQLITE",
        storage_path=table_name,
        description=f"由 Excel/CSV 导入的非地理表：{table_name}",
        quality_note="",
        maintainer=user if getattr(user, "is_authenticated", False) else None,
        size_bytes=source_size_bytes,
        item_count=int(len(df)),
        status=DataResource.Status.ACTIVE,
    )
    set_resource_access_groups(resource, access_group_ids, viewer=user)
    return {
        "mode": "table",
        "resourceId": resource.id,
        "resourceName": resource.name,
        "layerId": None,
        "tableName": table_name,
        "importedRows": int(len(df)),
        "skippedRows": 0,
        "coordinateStats": None,
        "validationIssues": [],
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
    longitude = _best_coordinate_column(df, is_longitude=True)
    latitude = _best_coordinate_column(df, is_longitude=False)
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


def validate_coordinate_columns(
    df: pd.DataFrame, longitude_column: str, latitude_column: str
) -> list[ImportValidationIssue]:
    issues: list[ImportValidationIssue] = []
    missing_count = 0
    invalid_format_count = 0
    invalid_longitude_count = 0
    invalid_latitude_count = 0
    errors = []

    for _, row in df.iterrows():
        lon_text = str(row[longitude_column]).strip()
        lat_text = str(row[latitude_column]).strip()
        if not lon_text or not lat_text:
            missing_count += 1
            continue
        if not _is_decimal_coordinate(lon_text) or not _is_decimal_coordinate(lat_text):
            invalid_format_count += 1
            continue

        longitude = float(Decimal(lon_text))
        latitude = float(Decimal(lat_text))
        row_has_range_error = False
        if longitude < -180 or longitude > 180:
            invalid_longitude_count += 1
            row_has_range_error = True
        if latitude < -90 or latitude > 90:
            invalid_latitude_count += 1
            row_has_range_error = True
        if not row_has_range_error:
            errors.append(_position_error_meters(lon_text, lat_text))

    if missing_count:
        issues.append(
            ImportValidationIssue(
                code="missing_geometry",
                count=missing_count,
                message=f"存在 {missing_count} 行缺少经度或纬度，无法导入。",
            )
        )
    if invalid_format_count:
        issues.append(
            ImportValidationIssue(
                code="invalid_coordinate_format",
                count=invalid_format_count,
                message=f"存在 {invalid_format_count} 行经纬度不是小数格式，请使用例如 87.600、43.800 的十进制小数。",
            )
        )
    if invalid_longitude_count:
        issues.append(
            ImportValidationIssue(
                code="invalid_longitude",
                count=invalid_longitude_count,
                message=f"存在 {invalid_longitude_count} 行经度不在 -180 到 180 范围内，无法导入。",
            )
        )
    if invalid_latitude_count:
        issues.append(
            ImportValidationIssue(
                code="invalid_latitude",
                count=invalid_latitude_count,
                message=f"存在 {invalid_latitude_count} 行纬度不在 -90 到 90 范围内，无法导入。",
            )
        )

    positive_errors = [error for error in errors if error > 0]
    if positive_errors:
        minimum = min(positive_errors)
        maximum = max(positive_errors)
        ratio = maximum / minimum
        if ratio > COORDINATE_UNCERTAINTY_RATIO_THRESHOLD:
            issues.append(
                ImportValidationIssue(
                    code="coordinate_uncertainty",
                    blocking=False,
                    min_meters=round(minimum, 6),
                    max_meters=round(maximum, 6),
                    ratio=round(ratio, 2),
                    message=(
                        "坐标不确定性差距超过 "
                        f"{COORDINATE_UNCERTAINTY_RATIO_THRESHOLD} 倍："
                        f"最小约 {minimum:.6f} 米，最大约 {maximum:.6f} 米。"
                    ),
                )
            )
    return issues


def position_error_meters(lon_text: str, lat_text: str) -> float:
    return _position_error_meters(lon_text, lat_text)


def validate_import_table_name(table_name: str) -> str:
    table_name = table_name.strip()
    if not TABLE_NAME_PATTERN.fullmatch(table_name):
        raise ImportDataError(
            "入库表名只能使用英文字母、数字和下划线，且必须以字母或下划线开头，最长 63 个字符"
        )
    return table_name


def duplicate_target_for_display_name(display_name: str) -> dict[str, str] | None:
    display_name = str(display_name or "").strip()
    if not display_name:
        return None
    if not DataResource.objects.filter(name=display_name).exists():
        return None
    return {
        "targetType": "data_resource_name",
        "targetName": display_name,
        "message": f"数据名称已存在：{display_name}",
    }


def _ensure_display_name_can_be_imported(
    display_name: str, duplicate_confirmed: bool
) -> None:
    duplicate_target = duplicate_target_for_display_name(display_name)
    if not duplicate_target or duplicate_confirmed:
        return
    raise ImportDataError(
        "数据名称已存在",
        [
            {
                "code": "duplicate_target",
                "message": f"数据名称已存在：{display_name}。如需继续导入，请在数据校验阶段确认重复数据名称。",
                "blocking": True,
                "targetType": "data_resource_name",
                "targetName": display_name,
            }
        ],
    )


def unique_import_table_name(table_name: str, import_mode: str) -> str:
    table_name = validate_import_table_name(table_name)
    if not _storage_target_exists(table_name, import_mode):
        return table_name
    for _ in range(100):
        suffix = uuid.uuid4().hex[:8]
        candidate = f"{table_name[: MAX_TABLE_NAME_LENGTH - 9]}_{suffix}"
        if not _storage_target_exists(candidate, import_mode):
            return candidate
    raise ImportDataError("无法生成唯一后台存储标识")


def _storage_target_exists(table_name: str, import_mode: str) -> bool:
    if DataResource.objects.filter(storage_path=table_name).exists():
        return True
    geographic = import_mode == "geographic"
    path = vector_geopackage_path() if geographic else table_data_path("data.sqlite")
    if not path.exists():
        return False
    if geographic:
        import geopandas as gpd

        layers = gpd.list_layers(path)
        existing_names = (
            set(layers["name"].astype(str).tolist())
            if hasattr(layers, "columns") and "name" in layers.columns
            else set()
        )
        return table_name in existing_names
    with sqlite3.connect(path) as connection:
        exists = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
            (table_name,),
        ).fetchone()
    return bool(exists)


def suggest_table_name(source_name: str) -> str:
    stem = slugify(source_name, allow_unicode=False).replace("-", "_")
    stem = re.sub(r"[^A-Za-z0-9_]+", "_", stem).strip("_").lower()
    if not stem or not re.match(r"^[A-Za-z_]", stem):
        stem = "import_data"
    digest = uuid.uuid4().hex[:12]
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


def set_resource_access_groups(
    resource: DataResource, group_ids: set[int], *, viewer=None
) -> None:
    requested_groups = list(Group.objects.filter(id__in=group_ids))
    if len(requested_groups) != len(group_ids):
        raise ImportDataError("包含不存在或不可选择的角色")
    if viewer is not None:
        visible_requested_ids = set(
            selectable_access_groups_for(
                Group.objects.filter(id__in=group_ids).only("id", "name"), viewer
            ).values_list("id", flat=True)
        )
        if visible_requested_ids != group_ids:
            raise ImportDataError("包含不存在或不可选择的角色")

    normalized_group_ids = normalized_access_group_ids(group_ids)
    groups = list(Group.objects.filter(id__in=normalized_group_ids))
    if len(groups) != len(normalized_group_ids):
        raise ImportDataError("包含不存在或不可选择的角色")
    resource.access_groups.set(groups)
    for layer in resource.map_layers.all():
        layer.access_groups.set(groups)


def normalized_access_group_ids(group_ids: set[int]) -> set[int]:
    _, superadmin_group = ensure_superadmin_defaults(
        create_account=False, attach_existing_superusers=False
    )
    return set(group_ids) | {superadmin_group.id}


def _access_group_ids(raw: Any) -> set[int]:
    if raw in (None, ""):
        return set()
    if not isinstance(raw, list):
        raise ImportDataError("accessGroupIds 必须是数组")
    try:
        return {int(group_id) for group_id in raw}
    except (TypeError, ValueError) as exc:
        raise ImportDataError("accessGroupIds 必须是整数数组") from exc


def _included_columns(
    raw: Any,
    available_columns,
    *,
    required_columns: set[str] | None = None,
) -> list[str]:
    available = list(available_columns)
    required = required_columns or set()
    if raw in (None, ""):
        selected = available
    else:
        if not isinstance(raw, list):
            raise ImportDataError("上传字段列表必须是数组")
        selected = []
        seen = set()
        for item in raw:
            column = str(item or "").strip()
            if column in seen:
                continue
            if column not in available:
                raise ImportDataError(f"上传字段不存在：{column}")
            selected.append(column)
            seen.add(column)

    for column in available:
        if column in required and column not in selected:
            selected.append(column)
    if not selected:
        raise ImportDataError("至少需要选择一个上传字段")
    return selected


def _valid_coordinate_mask(
    df: pd.DataFrame, longitude_column: str, latitude_column: str
) -> pd.Series:
    lon = pd.to_numeric(df[longitude_column], errors="coerce")
    lat = pd.to_numeric(df[latitude_column], errors="coerce")
    decimal_mask = df[longitude_column].map(_is_decimal_coordinate) & df[
        latitude_column
    ].map(_is_decimal_coordinate)
    return decimal_mask & lon.between(-180, 180) & lat.between(-90, 90)


def _is_decimal_coordinate(value: Any) -> bool:
    text = str(value).strip()
    if not re.fullmatch(r"[+-]?\d+\.\d+", text):
        return False
    try:
        Decimal(text)
    except InvalidOperation:
        return False
    return True


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


def _best_coordinate_column(df: pd.DataFrame, *, is_longitude: bool) -> str | None:
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


def _serialize_validation_issues(
    issues: list[ImportValidationIssue],
) -> list[dict[str, Any]]:
    serialized = []
    for issue in issues:
        item: dict[str, Any] = {
            "code": issue.code,
            "message": issue.message,
            "blocking": issue.blocking,
        }
        if issue.count is not None:
            item["count"] = issue.count
        if issue.min_meters is not None:
            item["minMeters"] = issue.min_meters
        if issue.max_meters is not None:
            item["maxMeters"] = issue.max_meters
        if issue.ratio is not None:
            item["ratio"] = issue.ratio
        if issue.target_type is not None:
            item["targetType"] = issue.target_type
        if issue.target_name is not None:
            item["targetName"] = issue.target_name
        serialized.append(item)
    return serialized


def _ensure_table_can_be_written(
    path: Path, table_name: str, *, geographic: bool
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
        if table_name in existing_names:
            raise ImportDataError("后台存储标识已存在，请重新预检后导入")
        return
    with sqlite3.connect(path) as connection:
        exists = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
            (table_name,),
        ).fetchone()
    if exists:
        raise ImportDataError("后台存储标识已存在，请重新预检后导入")


def _write_geopackage_layer(path: Path, table_name: str, gdf) -> None:
    if path.exists():
        gdf.to_file(path, layer=table_name, driver="GPKG", mode="a")
    else:
        gdf.to_file(path, layer=table_name, driver="GPKG")


def _upsert_geographic_resource(
    *,
    name: str,
    table_name: str,
    bounds: list[float],
    stats: CoordinateStats,
    ignore_coordinate_uncertainty: bool,
    source_size_bytes: int,
    user,
) -> DataResource:
    code = _unique_resource_code(stable_catalog_code("vector", table_name))
    spatial_extent = ",".join(f"{value:.6f}" for value in bounds) if bounds else ""
    resource = DataResource.objects.create(
        code=code,
        name=name,
        data_type=DataResource.DataType.VECTOR,
        source="用户导入",
        provider="",
        spatial_extent=spatial_extent,
        coordinate_system="EPSG:4326",
        file_format="GPKG",
        storage_path=table_name,
        description=f"由 Excel/CSV 导入的地理表：{table_name}",
        quality_note=_quality_note(stats, ignore_coordinate_uncertainty),
        maintainer=user if getattr(user, "is_authenticated", False) else None,
        size_bytes=source_size_bytes,
        item_count=int(stats.valid_rows),
        status=DataResource.Status.ACTIVE,
    )
    return resource


def _unique_resource_code(base_code: str) -> str:
    if not DataResource.objects.filter(code=base_code).exists():
        return base_code
    for _ in range(100):
        candidate = f"{base_code[:67]}-{uuid.uuid4().hex[:12]}"
        if not DataResource.objects.filter(code=candidate).exists():
            return candidate
    raise ImportDataError("无法生成唯一数据资源编号")


def _quality_note(stats: CoordinateStats, ignore_coordinate_uncertainty: bool) -> str:
    error_range = ""
    if stats.error_min_meters is not None and stats.error_max_meters is not None:
        error_range = f"坐标量化误差范围约 {stats.error_min_meters:.6f} - {stats.error_max_meters:.6f} 米。"
    uncertainty_note = (
        "坐标不确定性差距已由用户确认忽略。" if ignore_coordinate_uncertainty else ""
    )
    missing_note = f"坐标有效 {stats.valid_rows}/{stats.total_rows} 行。"
    return f"{missing_note}{error_range}{uncertainty_note}"


def _required_text(value: Any, label: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise ImportDataError(f"{label}不能为空")
    return text
