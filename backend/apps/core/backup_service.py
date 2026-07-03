from __future__ import annotations

import hashlib
import json
import sqlite3
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable
from zipfile import ZIP_DEFLATED, ZipFile

from django.conf import settings
from django.db import close_old_connections, connection
from django.http import JsonResponse
from django.utils import timezone

from apps.core.backup_config import (
    BackupConfigError,
    BackupPlanSettings,
    current_backup_settings,
    plan_for,
)
from apps.core.backup_targets import (
    BackupTargetError,
    LocalBackupTarget,
    ObjectStorageBackupTarget,
)
from apps.core.models import BackupRun
from apps.core.storage import app_path, research_path

SQLITE_EXTENSIONS = {".db", ".sqlite", ".sqlite3", ".gpkg"}


class BackupServiceError(RuntimeError):
    pass


@dataclass(frozen=True)
class BackupFileEntry:
    path: Path
    archive_name: str
    size_bytes: int


ProgressCallback = Callable[[str, int | None], None]


def serialize_backup_run(run: BackupRun) -> dict[str, Any]:
    created_by = None
    if run.created_by_id and run.created_by:
        created_by = run.created_by.get_full_name() or run.created_by.get_username()
    return {
        "id": run.id,
        "planType": run.plan_type,
        "targetType": run.target_type,
        "trigger": run.trigger,
        "status": run.status,
        "progressPercent": run.progress_percent,
        "messages": run.messages,
        "result": run.result,
        "error": run.error_message,
        "archiveName": run.archive_name,
        "sizeBytes": run.size_bytes,
        "checksumSha256": run.checksum_sha256,
        "objectKey": run.object_key,
        "localPath": _display_local_path(run.local_path),
        "createdBy": created_by,
        "createdAt": timezone.localtime(run.created_at).isoformat(),
        "startedAt": timezone.localtime(run.started_at).isoformat()
        if run.started_at
        else None,
        "finishedAt": timezone.localtime(run.finished_at).isoformat()
        if run.finished_at
        else None,
    }


def backup_scope_summaries() -> list[dict[str, Any]]:
    return [
        _scope_summary("research", "科研数据", "科研数据根目录"),
        _scope_summary("platform", "平台数据", "业务数据根目录"),
    ]


def start_backup_run(
    *,
    plan_type: str,
    target_type: str | None,
    trigger: str,
    user=None,
    include_logs: bool | None = None,
    run_async: bool = True,
) -> BackupRun:
    if plan_type not in BackupRun.PlanType.values:
        raise BackupServiceError("planType 仅支持 platform 或 research")
    if trigger not in BackupRun.Trigger.values:
        raise BackupServiceError("trigger 不合法")
    plan = plan_for(plan_type)
    selected_target = target_type or plan.target
    if selected_target not in BackupRun.TargetType.values:
        raise BackupServiceError("targetType 仅支持 local 或 object_storage")
    _ensure_target_configured(selected_target)

    archive_name = f"{plan_type}-backup-{timezone.localtime():%Y%m%d%H%M%S}.zip"
    run = BackupRun.objects.create(
        plan_type=plan_type,
        target_type=selected_target,
        trigger=trigger,
        archive_name=archive_name,
        created_by=user if getattr(user, "is_authenticated", False) else None,
        messages=["备份任务已创建"],
    )
    if run_async:
        threading.Thread(
            target=lambda: _run_with_database_connection(
                lambda: execute_backup_run(run.id, include_logs=include_logs)
            ),
            name=f"backup-run-{run.id}",
            daemon=True,
        ).start()
    else:
        execute_backup_run(run.id, include_logs=include_logs)
        run.refresh_from_db()
    return run


