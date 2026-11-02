import mapboxgl, {
  type Map as MapboxMap,
  type StyleSpecification,
} from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { afterEach, describe, expect, it, vi } from "vitest";
import { exportMapRangeImage, waitForStyleLoad } from "./mapExport";

let liveMap: MapboxMap | undefined;
let container: HTMLDivElement | undefined;
const originalDpr = window.devicePixelRatio;
afterEach(() => {
  liveMap?.remove();
  container?.remove();
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    value: originalDpr,
  });
  vi.restoreAllMocks();
});

const range = {
  type: "Polygon",
  coordinates: [
    [
      [87, 40],
      [89, 40],
      [89, 42],
      [87, 42],
      [87, 40],
    ],
  ],
} as const;

async function sourceMap() {
  // The fixture is fully offline. Stub only Mapbox's external session check;
  // style loading, tile decoding, WebGL rendering and PNG export remain real.
  vi.spyOn(
    mapboxgl.Map.prototype as unknown as { _authenticate: () => void },
    "_authenticate",
  ).mockImplementation(() => {});
  container = document.createElement("div");
  container.style.cssText = "width:480px;height:320px";
  document.body.appendChild(container);
  const tile = document.createElement("canvas");
  tile.width = tile.height = 256;
  const context = tile.getContext("2d")!;
  context.fillStyle = "#24703e";
  context.fillRect(0, 0, 256, 256);
  const style: StyleSpecification = {
    version: 8,
    sources: {
      "basemap-tianditu-labels": {
        type: "raster",
        tiles: [tile.toDataURL()],
        tileSize: 256,
      },
      "basemap-tianditu-vector": {
        type: "raster",
        tiles: [tile.toDataURL()],
        tileSize: 256,
        maxzoom: 18,
      },
    },
    layers: [
      {
        id: "basemap-tianditu-vector",
        type: "raster",
        source: "basemap-tianditu-vector",
        paint: { "raster-fade-duration": 0 },
      },
    ],
  };
  liveMap = new mapboxgl.Map({
    container,
    style,
    center: [88, 41],
    zoom: 4,
    accessToken: "",
    attributionControl: false,
    performanceMetricsCollection: false,
  });
  await waitForStyleLoad(liveMap);
  return liveMap;
}

describe("real WebGL map export", () => {
  it.each([1, 2])(
    "renders the selected tiles at the requested size with DPR %s",
    async (dpr) => {
      Object.defineProperty(window, "devicePixelRatio", {
        configurable: true,
        value: dpr,
      });
      const map = await sourceMap();
      const blob = await exportMapRangeImage(map, range, {
        basemapId: "tianditu-vector",
        dpi: 96,
        tileZoom: 6,
        format: "png",
        renderSize: { width: 480, height: 320 },
      });
      const bitmap = await createImageBitmap(blob);
      expect([bitmap.width, bitmap.height]).toEqual([480, 320]);
      const output = document.createElement("canvas");
      output.width = bitmap.width;
      output.height = bitmap.height;
      const context = output.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const [r, g, b, a] = context.getImageData(240, 160, 1, 1).data;
      expect(g).toBeGreaterThan(r! * 2);
      expect(g).toBeGreaterThan(b!);
      expect(a).toBe(255);
      bitmap.close();
      expect(document.querySelectorAll(".mapboxgl-map")).toHaveLength(1);
    },
  );

  it("cancels without leaving a second WebGL map attached", async () => {
    const map = await sourceMap();
    const controller = new AbortController();
    controller.abort();
    await expect(
      exportMapRangeImage(map, range, {
        dpi: 96,
        tileZoom: 6,
        format: "png",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(document.querySelectorAll(".mapboxgl-map")).toHaveLength(1);
  });
  it("rejects an empty framebuffer instead of exporting a white JPEG", async () => {
    const map = await sourceMap();
    const blank = document.createElement("canvas");
    blank.width = 480;
    blank.height = 320;
    vi.spyOn(mapboxgl.Map.prototype, "getCanvas").mockReturnValue(blank);
    await expect(
      exportMapRangeImage(map, range, {
        dpi: 96,
        tileZoom: 6,
        format: "jpg",
        renderSize: { width: 480, height: 320 },
      }),
    ).rejects.toThrow("地图画布为空");
    expect(document.querySelectorAll(".mapboxgl-map")).toHaveLength(1);
  });
});
