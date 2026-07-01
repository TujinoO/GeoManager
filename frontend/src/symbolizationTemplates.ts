import {
  cloneDefaultVectorSymbolization,
  defaultUniqueValueClass,
  isUniqueValueRenderer,
  type UniqueValueRenderer,
  type UniqueValueSymbolClass,
  type VectorSymbolization,
} from "./symbolization";
import type {
  GeoJsonFeatureCollection,
  ResourceField,
  ResourceListItem,
} from "./types";

type FeatureLike = GeoJsonFeatureCollection["features"][number];

const uniquePalette = [
  "#D65A8A",
  "#2878B5",
  "#2F7D62",
  "#D9912B",
  "#6F5BD9",
  "#C95E2F",
  "#2A9D8F",
  "#8A8F98",
];

export const germplasmDnaSexTemplateId = "germplasm.dna-sex-tree.v1";

export function vectorSymbolizationWithDefaultTemplate({
  resource,
  fields,
  geojson,
  base,
}: {
  resource: ResourceListItem;
  fields: ResourceField[];
  geojson: GeoJsonFeatureCollection;
  base?: VectorSymbolization;
}): VectorSymbolization {
  const next = base ? { ...base } : cloneDefaultVectorSymbolization();
  if (next.renderer?.updatedByUser) return next;
  const sexField = findSexField(fields);
  if (!sexField || !isGermplasmResource(resource, fields)) return next;
  const counts = countFeatureValues(geojson.features, sexField.name);
  return {
    ...next,
    pointMode: "symbol",
    renderer: germplasmDnaSexRenderer(sexField.name, counts),
    symbol: {
      ...next.symbol,
      iconImage: "gm-tree",
      iconColor: "#2F7D62",
      iconSize: 1.08,
      textField: "",
      textSize: 12,
    },
    circle: {
      ...next.circle,
      circleColor: "#2F7D62",
      circleRadius: 7,
    },
  };
}

export function germplasmDnaSexRenderer(
  field: string,
  counts: Map<string, number>,
): UniqueValueRenderer {
  const femaleValues = ["雌株", "雌株珠"];
  const maleValues = ["雄株"];
  const assigned = new Set([...femaleValues, ...maleValues]);
  return {
    type: "uniqueValue",
    field,
    templateId: germplasmDnaSexTemplateId,
    businessType: "germplasm",
    updatedByUser: false,
    classes: [
      {
        id: "female",
        label: "雌性",
        values: femaleValues,
        color: "#D65A8A",
        iconImage: "gm-tree",
        size: 1.08,
        count: countValues(counts, femaleValues),
        visible: true,
      },
      {
        id: "male",
        label: "雄性",
        values: maleValues,
        color: "#2878B5",
        iconImage: "gm-tree",
        size: 1.08,
        count: countValues(counts, maleValues),
        visible: true,
      },
    ],
    defaultClass: {
      ...defaultUniqueValueClass,
      id: "other",
      label: "未知/其他",
      iconImage: "gm-tree",
      color: "#8A8F98",
      size: 0.96,
      count: countOtherValues(counts, assigned),
      visible: true,
    },
    normalizationNotes: counts.has("雌株珠")
      ? ["字段值“雌株珠”疑似“雌株”的录入别名，默认并入雌性类别。"]
      : [],
  };
}

export function buildUniqueValueRenderer(
  field: string,
  counts: Map<string, number>,
  iconImage = "gm-tree",
): UniqueValueRenderer {
  const entries = [...counts.entries()]
    .filter(([value]) => value.length > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 24);
  const classes = entries.map(([value, count], index) => ({
    id: stableClassId(value, index),
    label: value,
    values: [value],
    color: uniquePalette[index % uniquePalette.length] ?? "#2F7D62",
    iconImage,
    size: 1,
    count,
    visible: true,
  }));
  const assigned = new Set(entries.map(([value]) => value));
  return {
    type: "uniqueValue",
    field,
    updatedByUser: true,
    classes,
    defaultClass: {
      ...defaultUniqueValueClass,
      iconImage,
      count: countOtherValues(counts, assigned),
    },
    normalizationNotes: [],
  };
}

export function refreshUniqueValueCounts(
  renderer: UniqueValueRenderer,
  counts: Map<string, number>,
): UniqueValueRenderer {
  const assigned = new Set<string>();
  const classes = renderer.classes.map((item) => {
    item.values.forEach((value) => assigned.add(value));
    return {
      ...item,
      count: countValues(counts, item.values),
    };
  });
  return {
    ...renderer,
    classes,
    defaultClass: {
      ...renderer.defaultClass,
      count: countOtherValues(counts, assigned),
    },
  };
}

export function countFeatureValues(
  features: FeatureLike[],
  field: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const feature of features) {
    const properties = feature.properties ?? {};
    const raw = (properties as Record<string, unknown>)[field];
    const key = valueLabel(raw);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function fieldValueOptions(
  counts: Map<string, number>,
): Array<{ value: string; label: string }> {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([value, count]) => ({
      value,
      label: `${value}（${count}）`,
    }));
}

export function classValuesLabel(item: UniqueValueSymbolClass) {
  return item.values.length > 0 ? item.values.join("、") : "其他值/空值";
}

export function isGermplasmTemplateRenderer(
  symbolization: VectorSymbolization,
) {
  return (
    isUniqueValueRenderer(symbolization.renderer) &&
    symbolization.renderer.templateId === germplasmDnaSexTemplateId
  );
}

function findSexField(fields: ResourceField[]) {
  return fields.find((field) =>
    ["性别", "雌雄", "雌/雄"].some((name) => field.name.includes(name)),
  );
}

function isGermplasmResource(
  resource: ResourceListItem,
  fields: ResourceField[],
) {
  if (resource.domainType === "germplasm") return true;
  const fieldNames = new Set(fields.map((field) => field.name));
  return (
    fieldNames.has("DNA样本编号") &&
    [...fieldNames].some((name) => name.includes("性别"))
  );
}

function countValues(counts: Map<string, number>, values: string[]) {
  return values.reduce((total, value) => total + (counts.get(value) ?? 0), 0);
}

function countOtherValues(counts: Map<string, number>, assigned: Set<string>) {
  let total = 0;
  for (const [value, count] of counts.entries()) {
    if (!assigned.has(value)) total += count;
  }
  return total;
}

function valueLabel(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function stableClassId(value: string, index: number) {
  const ascii = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return ascii || `class-${index + 1}`;
}
