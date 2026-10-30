import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AnalysisResult } from "../../api/generated/types.gen";
import SpecializedVisuals from "./SpecializedVisuals";

describe("professional vector chart rendering", () => {
  it.each([307, 900])("renders sized function nodes at %ipx", async (width) => {
    const result = {
      kind: "function",
      query: {},
      heatmap: [],
      visuals: {
        metrics: [{ label: "基因", value: "20", note: "测试" }],
        boxes: [],
        matrices: [],
        dots: [],
        flows: [],
        nodes: [
          { id: "a", label: "条目A", value: 20, category: "GO" },
          { id: "b", label: "条目B", value: 5, category: "GO" },
        ],
        edges: [{ source: "a", target: "b", value: 2, score: 0.1 }],
        variantBins: [],
        variantClasses: [],
        notes: [],
      },
    } as AnalysisResult;
    render(
      <div style={{ width }}>
        <SpecializedVisuals result={result} canExport={false} />
      </div>,
    );
    const chart = screen
      .getByRole("heading", { name: "功能共注释图谱" })
      .closest("section")!;
    await waitFor(() => {
      const circles = [...chart.querySelectorAll("svg path")].filter((path) =>
        path.getAttribute("d")?.startsWith("M1 0A1 1"),
      );
      expect(circles).toHaveLength(2);
      const sizes = circles.map((path) => {
        const matrix = path
          .getAttribute("transform")
          ?.match(/^matrix\(([^,]+)/);
        return Number(matrix?.[1]);
      });
      expect(sizes.every((size) => size >= 5)).toBe(true);
      expect(sizes[0]).toBeGreaterThan(sizes[1]);
    });
  });
});
