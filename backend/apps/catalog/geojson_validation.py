from __future__ import annotations

import math
from typing import Any

from apps.catalog.importer import position_error_meters


UNCERTAINTY_RATIO_THRESHOLD = 200


def validate_geojson_geometries(gdf) -> tuple[Any, list[dict[str, Any]]]:
    warnings: list[dict[str, Any]] = []
    keep_indexes = []
    missing_geometry_count = 0
    invalid_longitude_count = 0
    invalid_latitude_count = 0
    coordinate_errors = []

    for index, geometry in gdf.geometry.items():
        coordinates = list(_coordinate_pairs(geometry))
        if not coordinates:
            missing_geometry_count += 1
            continue

        has_invalid_longitude = any(
            not _is_finite(longitude) or longitude < -180 or longitude > 180
            for longitude, _ in coordinates
        )
        has_invalid_latitude = any(
            not _is_finite(latitude) or latitude < -90 or latitude > 90
            for _, latitude in coordinates
        )
        if has_invalid_longitude:
            invalid_longitude_count += 1
        if has_invalid_latitude:
            invalid_latitude_count += 1
        if has_invalid_longitude or has_invalid_latitude:
            continue

        keep_indexes.append(index)
        for longitude, latitude in coordinates:
            coordinate_errors.append(
                position_error_meters(str(longitude), str(latitude))
            )

    if missing_geometry_count:
        warnings.append(
            {
                "code": "missing_geometry",
                "count": missing_geometry_count,
                "message": f"已忽略 {missing_geometry_count} 条不含地理坐标的数据。",
            }
        )
    if invalid_longitude_count:
        warnings.append(
            {
                "code": "invalid_longitude",
                "count": invalid_longitude_count,
                "message": f"已忽略 {invalid_longitude_count} 条经度不在 -180 到 180 范围内的数据。",
            }
        )
    if invalid_latitude_count:
        warnings.append(
            {
                "code": "invalid_latitude",
                "count": invalid_latitude_count,
                "message": f"已忽略 {invalid_latitude_count} 条纬度不在 -90 到 90 范围内的数据。",
            }
        )

    _append_uncertainty_warning(warnings, coordinate_errors)
    return gdf.loc[keep_indexes].copy(), warnings


def _append_uncertainty_warning(
    warnings: list[dict[str, Any]], coordinate_errors: list[float]
) -> None:
    positive_errors = [error for error in coordinate_errors if error > 0]
    if not positive_errors:
        return
    minimum = min(positive_errors)
    maximum = max(positive_errors)
    ratio = maximum / minimum
    if ratio <= UNCERTAINTY_RATIO_THRESHOLD:
        return
    warnings.append(
        {
            "code": "coordinate_uncertainty",
            "minMeters": round(minimum, 6),
            "maxMeters": round(maximum, 6),
            "ratio": round(ratio, 2),
            "message": (
                f"坐标不确定性差距超过 {UNCERTAINTY_RATIO_THRESHOLD} 倍："
                f"最小约 {minimum:.6f} 米，最大约 {maximum:.6f} 米。"
            ),
        }
    )


def _coordinate_pairs(geometry):
    if geometry is None or getattr(geometry, "is_empty", True):
        return

    geometry_type = getattr(geometry, "geom_type", "")
    if geometry_type == "Point":
        longitude, latitude = geometry.x, geometry.y
        yield float(longitude), float(latitude)
        return
    if geometry_type in {"LineString", "LinearRing"}:
        for coordinate in geometry.coords:
            yield float(coordinate[0]), float(coordinate[1])
        return
    if geometry_type == "Polygon":
        for coordinate in geometry.exterior.coords:
            yield float(coordinate[0]), float(coordinate[1])
        for interior in geometry.interiors:
            for coordinate in interior.coords:
                yield float(coordinate[0]), float(coordinate[1])
        return
    if hasattr(geometry, "geoms"):
        for part in geometry.geoms:
            yield from _coordinate_pairs(part)


def _is_finite(value: float) -> bool:
    return math.isfinite(value)
