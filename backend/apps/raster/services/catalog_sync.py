from __future__ import annotations

from typing import Any

from apps.catalog.models import DataResource, MapLayer
from apps.raster.models import RasterDataset


def upsert_catalog_records(
    *,
    dataset: RasterDataset,
    source_info: dict[str, Any],
    processed_info: dict[str, Any],
    default_rules: dict[str, Any],
    bounds_4326: list[float],
) -> tuple[DataResource, MapLayer]:
    spatial_extent = ",".join(f"{value:.6f}" for value in bounds_4326) if bounds_4326 else ""
    coordinate_system = f"EPSG:{(processed_info.get('stac') or {}).get('proj:epsg', 3857)}"
    data_resource, _ = DataResource.objects.update_or_create(
        code=dataset.code,
        defaults={
            "name": dataset.name,
            "data_type": DataResource.DataType.RASTER,
            "source": "栅格导入",
            "provider": "",
            "spatial_extent": spatial_extent,
            "coordinate_system": coordinate_system,
            "file_format": "COG",
            "storage_path": dataset.processed_relative_path,
            "description": f"源文件：{dataset.source_relative_path}",
            "quality_note": "导入时使用 gdalwarp 统一投影到 EPSG:3857 并输出 COG。",
            "status": DataResource.Status.ACTIVE,
        },
    )
    map_layer, _ = MapLayer.objects.update_or_create(
        code=dataset.code,
        defaults={
            "name": dataset.name,
            "layer_type": MapLayer.LayerType.RASTER,
            "geometry_type": MapLayer.GeometryType.MIXED,
            "data_resource": data_resource,
            "source_path": dataset.processed_relative_path,
            "default_visible": False,
            "default_opacity": 90,
            "bounds": bounds_4326,
            "legend": "",
            "raster_rules": default_rules,
            "is_active": True,
        },
    )
    return data_resource, map_layer
