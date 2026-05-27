import mapboxgl from 'mapbox-gl';
import type { LoadedVectorLayer } from '../types';
import { sourceIdFor } from '../utils/geometry';
import { getMapState, clearFeatureState, featureStateTarget } from './mapState';
import type { FeatureStateTarget, VectorInteractionHandlers } from './mapState';

export function syncVectorInteractions(map: mapboxgl.Map, layers: LoadedVectorLayer[]) {
  const activeLayerIds = new Set<string>();
  for (const layer of layers) {
    const sourceId = sourceIdFor(layer.id);
    for (const styleLayerId of [`${sourceId}-fill`, `${sourceId}-line`, `${sourceId}-point`, `${sourceId}-symbol`]) {
      if (map.getLayer(styleLayerId)) {
        activeLayerIds.add(styleLayerId);
        addVectorInteraction(map, styleLayerId);
      }
    }
  }
  const handlers = getMapState(map).interactiveHandlers;
  for (const layerId of Array.from(handlers.keys())) {
    if (!activeLayerIds.has(layerId)) removeVectorInteraction(map, layerId);
  }
}

export function addVectorInteraction(map: mapboxgl.Map, layerId: string) {
  const handlers = getMapState(map).interactiveHandlers;
  if (handlers.has(layerId)) return;

  const click = (event: mapboxgl.MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) return;
    event.preventDefault();
    clearFeatureState(map, 'selectedFeature', 'selected');
    const target = featureStateTarget(feature);
    if (target) {
      map.setFeatureState(target, { selected: true });
      getMapState(map).selectedFeature = target;
    }
    showFeaturePopup(map, event.lngLat, feature.properties ?? {});
  };

  const mousemove = (event: mapboxgl.MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    map.getCanvas().style.cursor = feature ? 'pointer' : '';
    const target = feature ? featureStateTarget(feature) : null;
    const state = getMapState(map);
    const current = state.hoveredFeature;
    if (current && (!target || current.source !== target.source || current.id !== target.id)) {
      map.setFeatureState(current, { highlight: false });
      state.hoveredFeature = undefined;
    }
    if (target && (!current || current.source !== target.source || current.id !== target.id)) {
      map.setFeatureState(target, { highlight: true });
      state.hoveredFeature = target;
    }
  };

  const mouseleave = () => {
    map.getCanvas().style.cursor = '';
    clearFeatureState(map, 'hoveredFeature', 'highlight');
  };

  map.on('click', layerId, click);
  map.on('mousemove', layerId, mousemove);
  map.on('mouseleave', layerId, mouseleave);
  handlers.set(layerId, { click, mousemove, mouseleave });
}

export function removeVectorInteraction(map: mapboxgl.Map, layerId: string) {
  const handlers = getMapState(map).interactiveHandlers;
  const handler = handlers.get(layerId);
  if (!handler) return;
  map.off('click', layerId, handler.click);
  map.off('mousemove', layerId, handler.mousemove);
  map.off('mouseleave', layerId, handler.mouseleave);
  handlers.delete(layerId);
}

function showFeaturePopup(map: mapboxgl.Map, lngLat: mapboxgl.LngLat, properties: Record<string, unknown> | null) {
  const state = getMapState(map);
  state.popup?.remove();
  const container = document.createElement('div');
  container.className = 'feature-popup';
  const title = document.createElement('div');
  title.className = 'feature-popup-title';
  title.textContent = '属性值';
  container.appendChild(title);

  const table = document.createElement('div');
  table.className = 'feature-popup-table';
  const entries = Object.entries(properties ?? {});
  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'feature-popup-empty';
    empty.textContent = '无属性';
    table.appendChild(empty);
  } else {
    for (const [key, value] of entries) {
      const row = document.createElement('div');
      row.className = 'feature-popup-row';
      const keyCell = document.createElement('span');
      keyCell.textContent = key;
      const valueCell = document.createElement('strong');
      valueCell.textContent = String(value ?? '-');
      row.append(keyCell, valueCell);
      table.appendChild(row);
    }
  }
  container.appendChild(table);
  state.popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '360px' })
    .setLngLat(lngLat)
    .setDOMContent(container)
    .addTo(map);
}
