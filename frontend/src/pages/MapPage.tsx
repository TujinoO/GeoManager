import { App, Layout } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import DataPanel from "../components/DataPanel";
import LayerDataTableModal from "../components/LayerDataTableModal";
import LayerPanel from "../components/LayerPanel";
import MapCanvas from "../components/MapCanvas";
import RightSidePanel from "../components/RightSidePanel";
import WorkspaceBottomPanel from "../components/WorkspaceBottomPanel";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { useAppContext } from "../contexts/AppContext";
import {
  type ExportOptions,
  type ExportProgressHandler,
  LayerContext,
  type LayerContextValue,
} from "../hooks/LayerContext";
import { useLayerGroups } from "../hooks/useLayerGroups";
import { useRasterRender } from "../hooks/useRasterRender";
import { clearFeatureState, getMapState } from "../map/mapState";
import type { DrawMode } from "../map/spatialDraw";
import type {
  AttributeFilter,
  DataResourceProfile,
  ExportLayerItem,
  FeatureInfo,
  GeoJsonGeometry,
  GeoJsonValidationWarning,
  LoadedLayer,
  LoadedRasterLayer,
  LoadedVectorLayer,
  ResourceFilters,
  ResourceListItem,
  ResourceQueryResult,
  SpatialFilter,
} from "../types";
import { downloadBlob } from "../utils/download";
import {
  boundsFromImageCoordinates,
  combinedFeatureBounds,
  fitGeojsonBounds,
  geometryFromBoundsText,
  sourceIdFor,
} from "../utils/geometry";
import {
  createRasterLayerGroup,
  createVectorLayerGroup,
} from "../utils/layerFactory";
import { resourceSpatialExtent } from "../utils/resources";

type DrawPurpose = "query";

const emptyPermissions = {
  canAccessAdmin: false,
  canManageFeaturePermissions: false,
  canCreateUser: false,
  canViewOperationLogs: false,
  canViewAllOperationLogs: false,
  canViewOwnOperationLogs: false,
  canViewGroupOperationLogs: false,
  canManageSystemSettings: false,
  canManageAuth: false,
  canViewDashboardResourceCard: false,
  canViewDashboardLayerCard: false,
  canViewDashboardRasterCard: false,
  canViewDashboardUserCard: false,
  canViewDashboardActiveUsersCard: false,
  canViewDashboardSystemCard: false,
  canBrowseData: false,
  canQueryData: false,
  canLoadVectorLayer: false,
  canLoadRasterLayer: false,
  canUseCustomSymbolization: false,
  canExportData: false,
  canMaintainData: false,
  canManageRasterData: false,
};

