from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pandas as pd
from shapely.geometry import box, shape

from apps.catalog.models import DataResource
from apps.core.runtime_config import runtime_query_result_limit
from apps.core.storage import (
    StoragePathError,
    validate_vector_layer_name,
    vector_geopackage_path,
)


class DataQueryError(ValueError):
    pass


MAX_RTREE_WHERE_IDS = 5000


@dataclass(frozen=True)
class ResourceProfile:
    fields: list[dict[str, Any]]
    feature_count: int | None
    geometry_type: str
    bounds: list[float]
    raster: dict[str, Any] | None = None


@dataclass(frozen=True)
class GeopackageLayerMetadata:
    name: str
    feature_count: int
    geometry_type: str
    bounds: list[float]
    coordinate_system: str


def geopackage_layer_names(path: Path) -> list[str]:
    with sqlite3.connect(path) as connection:
        rows = connection.execute(
            """
            SELECT table_name
            FROM gpkg_contents
            WHERE data_type = 'features'
            ORDER BY table_name
            """
        ).fetchall()
    return [str(row[0]) for row in rows]


def geopackage_layer_exists(path: Path, layer_name: str) -> bool:
    if not path.exists():
        return False
    with sqlite3.connect(path) as connection:
        row = connection.execute(
            "SELECT 1 FROM gpkg_contents WHERE data_type = 'features' AND table_name = ?",
            (layer_name,),
        ).fetchone()
    return bool(row)


def geopackage_layer_metadata(path: Path, layer_name: str) -> GeopackageLayerMetadata:
    with sqlite3.connect(path) as connection:
        row = connection.execute(
            """
            SELECT
              c.min_x,
              c.min_y,
              c.max_x,
              c.max_y,
              g.geometry_type_name,
              s.organization,
              s.organization_coordsys_id,
              g.srs_id
            FROM gpkg_contents AS c
            LEFT JOIN gpkg_geometry_columns AS g
              ON g.table_name = c.table_name
            LEFT JOIN gpkg_spatial_ref_sys AS s
              ON s.srs_id = g.srs_id
            WHERE c.data_type = 'features' AND c.table_name = ?
            """,
            (layer_name,),
        ).fetchone()
        if row is None:
            raise DataQueryError(f"GeoPackage 图层不存在：{layer_name}")
        feature_count = connection.execute(
            f"SELECT COUNT(*) FROM {_quote_sql_identifier(layer_name)}"
        ).fetchone()[0]
    min_x, min_y, max_x, max_y, geom_type, org, org_code, srs_id = row
    bounds = (
        [
            round(float(min_x), 6),
            round(float(min_y), 6),
            round(float(max_x), 6),
            round(float(max_y), 6),
        ]
        if None not in (min_x, min_y, max_x, max_y)
        else []
    )
    return GeopackageLayerMetadata(
        name=layer_name,
        feature_count=int(feature_count),
        geometry_type=str(geom_type or ""),
        bounds=bounds,
        coordinate_system=_coordinate_system_label(org, org_code, srs_id),
    )


def geopackage_layer_epsg(path: Path, layer_name: str) -> int | None:
    with sqlite3.connect(path) as connection:
        row = connection.execute(
            """
            SELECT s.organization, s.organization_coordsys_id, g.srs_id
            FROM gpkg_geometry_columns AS g
            LEFT JOIN gpkg_spatial_ref_sys AS s
              ON s.srs_id = g.srs_id
            WHERE g.table_name = ?
            """,
            (layer_name,),
        ).fetchone()
    if row is None:
        return None
    org, org_code, srs_id = row
    if str(org or "").upper() == "EPSG" and org_code:
        return int(org_code)
    if srs_id and int(srs_id) > 0:
        return int(srs_id)
    return None


def _coordinate_system_label(org, org_code, srs_id) -> str:
    if org and org_code:
        return f"{org}:{org_code}"
    if srs_id:
        return f"SRS:{srs_id}"
    return ""


