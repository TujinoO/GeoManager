from __future__ import annotations

import hashlib
from typing import Any

import geopandas as gpd
from django.db import OperationalError, ProgrammingError

from apps.catalog.models import DataResource, MapLayer
from apps.core.storage import gene_data_path, table_data_path, vector_geopackage_path


GENE_FILE_EXTENSIONS = {
    ".fa",
    ".fasta",
    ".fq",
    ".fastq",
    ".vcf",
    ".gff",
    ".gff3",
    ".gb",
    ".gbk",
}
TABLE_FILE_EXTENSIONS = {".csv", ".tsv", ".xls", ".xlsx"}


def stable_catalog_code(prefix: str, value: str) -> str:
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}-{digest}"


def scan_vector_geopackage() -> list[DataResource]:
    path = vector_geopackage_path()
    if not path.exists():
        return []

    resources: list[DataResource] = []
    for layer_name in _vector_layer_names(path):
        resource = upsert_vector_catalog_records(layer_name)
        resources.append(resource)
    return resources


def scan_vector_geopackage_safely() -> None:
    import logging

    logger = logging.getLogger(__name__)
    try:
        scan_vector_geopackage()
    except (OperationalError, ProgrammingError):
        logger.debug("矢量目录扫描跳过：数据库尚未就绪")
    except Exception:
        logger.exception("矢量目录扫描失败")


def scan_nongeographic_files() -> list[DataResource]:
    resources: list[DataResource] = []
    resources.extend(
        _scan_nongeographic_kind(
            DataResource.DataType.GENE, gene_data_path(), GENE_FILE_EXTENSIONS
        )
    )
    resources.extend(
        _scan_nongeographic_kind(
            DataResource.DataType.TABLE, table_data_path(), TABLE_FILE_EXTENSIONS
        )
    )
    return resources


def scan_catalog_sources() -> list[DataResource]:
    return [*scan_vector_geopackage(), *scan_nongeographic_files()]


def scan_catalog_sources_safely() -> None:
    import logging

    logger = logging.getLogger(__name__)
    try:
        scan_catalog_sources()
    except (OperationalError, ProgrammingError):
        logger.debug("数据目录扫描跳过：数据库尚未就绪")
    except Exception:
        logger.exception("数据目录扫描失败")


def upsert_vector_catalog_records(layer_name: str) -> DataResource:
    profile = _vector_layer_profile(layer_name)
    code = stable_catalog_code("vector", layer_name)
    spatial_extent = (
        ",".join(f"{value:.6f}" for value in profile["bounds"])
        if profile["bounds"]
        else ""
    )
    data_resource, _ = DataResource.objects.update_or_create(
        code=code,
        defaults={
            "name": layer_name,
            "data_type": DataResource.DataType.VECTOR,
            "source": "矢量数据目录扫描",
            "provider": "",
            "spatial_extent": spatial_extent,
            "coordinate_system": profile["coordinate_system"],
            "file_format": "GPKG",
            "storage_path": layer_name,
            "description": f"自动扫描 GeoPackage 图层：{layer_name}",
            "quality_note": "",
            "status": DataResource.Status.ACTIVE,
        },
    )
    MapLayer.objects.update_or_create(
        code=code,
        defaults={
            "name": layer_name,
            "layer_type": MapLayer.LayerType.VECTOR,
            "geometry_type": profile["geometry_type"],
            "data_resource": data_resource,
            "source_path": layer_name,
            "default_visible": True,
            "default_opacity": 85,
            "bounds": profile["bounds"],
            "legend": "",
            "is_active": True,
        },
    )
    return data_resource


def upsert_nongeographic_catalog_record(
    data_type: DataResource.DataType, path
) -> DataResource:
    relative_path = path.relative_to(gene_data_path().parent).as_posix()
    code = stable_catalog_code(data_type.value, relative_path)
    data_type_label = (
        "基因数据" if data_type == DataResource.DataType.GENE else "表格数据"
    )
    resource, _ = DataResource.objects.update_or_create(
        code=code,
        defaults={
            "name": path.stem,
            "data_type": data_type,
            "source": "非地理数据目录扫描",
            "provider": "",
            "spatial_extent": "",
            "coordinate_system": "",
            "file_format": path.suffix.lstrip(".").upper(),
            "storage_path": relative_path,
            "description": f"自动扫描非地理{data_type_label}文件：{relative_path}",
            "quality_note": "",
            "status": DataResource.Status.ACTIVE,
        },
    )
    return resource


def _vector_layer_names(path) -> list[str]:
    layers = gpd.list_layers(path)
    if hasattr(layers, "columns") and "name" in layers.columns:
        return [str(name) for name in layers["name"].dropna().tolist()]
    return [
        str(item[0] if isinstance(item, (list, tuple)) else item) for item in layers
    ]


def _scan_nongeographic_kind(
    data_type: DataResource.DataType, root, extensions: set[str]
) -> list[DataResource]:
    if not root.exists():
        return []
    resources: list[DataResource] = []
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        if path.suffix.lower() not in extensions:
            continue
        resources.append(upsert_nongeographic_catalog_record(data_type, path))
    return resources


def _vector_layer_profile(layer_name: str) -> dict[str, Any]:
    path = vector_geopackage_path()
    gdf = gpd.read_file(path, layer=layer_name)
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)
    bounds = (
        [round(float(value), 6) for value in gdf.total_bounds.tolist()]
        if len(gdf)
        else []
    )
    return {
        "bounds": bounds,
        "coordinate_system": f"EPSG:{gdf.crs.to_epsg()}"
        if gdf.crs and gdf.crs.to_epsg()
        else str(gdf.crs or ""),
        "geometry_type": _map_geometry_type(gdf),
    }


def _map_geometry_type(gdf) -> str:
    if len(gdf) == 0:
        return MapLayer.GeometryType.MIXED
    values = set(gdf.geometry.geom_type.dropna().astype(str).tolist())
    if values and values <= {"Point", "MultiPoint"}:
        return MapLayer.GeometryType.POINT
    if values and values <= {"LineString", "MultiLineString"}:
        return MapLayer.GeometryType.LINE
    if values and values <= {"Polygon", "MultiPolygon"}:
        return MapLayer.GeometryType.POLYGON
    return MapLayer.GeometryType.MIXED
