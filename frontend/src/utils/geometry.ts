import mapboxgl from 'mapbox-gl';
import type { GeoJsonGeometry, GeoJsonFeatureCollection, LoadedLayerGroup } from '../types';

export function rectangleGeometry(start: [number, number], end: [number, number]): GeoJsonGeometry {
  const west = Math.min(start[0], end[0]);
  const east = Math.max(start[0], end[0]);
  const south = Math.min(start[1], end[1]);
  const north = Math.max(start[1], end[1]);
  return {
    type: 'Polygon',
    coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
  };
}

export function circleGeometry(center: [number, number], edge: [number, number]): GeoJsonGeometry {
  const dx = edge[0] - center[0];
  const dy = edge[1] - center[1];
  const radius = Math.sqrt(dx * dx + dy * dy);
  return ellipseRing(center, radius, radius);
}

export function ellipseGeometry(center: [number, number], edge: [number, number]): GeoJsonGeometry {
  return ellipseRing(center, Math.abs(edge[0] - center[0]), Math.abs(edge[1] - center[1]));
}

export function ellipseRing(center: [number, number], radiusX: number, radiusY: number): GeoJsonGeometry {
  const ring: Array<[number, number]> = [];
  for (let index = 0; index <= 72; index += 1) {
    const angle = (Math.PI * 2 * index) / 72;
    ring.push([center[0] + Math.cos(angle) * radiusX, center[1] + Math.sin(angle) * radiusY]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

export function polygonGeometry(points: Array<[number, number]>): GeoJsonGeometry {
  const ring = [...points];
  if (ring.length > 0) {
    ring.push(ring[0]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

export function geometryFromPoints(
  mode: 'rectangle' | 'circle' | 'ellipse' | 'polygon',
  start: [number, number],
  end: [number, number],
): GeoJsonGeometry {
  if (mode === 'rectangle') return rectangleGeometry(start, end);
  if (mode === 'circle') return circleGeometry(start, end);
  if (mode === 'ellipse') return ellipseGeometry(start, end);
  return polygonGeometry([start, end]);
}

export function combinedFeatureBounds(
  collections: GeoJsonFeatureCollection[],
): mapboxgl.LngLatBounds | null {
  const points: Array<[number, number]> = [];
  for (const collection of collections) {
    for (const feature of collection.features) {
      const geometry = feature.geometry as { type?: string; coordinates?: unknown } | undefined;
      if (!geometry?.type || geometry.coordinates === undefined) continue;
      extractCoordinates(geometry.coordinates, points);
    }
  }
  if (points.length === 0) return null;
  return points.reduce(
    (bounds, point) => bounds.extend(point),
    new mapboxgl.LngLatBounds(points[0], points[0]),
  );
}

export function extractCoordinates(value: unknown, points: Array<[number, number]>) {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    points.push([value[0], value[1]]);
    return;
  }
  for (const item of value) {
    extractCoordinates(item, points);
  }
}

export function boundsFromImageCoordinates(coordinates: Array<[number, number]>): mapboxgl.LngLatBounds | null {
  if (coordinates.length === 0) return null;
  return coordinates.reduce(
    (bounds, point) => bounds.extend(point),
    new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]),
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
  map.flyTo({ center: fallbackCenter, zoom: fallbackZoom, duration: 900, essential: true });
}

export function reorderLayerGroups(
  groups: LoadedLayerGroup[],
  sourceGroupId: string,
  targetGroupId: string,
  placement: 'before' | 'after',
): LoadedLayerGroup[] {
  const sourceIndex = groups.findIndex((g) => g.id === sourceGroupId);
  const targetIndex = groups.findIndex((g) => g.id === targetGroupId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return groups;
  const next = [...groups];
  const [source] = next.splice(sourceIndex, 1);
  const adjustedTargetIndex = next.findIndex((g) => g.id === targetGroupId);
  next.splice(placement === 'before' ? adjustedTargetIndex : adjustedTargetIndex + 1, 0, source);
  return next;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

export function formatBytes(value: number): string {
  if (value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function sourceIdFor(layerId: string): string {
  return `loaded-${layerId}`;
}

export function rasterSourceKey(layer: { pngUrl?: string; tileUrl?: string; imageCoordinates?: unknown[] }): string {
  return JSON.stringify({ pngUrl: layer.pngUrl, tileUrl: layer.tileUrl, imageCoordinates: layer.imageCoordinates });
}
