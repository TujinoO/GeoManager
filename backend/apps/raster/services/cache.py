from __future__ import annotations

from pathlib import Path

from django.conf import settings

from apps.core.storage import raster_cache_path
from apps.raster.models import RasterCacheRecord


def cache_file_size(record: RasterCacheRecord) -> int:
    path = raster_cache_path(record.png_relative_path)
    return path.stat().st_size if path.exists() else 0


def cleanup_png_cache() -> None:
    max_bytes = settings.PROJECT_CONFIG.raster.png_cache_max_mb * 1024 * 1024
    records = list(RasterCacheRecord.objects.filter(status=RasterCacheRecord.Status.READY))
    total = sum(cache_file_size(record) for record in records)
    if total <= max_bytes:
        return

    policy = settings.PROJECT_CONFIG.raster.cache_cleanup_policy
    if policy == "largest_file":
        records.sort(key=lambda record: record.file_size, reverse=True)
    elif policy == "oldest_created":
        records.sort(key=lambda record: record.created_at)
    else:
        records.sort(key=lambda record: record.last_accessed_at)

    for record in records:
        if total <= max_bytes:
            break
        file_size = cache_file_size(record)
        raster_cache_path(record.png_relative_path).unlink(missing_ok=True)
        total -= file_size
        record.delete()
