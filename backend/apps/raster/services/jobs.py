from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from django.db import OperationalError, close_old_connections, connection
from django.utils import timezone

from apps.raster.services.progress import (
    normalize_progress_text,
    parse_progress_percent,
)


@dataclass
class RasterJob:
    id: str
    kind: str
    status: str = "queued"
    stage: str = "queued"
    progress_percent: int = 0
    messages: list[str] = field(default_factory=list)
    result: dict[str, Any] | None = None
    error: str = ""
    artifact_path: str = ""
    started_at: float = field(default_factory=time.time)
    finished_at: float | None = None
    created_by_id: int | None = None

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
            "stage": self.stage,
            "progressPercent": self.progress_percent,
            "messages": self.messages,
            "result": self.result,
            "error": self.error,
            "startedAt": self.started_at,
            "finishedAt": self.finished_at,
        }


_JOBS: dict[str, RasterJob] = {}
_LOCK = threading.RLock()
_LAST_PERSIST: dict[str, tuple[float, int]] = {}


def _create_job(kind: str, created_by_id: int | None = None) -> RasterJob:
    job = RasterJob(id=uuid.uuid4().hex, kind=kind, created_by_id=created_by_id)
    with _LOCK:
        _JOBS[job.id] = job
    _persist_job(job, force=True)
    return job


def _set_job_running(
    job_id: str, message: str, percent: int, stage: str = "running"
) -> None:
    with _LOCK:
        job = _JOBS[job_id]
        job.status = "running"
        job.stage = stage
        job.append(message, percent)
        _persist_job(job, force=True)


def _append_job(job_id: str, message: str) -> None:
    cleaned = normalize_progress_text(message)
    percent = parse_progress_percent(cleaned)
    with _LOCK:
        job = _JOBS[job_id]
        job.status = "running"
        job.stage = _stage_from_message(cleaned, job.stage)
        job.append(cleaned, percent)
        _persist_job(job)


def _finish_job(job_id: str, result: dict[str, Any], status: str) -> None:
    with _LOCK:
        job = _JOBS[job_id]
        job.status = status
        job.stage = status
        job.progress_percent = 100
        job.result = result
        job.finished_at = time.time()
        _persist_job(job, force=True)


def _set_job_artifact(job_id: str, path: Path) -> None:
    with _LOCK:
        _JOBS[job_id].artifact_path = str(path)
        _persist_job(_JOBS[job_id], force=True)


def _fail_job(job_id: str, error: str) -> None:
    with _LOCK:
        job = _JOBS[job_id]
        job.status = "failed"
        job.stage = "failed"
        job.error = error
        job.append(error)
        job.finished_at = time.time()
        _persist_job(job, force=True)


def get_job(job_id: str) -> RasterJob:
    from apps.raster.services.exceptions import RasterJobError

    with _LOCK:
        cached = _JOBS.get(job_id)
        if cached and cached.status in {"ready", "failed"}:
            return cached
    persisted = _load_persisted_job(job_id)
    if persisted:
        with _LOCK:
            cached = _JOBS.get(job_id)
            if cached and not _persisted_job_is_newer(cached, persisted):
                return cached
            _JOBS[persisted.id] = persisted
        return persisted
    if cached:
        return cached
    raise RasterJobError("任务不存在或已过期")


def _run_with_database_connection(target) -> None:
    close_old_connections()
    try:
        target()
    finally:
        connection.close()


