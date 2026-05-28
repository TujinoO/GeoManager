import type mapboxgl from "mapbox-gl";
import type { LoadedRasterLayer } from "../types";
import { clamp, rasterSourceKey } from "../utils/geometry";
import { getMapState } from "./mapState";
import { upsertLayer } from "./styleHelpers";
import { removeLoadedLayerGroup } from "./vectorLayerSync";

export function addRasterLayer(
  map: mapboxgl.Map,
  sourceId: string,
  layer: LoadedRasterLayer,
) {
  const style = layer.symbolization;
  const layerId = `${sourceId}-raster`;
  const key = rasterSourceKey(layer);
  const state = getMapState(map);

  if (state.rasterSourceKeys.get(sourceId) !== key) {
    removeLoadedLayerGroup(map, sourceId);
    if (layer.tileUrl) {
      map.addSource(sourceId, {
        type: "raster",
        tiles: [layer.tileUrl],
        tileSize: 256,
      });
    }
    state.rasterSourceKeys.set(sourceId, key);
  }
  if (!map.getSource(sourceId)) return;
  upsertLayer(map, {
    id: layerId,
    type: "raster",
    source: sourceId,
    paint: { "raster-opacity": clamp(style.opacity / 100, 0, 1) },
  });
}
