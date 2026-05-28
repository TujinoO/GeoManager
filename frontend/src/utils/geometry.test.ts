import { describe, expect, it } from "vitest";
import type { LoadedLayerGroup } from "../types";
import {
  boundsFromImageCoordinates,
  circleGeometry,
  clamp,
  combinedFeatureBounds,
  delay,
  ellipseGeometry,
  extractCoordinates,
  formatBytes,
  geometryFromPoints,
  polygonGeometry,
  rasterSourceKey,
  rectangleGeometry,
  reorderLayerGroups,
  sourceIdFor,
} from "./geometry";

describe("rectangleGeometry", () => {
  it("creates a closed polygon from two corners", () => {
    const geo = rectangleGeometry([10, 20], [30, 40]);
    expect(geo.type).toBe("Polygon");
    const coords = (geo as { coordinates: number[][][] }).coordinates[0];
    expect(coords).toHaveLength(5);
    expect(coords[0]).toEqual(coords[4]);
    expect(coords[0][0]).toBe(10);
    expect(coords[2][0]).toBe(30);
  });

  it("normalizes order when start > end", () => {
    const geo = rectangleGeometry([30, 40], [10, 20]);
    const coords = (geo as { coordinates: number[][][] }).coordinates[0];
    expect(coords[0][0]).toBe(10);
    expect(coords[2][0]).toBe(30);
  });
});

describe("circleGeometry", () => {
  it("creates a polygon with 73 points", () => {
    const geo = circleGeometry([0, 0], [1, 0]);
    const coords = (geo as { coordinates: number[][][] }).coordinates[0];
    expect(coords).toHaveLength(73);
    expect(coords[0][0]).toBeCloseTo(coords[72][0]);
    expect(coords[0][1]).toBeCloseTo(coords[72][1]);
  });
});

describe("ellipseGeometry", () => {
  it("creates a polygon", () => {
    const geo = ellipseGeometry([0, 0], [2, 1]);
    expect(geo.type).toBe("Polygon");
  });
});

describe("polygonGeometry", () => {
  it("closes the ring", () => {
    const geo = polygonGeometry([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
    const coords = (geo as { coordinates: number[][][] }).coordinates[0];
    expect(coords).toHaveLength(4);
    expect(coords[0]).toEqual(coords[3]);
  });

  it("handles empty points", () => {
    const geo = polygonGeometry([]);
    const coords = (geo as { coordinates: number[][][] }).coordinates[0];
    expect(coords).toHaveLength(0);
  });
});

describe("geometryFromPoints", () => {
  it("delegates to rectangleGeometry for rectangle mode", () => {
    const geo = geometryFromPoints("rectangle", [0, 0], [1, 1]);
    expect(geo.type).toBe("Polygon");
  });

  it("delegates to circleGeometry for circle mode", () => {
    const geo = geometryFromPoints("circle", [0, 0], [1, 0]);
    const coords = (geo as { coordinates: number[][][] }).coordinates[0];
    expect(coords).toHaveLength(73);
  });
});

describe("clamp", () => {
  it("clamps below min", () => expect(clamp(-5, 0, 10)).toBe(0));
  it("clamps above max", () => expect(clamp(15, 0, 10)).toBe(10));
  it("returns value in range", () => expect(clamp(5, 0, 10)).toBe(5));
});

describe("formatBytes", () => {
  it("formats 0", () => expect(formatBytes(0)).toBe("0 B"));
  it("formats bytes", () => expect(formatBytes(500)).toBe("500 B"));
  it("formats KB", () => expect(formatBytes(1024)).toBe("1.0 KB"));
  it("formats MB", () => expect(formatBytes(1048576)).toBe("1.0 MB"));
  it("formats GB", () => expect(formatBytes(1073741824)).toBe("1.0 GB"));
});

describe("sourceIdFor", () => {
  it("prefixes with loaded-", () =>
    expect(sourceIdFor("abc")).toBe("loaded-abc"));
});

describe("rasterSourceKey", () => {
  it("returns JSON string", () => {
    const key = rasterSourceKey({ tileUrl: "a/{z}/{x}/{y}.png" });
    expect(() => JSON.parse(key)).not.toThrow();
  });

  it("differs for different urls", () => {
    const k1 = rasterSourceKey({ tileUrl: "a/{z}/{x}/{y}.png" });
    const k2 = rasterSourceKey({ tileUrl: "b/{z}/{x}/{y}.png" });
    expect(k1).not.toBe(k2);
  });
});

describe("delay", () => {
  it("resolves after specified ms", async () => {
    const start = Date.now();
    await delay(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });
});

describe("reorderLayerGroups", () => {
  const groups = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
  ] as LoadedLayerGroup[];

  it("moves group before target", () => {
    const result = reorderLayerGroups(groups, "c", "a", "before");
    expect(result.map((g) => g.id)).toEqual(["c", "a", "b"]);
  });

  it("moves group after target", () => {
    const result = reorderLayerGroups(groups, "a", "c", "after");
    expect(result.map((g) => g.id)).toEqual(["b", "c", "a"]);
  });

  it("returns same array if source not found", () => {
    expect(reorderLayerGroups(groups, "x", "a", "before")).toBe(groups);
  });

  it("returns same array if target not found", () => {
    expect(reorderLayerGroups(groups, "a", "x", "before")).toBe(groups);
  });

  it("returns same array if source equals target", () => {
    expect(reorderLayerGroups(groups, "a", "a", "before")).toBe(groups);
  });
});

describe("extractCoordinates", () => {
  it("extracts point coordinates", () => {
    const points: [number, number][] = [];
    extractCoordinates([10, 20], points);
    expect(points).toEqual([[10, 20]]);
  });

  it("recursively extracts nested coordinates", () => {
    const points: [number, number][] = [];
    extractCoordinates(
      [
        [
          [1, 2],
          [3, 4],
        ],
      ],
      points,
    );
    expect(points).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("ignores non-array input", () => {
    const points: [number, number][] = [];
    extractCoordinates("not an array", points);
    expect(points).toEqual([]);
  });
});

describe("combinedFeatureBounds", () => {
  it("returns null for empty collections", () => {
    expect(combinedFeatureBounds([])).toBeNull();
  });

  it("returns bounds for features with coordinates", () => {
    const fc = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "Point", coordinates: [10, 20] },
        },
        {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "Point", coordinates: [30, 40] },
        },
      ],
    };
    const bounds = combinedFeatureBounds([fc]);
    expect(bounds).not.toBeNull();
    expect(bounds?.getWest()).toBe(10);
    expect(bounds?.getEast()).toBe(30);
    expect(bounds?.getSouth()).toBe(20);
    expect(bounds?.getNorth()).toBe(40);
  });
});

describe("boundsFromImageCoordinates", () => {
  it("returns null for empty array", () => {
    expect(boundsFromImageCoordinates([])).toBeNull();
  });

  it("returns bounds from coordinates", () => {
    const bounds = boundsFromImageCoordinates([
      [10, 20],
      [30, 40],
    ]);
    expect(bounds).not.toBeNull();
    expect(bounds?.getWest()).toBe(10);
    expect(bounds?.getEast()).toBe(30);
  });
});
