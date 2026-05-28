import { App, Button, Tooltip } from 'antd';
import { Fullscreen, Home, LocateFixed, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import mapboxgl, { Map } from 'mapbox-gl';
import { useEffect, useRef } from 'react';
import type { Bootstrap, LoadedLayer, LoadedRasterLayer, LoadedVectorLayer, SpatialFilter } from '../types';
import { sourceIdFor } from '../utils/geometry';
import { addLoadedStyleLayers, removeLoadedLayerGroup, reorderLoadedStyleLayers } from '../map/vectorLayerSync';
import { addRasterLayer } from '../map/rasterLayerSync';
import { syncVectorInteractions } from '../map/featureInteraction';
import { showDrawPreview, clearDrawPreview, upsertPolygonLayer, removeLayerGroupSimple } from '../map/spatialDraw';
import { geometryFromPoints } from '../utils/geometry';

type DrawMode = SpatialFilter['mode'] | null;

const mapStyle = 'mapbox://styles/mapbox/satellite-streets-v12';
const globeOverviewZoom = 2.4;
const spatialFilterSourceId = 'query-spatial-filter';
const spatialFilterFillId = 'query-spatial-filter-fill';
const spatialFilterLineId = 'query-spatial-filter-line';

interface Props {
  bootstrap: Bootstrap;
  loadedLayers: LoadedLayer[];
  drawMode: DrawMode;
  spatialFilter: SpatialFilter | null;
  onSpatialFilterChange: (filter: SpatialFilter) => void;
  onMapReady?: (map: Map) => void;
  onMapDestroy?: () => void;
}

export default function MapCanvas({
  bootstrap,
  loadedLayers,
  drawMode,
  spatialFilter,
  onSpatialFilterChange,
  onMapReady,
  onMapDestroy,
}: Props) {
  const mapRef = useRef<Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapboxToken = bootstrap.map.mapboxAccessToken;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
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
      attributionControl: false,
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
    onMapReady?.(map);

    return () => {
      onMapDestroy?.();
      map.remove();
      mapRef.current = null;
    };
  }, [bootstrap.map.defaultCenter, bootstrap.map.defaultZoom, mapboxToken, onMapDestroy, onMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sync = () => syncLoadedLayers(map, loadedLayers);
    if (map.isStyleLoaded()) sync();
    else map.once('load', sync);
  }, [loadedLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (spatialFilter) {
      upsertPolygonLayer(map, spatialFilterSourceId, spatialFilterFillId, spatialFilterLineId, spatialFilter.geometry, 0.16);
    } else {
      removeLayerGroupSimple(map, spatialFilterSourceId, [spatialFilterFillId, spatialFilterLineId]);
    }
  }, [spatialFilter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
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
        if (polygonPoints.length >= 2) showDrawPreview(map, geometryFromPoints('polygon', polygonPoints[0], polygonPoints[1]));
        return;
      }
      if (!start) { start = point; return; }
      const geometry = geometryFromPoints(drawMode, start, point);
      showDrawPreview(map, geometry);
      onSpatialFilterChange({ mode: drawMode, geometry });
    };

    const handleMouseMove = (event: mapboxgl.MapMouseEvent) => {
      const point: [number, number] = [event.lngLat.lng, event.lngLat.lat];
      if (drawMode === 'polygon' && polygonPoints.length > 0) {
        showDrawPreview(map, { type: 'Polygon', coordinates: [[...polygonPoints, point, polygonPoints[0]]] });
      } else if (start) {
        showDrawPreview(map, geometryFromPoints(drawMode, start, point));
      }
    };

    const handleDoubleClick = (event: mapboxgl.MapMouseEvent) => {
      if (drawMode !== 'polygon' || polygonPoints.length < 3) return;
      event.preventDefault();
      const geometry = { type: 'Polygon', coordinates: [polygonPoints] } as import('../types').GeoJsonGeometry;
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
      pitch: 18, bearing: -12,
    });
  }

  return (
    <div className="map-shell">
      <div ref={containerRef} className="map-container" />
      <div className="map-toolbar">
        <Tooltip title="复位"><Button icon={<Home size={16} />} onClick={resetView} /></Tooltip>
        <Tooltip title="放大"><Button icon={<ZoomIn size={16} />} onClick={() => mapRef.current?.zoomIn()} /></Tooltip>
        <Tooltip title="缩小"><Button icon={<ZoomOut size={16} />} onClick={() => mapRef.current?.zoomOut()} /></Tooltip>
        <Tooltip title="北向"><Button icon={<RotateCcw size={16} />} onClick={() => mapRef.current?.resetNorthPitch()} /></Tooltip>
        <Tooltip title="定位到项目范围"><Button icon={<LocateFixed size={16} />} onClick={() => mapRef.current?.fitBounds([[50, 35], [100, 48]])} /></Tooltip>
        <Tooltip title="全屏"><Button icon={<Fullscreen size={16} />} onClick={() => containerRef.current?.requestFullscreen()} /></Tooltip>
      </div>
    </div>
  );
}

