import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { describe, expect, it, vi } from "vitest";
import { cloneDefaultRasterSymbolization } from "../symbolization";
import type { LoadedRasterLayer } from "../types";
import { addRasterLayer } from "./rasterLayerSync";

describe("addRasterLayer", () => {
  it("disables interpolation and zoom cross-fading for categorical rasters", () => {
    const { map, addedLayers } = makeMap();
    const layer = makeRasterLayer("categorical", "unique");

    addRasterLayer(map, "lucc", layer);

    expect(addedLayers[0]?.paint).toMatchObject({
      "raster-resampling": "nearest",
      "raster-fade-duration": 0,
    });
  });

  it("keeps smooth sampling for continuous rasters", () => {
    const { map, addedLayers } = makeMap();
    const layer = makeRasterLayer("continuous", "gray");

    addRasterLayer(map, "dem", layer);

    expect(addedLayers[0]?.paint).toMatchObject({
      "raster-resampling": "linear",
      "raster-fade-duration": 300,
    });
  });
});

function makeRasterLayer(
  rasterKind: LoadedRasterLayer["rasterKind"],
  mode: LoadedRasterLayer["symbolization"]["mode"],
): LoadedRasterLayer {
  const symbolization = cloneDefaultRasterSymbolization();
  symbolization.mode = mode;
  return {
    id: `raster-${rasterKind}`,
    name: "测试栅格",
    layerType: "raster",
    sourceResource: {} as LoadedRasterLayer["sourceResource"],
    tileUrl: "/api/raster/tiles/1/hash/{z}/{x}/{y}.png",
    rasterKind,
    geometryType: "Raster",
    visible: true,
    summary: "",
    metadata: {},
    symbolization,
    fields: [],
  };
}

function makeMap() {
  const sources = new Set<string>();
  const addedLayers: AnyLayer[] = [];
  const map = {
    style: {},
    getStyle: vi.fn(() => ({})),
    getLayer: vi.fn(() => undefined),
    getSource: vi.fn((id: string) => (sources.has(id) ? {} : undefined)),
    addSource: vi.fn((id: string) => sources.add(id)),
    removeSource: vi.fn((id: string) => sources.delete(id)),
    addLayer: vi.fn((layer: AnyLayer) => addedLayers.push(layer)),
    removeLayer: vi.fn(),
    setFilter: vi.fn(),
    setLayoutProperty: vi.fn(),
    setPaintProperty: vi.fn(),
  } as unknown as MapboxMap;
  return { map, addedLayers };
}
