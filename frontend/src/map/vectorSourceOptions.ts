import type { GeoJSONSourceSpecification } from "mapbox-gl";
import type { LoadedVectorLayer } from "../types";

const largePointFeatureCount = 1000;
const largeLineOrPolygonFeatureCount = 2000;

export function vectorGeojsonSourceOptions(
  layer: LoadedVectorLayer,
): GeoJSONSourceSpecification {
  const featureCount = layer.geojson.features.length;
  const pointOnly = featureCount > 0 && isPointOnlyGeometry(layer.geometryType);
  const cluster =
    pointOnly &&
    featureCount >= largePointFeatureCount &&
    layer.symbolization.pointMode !== "heatmap";
  const source: GeoJSONSourceSpecification = {
    type: "geojson",
    data: layer.geojson as never,
    generateId: true,
    maxzoom: pointOnly ? 12 : 16,
    ...(pointOnly ? { buffer: 0 } : {}),
    ...(!pointOnly && featureCount >= largeLineOrPolygonFeatureCount
      ? { tolerance: 0.75 }
      : {}),
    ...(cluster
      ? {
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 50,
        }
      : {}),
  };
  return source;
}

export function shouldClusterVectorLayer(layer: LoadedVectorLayer) {
  return Boolean(vectorGeojsonSourceOptions(layer).cluster);
}

export function vectorSourceKey(layer: LoadedVectorLayer) {
  const options = vectorGeojsonSourceOptions(layer);
  return JSON.stringify({
    buffer: options.buffer,
    cluster: options.cluster,
    clusterMaxZoom: options.clusterMaxZoom,
    clusterRadius: options.clusterRadius,
    maxzoom: options.maxzoom,
    tolerance: options.tolerance,
  });
}

function isPointOnlyGeometry(geometryType: string) {
  const geometryTypes = geometryType
    .split(/[,/|+\s]+/)
    .map((type) => type.trim())
    .filter(Boolean);
  return (
    geometryTypes.length > 0 &&
    geometryTypes.every((type) => type === "Point" || type === "MultiPoint")
  );
}
