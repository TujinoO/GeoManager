import type { ResourceListItem } from "../types";

const geographicResourceTypes = new Set<ResourceListItem["dataType"]>([
  "vector",
  "raster",
]);

export function isGeographicResource(resource: ResourceListItem) {
  return geographicResourceTypes.has(resource.dataType);
}

export function isNonGeographicResource(resource: ResourceListItem) {
  return !isGeographicResource(resource);
}

export function resourceCategoryName(resource: ResourceListItem) {
  return resourceCategory(resource)?.name;
}

export function resourceCategory(resource: ResourceListItem) {
  return resource.category;
}

export function resourceFormatLabel(resource: ResourceListItem) {
  return resource.fileFormat || resource.dataType;
}

export function resourceProvider(resource: ResourceListItem) {
  return resource.provider;
}

export function resourceSpatialExtent(resource: ResourceListItem) {
  return resource.spatialExtent;
}

export function resourceExportId(resource: ResourceListItem) {
  return resource.id;
}

export function analysisResourceUrl(resource: ResourceListItem) {
  const kind = resource.analysisKind;
  const genomic =
    resource.dataType === "gene" ||
    ["sequence", "expression", "function", "variants"].includes(kind ?? "");
  const view = genomic
    ? "genome"
    : kind === "molecular" || resource.domainType === "molecular"
      ? "molecular"
      : kind === "samples" || resource.domainType === "germplasm"
        ? "samples"
        : "ecology";
  const section =
    genomic && resource.dataType !== "gene" ? `&section=${kind}` : "";
  return `/nongeo?view=${view}&resourceId=${resource.id}${section}`;
}
