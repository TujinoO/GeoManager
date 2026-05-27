from __future__ import annotations

import hashlib
import io
import json
import re
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

import numpy as np
from django.conf import settings
from django.db import OperationalError, ProgrammingError
from django.utils import timezone
from PIL import Image
from rasterio.enums import Resampling
from rasterio.windows import from_bounds

from apps.catalog.models import DataResource, MapLayer
from apps.core.storage import (
    StoragePathError,
    raster_cache_path,
    raster_metadata_path,
    raster_output_path,
    raster_processed_path,
    raster_source_path,
)
from apps.raster.models import RasterCacheRecord, RasterDataset


class RasterRenderError(RuntimeError):
    pass


class RasterImportError(RuntimeError):
    pass


class RasterJobError(RuntimeError):
    pass


RASTER_EXTENSIONS = {".tif", ".tiff", ".img", ".vrt"}
WEB_MERCATOR_HALF_WORLD = 20037508.342789244
DEFAULT_TILE_SIZE = 256

PALETTES: dict[str, list[str]] = {
    "poplar": ["#183f39", "#5f9360", "#e8ba5e"],
    "viridis": ["#440154", "#31688e", "#35b779", "#fde725"],
    "terrain": ["#2c7bb6", "#abd9e9", "#ffffbf", "#fdae61", "#8c510a"],
    "thermal": ["#23344c", "#c45c46", "#f6cd70"],
}

UNIQUE_COLORS = [
    "#00000000",
    "#2f7d62",
    "#d9a441",
    "#3b79b7",
    "#c45c46",
    "#7a5aa6",
    "#5aa6a6",
    "#8c6d31",
]


@dataclass
class RasterJob:
    id: str
    kind: str
    status: str = "queued"
    progress_percent: int = 0
    messages: list[str] = field(default_factory=list)
    result: dict[str, Any] | None = None
    error: str = ""
    started_at: float = field(default_factory=time.time)
    finished_at: float | None = None

    def append(self, message: str, percent: int | None = None) -> None:
        text = normalize_progress_text(message)
        if text:
            self.messages.append(text)
            self.messages = self.messages[-120:]
        if percent is not None:
            self.progress_percent = max(self.progress_percent, min(100, percent))

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "kind": self.kind,
            "status": self.status,
            "progressPercent": self.progress_percent,
            "messages": self.messages,
            "result": self.result,
            "error": self.error,
            "startedAt": self.started_at,
            "finishedAt": self.finished_at,
        }


_JOBS: dict[str, RasterJob] = {}
_TILE_STYLES: dict[tuple[int, str], dict[str, Any]] = {}
_LOCK = threading.RLock()


def start_import_job(source_path: str, name: str = "") -> RasterJob:
    job = _create_job("import")

    def runner() -> None:
        try:
            _set_job_running(job.id, "开始导入栅格文件", 2)
            dataset = import_raster_file(Path(source_path), name=name, progress=lambda text: _append_job(job.id, text))
            _finish_job(job.id, serialize_raster_dataset(dataset), "ready")
        except Exception as exc:
            _fail_job(job.id, str(exc))

    threading.Thread(target=runner, name=f"raster-import-{job.id}", daemon=True).start()
    return job


def start_scan_job() -> RasterJob:
    job = _create_job("scan")

    def runner() -> None:
        try:
            _set_job_running(job.id, "开始扫描栅格源数据目录", 1)
            datasets = scan_unprocessed_source_files(progress=lambda text: _append_job(job.id, text))
            _finish_job(
                job.id,
                {"items": [serialize_raster_dataset(dataset) for dataset in datasets], "count": len(datasets)},
                "ready",
            )
        except Exception as exc:
            _fail_job(job.id, str(exc))

    threading.Thread(target=runner, name=f"raster-scan-{job.id}", daemon=True).start()
    return job


