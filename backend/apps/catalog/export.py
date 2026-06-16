from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any, Callable

from django.core.exceptions import ValidationError

from apps.core.storage import raster_source_path
from apps.raster.models import RasterDataset
from apps.raster.services.gdal_ops import run_gdal_command


class ExportError(Exception):
    pass


ProgressCallback = Callable[[str], None]


def export_layers_zip(
    items: list[dict[str, Any]],
    epsg: int | None,
    *,
    reproject: bool = True,
    clip_geometry: dict[str, Any] | None = None,
    progress: ProgressCallback | None = None,
) -> bytes:
    if not items:
        raise ExportError("缺少导出图层")
    if reproject and (epsg is None or epsg < 1024 or epsg > 999999):
        raise ExportError("EPSG code 不合法")

    with TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        zip_path = root / "layers.zip"
        cutline_path = write_cutline(root, clip_geometry) if clip_geometry else None
        with zipfile.ZipFile(
            zip_path, "w", compression=zipfile.ZIP_DEFLATED
        ) as archive:
            for index, item in enumerate(items, start=1):
                layer_type = item.get("layerType")
                name = safe_filename(str(item.get("name") or f"layer-{index}"))
                prefix = f"{index:02d}-{name}"
                if layer_type == "vector":
                    output = root / f"{prefix}.geojson"
                    export_vector_geojson(
                        item.get("geojson"),
                        epsg if reproject and epsg else 4326,
                        output,
                    )
                    archive.write(output, output.name)
                elif layer_type == "raster":
                    output = root / f"{prefix}.tif"
                    if progress:
                        progress(f"开始导出栅格：{name}")
                    export_raster_tif(
                        int(item.get("datasetId") or 0),
                        epsg if reproject else None,
                        output,
                        clip_cutline=cutline_path,
                        progress=progress,
                    )
                    archive.write(output, output.name)
                else:
                    raise ExportError(f"不支持的图层类型：{layer_type}")
        if progress:
            progress("导出压缩包已生成 100%")
        return zip_path.read_bytes()


def export_vector_geojson(geojson: Any, epsg: int, output: Path) -> None:
    if not isinstance(geojson, dict) or geojson.get("type") != "FeatureCollection":
        raise ExportError("矢量图层缺少有效 GeoJSON")
    features = geojson.get("features") or []
    if not features:
        output.write_text(
            json.dumps(
                {"type": "FeatureCollection", "features": []}, ensure_ascii=False
            ),
            encoding="utf-8",
        )
        return

    try:
        import geopandas as gpd

        gdf = gpd.GeoDataFrame.from_features(features, crs="EPSG:4326")
        if epsg != 4326:
            gdf = gdf.to_crs(epsg=epsg)
        output.write_text(gdf.to_json(drop_id=True), encoding="utf-8")
    except Exception as exc:
        raise ExportError(f"导出矢量 GeoJSON 失败：{exc}") from exc


def export_raster_tif(
    dataset_id: int,
    epsg: int | None,
    output: Path,
    *,
    clip_cutline: Path | None = None,
    progress: ProgressCallback | None = None,
) -> None:
    dataset = RasterDataset.objects.filter(
        pk=dataset_id, status=RasterDataset.Status.READY
    ).first()
    if not dataset or not dataset.source_relative_path:
        raise ExportError("栅格数据集不可导出")
    source = raster_source_path(dataset.source_relative_path)
    if not source.exists():
        raise ExportError("栅格源文件不存在")

    try:
        command = [
            "gdalwarp",
            "-overwrite",
            "-of",
            "GTiff",
            "-r",
            "near",
            "-multi",
            "-wo",
            "NUM_THREADS=ALL_CPUS",
            "-co",
            "COMPRESS=DEFLATE",
        ]
        if epsg:
            command.extend(["-t_srs", f"EPSG:{epsg}"])
        if clip_cutline:
            command.extend(
                ["-cutline", str(clip_cutline), "-crop_to_cutline", "-dstalpha"]
            )
        command.extend([str(source), str(output)])
        run_gdal_command(command, progress=progress)
    except Exception as exc:
        raise ExportError(f"导出栅格 TIF 失败：{exc}") from exc


def write_cutline(root: Path, geometry: dict[str, Any]) -> Path:
    if not isinstance(geometry, dict) or geometry.get("type") not in {
        "Polygon",
        "MultiPolygon",
    }:
        raise ExportError("裁切图形必须是 Polygon 或 MultiPolygon")
    path = root / "export-cutline.geojson"
    path.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "features": [
                    {"type": "Feature", "properties": {}, "geometry": geometry}
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return path


def safe_filename(value: str) -> str:
    cleaned = re.sub(r"[^\w\u4e00-\u9fff.-]+", "-", value, flags=re.UNICODE).strip(".-")
    return cleaned[:80] or "layer"


def validate_epsg(value: Any) -> int:
    try:
        epsg = int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError("EPSG code 必须为数字") from exc
    if epsg < 1024 or epsg > 999999:
        raise ValidationError("EPSG code 不合法")
    return epsg
