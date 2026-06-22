import { describe, expect, it } from "vitest";
import { thumbnailTiles } from "./RightSidePanel";

describe("thumbnailTiles", () => {
  it("overlaps adjacent tile edges to avoid visible seams", () => {
    const tiles = thumbnailTiles(
      6,
      { left: 4000.25, top: 2200.25, scale: 0.37 },
      360,
      180,
    );
    const rows = new Map<number, typeof tiles>();
    for (const tile of tiles) {
      rows.set(tile.top, [...(rows.get(tile.top) ?? []), tile]);
    }

    for (const row of rows.values()) {
      const sorted = [...row].sort((a, b) => a.left - b.left);
      for (let i = 1; i < sorted.length; i += 1) {
        const previous = sorted[i - 1];
        const current = sorted[i];
        expect(
          current.left - (previous.left + previous.width),
        ).toBeLessThanOrEqual(0);
      }
    }
  });
});
