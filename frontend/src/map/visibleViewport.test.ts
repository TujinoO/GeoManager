import type { Map as MapboxMap } from "mapbox-gl";
import { afterEach, describe, expect, it } from "vitest";
import {
  fitBoundsOptionsForVisibleFrame,
  readVisibleMapViewState,
} from "./visibleViewport";

describe("visibleViewport", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("reads bounds from the unobstructed map frame", () => {
    const { container, map } = createWorkspace();

    setRect(container, { left: 0, top: 0, width: 1000, height: 800 });
    setRect(".workspace-header", {
      left: 14,
      top: 14,
      width: 972,
      height: 66,
    });
    setRect(".floating-panel-left", {
      left: 18,
      top: 90,
      width: 300,
      height: 692,
    });
    setRect(".floating-panel-right", {
      left: 682,
      top: 90,
      width: 300,
      height: 692,
    });
    setRect(".floating-panel-bottom", {
      left: 332,
      top: 530,
      width: 336,
      height: 252,
    });

    const view = readVisibleMapViewState(map);

    expect(view.center).toEqual([0, -9.5]);
    expect(view.bounds[0]).toBeCloseTo(-18.2);
    expect(view.bounds[1]).toBe(-32);
    expect(view.bounds[2]).toBeCloseTo(18.2);
    expect(view.bounds[3]).toBe(13);
  });

  it("adds panel insets to fitBounds padding", () => {
    const { container, map } = createWorkspace();

    setRect(container, { left: 0, top: 0, width: 1000, height: 800 });
    setRect(".workspace-header", {
      left: 14,
      top: 14,
      width: 972,
      height: 66,
    });
    setRect(".floating-panel-left", {
      left: 18,
      top: 90,
      width: 300,
      height: 692,
    });
    setRect(".floating-panel-right", {
      left: 682,
      top: 90,
      width: 300,
      height: 692,
    });
    setRect(".floating-panel-bottom", {
      left: 332,
      top: 530,
      width: 336,
      height: 252,
    });

    expect(fitBoundsOptionsForVisibleFrame(map).padding).toEqual({
      top: 152,
      right: 390,
      bottom: 342,
      left: 390,
    });
  });
});

function createWorkspace() {
  document.body.innerHTML = `
    <div class="workspace">
      <header class="workspace-header"></header>
      <main class="map-stage">
        <div class="map-container"></div>
      </main>
      <aside class="floating-panel floating-panel-left"></aside>
      <aside class="floating-panel floating-panel-right"></aside>
      <aside class="floating-panel-bottom"></aside>
    </div>
  `;
  const container = document.querySelector<HTMLElement>(".map-container");
  if (!container) throw new Error("Missing map container");
  const map = {
    getContainer: () => container,
    unproject: ([x, y]: [number, number]) => ({
      lng: x / 10 - 50,
      lat: y / 10 - 40,
    }),
    getZoom: () => 5,
    getBearing: () => 0,
    getPitch: () => 0,
  } as unknown as MapboxMap;
  return { container, map };
}

function setRect(
  target: string | HTMLElement,
  rect: { left: number; top: number; width: number; height: number },
) {
  const element =
    typeof target === "string"
      ? document.querySelector<HTMLElement>(target)
      : target;
  if (!element) throw new Error(`Missing element: ${target}`);
  const value = {
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  } as DOMRect;
  element.getBoundingClientRect = () => value;
}
