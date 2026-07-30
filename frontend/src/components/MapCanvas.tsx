import {
  FullscreenOutlined,
  HomeOutlined,
  RotateLeftOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import mapboxgl, { type Map as MapboxMap, type MapboxOptions } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import BasemapStatusIndicator from "./BasemapStatusIndicator";
import {
  applyBasemapExpressionSafety,
  applyChineseBasemapLanguage,
  applySatelliteBasemapColorCorrection,
  createBasemapStyle,
  isOsmRasterTileError,
  mapLabelLanguage,
  shouldUseMapboxBasemap,
} from "../map/basemapStyle";
import { syncLoadedLayers } from "../map/loadedLayerSync";
import {
  bindGeometryDraw,
  type DrawMode,
  upsertPolygonLayer,
} from "../map/spatialDraw";
import {
  bindPlatformSymbolImageFallback,
  registerPlatformSymbolImages,
} from "../map/symbolImages";
import { removeLayerGroup } from "../map/vectorLayerSync";
import { fitBoundsOptions, readMapViewState } from "../map/mapViewport";
import type {
  Bootstrap,
  FeatureInfo,
  GeoJsonGeometry,
  LoadedLayer,
  MapViewState,
  SpatialFilter,
} from "../types";
import { normalizeDisplayLngLat, sourceIdFor } from "../utils/geometry";

const spatialFilterSourceId = "query-spatial-filter";
const spatialFilterFillId = "query-spatial-filter-fill";
const spatialFilterLineId = "query-spatial-filter-line";
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

export interface LayerExtentOverlay {
  layer: LoadedLayer;
  geometry: GeoJsonGeometry;
}

disableMapboxEventRequests();

interface Props {
  bootstrap: Bootstrap;
  loadedLayers: LoadedLayer[];
  drawMode: DrawMode | null;
  spatialFilter: SpatialFilter | null;
  layerExtentOverlays: LayerExtentOverlay[];
  onDrawComplete: (mode: DrawMode, geometry: GeoJsonGeometry) => void;
  onFeatureSelect?: (feature: FeatureInfo | null) => void;
  onMapReady?: (map: MapboxMap) => void;
  onMapDestroy?: () => void;
  onMapError?: (message: string) => void;
  onViewStateChange?: (view: MapViewState) => void;
}

export default function MapCanvas({
  bootstrap,
  loadedLayers,
  drawMode,
  spatialFilter,
  layerExtentOverlays,
  onDrawComplete,
  onFeatureSelect,
  onMapReady,
  onMapDestroy,
  onMapError,
  onViewStateChange,
}: Props) {
  const mapRef = useRef<MapboxMap | null>(null);
  const [mapObject, setMapObject] = useState<MapboxMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const coordinatePanelRef = useRef<HTMLDivElement | null>(null);
  const pointerUpdateFrameRef = useRef<number | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const activeLayerExtentSourceIdsRef = useRef<Set<string>>(new Set());
  const styleInitializedRef = useRef(false);
  const latestLoadedLayersRef = useRef(loadedLayers);
  const latestOnFeatureSelectRef = useRef(onFeatureSelect);
  latestLoadedLayersRef.current = loadedLayers;
  latestOnFeatureSelectRef.current = onFeatureSelect;
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
      pitch: 0,
      bearing: 0,
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
    const unbindPlatformSymbolImageFallback =
      bindPlatformSymbolImageFallback(map);
    const handleStyleLoad = () => {
      applyBasemapExpressionSafety(map);
      registerPlatformSymbolImages(map);
      map.setFog({
        color: "rgb(221, 232, 224)",
        "high-color": "rgb(52, 96, 123)",
        "horizon-blend": 0.08,
        "space-color": "rgb(8, 20, 28)",
        "star-intensity": 0.22,
      });
      if (shouldUseMapboxStyle) {
        applySatelliteBasemapColorCorrection(map);
        applyChineseBasemapLanguage(map);
        hideAdministrativeBoundaries(map);
        map.once("idle", () => hideAdministrativeBoundaries(map));
      }
      styleInitializedRef.current = true;
      syncLoadedLayers(
        map,
        latestLoadedLayersRef.current,
        latestOnFeatureSelectRef.current,
      );
    };
    map.on("style.load", handleStyleLoad);
    const handleMapError = (event: { error?: unknown }) => {
      if (isOsmRasterTileError(event)) {
        return;
      }
      onMapError?.(mapboxErrorMessage(event.error));
    };
    map.on("error", handleMapError);
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
    setMapObject(map);
    onMapReady?.(map);

    return () => {
      map.off("load", emitViewState);
      map.off("moveend", emitViewState);
      map.off("zoomend", emitViewState);
      map.off("rotateend", emitViewState);
      map.off("pitchend", emitViewState);
      map.off("style.load", handleStyleLoad);
      map.off("error", handleMapError);
      unbindPlatformSymbolImageFallback();
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
      styleInitializedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, [
    mapConfig,
    mapboxToken,
    onMapDestroy,
    onMapError,
    onMapReady,
    onViewStateChange,
    shouldUseMapboxStyle,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleInitializedRef.current) return;
    syncLoadedLayers(map, loadedLayers, onFeatureSelect);
  }, [loadedLayers, onFeatureSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sync = () => {
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
    };
    if (map.isStyleLoaded()) {
      sync();
      return;
    }
    map.once("load", sync);
    return () => {
      map.off("load", sync);
    };
  }, [spatialFilter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sync = () =>
      syncLayerExtentOverlays(
        map,
        layerExtentOverlays,
        activeLayerExtentSourceIdsRef.current,
      );
    if (map.isStyleLoaded()) {
      sync();
      return;
    }
    map.once("load", sync);
    return () => {
      map.off("load", sync);
    };
  }, [layerExtentOverlays]);

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
        <BasemapStatusIndicator map={mapObject} />
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

function layerExtentSourceIdFor(layerId: string) {
  return `layer-extent-${sourceIdFor(layerId)}`;
}

function syncLayerExtentOverlays(
  map: MapboxMap,
  overlays: LayerExtentOverlay[],
  activeSourceIds: Set<string>,
) {
  const nextSourceIds = new Set<string>();
  for (const overlay of overlays) {
    const sourceId = layerExtentSourceIdFor(overlay.layer.id);
    const fillId = `${sourceId}-fill`;
    const lineId = `${sourceId}-line`;
    const beforeId = firstStyleLayerIdForLayer(map, overlay.layer);
    nextSourceIds.add(sourceId);
    upsertPolygonLayer(map, sourceId, fillId, lineId, overlay.geometry, {
      ...layerExtentStyle,
      beforeId,
    });
  }

  for (const sourceId of activeSourceIds) {
    if (!nextSourceIds.has(sourceId)) {
      removeLayerGroup(
        map,
        sourceId,
        [`${sourceId}-fill`, `${sourceId}-line`],
        {
          cleanInteraction: false,
        },
      );
    }
  }

  activeSourceIds.clear();
  for (const sourceId of nextSourceIds) {
    activeSourceIds.add(sourceId);
  }
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

function mapboxErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return "地图资源加载失败";
}