def _quote_sql_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def resource_profile(resource: DataResource) -> ResourceProfile:
    if resource.data_type != DataResource.DataType.VECTOR or not resource.storage_path:
        return ResourceProfile(
            fields=[], feature_count=None, geometry_type="", bounds=[]
        )
    gdf = read_resource(resource)
    field_metadata = field_metadata_for_layer(resource.storage_path)
    return ResourceProfile(
        fields=field_profiles(gdf, field_metadata),
        feature_count=len(gdf),
        geometry_type=geometry_type(gdf),
        bounds=[round(float(value), 6) for value in gdf.total_bounds.tolist()]
        if len(gdf)
        else [],
    )


def query_resource(resource: DataResource, payload: dict[str, Any]) -> dict[str, Any]:
    from apps.catalog.geojson_validation import validate_geojson_geometries

    if resource.data_type != DataResource.DataType.VECTOR:
        raise DataQueryError("当前只支持矢量 GeoPackage 查询")

    spatial_filter = payload.get("spatialFilter")
    query_geometry = spatial_filter_geometry(spatial_filter)
    gdf = read_resource(resource, bbox=_spatial_prefilter_bbox(query_geometry))
    gdf = apply_spatial_filter(gdf, spatial_filter, query_geometry=query_geometry)
    gdf = apply_attribute_filters(gdf, payload.get("attributeFilters") or [])

    field_metadata = (
        field_metadata_for_layer(resource.storage_path) if resource.storage_path else {}
    )

    limit = _limit(payload.get("limit"))
    total_count = len(gdf)
    returned, warnings = validate_geojson_geometries(gdf)
    returned = returned.head(limit).copy()
    returned = normalize_for_geojson(returned)

    return {
        "resourceId": resource.id,
        "resourceName": resource.name,
        "totalCount": total_count,
        "returnedCount": len(returned),
        "limit": limit,
        "fields": field_profiles(gdf, field_metadata),
        "geojson": json.loads(returned.to_json()),
        "warnings": warnings,
    }


def read_resource(
    resource: DataResource, bbox: tuple[float, float, float, float] | None = None
):
    if not resource.storage_path:
        raise DataQueryError("数据资源未配置 GeoPackage 图层名")
    try:
        layer_name = validate_vector_layer_name(resource.storage_path)
        path = vector_geopackage_path()
    except StoragePathError as exc:
        raise DataQueryError(str(exc)) from exc
    return _read_layer_from_path(path, layer_name, bbox=bbox)


def _read_layer_from_path(
    path: Path, layer_name: str, *, bbox: tuple[float, float, float, float] | None
):
    if not path.exists():
        raise DataQueryError(f"统一 GeoPackage 文件不存在：{path}")

    try:
        import geopandas as gpd

        gdf = _read_geopackage_layer(gpd, path, layer_name, bbox=bbox)
    except Exception as exc:
        raise DataQueryError(f"读取 GeoPackage 图层失败：{layer_name}，{exc}") from exc

    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)
    return gdf


def _read_geopackage_layer(gpd, path: Path, layer_name: str, *, bbox=None):
    if bbox is None:
        return gpd.read_file(path, layer=layer_name)

    read_bbox = _bbox_for_layer_crs(gpd, path, layer_name, bbox)
    if read_bbox is None:
        return gpd.read_file(path, layer=layer_name)
    candidate_ids = _rtree_candidate_feature_ids(path, layer_name, read_bbox)
    if candidate_ids == []:
        return gpd.read_file(path, layer=layer_name, rows=0)
    if candidate_ids is not None and len(candidate_ids) <= MAX_RTREE_WHERE_IDS:
        where_clause = _feature_id_where_clause(path, layer_name, candidate_ids)
        if where_clause:
            try:
                return gpd.read_file(path, layer=layer_name, where=where_clause)
            except Exception:
                pass
    return gpd.read_file(path, layer=layer_name, bbox=read_bbox)


