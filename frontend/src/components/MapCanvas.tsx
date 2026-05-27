import { App, Button, Tooltip } from 'antd';
import { Fullscreen, Home, LocateFixed, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import mapboxgl, { Map } from 'mapbox-gl';
import { useEffect, useRef } from 'react';
import type { Bootstrap, GeoJsonGeometry, LoadedLayer, SpatialFilter } from '../types';
import type { RasterSymbolization, VectorSymbolization } from '../symbolization';

type DrawMode = SpatialFilter['mode'] | null;

interface Props {
  bootstrap: Bootstrap;
  loadedLayers: LoadedLayer[];
  drawMode: DrawMode;
  spatialFilter: SpatialFilter | null;
  onSpatialFilterChange: (filter: SpatialFilter) => void;
  onMapReady?: (map: Map) => void;
  onMapDestroy?: () => void;
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
  onMapReady,
  onMapDestroy,
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
  const renderableVectorLayers = layers.filter((layer) => layer.layerType === 'vector' && layer.geojson);
  const renderableRasterLayers = layers.filter((layer) => layer.layerType === 'raster' && (layer.pngUrl || layer.tileUrl));
  const activeIds = new Set([
    ...renderableVectorLayers.map((layer) => sourceIdFor(layer.id)),
    ...renderableRasterLayers.map((layer) => sourceIdFor(layer.id)),
  ]);
  const existing = (map as unknown as { __huyangLoadedSources?: Set<string> }).__huyangLoadedSources ?? new Set<string>();
  for (const sourceId of Array.from(existing)) {
    if (!activeIds.has(sourceId)) {
      removeLoadedLayerGroup(map, sourceId);
    }
  }

  for (const layer of renderableVectorLayers) {
    const sourceId = sourceIdFor(layer.id);
    if (!layer.visible) {
      removeLoadedLayerGroup(map, sourceId);
      continue;
    }
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: layer.geojson as never,
        generateId: true,
      });
    } else {
      const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
      source.setData(layer.geojson as never);
    }
    addLoadedStyleLayers(map, sourceId, layer);
  }

  for (const layer of renderableRasterLayers) {
    const sourceId = sourceIdFor(layer.id);
    if (!layer.visible) {
      removeLoadedLayerGroup(map, sourceId);
      continue;
    }
    addRasterLayer(map, sourceId, layer);
  }

  reorderLoadedStyleLayers(map, [...renderableVectorLayers, ...renderableRasterLayers]);
  syncVectorInteractions(map, renderableVectorLayers);
  (map as unknown as { __huyangLoadedSources: Set<string> }).__huyangLoadedSources = activeIds;
}