def execute_backup_run(run_id: int, *, include_logs: bool | None = None) -> None:
    run = BackupRun.objects.get(pk=run_id)
    plan = plan_for(run.plan_type)
    effective_include_logs = (
        bool(include_logs)
        if include_logs is not None and run.plan_type == BackupRun.PlanType.PLATFORM
        else plan.include_logs
    )
    if run.plan_type == BackupRun.PlanType.RESEARCH:
        effective_include_logs = False

    staging_path: Path | None = None
    try:
        _mark_running(run, "开始准备备份任务", 2)
        staging_path, manifest = _build_backup_archive(
            run.plan_type,
            run.archive_name,
            include_logs=effective_include_logs,
            progress=lambda message, percent=None: _append_run(
                run.id, message, percent
            ),
        )
        checksum = _file_sha256(staging_path)
        size_bytes = staging_path.stat().st_size
        _append_run(run.id, "归档已生成", 82)

        stored = _store_archive(
            run.target_type, staging_path, run.plan_type, run.archive_name
        )
        _append_run(run.id, "备份目标保存完成", 94)

        BackupRun.objects.filter(pk=run.id).update(
            status=BackupRun.Status.SUCCESS,
            progress_percent=100,
            result={
                "manifestVersion": manifest["manifestVersion"],
                "fileCount": manifest["fileCount"],
                "totalSourceBytes": manifest["totalSourceBytes"],
                "archiveSha256": checksum,
            },
            size_bytes=size_bytes,
            checksum_sha256=checksum,
            object_key=stored.object_key,
            local_path=stored.local_path,
            finished_at=timezone.now(),
        )
        cleanup_backup_retention(run.plan_type, run.target_type, plan.retention_count)
    except Exception as exc:
        run.refresh_from_db(fields=["messages"])
        BackupRun.objects.filter(pk=run.id).update(
            status=BackupRun.Status.FAILED,
            error_message=str(exc),
            messages=_append_message(run.messages, str(exc)),
            finished_at=timezone.now(),
        )
    finally:
        if staging_path and staging_path.exists():
            staging_path.unlink()


def cleanup_backup_retention(
    plan_type: str, target_type: str, retention_count: int
) -> None:
    if retention_count < 1:
        return
    old_runs = list(
        BackupRun.objects.filter(
            plan_type=plan_type,
            target_type=target_type,
            status=BackupRun.Status.SUCCESS,
        ).order_by("-finished_at", "-created_at")[retention_count:]
    )
    if not old_runs:
        return
    target = _target_for(target_type)
    for old_run in old_runs:
        try:
            if target_type == BackupRun.TargetType.LOCAL and old_run.local_path:
                path = Path(old_run.local_path)
                if path.is_file():
                    path.unlink()
            elif (
                target_type == BackupRun.TargetType.OBJECT_STORAGE
                and old_run.object_key
            ):
                target.delete(old_run.object_key)
        except Exception:
            continue


def test_backup_target(target_type: str, *, local=None, object_storage=None) -> None:
    if target_type == BackupRun.TargetType.LOCAL:
        from apps.core.backup_config import local_target_from_payload

        LocalBackupTarget(local_target_from_payload(local)).test_connection()
        return
    if target_type == BackupRun.TargetType.OBJECT_STORAGE:
        from apps.core.backup_config import object_storage_from_payload

        ObjectStorageBackupTarget(
            object_storage_from_payload(object_storage)
        ).test_connection()
        return
    raise BackupServiceError("targetType 仅支持 local 或 object_storage")


def due_backup_plans(now=None) -> list[tuple[str, BackupPlanSettings]]:
    current = now or timezone.localtime()
    today = current.date()
    due: list[tuple[str, BackupPlanSettings]] = []
    backup = current_backup_settings()
    for plan_type, plan in backup.plans.items():
        if not plan.enabled:
            continue
        hour, minute = [int(part) for part in plan.daily_at.split(":")]
        if current.time() < current.replace(hour=hour, minute=minute, second=0).time():
            continue
        if BackupRun.objects.filter(
            plan_type=plan_type,
            trigger=BackupRun.Trigger.SCHEDULED,
            created_at__date=today,
        ).exists():
            continue
        if BackupRun.objects.filter(
            plan_type=plan_type,
            status__in=[BackupRun.Status.QUEUED, BackupRun.Status.RUNNING],
        ).exists():
            continue
        due.append((plan_type, plan))
    return due


