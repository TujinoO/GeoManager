from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pandas as pd
from django.conf import settings
from shapely.geometry import shape

from apps.catalog.geojson_validation import validate_geojson_geometries
from apps.catalog.models import DataResource
from apps.core.storage import (
    StoragePathError,
    validate_vector_layer_name,
    vector_geopackage_path,
)


class DataQueryError(ValueError):
    pass


@dataclass(frozen=True)
class ResourceProfile:
    fields: list[dict[str, Any]]
    feature_count: int | None
    geometry_type: str
    bounds: list[float]
    raster: dict[str, Any] | None = None


def get_resource_profile(resource: DataResource) -> ResourceProfile:
    if resource.data_type == DataResource.DataType.RASTER:
        from apps.raster.services.profile import get_raster_profile

        raster_info = get_raster_profile(resource)
        if not raster_info:
            return ResourceProfile(
                fields=[], feature_count=None, geometry_type="Raster", bounds=[]
            )
        return ResourceProfile(
            fields=raster_info["fields"],
            feature_count=None,
            geometry_type="Raster",
            bounds=raster_info["bounds"],
            raster=raster_info["raster"],
        )
    if resource.data_type != DataResource.DataType.VECTOR or not resource.storage_path:
        return ResourceProfile(
            fields=[], feature_count=None, geometry_type="", bounds=[]
        )
    gdf = read_vector_resource(resource)

    field_metadata = field_metadata_for_layer(resource.storage_path)

    return ResourceProfile(
        fields=field_profiles(gdf, field_metadata),
        feature_count=len(gdf),
        geometry_type=geometry_type(gdf),
        bounds=[round(float(value), 6) for value in gdf.total_bounds.tolist()]
        if len(gdf)
        else [],
    )


def get_vector_resource_profile(
    resource: DataResource | None = None, layer_name: str | None = None
) -> ResourceProfile:
    if resource is not None:
        return get_resource_profile(resource)

    if layer_name is None:
        return ResourceProfile(
            fields=[], feature_count=None, geometry_type="", bounds=[]
        )

    gdf = read_vector_layer(layer_name)

    field_metadata = field_metadata_for_layer(layer_name)

    return ResourceProfile(
        fields=field_profiles(gdf, field_metadata),
        feature_count=len(gdf),
        geometry_type=geometry_type(gdf),
        bounds=[round(float(value), 6) for value in gdf.total_bounds.tolist()]
        if len(gdf)
        else [],
    )


def query_resource(resource: DataResource, payload: dict[str, Any]) -> dict[str, Any]:
    if resource.data_type != DataResource.DataType.VECTOR:
        raise DataQueryError("当前只支持矢量 GeoPackage 查询")

    gdf = read_vector_resource(resource)
    gdf = apply_spatial_filter(gdf, payload.get("spatialFilter"))
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


def query_vector_resource(
    resource: DataResource | None = None,
    payload: dict[str, Any] | None = None,
    layer_name: str | None = None,
) -> dict[str, Any]:
    if payload is None:
        payload = {}

    if resource is not None:
        return query_resource(resource, payload)

    if layer_name is None:
        raise DataQueryError("必须指定资源或图层名称")

    gdf = read_vector_layer(layer_name)
    gdf = apply_spatial_filter(gdf, payload.get("spatialFilter"))
    gdf = apply_attribute_filters(gdf, payload.get("attributeFilters") or [])

    field_metadata = field_metadata_for_layer(layer_name)

    limit = _limit(payload.get("limit"))
    total_count = len(gdf)
    returned, warnings = validate_geojson_geometries(gdf)
    returned = returned.head(limit).copy()
    returned = normalize_for_geojson(returned)

    return {
        "resourceId": f"vector_{layer_name}",
        "resourceName": layer_name,
        "totalCount": total_count,
        "returnedCount": len(returned),
        "limit": limit,
        "fields": field_profiles(gdf, field_metadata),
        "geojson": json.loads(returned.to_json()),
        "warnings": warnings,
    }


def read_vector_resource(resource: DataResource):
    if not resource.storage_path:
        raise DataQueryError("数据资源未配置 GeoPackage 图层名")
    try:
        layer_name = validate_vector_layer_name(resource.storage_path)
        path = vector_geopackage_path()
    except StoragePathError as exc:
        raise DataQueryError(str(exc)) from exc
    if not path.exists():
        raise DataQueryError(f"统一 GeoPackage 文件不存在：{path}")

    try:
        import geopandas as gpd

        gdf = gpd.read_file(path, layer=layer_name)
    except Exception as exc:
        raise DataQueryError(f"读取 GeoPackage 图层失败：{layer_name}，{exc}") from exc

    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)
    return gdf


def read_vector_layer(layer_name: str):
    try:
        validated_name = validate_vector_layer_name(layer_name)
        path = vector_geopackage_path()
    except StoragePathError as exc:
        raise DataQueryError(str(exc)) from exc
    if not path.exists():
        raise DataQueryError(f"统一 GeoPackage 文件不存在：{path}")

    try:
        import geopandas as gpd

        gdf = gpd.read_file(path, layer=validated_name)
    except Exception as exc:
        raise DataQueryError(
            f"读取 GeoPackage 图层失败：{validated_name}，{exc}"
        ) from exc

    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)
    return gdf


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


def apply_spatial_filter(gdf, spatial_filter: dict[str, Any] | None):
    if not spatial_filter:
        return gdf
    geometry = spatial_filter.get("geometry")
    if not geometry:
        return gdf
    try:
        query_geometry = shape(geometry)
    except Exception as exc:
        raise DataQueryError(f"空间查询图形无效：{exc}") from exc
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
    try:
        limit = int(value or settings.PROJECT_CONFIG.limits.query_result_limit)
    except (TypeError, ValueError):
        limit = settings.PROJECT_CONFIG.limits.query_result_limit
    return min(max(limit, 1), settings.PROJECT_CONFIG.limits.query_result_limit)


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
