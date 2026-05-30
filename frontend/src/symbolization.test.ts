import { describe, expect, it } from "vitest";
import {
  cloneDefaultGroupSymbolization,
  cloneDefaultRasterSymbolization,
  cloneDefaultVectorSymbolization,
  defaultGroupSymbolization,
  defaultRasterSymbolization,
  defaultVectorSymbolization,
  rasterSymbolizationFromRules,
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
    expect(defaultVectorSymbolization.fill.fillOpacity).toBeGreaterThanOrEqual(0);
    expect(defaultVectorSymbolization.fill.fillOpacity).toBeLessThanOrEqual(1);
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
    expect(clone.line).not.toBe(defaultVectorSymbolization.line);
    expect(clone.fill).not.toBe(defaultVectorSymbolization.fill);
  });

  it("clones nested arrays", () => {
    const clone = cloneDefaultVectorSymbolization();
    expect(clone.symbol.iconOffset).not.toBe(defaultVectorSymbolization.symbol.iconOffset);
    expect(clone.line.lineDasharray).not.toBe(defaultVectorSymbolization.line.lineDasharray);
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
    const result = rasterSymbolizationFromRules({ bands: ["1", "2", "3"] as unknown as number[] });
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
    const result = rasterSymbolizationFromRules({ opacity: "invalid" as unknown as number });
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
    const result = rasterSymbolizationFromRules({ uniqueValues: "invalid" as unknown as [] });
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
    expect(clone.stretch.perBand).not.toBe(defaultRasterSymbolization.stretch.perBand);
  });
});