def start_import_job(
    source_path: str,
    name: str = "",
    cleanup_upload_on_failure: bool = False,
    *,
    source_manifest: list[dict[str, Any]] | None = None,
    source_checksum_sha256: str = "",
    raster_kind: str = "imagery",
    resampling: str = "bilinear",
    default_rules: dict[str, Any] | None = None,
    uploader_id: int | None = None,
    access_group_ids: list[int] | None = None,
    category_code: str = "",
    created_by_id: int | None = None,
) -> RasterJob:
    from apps.raster.services.importer import (
        cleanup_uploaded_import_files,
        import_raster_file,
    )
    from apps.raster.services.serializers import serialize_raster_dataset
    from pathlib import Path

    job = _create_job("import", created_by_id=created_by_id)
    source = Path(source_path)

    def runner() -> None:
        try:
            _set_job_running(job.id, "开始导入栅格文件", 2, "validating")
            dataset = import_raster_file(
                source,
                name=name,
                progress=lambda text: _append_job(job.id, text),
                source_manifest=source_manifest,
                source_checksum_sha256=source_checksum_sha256,
                raster_kind=raster_kind,
                resampling=resampling,
                requested_default_rules=default_rules,
                uploader_id=uploader_id,
                access_group_ids=access_group_ids,
                category_code=category_code,
            )
            _finish_job(job.id, serialize_raster_dataset(dataset), "ready")
        except Exception as exc:
            if cleanup_upload_on_failure:
                try:
                    cleanup_uploaded_import_files(source)
                except Exception as cleanup_exc:
                    _append_job(job.id, f"失败文件清理未完成：{cleanup_exc}")
            _fail_job(job.id, str(exc))

    threading.Thread(
        target=lambda: _run_with_database_connection(runner),
        name=f"raster-import-{job.id}",
        daemon=True,
    ).start()
    return job


def start_scan_job(created_by_id: int | None = None) -> RasterJob:
    from apps.raster.services.importer import scan_unprocessed_source_files
    from apps.raster.services.serializers import serialize_raster_dataset

    job = _create_job("scan", created_by_id=created_by_id)

    def runner() -> None:
        try:
            _set_job_running(job.id, "开始扫描栅格源数据目录", 1)
            datasets = scan_unprocessed_source_files(
                progress=lambda text: _append_job(job.id, text)
            )
            _finish_job(
                job.id,
                {
                    "items": [
                        serialize_raster_dataset(dataset) for dataset in datasets
                    ],
                    "count": len(datasets),
                },
                "ready",
            )
        except Exception as exc:
            _fail_job(job.id, str(exc))

    threading.Thread(
        target=lambda: _run_with_database_connection(runner),
        name=f"raster-scan-{job.id}",
        daemon=True,
    ).start()
    return job


def start_render_job(
    *,
    layer_id: int | None,
    dataset_id: int | None,
    rules: dict[str, Any] | None,
    created_by_id: int | None = None,
) -> RasterJob:
    from apps.catalog.models import MapLayer
    from apps.raster.models import RasterDataset
    from apps.raster.services.exceptions import RasterRenderError
    from apps.raster.services.importer import dataset_for_layer
    from apps.raster.services.renderer import register_tile_style

    job = _create_job("render", created_by_id=created_by_id)

    def runner() -> None:
        try:
            _set_job_running(job.id, "准备栅格符号化", 5)
            layer = MapLayer.objects.filter(pk=layer_id).first() if layer_id else None
            dataset = (
                RasterDataset.objects.filter(pk=dataset_id).first()
                if dataset_id
                else None
            )
            if dataset is None and layer is not None:
                dataset = dataset_for_layer(layer)
            if dataset is None:
                raise RasterRenderError("未找到可渲染的栅格数据集")
            render_rules = rules or (
                layer.raster_rules
                if layer and layer.raster_rules
                else dataset.default_rules
            )
            result = register_tile_style(dataset, render_rules)
            _finish_job(job.id, result, "ready")
        except Exception as exc:
            _fail_job(job.id, str(exc))

    threading.Thread(
        target=lambda: _run_with_database_connection(runner),
        name=f"raster-render-{job.id}",
        daemon=True,
    ).start()
    return job


