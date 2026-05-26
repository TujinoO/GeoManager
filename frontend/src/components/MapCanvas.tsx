import { App, Button, Tooltip } from 'antd';
import { Fullscreen, Home, LocateFixed, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import mapboxgl, { Map } from 'mapbox-gl';
import { useEffect, useRef } from 'react';
import type { Bootstrap, GeoJsonGeometry, LoadedLayer, SpatialFilter } from '../types';

type DrawMode = SpatialFilter['mode'] | null;

interface Props {
  bootstrap: Bootstrap;
  loadedLayers: LoadedLayer[];
  drawMode: DrawMode;
  spatialFilter: SpatialFilter | null;
  onSpatialFilterChange: (filter: SpatialFilter) => void;
}

const mapStyle = 'mapbox://styles/mapbox/satellite-streets-v12';
const globeOverviewZoom = 2.4;
const previewSourceId = 'query-draw-preview';
const previewFillId = 'query-draw-preview-fill';
const previewLineId = 'query-draw-preview-line';
const spatialFilterSourceId = 'query-spatial-filter';
const spatialFilterFillId = 'query-spatial-filter-fill';
const spatialFilterLineId = 'query-spatial-filter-line';

export default function MapCanvas({
  bootstrap,
  loadedLayers,
  drawMode,
  spatialFilter,
  onSpatialFilterChange,
}: Props) {
  const { message } = App.useApp();
  const mapRef = useRef<Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapboxToken = bootstrap.map.mapboxAccessToken;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }
    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: bootstrap.map.defaultCenter,
      zoom: Math.min(bootstrap.map.defaultZoom, globeOverviewZoom),
      pitch: 18,
      bearing: -12,
      projection: 'globe',
      language: 'zh-Hans',
      localIdeographFontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      accessToken: mapboxToken,
    });
    map.on('style.load', () => {
      map.setFog({
        color: 'rgb(221, 232, 224)',
        'high-color': 'rgb(52, 96, 123)',
        'horizon-blend': 0.08,
        'space-color': 'rgb(8, 20, 28)',
        'star-intensity': 0.22,
      });
      map.setLanguage('zh-Hans');
      applyChineseLabels(map);
      hideAdministrativeBoundaries(map);
      map.once('idle', () => hideAdministrativeBoundaries(map));
    });
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [bootstrap.map.defaultCenter, bootstrap.map.defaultZoom, mapboxToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const sync = () => syncLoadedLayers(map, loadedLayers);
    if (map.isStyleLoaded()) {
      sync();
    } else {
      map.once('load', sync);
    }
  }, [loadedLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }
    if (spatialFilter) {
      upsertPolygonLayer(map, spatialFilterSourceId, spatialFilterFillId, spatialFilterLineId, spatialFilter.geometry, 0.16);
    } else {
      removeLayerGroup(map, spatialFilterSourceId, [spatialFilterFillId, spatialFilterLineId]);
    }
  }, [spatialFilter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    clearDrawPreview(map);
    if (!drawMode) {
      map.getCanvas().style.cursor = '';
      return;
    }

    map.getCanvas().style.cursor = 'crosshair';
    map.doubleClickZoom.disable();
    let start: [number, number] | null = null;
    let polygonPoints: Array<[number, number]> = [];

    const handleClick = (event: mapboxgl.MapMouseEvent) => {
      const point: [number, number] = [event.lngLat.lng, event.lngLat.lat];
      if (drawMode === 'polygon') {
        polygonPoints = [...polygonPoints, point];
        if (polygonPoints.length >= 2) {
          showDrawPreview(map, polygonGeometry([...polygonPoints, point]));
        }
        return;
      }
      if (!start) {
        start = point;
        return;
      }
      const geometry = geometryFromPoints(drawMode, start, point);
      showDrawPreview(map, geometry);
      onSpatialFilterChange({ mode: drawMode, geometry });
    };

    const handleMouseMove = (event: mapboxgl.MapMouseEvent) => {
      const point: [number, number] = [event.lngLat.lng, event.lngLat.lat];
      if (drawMode === 'polygon' && polygonPoints.length > 0) {
        showDrawPreview(map, polygonGeometry([...polygonPoints, point]));
      } else if (start) {
        showDrawPreview(map, geometryFromPoints(drawMode, start, point));
      }
    };

    const handleDoubleClick = (event: mapboxgl.MapMouseEvent) => {
      if (drawMode !== 'polygon' || polygonPoints.length < 3) {
        return;
      }
      event.preventDefault();
      const geometry = polygonGeometry(polygonPoints);
      showDrawPreview(map, geometry);
      onSpatialFilterChange({ mode: 'polygon', geometry });
    };

    map.on('click', handleClick);
    map.on('mousemove', handleMouseMove);
    map.on('dblclick', handleDoubleClick);

    return () => {
      map.off('click', handleClick);
      map.off('mousemove', handleMouseMove);
      map.off('dblclick', handleDoubleClick);
      map.doubleClickZoom.enable();
      map.getCanvas().style.cursor = '';
      clearDrawPreview(map);
    };
  }, [drawMode, onSpatialFilterChange]);

  function resetView() {
    mapRef.current?.flyTo({
      center: bootstrap.map.defaultCenter,
      zoom: Math.min(bootstrap.map.defaultZoom, globeOverviewZoom),
      pitch: 18,
      bearing: -12,
    });
  }

  return (
    <div className="map-shell">
      <div ref={containerRef} className="map-container" />
      <div className="map-toolbar">
        <Tooltip title="复位">
          <Button icon={<Home size={16} />} onClick={resetView} />
        </Tooltip>
        <Tooltip title="放大">
          <Button icon={<ZoomIn size={16} />} onClick={() => mapRef.current?.zoomIn()} />
        </Tooltip>
        <Tooltip title="缩小">
          <Button icon={<ZoomOut size={16} />} onClick={() => mapRef.current?.zoomOut()} />
        </Tooltip>
        <Tooltip title="北向">
          <Button icon={<RotateCcw size={16} />} onClick={() => mapRef.current?.resetNorthPitch()} />
        </Tooltip>
        <Tooltip title="定位到项目范围">
          <Button icon={<LocateFixed size={16} />} onClick={() => mapRef.current?.fitBounds([[50, 35], [100, 48]])} />
        </Tooltip>
        <Tooltip title="全屏">
          <Button icon={<Fullscreen size={16} />} onClick={() => containerRef.current?.requestFullscreen()} />
        </Tooltip>
      </div>
    </div>
  );
}

