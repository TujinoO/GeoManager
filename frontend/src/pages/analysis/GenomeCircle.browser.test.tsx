import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import GenomeCircle from "./GenomeCircle";

afterEach(cleanup);
describe("genome circular caption spacing", () => {
  for (const width of [320, 640]) {
    it(`separates the caption from all chromosome labels at ${width}px`, () => {
      const { container } = render(
        <div style={{ width }}>
          <GenomeCircle
            sequences={Array.from({ length: 19 }, (_, i) => ({
              id: String(i),
              name: `chr${i + 1}`,
              length: 20000000,
              geneCount: 20,
              gc: 0.32,
              bins: [],
            }))}
            onSelect={() => {}}
            canExport={false}
            code="test"
          />
        </div>,
      );
      const svg = container.querySelector(
        "svg.analysis-genome-circle",
      ) as SVGSVGElement;
      svg.style.width = `${width}px`;
      svg.style.height = "auto";
      const caption = svg
        .querySelector(".analysis-circle-caption")!
        .getBoundingClientRect();
      const labels = Array.from(svg.querySelectorAll(".analysis-circle-label"));
      expect(labels).toHaveLength(19);
      expect(caption.height).toBeGreaterThan(0);
      for (const label of labels) {
        expect(
          caption.top - label.getBoundingClientRect().bottom,
        ).toBeGreaterThan(12);
      }
      expect(caption.bottom).toBeLessThan(svg.getBoundingClientRect().bottom);
    });
  }
});
