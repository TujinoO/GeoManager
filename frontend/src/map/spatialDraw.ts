import mapboxgl from 'mapbox-gl';
import type { GeoJsonGeometry } from '../types';
import { addLayerIfMissing } from './styleHelpers';

const previewSourceId = 'query-draw-preview';
const previewFillId = 'query-draw-preview-fill';
const previewLineId = 'query-draw-preview-line';

export function showDrawPreview(map: mapboxgl.Map, geometry: GeoJsonGeometry) {
  upsertPolygonLayer(map, previewSourceId, previewFillId, previewLineId, geometry, 0.18);
}

export function clearDrawPreview(map: mapboxgl.Map) {
  removeLayerGroupSimple(map, previewSourceId, [previewFillId, previewLineId]);
}

export function upsertPolygonLayer(
  map: mapboxgl.Map,
  sourceId: string,
  fillId: string,
  lineId: string,
  geometry: GeoJsonGeometry,
  fillOpacity: number,
) {
  const data = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry }] };
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: 'geojson', data: data as never });
  } else {
    (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(data as never);
  }
  addLayerIfMissing(map, {
    id: fillId,
    type: 'fill',
    source: sourceId,
    paint: { 'fill-color': '#d9a441', 'fill-opacity': fillOpacity },
  });
  addLayerIfMissing(map, {
    id: lineId,
    type: 'line',
    source: sourceId,
    paint: { 'line-color': '#d9a441', 'line-width': 2, 'line-opacity': 0.9 },
  });
}

export function removeLayerGroupSimple(map: mapboxgl.Map, sourceId: string, layerIds: string[]) {
  layerIds.forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}
