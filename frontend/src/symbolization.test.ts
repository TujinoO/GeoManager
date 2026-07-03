import { describe, expect, it } from "vitest";
import { platformSymbolImageId } from "./map/symbolImages";
import {
  buildGraduatedRenderer,
  germplasmDnaSexRenderer,
  numericValuesFromCounts,
  parseNumericValue,
  refreshGraduatedCounts,
} from "./symbolizationTemplates";
import {
  cloneDefaultGroupSymbolization,
  cloneDefaultRasterSymbolization,
  cloneDefaultVectorSymbolization,
  defaultGroupSymbolization,
  defaultRasterSymbolization,
  defaultVectorSymbolization,
  normalizeSymbolIconImage,
  platformSymbolIconGroups,
  platformSymbolIconIds,
  rasterSymbolizationFromRules,
  isGraduatedRenderer,
  isUniqueValueRenderer,
} from "./symbolization";

describe("defaultGroupSymbolization", () => {
  it("has opacity 100", () => {
    expect(defaultGroupSymbolization.opacity).toBe(100);
  });
});

describe("defaultVectorSymbolization", () => {
  it("has opacity 90", () => {
    expect(defaultVectorSymbolization.opacity).toBe(90);
  });

  it("uses circle as default point mode", () => {
    expect(defaultVectorSymbolization.pointMode).toBe("circle");
  });

  it("disables point clustering by default", () => {
    expect(defaultVectorSymbolization.cluster).toEqual({
      enabled: false,
      maxZoom: 12,
      radius: 50,
    });
  });

  it("has circle properties", () => {
    expect(defaultVectorSymbolization.circle.circleColor).toBeDefined();
    expect(defaultVectorSymbolization.circle.circleRadius).toBeGreaterThan(0);
  });

  it("has line properties", () => {
    expect(defaultVectorSymbolization.line.lineColor).toBeDefined();
    expect(defaultVectorSymbolization.line.lineWidth).toBeGreaterThan(0);
  });

  it("has fill properties", () => {
    expect(defaultVectorSymbolization.fill.fillColor).toBeDefined();
    expect(defaultVectorSymbolization.fill.fillOpacity).toBeGreaterThanOrEqual(
      0,
    );
    expect(defaultVectorSymbolization.fill.fillOpacity).toBeLessThanOrEqual(1);
  });
});

describe("normalizeSymbolIconImage", () => {
  it("keeps platform icon ids unchanged", () => {
    expect(normalizeSymbolIconImage("gm-marker")).toBe("gm-marker");
  });

  it("uses single symbol renderer by default", () => {
    expect(defaultVectorSymbolization.renderer).toEqual({
      type: "single",
      updatedByUser: false,
    });
  });

  it("keeps expanded platform icon ids unchanged", () => {
    expect(normalizeSymbolIconImage("gm-dna")).toBe("gm-dna");
    expect(normalizeSymbolIconImage("gm-groundwater")).toBe("gm-groundwater");
    expect(normalizeSymbolIconImage("gm-core-germplasm")).toBe(
      "gm-core-germplasm",
    );
  });

  it("maps legacy sprite names to platform icon ids", () => {
    expect(normalizeSymbolIconImage("triangle-15")).toBe("gm-alert");
    expect(normalizeSymbolIconImage("star-15")).toBe("gm-priority");
  });
});

describe("platformSymbolIconGroups", () => {
  it("offers every platform icon exactly once", () => {
    const groupedIconIds = platformSymbolIconGroups.flatMap((group) =>
      group.options.map((option) => option.value),
    );
    expect(new Set(groupedIconIds)).toEqual(new Set(platformSymbolIconIds));
    expect(groupedIconIds).toHaveLength(platformSymbolIconIds.length);
  });

  it("keeps the simplified library at the planned scale", () => {
    expect(platformSymbolIconIds.length).toBeGreaterThanOrEqual(30);
  });
});

describe("platformSymbolImageId", () => {
  it("builds color-specific image ids for platform icons", () => {
    expect(platformSymbolImageId("gm-water", "#2F7D62")).toBe(
      "gm-water--2f7d62",
    );
  });

  it("builds color-specific image ids for expanded platform icons", () => {
    expect(platformSymbolImageId("gm-dna", "#2F7D62")).toBe(
      "gm-dna--2f7d62",
    );
  });

  it("keeps non-platform icon ids unchanged", () => {
    expect(platformSymbolImageId("custom-sprite", "#2f7d62")).toBe(
      "custom-sprite",
    );
  });
});