def start_export_job(
    *,
    items: list[dict[str, Any]],
    epsg: int | None,
    reproject: bool,
    clip_geometry: dict[str, Any] | None,
    vector_format: str,
    created_by_id: int | None = None,
) -> RasterJob:
    from tempfile import NamedTemporaryFile

    from apps.catalog.export import export_layers_zip

    job = _create_job("export", created_by_id=created_by_id)

    def runner() -> None:
        try:
            _set_job_running(job.id, "准备导出数据", 1)
            content = export_layers_zip(
                items,
                epsg,
                reproject=reproject,
                clip_geometry=clip_geometry,
                vector_format=vector_format,
                progress=lambda text: _append_job(job.id, text),
            )
            with NamedTemporaryFile(
                prefix=f"layers-export-{job.id}-", suffix=".zip", delete=False
            ) as output:
                output.write(content)
                artifact = Path(output.name)
            _set_job_artifact(job.id, artifact)
            _finish_job(
                job.id,
                {
                    "filename": f"layers-export-{time.strftime('%Y%m%d%H%M%S')}.zip",
                    "downloadUrl": f"/api/catalog/export/jobs/{job.id}/download/",
                },
                "ready",
            )
        except Exception as exc:
            _fail_job(job.id, str(exc))

    threading.Thread(
        target=lambda: _run_with_database_connection(runner),
        name=f"catalog-export-{job.id}",
        daemon=True,
    ).start()
    return job


def get_job_artifact_path(job_id: str) -> Path:
    from apps.raster.services.exceptions import RasterJobError

    job = get_job(job_id)
    if not job.artifact_path:
        raise RasterJobError("导出文件不存在或已过期")
    return Path(job.artifact_path)


def _persist_job(job: RasterJob, *, force: bool = False) -> None:
    from apps.raster.models import RasterProcessingJob

    now = time.time()
    last_time, last_percent = _LAST_PERSIST.get(job.id, (0.0, -1))
    if not force and now - last_time < 2 and job.progress_percent - last_percent < 5:
        return
    attempts = 3 if force else 1
    for attempt in range(attempts):
        try:
            RasterProcessingJob.objects.update_or_create(
                pk=job.id,
                defaults={
                    "kind": job.kind,
                    "status": job.status,
                    "stage": job.stage,
                    "progress_percent": job.progress_percent,
                    "messages": list(job.messages),
                    "result": job.result,
                    "error": job.error,
                    "artifact_path": job.artifact_path,
                    "created_by_id": job.created_by_id,
                    "finished_at": datetime.fromtimestamp(
                        job.finished_at, tz=timezone.get_current_timezone()
                    )
                    if job.finished_at
                    else None,
                },
            )
            _LAST_PERSIST[job.id] = (now, job.progress_percent)
            return
        except OperationalError:
            if attempt + 1 >= attempts:
                # 任务热状态仍保留在内存，数据库短暂繁忙不能中断 GDAL 处理。
                return
            close_old_connections()
            time.sleep(0.05 * (attempt + 1))
        except Exception:
            return


def _load_persisted_job(job_id: str) -> RasterJob | None:
    from apps.raster.models import RasterProcessingJob

    try:
        record = RasterProcessingJob.objects.filter(pk=job_id).first()
    except Exception:
        return None
    if record is None:
        return None
    return RasterJob(
        id=record.id,
        kind=record.kind,
        status=record.status,
        stage=record.stage,
        progress_percent=record.progress_percent,
        messages=list(record.messages or []),
        result=record.result,
        error=record.error,
        artifact_path=record.artifact_path,
        started_at=record.started_at.timestamp(),
        finished_at=record.finished_at.timestamp() if record.finished_at else None,
        created_by_id=record.created_by_id,
    )


def _persisted_job_is_newer(cached: RasterJob, persisted: RasterJob) -> bool:
    status_rank = {"queued": 0, "running": 1, "ready": 2, "failed": 2}
    cached_rank = status_rank.get(cached.status, 0)
    persisted_rank = status_rank.get(persisted.status, 0)
    if persisted_rank != cached_rank:
        return persisted_rank > cached_rank
    if persisted.progress_percent != cached.progress_percent:
        return persisted.progress_percent > cached.progress_percent
    return len(persisted.messages) > len(cached.messages)


def _stage_from_message(message: str, current: str) -> str:
    lowered = message.lower()
    if "gdalinfo" in lowered or "校验" in message:
        return "validating"
    if "gdalwarp" in lowered or "预处理" in message:
        return "preprocessing"
    if "导入完成" in message or "登记" in message:
        return "publishing"
    return current or "running"
