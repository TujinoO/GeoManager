import {
  FullscreenOutlined,
  HomeOutlined,
  RotateLeftOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import mapboxgl, {
  type GeoJSONSource,
  LngLatBounds,
  type Map as MapboxMap,
  type MapboxOptions,
} from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";
import {
  applyChineseBasemapLanguage,
  createBasemapStyle,
  mapLabelLanguage,
  shouldUseMapboxBasemap,
} from "../map/basemapStyle";
import { syncVectorInteractions } from "../map/featureInteraction";
import { addRasterLayer } from "../map/rasterLayerSync";
import {
  bindGeometryDraw,
  type DrawMode,
  upsertPolygonLayer,
} from "../map/spatialDraw";
import {
  addLoadedStyleLayers,
  removeLayerGroup,
  removeLoadedLayerGroup,
  reorderLoadedStyleLayers,
} from "../map/vectorLayerSync";
import { fitBoundsOptions, readMapViewState } from "../map/mapViewport";
import { getMapState } from "../map/mapState";
import type {
  Bootstrap,
  FeatureInfo,
  GeoJsonGeometry,
  LoadedLayer,
  LoadedRasterLayer,
  LoadedVectorLayer,
  MapViewState,
  SpatialFilter,
} from "../types";
import {
  boundsFromImageCoordinates,
  combinedFeatureBounds,
  normalizeDisplayLngLat,
  sourceIdFor,
} from "../utils/geometry";

const spatialFilterSourceId = "query-spatial-filter";
const spatialFilterFillId = "query-spatial-filter-fill";
const spatialFilterLineId = "query-spatial-filter-line";
const layerExtentSourceId = "selected-layer-extent";
const layerExtentFillId = "selected-layer-extent-fill";
const layerExtentLineId = "selected-layer-extent-line";
const spatialRangeStyle = {
  fillColor: "#ef4444",
  fillOpacity: 0.16,
  lineColor: "#ef4444",
  lineOpacity: 0.95,
  lineWidth: 2,
};
const layerExtentStyle = {
  fillColor: "#000000",
  fillOpacity: 0.16,
  lineColor: "#000000",
  lineOpacity: 1,
  lineWidth: 2,
};

disableMapboxEventRequests();

interface Props {
  bootstrap: Bootstrap;
  loadedLayers: LoadedLayer[];
  drawMode: DrawMode | null;
  spatialFilter: SpatialFilter | null;
  layerExtentGeometry: GeoJsonGeometry | null;
  layerExtentTargetLayer: LoadedLayer | null;
  onDrawComplete: (mode: DrawMode, geometry: GeoJsonGeometry) => void;
  onFeatureSelect?: (feature: FeatureInfo | null) => void;
  onMapReady?: (map: MapboxMap) => void;
  onMapDestroy?: () => void;
  onViewStateChange?: (view: MapViewState) => void;
}

export default function MapCanvas({
  bootstrap,
  loadedLayers,
  drawMode,
  spatialFilter,
  layerExtentGeometry,
  layerExtentTargetLayer,
  onDrawComplete,
  onFeatureSelect,
  onMapReady,
  onMapDestroy,
  onViewStateChange,
}: Props) {
  const mapRef = useRef<MapboxMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const coordinatePanelRef = useRef<HTMLDivElement | null>(null);
  const pointerUpdateFrameRef = useRef<number | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const mapConfig = bootstrap.map;
  const mapboxToken = mapConfig.mapboxAccessToken;
  const shouldUseMapboxStyle = shouldUseMapboxBasemap(mapConfig);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const mapOptions: MapboxOptions = {
      container: containerRef.current,
      style: createBasemapStyle(mapConfig),
      center: mapConfig.defaultCenter,
      zoom: mapConfig.defaultZoom,
      pitch: 18,
      bearing: -12,
      projection: "globe",
      language: mapLabelLanguage,
      localIdeographFontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      attributionControl: false,
      performanceMetricsCollection: false,
    };
    if (mapboxToken) {
      mapOptions.accessToken = mapboxToken;
    }
    const map = new mapboxgl.Map(mapOptions);
    map.on("style.load", () => {
      map.setFog({
        color: "rgb(221, 232, 224)",
        "high-color": "rgb(52, 96, 123)",
        "horizon-blend": 0.08,
        "space-color": "rgb(8, 20, 28)",
        "star-intensity": 0.22,
      });
      if (shouldUseMapboxStyle) {
        applyChineseBasemapLanguage(map);
        hideAdministrativeBoundaries(map);
        map.once("idle", () => hideAdministrativeBoundaries(map));
      }
    });
    map.addControl(
      new mapboxgl.ScaleControl({ unit: "metric" }),
      "bottom-left",
    );
    const updatePointerPanel = (lngLat: [number, number] | null) => {
      if (pointerUpdateFrameRef.current !== null) {
        window.cancelAnimationFrame(pointerUpdateFrameRef.current);
      }
      pointerUpdateFrameRef.current = window.requestAnimationFrame(() => {
        pointerUpdateFrameRef.current = null;
        const panel = coordinatePanelRef.current;
        if (!panel) return;
        panel.textContent = lngLat
          ? `经度 ${lngLat[0].toFixed(4)}  纬度 ${lngLat[1].toFixed(4)}`
          : "经纬度 --";
      });
    };
    const updatePointer = (event: mapboxgl.MapMouseEvent) => {
      updatePointerPanel(
        map.isPointOnSurface(event.point)
          ? normalizeDisplayLngLat(event.lngLat)
          : null,
      );
    };
    const clearPointer = () => updatePointerPanel(null);
    map.on("mousemove", updatePointer);
    map.on("mouseleave", clearPointer);
    const emitViewState = () => {
      onViewStateChange?.(readMapViewState(map));
    };
    const resizeAndEmitViewState = () => {
      if (resizeFrameRef.current !== null) {
        return;
      }
      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        map.resize();
        emitViewState();
      });
    };
    map.on("load", emitViewState);
    map.on("moveend", emitViewState);
    map.on("zoomend", emitViewState);
    map.on("rotateend", emitViewState);
    map.on("pitchend", emitViewState);
    window.addEventListener("resize", resizeAndEmitViewState);
    emitViewState();
    mapRef.current = map;
    onMapReady?.(map);

    return () => {
      map.off("load", emitViewState);
      map.off("moveend", emitViewState);
      map.off("zoomend", emitViewState);
      map.off("rotateend", emitViewState);
      map.off("pitchend", emitViewState);
      window.removeEventListener("resize", resizeAndEmitViewState);
      map.off("mousemove", updatePointer);
      map.off("mouseleave", clearPointer);
      if (pointerUpdateFrameRef.current !== null) {
        window.cancelAnimationFrame(pointerUpdateFrameRef.current);
        pointerUpdateFrameRef.current = null;
      }
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      onMapDestroy?.();
      map.remove();
      mapRef.current = null;
    };
  }, [
    mapConfig,
    mapboxToken,
    onMapDestroy,
    onMapReady,
    onViewStateChange,
    shouldUseMapboxStyle,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sync = () => syncLoadedLayers(map, loadedLayers, onFeatureSelect);
    if (map.isStyleLoaded()) sync();
    else map.once("load", sync);
  }, [loadedLayers, onFeatureSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    if (spatialFilter) {
      upsertPolygonLayer(
        map,
        spatialFilterSourceId,
        spatialFilterFillId,
        spatialFilterLineId,
        spatialFilter.geometry,
        spatialRangeStyle,
      );
    } else {
      removeLayerGroup(
        map,
        spatialFilterSourceId,
        [spatialFilterFillId, spatialFilterLineId],
        { cleanInteraction: false },
      );
    }
  }, [spatialFilter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    if (layerExtentGeometry) {
      const beforeId = layerExtentTargetLayer
        ? firstStyleLayerIdForLayer(map, layerExtentTargetLayer)
        : undefined;
      upsertPolygonLayer(
        map,
        layerExtentSourceId,
        layerExtentFillId,
        layerExtentLineId,
        layerExtentGeometry,
        { ...layerExtentStyle, beforeId },
      );
    } else {
      removeLayerGroup(
        map,
        layerExtentSourceId,
        [layerExtentFillId, layerExtentLineId],
        { cleanInteraction: false },
      );
    }
  }, [layerExtentGeometry, layerExtentTargetLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !drawMode) return;
    return bindGeometryDraw(map, drawMode, (geometry) =>
      onDrawComplete(drawMode, geometry),
    );
  }, [drawMode, onDrawComplete]);

  function resetView() {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(
      [
        [50, 35],
        [100, 48],
      ],
      fitBoundsOptions(),
    );
  }

  return (
    <div className="map-shell">
      <div ref={containerRef} className="map-container" />
      <div className="map-toolbar">
        <div
          ref={coordinatePanelRef}
          className="map-coordinate-panel"
          role="status"
          aria-label="鼠标位置经纬度"
        >
          经纬度 --
        </div>
        <Tooltip title="复位到项目范围">
          <Button
            icon={<HomeOutlined style={{ fontSize: 16 }} />}
            onClick={resetView}
          />
        </Tooltip>
        <Tooltip title="放大">
          <Button
            icon={<ZoomInOutlined style={{ fontSize: 16 }} />}
            onClick={() => mapRef.current?.zoomIn()}
          />
        </Tooltip>
        <Tooltip title="缩小">
          <Button
            icon={<ZoomOutOutlined style={{ fontSize: 16 }} />}
            onClick={() => mapRef.current?.zoomOut()}
          />
        </Tooltip>
        <Tooltip title="北向">
          <Button
            icon={<RotateLeftOutlined style={{ fontSize: 16 }} />}
            onClick={() => mapRef.current?.resetNorthPitch()}
          />
        </Tooltip>
        <Tooltip title="全屏">
          <Button
            icon={<FullscreenOutlined style={{ fontSize: 16 }} />}
            onClick={() => containerRef.current?.requestFullscreen()}
          />
        </Tooltip>
      </div>
    </div>
  );
}

