import mapboxgl from "mapbox-gl";
import type {
  GeoJsonFeatureCollection,
  GeoJsonGeometry,
  LoadedLayerGroup,
} from "../types";

export function rectangleGeometry(
  start: [number, number],
  end: [number, number],
): GeoJsonGeometry {
  const west = Math.min(start[0], end[0]);
  const east = Math.max(start[0], end[0]);
  const south = Math.min(start[1], end[1]);
  const north = Math.max(start[1], end[1]);
  return {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

export function geometryFromBoundsText(value: unknown): GeoJsonGeometry | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const numbers = String(value)
    .match(/-?\d+(?:\.\d+)?/g)
    ?.map(Number);
  if (!numbers || numbers.length < 4) {
    return null;
  }
  const [minLng, minLat, maxLng, maxLat] = numbers as [
    number,
    number,
    number,
    number,
  ];
  if (
    ![minLng, minLat, maxLng, maxLat].every(Number.isFinite) ||
    Math.abs(minLng) > 180 ||
    Math.abs(maxLng) > 180 ||
    Math.abs(minLat) > 90 ||
    Math.abs(maxLat) > 90 ||
    minLng === maxLng ||
    minLat === maxLat
  ) {
    return null;
  }
  return rectangleGeometry([minLng, minLat], [maxLng, maxLat]);
}

export function circleGeometry(
  center: [number, number],
  edge: [number, number],
): GeoJsonGeometry {
  const dx = edge[0] - center[0];
  const dy = edge[1] - center[1];
  const radius = Math.sqrt(dx * dx + dy * dy);
  return ellipseRing(center, radius, radius);
}

export function ellipseGeometry(
  center: [number, number],
  edge: [number, number],
): GeoJsonGeometry {
  return ellipseRing(
    center,
    Math.abs(edge[0] - center[0]),
    Math.abs(edge[1] - center[1]),
  );
}

function ellipseRing(
  center: [number, number],
  radiusX: number,
  radiusY: number,
): GeoJsonGeometry {
  const ring: Array<[number, number]> = [];
  for (let index = 0; index <= 72; index += 1) {
    const angle = (Math.PI * 2 * index) / 72;
    ring.push([
      center[0] + Math.cos(angle) * radiusX,
      center[1] + Math.sin(angle) * radiusY,
    ]);
  }
  return { type: "Polygon", coordinates: [ring] };
}

export function polygonGeometry(
  points: Array<[number, number]>,
): GeoJsonGeometry {
  const ring = [...points];
  const firstPoint = ring[0];
  if (firstPoint) {
    ring.push(firstPoint);
  }
  return { type: "Polygon", coordinates: [ring] };
}

export function geometryFromPoints(
  mode: "rectangle" | "circle" | "ellipse" | "polygon",
  start: [number, number],
  end: [number, number],
): GeoJsonGeometry {
  if (mode === "rectangle") return rectangleGeometry(start, end);
  if (mode === "circle") return circleGeometry(start, end);
  if (mode === "ellipse") return ellipseGeometry(start, end);
  return polygonGeometry([start, end]);
}

export function combinedFeatureBounds(
  collections: GeoJsonFeatureCollection[],
): mapboxgl.LngLatBounds | null {
  const points: Array<[number, number]> = [];
  for (const collection of collections) {
    for (const feature of collection.features) {
      const geometry = feature.geometry as
        | { type?: string; coordinates?: unknown }
        | undefined;
      if (!geometry?.type || geometry.coordinates === undefined) continue;
      extractCoordinates(geometry.coordinates, points);
    }
  }
  if (points.length === 0) return null;
  const firstPoint = points[0];
  if (!firstPoint) return null;
  return points.reduce(
    (bounds, point) => bounds.extend(point),
    new mapboxgl.LngLatBounds(firstPoint, firstPoint),
  );
}

export function extractCoordinates(
  value: unknown,
  points: Array<[number, number]>,
) {
  if (!Array.isArray(value)) return;
  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    points.push([value[0], value[1]]);
    return;
  }
  for (const item of value) {
    extractCoordinates(item, points);
  }
}

export function boundsFromImageCoordinates(
  coordinates: Array<[number, number]>,
): mapboxgl.LngLatBounds | null {
  if (coordinates.length === 0) return null;
  const firstCoordinate = coordinates[0];
  if (!firstCoordinate) return null;
  return coordinates.reduce(
    (bounds, point) => bounds.extend(point),
    new mapboxgl.LngLatBounds(firstCoordinate, firstCoordinate),
  );
}

export function fitGeojsonBounds(
  map: mapboxgl.Map,
  geojson: GeoJsonFeatureCollection,
  fallbackCenter: [number, number],
  fallbackZoom: number,
) {
  const bounds = combinedFeatureBounds([geojson]);
  if (bounds) {
    map.fitBounds(bounds, { padding: 72, duration: 900, essential: true });
    return;
  }
  map.flyTo({
    center: fallbackCenter,
    zoom: fallbackZoom,
    duration: 900,
    essential: true,
  });
}

export function reorderLayerGroups(
  groups: LoadedLayerGroup[],
  sourceGroupId: string,
  targetGroupId: string,
  placement: "before" | "after",
): LoadedLayerGroup[] {
  const sourceIndex = groups.findIndex((g) => g.id === sourceGroupId);
  const targetIndex = groups.findIndex((g) => g.id === targetGroupId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex)
    return groups;
  const next = [...groups];
  const [source] = next.splice(sourceIndex, 1);
  if (!source) return groups;
  const adjustedTargetIndex = next.findIndex((g) => g.id === targetGroupId);
  next.splice(
    placement === "before" ? adjustedTargetIndex : adjustedTargetIndex + 1,
    0,
    source,
  );
  return next;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function sourceIdFor(layerId: string): string {
  return `loaded-${layerId}`;
}

export function rasterSourceKey(layer: { tileUrl?: string }): string {
  return JSON.stringify({ tileUrl: layer.tileUrl });
}