describe("defaultRasterSymbolization", () => {
  it("has opacity 90", () => {
    expect(defaultRasterSymbolization.opacity).toBe(90);
  });

  it("uses gray as default mode", () => {
    expect(defaultRasterSymbolization.mode).toBe("gray");
  });

  it("has single band by default", () => {
    expect(defaultRasterSymbolization.bands).toEqual([1]);
  });

  it("uses mask as default alpha band", () => {
    expect(defaultRasterSymbolization.alphaBand).toBe("mask");
  });

  it("enables nodata by default", () => {
    expect(defaultRasterSymbolization.nodata.enabled).toBe(true);
  });

  it("enables stretch by default", () => {
    expect(defaultRasterSymbolization.stretch.enabled).toBe(true);
  });

  it("uses poplar as default palette", () => {
    expect(defaultRasterSymbolization.palette).toBe("poplar");
  });
});

describe("cloneDefaultGroupSymbolization", () => {
  it("returns a copy with same values", () => {
    const clone = cloneDefaultGroupSymbolization();
    expect(clone).toEqual(defaultGroupSymbolization);
  });

  it("returns a different object reference", () => {
    const clone = cloneDefaultGroupSymbolization();
    expect(clone).not.toBe(defaultGroupSymbolization);
  });
});

describe("cloneDefaultVectorSymbolization", () => {
  it("returns a copy with same values", () => {
    const clone = cloneDefaultVectorSymbolization();
    expect(clone).toEqual(defaultVectorSymbolization);
  });

  it("returns a different object reference", () => {
    const clone = cloneDefaultVectorSymbolization();
    expect(clone).not.toBe(defaultVectorSymbolization);
  });

  it("clones nested objects", () => {
    const clone = cloneDefaultVectorSymbolization();
    expect(clone.circle).not.toBe(defaultVectorSymbolization.circle);
    expect(clone.symbol).not.toBe(defaultVectorSymbolization.symbol);
    expect(clone.cluster).not.toBe(defaultVectorSymbolization.cluster);
    expect(clone.line).not.toBe(defaultVectorSymbolization.line);
    expect(clone.fill).not.toBe(defaultVectorSymbolization.fill);
    expect(clone.renderer).not.toBe(defaultVectorSymbolization.renderer);
  });

  it("clones nested arrays", () => {
    const clone = cloneDefaultVectorSymbolization();
    expect(clone.symbol.iconOffset).not.toBe(
      defaultVectorSymbolization.symbol.iconOffset,
    );
    expect(clone.line.lineDasharray).not.toBe(
      defaultVectorSymbolization.line.lineDasharray,
    );
  });
});

describe("germplasmDnaSexRenderer", () => {
  it("merges female aliases into one class", () => {
    const renderer = germplasmDnaSexRenderer(
      "性别",
      new Map([
        ["雌株", 287],
        ["雄株", 361],
        ["雌株珠", 15],
      ]),
    );
    expect(isUniqueValueRenderer(renderer)).toBe(true);
    expect(renderer.classes[0]?.label).toBe("雌性");
    expect(renderer.classes[0]?.values).toEqual(["雌株", "雌株珠"]);
    expect(renderer.classes[0]?.count).toBe(302);
    expect(renderer.classes[1]?.count).toBe(361);
  });
});

describe("graduated vector renderer", () => {
  it("builds equal-interval classes for continuous values", () => {
    const renderer = buildGraduatedRenderer("海拔", [100, 200, 300, 400, 500], {
      classCount: 5,
      method: "equalInterval",
      colorRamp: "orange",
      precision: 0,
    });
    expect(isGraduatedRenderer(renderer)).toBe(true);
    expect(renderer.classes).toHaveLength(5);
    expect(renderer.classes[0]).toMatchObject({
      min: 100,
      max: 180,
      count: 1,
      color: "#FFF2C6",
    });
    expect(renderer.classes[4]).toMatchObject({
      min: 420,
      max: 500,
      count: 1,
    });
  });

  it("builds quantile classes and refreshes no-data counts", () => {
    const counts = new Map([
      ["0.1", 2],
      ["0.4", 1],
      ["0.7", 1],
      ["无", 3],
    ]);
    const { values, nonNumericCount } = numericValuesFromCounts(counts);
    const renderer = buildGraduatedRenderer("NDVI", values, {
      classCount: 3,
      method: "quantile",
      colorRamp: "green",
    });
    const refreshed = refreshGraduatedCounts(
      renderer,
      values,
      nonNumericCount,
    );
    expect(refreshed.classes.length).toBeGreaterThanOrEqual(2);
    expect(refreshed.classes.reduce((sum, item) => sum + item.count, 0)).toBe(
      4,
    );
    expect(refreshed.defaultClass.count).toBe(3);
  });

  it("parses numeric strings with units and separators", () => {
    expect(parseNumericValue("1,235.5 m")).toBe(1235.5);
    expect(parseNumericValue("盐分 0.83%")).toBe(0.83);
    expect(parseNumericValue("NDVI=-0.12")).toBe(-0.12);
    expect(parseNumericValue("无数据")).toBeNull();
  });
});

