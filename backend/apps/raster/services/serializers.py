from __future__ import annotations

from typing import Any

from apps.raster.models import RasterDataset
from apps.raster.services.rules_engine import band_min_max


def serialize_raster_dataset(dataset: RasterDataset) -> dict[str, Any]:
    return {
        "id": dataset.id,
        "name": dataset.name,
        "code": dataset.code,
        "status": dataset.status,
        "sourcePath": dataset.source_relative_path,
        "processedPath": dataset.processed_relative_path,
        "sourceMetadataPath": dataset.source_metadata_relative_path,
        "processedMetadataPath": dataset.processed_metadata_relative_path,
        "dataResourceId": dataset.data_resource_id,
        "mapLayerId": dataset.map_layer_id,
        "bandCount": dataset.band_count,
        "bounds3857": dataset.bounds_3857,
        "bounds4326": dataset.bounds_4326,
        "imageCoordinates": dataset.image_coordinates,
        "defaultRules": dataset.default_rules,
        "sourceFileSize": dataset.source_file_size,
        "processedFileSize": dataset.processed_file_size,
        "progressLog": dataset.progress_log,
        "errorMessage": dataset.error_message,
        "importedAt": dataset.imported_at.isoformat() if dataset.imported_at else None,
        "processedAt": dataset.processed_at.isoformat() if dataset.processed_at else None,
        "metadata": compact_raster_metadata(dataset.processed_gdalinfo or dataset.source_gdalinfo, dataset.source_gdalinfo),
    }


def compact_raster_metadata(metadata: dict[str, Any], fallback_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    bands = []
    for band in metadata.get("bands") or []:
        band_number = int(band.get("band") or len(bands) + 1)
        bands.append(
            {
                "band": band_number,
                "type": band.get("type", ""),
                "description": band.get("description") or f"Band {band_number}",
                "colorInterpretation": band.get("colorInterpretation", ""),
                "min": band_min_max(metadata, band_number, fallback_metadata)[0],
                "max": band_min_max(metadata, band_number, fallback_metadata)[1],
            }
        )
    return {
        "size": metadata.get("size") or [],
        "driver": metadata.get("driverShortName", ""),
        "coordinateSystem": (metadata.get("stac") or {}).get("proj:epsg") or "",
        "bands": bands,
    }


def render_result(dataset: RasterDataset, record: Any, rules: dict[str, Any]) -> dict[str, Any]:
    from apps.raster.services.geo_utils import style_hash_for
    from apps.core.storage import raster_processed_path

    raster_path = raster_processed_path(dataset.processed_relative_path)
    return {
        "delivery": "image",
        "datasetId": dataset.id,
        "layerId": dataset.map_layer_id,
        "cacheKey": record.cache_key,
        "styleHash": style_hash_for(raster_path, rules),
        "pngUrl": f"/api/raster/png/{record.cache_key}.png",
        "fileSize": record.file_size,
        "width": record.output_width,
        "height": record.output_height,
        "status": record.status,
        "bounds3857": dataset.bounds_3857,
        "bounds4326": dataset.bounds_4326,
        "imageCoordinates": dataset.image_coordinates,
        "rules": rules,
    }
