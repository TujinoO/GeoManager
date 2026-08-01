from __future__ import annotations

import io
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from django.utils import timezone
from PIL import Image
from rasterio.enums import Resampling
from rasterio.windows import from_bounds

from apps.core.storage import raster_processed_path
from apps.raster.models import RasterDataset, RasterStyle
from apps.raster.services.color_mapping import array_to_rgba
from apps.raster.services.constants import DEFAULT_TILE_SIZE
from apps.raster.services.exceptions import RasterRenderError, RasterTileOutsideExtent
from apps.raster.services.geo_utils import (
    intersects_bounds,
    style_hash_for,
    tile_bounds_3857,
)
from apps.raster.services.rules_engine import normalize_rules, read_source_bands


@dataclass
class _TileStyleCacheEntry:
    style: dict[str, Any]
    last_accessed_at: float


_TILE_STYLES: OrderedDict[tuple[int, str], _TileStyleCacheEntry] = OrderedDict()
_TILE_STYLES_LOCK = threading.RLock()
TILE_STYLE_CACHE_MAX_ENTRIES = 256
TILE_STYLE_CACHE_TTL_SECONDS = 60 * 60
RASTER_RENDERER_VERSION = 3


def _prune_tile_styles_locked(*, now: float) -> None:
    while _TILE_STYLES:
        _, oldest = next(iter(_TILE_STYLES.items()))
        if now - oldest.last_accessed_at < TILE_STYLE_CACHE_TTL_SECONDS:
            break
        _TILE_STYLES.popitem(last=False)
    while len(_TILE_STYLES) > TILE_STYLE_CACHE_MAX_ENTRIES:
        _TILE_STYLES.popitem(last=False)


def _remember_tile_style(
    key: tuple[int, str],
    style: dict[str, Any],
    *,
    now: float | None = None,
) -> None:
    accessed_at = time.monotonic() if now is None else now
    with _TILE_STYLES_LOCK:
        _prune_tile_styles_locked(now=accessed_at)
        _TILE_STYLES.pop(key, None)
        _TILE_STYLES[key] = _TileStyleCacheEntry(style, accessed_at)
        _prune_tile_styles_locked(now=accessed_at)


def _get_tile_style(
    key: tuple[int, str], *, now: float | None = None
) -> dict[str, Any] | None:
    accessed_at = time.monotonic() if now is None else now
    with _TILE_STYLES_LOCK:
        _prune_tile_styles_locked(now=accessed_at)
        entry = _TILE_STYLES.pop(key, None)
        if entry is None:
            return None
        entry.last_accessed_at = accessed_at
        _TILE_STYLES[key] = entry
        return entry.style


def register_tile_style(
    dataset: RasterDataset, rules: dict[str, Any] | None
) -> dict[str, Any]:
    if dataset.status != RasterDataset.Status.READY:
        raise RasterRenderError("栅格数据集尚未完成预处理")
    raster_path = raster_processed_path(dataset.processed_relative_path)
    normalized_rules = normalize_rules(
        rules or dataset.default_rules, dataset.processed_gdalinfo
    )
    sh = style_hash_for(
        raster_path,
        {
            "rendererVersion": RASTER_RENDERER_VERSION,
            "rules": normalized_rules,
        },
    )

    _remember_tile_style(
        (dataset.id, sh),
        {
            "dataset_id": dataset.id,
            "rules": normalized_rules,
            "created_at": timezone.now().isoformat(),
        },
    )
    RasterStyle.objects.update_or_create(
        dataset=dataset,
        style_hash=sh,
        defaults={"rules": normalized_rules},
    )
    return {
        "delivery": "xyz",
        "datasetId": dataset.id,
        "layerId": dataset.map_layer_id,
        "styleHash": sh,
        "tileUrl": (
            f"/api/raster/tiles/{dataset.id}/{sh}/{{z}}/{{x}}/{{y}}.png"
            f"?rv={RASTER_RENDERER_VERSION}"
        ),
        "bounds3857": dataset.bounds_3857,
        "bounds4326": dataset.bounds_4326,
        "imageCoordinates": dataset.image_coordinates,
        "rules": normalized_rules,
        "status": "ready",
    }


def render_xyz_tile(dataset_id: int, style_hash: str, z: int, x: int, y: int) -> bytes:
    return _render_xyz_tile_cached(dataset_id, style_hash, z, x, y)


@lru_cache(maxsize=128)
def _render_xyz_tile_cached(
    dataset_id: int, style_hash: str, z: int, x: int, y: int
) -> bytes:
    if z < 0 or x < 0 or y < 0 or x >= 2**z or y >= 2**z:
        raise RasterTileOutsideExtent("瓦片坐标超出有效范围")

    style_key = (dataset_id, style_hash)
    style = _get_tile_style(style_key)
    if not style:
        persisted = RasterStyle.objects.filter(
            dataset_id=dataset_id, style_hash=style_hash
        ).first()
        if persisted:
            style = {
                "dataset_id": dataset_id,
                "rules": persisted.rules,
                "created_at": persisted.created_at.isoformat(),
            }
            _remember_tile_style(style_key, style)
        else:
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


def _clear_renderer_caches() -> None:
    with _TILE_STYLES_LOCK:
        _TILE_STYLES.clear()
    _render_xyz_tile_cached.cache_clear()