function addLoadedStyleLayers(map: Map, sourceId: string, layer: LoadedLayer) {
  const style = layer.symbolization as VectorSymbolization;
  const layerOpacity = clamp(style.opacity / 100, 0, 1);
  const circleOpacity = clamp(style.circle.circleOpacity * layerOpacity, 0, 1);
  const circleStrokeOpacity = clamp(style.circle.circleStrokeOpacity * layerOpacity, 0, 1);
  const symbolIconOpacity = clamp(style.symbol.iconOpacity * layerOpacity, 0, 1);
  const symbolTextOpacity = clamp(style.symbol.textOpacity * layerOpacity, 0, 1);
  const lineOpacity = clamp(style.line.lineOpacity * layerOpacity, 0, 1);
  const fillOpacity = clamp(style.fill.fillOpacity * layerOpacity, 0, 1);

  upsertLayer(map, {
    id: `${sourceId}-fill`,
    type: 'fill',
    source: sourceId,
    filter: ['==', ['geometry-type'], 'Polygon'],
    layout: {
      'fill-sort-key': style.fill.fillSortKey,
    },
    paint: {
      'fill-color': stateColor(style.fill.fillColor),
      'fill-opacity': stateNumber(fillOpacity, clamp(fillOpacity + 0.16, 0, 1), clamp(fillOpacity + 0.08, 0, 1)),
      'fill-outline-color': style.fill.fillOutlineColor,
      'fill-antialias': style.fill.fillAntialias,
      'fill-translate': style.fill.fillTranslate,
      'fill-translate-anchor': style.fill.fillTranslateAnchor,
      'fill-emissive-strength': style.fill.fillEmissiveStrength,
    },
  });
  upsertLayer(map, {
    id: `${sourceId}-line`,
    type: 'line',
    source: sourceId,
    filter: ['match', ['geometry-type'], ['LineString', 'Polygon'], true, false],
    layout: {
      'line-cap': style.line.lineCap,
      'line-join': style.line.lineJoin,
      'line-miter-limit': style.line.lineMiterLimit,
      'line-round-limit': style.line.lineRoundLimit,
    },
    paint: {
      'line-color': stateColor(style.line.lineColor),
      'line-width': stateNumber(style.line.lineWidth, style.line.lineWidth + 2, style.line.lineWidth + 1),
      'line-opacity': stateNumber(lineOpacity, clamp(lineOpacity + 0.16, 0, 1), clamp(lineOpacity + 0.08, 0, 1)),
      'line-blur': style.line.lineBlur,
      'line-offset': style.line.lineOffset,
      'line-gap-width': style.line.lineGapWidth,
      'line-dasharray': style.line.lineDasharray,
      'line-translate': style.line.lineTranslate,
      'line-translate-anchor': style.line.lineTranslateAnchor,
      'line-emissive-strength': style.line.lineEmissiveStrength,
    },
  });

  if (style.pointMode === 'circle') {
    removeStyleLayer(map, `${sourceId}-symbol`);
    upsertLayer(map, {
      id: `${sourceId}-point`,
      type: 'circle',
      source: sourceId,
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'circle-sort-key': style.circle.circleSortKey,
      },
      paint: {
        'circle-color': stateColor(style.circle.circleColor),
        'circle-radius': stateNumber(style.circle.circleRadius, style.circle.circleRadius + 3, style.circle.circleRadius + 1.8),
        'circle-blur': style.circle.circleBlur,
        'circle-opacity': stateNumber(circleOpacity, clamp(circleOpacity + 0.16, 0, 1), clamp(circleOpacity + 0.08, 0, 1)),
        'circle-pitch-alignment': style.circle.circlePitchAlignment,
        'circle-pitch-scale': style.circle.circlePitchScale,
        'circle-stroke-color': style.circle.circleStrokeColor,
        'circle-stroke-opacity': circleStrokeOpacity,
        'circle-stroke-width': stateNumber(
          style.circle.circleStrokeWidth,
          style.circle.circleStrokeWidth + 1.2,
          style.circle.circleStrokeWidth + 0.6,
        ),
        'circle-translate': style.circle.circleTranslate,
        'circle-translate-anchor': style.circle.circleTranslateAnchor,
        'circle-emissive-strength': style.circle.circleEmissiveStrength,
      },
    });
  } else {
    removeStyleLayer(map, `${sourceId}-point`);
    const symbolLayout: Record<string, unknown> = {
      'symbol-placement': style.symbol.symbolPlacement,
      'symbol-spacing': style.symbol.symbolSpacing,
      'symbol-avoid-edges': style.symbol.symbolAvoidEdges,
      'symbol-sort-key': style.symbol.symbolSortKey,
      'symbol-z-order': style.symbol.symbolZOrder,
      'icon-image': style.symbol.iconImage,
      'icon-size': style.symbol.iconSize,
      'icon-size-scale-range': style.symbol.iconSizeScaleRange,
      'icon-allow-overlap': style.symbol.iconAllowOverlap,
      'icon-ignore-placement': style.symbol.iconIgnorePlacement,
      'icon-optional': style.symbol.iconOptional,
      'icon-anchor': style.symbol.iconAnchor,
      'icon-offset': style.symbol.iconOffset,
      'icon-padding': style.symbol.iconPadding,
      'icon-keep-upright': style.symbol.iconKeepUpright,
      'icon-rotate': style.symbol.iconRotate,
      'icon-pitch-alignment': style.symbol.iconPitchAlignment,
      'icon-rotation-alignment': style.symbol.iconRotationAlignment,
      'icon-text-fit': style.symbol.iconTextFit,
      'icon-text-fit-padding': style.symbol.iconTextFitPadding,
      'text-field': style.symbol.textField,
      'text-font': style.symbol.textFont,
      'text-size': style.symbol.textSize,
      'text-max-width': style.symbol.textMaxWidth,
      'text-line-height': style.symbol.textLineHeight,
      'text-letter-spacing': style.symbol.textLetterSpacing,
      'text-justify': style.symbol.textJustify,
      'text-anchor': style.symbol.textAnchor,
      'text-offset': style.symbol.textOffset,
      'text-radial-offset': style.symbol.textRadialOffset,
      'text-writing-mode': style.symbol.textWritingMode,
      'text-padding': style.symbol.textPadding,
      'text-keep-upright': style.symbol.textKeepUpright,
      'text-allow-overlap': style.symbol.textAllowOverlap,
      'text-ignore-placement': style.symbol.textIgnorePlacement,
      'text-optional': style.symbol.textOptional,
      'text-rotate': style.symbol.textRotate,
      'text-pitch-alignment': style.symbol.textPitchAlignment,
      'text-rotation-alignment': style.symbol.textRotationAlignment,
      'text-transform': style.symbol.textTransform,
    };
    if (style.symbol.textVariableAnchor.length > 0) {
      symbolLayout['text-variable-anchor'] = style.symbol.textVariableAnchor;
    }
    upsertLayer(map, {
      id: `${sourceId}-symbol`,
      type: 'symbol',
      source: sourceId,
      filter: ['==', ['geometry-type'], 'Point'],
      layout: symbolLayout,
      paint: {
        'icon-color': stateColor(style.symbol.iconColor),
        'icon-opacity': stateNumber(symbolIconOpacity, clamp(symbolIconOpacity + 0.16, 0, 1), clamp(symbolIconOpacity + 0.08, 0, 1)),
        'icon-halo-color': style.symbol.iconHaloColor,
        'icon-halo-width': style.symbol.iconHaloWidth,
        'icon-halo-blur': style.symbol.iconHaloBlur,
        'icon-translate': style.symbol.iconTranslate,
        'icon-translate-anchor': style.symbol.iconTranslateAnchor,
        'icon-emissive-strength': style.symbol.iconEmissiveStrength,
        'icon-color-brightness-min': style.symbol.iconColorBrightnessMin,
        'icon-color-brightness-max': style.symbol.iconColorBrightnessMax,
        'icon-color-contrast': style.symbol.iconColorContrast,
        'icon-color-saturation': style.symbol.iconColorSaturation,
        'icon-occlusion-opacity': style.symbol.iconOcclusionOpacity,
        'text-color': stateColor(style.symbol.textColor),
        'text-opacity': stateNumber(symbolTextOpacity, clamp(symbolTextOpacity + 0.16, 0, 1), clamp(symbolTextOpacity + 0.08, 0, 1)),
        'text-halo-color': style.symbol.textHaloColor,
        'text-halo-width': style.symbol.textHaloWidth,
        'text-halo-blur': style.symbol.textHaloBlur,
        'text-translate': style.symbol.textTranslate,
        'text-translate-anchor': style.symbol.textTranslateAnchor,
        'text-emissive-strength': style.symbol.textEmissiveStrength,
        'text-occlusion-opacity': style.symbol.textOcclusionOpacity,
      },
    });
  }
}