export default function MapPage() {
  const { bootstrap, user } = useAppContext();
  const { message, notification } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [resources, setResources] = useState<ResourceListItem[]>([]);
  const [selectedResource, setSelectedResource] =
    useState<ResourceListItem | null>(null);
  const [resourceProfile, setResourceProfile] =
    useState<DataResourceProfile | null>(null);
  const [queryResult, setQueryResult] = useState<ResourceQueryResult | null>(
    null,
  );
  const [spatialFilter, setSpatialFilter] = useState<SpatialFilter | null>(
    null,
  );
  const [activeDraw, setActiveDraw] = useState<{
    purpose: DrawPurpose;
    mode: NonNullable<DrawMode>;
  } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [dataPanelOpen, setDataPanelOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<FeatureInfo | null>(
    null,
  );
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [tableLayer, setTableLayer] = useState<LoadedLayer | null>(null);
  const [layerExtentVisible, setLayerExtentVisible] = useState(false);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const startupScanStartedRef = useRef(false);
  const permissions = user?.permissions ?? emptyPermissions;
  const userRoles = user?.roles ?? [];
  const activeWorkspace = location.pathname === "/nongeo" ? "nongeo" : "geo";
  const isGeoWorkspace = activeWorkspace === "geo";

  const layerGroups = useLayerGroups();
  const { startRasterRender, setMapInstance } = useRasterRender(
    layerGroups.updateRasterLayer,
  );
  const permissionDeniedMessage = `当前用户组"${userRoles.length > 0 ? userRoles.join("、") : "未分组"}"无权限`;

  const mapLayers = useMemo(
    () =>
      layerGroups.groups.flatMap((group) =>
        group.visible
          ? group.children
              .filter((layer) => layer.visible)
              .map(
                (layer) =>
                  ({
                    ...layer,
                    symbolization: {
                      ...layer.symbolization,
                      opacity: Math.round(
                        (layer.symbolization.opacity *
                          group.symbolization.opacity) /
                          100,
                      ),
                    },
                  }) as LoadedLayer,
              )
          : [],
      ),
    [layerGroups.groups],
  );

  const selectedLayer = useMemo(() => {
    const allLayers = layerGroups.groups.flatMap((group) => group.children);
    return (
      allLayers.find((layer) => layer.id === selectedLayerId) ??
      allLayers.find((layer) => layer.layerType === "vector") ??
      allLayers[0] ??
      null
    );
  }, [layerGroups.groups, selectedLayerId]);

  const selectedLayerExtentGeometry = useMemo(() => {
    if (!layerExtentVisible || !selectedLayer) {
      return null;
    }
    return geometryFromBoundsText(
      selectedLayer.metadata.空间范围 ??
        resourceSpatialExtent(selectedLayer.sourceResource),
    );
  }, [layerExtentVisible, selectedLayer]);

  const sharedSpatialGeometry = spatialFilter?.geometry ?? null;

  const loadResources = useCallback(
    async (filters: ResourceFilters) => {
      try {
        const response = await api.resources(filters);
        setResources(response.items);
        return response.items;
      } catch (error) {
        message.error(
          error instanceof Error ? error.message : "数据资源加载失败",
        );
        return [];
      }
    },
    [message],
  );

  useEffect(() => {
    if (permissions.canBrowseData) {
      void loadResources({});
    }
  }, [permissions.canBrowseData, loadResources]);

  const waitForJob = useCallback(async (jobId: string) => {
    while (true) {
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      const job = await api.rasterJob(jobId);
      if (job.status === "ready") {
        return job;
      }
      if (job.status === "failed") {
        throw new Error(job.error || "数据目录扫描失败");
      }
    }
  }, []);

  useEffect(() => {
    if (!permissions.canBrowseData || startupScanStartedRef.current) {
      return;
    }
    startupScanStartedRef.current = true;

    async function scanAndRefreshResources() {
      try {
        const scanJobs: Promise<unknown>[] = [];
        scanJobs.push(api.scanCatalogSources());
        const rasterScanJob = await api.scanRasterSources();
        scanJobs.push(waitForJob(rasterScanJob.id));
        if (scanJobs.length > 0) {
          await Promise.all(scanJobs);
        }
      } catch (error) {
        message.warning(
          error instanceof Error ? error.message : "数据目录自动扫描失败",
        );
      } finally {
        await loadResources({});
      }
    }

    void scanAndRefreshResources();
  }, [loadResources, message, permissions.canBrowseData, waitForJob]);

  async function handleSelectResource(resource: ResourceListItem) {
    setSelectedResource(resource);
    setQueryResult(null);
    setLoadingProfile(true);
    try {
      const profile = await api.resourceProfile(resource);
      setResourceProfile(profile);
    } catch (error) {
      setResourceProfile(null);
      message.error(
        error instanceof Error ? error.message : "读取字段和元信息失败",
      );
    } finally {
      setLoadingProfile(false);
    }
  }

  const handleDrawComplete = useCallback(
    (mode: NonNullable<DrawMode>, geometry: GeoJsonGeometry) => {
      setSpatialFilter({ mode, geometry });
      setActiveDraw(null);
    },
    [],
  );

  const setQueryDrawMode = useCallback((mode: DrawMode | null) => {
    setActiveDraw(mode ? { purpose: "query", mode } : null);
  }, []);

  async function handleQuery(attributeFilters: AttributeFilter[]) {
    if (!permissions.canQueryData || !permissions.canLoadVectorLayer) {
      message.warning(permissionDeniedMessage);
      return;
    }
    if (!selectedResource) {
      message.warning("请先选择数据资源");
      return;
    }
    setQuerying(true);
    try {
      const result = await api.queryResource(selectedResource, {
        attributeFilters,
        spatialFilter,
        limit: bootstrap.limits.queryResultLimit,
      });
      setQueryResult(result);
      showGeojsonWarnings(notification, result.warnings);
      message.success(`查询完成：返回 ${result.returnedCount} 条`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "查询失败");
    } finally {
      setQuerying(false);
    }
  }

  function handleLoadResult() {
    if (!permissions.canLoadVectorLayer) {
      message.warning(permissionDeniedMessage);
      return;
    }
    if (!selectedResource || !resourceProfile || !queryResult) return;
    const group = createVectorLayerGroup(
      selectedResource,
      resourceProfile,
      queryResult,
    );
    layerGroups.addGroup(group);
    setSelectedLayerId(group.children[0]?.id ?? null);
    setDataPanelOpen(false);
    if (!isGeoWorkspace) {
      navigate("/map");
    }
    message.success("查询结果已加载到图层");
  }

  function handleLoadRaster() {
    if (!permissions.canLoadRasterLayer) {
      message.warning(permissionDeniedMessage);
      return;
    }
    if (selectedResource?.dataType !== "raster" || !resourceProfile?.raster) {
      message.warning("请先选择已完成预处理的栅格数据");
      return;
    }
    const group = createRasterLayerGroup(selectedResource, resourceProfile);
    if (!group) return;
    layerGroups.addGroup(group);
    setSelectedLayerId(group.children[0]?.id ?? null);
    setDataPanelOpen(false);
    const child = group.children[0] as LoadedRasterLayer;
    if (!isGeoWorkspace) {
      navigate("/map");
    }
    void startRasterRender(
      group.id,
      child.id,
      child.symbolization,
      child,
      "default",
    );
  }

  const handleMapReady = useCallback(
    (map: mapboxgl.Map) => {
      mapInstanceRef.current = map;
      setMapInstance(map);
    },
    [setMapInstance],
  );

  const handleMapDestroy = useCallback(() => {
    mapInstanceRef.current = null;
    setMapInstance(null);
  }, [setMapInstance]);

  const locateLayer = useCallback(
    (groupId: string, layerId: string) => {
      const map = mapInstanceRef.current;
      if (!map) {
        message.warning("地图尚未准备好");
        return;
      }
      const targetGroup = layerGroups.groups.find((g) => g.id === groupId);
      const targetLayer = targetGroup?.children.find((l) => l.id === layerId);
      if (!targetLayer) {
        message.warning("当前图层没有可定位的数据");
        return;
      }
      if (
        targetLayer.layerType === "raster" &&
        targetLayer.imageCoordinates?.length
      ) {
        const bounds = boundsFromImageCoordinates(targetLayer.imageCoordinates);
        if (bounds) {
          map.fitBounds(bounds, {
            padding: 72,
            duration: 900,
            essential: true,
          });
          return;
        }
      }
      if (targetLayer.layerType !== "vector" || !targetLayer.geojson) {
        message.warning("当前图层没有可定位的数据");
        return;
      }
      fitGeojsonBounds(
        map,
        targetLayer.geojson,
        bootstrap.map.defaultCenter,
        bootstrap.map.defaultZoom,
      );
    },
    [
      bootstrap.map.defaultCenter,
      bootstrap.map.defaultZoom,
      layerGroups.groups,
      message,
    ],
  );

  const locateGroup = useCallback(
    (groupId: string) => {
      const map = mapInstanceRef.current;
      if (!map) {
        message.warning("地图尚未准备好");
        return;
      }
      const targetGroup = layerGroups.groups.find((g) => g.id === groupId);
      if (!targetGroup) return;
      const geojsons = targetGroup.children
        .filter((l): l is LoadedVectorLayer => l.layerType === "vector")
        .map((l) => l.geojson);
      const rasterBounds = targetGroup.children
        .filter((l) => l.layerType === "raster" && l.imageCoordinates?.length)
        .map((l) => {
          const coords = (l as LoadedRasterLayer).imageCoordinates;
          return coords ? boundsFromImageCoordinates(coords) : null;
        })
        .filter(Boolean) as mapboxgl.LngLatBounds[];
      if (geojsons.length === 0 && rasterBounds.length === 0) {
        message.warning("该图层组没有可定位的数据");
        return;
      }
      const bounds = combinedFeatureBounds(geojsons);
      for (const rasterBound of rasterBounds) {
        if (bounds) {
          bounds.extend(rasterBound.getSouthWest());
          bounds.extend(rasterBound.getNorthEast());
        }
      }
      const firstRasterBound = rasterBounds[0];
      if (!bounds && firstRasterBound) {
        map.fitBounds(firstRasterBound, {
          padding: 72,
          duration: 900,
          essential: true,
        });
        return;
      }
      if (!bounds) {
        message.warning("无法计算图层组范围");
        return;
      }
      map.fitBounds(bounds, { padding: 72, duration: 900, essential: true });
    },
    [layerGroups.groups, message],
  );

  const handleSelectionChange = useCallback(
    (featureIds: (string | number)[]) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      // 清除之前的选中状态
      clearFeatureState(map, "selectedFeature", "selected");

      if (
        featureIds.length > 0 &&
        tableLayer &&
        tableLayer.layerType === "vector"
      ) {
        const sourceId = sourceIdFor(tableLayer.id);

        // 设置所有选中要素的状态
        for (const featureId of featureIds) {
          const target = { source: sourceId, id: featureId };
          map.setFeatureState(target, { selected: true });
        }

        // 更新地图内部状态（使用第一个选中的要素）
        const selectedFeatureId = featureIds[0];
        if (selectedFeatureId === undefined) return;
        const state = getMapState(map);
        state.selectedFeature = { source: sourceId, id: selectedFeatureId };

        // 查找第一个选中要素的属性信息
        const feature = tableLayer.geojson.features.find((f) => {
          const fId = f.id;
          if (typeof fId === "string" || typeof fId === "number") {
            return featureIds.includes(fId);
          }
          return false;
        });

        if (feature) {
          setSelectedFeature({
            layerId: tableLayer.id,
            layerName: tableLayer.name,
            properties: (feature.properties ?? {}) as Record<string, unknown>,
          });
        }
      } else {
        setSelectedFeature(null);
      }
    },
    [tableLayer],
  );

  const exportLayers = useCallback(
    async (
      items: ExportLayerItem[],
      options: ExportOptions,
      onProgress?: ExportProgressHandler,
    ) => {
      if (!permissions.canExportData) {
        message.warning(permissionDeniedMessage);
        return;
      }
      try {
        const job = await api.exportLayersAsync({
          epsg: options.epsg,
          reproject: options.reproject,
          clip: options.clip,
          clipGeometry: options.clipGeometry,
          items,
        });
        onProgress?.({
          status: job.status,
          percent: job.progressPercent,
          messages: job.messages,
        });
        while (true) {
          await new Promise((resolve) => window.setTimeout(resolve, 900));
          const next = await api.rasterJob(job.id);
          onProgress?.({
            status: next.status,
            percent: next.progressPercent,
            messages: next.messages,
          });
          if (next.status === "ready") {
            break;
          }
          if (next.status === "failed") {
            throw new Error(next.error || "导出失败");
          }
        }
        const { blob, filename } = await api.downloadExport(job.id);
        downloadBlob(blob, filename);
        message.success("导出任务已完成");
      } catch (error) {
        message.error(error instanceof Error ? error.message : "导出失败");
        throw error;
      }
    },
    [message, permissionDeniedMessage, permissions.canExportData],
  );

  const layerContextValue: LayerContextValue = {
    groups: layerGroups.groups,
    selectedLayerId,
    selectLayer: (_groupId, layerId) => setSelectedLayerId(layerId),
    openLayerTable: (_groupId, layerId) => {
      const layer =
        layerGroups.groups
          .flatMap((group) => group.children)
          .find((item) => item.id === layerId) ?? null;
      setTableLayer(layer);
    },
    addGroup: layerGroups.addGroup,
    updateLayer: layerGroups.updateLayer,
    updateRasterLayer: layerGroups.updateRasterLayer,
    setGroupVisibility: layerGroups.setGroupVisibility,
    setGroupName: layerGroups.setGroupName,
    setGroupSymbolization: layerGroups.setGroupSymbolization,
    setLayerVisibility: layerGroups.setLayerVisibility,
    setLayerName: layerGroups.setLayerName,
    setLayerSymbolization: layerGroups.setLayerSymbolization,
    removeGroup: layerGroups.removeGroup,
    removeLayer: layerGroups.removeLayer,
    reorderGroups: layerGroups.reorderGroups,
    startRasterRender: (groupId, layerId, symbolization, layer, rulesMode) =>
      void startRasterRender(groupId, layerId, symbolization, layer, rulesMode),
    locateLayer,
    locateGroup,
    mapRef: mapInstanceRef,
    canUseCustomSymbolization: permissions.canUseCustomSymbolization,
    canExportData: permissions.canExportData,
    exportClipGeometry: sharedSpatialGeometry,
    clearExportClipGeometry: () => setSpatialFilter(null),
    exportLayers,
  };

  const dataPanel = (
    <DataPanel
      resources={resources}
      profile={resourceProfile}
      selectedResourceId={selectedResource?.id ?? null}
      queryResult={queryResult}
      loadingProfile={loadingProfile}
      querying={querying}
      permissions={permissions}
      onFilterResources={loadResources}
      onSelectResource={handleSelectResource}
      onQuery={handleQuery}
      onLoadResult={handleLoadResult}
      onLoadRaster={handleLoadRaster}
    />
  );

  return (
    <Layout className="workspace">
      <WorkspaceHeader
        activeTab={isGeoWorkspace ? "map" : "nongeo"}
        canBrowseData={permissions.canBrowseData}
        dataPanel={dataPanel}
        dataPanelOpen={dataPanelOpen}
        onDataPanelOpenChange={setDataPanelOpen}
      />
      <div
        className={
          isGeoWorkspace
            ? "workspace-body"
            : "workspace-body workspace-body-nongeo"
        }
      >
        {isGeoWorkspace ? (
          <>
            <main className="map-stage">
              <MapCanvas
                bootstrap={bootstrap}
                loadedLayers={mapLayers}
                drawMode={activeDraw?.mode ?? null}
                spatialFilter={spatialFilter}
                layerExtentGeometry={selectedLayerExtentGeometry}
                layerExtentTargetLayer={selectedLayer}
                onDrawComplete={handleDrawComplete}
                onFeatureSelect={setSelectedFeature}
                onMapReady={handleMapReady}
                onMapDestroy={handleMapDestroy}
              />
            </main>
            <aside className="floating-panel floating-panel-left">
              <LayerContext.Provider value={layerContextValue}>
                <LayerPanel />
                <LayerDataTableModal
                  layer={tableLayer}
                  open={Boolean(tableLayer)}
                  onClose={() => setTableLayer(null)}
                  onSelectionChange={handleSelectionChange}
                />
              </LayerContext.Provider>
            </aside>
            <aside
              className="floating-panel floating-panel-right"
              aria-label="要素信息面板"
            >
              <RightSidePanel selectedFeature={selectedFeature} />
            </aside>
            <aside
              className="floating-panel-bottom"
              aria-label="底部数据与绘制面板"
            >
              <WorkspaceBottomPanel
                selectedLayer={selectedLayer}
                exportClipGeometry={sharedSpatialGeometry}
                spatialFilter={spatialFilter}
                layerExtentVisible={layerExtentVisible}
                activeDraw={activeDraw}
                onStartQueryDraw={setQueryDrawMode}
                onLayerExtentVisibleChange={setLayerExtentVisible}
                onClearSpatialFilter={() => setSpatialFilter(null)}
                onImportSpatialFilter={setSpatialFilter}
              />
            </aside>
          </>
        ) : (
          <main className="nongeo-stage" aria-label="非地理可视化" />
        )}
      </div>
    </Layout>
  );
}

function showGeojsonWarnings(
  notification: ReturnType<typeof App.useApp>["notification"],
  warnings?: GeoJsonValidationWarning[],
) {
  if (!warnings?.length) {
    return;
  }
  notification.warning({
    message: "地理坐标数据警告",
    description: (
      <div className="geojson-warning-list">
        {warnings.map((warning) => (
          <div key={`${warning.code}-${warning.message}`}>
            {warning.message}
          </div>
        ))}
      </div>
    ),
    placement: "topRight",
    duration: 8,
  });
}