def _bbox_for_layer_crs(
    gpd, path: Path, layer_name: str, bbox: tuple[float, float, float, float]
):
    epsg = geopackage_layer_epsg(path, layer_name)
    if epsg is None:
        return None
    if epsg == 4326:
        return bbox
    projected = gpd.GeoSeries([box(*bbox)], crs="EPSG:4326").to_crs(f"EPSG:{epsg}")
    return tuple(float(value) for value in projected.total_bounds.tolist())


def _rtree_candidate_feature_ids(
    path: Path,
    layer_name: str,
    bbox: tuple[float, float, float, float],
) -> list[int] | None:
    minx, miny, maxx, maxy = bbox
    with sqlite3.connect(path) as connection:
        geometry_column = _geometry_column_name(connection, layer_name)
        if geometry_column is None:
            return None
        rtree_name = f"rtree_{layer_name}_{geometry_column}"
        if not _sqlite_table_exists(connection, rtree_name):
            return None
        rows = connection.execute(
            f"""
            SELECT id
            FROM {_quote_sql_identifier(rtree_name)}
            WHERE maxx >= ? AND minx <= ? AND maxy >= ? AND miny <= ?
            LIMIT ?
            """,
            (minx, maxx, miny, maxy, MAX_RTREE_WHERE_IDS + 1),
        ).fetchall()
    if len(rows) > MAX_RTREE_WHERE_IDS:
        return None
    return [int(row[0]) for row in rows]


def _feature_id_where_clause(
    path: Path,
    layer_name: str,
    feature_ids: list[int],
) -> str:
    if not feature_ids:
        return ""
    with sqlite3.connect(path) as connection:
        fid_column = _primary_key_column_name(connection, layer_name)
    if fid_column is None:
        return ""
    joined_ids = ",".join(str(feature_id) for feature_id in feature_ids)
    return f"{_quote_sql_identifier(fid_column)} IN ({joined_ids})"


def _geometry_column_name(
    connection: sqlite3.Connection, layer_name: str
) -> str | None:
    row = connection.execute(
        "SELECT column_name FROM gpkg_geometry_columns WHERE table_name = ?",
        (layer_name,),
    ).fetchone()
    return str(row[0]) if row else None


def _primary_key_column_name(
    connection: sqlite3.Connection, table_name: str
) -> str | None:
    rows = connection.execute(
        f"PRAGMA table_info({_quote_sql_identifier(table_name)})"
    ).fetchall()
    for row in rows:
        if int(row[5]) > 0:
            return str(row[1])
    return None


def _sqlite_table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
    row = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    ).fetchone()
    return bool(row)


def read_field_metadata(path: Path, table_name: str) -> dict[str, str]:
    metadata: dict[str, str] = {}
    try:
        with sqlite3.connect(path) as connection:
            cursor = connection.execute(
                "SELECT column_name, description FROM gpkg_data_columns WHERE table_name = ?",
                (table_name,),
            )
            for column_name, description in cursor.fetchall():
                if description:
                    metadata[column_name] = description
    except sqlite3.OperationalError as exc:
        if "no such table: gpkg_data_columns" in str(exc):
            return metadata
        raise DataQueryError(f"读取 GeoPackage 字段元数据失败：{table_name}") from exc
    return metadata


def field_metadata_for_layer(layer_name: str) -> dict[str, str]:
    try:
        validated_name = validate_vector_layer_name(layer_name)
        path = vector_geopackage_path()
    except StoragePathError as exc:
        raise DataQueryError(str(exc)) from exc
    if not path.exists():
        return {}
    return read_field_metadata(path, validated_name)


def field_profiles(
    gdf, field_metadata: dict[str, str] | None = None
) -> list[dict[str, Any]]:
    geometry_name = (
        gdf.geometry.name if getattr(gdf, "geometry", None) is not None else "geometry"
    )
    fields = []
    for column in gdf.columns:
        if column == geometry_name:
            continue
        series = gdf[column]
        samples = []
        for value in series.dropna().head(8).tolist():
            samples.append(_json_value(value))
        description = (field_metadata or {}).get(column, "")
        fields.append(
            {
                "name": column,
                "type": str(series.dtype),
                "nullable": bool(series.isna().any()),
                "sampleValues": samples,
                "description": description,
            }
        )
    return fields