describe("rasterSymbolizationFromRules", () => {
  it("returns defaults for undefined input", () => {
    const result = rasterSymbolizationFromRules(undefined);
    expect(result.mode).toBe("gray");
    expect(result.bands).toEqual([1]);
    expect(result.opacity).toBe(90);
  });

  it("returns defaults for empty object", () => {
    const result = rasterSymbolizationFromRules({});
    expect(result.mode).toBe("gray");
    expect(result.bands).toEqual([1]);
  });

  it("merges provided mode", () => {
    const result = rasterSymbolizationFromRules({ mode: "rgb" });
    expect(result.mode).toBe("rgb");
  });

  it("merges provided bands", () => {
    const result = rasterSymbolizationFromRules({ bands: [1, 2, 3] });
    expect(result.bands).toEqual([1, 2, 3]);
  });

  it("converts band values to numbers", () => {
    const result = rasterSymbolizationFromRules({
      bands: ["1", "2", "3"] as unknown as number[],
    });
    expect(result.bands).toEqual([1, 2, 3]);
  });

  it("uses default bands for empty array", () => {
    const result = rasterSymbolizationFromRules({ bands: [] });
    expect(result.bands).toEqual([1]);
  });

  it("merges opacity", () => {
    const result = rasterSymbolizationFromRules({ opacity: 50 });
    expect(result.opacity).toBe(50);
  });

  it("uses default opacity for non-number", () => {
    const result = rasterSymbolizationFromRules({
      opacity: "invalid" as unknown as number,
    });
    expect(result.opacity).toBe(90);
  });

  it("merges alphaBand", () => {
    const result = rasterSymbolizationFromRules({ alphaBand: 4 });
    expect(result.alphaBand).toBe(4);
  });

  it("accepts mask as alphaBand", () => {
    const result = rasterSymbolizationFromRules({ alphaBand: "mask" });
    expect(result.alphaBand).toBe("mask");
  });

  it("accepts null as alphaBand", () => {
    const result = rasterSymbolizationFromRules({ alphaBand: null });
    expect(result.alphaBand).toBeNull();
  });

  it("merges nodata settings", () => {
    const result = rasterSymbolizationFromRules({ nodata: { enabled: false } });
    expect(result.nodata.enabled).toBe(false);
  });

  it("merges stretch settings", () => {
    const result = rasterSymbolizationFromRules({
      stretch: { enabled: false, type: "minmax", perBand: {} },
    });
    expect(result.stretch.enabled).toBe(false);
  });

  it("merges unique values", () => {
    const uniqueValues = [{ value: 1, color: "#ff0000", label: "A" }];
    const result = rasterSymbolizationFromRules({ uniqueValues });
    expect(result.uniqueValues).toEqual(uniqueValues);
  });

  it("uses default unique values for non-array", () => {
    const result = rasterSymbolizationFromRules({
      uniqueValues: "invalid" as unknown as [],
    });
    expect(result.uniqueValues).toEqual([]);
  });
});

describe("cloneDefaultRasterSymbolization", () => {
  it("returns a copy with same values", () => {
    const clone = cloneDefaultRasterSymbolization();
    expect(clone).toEqual(defaultRasterSymbolization);
  });

  it("returns a different object reference", () => {
    const clone = cloneDefaultRasterSymbolization();
    expect(clone).not.toBe(defaultRasterSymbolization);
  });

  it("clones nested objects", () => {
    const clone = cloneDefaultRasterSymbolization();
    expect(clone.nodata).not.toBe(defaultRasterSymbolization.nodata);
    expect(clone.stretch).not.toBe(defaultRasterSymbolization.stretch);
  });

  it("clones perBand object", () => {
    const clone = cloneDefaultRasterSymbolization();
    expect(clone.stretch.perBand).not.toBe(
      defaultRasterSymbolization.stretch.perBand,
    );
  });
});