def start_due_backup_runs() -> list[BackupRun]:
    runs: list[BackupRun] = []
    for plan_type, plan in due_backup_plans():
        runs.append(
            start_backup_run(
                plan_type=plan_type,
                target_type=plan.target,
                trigger=BackupRun.Trigger.SCHEDULED,
                run_async=True,
            )
        )
    return runs


def local_backup_download_path(run_id: int) -> Path | JsonResponse:
    try:
        run = BackupRun.objects.get(pk=run_id)
    except BackupRun.DoesNotExist:
        return JsonResponse({"detail": "备份任务不存在"}, status=404)
    if run.target_type != BackupRun.TargetType.LOCAL:
        return JsonResponse({"detail": "对象存储备份不支持本地下载"}, status=400)
    if run.status != BackupRun.Status.SUCCESS or not run.local_path:
        return JsonResponse({"detail": "备份归档尚不可下载"}, status=400)
    path = Path(run.local_path)
    if not path.is_file():
        return JsonResponse({"detail": "备份归档不存在"}, status=404)
    return path


def _build_backup_archive(
    plan_type: str,
    archive_name: str,
    *,
    include_logs: bool,
    progress: ProgressCallback,
) -> tuple[Path, dict[str, Any]]:
    staging_dir = app_path("backups", "staging")
    staging_dir.mkdir(parents=True, exist_ok=True)
    archive_path = staging_dir / f"{archive_name}.{BackupRun.Status.RUNNING}.tmp"
    sources = _backup_sources(plan_type, include_logs=include_logs)
    total = len(sources)
    file_entries: list[dict[str, Any]] = []
    total_source_bytes = 0

    with ZipFile(
        archive_path, "w", compression=ZIP_DEFLATED, allowZip64=True
    ) as archive:
        for index, source in enumerate(sources, start=1):
            if not source.path.is_file():
                continue
            percent = 5 + int((index / max(total, 1)) * 70)
            progress(f"写入 {source.archive_name}", percent)
            entry = _write_archive_file(archive, source, staging_dir)
            file_entries.append(entry)
            total_source_bytes += int(entry["sizeBytes"])
        manifest = {
            "manifestVersion": 1,
            "planType": plan_type,
            "createdAt": timezone.localtime().isoformat(),
            "systemName": settings.PROJECT_CONFIG.system_name,
            "includeLogs": include_logs,
            "fileCount": len(file_entries),
            "totalSourceBytes": total_source_bytes,
            "files": file_entries,
        }
        archive.writestr(
            "manifest.json",
            json.dumps(manifest, ensure_ascii=False, indent=2),
        )
    return archive_path, manifest


def _backup_sources(plan_type: str, *, include_logs: bool) -> list[BackupFileEntry]:
    if plan_type == BackupRun.PlanType.RESEARCH:
        roots = [
            (research_path("vector"), "research/vector"),
            (research_path("raster"), "research/raster"),
            (research_path("gene"), "research/gene"),
            (research_path("table"), "research/table"),
        ]
        return _collect_files(roots)

    roots = [
        (app_path("database"), "platform/database"),
        (app_path("media"), "platform/media"),
        (app_path("uploads"), "platform/uploads"),
        (app_path("config"), "platform/config"),
    ]
    if include_logs:
        roots.append((app_path("logs"), "platform/logs"))
    sources = _collect_files(roots)
    config_path = settings.PROJECT_CONFIG.config_path
    if config_path.is_file():
        sources.append(
            BackupFileEntry(
                path=config_path,
                archive_name="platform/config/source-app.toml",
                size_bytes=config_path.stat().st_size,
            )
        )
    return sources


def _collect_files(roots: list[tuple[Path, str]]) -> list[BackupFileEntry]:
    entries: list[BackupFileEntry] = []
    for root, prefix in roots:
        if not root.exists():
            continue
        if root.is_file():
            entries.append(
                BackupFileEntry(
                    path=root,
                    archive_name=f"{prefix}/{root.name}",
                    size_bytes=root.stat().st_size,
                )
            )
            continue
        for path in sorted(root.rglob("*")):
            if path.is_symlink() or not path.is_file():
                continue
            relative = path.relative_to(root).as_posix()
            entries.append(
                BackupFileEntry(
                    path=path,
                    archive_name=f"{prefix}/{relative}",
                    size_bytes=path.stat().st_size,
                )
            )
    return entries


