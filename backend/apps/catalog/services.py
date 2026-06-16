from __future__ import annotations

import hashlib
import sqlite3
from typing import Any

import geopandas as gpd
from django.db import OperationalError, ProgrammingError

from apps.catalog.models import DataResource
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


def get_vector_layers_from_geopackage() -> list[dict[str, Any]]:
    path = vector_geopackage_path()
    if not path.exists():
        return []

    layers_info: list[dict[str, Any]] = []
    for layer_name in _vector_layer_names(path):
        try:
            profile = _vector_layer_profile(layer_name)
            field_metadata = _read_field_metadata(path, layer_name)
            layers_info.append(
                {
                    "name": layer_name,
                    "layerName": layer_name,
                    "geometryType": profile["geometry_type"],
                    "bounds": profile["bounds"],
                    "coordinateSystem": profile["coordinate_system"],
                    "featureCount": profile["feature_count"],
                    "fieldMetadata": field_metadata,
                }
            )
        except Exception:
            continue
    return layers_info


def get_vector_layer_info(layer_name: str) -> dict[str, Any] | None:
    path = vector_geopackage_path()
    if not path.exists():
        return None

    existing_layers = _vector_layer_names(path)
    if layer_name not in existing_layers:
        return None

    try:
        profile = _vector_layer_profile(layer_name)
        field_metadata = _read_field_metadata(path, layer_name)
        return {
            "name": layer_name,
            "layerName": layer_name,
            "geometryType": profile["geometry_type"],
            "bounds": profile["bounds"],
            "coordinateSystem": profile["coordinate_system"],
            "featureCount": profile["feature_count"],
            "fieldMetadata": field_metadata,
        }
    except Exception:
        return None


def scan_vector_geopackage() -> list[dict[str, Any]]:
    return get_vector_layers_from_geopackage()


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


def scan_catalog_sources() -> tuple[list[dict[str, Any]], list[DataResource]]:
    vector_layers = scan_vector_geopackage()
    nongeographic_resources = scan_nongeographic_files()
    return vector_layers, nongeographic_resources


def scan_catalog_sources_safely() -> tuple[list[dict[str, Any]], list[DataResource]]:
    import logging

    logger = logging.getLogger(__name__)
    try:
        return scan_catalog_sources()
    except (OperationalError, ProgrammingError):
        logger.debug("数据目录扫描跳过：数据库尚未就绪")
    except Exception:
        logger.exception("数据目录扫描失败")
    return [], []


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
            "size_bytes": path.stat().st_size,
            "item_count": 0,
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
        "feature_count": len(gdf),
    }


def _map_geometry_type(gdf) -> str:
    if len(gdf) == 0:
        return "mixed"
    values = set(gdf.geometry.geom_type.dropna().astype(str).tolist())
    if values and values <= {"Point", "MultiPoint"}:
        return "point"
    if values and values <= {"LineString", "MultiLineString"}:
        return "line"
    if values and values <= {"Polygon", "MultiPolygon"}:
        return "polygon"
    return "mixed"


def _read_field_metadata(path, table_name: str) -> dict[str, str]:
    metadata: dict[str, str] = {}
    try:
        with sqlite3.connect(path) as connection:
            cursor = connection.execute(
                "SELECT column_name, description FROM gpkg_data_columns WHERE table_name = ?",
                (table_name,),
            )
            for column_name, description in cursor.fetchall():
                if description:
                    metadata[column_name] = description
    except Exception:
        pass
    return metadata