function addRasterLayer(map: Map, sourceId: string, layer: LoadedLayer) {
  const style = layer.symbolization as RasterSymbolization;
  const layerId = `${sourceId}-raster`;
  const key = rasterSourceKey(layer);
  const state = map as unknown as HuyangMapState;
  if (!state.__huyangRasterSourceKeys) {
    state.__huyangRasterSourceKeys = new globalThis.Map();
  }
  if (state.__huyangRasterSourceKeys.get(sourceId) !== key) {
    removeLoadedLayerGroup(map, sourceId);
    if (layer.tileUrl) {
      map.addSource(sourceId, {
        type: 'raster',
        tiles: [layer.tileUrl],
        tileSize: 256,
      });
    } else if (layer.pngUrl && layer.imageCoordinates?.length === 4) {
      const coordinates = layer.imageCoordinates as [[number, number], [number, number], [number, number], [number, number]];
      map.addSource(sourceId, {
        type: 'image',
        url: layer.pngUrl,
        coordinates,
      });
    }
    state.__huyangRasterSourceKeys.set(sourceId, key);
  }
  if (!map.getSource(sourceId)) {
    return;
  }
  upsertLayer(map, {
    id: layerId,
    type: 'raster',
    source: sourceId,
    paint: {
      'raster-opacity': clamp(style.opacity / 100, 0, 1),
    },
  });
}

