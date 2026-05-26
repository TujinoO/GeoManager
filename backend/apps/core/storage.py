from __future__ import annotations

from pathlib import Path

from django.conf import settings


class StoragePathError(ValueError):
    pass


def business_path(*parts: str) -> Path:
    return _safe_join(settings.PROJECT_CONFIG.business_data_root, *parts)


def geographic_path(*parts: str) -> Path:
    return _safe_join(settings.PROJECT_CONFIG.geographic_data_root, *parts)


def vector_data_path(relative_path: str) -> Path:
    return geographic_path("vector", relative_path)


def raster_data_path(relative_path: str) -> Path:
    return geographic_path("raster", relative_path)


def raster_cache_path(relative_path: str) -> Path:
    return geographic_path("png", "cache", relative_path)


def _safe_join(root: Path, *parts: str) -> Path:
    root = root.resolve()
    candidate = root
    for part in parts:
        path_part = Path(part)
        if path_part.is_absolute() or ".." in path_part.parts:
            raise StoragePathError(f"非法路径片段：{part}")
        candidate = candidate / path_part
    candidate = candidate.resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise StoragePathError("路径越过了配置的数据根目录") from exc
    return candidate