function disableMapboxEventRequests() {
  const descriptor = Object.getOwnPropertyDescriptor(
    mapboxgl.config,
    "EVENTS_URL",
  );
  if (descriptor?.value === null) return;
  Object.defineProperty(mapboxgl.config, "EVENTS_URL", {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    value: null,
  });
}

function firstStyleLayerIdForLayer(map: MapboxMap, layer: LoadedLayer) {
  const sourceId = sourceIdFor(layer.id);
  const candidates =
    layer.layerType === "raster"
      ? [`${sourceId}-raster`]
      : [
          `${sourceId}-fill`,
          `${sourceId}-line`,
          `${sourceId}-heatmap`,
          `${sourceId}-point`,
          `${sourceId}-symbol`,
        ];
  return candidates.find((id) => map.getLayer(id));
}

function syncLoadedLayers(
  map: MapboxMap,
  layers: LoadedLayer[],
  onFeatureSelect?: (feature: FeatureInfo | null) => void,
) {
  const renderableVectorLayers = layers.filter(
    (l): l is LoadedVectorLayer => l.layerType === "vector" && "geojson" in l,
  );
  const renderableRasterLayers = layers.filter(
    (l): l is LoadedRasterLayer =>
      l.layerType === "raster" && Boolean(l.tileUrl),
  );
  const activeIds = new Set([
    ...renderableVectorLayers.map((l) => sourceIdFor(l.id)),
    ...renderableRasterLayers.map((l) => sourceIdFor(l.id)),
  ]);

  const state = getMapState(map);
  for (const sourceId of state.loadedSourceIds) {
    if (!activeIds.has(sourceId)) {
      removeLoadedLayerGroup(map, sourceId);
      state.sourceDataRefs.delete(sourceId);
    }
  }

  const newVectorBounds: LngLatBounds[] = [];
  for (const layer of renderableVectorLayers) {
    const sourceId = sourceIdFor(layer.id);
    if (!layer.visible) {
      removeLoadedLayerGroup(map, sourceId);
      continue;
    }
    const isNew = !map.getSource(sourceId);
    if (isNew) {
      map.addSource(sourceId, {
        type: "geojson",
        data: layer.geojson as never,
        generateId: true,
      });
      state.sourceDataRefs.set(sourceId, layer.geojson);
      const bounds = combinedFeatureBounds([layer.geojson]);
      if (bounds) newVectorBounds.push(bounds);
    } else if (state.sourceDataRefs.get(sourceId) !== layer.geojson) {
      (map.getSource(sourceId) as GeoJSONSource).setData(
        layer.geojson as never,
      );
      state.sourceDataRefs.set(sourceId, layer.geojson);
    }
    addLoadedStyleLayers(map, sourceId, layer);
  }

  const newRasterBounds: LngLatBounds[] = [];
  for (const layer of renderableRasterLayers) {
    const sourceId = sourceIdFor(layer.id);
    if (!layer.visible) {
      removeLoadedLayerGroup(map, sourceId);
      continue;
    }
    const isNew = !map.getSource(sourceId);
    if (isNew && layer.imageCoordinates) {
      const bounds = boundsFromImageCoordinates(layer.imageCoordinates);
      if (bounds) newRasterBounds.push(bounds);
    }
    addRasterLayer(map, sourceId, layer);
  }

  const allNewBounds = [...newVectorBounds, ...newRasterBounds];
  if (allNewBounds.length > 0) {
    const firstBound = allNewBounds[0];
    if (!firstBound) return;
    const combined = allNewBounds.reduce(
      (b, next) => b.extend(next),
      new LngLatBounds(firstBound.getSouthWest(), firstBound.getNorthEast()),
    );
    map.fitBounds(combined, fitBoundsOptions(80));
  }

  reorderLoadedStyleLayers(map, [
    ...renderableVectorLayers,
    ...renderableRasterLayers,
  ]);
  syncVectorInteractions(map, renderableVectorLayers, onFeatureSelect);
  state.loadedSourceIds = activeIds;
}

function hideAdministrativeBoundaries(map: MapboxMap) {
  const style = map.getStyle();
  for (const layer of style.layers ?? []) {
    const sourceLayer =
      "source-layer" in layer && layer["source-layer"]
        ? String(layer["source-layer"])
        : "";
    const searchText = `${layer.id} ${sourceLayer}`.toLowerCase();
    const isBoundaryLayer =
      layer.type === "line" &&
      (searchText.includes("admin") || searchText.includes("boundary"));
    if (isBoundaryLayer && map.getLayer(layer.id)) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  }
}
