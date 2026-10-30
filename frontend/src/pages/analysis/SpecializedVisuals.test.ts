import { describe, expect, it } from "vitest";
import { rowStandardize, matrixOption } from "./SpecializedVisuals";

describe("expression heatmap row scaling", () => {
  it("colors sample correlation by r rather than by the trailing pair count", () => {
    const option = matrixOption({
      id: "sampleCorrelation",
      title: "correlation",
      method: "Pearson",
      cells: [{ x: "a", y: "b", value: -0.5, n: 48 }],
    });
    expect(option.visualMap).toMatchObject({ dimension: 2, min: -1, max: 1 });
  });
  it("standardizes within each displayed gene without filling missing values", () => {
    const result = rowStandardize([
      { x: "s1", y: "g1", value: 0 },
      { x: "s2", y: "g1", value: 2 },
      { x: "s3", y: "g1", value: null },
      { x: "s1", y: "g2", value: 100 },
      { x: "s2", y: "g2", value: 102 },
    ]);
    expect(result.map((c) => c.value)).toEqual([-1, 1, null, -1, 1]);
  });
  it("leaves constant and completely missing rows blank", () => {
    expect(
      rowStandardize([
        { x: "s1", y: "g1", value: 0 },
        { x: "s2", y: "g1", value: 0 },
        { x: "s1", y: "g2", value: null },
      ]).map((c) => c.value),
    ).toEqual([null, null, null]);
  });
});