function syncLoadedLayers(map: Map, layers: LoadedLayer[]) {
  const activeIds = new Set(layers.map((layer) => sourceIdFor(layer.id)));
  const existing = (map as unknown as { __huyangLoadedSources?: Set<string> }).__huyangLoadedSources ?? new Set<string>();
  for (const sourceId of Array.from(existing)) {
    if (!activeIds.has(sourceId)) {
      removeLoadedLayerGroup(map, sourceId);
    }
  }

  for (const layer of layers) {
    const sourceId = sourceIdFor(layer.id);
    if (!layer.visible) {
      removeLoadedLayerGroup(map, sourceId);
      continue;
    }
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: layer.geojson as never,
      });
    } else {
      const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
      source.setData(layer.geojson as never);
    }
    addLoadedStyleLayers(map, sourceId, layer);
    setLoadedLayerOpacity(map, sourceId, layer.opacity / 100);
  }

  (map as unknown as { __huyangLoadedSources: Set<string> }).__huyangLoadedSources = activeIds;
}

function addLoadedStyleLayers(map: Map, sourceId: string, layer: LoadedLayer) {
  addLayerIfMissing(map, {
    id: `${sourceId}-fill`,
    type: 'fill',
    source: sourceId,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'fill-color': '#2f7d62',
      'fill-opacity': layer.opacity / 100,
    },
  });
  addLayerIfMissing(map, {
    id: `${sourceId}-line`,
    type: 'line',
    source: sourceId,
    paint: {
      'line-color': '#174f46',
      'line-width': 1.4,
      'line-opacity': layer.opacity / 100,
    },
  });
  addLayerIfMissing(map, {
    id: `${sourceId}-point`,
    type: 'circle',
    source: sourceId,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-color': '#d9a441',
      'circle-radius': 6,
      'circle-opacity': layer.opacity / 100,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.2,
    },
  });
}

function setLoadedLayerOpacity(map: Map, sourceId: string, opacity: number) {
  if (map.getLayer(`${sourceId}-fill`)) {
    map.setPaintProperty(`${sourceId}-fill`, 'fill-opacity', opacity * 0.72);
  }
  if (map.getLayer(`${sourceId}-line`)) {
    map.setPaintProperty(`${sourceId}-line`, 'line-opacity', opacity);
  }
  if (map.getLayer(`${sourceId}-point`)) {
    map.setPaintProperty(`${sourceId}-point`, 'circle-opacity', opacity);
  }
}

