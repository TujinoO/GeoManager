from __future__ import annotations

import io
import threading
from typing import Any

from django.utils import timezone
from PIL import Image
from rasterio.enums import Resampling
from rasterio.windows import from_bounds

from apps.core.storage import raster_processed_path
from apps.raster.models import RasterDataset
from apps.raster.services.color_mapping import array_to_rgba
from apps.raster.services.constants import DEFAULT_TILE_SIZE
from apps.raster.services.exceptions import RasterRenderError, RasterTileOutsideExtent
from apps.raster.services.geo_utils import (
    intersects_bounds,
    style_hash_for,
    tile_bounds_3857,
)
from apps.raster.services.rules_engine import normalize_rules, read_source_bands


_TILE_STYLES: dict[tuple[int, str], dict[str, Any]] = {}
_TILE_STYLES_LOCK = threading.RLock()


def register_tile_style(
    dataset: RasterDataset, rules: dict[str, Any] | None
) -> dict[str, Any]:
    if dataset.status != RasterDataset.Status.READY:
        raise RasterRenderError("栅格数据集尚未完成预处理")
    raster_path = raster_processed_path(dataset.processed_relative_path)
    normalized_rules = normalize_rules(
        rules or dataset.default_rules, dataset.processed_gdalinfo
    )
    sh = style_hash_for(raster_path, normalized_rules)

    with _TILE_STYLES_LOCK:
        _TILE_STYLES[(dataset.id, sh)] = {
            "dataset_id": dataset.id,
            "rules": normalized_rules,
            "created_at": timezone.now().isoformat(),
        }
    return {
        "delivery": "xyz",
        "datasetId": dataset.id,
        "layerId": dataset.map_layer_id,
        "styleHash": sh,
        "tileUrl": f"/api/raster/tiles/{dataset.id}/{sh}/{{z}}/{{x}}/{{y}}.png",
        "bounds3857": dataset.bounds_3857,
        "bounds4326": dataset.bounds_4326,
        "imageCoordinates": dataset.image_coordinates,
        "rules": normalized_rules,
        "status": "ready",
    }


def render_xyz_tile(dataset_id: int, style_hash: str, z: int, x: int, y: int) -> bytes:
    if z < 0 or x < 0 or y < 0 or x >= 2**z or y >= 2**z:
        raise RasterTileOutsideExtent("瓦片坐标超出有效范围")

    with _TILE_STYLES_LOCK:
        style = _TILE_STYLES.get((dataset_id, style_hash))
    if not style:
        raise RasterRenderError("符号化瓦片样式不存在或已过期")
    dataset = RasterDataset.objects.get(
        pk=dataset_id, status=RasterDataset.Status.READY
    )
    raster_path = raster_processed_path(dataset.processed_relative_path)
    bounds = tile_bounds_3857(z, x, y)
    if dataset.bounds_3857 and not intersects_bounds(bounds, dataset.bounds_3857):
        raise RasterTileOutsideExtent("瓦片不在栅格空间范围内")

    import rasterio

    with rasterio.open(raster_path) as src:
        if not intersects_bounds(bounds, src.bounds):
            raise RasterTileOutsideExtent("瓦片不在栅格空间范围内")
        rules = style["rules"]
        indexes = read_source_bands(rules)
        window = from_bounds(*bounds, transform=src.transform)
        data = src.read(
            indexes=indexes,
            window=window,
            out_shape=(len(indexes), DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE),
            boundless=True,
            masked=True,
            resampling=Resampling.nearest,
        )
    rgba = array_to_rgba(data, rules, dataset.processed_gdalinfo)
    buffer = io.BytesIO()
    Image.fromarray(rgba, mode="RGBA").save(buffer, format="PNG")
    return buffer.getvalue()
