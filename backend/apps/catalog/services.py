from __future__ import annotations

import hashlib
import logging

from django.db import OperationalError, ProgrammingError

from apps.catalog.models import DataResource, MapLayer
from apps.catalog.vector_store import geometry_type
from apps.core.initialization import ensure_superadmin_defaults
from apps.core.storage import gene_data_path, table_data_path, vector_geopackage_path


logger = logging.getLogger(__name__)
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


def scan_vector_geopackage_layers() -> list[DataResource]:
    path = vector_geopackage_path()
    if not path.exists():
        return []
    try:
        import geopandas as gpd

        layers = gpd.list_layers(path)
        if not hasattr(layers, "columns") or "name" not in layers.columns:
            return []
        layer_names = sorted(layers["name"].astype(str).tolist())
    except Exception:
        logger.exception("读取统一 GeoPackage 图层列表失败：%s", path)
        return []

    resources: list[DataResource] = []
    for layer_name in layer_names:
        try:
            resources.append(upsert_vector_catalog_record(path, layer_name))
        except Exception:
            logger.exception("扫描登记 GeoPackage 图层失败：%s", layer_name)
    return resources


def scan_catalog_sources() -> list[DataResource]:
    resources: list[DataResource] = []
    resources.extend(scan_vector_geopackage_layers())
    resources.extend(scan_nongeographic_files())
    return resources


def scan_catalog_sources_safely() -> list[DataResource]:
    try:
        return scan_catalog_sources()
    except (OperationalError, ProgrammingError):
        logger.debug("数据目录扫描跳过：数据库尚未就绪")
    except Exception:
        logger.exception("数据目录扫描失败")
    return []


def upsert_vector_catalog_record(path, layer_name: str) -> DataResource:
    import geopandas as gpd

    gdf = gpd.read_file(path, layer=layer_name)
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)
    bounds = (
        [round(float(value), 6) for value in gdf.total_bounds.tolist()]
        if len(gdf)
        else []
    )
    spatial_extent = ",".join(f"{value:.6f}" for value in bounds) if bounds else ""
    coordinate_system = f"EPSG:{gdf.crs.to_epsg()}" if gdf.crs else ""
    code = stable_catalog_code("vector", layer_name)
    resource, _ = DataResource.objects.update_or_create(
        code=code,
        defaults={
            "name": layer_name,
            "data_type": DataResource.DataType.VECTOR,
            "source": "矢量数据目录扫描",
            "provider": "",
            "spatial_extent": spatial_extent,
            "coordinate_system": coordinate_system,
            "file_format": "GPKG",
            "storage_path": layer_name,
            "description": f"自动扫描统一 GeoPackage 图层：{layer_name}",
            "quality_note": "",
            "size_bytes": path.stat().st_size,
            "item_count": len(gdf),
            "status": DataResource.Status.ACTIVE,
        },
    )
    map_layer, _ = MapLayer.objects.update_or_create(
        code=code,
        defaults={
            "name": layer_name,
            "layer_type": MapLayer.LayerType.VECTOR,
            "geometry_type": _map_geometry_type(geometry_type(gdf)),
            "data_resource": resource,
            "source_path": layer_name,
            "default_visible": False,
            "default_opacity": 85,
            "bounds": bounds,
            "legend": "",
            "is_active": True,
        },
    )
    _, superadmin_group = ensure_superadmin_defaults(
        create_account=False, attach_existing_superusers=False
    )
    resource.access_groups.set([superadmin_group])
    map_layer.access_groups.set([superadmin_group])
    return resource


def _map_geometry_type(value: str) -> str:
    normalized = value.lower()
    if "point" in normalized:
        return MapLayer.GeometryType.POINT
    if "line" in normalized:
        return MapLayer.GeometryType.LINE
    if "polygon" in normalized:
        return MapLayer.GeometryType.POLYGON
    return MapLayer.GeometryType.MIXED


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
    _, superadmin_group = ensure_superadmin_defaults(
        create_account=False, attach_existing_superusers=False
    )
    resource.access_groups.set([superadmin_group])
    return resource


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
