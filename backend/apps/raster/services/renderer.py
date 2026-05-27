from __future__ import annotations

import io
import tempfile
from pathlib import Path
from typing import Any, Callable

import numpy as np
from django.utils import timezone
from PIL import Image
from rasterio.enums import Resampling
from rasterio.windows import from_bounds

from apps.core.storage import StoragePathError, raster_cache_path, raster_output_path, raster_processed_path
from apps.raster.models import RasterCacheRecord, RasterDataset
from apps.raster.services.cache import cleanup_png_cache
from apps.raster.services.color_mapping import array_to_rgba, colorize_gray_png
from apps.raster.services.constants import DEFAULT_TILE_SIZE
from apps.raster.services.exceptions import RasterRenderError
from apps.raster.services.gdal_ops import gdal_translate_command, run_gdal_command
from apps.raster.services.geo_utils import (
    cache_key_for,
    intersects_bounds,
    style_hash_for,
    tile_bounds_3857,
    transparent_png,
)
from apps.raster.services.importer import dataset_for_layer
from apps.raster.services.rules_engine import normalize_rules, output_source_bands
from apps.raster.services.serializers import render_result


def render_layer_png(layer: Any, width: int, height: int, rules: dict | None = None) -> RasterCacheRecord:
    result = render_dataset_png(
        dataset=dataset_for_layer(layer),
        layer=layer,
        width=width,
        height=height,
        rules=rules or layer.raster_rules,
    )
    return RasterCacheRecord.objects.get(cache_key=result["cacheKey"])


def render_dataset_png(
    *,
    dataset: RasterDataset,
    layer: Any,
    width: int,
    height: int,
    rules: dict | None = None,
    progress: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    if width <= 0 or height <= 0:
        raise RasterRenderError("输出尺寸必须为正整数")
    if dataset.status != RasterDataset.Status.READY:
        raise RasterRenderError("栅格数据集尚未完成预处理")
    if not dataset.processed_relative_path:
        raise RasterRenderError("栅格数据集缺少预处理文件")

    try:
        raster_path = raster_processed_path(dataset.processed_relative_path)
    except StoragePathError as exc:
        raise RasterRenderError(str(exc)) from exc
    if not raster_path.exists():
        raise RasterRenderError(f"预处理栅格文件不存在：{dataset.processed_relative_path}")

    normalized_rules = normalize_rules(rules or dataset.default_rules, dataset.processed_gdalinfo)
    cache_key = cache_key_for(raster_path, width, height, normalized_rules)
    png_relative_path = f"{cache_key}.png"
    png_path = raster_cache_path(png_relative_path)

    cached = RasterCacheRecord.objects.filter(cache_key=cache_key, status=RasterCacheRecord.Status.READY).first()
    if cached and png_path.exists():
        cached.last_accessed_at = timezone.now()
        cached.save(update_fields=("last_accessed_at",))
        return render_result(dataset, cached, normalized_rules)

    if progress:
        progress("开始 gdal_translate 栅格符号化")
    render_png_with_gdal_translate(
        raster_path=raster_path,
        output_png_path=png_path,
        width=width,
        height=height,
        rules=normalized_rules,
        metadata=dataset.processed_gdalinfo,
        progress=progress,
    )
    if not png_path.exists():
        raise RasterRenderError("gdal_translate 未生成 PNG 文件")

    record, _ = RasterCacheRecord.objects.update_or_create(
        cache_key=cache_key,
        defaults={
            "layer": layer,
            "data_resource": dataset.data_resource,
            "raster_relative_path": dataset.processed_relative_path,
            "png_relative_path": png_relative_path,
            "rules": normalized_rules,
            "output_width": width,
            "output_height": height,
            "file_size": png_path.stat().st_size,
            "status": RasterCacheRecord.Status.READY,
            "error_message": "",
        },
    )
    cleanup_png_cache()
    return render_result(dataset, record, normalized_rules)


def register_tile_style(dataset: RasterDataset, rules: dict[str, Any] | None) -> dict[str, Any]:
    import threading
    from django.conf import settings as django_settings

    if dataset.status != RasterDataset.Status.READY:
        raise RasterRenderError("栅格数据集尚未完成预处理")
    raster_path = raster_processed_path(dataset.processed_relative_path)
    normalized_rules = normalize_rules(rules or dataset.default_rules, dataset.processed_gdalinfo)
    sh = style_hash_for(raster_path, normalized_rules)

    from apps.raster.services.jobs import _LOCK, _TILE_STYLES

    with _LOCK:
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
        return transparent_png()

    from apps.raster.services.jobs import _LOCK, _TILE_STYLES

    with _LOCK:
        style = _TILE_STYLES.get((dataset_id, style_hash))
    if not style:
        raise RasterRenderError("符号化瓦片样式不存在或已过期")
    dataset = RasterDataset.objects.get(pk=dataset_id, status=RasterDataset.Status.READY)
    raster_path = raster_processed_path(dataset.processed_relative_path)
    bounds = tile_bounds_3857(z, x, y)

    import rasterio

    with rasterio.open(raster_path) as src:
        if not intersects_bounds(bounds, src.bounds):
            return transparent_png()
        rules = normalize_rules(style["rules"], dataset.processed_gdalinfo)
        indexes = output_source_bands(rules)
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


def render_png_with_gdal_translate(
    *,
    raster_path: Path,
    output_png_path: Path,
    width: int,
    height: int,
    rules: dict[str, Any],
    metadata: dict[str, Any],
    progress: Callable[[str], None] | None = None,
) -> None:
    output_png_path.parent.mkdir(parents=True, exist_ok=True)
    mode = rules["mode"]
    if mode in {"gray", "rgb"}:
        command = gdal_translate_command(raster_path, output_png_path, width, height, rules, metadata)
        run_gdal_command(command, progress=progress)
        return

    temp_root = raster_output_path("tmp")
    temp_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=temp_root) as tmpdir:
        temp_png = Path(tmpdir) / "normalized.png"
        temp_rules = {**rules, "mode": "gray", "bands": [rules["bands"][0]]}
        if mode == "unique":
            temp_rules = {**temp_rules, "stretch": {**rules["stretch"], "enabled": False}}
        command = gdal_translate_command(raster_path, temp_png, width, height, temp_rules, metadata)
        run_gdal_command(command, progress=progress)
        gray = np.array(Image.open(temp_png).convert("L"))
        rgba = colorize_gray_png(gray, rules, metadata)
        Image.fromarray(rgba, mode="RGBA").save(output_png_path)
