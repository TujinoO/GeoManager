import { App, Button, Layout, Popover, Tag, Typography } from "antd";
import { Database, Layers, LogOut, Settings, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import DataPanel from "../components/DataPanel";
import LayerPanel from "../components/LayerPanel";
import MapCanvas from "../components/MapCanvas";
import {
  type ExportOptions,
  type ExportProgressHandler,
  LayerContext,
  type LayerContextValue,
} from "../hooks/LayerContext";
import { useLayerGroups } from "../hooks/useLayerGroups";
import { useRasterRender } from "../hooks/useRasterRender";
import type { DrawMode } from "../map/spatialDraw";
import type {
  AttributeFilter,
  Bootstrap,
  DataResource,
  DataResourceProfile,
  ExportLayerItem,
  GeoJsonGeometry,
  LoadedLayer,
  LoadedRasterLayer,
  ResourceFilters,
  ResourceQueryResult,
  SpatialFilter,
  User,
} from "../types";
import {
  boundsFromImageCoordinates,
  combinedFeatureBounds,
  fitGeojsonBounds,
} from "../utils/geometry";
import {
  createRasterLayerGroup,
  createVectorLayerGroup,
} from "../utils/layerFactory";

type DrawPurpose = "query" | "exportClip";

interface Props {
  bootstrap: Bootstrap;
  user: User;
  onLogout: () => void;
}

export default function WorkspacePage({ bootstrap, user, onLogout }: Props) {
  const { message } = App.useApp();
  const [resources, setResources] = useState<DataResource[]>([]);
  const [selectedResource, setSelectedResource] = useState<DataResource | null>(
    null,
  );
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
  const [exportClipGeometry, setExportClipGeometry] =
    useState<GeoJsonGeometry | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [dataPanelOpen, setDataPanelOpen] = useState(false);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);

  const layerGroups = useLayerGroups();
  const { startRasterRender, setMapInstance } = useRasterRender(
    layerGroups.updateRasterLayer,
  );
  const permissionDeniedMessage = `当前用户组“${user.roles.length > 0 ? user.roles.join("、") : "未分组"}”无权限`;

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

  const loadResources = useCallback(
    async (filters: ResourceFilters) => {
      try {
        const response = await api.resources(filters);
        setResources(response.items);
      } catch (error) {
        message.error(
          error instanceof Error ? error.message : "数据资源加载失败",
        );
      }
    },
    [message],
  );

  useEffect(() => {
    if (user.permissions.canBrowseData) {
      loadResources({});
    }
  }, [user.permissions.canBrowseData, loadResources]);

  async function handleSelectResource(resource: DataResource) {
    setSelectedResource(resource);
    setQueryResult(null);
    setLoadingProfile(true);
    try {
      const profile = await api.resourceProfile(resource.id);
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
      if (activeDraw?.purpose === "exportClip") {
        setExportClipGeometry(geometry);
      } else {
        setSpatialFilter({ mode, geometry });
      }
      setActiveDraw(null);
    },
    [activeDraw?.purpose],
  );

  const setQueryDrawMode = useCallback((mode: DrawMode | null) => {
    setActiveDraw(mode ? { purpose: "query", mode } : null);
  }, []);

  async function handleQuery(attributeFilters: AttributeFilter[]) {
    if (
      !user.permissions.canQueryData ||
      !user.permissions.canLoadVectorLayer
    ) {
      message.warning(permissionDeniedMessage);
      return;
    }
    if (!selectedResource) {
      message.warning("请先选择数据资源");
      return;
    }
    setQuerying(true);
    try {
      const result = await api.queryResource(selectedResource.id, {
        attributeFilters,
        spatialFilter,
        limit: bootstrap.limits.queryResultLimit,
      });
      setQueryResult(result);
      message.success(`查询完成：返回 ${result.returnedCount} 条`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "查询失败");
    } finally {
      setQuerying(false);
    }
  }

  function handleLoadResult() {
    if (!user.permissions.canLoadVectorLayer) {
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
    setDataPanelOpen(false);
    message.success("查询结果已加载到图层");
  }

  function handleLoadRaster() {
    if (!user.permissions.canLoadRasterLayer) {
      message.warning(permissionDeniedMessage);
      return;
    }
    if (!selectedResource || !resourceProfile?.raster) {
      message.warning("请先选择已完成预处理的栅格数据");
      return;
    }
    const group = createRasterLayerGroup(selectedResource, resourceProfile);
    if (!group) return;
    layerGroups.addGroup(group);
    setDataPanelOpen(false);
    const child = group.children[0] as LoadedRasterLayer;
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
        .filter(
          (l): l is import("../types").LoadedVectorLayer =>
            l.layerType === "vector",
        )
        .map((l) => l.geojson);
      const rasterBounds = targetGroup.children
        .filter((l) => l.layerType === "raster" && l.imageCoordinates?.length)
        .map((l) => {
          const coords = (l as import("../types").LoadedRasterLayer)
            .imageCoordinates;
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
      if (!bounds && rasterBounds.length > 0) {
        map.fitBounds(rasterBounds[0], {
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

  async function handleLogout() {
    try {
      await api.logout();
    } catch (error) {
      message.warning(
        error instanceof Error ? error.message : "退出接口异常，本地会话已清空",
      );
    } finally {
      onLogout();
    }
  }

  const exportLayers = useCallback(
    async (
      items: ExportLayerItem[],
      options: ExportOptions,
      onProgress?: ExportProgressHandler,
    ) => {
      if (!user.permissions.canExportData) {
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
        let downloadUrl = "";
        while (true) {
          await new Promise((resolve) => window.setTimeout(resolve, 900));
          const next = await api.rasterJob(job.id);
          onProgress?.({
            status: next.status,
            percent: next.progressPercent,
            messages: next.messages,
          });
          if (next.status === "ready") {
            downloadUrl =
              (next.result as { downloadUrl?: string } | null)?.downloadUrl ??
              "";
            break;
          }
          if (next.status === "failed") {
            throw new Error(next.error || "导出失败");
          }
        }
        if (!downloadUrl) {
          throw new Error("导出文件下载地址缺失");
        }
        const { blob, filename } = await api.downloadExport(downloadUrl);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        message.success("导出任务已完成");
      } catch (error) {
        message.error(error instanceof Error ? error.message : "导出失败");
        throw error;
      }
    },
    [message, permissionDeniedMessage, user.permissions.canExportData],
  );

  const layerContextValue: LayerContextValue = {
    groups: layerGroups.groups,
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
    canUseCustomSymbolization: user.permissions.canUseCustomSymbolization,
    canExportData: user.permissions.canExportData,
    exportClipGeometry,
    startExportClipDraw: (mode) =>
      setActiveDraw({ purpose: "exportClip", mode }),
    clearExportClipGeometry: () => setExportClipGeometry(null),
    exportLayers,
  };

  const dataPanel = (
    <DataPanel
      resources={resources}
      profile={resourceProfile}
      selectedResourceId={selectedResource?.id ?? null}
      spatialFilter={spatialFilter}
      drawMode={activeDraw?.purpose === "query" ? activeDraw.mode : null}
      queryResult={queryResult}
      loadingProfile={loadingProfile}
      querying={querying}
      permissions={user.permissions}
      onFilterResources={loadResources}
      onSelectResource={handleSelectResource}
      onDrawModeChange={setQueryDrawMode}
      onClearSpatialFilter={() => setSpatialFilter(null)}
      onQuery={handleQuery}
      onLoadResult={handleLoadResult}
      onLoadRaster={handleLoadRaster}
    />
  );

  return (
    <Layout className="workspace">
      <Layout.Header className="workspace-header">
        <div className="header-left">
          <div className="brand-block">
            <Database size={22} />
            <div>
              <Typography.Title level={4}>
                {bootstrap.systemName}
              </Typography.Title>
            </div>
          </div>
          <div className="header-primary-actions">
            {user.permissions.canBrowseData && (
              <Popover
                trigger="click"
                placement="bottomLeft"
                open={dataPanelOpen}
                onOpenChange={setDataPanelOpen}
                overlayClassName="data-popover"
                content={dataPanel}
              >
                <Button icon={<Layers size={16} />}>数据管理</Button>
              </Popover>
            )}
            {user.permissions.canAccessAdmin && (
              <Button
                icon={<Settings size={16} />}
                onClick={() => window.location.assign("/admin/")}
              >
                后台管理
              </Button>
            )}
          </div>
        </div>
        <div className="header-account-actions">
          <div className="role-tags">
            {user.roles.map((role) => (
              <Tag key={role} color="green">
                {role}
              </Tag>
            ))}
          </div>
          <Button icon={<ShieldCheck size={16} />} className="user-button">
            {user.displayName}
          </Button>
          <Button icon={<LogOut size={16} />} onClick={handleLogout}>
            退出
          </Button>
        </div>
      </Layout.Header>
      <div className="workspace-body">
        <main className="map-stage">
          <MapCanvas
            bootstrap={bootstrap}
            loadedLayers={mapLayers}
            drawMode={activeDraw?.mode ?? null}
            spatialFilter={spatialFilter}
            exportClipGeometry={exportClipGeometry}
            onDrawComplete={handleDrawComplete}
            onMapReady={handleMapReady}
            onMapDestroy={handleMapDestroy}
          />
        </main>
        <aside className="floating-panel floating-panel-left">
          <LayerContext.Provider value={layerContextValue}>
            <LayerPanel />
          </LayerContext.Provider>
        </aside>
        <aside
          className="floating-panel floating-panel-right"
          aria-label="右侧预留面板"
        />
        <aside className="floating-panel-bottom" aria-label="底部预留面板" />
      </div>
    </Layout>
  );
}
