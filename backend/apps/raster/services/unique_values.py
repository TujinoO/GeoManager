from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import rasterio

from apps.core.storage import StoragePathError, raster_processed_path
from apps.raster.models import RasterDataset
from apps.raster.services.categorical import (
    categorical_class_entries,
    default_categorical_color,
)
from apps.raster.services.color_mapping import hex_to_rgba
from apps.raster.services.exceptions import RasterRenderError
from apps.raster.services.rules_engine import is_integer_band

MAX_UNIQUE_VALUES = 4096


def validate_unique_style(raster_path: Path, rules: dict[str, Any]) -> None:
    """Reject styles that would replace an image with fully transparent tiles."""
    if not rules["uniqueValues"]:
        raise RasterRenderError("当前波段缺少唯一值色表，请先执行分类")
    # Use the final color for a value, as array_to_rgba does for duplicate entries.
    alpha_by_value: dict[int, int] = {}
    for item in rules["uniqueValues"]:
        color = str(item["color"]).strip().removeprefix("#")
        try:
            if len(color) not in (6, 8):
                raise ValueError
            alpha_by_value[item["value"]] = hex_to_rgba(color)[3]
        except ValueError as exc:
            raise RasterRenderError(f"无效的唯一值颜色：{item['color']}") from exc
    visible_values = [value for value, alpha in alpha_by_value.items() if alpha > 0]
    if not visible_values:
        raise RasterRenderError("唯一值色表全部透明，请至少保留一个可见类别颜色")

    band_index = rules["bands"][0]
    with rasterio.open(raster_path) as src:
        if band_index > src.count or not np.issubdtype(
            np.dtype(src.dtypes[band_index - 1]), np.integer
        ):
            raise RasterRenderError("唯一值分类仅支持有效的整型波段")
        # Scan by block and stop at the first renderable pixel. A partial palette
        # is valid, but a palette for an unrelated band must not blank the layer.
        for _, window in src.block_windows(band_index):
            pixels = src.read(band_index, window=window, masked=True).compressed()
            # Match the representation used by the current tile color renderer.
            rendered_values = pixels.astype(np.float32).astype(np.int64)
            if np.isin(rendered_values, visible_values).any():
                return
    raise RasterRenderError("唯一值色表与当前波段的有效像元不匹配，请重新分类")


def classify_unique_values(dataset: RasterDataset, band_index: int) -> dict[str, Any]:
    if dataset.status != RasterDataset.Status.READY:
        raise RasterRenderError("栅格数据集尚未完成预处理")
    if band_index < 1 or band_index > max(1, dataset.band_count):
        raise RasterRenderError("波段编号超出范围")
    if not is_integer_band(dataset.processed_gdalinfo, band_index):
        raise RasterRenderError("唯一值分类仅支持整型波段，浮点型波段不适用")

    try:
        raster_path = raster_processed_path(dataset.processed_relative_path)
    except StoragePathError as exc:
        raise RasterRenderError(str(exc)) from exc
    if not Path(raster_path).exists():
        raise RasterRenderError(
            f"预处理栅格文件不存在：{dataset.processed_relative_path}"
        )

    values: set[int] = set()
    with rasterio.open(raster_path) as src:
        dtype = np.dtype(src.dtypes[band_index - 1])
        if not np.issubdtype(dtype, np.integer):
            raise RasterRenderError("唯一值分类仅支持整型波段，浮点型波段不适用")
        for _, window in src.block_windows(band_index):
            block = src.read(band_index, window=window, masked=True)
            if np.ma.is_masked(block):
                data = block.compressed()
            else:
                data = np.asarray(block).ravel()
            if data.size == 0:
                continue
            values.update(int(value) for value in np.unique(data))
            if len(values) > MAX_UNIQUE_VALUES:
                raise RasterRenderError(
                    f"唯一值超过 {MAX_UNIQUE_VALUES} 个，不适合使用唯一值分类"
                )

    declared_classes = {
        int(item["value"]): item
        for item in categorical_class_entries(dataset.source_gdalinfo)
    }
    items = []
    for index, value in enumerate(sorted(values)):
        declared = declared_classes.get(value) or {}
        label = str(declared.get("label") or value)
        items.append(
            {
                "value": value,
                "label": label,
                "color": str(
                    declared.get("color")
                    or default_categorical_color(value, label, index)
                ),
            }
        )
    return {"band": band_index, "items": items}
