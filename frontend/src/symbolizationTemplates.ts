import {
  cloneDefaultVectorSymbolization,
  defaultGraduatedClass,
  defaultUniqueValueClass,
  type GraduatedClassificationMethod,
  type GraduatedColorRamp,
  type GraduatedRenderer,
  type GraduatedSymbolClass,
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

export const graduatedColorRamps = {
  green: {
    label: "生态绿",
    colors: ["#E4F6D6", "#B8E186", "#7FBC61", "#2F7D62", "#145A46"],
  },
  blue: {
    label: "水文蓝",
    colors: ["#D8EEF8", "#9BD3E6", "#55A9CF", "#2878B5", "#174D7C"],
  },
  orange: {
    label: "盐分橙",
    colors: ["#FFF2C6", "#F6D66F", "#D9912B", "#C95E2F", "#8F3521"],
  },
  purple: {
    label: "变化紫",
    colors: ["#ECE5F8", "#C7B8EA", "#9884D9", "#6F5BD9", "#44339A"],
  },
} as const satisfies Record<
  GraduatedColorRamp,
  { label: string; colors: readonly string[] }
>;

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

export function buildGraduatedRenderer(
  field: string,
  values: number[],
  {
    method = "equalInterval",
    classCount = 5,
    colorRamp = "green",
    iconImage = "gm-marker",
    precision = 2,
  }: {
    method?: GraduatedClassificationMethod;
    classCount?: number;
    colorRamp?: GraduatedColorRamp;
    iconImage?: string;
    precision?: number;
  } = {},
): GraduatedRenderer {
  const cleanValues = values
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const safeClassCount = clampInteger(classCount, 3, 9);
  const safePrecision = clampInteger(precision, 0, 6);
  const breaks =
    method === "quantile"
      ? quantileBreaks(cleanValues, safeClassCount)
      : equalIntervalBreaks(cleanValues, safeClassCount);
  const colors = graduatedColorRamps[colorRamp].colors;
  const classes = breaks.map(([min, max], index) => {
    const color =
      colors[Math.min(index, colors.length - 1)] ?? "#2F7D62";
    return {
      id: `range-${index + 1}`,
      label: formatRangeLabel(min, max, safePrecision, index === 0),
      min,
      max,
      color,
      iconImage,
      size: 0.88 + index * 0.08,
      count: countNumericValues(cleanValues, min, max, index === breaks.length - 1),
      visible: true,
    } satisfies GraduatedSymbolClass;
  });
  return {
    type: "graduated",
    field,
    method,
    classCount: safeClassCount,
    precision: safePrecision,
    colorRamp,
    updatedByUser: true,
    classes,
    defaultClass: {
      ...defaultGraduatedClass,
      iconImage,
      count: 0,
    },
  };
}

export function rebuildGraduatedRenderer(
  renderer: GraduatedRenderer,
  values: number[],
  patch: Partial<
    Pick<
      GraduatedRenderer,
      "field" | "method" | "classCount" | "colorRamp" | "precision"
    >
  > = {},
): GraduatedRenderer {
  const next = {
    ...renderer,
    ...patch,
  };
  const rebuilt = buildGraduatedRenderer(next.field, values, {
    method: next.method,
    classCount: next.classCount,
    colorRamp: next.colorRamp,
    iconImage:
      next.classes[0]?.iconImage ||
      next.defaultClass.iconImage ||
      defaultGraduatedClass.iconImage,
    precision: next.precision,
  });
  return {
    ...rebuilt,
    updatedByUser: true,
    defaultClass: {
      ...rebuilt.defaultClass,
      label: next.defaultClass.label,
      color: next.defaultClass.color,
      iconImage: next.defaultClass.iconImage,
      size: next.defaultClass.size,
      visible: next.defaultClass.visible,
    },
  };
}

export function refreshGraduatedCounts(
  renderer: GraduatedRenderer,
  values: number[],
  nonNumericCount = 0,
): GraduatedRenderer {
  const cleanValues = values
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  return {
    ...renderer,
    classes: renderer.classes.map((item, index) => ({
      ...item,
      count:
        item.min === null || item.max === null
          ? 0
          : countNumericValues(
              cleanValues,
              item.min,
              item.max,
              index === renderer.classes.length - 1,
            ),
    })),
    defaultClass: {
      ...renderer.defaultClass,
      count: nonNumericCount,
    },
  };
}

export function numericValuesFromCounts(counts: Map<string, number>) {
  const values: number[] = [];
  let nonNumericCount = 0;
  for (const [rawValue, count] of counts.entries()) {
    const numericValue = parseNumericValue(rawValue);
    if (numericValue === null) {
      nonNumericCount += count;
      continue;
    }
    for (let index = 0; index < count; index += 1) {
      values.push(numericValue);
    }
  }
  return { values, nonNumericCount };
}

export function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.replace(/,/g, "");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const numberValue = Number(match[0]);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function graduatedRangeLabel(item: GraduatedSymbolClass) {
  if (item.min === null || item.max === null) return "无数值/空值";
  return item.label || formatRangeLabel(item.min, item.max, 2, false);
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

function equalIntervalBreaks(values: number[], classCount: number) {
  if (values.length === 0) return [];
  const min = values[0] ?? 0;
  const max = values[values.length - 1] ?? min;
  if (min === max) return [[min, max]] as Array<[number, number]>;
  const step = (max - min) / classCount;
  return Array.from({ length: classCount }, (_, index) => {
    const start = index === 0 ? min : min + step * index;
    const end = index === classCount - 1 ? max : min + step * (index + 1);
    return [start, end] as [number, number];
  });
}

function quantileBreaks(values: number[], classCount: number) {
  if (values.length === 0) return [];
  const breaks: Array<[number, number]> = [];
  let previous = values[0] ?? 0;
  for (let index = 1; index <= classCount; index += 1) {
    const position = Math.ceil((values.length * index) / classCount) - 1;
    const end = values[Math.max(0, Math.min(position, values.length - 1))] ?? previous;
    if (index === classCount || end > previous || breaks.length === 0) {
      breaks.push([previous, end]);
      previous = end;
    }
  }
  return breaks.filter(([min, max], index) => index === 0 || max > min);
}

function countNumericValues(
  values: number[],
  min: number,
  max: number,
  includeMax: boolean,
) {
  return values.filter((value) =>
    includeMax ? value >= min && value <= max : value >= min && value < max,
  ).length;
}

function formatRangeLabel(
  min: number,
  max: number,
  precision: number,
  includeLowerHint: boolean,
) {
  const left = formatNumber(min, precision);
  const right = formatNumber(max, precision);
  if (min === max) return left;
  return includeLowerHint ? `${left} - ${right}` : `${left} - ${right}`;
}

function formatNumber(value: number, precision: number) {
  const fixed = value.toFixed(precision);
  return fixed.replace(/\.?0+$/u, "");
}

function clampInteger(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
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