def start_render_job(
    *,
    layer_id: int | None,
    dataset_id: int | None,
    width: int,
    height: int,
    rules: dict[str, Any] | None,
    delivery: str,
) -> RasterJob:
    job = _create_job("render")

    def runner() -> None:
        try:
            _set_job_running(job.id, "准备栅格符号化", 5)
            layer = MapLayer.objects.filter(pk=layer_id).first() if layer_id else None
            dataset = RasterDataset.objects.filter(pk=dataset_id).first() if dataset_id else None
            if dataset is None and layer is not None:
                dataset = dataset_for_layer(layer)
            if dataset is None:
                raise RasterRenderError("未找到可渲染的栅格数据集")
            if delivery == "xyz":
                result = register_tile_style(dataset, rules or dataset.default_rules)
                _finish_job(job.id, result, "ready")
                return
            record_result = render_dataset_png(
                dataset=dataset,
                layer=layer or dataset.map_layer,
                width=width,
                height=height,
                rules=rules or dataset.default_rules,
                progress=lambda text: _append_job(job.id, text),
            )
            _finish_job(job.id, record_result, "ready")
        except Exception as exc:
            _fail_job(job.id, str(exc))

    threading.Thread(target=runner, name=f"raster-render-{job.id}", daemon=True).start()
    return job


def get_job(job_id: str) -> RasterJob:
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            raise RasterJobError("任务不存在或已过期")
        return job


def scan_unprocessed_source_files(progress: Callable[[str], None] | None = None) -> list[RasterDataset]:
    source_root = raster_source_path("")
    imported: list[RasterDataset] = []
    for source_path in sorted(source_root.rglob("*")):
        if not is_raster_file(source_path):
            continue
        source_relative = source_path.relative_to(source_root).as_posix()
        dataset = RasterDataset.objects.filter(source_relative_path=source_relative).first()
        processed_exists = bool(dataset and dataset.processed_relative_path and raster_processed_path(dataset.processed_relative_path).exists())
        if dataset and dataset.status == RasterDataset.Status.READY and processed_exists:
            continue
        if progress:
            progress(f"发现未处理源文件：{source_relative}")
        imported.append(import_raster_file(source_path, progress=progress))
    return imported


def scan_unprocessed_source_files_safely() -> None:
    try:
        scan_unprocessed_source_files()
    except (OperationalError, ProgrammingError):
        return
    except Exception:
        return


def import_raster_file(
    input_path: Path,
    *,
    name: str = "",
    progress: Callable[[str], None] | None = None,
) -> RasterDataset:
    input_path = input_path.expanduser().resolve()
    if not input_path.exists() or not input_path.is_file():
        raise RasterImportError(f"源文件不存在：{input_path}")
    if not is_raster_file(input_path):
        raise RasterImportError(f"不支持的栅格文件格式：{input_path.suffix}")

    source_path, source_relative = store_source_file(input_path)
    processed_relative = processed_relative_path(source_relative)
    processed_path = raster_processed_path(processed_relative)
    source_metadata_relative = metadata_relative_path("source", source_relative)
    processed_metadata_relative = metadata_relative_path("preprocessed", processed_relative)

    dataset, _ = RasterDataset.objects.update_or_create(
        source_relative_path=source_relative,
        defaults={
            "name": name.strip() or input_path.stem,
            "code": stable_code("raster", source_relative),
            "processed_relative_path": processed_relative,
            "source_metadata_relative_path": source_metadata_relative,
            "processed_metadata_relative_path": processed_metadata_relative,
            "status": RasterDataset.Status.PROCESSING,
            "progress_log": "",
            "error_message": "",
            "source_file_size": source_path.stat().st_size,
        },
    )
    try:
        append_dataset_progress(dataset, "开始读取源文件元数据")
        if progress:
            progress("gdalinfo -json 源文件")
        source_info = gdalinfo_json(source_path)
        save_metadata(source_metadata_relative, source_info)

        processed_path.parent.mkdir(parents=True, exist_ok=True)
        if processed_path.exists():
            processed_path.unlink()

        append_dataset_progress(dataset, "开始 gdalwarp 预处理到 EPSG:3857 COG")
        if progress:
            progress("gdalwarp -t_srs EPSG:3857 -r nearest -co COMPRESS=DEFLATE -of COG")
        run_gdal_command(
            [
                "gdalwarp",
                "-t_srs",
                "EPSG:3857",
                "-r",
                "nearest",
                "-co",
                "COMPRESS=DEFLATE",
                "-of",
                "COG",
                str(source_path),
                str(processed_path),
            ],
            progress=lambda text: handle_import_progress(dataset, text, progress),
        )

        append_dataset_progress(dataset, "开始读取预处理文件元数据")
        if progress:
            progress("gdalinfo -json 预处理文件")
        processed_info = gdalinfo_json(processed_path)
        save_metadata(processed_metadata_relative, processed_info)

        default_rules = default_raster_rules(processed_info, source_info)
        bounds_3857 = bounds_from_gdalinfo(processed_info)
        bounds_4326 = bounds_4326_from_gdalinfo(processed_info)
        image_coordinates = image_coordinates_from_gdalinfo(processed_info)
        data_resource, map_layer = upsert_catalog_records(
            dataset=dataset,
            source_info=source_info,
            processed_info=processed_info,
            default_rules=default_rules,
            bounds_4326=bounds_4326,
        )

        dataset.source_gdalinfo = source_info
        dataset.processed_gdalinfo = processed_info
        dataset.default_rules = default_rules
        dataset.bounds_3857 = bounds_3857
        dataset.bounds_4326 = bounds_4326
        dataset.image_coordinates = image_coordinates
        dataset.band_count = len(processed_info.get("bands") or [])
        dataset.processed_file_size = processed_path.stat().st_size
        dataset.data_resource = data_resource
        dataset.map_layer = map_layer
        dataset.status = RasterDataset.Status.READY
        dataset.error_message = ""
        dataset.processed_at = timezone.now()
        append_dataset_progress(dataset, "导入完成")
        dataset.save()
        return dataset
    except Exception as exc:
        dataset.status = RasterDataset.Status.FAILED
        dataset.error_message = str(exc)
        append_dataset_progress(dataset, f"导入失败：{exc}")
        dataset.save(update_fields=("status", "error_message", "progress_log", "updated_at"))
        raise


