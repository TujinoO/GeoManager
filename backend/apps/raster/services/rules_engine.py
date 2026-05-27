from __future__ import annotations

from typing import Any

from apps.raster.services.constants import UNIQUE_COLORS
from apps.raster.services.exceptions import RasterRenderError


def default_raster_rules(metadata: dict[str, Any], fallback_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    bands = metadata.get("bands") or []
    band_count = len(bands)
    if band_count <= 1:
        mode = "gray"
        selected_bands = [1]
    elif band_count == 2:
        mode = "rgb"
        selected_bands = [1, 2, 2]
    else:
        mode = "rgb"
        selected_bands = [1, 2, 3]
    return {
        "mode": mode,
        "bands": selected_bands,
        "stretch": {
            "enabled": True,
            "type": "minmax",
            "perBand": {
                str(index): {"min": band_min_max(metadata, index)[0], "max": band_min_max(metadata, index)[1]}
                if fallback_metadata is None
                else {
                    "min": band_min_max(metadata, index, fallback_metadata)[0],
                    "max": band_min_max(metadata, index, fallback_metadata)[1],
                }
                for index in range(1, max(band_count, 1) + 1)
            },
        },
        "palette": "poplar",
        "uniqueValues": default_unique_values(metadata, fallback_metadata),
    }


def normalize_rules(rules: dict[str, Any], metadata: dict[str, Any]) -> dict[str, Any]:
    defaults = default_raster_rules(metadata)
    raw = {**defaults, **(rules or {})}
    mode = str(raw.get("mode") or defaults["mode"])
    if mode not in {"gray", "rgb", "pseudocolor", "unique"}:
        raise RasterRenderError(f"不支持的栅格符号化模式：{mode}")

    band_count = max(1, len(metadata.get("bands") or []))
    if mode == "rgb":
        bands = list(raw.get("bands") or defaults["bands"])[:3]
        if len(bands) < 3:
            bands = [*bands, *defaults["bands"]][:3]
    else:
        bands = [list(raw.get("bands") or defaults["bands"])[0]]
    bands = [min(max(int(band), 1), band_count) for band in bands]

    stretch = raw.get("stretch") if isinstance(raw.get("stretch"), dict) else {}
    normalized_stretch = {
        "enabled": bool(stretch.get("enabled", True)),
        "type": str(stretch.get("type") or "minmax"),
        "perBand": normalize_stretch_bands(stretch.get("perBand"), metadata),
    }
    return {
        "mode": mode,
        "bands": bands,
        "stretch": normalized_stretch,
        "palette": str(raw.get("palette") or "poplar"),
        "uniqueValues": normalize_unique_values(raw.get("uniqueValues"), metadata),
    }


def normalize_stretch_bands(value: Any, metadata: dict[str, Any]) -> dict[str, dict[str, float]]:
    result: dict[str, dict[str, float]] = {}
    source = value if isinstance(value, dict) else {}
    for index in range(1, max(1, len(metadata.get("bands") or [])) + 1):
        raw = source.get(str(index)) if isinstance(source.get(str(index)), dict) else {}
        default_min, default_max = band_min_max(metadata, index)
        minimum = float(raw.get("min", default_min))
        maximum = float(raw.get("max", default_max))
        if maximum <= minimum:
            maximum = minimum + 1
        result[str(index)] = {"min": minimum, "max": maximum}
    return result


def normalize_unique_values(value: Any, metadata: dict[str, Any]) -> list[dict[str, Any]]:
    if isinstance(value, list) and value:
        items = value
    else:
        items = default_unique_values(metadata)
    normalized = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        color = str(item.get("color") or UNIQUE_COLORS[index % len(UNIQUE_COLORS)])
        normalized.append(
            {
                "value": int(float(item.get("value", index))),
                "color": color,
                "label": str(item.get("label") or item.get("value", index)),
            }
        )
    return normalized


def default_unique_values(metadata: dict[str, Any], fallback_metadata: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    minimum, maximum = band_min_max(metadata, 1, fallback_metadata)
    if not float(minimum).is_integer() or not float(maximum).is_integer() or maximum - minimum > 32:
        return [
            {"value": 0, "color": "#00000000", "label": "0"},
            {"value": 1, "color": "#2f7d62", "label": "1"},
        ]
    values = []
    for offset, value in enumerate(range(int(minimum), int(maximum) + 1)):
        color = UNIQUE_COLORS[offset % len(UNIQUE_COLORS)]
        values.append({"value": value, "color": color, "label": str(value)})
    return values


def band_min_max(
    metadata: dict[str, Any],
    band_index: int,
    fallback_metadata: dict[str, Any] | None = None,
) -> tuple[float, float]:
    bands = metadata.get("bands") or []
    band = bands[band_index - 1] if 0 <= band_index - 1 < len(bands) else {}
    minimum = band.get("min")
    maximum = band.get("max")
    stats = (band.get("metadata") or {}).get("") or {}
    if (minimum is None or maximum is None) and fallback_metadata:
        fallback_min, fallback_max = band_min_max(fallback_metadata, band_index)
        minimum = fallback_min if minimum is None else minimum
        maximum = fallback_max if maximum is None else maximum
    if minimum is None:
        minimum = stats.get("STATISTICS_MINIMUM", 0)
    if maximum is None:
        maximum = stats.get("STATISTICS_MAXIMUM", 255)
    try:
        minimum_float = float(minimum)
        maximum_float = float(maximum)
    except (TypeError, ValueError):
        return 0.0, 255.0
    if maximum_float <= minimum_float:
        maximum_float = minimum_float + 1.0
    return minimum_float, maximum_float


def output_source_bands(rules: dict[str, Any]) -> list[int]:
    bands = [int(value) for value in rules.get("bands") or [1]]
    if rules.get("mode") == "rgb":
        return bands[:3]
    return [bands[0]]


def stretch_min_max(rules: dict[str, Any], metadata: dict[str, Any], band_index: int) -> tuple[float, float]:
    per_band = ((rules.get("stretch") or {}).get("perBand") or {}).get(str(band_index)) or {}
    default_min, default_max = band_min_max(metadata, band_index)
    minimum = float(per_band.get("min", default_min))
    maximum = float(per_band.get("max", default_max))
    if maximum <= minimum:
        maximum = minimum + 1
    return minimum, maximum