function syncLoadedLayers(map: Map, layers: LoadedLayer[]) {
  const renderableVectorLayers = layers.filter((l): l is LoadedVectorLayer => l.layerType === 'vector' && 'geojson' in l);
  const renderableRasterLayers = layers.filter((l): l is LoadedRasterLayer => l.layerType === 'raster' && Boolean(l.tileUrl));
  const activeIds = new Set([
    ...renderableVectorLayers.map((l) => sourceIdFor(l.id)),
    ...renderableRasterLayers.map((l) => sourceIdFor(l.id)),
  ]);

  const existing = (map as unknown as { __loadedSources?: Set<string> }).__loadedSources ?? new Set<string>();
  for (const sourceId of Array.from(existing)) {
    if (!activeIds.has(sourceId)) removeLoadedLayerGroup(map, sourceId);
  }

  for (const layer of renderableVectorLayers) {
    const sourceId = sourceIdFor(layer.id);
    if (!layer.visible) { removeLoadedLayerGroup(map, sourceId); continue; }
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data: layer.geojson as never, generateId: true });
    } else {
      (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(layer.geojson as never);
    }
    addLoadedStyleLayers(map, sourceId, layer);
  }

  for (const layer of renderableRasterLayers) {
    const sourceId = sourceIdFor(layer.id);
    if (!layer.visible) { removeLoadedLayerGroup(map, sourceId); continue; }
    addRasterLayer(map, sourceId, layer);
  }

  reorderLoadedStyleLayers(map, [...renderableVectorLayers, ...renderableRasterLayers]);
  syncVectorInteractions(map, renderableVectorLayers);
  (map as unknown as { __loadedSources: Set<string> }).__loadedSources = activeIds;
}

function applyChineseLabels(map: Map) {
  const style = map.getStyle();
  for (const layer of style.layers ?? []) {
    if (layer.type !== 'symbol' || !layer.layout || !('text-field' in layer.layout)) continue;
    const textField = JSON.stringify(layer.layout['text-field']);
    if (!textField.includes('name')) continue;
    map.setLayoutProperty(layer.id, 'text-field', [
      'coalesce', ['get', 'name_zh-Hans'], ['get', 'name_zh'], ['get', 'name'], ['get', 'name_en'],
    ]);
  }
}

function hideAdministrativeBoundaries(map: Map) {
  const style = map.getStyle();
  for (const layer of style.layers ?? []) {
    const sourceLayer = 'source-layer' in layer && layer['source-layer'] ? String(layer['source-layer']) : '';
    const searchText = `${layer.id} ${sourceLayer}`.toLowerCase();
    const isBoundaryLayer = layer.type === 'line' && (searchText.includes('admin') || searchText.includes('boundary'));
    if (isBoundaryLayer && map.getLayer(layer.id)) {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  }
}