def render_layer_png(layer: MapLayer, width: int, height: int, rules: dict | None = None) -> RasterCacheRecord:
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
    layer: MapLayer | None,
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
    if dataset.status != RasterDataset.Status.READY:
        raise RasterRenderError("栅格数据集尚未完成预处理")
    raster_path = raster_processed_path(dataset.processed_relative_path)
    normalized_rules = normalize_rules(rules or dataset.default_rules, dataset.processed_gdalinfo)
    style_hash = style_hash_for(raster_path, normalized_rules)
    with _LOCK:
        _TILE_STYLES[(dataset.id, style_hash)] = {
            "dataset_id": dataset.id,
            "rules": normalized_rules,
            "created_at": timezone.now().isoformat(),
        }
    return {
        "delivery": "xyz",
        "datasetId": dataset.id,
        "layerId": dataset.map_layer_id,
        "styleHash": style_hash,
        "tileUrl": f"/api/raster/tiles/{dataset.id}/{style_hash}/{{z}}/{{x}}/{{y}}.png",
        "bounds3857": dataset.bounds_3857,
        "bounds4326": dataset.bounds_4326,
        "imageCoordinates": dataset.image_coordinates,
        "rules": normalized_rules,
        "status": "ready",
    }


def render_xyz_tile(dataset_id: int, style_hash: str, z: int, x: int, y: int) -> bytes:
    if z < 0 or x < 0 or y < 0 or x >= 2**z or y >= 2**z:
        return transparent_png()
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


def dataset_for_layer(layer: MapLayer) -> RasterDataset:
    if layer.layer_type != MapLayer.LayerType.RASTER:
        raise RasterRenderError("该图层不是栅格图层")
    dataset = RasterDataset.objects.filter(map_layer=layer, status=RasterDataset.Status.READY).first()
    if dataset:
        return dataset
    if layer.data_resource_id:
        dataset = RasterDataset.objects.filter(data_resource=layer.data_resource, status=RasterDataset.Status.READY).first()
        if dataset:
            return dataset
    raise RasterRenderError("该图层没有关联已预处理的栅格数据集")


def dataset_for_resource(resource: DataResource) -> RasterDataset | None:
    if resource.data_type != DataResource.DataType.RASTER:
        return None
    return RasterDataset.objects.filter(data_resource=resource).order_by("-imported_at").first()


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


def render_result(dataset: RasterDataset, record: RasterCacheRecord, rules: dict[str, Any]) -> dict[str, Any]:
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


def is_raster_file(path: Path) -> bool:
    return path.is_file() and not path.name.startswith(".") and path.suffix.lower() in RASTER_EXTENSIONS


def store_source_file(input_path: Path) -> tuple[Path, str]:
    source_root = raster_source_path("")
    try:
        relative = input_path.relative_to(source_root).as_posix()
        return input_path, relative
    except ValueError:
        digest = hashlib.sha256(str(input_path).encode("utf-8")).hexdigest()[:12]
        target_relative = f"imported/{digest}-{input_path.name}"
        target_path = raster_source_path(target_relative)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        if input_path.resolve() != target_path.resolve():
            shutil.copy2(input_path, target_path)
        return target_path, target_relative