function showDrawPreview(map: Map, geometry: GeoJsonGeometry) {
  upsertPolygonLayer(map, previewSourceId, previewFillId, previewLineId, geometry, 0.18);
}

function clearDrawPreview(map: Map) {
  removeLayerGroup(map, previewSourceId, [previewFillId, previewLineId]);
}

function upsertPolygonLayer(
  map: Map,
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
    paint: {
      'fill-color': '#d9a441',
      'fill-opacity': fillOpacity,
    },
  });
  addLayerIfMissing(map, {
    id: lineId,
    type: 'line',
    source: sourceId,
    paint: {
      'line-color': '#d9a441',
      'line-width': 2,
      'line-opacity': 0.9,
    },
  });
}

function geometryFromPoints(mode: Exclude<DrawMode, null>, start: [number, number], end: [number, number]) {
  if (mode === 'rectangle') {
    return rectangleGeometry(start, end);
  }
  if (mode === 'circle') {
    return circleGeometry(start, end);
  }
  if (mode === 'ellipse') {
    return ellipseGeometry(start, end);
  }
  return polygonGeometry([start, end]);
}

function rectangleGeometry(start: [number, number], end: [number, number]): GeoJsonGeometry {
  const west = Math.min(start[0], end[0]);
  const east = Math.max(start[0], end[0]);
  const south = Math.min(start[1], end[1]);
  const north = Math.max(start[1], end[1]);
  return {
    type: 'Polygon',
    coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
  };
}

function circleGeometry(center: [number, number], edge: [number, number]): GeoJsonGeometry {
  const dx = edge[0] - center[0];
  const dy = edge[1] - center[1];
  const radius = Math.sqrt(dx * dx + dy * dy);
  return ellipseRing(center, radius, radius);
}

function ellipseGeometry(center: [number, number], edge: [number, number]): GeoJsonGeometry {
  return ellipseRing(center, Math.abs(edge[0] - center[0]), Math.abs(edge[1] - center[1]));
}

function ellipseRing(center: [number, number], radiusX: number, radiusY: number): GeoJsonGeometry {
  const ring: Array<[number, number]> = [];
  for (let index = 0; index <= 72; index += 1) {
    const angle = (Math.PI * 2 * index) / 72;
    ring.push([center[0] + Math.cos(angle) * radiusX, center[1] + Math.sin(angle) * radiusY]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

function polygonGeometry(points: Array<[number, number]>): GeoJsonGeometry {
  const ring = [...points];
  if (ring.length > 0) {
    ring.push(ring[0]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

function removeLoadedLayerGroup(map: Map, sourceId: string) {
  removeLayerGroup(map, sourceId, [`${sourceId}-fill`, `${sourceId}-line`, `${sourceId}-point`]);
}

function removeLayerGroup(map: Map, sourceId: string, layerIds: string[]) {
  layerIds.forEach((id) => {
    if (map.getLayer(id)) {
      map.removeLayer(id);
    }
  });
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
}

function addLayerIfMissing(map: Map, layer: mapboxgl.AnyLayer) {
  if (!map.getLayer(layer.id)) {
    map.addLayer(layer);
  }
}

function sourceIdFor(layerId: string) {
  return `loaded-${layerId}`;
}

function applyChineseLabels(map: Map) {
  const style = map.getStyle();
  for (const layer of style.layers ?? []) {
    if (layer.type !== 'symbol' || !layer.layout || !('text-field' in layer.layout)) {
      continue;
    }
    const textField = JSON.stringify(layer.layout['text-field']);
    if (!textField.includes('name')) {
      continue;
    }
    map.setLayoutProperty(layer.id, 'text-field', [
      'coalesce',
      ['get', 'name_zh-Hans'],
      ['get', 'name_zh'],
      ['get', 'name'],
      ['get', 'name_en'],
    ]);
  }
}

function hideAdministrativeBoundaries(map: Map) {
  const style = map.getStyle();
  for (const layer of style.layers ?? []) {
    const sourceLayer = 'source-layer' in layer && layer['source-layer'] ? String(layer['source-layer']) : '';
    const searchText = `${layer.id} ${sourceLayer}`.toLowerCase();
    const isBoundaryLayer =
      layer.type === 'line' && (searchText.includes('admin') || searchText.includes('boundary'));
    if (isBoundaryLayer && map.getLayer(layer.id)) {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  }
}