def geometry_type(gdf) -> str:
    if len(gdf) == 0:
        return ""
    values = sorted(set(gdf.geometry.geom_type.dropna().astype(str).tolist()))
    if len(values) == 1:
        return values[0]
    return "Mixed"


def spatial_filter_geometry(spatial_filter: dict[str, Any] | None):
    if not spatial_filter:
        return None
    geometry = spatial_filter.get("geometry")
    if not geometry:
        return None
    try:
        query_geometry = shape(geometry)
    except Exception as exc:
        raise DataQueryError(f"空间查询图形无效：{exc}") from exc
    if query_geometry.is_empty:
        return query_geometry
    return query_geometry


def _spatial_prefilter_bbox(query_geometry) -> tuple[float, float, float, float] | None:
    if query_geometry is None:
        return None
    if query_geometry.is_empty:
        return None
    minx, miny, maxx, maxy = query_geometry.bounds
    return float(minx), float(miny), float(maxx), float(maxy)


def apply_spatial_filter(
    gdf, spatial_filter: dict[str, Any] | None, *, query_geometry=None
):
    if not spatial_filter:
        return gdf
    if query_geometry is None:
        query_geometry = spatial_filter_geometry(spatial_filter)
    if query_geometry is None:
        return gdf
    if query_geometry.is_empty:
        return gdf.iloc[0:0]
    return gdf[gdf.geometry.intersects(query_geometry)]


def apply_attribute_filters(gdf, filters: list[dict[str, Any]]):
    for filter_item in filters:
        field = str(filter_item.get("field", "")).strip()
        operator = str(filter_item.get("operator", "contains")).strip()
        if field not in gdf.columns or field == gdf.geometry.name:
            raise DataQueryError(f"属性字段不存在：{field}")

        series = gdf[field]
        value = filter_item.get("value")
        if operator == "contains":
            mask = series.astype(str).str.contains(
                str(value or ""), case=False, na=False
            )
        elif operator == "eq":
            mask = series == _coerce_value(series, value)
        elif operator == "ne":
            mask = series != _coerce_value(series, value)
        elif operator in {"gt", "gte", "lt", "lte"}:
            typed_value = _coerce_value(series, value)
            if operator == "gt":
                mask = series > typed_value
            elif operator == "gte":
                mask = series >= typed_value
            elif operator == "lt":
                mask = series < typed_value
            else:
                mask = series <= typed_value
        elif operator == "between":
            low = _coerce_value(series, value)
            high = _coerce_value(series, filter_item.get("valueTo"))
            mask = series.between(low, high)
        else:
            raise DataQueryError(f"不支持的属性操作符：{operator}")
        gdf = gdf[mask.fillna(False)]
    return gdf


def normalize_for_geojson(gdf):
    normalized = gdf.copy()
    for column in normalized.columns:
        if column == normalized.geometry.name:
            continue
        series = normalized[column]
        if pd.api.types.is_datetime64_any_dtype(series):
            normalized[column] = series.dt.strftime("%Y-%m-%d")
        else:
            normalized[column] = series.map(_json_value)
    return normalized


def _limit(value: Any) -> int:
    max_limit = runtime_query_result_limit()
    try:
        limit = int(value or max_limit)
    except (TypeError, ValueError):
        limit = max_limit
    return min(max(limit, 1), max_limit)


def _coerce_value(series, value: Any):
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(value)
    if pd.api.types.is_datetime64_any_dtype(series):
        return pd.to_datetime(value)
    return str(value)


def _json_value(value: Any):
    if pd.isna(value):
        return None
    if isinstance(value, datetime | date):
        return value.isoformat()
    if hasattr(value, "item"):
        return value.item()
    return value