def processed_relative_path(source_relative: str) -> str:
    source = Path(source_relative)
    return (source.parent / f"{source.stem}.cog.tif").as_posix()


def metadata_relative_path(kind: str, raster_relative: str) -> str:
    return (Path(kind) / f"{raster_relative}.gdalinfo.json").as_posix()


def stable_code(prefix: str, value: str) -> str:
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}-{digest}"


def gdalinfo_json(path: Path) -> dict[str, Any]:
    result = subprocess.run(["gdalinfo", "-json", str(path)], capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RasterImportError(result.stderr.strip() or "gdalinfo 执行失败")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RasterImportError("gdalinfo 未返回有效 JSON") from exc


def save_metadata(relative_path: str, metadata: dict[str, Any]) -> None:
    path = raster_metadata_path(relative_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")


def run_gdal_command(command: list[str], progress: Callable[[str], None] | None = None) -> str:
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    output: list[str] = []
    assert process.stdout is not None
    for line in process.stdout:
        output.append(line)
        if progress:
            progress(line)
    return_code = process.wait()
    text = "".join(output)
    if return_code != 0:
        raise RasterImportError(text.strip() or f"命令执行失败：{' '.join(command)}")
    return text


def handle_import_progress(dataset: RasterDataset, text: str, progress: Callable[[str], None] | None = None) -> None:
    cleaned = normalize_progress_text(text)
    if not cleaned:
        return
    append_dataset_progress(dataset, cleaned)
    if progress:
        progress(cleaned)


def append_dataset_progress(dataset: RasterDataset, text: str) -> None:
    cleaned = normalize_progress_text(text)
    if not cleaned:
        return
    dataset.progress_log = "\n".join([*(dataset.progress_log.splitlines()[-160:]), cleaned]).strip()
    dataset.save(update_fields=("progress_log", "updated_at"))


def upsert_catalog_records(
    *,
    dataset: RasterDataset,
    source_info: dict[str, Any],
    processed_info: dict[str, Any],
    default_rules: dict[str, Any],
    bounds_4326: list[float],
) -> tuple[DataResource, MapLayer]:
    spatial_extent = ",".join(f"{value:.6f}" for value in bounds_4326) if bounds_4326 else ""
    coordinate_system = f"EPSG:{(processed_info.get('stac') or {}).get('proj:epsg', 3857)}"
    data_resource, _ = DataResource.objects.update_or_create(
        code=dataset.code,
        defaults={
            "name": dataset.name,
            "data_type": DataResource.DataType.RASTER,
            "source": "栅格导入",
            "provider": "",
            "spatial_extent": spatial_extent,
            "coordinate_system": coordinate_system,
            "file_format": "COG",
            "storage_path": dataset.processed_relative_path,
            "description": f"源文件：{dataset.source_relative_path}",
            "quality_note": "导入时使用 gdalwarp 统一投影到 EPSG:3857 并输出 COG。",
            "status": DataResource.Status.ACTIVE,
        },
    )
    map_layer, _ = MapLayer.objects.update_or_create(
        code=dataset.code,
        defaults={
            "name": dataset.name,
            "layer_type": MapLayer.LayerType.RASTER,
            "geometry_type": MapLayer.GeometryType.MIXED,
            "data_resource": data_resource,
            "source_path": dataset.processed_relative_path,
            "default_visible": False,
            "default_opacity": 90,
            "bounds": bounds_4326,
            "legend": "",
            "raster_rules": default_rules,
            "is_active": True,
        },
    )
    return data_resource, map_layer


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


def gdal_translate_command(
    raster_path: Path,
    output_png_path: Path,
    width: int,
    height: int,
    rules: dict[str, Any],
    metadata: dict[str, Any],
) -> list[str]:
    mode = rules["mode"]
    colorinterp = "gray" if mode != "rgb" else "red,green,blue"
    command = [
        "gdal_translate",
        "-of",
        "PNG",
        "-ot",
        "Byte",
        "-outsize",
        str(width),
        str(height),
        "-colorinterp",
        colorinterp,
    ]
    for output_index, band_index in enumerate(output_source_bands(rules), start=1):
        command.extend(["-b", str(band_index)])
        if rules.get("stretch", {}).get("enabled", True):
            minimum, maximum = stretch_min_max(rules, metadata, band_index)
            command.extend([f"-scale_{output_index}", str(minimum), str(maximum), "0", "255"])
    command.extend([str(raster_path), str(output_png_path)])
    return command


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


def colorize_gray_png(gray: np.ndarray, rules: dict[str, Any], metadata: dict[str, Any]) -> np.ndarray:
    if rules["mode"] == "unique":
        output = np.zeros((*gray.shape, 4), dtype=np.uint8)
        for item in rules["uniqueValues"]:
            rgba = hex_to_rgba(str(item["color"]))
            output[gray == int(item["value"])] = rgba
        return output
    palette = palette_array(str(rules.get("palette") or "poplar"))
    scaled = gray.astype(np.float32) / 255.0
    output = np.zeros((*gray.shape, 4), dtype=np.uint8)
    stops = np.linspace(0.0, 1.0, len(palette), dtype=np.float32)
    for channel in range(3):
        output[..., channel] = np.interp(scaled, stops, palette[:, channel]).astype(np.uint8)
    output[..., 3] = 255
    return output


def array_to_rgba(data: np.ma.MaskedArray, rules: dict[str, Any], metadata: dict[str, Any]) -> np.ndarray:
    mode = rules["mode"]
    masks = np.ma.getmaskarray(data)
    if masks.ndim == 0:
        valid = np.ones(data.shape[-2:], dtype=bool)
    else:
        valid = ~np.any(masks, axis=0)
    values = np.ma.filled(data, 0).astype(np.float32)
    output = np.zeros((values.shape[-2], values.shape[-1], 4), dtype=np.uint8)

    if mode == "rgb":
        for index, band_index in enumerate(output_source_bands(rules)[:3]):
            output[..., index] = scale_array(values[index], rules, metadata, band_index)
        output[..., 3] = np.where(valid, 255, 0).astype(np.uint8)
        return output

    if mode == "gray":
        gray = scale_array(values[0], rules, metadata, output_source_bands(rules)[0])
        output[..., 0] = gray
        output[..., 1] = gray
        output[..., 2] = gray
        output[..., 3] = np.where(valid, 255, 0).astype(np.uint8)
        return output

    if mode == "unique":
        integer_values = values[0].astype(np.int64)
        for item in rules["uniqueValues"]:
            output[integer_values == int(item["value"])] = hex_to_rgba(str(item["color"]))
        output[..., 3] = np.where(valid, output[..., 3], 0).astype(np.uint8)
        return output

    scaled = scale_array(values[0], rules, metadata, output_source_bands(rules)[0]).astype(np.float32) / 255.0
    palette = palette_array(str(rules.get("palette") or "poplar"))
    stops = np.linspace(0.0, 1.0, len(palette), dtype=np.float32)
    for channel in range(3):
        output[..., channel] = np.interp(scaled, stops, palette[:, channel]).astype(np.uint8)
    output[..., 3] = np.where(valid, 255, 0).astype(np.uint8)
    return output


def scale_array(values: np.ndarray, rules: dict[str, Any], metadata: dict[str, Any], band_index: int) -> np.ndarray:
    if not rules.get("stretch", {}).get("enabled", True):
        return np.clip(values, 0, 255).astype(np.uint8)
    minimum, maximum = stretch_min_max(rules, metadata, band_index)
    scaled = (values - minimum) / (maximum - minimum)
    return np.clip(scaled * 255.0, 0, 255).astype(np.uint8)


def palette_array(name: str) -> np.ndarray:
    colors = PALETTES.get(name, PALETTES["poplar"])
    return np.array([hex_to_rgba(color)[:3] for color in colors], dtype=np.float32)


def hex_to_rgba(value: str) -> tuple[int, int, int, int]:
    text = value.strip().lstrip("#")
    if len(text) == 6:
        text = f"{text}ff"
    if len(text) != 8:
        return 0, 0, 0, 255
    return tuple(int(text[index : index + 2], 16) for index in range(0, 8, 2))  # type: ignore[return-value]


def bounds_from_gdalinfo(metadata: dict[str, Any]) -> list[float]:
    corners = metadata.get("cornerCoordinates") or {}
    points = [corners.get(key) for key in ("upperLeft", "lowerLeft", "lowerRight", "upperRight")]
    points = [point for point in points if isinstance(point, list) and len(point) >= 2]
    if not points:
        return []
    xs = [float(point[0]) for point in points]
    ys = [float(point[1]) for point in points]
    return [min(xs), min(ys), max(xs), max(ys)]


def bounds_4326_from_gdalinfo(metadata: dict[str, Any]) -> list[float]:
    ring = (((metadata.get("wgs84Extent") or {}).get("coordinates") or [[]])[0]) or []
    points = [point for point in ring if isinstance(point, list) and len(point) >= 2]
    if not points:
        return []
    xs = [float(point[0]) for point in points]
    ys = [float(point[1]) for point in points]
    return [min(xs), min(ys), max(xs), max(ys)]


def image_coordinates_from_gdalinfo(metadata: dict[str, Any]) -> list[list[float]]:
    ring = (((metadata.get("wgs84Extent") or {}).get("coordinates") or [[]])[0]) or []
    if len(ring) >= 4:
        upper_left = ring[0]
        lower_left = ring[1]
        lower_right = ring[2]
        upper_right = ring[3]
        return [upper_left, upper_right, lower_right, lower_left]
    bounds = bounds_4326_from_gdalinfo(metadata)
    if not bounds:
        return []
    west, south, east, north = bounds
    return [[west, north], [east, north], [east, south], [west, south]]


def cache_key_for(raster_path: Path, width: int, height: int, rules: dict[str, Any]) -> str:
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


def style_hash_for(raster_path: Path, rules: dict[str, Any]) -> str:
    stat = raster_path.stat()
    payload = {
        "raster_path": str(raster_path.resolve()),
        "raster_mtime": stat.st_mtime_ns,
        "rules": rules,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def cache_file_size(record: RasterCacheRecord) -> int:
    path = raster_cache_path(record.png_relative_path)
    return path.stat().st_size if path.exists() else 0


def tile_bounds_3857(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    tile_count = 2**z
    tile_span = (WEB_MERCATOR_HALF_WORLD * 2) / tile_count
    minx = -WEB_MERCATOR_HALF_WORLD + x * tile_span
    maxx = minx + tile_span
    maxy = WEB_MERCATOR_HALF_WORLD - y * tile_span
    miny = maxy - tile_span
    return minx, miny, maxx, maxy


def intersects_bounds(bounds: tuple[float, float, float, float], dataset_bounds: Any) -> bool:
    minx, miny, maxx, maxy = bounds
    return not (
        maxx <= dataset_bounds.left
        or minx >= dataset_bounds.right
        or maxy <= dataset_bounds.bottom
        or miny >= dataset_bounds.top
    )


def transparent_png() -> bytes:
    output = np.zeros((DEFAULT_TILE_SIZE, DEFAULT_TILE_SIZE, 4), dtype=np.uint8)
    buffer = io.BytesIO()
    Image.fromarray(output, mode="RGBA").save(buffer, format="PNG")
    return buffer.getvalue()


def _create_job(kind: str) -> RasterJob:
    job = RasterJob(id=uuid.uuid4().hex, kind=kind)
    with _LOCK:
        _JOBS[job.id] = job
    return job


def _set_job_running(job_id: str, message: str, percent: int) -> None:
    with _LOCK:
        job = _JOBS[job_id]
        job.status = "running"
        job.append(message, percent)


def _append_job(job_id: str, message: str) -> None:
    cleaned = normalize_progress_text(message)
    percent = parse_progress_percent(cleaned)
    with _LOCK:
        job = _JOBS[job_id]
        job.status = "running"
        job.append(cleaned, percent)


def _finish_job(job_id: str, result: dict[str, Any], status: str) -> None:
    with _LOCK:
        job = _JOBS[job_id]
        job.status = status
        job.progress_percent = 100
        job.result = result
        job.finished_at = time.time()


def _fail_job(job_id: str, error: str) -> None:
    with _LOCK:
        job = _JOBS[job_id]
        job.status = "failed"
        job.error = error
        job.append(error)
        job.finished_at = time.time()


def normalize_progress_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\r", " ").strip())


def parse_progress_percent(text: str) -> int | None:
    matches = re.findall(r"(?<!\d)(\d{1,3})(?:\.\d+)?(?=\D|$)", text)
    for raw in reversed(matches):
        value = int(raw)
        if 0 <= value <= 100:
            return value
    if "done" in text.lower():
        return 100
    return None
