import { describe, expect, it } from "vitest";
import { BasemapTileRequestTimings } from "./useBasemapStatus";

describe("BasemapTileRequestTimings", () => {
  it("removes a completed or failed tile timing when it is consumed", () => {
    const timings = new BasemapTileRequestTimings();
    timings.start("tile-a", 120);

    expect(timings.finish("tile-a")).toBe(120);
    expect(timings.finish("tile-a")).toBeUndefined();
  });

  it("evicts the oldest unfinished tile at the capacity limit", () => {
    const timings = new BasemapTileRequestTimings(2);
    timings.start("tile-a", 100);
    timings.start("tile-b", 200);
    timings.start("tile-c", 300);

    expect(timings.finish("tile-a")).toBeUndefined();
    expect(timings.finish("tile-b")).toBe(200);
    expect(timings.finish("tile-c")).toBe(300);
  });
});
