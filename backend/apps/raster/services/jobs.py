from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from apps.raster.services.progress import normalize_progress_text, parse_progress_percent


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


def get_job(job_id: str) -> RasterJob:
    from apps.raster.services.exceptions import RasterJobError

    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            raise RasterJobError("任务不存在或已过期")
        return job


def start_import_job(source_path: str, name: str = "") -> RasterJob:
    from apps.raster.services.importer import import_raster_file
    from apps.raster.services.serializers import serialize_raster_dataset
    from pathlib import Path

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
    from apps.raster.services.importer import scan_unprocessed_source_files
    from apps.raster.services.serializers import serialize_raster_dataset

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
    from apps.catalog.models import MapLayer
    from apps.raster.models import RasterDataset
    from apps.raster.services.exceptions import RasterRenderError
    from apps.raster.services.importer import dataset_for_layer
    from apps.raster.services.renderer import register_tile_style, render_dataset_png

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
