import {
  FullscreenOutlined,
  HomeOutlined,
  RotateLeftOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import { App, Button, Tooltip } from "antd";
import mapboxgl, { type Map as MapboxMap, type MapboxOptions } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import tiandituTileProviderUrl from "../map/tiandituTileProvider.js?url";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BasemapStatusIndicator from "./BasemapStatusIndicator";
import BasemapSwitcher from "./BasemapSwitcher";
import type { BasemapRetryProbe } from "../hooks/useBasemapStatus";
import {
  applyBasemapExpressionSafety,
  applyChineseBasemapLanguage,
  applySatelliteBasemapColorCorrection,
  mapLabelLanguage,
} from "../map/basemapStyle";
import {
  availableBasemapFallback,
  createBasemapCatalog,
  resolveBasemapDefinition,
  type BasemapDefinition,
  type BasemapId,
} from "../map/basemapCatalog";
import {
  readBasemapPreference,
  writeBasemapPreference,
} from "../map/basemapPreference";
import {
  canRunRateLimitRecovery,
  rateLimitRecoveryCooldownMs,
  rateLimitRecoverySwitchOptions,
  shouldBlockRateLimitedBasemapSelection,
  shouldSuppressRecoveredBasemapRateLimitError,
  type BasemapRateLimitRecoveryState,
} from "../map/basemapRateLimitRecovery";
import {
  createBasemapRequestConcurrencyCoordinator,
  type BasemapRequestConcurrencyLease,
} from "../map/basemapRequestConcurrency";
import {
  areBasemapSourcesReady,
  basemapSwitchTimeoutMsForProvider,
  basemapErrorMessage,
  createStableReadinessGate,
  isBasemapRateLimitError,
  isHardBasemapStyleError,
  readBasemapCamera,
  resolveBasemapRateLimitFallback,
  resolveBasemapTechnicalFallback,
  restoreBasemapCamera,
  restoreSelectedFeatureState,
  type BasemapCameraSnapshot,
} from "../map/basemapSwitch";
import { tiandituTileProviderName } from "../map/tiandituTileProviderConfig";
import {
  isBasemapResourceError,
  type ActiveBasemapDescriptor,
} from "../map/basemapStatus";
import { syncLoadedLayers } from "../map/loadedLayerSync";
import { getMapState, type FeatureStateTarget } from "../map/mapState";
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
mapboxgl.addTileProvider(tiandituTileProviderName, tiandituTileProviderUrl);

interface Props {
  bootstrap: Bootstrap;
  basemapPreferenceScope: string;
  basemapSwitchDisabled?: boolean;
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
  onBasemapSwitchingChange?: (switching: boolean) => void;
}

interface ActiveBasemapState {
  id: BasemapId;
  generation: number;
}

interface BasemapStyleLoadResult {
  ok: boolean;
  latencyMs: number | null;
  error?: unknown;
}

interface StyleRestoreSnapshot {
  camera: BasemapCameraSnapshot;
  selectedFeature: FeatureStateTarget | undefined;
}

interface BasemapSwitchOptions {
  force?: boolean;
  persist?: boolean;
  announce?: boolean;
  rollbackOnFailure?: boolean;
}

const basemapRequestConcurrency =
  createBasemapRequestConcurrencyCoordinator(mapboxgl);

export default function MapCanvas({
  bootstrap,
  basemapPreferenceScope,
  basemapSwitchDisabled = false,
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
  onBasemapSwitchingChange,
}: Props) {
  const { message } = App.useApp();
  const mapRef = useRef<MapboxMap | null>(null);
  const [mapObject, setMapObject] = useState<MapboxMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const coordinatePanelRef = useRef<HTMLDivElement | null>(null);
  const pointerUpdateFrameRef = useRef<number | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const activeLayerExtentSourceIdsRef = useRef<Set<string>>(new Set());
  const styleInitializedRef = useRef(false);
  const latestLoadedLayersRef = useRef(loadedLayers);
  const latestSpatialFilterRef = useRef(spatialFilter);
  const latestLayerExtentOverlaysRef = useRef(layerExtentOverlays);
  const latestOnFeatureSelectRef = useRef(onFeatureSelect);
  const latestOnBasemapSwitchingChangeRef = useRef(onBasemapSwitchingChange);
  const mountedRef = useRef(true);
  const basemapSwitchingRef = useRef(false);
  const basemapOperationSequenceRef = useRef(0);
  const basemapRequestConcurrencyLeaseRef =
    useRef<BasemapRequestConcurrencyLease | null>(null);
  const rateLimitRecoveryRef = useRef<BasemapRateLimitRecoveryState>({
    descriptor: null,
    inFlight: false,
    suppressUntil: 0,
  });
  const recoverRateLimitedBasemapRef = useRef<
    (definition: BasemapDefinition, descriptor: ActiveBasemapDescriptor) => void
  >(() => undefined);
  const cancelBasemapStyleLoadRef = useRef<((reason?: unknown) => void) | null>(
    null,
  );
  latestLoadedLayersRef.current = loadedLayers;
  latestSpatialFilterRef.current = spatialFilter;
  latestLayerExtentOverlaysRef.current = layerExtentOverlays;
  latestOnFeatureSelectRef.current = onFeatureSelect;
  latestOnBasemapSwitchingChangeRef.current = onBasemapSwitchingChange;
  const mapConfig = bootstrap.map;
  const mapboxToken = mapConfig.mapboxAccessToken;
  const basemapCatalog = useMemo(
    () =>
      createBasemapCatalog({
        mapboxAccessToken: mapboxToken,
        tiandituKey: mapConfig.tiandituAccessToken ?? "",
      }),
    [mapConfig.tiandituAccessToken, mapboxToken],
  );
  const initialBasemapRef = useRef<BasemapDefinition | null>(null);
  if (!initialBasemapRef.current) {
    initialBasemapRef.current = availableBasemapFallback(basemapCatalog, {
      userPreference: readBasemapPreference(basemapPreferenceScope),
      systemDefault: mapConfig.defaultBasemap,
    });
  }
  const [activeBasemapState, setActiveBasemapState] =
    useState<ActiveBasemapState>(() => ({
      id: initialBasemapRef.current!.id,
      generation: 0,
    }));
  const [basemapSwitching, setBasemapSwitching] = useState(false);
  const activeBasemap =
    resolveBasemapDefinition(basemapCatalog, activeBasemapState.id) ??
    availableBasemapFallback(basemapCatalog);
  const activeBasemapRef = useRef(activeBasemap);
  activeBasemapRef.current = activeBasemap;
  const basemapGenerationRef = useRef(activeBasemapState.generation);
  basemapGenerationRef.current = activeBasemapState.generation;
  const activeBasemapDescriptor = useMemo<ActiveBasemapDescriptor>(
    () => ({
      id: activeBasemap.id,
      generation: activeBasemapState.generation,
      sourceIds: activeBasemap.sourceIds,
      requireAllSourceIds: activeBasemap.requireAllSourceIds,
      readinessTimeoutMs: basemapSwitchTimeoutMsForProvider(
        activeBasemap.provider,
      ),
      resourceMarkers: activeBasemap.errorMarkers,
    }),
    [activeBasemap, activeBasemapState.generation],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      basemapOperationSequenceRef.current += 1;
      cancelBasemapStyleLoadRef.current?.(new Error("地图已卸载"));
      cancelBasemapStyleLoadRef.current = null;
    };
  }, []);

  const restoreStyleContents = useCallback(
    (
      map: MapboxMap,
      definition: BasemapDefinition,
      options: {
        fitNewLayers: boolean;
        snapshot?: StyleRestoreSnapshot;
      },
    ) => {
      const postProcess = definition.postProcess;
      if (postProcess.applyExpressionSafety) {
        applyBasemapExpressionSafety(map);
      }
      registerPlatformSymbolImages(map);
      map.setFog({
        color: "rgb(221, 232, 224)",
        "high-color": "rgb(52, 96, 123)",
        "horizon-blend": 0.08,
        "space-color": "rgb(8, 20, 28)",
        "star-intensity": 0.22,
      });
      if (postProcess.applySatelliteColorCorrection) {
        applySatelliteBasemapColorCorrection(map);
      }
      if (postProcess.applyChineseLanguage) {
        applyChineseBasemapLanguage(map);
      }
      if (postProcess.hideAdministrativeBoundaries) {
        hideAdministrativeBoundaries(map);
      }

      syncLoadedLayers(
        map,
        latestLoadedLayersRef.current,
        latestOnFeatureSelectRef.current,
        { fitNewLayers: options.fitNewLayers },
      );
      syncSpatialFilterOverlay(map, latestSpatialFilterRef.current);
      syncLayerExtentOverlays(
        map,
        latestLayerExtentOverlaysRef.current,
        activeLayerExtentSourceIdsRef.current,
      );
      if (options.snapshot) {
        restoreBasemapCamera(map, options.snapshot.camera);
        restoreSelectedFeatureState(map, options.snapshot.selectedFeature);
      }
      styleInitializedRef.current = true;
    },
    [],
  );

  const loadBasemapStyle = useCallback(
    (
      map: MapboxMap,
      definition: BasemapDefinition,
      snapshot: StyleRestoreSnapshot,
    ) => {
      const sequence = basemapOperationSequenceRef.current + 1;
      basemapOperationSequenceRef.current = sequence;
      cancelBasemapStyleLoadRef.current?.(
        new Error("新的底图切换已替代上一请求"),
      );
      styleInitializedRef.current = false;
      const startedAt = performance.now();

      return new Promise<BasemapStyleLoadResult>((resolve) => {
        let settled = false;
        let styleLoaded = false;
        let lastBasemapError: unknown;
        let timeoutId: number | null = null;

        const basemapSourcesReady = () => {
          if (!styleLoaded || !isCurrentOperation()) return false;
          return areBasemapSourcesReady(map, definition);
        };
        const readinessGate = createStableReadinessGate(
          basemapSourcesReady,
          () => {
            if (lastBasemapError !== undefined) {
              settle(false, lastBasemapError);
              return;
            }
            settle(true);
          },
          100,
        );

        const cleanup = () => {
          map.off("style.load", handleStyleLoad);
          map.off("sourcedata", handleSourceData);
          map.off("idle", handleIdle);
          map.off("error", handleError);
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
          }
          readinessGate.cancel();
          if (cancelBasemapStyleLoadRef.current === cancel) {
            cancelBasemapStyleLoadRef.current = null;
          }
        };
        const settle = (ok: boolean, error?: unknown) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve({
            ok,
            latencyMs: ok
              ? Math.max(1, Math.round(performance.now() - startedAt))
              : null,
            error,
          });
        };
        const cancel = (reason?: unknown) =>
          settle(false, reason ?? new Error("底图切换已取消"));
        const isCurrentOperation = () =>
          basemapOperationSequenceRef.current === sequence;
        const checkBasemapReady = readinessGate.check;
        const handleStyleLoad = () => {
          if (!isCurrentOperation()) return;
          try {
            restoreStyleContents(map, definition, {
              fitNewLayers: false,
              snapshot,
            });
            styleLoaded = true;
            checkBasemapReady();
          } catch (error) {
            settle(false, error);
          }
        };
        const handleSourceData = (event: { sourceId?: string }) => {
          if (event.sourceId && definition.sourceIds.includes(event.sourceId)) {
            checkBasemapReady();
          }
        };
        const handleIdle = () => checkBasemapReady();
        const handleError = (event: { error?: unknown; sourceId?: string }) => {
          const descriptor: ActiveBasemapDescriptor = {
            id: definition.id,
            generation: sequence,
            sourceIds: definition.sourceIds,
            requireAllSourceIds: definition.requireAllSourceIds,
            resourceMarkers: definition.errorMarkers,
          };
          if (!isBasemapResourceError(event, descriptor)) return;
          lastBasemapError = event;
          if (isHardBasemapStyleError(event)) {
            settle(false, event);
          }
        };

        cancelBasemapStyleLoadRef.current = cancel;
        map.on("style.load", handleStyleLoad);
        map.on("sourcedata", handleSourceData);
        map.on("idle", handleIdle);
        map.on("error", handleError);
        const timeoutMs = basemapSwitchTimeoutMsForProvider(
          definition.provider,
        );
        timeoutId = window.setTimeout(
          () =>
            settle(
              false,
              new Error(
                `${definition.label}加载超过 ${Math.round(timeoutMs / 1_000)} 秒`,
              ),
            ),
          timeoutMs,
        );
        try {
          basemapRequestConcurrencyLeaseRef.current?.update(
            definition.provider,
          );
          map.setStyle(definition.style, {
            diff: false,
            localFontFamily: null,
            localIdeographFontFamily:
              '"Microsoft YaHei", "PingFang SC", sans-serif',
          });
        } catch (error) {
          settle(false, error);
        }
      });
    },
    [restoreStyleContents],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const mapOptions: MapboxOptions = {
      container: containerRef.current,
      style: activeBasemapRef.current.style,
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
    const concurrencyLease = basemapRequestConcurrency.acquire(
      activeBasemapRef.current.provider,
    );
    basemapRequestConcurrencyLeaseRef.current = concurrencyLease;
    let map: MapboxMap;
    try {
      map = new mapboxgl.Map(mapOptions);
    } catch (error) {
      basemapRequestConcurrencyLeaseRef.current = null;
      concurrencyLease.release();
      throw error;
    }
    const unbindPlatformSymbolImageFallback =
      bindPlatformSymbolImageFallback(map);
    const handleStyleLoad = () => {
      if (basemapSwitchingRef.current) return;
      try {
        restoreStyleContents(map, activeBasemapRef.current, {
          fitNewLayers: true,
        });
      } catch (error) {
        onMapError?.(basemapErrorMessage(error));
      }
    };
    map.on("style.load", handleStyleLoad);
    const handleMapError = (event: { error?: unknown; sourceId?: string }) => {
      const definition = activeBasemapRef.current;
      const descriptor: ActiveBasemapDescriptor = {
        id: definition.id,
        generation: basemapGenerationRef.current,
        sourceIds: definition.sourceIds,
        requireAllSourceIds: definition.requireAllSourceIds,
        resourceMarkers: definition.errorMarkers,
      };
      const isActiveBasemapError = isBasemapResourceError(event, descriptor);
      const recovery = rateLimitRecoveryRef.current;
      const now = Date.now();
      if (
        shouldSuppressRecoveredBasemapRateLimitError({
          recovery,
          now,
          isRateLimitError: isBasemapRateLimitError(event),
          matchesRecoveryDescriptor: Boolean(
            recovery.descriptor &&
            isBasemapResourceError(event, recovery.descriptor),
          ),
        })
      ) {
        return;
      }
      if (basemapSwitchingRef.current && isActiveBasemapError) {
        return;
      }
      if (
        isActiveBasemapError &&
        definition.provider === "tianditu" &&
        isBasemapRateLimitError(event)
      ) {
        rateLimitRecoveryRef.current = {
          descriptor,
          inFlight: true,
          suppressUntil: now + rateLimitRecoveryCooldownMs,
        };
        onMapError?.(basemapErrorMessage(event));
        recoverRateLimitedBasemapRef.current(definition, descriptor);
        return;
      }
      onMapError?.(basemapErrorMessage(event));
    };
    map.on("error", handleMapError);
    map.addControl(
      new mapboxgl.ScaleControl({ unit: "metric" }),
      "bottom-left",
    );
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right",
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
      basemapOperationSequenceRef.current += 1;
      cancelBasemapStyleLoadRef.current?.(new Error("地图正在重新初始化"));
      cancelBasemapStyleLoadRef.current = null;
      mapRef.current = null;
      setMapObject(null);
      map.remove();
      if (basemapRequestConcurrencyLeaseRef.current === concurrencyLease) {
        basemapRequestConcurrencyLeaseRef.current = null;
      }
      concurrencyLease.release();
    };
  }, [
    mapConfig,
    mapboxToken,
    onMapDestroy,
    onMapError,
    onMapReady,
    onViewStateChange,
    restoreStyleContents,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleInitializedRef.current) return;
    syncLoadedLayers(map, loadedLayers, onFeatureSelect);
  }, [loadedLayers, onFeatureSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleInitializedRef.current || !map.isStyleLoaded()) return;
    syncSpatialFilterOverlay(map, spatialFilter);
  }, [spatialFilter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleInitializedRef.current || !map.isStyleLoaded()) return;
    syncLayerExtentOverlays(
      map,
      layerExtentOverlays,
      activeLayerExtentSourceIdsRef.current,
    );
  }, [layerExtentOverlays]);

  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      !drawMode ||
      basemapSwitching ||
      !styleInitializedRef.current ||
      !map.isStyleLoaded()
    ) {
      return;
    }
    return bindGeometryDraw(map, drawMode, (geometry) =>
      onDrawComplete(drawMode, geometry),
    );
  }, [basemapSwitching, drawMode, onDrawComplete]);

  const switchBasemap = useCallback(
    async (id: BasemapId, options: BasemapSwitchOptions = {}) => {
      const map = mapRef.current;
      const target = resolveBasemapDefinition(basemapCatalog, id);
      if (drawMode || basemapSwitchDisabled) {
        if (options.announce !== false) {
          message.info(
            drawMode ? "请先完成当前范围绘制" : "地图导出期间暂不能切换底图",
          );
        }
        return false;
      }
      if (!map || !target) {
        if (options.announce !== false) {
          message.warning("地图尚未准备好，请稍后重试");
        }
        return false;
      }
      if (!target.credentials.available) {
        if (options.announce !== false) {
          message.warning(target.credentials.reason ?? "当前底图不可用");
        }
        return false;
      }
      const rateLimitRecovery = rateLimitRecoveryRef.current;
      if (
        shouldBlockRateLimitedBasemapSelection(
          rateLimitRecovery,
          target.id,
          Date.now(),
        )
      ) {
        if (options.announce !== false) {
          message.warning("天地图服务正在限流冷却，请稍后再试");
        }
        return false;
      }

      const previous = activeBasemapRef.current;
      if (previous.id === target.id && !options.force) return true;
      if (basemapSwitchingRef.current) {
        if (options.announce !== false) {
          message.info("底图正在切换，请稍候");
        }
        return false;
      }

      const snapshot: StyleRestoreSnapshot = {
        camera: readBasemapCamera(map),
        selectedFeature: getMapState(map).selectedFeature,
      };
      const publishActiveBasemap = (definition: BasemapDefinition) => {
        const generation = basemapGenerationRef.current + 1;
        basemapGenerationRef.current = generation;
        activeBasemapRef.current = definition;
        if (mountedRef.current) {
          setActiveBasemapState({ id: definition.id, generation });
        }
      };
      const setSwitching = (switching: boolean) => {
        basemapSwitchingRef.current = switching;
        if (mountedRef.current) {
          setBasemapSwitching(switching);
          latestOnBasemapSwitchingChangeRef.current?.(switching);
        }
      };

      setSwitching(true);
      publishActiveBasemap(target);
      try {
        const result = await loadBasemapStyle(map, target, snapshot);
        if (!mountedRef.current || mapRef.current !== map) return false;
        if (result.ok) {
          if (options.persist !== false) {
            writeBasemapPreference(basemapPreferenceScope, target.id);
          }
          if (options.announce !== false) {
            message.success(`已切换到${target.label}`);
          }
          return true;
        }

        const failureMessage = basemapErrorMessage(result.error);
        const technicalFallback = resolveBasemapTechnicalFallback(
          basemapCatalog,
          target.id,
        );
        if (options.rollbackOnFailure === false) {
          if (technicalFallback && technicalFallback.id !== target.id) {
            publishActiveBasemap(technicalFallback);
            const fallbackResult = await loadBasemapStyle(
              map,
              technicalFallback,
              snapshot,
            );
            if (!mountedRef.current || mapRef.current !== map) return false;
            if (fallbackResult.ok) return true;
          }
          return false;
        }
        if (previous.id === target.id) {
          if (technicalFallback && technicalFallback.id !== target.id) {
            publishActiveBasemap(technicalFallback);
            const fallbackResult = await loadBasemapStyle(
              map,
              technicalFallback,
              snapshot,
            );
            if (!mountedRef.current || mapRef.current !== map) return false;
            if (fallbackResult.ok) {
              message.error(
                `${target.label}重新加载失败，已启用技术兜底底图：${failureMessage}`,
              );
              return false;
            }
          }
          message.error(`${target.label}重新加载失败：${failureMessage}`);
          return false;
        }

        publishActiveBasemap(previous);
        const rollback = await loadBasemapStyle(map, previous, snapshot);
        if (!mountedRef.current || mapRef.current !== map) return false;
        if (rollback.ok) {
          message.error(
            `${target.label}加载失败，已恢复${previous.label}：${failureMessage}`,
          );
          return false;
        }

        if (technicalFallback && technicalFallback.id !== previous.id) {
          publishActiveBasemap(technicalFallback);
          const fallbackResult = await loadBasemapStyle(
            map,
            technicalFallback,
            snapshot,
          );
          if (!mountedRef.current || mapRef.current !== map) return false;
          if (fallbackResult.ok) {
            message.error(
              `${target.label}与原底图均未能加载，已启用技术兜底底图`,
            );
            return false;
          }
        }

        message.error("底图切换及恢复均失败，请检查网络后重新检测");
        return false;
      } finally {
        setSwitching(false);
      }
    },
    [
      basemapCatalog,
      basemapPreferenceScope,
      basemapSwitchDisabled,
      drawMode,
      loadBasemapStyle,
      message,
    ],
  );

  const recoverRateLimitedBasemap = useCallback(
    (
      failedDefinition: BasemapDefinition,
      failedDescriptor: ActiveBasemapDescriptor,
    ) => {
      const recovery = rateLimitRecoveryRef.current;
      if (
        !canRunRateLimitRecovery({
          recovery,
          failedDescriptor,
          failedBasemapId: failedDefinition.id,
          activeBasemapId: activeBasemapRef.current.id,
          activeGeneration: basemapGenerationRef.current,
          basemapSwitching: basemapSwitchingRef.current,
          drawModeActive: Boolean(drawMode),
          basemapSwitchDisabled,
        })
      ) {
        recovery.inFlight = false;
        return;
      }
      const fallback = resolveBasemapRateLimitFallback(
        basemapCatalog,
        failedDefinition.id,
      );
      if (!fallback) {
        recovery.inFlight = false;
        return;
      }

      void (async () => {
        try {
          const recovered = await switchBasemap(
            fallback.id,
            rateLimitRecoverySwitchOptions,
          );
          if (!mountedRef.current) return;
          if (recovered) {
            const recoveredDefinition = activeBasemapRef.current;
            message.warning(
              `${failedDefinition.label}请求受限，已自动切换到${recoveredDefinition.label}`,
            );
          } else {
            message.error(
              `${failedDefinition.label}请求受限，自动恢复底图失败，请稍后重新检测`,
            );
          }
        } finally {
          const currentRecovery = rateLimitRecoveryRef.current;
          if (
            currentRecovery.descriptor?.id === failedDescriptor.id &&
            currentRecovery.descriptor.generation ===
              failedDescriptor.generation
          ) {
            currentRecovery.inFlight = false;
          }
        }
      })();
    },
    [basemapCatalog, basemapSwitchDisabled, drawMode, message, switchBasemap],
  );
  recoverRateLimitedBasemapRef.current = recoverRateLimitedBasemap;

  const retryActiveBasemap = useCallback<BasemapRetryProbe>(
    async ({ signal }) => {
      const startedAt = performance.now();
      const ok = await switchBasemap(activeBasemapRef.current.id, {
        force: true,
        persist: false,
        announce: false,
      });
      if (signal.aborted) return;
      return {
        ok,
        latencyMs: ok
          ? Math.max(1, Math.round(performance.now() - startedAt))
          : null,
      };
    },
    [switchBasemap],
  );

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
        <BasemapSwitcher
          basemaps={basemapCatalog}
          activeId={activeBasemap.id}
          switching={basemapSwitching}
          disabled={Boolean(drawMode) || basemapSwitchDisabled}
          disabledReason={
            drawMode
              ? "请先完成当前范围绘制"
              : basemapSwitchDisabled
                ? "地图导出期间暂不能切换底图"
                : undefined
          }
          onSelect={(id) => void switchBasemap(id)}
        />
        <BasemapStatusIndicator
          map={mapObject}
          activeBasemap={activeBasemapDescriptor}
          activeBasemapName={activeBasemap.label}
          retryBasemap={
            basemapSwitching || drawMode || basemapSwitchDisabled
              ? undefined
              : retryActiveBasemap
          }
        />
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

function syncSpatialFilterOverlay(
  map: MapboxMap,
  spatialFilter: SpatialFilter | null,
) {
  if (spatialFilter) {
    upsertPolygonLayer(
      map,
      spatialFilterSourceId,
      spatialFilterFillId,
      spatialFilterLineId,
      spatialFilter.geometry,
      spatialRangeStyle,
    );
    return;
  }
  removeLayerGroup(
    map,
    spatialFilterSourceId,
    [spatialFilterFillId, spatialFilterLineId],
    { cleanInteraction: false },
  );
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