function reorderLoadedStyleLayers(map: Map, layers: LoadedLayer[]) {
  for (const layer of [...layers].reverse()) {
    const sourceId = sourceIdFor(layer.id);
    for (const styleLayerId of [`${sourceId}-raster`, `${sourceId}-fill`, `${sourceId}-line`, `${sourceId}-point`, `${sourceId}-symbol`]) {
      if (map.getLayer(styleLayerId)) {
        map.moveLayer(styleLayerId);
      }
    }
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
  removeLayerGroup(map, sourceId, [`${sourceId}-raster`, `${sourceId}-fill`, `${sourceId}-line`, `${sourceId}-point`, `${sourceId}-symbol`]);
}

function removeLayerGroup(map: Map, sourceId: string, layerIds: string[]) {
  layerIds.forEach((id) => {
    removeVectorInteraction(map, id);
    if (map.getLayer(id)) {
      map.removeLayer(id);
    }
  });
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
  const state = map as unknown as HuyangMapState;
  state.__huyangRasterSourceKeys?.delete(sourceId);
}

function removeStyleLayer(map: Map, layerId: string) {
  removeVectorInteraction(map, layerId);
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
}

function addLayerIfMissing(map: Map, layer: mapboxgl.AnyLayer) {
  if (!map.getLayer(layer.id)) {
    map.addLayer(layer);
  }
}

function upsertLayer(map: Map, layer: mapboxgl.AnyLayer) {
  const existing = map.getLayer(layer.id);
  if (existing && existing.type !== layer.type) {
    removeStyleLayer(map, layer.id);
  }
  if (!map.getLayer(layer.id)) {
    map.addLayer(layer);
    return;
  }
  if ('filter' in layer) {
    map.setFilter(layer.id, layer.filter);
  }
  const writableMap = map as unknown as {
    setLayoutProperty: (layerId: string, property: string, value: unknown) => void;
    setPaintProperty: (layerId: string, property: string, value: unknown) => void;
  };
  for (const [property, value] of Object.entries(layer.layout ?? {})) {
    writableMap.setLayoutProperty(layer.id, property, value);
  }
  for (const [property, value] of Object.entries(layer.paint ?? {})) {
    writableMap.setPaintProperty(layer.id, property, value);
  }
}

function stateColor(baseColor: string) {
  return [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    '#e4582b',
    ['boolean', ['feature-state', 'highlight'], false],
    '#f2c36d',
    baseColor,
  ] as unknown as mapboxgl.ExpressionSpecification;
}

function stateNumber(base: number, selected: number, highlight: number) {
  return [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    selected,
    ['boolean', ['feature-state', 'highlight'], false],
    highlight,
    base,
  ] as unknown as mapboxgl.ExpressionSpecification;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

interface FeatureStateTarget {
  source: string;
  id: string | number;
}

interface VectorInteractionHandlers {
  click: (event: mapboxgl.MapLayerMouseEvent) => void;
  mousemove: (event: mapboxgl.MapLayerMouseEvent) => void;
  mouseleave: () => void;
}

interface HuyangMapState {
  __huyangInteractiveHandlers?: globalThis.Map<string, VectorInteractionHandlers>;
  __huyangHoveredFeature?: FeatureStateTarget;
  __huyangSelectedFeature?: FeatureStateTarget;
  __huyangPopup?: mapboxgl.Popup;
  __huyangRasterSourceKeys?: globalThis.Map<string, string>;
}

function syncVectorInteractions(map: Map, layers: LoadedLayer[]) {
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

  const handlers = getInteractionHandlers(map);
  for (const layerId of Array.from(handlers.keys())) {
    if (!activeLayerIds.has(layerId)) {
      removeVectorInteraction(map, layerId);
    }
  }
}

function addVectorInteraction(map: Map, layerId: string) {
  const handlers = getInteractionHandlers(map);
  if (handlers.has(layerId)) {
    return;
  }

  const click = (event: mapboxgl.MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) {
      return;
    }
    event.preventDefault();
    clearFeatureState(map, '__huyangSelectedFeature', 'selected');
    const target = featureStateTarget(feature);
    if (target) {
      map.setFeatureState(target, { selected: true });
      (map as unknown as HuyangMapState).__huyangSelectedFeature = target;
    }
    showFeaturePopup(map, event.lngLat, feature.properties ?? {});
  };

  const mousemove = (event: mapboxgl.MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    map.getCanvas().style.cursor = feature ? 'pointer' : '';
    const target = feature ? featureStateTarget(feature) : null;
    const current = (map as unknown as HuyangMapState).__huyangHoveredFeature;
    if (current && (!target || current.source !== target.source || current.id !== target.id)) {
      map.setFeatureState(current, { highlight: false });
      (map as unknown as HuyangMapState).__huyangHoveredFeature = undefined;
    }
    if (target && (!current || current.source !== target.source || current.id !== target.id)) {
      map.setFeatureState(target, { highlight: true });
      (map as unknown as HuyangMapState).__huyangHoveredFeature = target;
    }
  };

  const mouseleave = () => {
    map.getCanvas().style.cursor = '';
    clearFeatureState(map, '__huyangHoveredFeature', 'highlight');
  };

  map.on('click', layerId, click);
  map.on('mousemove', layerId, mousemove);
  map.on('mouseleave', layerId, mouseleave);
  handlers.set(layerId, { click, mousemove, mouseleave });
}

function removeVectorInteraction(map: Map, layerId: string) {
  const handlers = getInteractionHandlers(map);
  const handler = handlers.get(layerId);
  if (!handler) {
    return;
  }
  map.off('click', layerId, handler.click);
  map.off('mousemove', layerId, handler.mousemove);
  map.off('mouseleave', layerId, handler.mouseleave);
  handlers.delete(layerId);
}

function getInteractionHandlers(map: Map) {
  const state = map as unknown as HuyangMapState;
  if (!state.__huyangInteractiveHandlers) {
    state.__huyangInteractiveHandlers = new globalThis.Map();
  }
  return state.__huyangInteractiveHandlers;
}

function clearFeatureState(map: Map, key: '__huyangHoveredFeature' | '__huyangSelectedFeature', stateName: string) {
  const state = map as unknown as HuyangMapState;
  const target = state[key];
  if (!target || !map.getSource(target.source)) {
    state[key] = undefined;
    return;
  }
  map.setFeatureState(target, { [stateName]: false });
  state[key] = undefined;
}

function featureStateTarget(feature: mapboxgl.MapboxGeoJSONFeature): FeatureStateTarget | null {
  if (feature.id === undefined || !feature.source) {
    return null;
  }
  return { source: feature.source, id: feature.id };
}

function showFeaturePopup(map: Map, lngLat: mapboxgl.LngLat, properties: Record<string, unknown> | null) {
  const state = map as unknown as HuyangMapState;
  state.__huyangPopup?.remove();
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
  state.__huyangPopup = new mapboxgl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '360px' })
    .setLngLat(lngLat)
    .setDOMContent(container)
    .addTo(map);
}

function sourceIdFor(layerId: string) {
  return `loaded-${layerId}`;
}

function rasterSourceKey(layer: LoadedLayer) {
  return JSON.stringify({
    pngUrl: layer.pngUrl,
    tileUrl: layer.tileUrl,
    imageCoordinates: layer.imageCoordinates,
  });
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
