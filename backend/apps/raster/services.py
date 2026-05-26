from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from apps.catalog.models import MapLayer
from apps.core.storage import StoragePathError, raster_cache_path, raster_data_path
from apps.raster.models import RasterCacheRecord


class RasterRenderError(RuntimeError):
    pass


def render_layer_png(layer: MapLayer, width: int, height: int, rules: dict | None = None) -> RasterCacheRecord:
    if layer.layer_type != MapLayer.LayerType.RASTER:
        raise RasterRenderError("该图层不是栅格图层")
    if width <= 0 or height <= 0:
        raise RasterRenderError("输出尺寸必须为正整数")

    rules = rules or layer.raster_rules or {}
    raster_relative_path = layer.source_path or (layer.data_resource.storage_path if layer.data_resource else "")
    if not raster_relative_path:
        raise RasterRenderError("图层未配置栅格相对路径")

    try:
        raster_path = raster_data_path(raster_relative_path)
    except StoragePathError as exc:
        raise RasterRenderError(str(exc)) from exc

    if not raster_path.exists():
        raise RasterRenderError(f"栅格文件不存在：{raster_relative_path}")

    cache_key = _cache_key(raster_path, width, height, rules)
    png_relative_path = f"{cache_key}.png"
    png_path = raster_cache_path(png_relative_path)

    cached = RasterCacheRecord.objects.filter(cache_key=cache_key, status=RasterCacheRecord.Status.READY).first()
    if cached and png_path.exists():
        cached.last_accessed_at = timezone.now()
        cached.save(update_fields=("last_accessed_at",))
        return cached

    script_path = _symbolizer_script(layer)
    payload = {
        "raster_path": str(raster_path),
        "output_png_path": str(png_path),
        "rules": rules,
        "size": {"width": width, "height": height},
        "transparent": True,
    }
    result = subprocess.run(
        [sys.executable, str(script_path)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        timeout=settings.PROJECT_CONFIG.raster.symbolizer_timeout_seconds,
        check=False,
    )
    if result.returncode != 0:
        _record_failed(cache_key, layer, raster_relative_path, png_relative_path, width, height, rules, result.stderr)
        raise RasterRenderError(result.stderr.strip() or "栅格符号化脚本执行失败")

    try:
        script_output = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        _record_failed(cache_key, layer, raster_relative_path, png_relative_path, width, height, rules, result.stdout)
        raise RasterRenderError("栅格符号化脚本没有返回有效 JSON") from exc

    if script_output.get("status") != "ok":
        error = script_output.get("error") or "栅格符号化失败"
        _record_failed(cache_key, layer, raster_relative_path, png_relative_path, width, height, rules, error)
        raise RasterRenderError(error)
    if not png_path.exists():
        raise RasterRenderError("栅格符号化脚本未生成 PNG 文件")

    record, _ = RasterCacheRecord.objects.update_or_create(
        cache_key=cache_key,
        defaults={
            "layer": layer,
            "data_resource": layer.data_resource,
            "raster_relative_path": raster_relative_path,
            "png_relative_path": png_relative_path,
            "rules": rules,
            "output_width": width,
            "output_height": height,
            "file_size": png_path.stat().st_size,
            "status": RasterCacheRecord.Status.READY,
            "error_message": "",
        },
    )
    cleanup_png_cache()
    return record


def cleanup_png_cache() -> None:
    max_bytes = settings.PROJECT_CONFIG.raster.png_cache_max_mb * 1024 * 1024
    records = list(RasterCacheRecord.objects.filter(status=RasterCacheRecord.Status.READY))
    total = sum(_cache_file_size(record) for record in records)
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
        file_size = _cache_file_size(record)
        raster_cache_path(record.png_relative_path).unlink(missing_ok=True)
        total -= file_size
        record.delete()


def _cache_key(raster_path: Path, width: int, height: int, rules: dict) -> str:
    stat = raster_path.stat()
    payload = {
        "raster_path": str(raster_path.resolve()),
        "raster_mtime": stat.st_mtime_ns,
        "rules": rules,
        "width": width,
        "height": height,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _symbolizer_script(layer: MapLayer) -> Path:
    script_relative = layer.raster_symbolizer_script or settings.PROJECT_CONFIG.raster.default_symbolizer_script
    script_path = (settings.BASE_DIR / script_relative).resolve()
    try:
        script_path.relative_to(settings.BASE_DIR.resolve())
    except ValueError as exc:
        raise RasterRenderError("栅格符号化脚本必须位于后端程序目录内") from exc
    if not script_path.exists():
        raise RasterRenderError(f"栅格符号化脚本不存在：{script_relative}")
    return script_path


def _record_failed(
    cache_key: str,
    layer: MapLayer,
    raster_relative_path: str,
    png_relative_path: str,
    width: int,
    height: int,
    rules: dict,
    error: str,
) -> None:
    RasterCacheRecord.objects.update_or_create(
        cache_key=cache_key,
        defaults={
            "layer": layer,
            "data_resource": layer.data_resource,
            "raster_relative_path": raster_relative_path,
            "png_relative_path": png_relative_path,
            "rules": rules,
            "output_width": width,
            "output_height": height,
            "file_size": 0,
            "status": RasterCacheRecord.Status.FAILED,
            "error_message": error,
        },
    )


def _cache_file_size(record: RasterCacheRecord) -> int:
    path = raster_cache_path(record.png_relative_path)
    return path.stat().st_size if path.exists() else 0

