import type { DataDomainType, RasterImportPreview } from "../types";

export type ImportAccessScopeId = number | "__self__";

export interface ImportFormValues {
  name: string;
  domainType?: DataDomainType;
  categoryCode?: string;
  importMode: "geographic" | "table";
  longitudeColumn?: string;
  latitudeColumn?: string;
  accessGroupIds: ImportAccessScopeId[];
}

export function normalizeImportValues(
  values: Partial<ImportFormValues>,
): Partial<ImportFormValues> {
  const name = values.name?.trim();
  const importMode = values.importMode;
  return {
    name,
    domainType: values.domainType,
    categoryCode: values.categoryCode,
    importMode,
    longitudeColumn: values.longitudeColumn || undefined,
    latitudeColumn: values.latitudeColumn || undefined,
    accessGroupIds: values.accessGroupIds ?? [],
  };
}

export function suggestedRasterCategoryCode(preview: RasterImportPreview) {
  if (preview.rasterKind !== "categorical") return "thematic_landscape_rs";
  const uniqueValues = (
    preview.defaultRules as {
      uniqueValues?: Array<{ label?: unknown }>;
    }
  ).uniqueValues;
  const labels = (uniqueValues ?? [])
    .map((item) => String(item.label ?? ""))
    .join(" ");
  const luccLabelMatches = ["耕地", "林地", "水体", "建筑", "道路"].filter(
    (label) => labels.includes(label),
  ).length;
  return luccLabelMatches >= 3 ? "base_geo_lucc" : "thematic_landscape_rs";
}
