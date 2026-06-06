import type {
  AnyLayer,
  ExpressionSpecification,
  Map as MapboxMap,
} from "mapbox-gl";
import type { VectorSymbolization } from "../symbolization";
import { clamp } from "../utils/geometry";
import { removeVectorInteraction } from "./featureInteraction";

export function stateColor(baseColor: string) {
  return [
    "case",
    ["boolean", ["feature-state", "selected"], false],
    "#e4582b",
    ["boolean", ["feature-state", "highlight"], false],
    "#f2c36d",
    baseColor,
  ] as unknown as ExpressionSpecification;
}

export function stateNumber(base: number, selected: number, highlight: number) {
  return [
    "case",
    ["boolean", ["feature-state", "selected"], false],
    selected,
    ["boolean", ["feature-state", "highlight"], false],
    highlight,
    base,
  ] as unknown as ExpressionSpecification;
}

export function upsertLayer(map: MapboxMap, layer: AnyLayer) {
  const existing = map.getLayer(layer.id);
  if (existing && existing.type !== layer.type) {
    removeStyleLayer(map, layer.id);
  }
  if (!map.getLayer(layer.id)) {
    map.addLayer(layer);
    return;
  }
  if ("filter" in layer) {
    map.setFilter(layer.id, layer.filter);
  }
  const writableMap = map as unknown as {
    setLayoutProperty: (
      layerId: string,
      property: string,
      value: unknown,
    ) => void;
    setPaintProperty: (
      layerId: string,
      property: string,
      value: unknown,
    ) => void;
  };
  for (const [property, value] of Object.entries(layer.layout ?? {})) {
    writableMap.setLayoutProperty(layer.id, property, value);
  }
  for (const [property, value] of Object.entries(layer.paint ?? {})) {
    writableMap.setPaintProperty(layer.id, property, value);
  }
}

export function removeStyleLayer(map: MapboxMap, layerId: string) {
  removeVectorInteraction(map, layerId);
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
}

export function buildVectorPaintProperties(
  style: VectorSymbolization,
  layerOpacity: number,
) {
  const circleOpacity = clamp(style.circle.circleOpacity * layerOpacity, 0, 1);
  const circleStrokeOpacity = clamp(
    style.circle.circleStrokeOpacity * layerOpacity,
    0,
    1,
  );
  const symbolIconOpacity = clamp(
    style.symbol.iconOpacity * layerOpacity,
    0,
    1,
  );
  const symbolTextOpacity = clamp(
    style.symbol.textOpacity * layerOpacity,
    0,
    1,
  );
  const lineOpacity = clamp(style.line.lineOpacity * layerOpacity, 0, 1);
  const fillOpacity = clamp(style.fill.fillOpacity * layerOpacity, 0, 1);

  return {
    circleOpacity,
    circleStrokeOpacity,
    symbolIconOpacity,
    symbolTextOpacity,
    lineOpacity,
    fillOpacity,
  };
}
