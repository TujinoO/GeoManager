import type { Map as MapboxMap } from "mapbox-gl";
import { describe, expect, it, vi } from "vitest";
import { getMapState } from "./mapState";
import {
  basemapErrorMessage,
  createStableReadinessGate,
  isHardBasemapStyleError,
  readBasemapCamera,
  redactBasemapCredentials,
  restoreBasemapCamera,
  restoreSelectedFeatureState,
} from "./basemapSwitch";

describe("basemapSwitch", () => {
  it("captures and restores the complete camera without fitting bounds", () => {
    const jumpTo = vi.fn();
    const map = {
      getCenter: () => ({ lng: 80.25, lat: 41.75 }),
      getZoom: () => 7.5,
      getBearing: () => 18,
      getPitch: () => 35,
      jumpTo,
    } as unknown as MapboxMap;

    const snapshot = readBasemapCamera(map);
    restoreBasemapCamera(map, snapshot);

    expect(jumpTo).toHaveBeenCalledWith({
      center: [80.25, 41.75],
      zoom: 7.5,
      bearing: 18,
      pitch: 35,
    });
  });

  it("restores the selected feature only when its source exists", () => {
    const setFeatureState = vi.fn();
    const map = {
      getSource: (sourceId: string) =>
        sourceId === "loaded-vector" ? {} : undefined,
      setFeatureState,
    } as unknown as MapboxMap;
    const target = { source: "loaded-vector", id: 7 };

    expect(restoreSelectedFeatureState(map, target)).toBe(true);
    expect(setFeatureState).toHaveBeenCalledWith(target, { selected: true });
    expect(getMapState(map).selectedFeature).toEqual(target);

    expect(restoreSelectedFeatureState(map, { source: "missing", id: 8 })).toBe(
      false,
    );
    expect(getMapState(map).selectedFeature).toBeUndefined();
  });

  it("redacts browser and server map credentials from errors", () => {
    expect(
      redactBasemapCredentials(
        "https://example.test/tile?tk=visible-value&access_token=pk.visible-token",
      ),
    ).toBe("https://example.test/tile?tk=[已隐藏]&access_token=[已隐藏]");
    expect(basemapErrorMessage({ error: new Error("HTTP 403") })).toContain(
      "HTTP 403",
    );
  });

  it("recognizes authorization failures as hard style errors", () => {
    expect(isHardBasemapStyleError(new Error("HTTP 401 Unauthorized"))).toBe(
      true,
    );
    expect(isHardBasemapStyleError(new Error("tile request timed out"))).toBe(
      false,
    );
  });

  it("rechecks readiness after the stability window before committing", () => {
    vi.useFakeTimers();
    try {
      let ready = true;
      const onReady = vi.fn();
      const gate = createStableReadinessGate(() => ready, onReady, 100);

      gate.check();
      ready = false;
      vi.advanceTimersByTime(100);
      expect(onReady).not.toHaveBeenCalled();

      ready = true;
      gate.check();
      vi.advanceTimersByTime(100);
      expect(onReady).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