def _write_archive_file(
    archive: ZipFile, source: BackupFileEntry, staging_dir: Path
) -> dict[str, Any]:
    snapshot_path: Path | None = None
    try:
        file_path = source.path
        if source.path.suffix.lower() in SQLITE_EXTENSIONS:
            snapshot_path = _sqlite_snapshot(source.path, staging_dir)
            file_path = snapshot_path
        archive.write(file_path, source.archive_name)
        return {
            "path": source.archive_name,
            "sizeBytes": file_path.stat().st_size,
            "sha256": _file_sha256(file_path),
        }
    finally:
        if snapshot_path and snapshot_path.exists():
            snapshot_path.unlink()


def _sqlite_snapshot(path: Path, staging_dir: Path) -> Path:
    snapshot = staging_dir / f"snapshot-{path.stem}-{time.time_ns()}{path.suffix}"
    try:
        with sqlite3.connect(path) as source, sqlite3.connect(snapshot) as target:
            source.backup(target)
    except sqlite3.DatabaseError:
        if snapshot.exists():
            snapshot.unlink()
        return path
    return snapshot


def _store_archive(
    target_type: str, archive_path: Path, plan_type: str, archive_name: str
):
    target = _target_for(target_type)
    return target.store(archive_path, plan_type, archive_name)


def _target_for(target_type: str):
    backup = current_backup_settings()
    if target_type == BackupRun.TargetType.LOCAL:
        return LocalBackupTarget(backup.local)
    if target_type == BackupRun.TargetType.OBJECT_STORAGE:
        return ObjectStorageBackupTarget(backup.object_storage)
    raise BackupServiceError("targetType 仅支持 local 或 object_storage")


def _ensure_target_configured(target_type: str) -> None:
    try:
        _target_for(target_type)
    except (BackupConfigError, BackupTargetError) as exc:
        raise BackupServiceError(str(exc)) from exc


def _mark_running(run: BackupRun, message: str, percent: int) -> None:
    run.status = BackupRun.Status.RUNNING
    run.started_at = timezone.now()
    run.progress_percent = percent
    run.messages = _append_message(run.messages, message)
    run.save(
        update_fields=[
            "status",
            "started_at",
            "progress_percent",
            "messages",
            "updated_at",
        ]
    )


def _append_run(run_id: int, message: str, percent: int | None = None) -> None:
    run = BackupRun.objects.get(pk=run_id)
    run.messages = _append_message(run.messages, message)
    update_fields = ["messages", "updated_at"]
    if percent is not None:
        run.progress_percent = max(run.progress_percent, min(100, percent))
        update_fields.append("progress_percent")
    run.save(update_fields=update_fields)


def _append_message(messages: list[str], message: str) -> list[str]:
    text = str(message).strip()
    if not text:
        return messages
    return [*messages, text][-120:]


def _scope_summary(plan_type: str, label: str, source: str) -> dict[str, Any]:
    try:
        sources = _backup_sources(plan_type, include_logs=False)
    except Exception:
        return {
            "planType": plan_type,
            "label": label,
            "source": source,
            "available": False,
            "fileCount": 0,
            "sizeBytes": 0,
        }
    return {
        "planType": plan_type,
        "label": label,
        "source": source,
        "available": True,
        "fileCount": len(sources),
        "sizeBytes": sum(item.size_bytes for item in sources),
    }


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _display_local_path(value: str) -> str:
    if not value:
        return ""
    path = Path(value)
    try:
        return path.relative_to(app_path("backups", "local")).as_posix()
    except ValueError:
        return str(path)


def _run_with_database_connection(target) -> None:
    close_old_connections()
    try:
        target()
    finally:
        connection.close()
