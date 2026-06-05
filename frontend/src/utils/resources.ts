import type { DataResource, ResourceListItem } from "../types";

export function isDataResource(
  resource: ResourceListItem,
): resource is DataResource {
  return typeof resource.id === "number";
}

export function resourceCategoryName(resource: ResourceListItem) {
  return resourceCategory(resource)?.name;
}

export function resourceCategory(resource: ResourceListItem) {
  return isDataResource(resource) ? resource.category : undefined;
}

export function resourceFormatLabel(resource: ResourceListItem) {
  if (isDataResource(resource)) {
    return resource.fileFormat || resource.dataType;
  }
  return resource.geometryType || resource.dataType;
}

export function resourceProvider(resource: ResourceListItem) {
  return isDataResource(resource) ? resource.provider : "";
}

export function resourceSpatialExtent(resource: ResourceListItem) {
  if (isDataResource(resource)) {
    return resource.spatialExtent;
  }
  return formatBounds(resource.bounds);
}

export function resourceExportId(resource: ResourceListItem) {
  return isDataResource(resource) ? resource.id : null;
}

function formatBounds(bounds: number[]) {
  return bounds.length >= 4 ? bounds.slice(0, 4).join(", ") : "";
}
