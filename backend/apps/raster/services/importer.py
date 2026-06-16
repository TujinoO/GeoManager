from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path
from typing import Any, Callable

from django.db import OperationalError, ProgrammingError
from django.utils import timezone

from apps.core.storage import (
    raster_metadata_path,
    raster_processed_path,
    raster_source_path,
)
from apps.raster.models import RasterDataset
from apps.raster.services.catalog_sync import upsert_catalog_records
from apps.raster.services.constants import RASTER_EXTENSIONS
from apps.raster.services.exceptions import RasterImportError
from apps.raster.services.gdal_ops import gdalinfo_json, run_gdal_command
from apps.raster.services.geo_utils import (
    bounds_4326_from_gdalinfo,
    bounds_from_gdalinfo,
    image_coordinates_from_gdalinfo,
)
from apps.raster.services.progress import normalize_progress_text
from apps.raster.services.rules_engine import default_raster_rules


def is_raster_file(path: Path) -> bool:
    return (
        path.is_file()
        and not path.name.startswith(".")
        and path.suffix.lower() in RASTER_EXTENSIONS
    )


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


def save_metadata(relative_path: str, metadata: dict[str, Any]) -> None:
    path = raster_metadata_path(relative_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def handle_import_progress(
    dataset: RasterDataset, text: str, progress: Callable[[str], None] | None = None
) -> None:
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
    dataset.progress_log = "\n".join(
        [*(dataset.progress_log.splitlines()[-160:]), cleaned]
    ).strip()
    dataset.save(update_fields=("progress_log", "updated_at"))


def scan_unprocessed_source_files(
    progress: Callable[[str], None] | None = None,
) -> list[RasterDataset]:
    import logging

    logger = logging.getLogger(__name__)
    source_root = raster_source_path("")
    imported: list[RasterDataset] = []
    for source_path in sorted(source_root.rglob("*")):
        if not is_raster_file(source_path):
            continue
        source_relative = source_path.relative_to(source_root).as_posix()
        dataset = RasterDataset.objects.filter(
            source_relative_path=source_relative
        ).first()
        processed_exists = bool(
            dataset
            and dataset.processed_relative_path
            and raster_processed_path(dataset.processed_relative_path).exists()
        )
        if (
            dataset
            and dataset.status == RasterDataset.Status.READY
            and processed_exists
        ):
            continue
        if progress:
            progress(f"发现未处理源文件：{source_relative}")
        try:
            imported.append(import_raster_file(source_path, progress=progress))
        except Exception:
            logger.exception("扫描导入栅格文件失败：%s", source_relative)
            if progress:
                progress(f"导入失败（已跳过）：{source_relative}")
    return imported


def scan_unprocessed_source_files_safely() -> None:
    import logging

    logger = logging.getLogger(__name__)
    try:
        scan_unprocessed_source_files()
    except (OperationalError, ProgrammingError):
        logger.debug("栅格扫描跳过：数据库尚未就绪")
    except Exception:
        logger.exception("栅格扫描失败")


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
    processed_metadata_relative = metadata_relative_path(
        "preprocessed", processed_relative
    )

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
            progress(
                "gdalwarp -t_srs EPSG:3857 -r nearest -co COMPRESS=DEFLATE -of COG"
            )
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
        dataset.save(
            update_fields=("status", "error_message", "progress_log", "updated_at")
        )
        raise


def dataset_for_layer(layer: Any) -> RasterDataset:
    from apps.catalog.models import MapLayer
    from apps.raster.services.exceptions import RasterRenderError

    if layer.layer_type != MapLayer.LayerType.RASTER:
        raise RasterRenderError("该图层不是栅格图层")
    dataset = RasterDataset.objects.filter(
        map_layer=layer, status=RasterDataset.Status.READY
    ).first()
    if dataset:
        return dataset
    if layer.data_resource_id:
        dataset = RasterDataset.objects.filter(
            data_resource=layer.data_resource, status=RasterDataset.Status.READY
        ).first()
        if dataset:
            return dataset
    raise RasterRenderError("该图层没有关联已预处理的栅格数据集")
