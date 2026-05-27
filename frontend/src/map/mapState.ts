import type mapboxgl from 'mapbox-gl';

export interface FeatureStateTarget {
  source: string;
  id: string | number;
}

export interface VectorInteractionHandlers {
  click: (event: mapboxgl.MapLayerMouseEvent) => void;
  mousemove: (event: mapboxgl.MapLayerMouseEvent) => void;
  mouseleave: () => void;
}

export interface MapInternalState {
  interactiveHandlers: Map<string, VectorInteractionHandlers>;
  hoveredFeature: FeatureStateTarget | undefined;
  selectedFeature: FeatureStateTarget | undefined;
  popup: mapboxgl.Popup | undefined;
  rasterSourceKeys: Map<string, string>;
}

const mapStates = new WeakMap<mapboxgl.Map, MapInternalState>();

export function getMapState(map: mapboxgl.Map): MapInternalState {
  let state = mapStates.get(map);
  if (!state) {
    state = {
      interactiveHandlers: new Map(),
      hoveredFeature: undefined,
      selectedFeature: undefined,
      popup: undefined,
      rasterSourceKeys: new Map(),
    };
    mapStates.set(map, state);
  }
  return state;
}

export function clearFeatureState(
  map: mapboxgl.Map,
  key: 'hoveredFeature' | 'selectedFeature',
  stateName: string,
) {
  const state = getMapState(map);
  const target = state[key];
  if (!target || !map.getSource(target.source)) {
    state[key] = undefined;
    return;
  }
  map.setFeatureState(target, { [stateName]: false });
  state[key] = undefined;
}

export function featureStateTarget(feature: mapboxgl.MapboxGeoJSONFeature): FeatureStateTarget | null {
  if (feature.id === undefined || !feature.source) return null;
  return { source: feature.source, id: feature.id };
}
