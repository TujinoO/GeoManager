from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from apps.raster.services.progress import (
    normalize_progress_text,
    parse_progress_percent,
)


@dataclass
class RasterJob:
    id: str
    kind: str
    status: str = "queued"
    progress_percent: int = 0
    messages: list[str] = field(default_factory=list)
    result: dict[str, Any] | None = None
    error: str = ""
    artifact_path: str = ""
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
_LOCK = threading.RLock()


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


def _set_job_artifact(job_id: str, path: Path) -> None:
    with _LOCK:
        _JOBS[job_id].artifact_path = str(path)


def _fail_job(job_id: str, error: str) -> None:
    with _LOCK:
        job = _JOBS[job_id]
        job.status = "failed"
        job.error = error
        job.append(error)
        job.finished_at = time.time()


def get_job(job_id: str) -> RasterJob:
    from apps.raster.services.exceptions import RasterJobError

    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            raise RasterJobError("任务不存在或已过期")
        return job


def start_import_job(
    source_path: str, name: str = "", cleanup_upload_on_failure: bool = False
) -> RasterJob:
    from apps.raster.services.importer import (
        cleanup_uploaded_import_files,
        import_raster_file,
    )
    from apps.raster.services.serializers import serialize_raster_dataset
    from pathlib import Path

    job = _create_job("import")
    source = Path(source_path)

    def runner() -> None:
        try:
            _set_job_running(job.id, "开始导入栅格文件", 2)
            dataset = import_raster_file(
                source,
                name=name,
                progress=lambda text: _append_job(job.id, text),
            )
            _finish_job(job.id, serialize_raster_dataset(dataset), "ready")
        except Exception as exc:
            if cleanup_upload_on_failure:
                cleanup_uploaded_import_files(source)
            _fail_job(job.id, str(exc))

    threading.Thread(target=runner, name=f"raster-import-{job.id}", daemon=True).start()
    return job


def start_scan_job() -> RasterJob:
    from apps.raster.services.importer import scan_unprocessed_source_files
    from apps.raster.services.serializers import serialize_raster_dataset

    job = _create_job("scan")

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

    threading.Thread(target=runner, name=f"raster-scan-{job.id}", daemon=True).start()
    return job


def start_render_job(
    *,
    layer_id: int | None,
    dataset_id: int | None,
    rules: dict[str, Any] | None,
) -> RasterJob:
    from apps.catalog.models import MapLayer
    from apps.raster.models import RasterDataset
    from apps.raster.services.exceptions import RasterRenderError
    from apps.raster.services.importer import dataset_for_layer
    from apps.raster.services.renderer import register_tile_style

    job = _create_job("render")

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

    threading.Thread(target=runner, name=f"raster-render-{job.id}", daemon=True).start()
    return job


def start_export_job(
    *,
    items: list[dict[str, Any]],
    epsg: int | None,
    reproject: bool,
    clip_geometry: dict[str, Any] | None,
    vector_format: str,
) -> RasterJob:
    from tempfile import NamedTemporaryFile

    from apps.catalog.export import export_layers_zip

    job = _create_job("export")

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
        target=runner, name=f"catalog-export-{job.id}", daemon=True
    ).start()
    return job


def get_job_artifact_path(job_id: str) -> Path:
    from apps.raster.services.exceptions import RasterJobError

    with _LOCK:
        job = _JOBS.get(job_id)
        if not job or not job.artifact_path:
            raise RasterJobError("导出文件不存在或已过期")
        return Path(job.artifact_path)
