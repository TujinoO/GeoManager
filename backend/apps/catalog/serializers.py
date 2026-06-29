from apps.catalog.models import (
    DataCatalog,
    DataResource,
    DictionaryItem,
    MapLayer,
)


def serialize_dictionary(item: DictionaryItem | None) -> dict | None:
    if item is None:
        return None
    return {
        "id": item.id,
        "type": item.dict_type,
        "code": item.code,
        "name": item.name,
    }


def serialize_resource(resource: DataResource) -> dict:
    return {
        "id": resource.id,
        "name": resource.name,
        "code": resource.code,
        "dataType": resource.data_type,
        "domainType": resource.domain_type or None,
        "category": serialize_dictionary(resource.category),
        "source": resource.source,
        "provider": resource.provider,
        "dataDate": resource.data_date.isoformat() if resource.data_date else None,
        "spatialExtent": resource.spatial_extent,
        "coordinateSystem": resource.coordinate_system,
        "fileFormat": resource.file_format,
        "description": resource.description,
        "qualityNote": resource.quality_note,
        "sizeBytes": resource.size_bytes,
        "itemCount": resource.item_count,
        "status": resource.status,
        "isQueryable": bool(
            resource.data_type == DataResource.DataType.VECTOR and resource.storage_path
        ),
        "isRenderable": bool(
            resource.data_type == DataResource.DataType.RASTER and resource.storage_path
        ),
        "updatedAt": resource.updated_at.isoformat(),
    }


def serialize_catalog(catalog: DataCatalog) -> dict:
    return {
        "id": catalog.id,
        "name": catalog.name,
        "code": catalog.code,
        "parentId": catalog.parent_id,
        "description": catalog.description,
        "sortOrder": catalog.sort_order,
        "resources": [
            serialize_resource(resource) for resource in catalog.resources.all()
        ],
    }


def serialize_layer(layer: MapLayer) -> dict:
    return {
        "id": layer.id,
        "name": layer.name,
        "code": layer.code,
        "layerType": layer.layer_type,
        "geometryType": layer.geometry_type,
        "category": serialize_dictionary(layer.category),
        "dataResourceId": layer.data_resource_id,
        "sortOrder": layer.sort_order,
        "defaultVisible": layer.default_visible,
        "defaultOpacity": layer.default_opacity,
        "symbolization": layer.symbolization,
        "bounds": layer.bounds,
        "legend": layer.legend,
        "rasterRules": layer.raster_rules,
        "isActive": layer.is_active,
        "updatedAt": layer.updated_at.isoformat(),
    }
