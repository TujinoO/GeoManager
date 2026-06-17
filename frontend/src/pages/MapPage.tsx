import {
  ApartmentOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  ConfigProvider,
  Empty,
  Form,
  Input,
  Layout,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tabs,
  Typography,
} from "antd";
import type { LngLatBounds, Map as MapboxMap } from "mapbox-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { fitBoundsOptionsForVisibleFrame } from "../map/visibleViewport";
import { workspacePanelTheme } from "../theme";
import type {
  Achievement,
  AttributeFilter,
  DataResource,
  DataResourceProfile,
  ExportLayerItem,
  FeatureInfo,
  GeoJsonGeometry,
  GeoJsonValidationWarning,
  LoadedLayer,
  LoadedLayerGroup,
  LoadedRasterLayer,
  LoadedVectorLayer,
  MapViewState,
  ResourceFilters,
  ResourceListItem,
  SavedWorkspaceLayer,
  SavedWorkspaceLayerGroup,
  SpatialFilter,
  WorkspaceScene,
  WorkspaceSceneKind,
  WorkspaceSceneSnapshot,
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
  canViewDataOverview: false,
  canBrowseData: false,
  canQueryData: false,
  canUploadData: false,
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
  const [searchParams] = useSearchParams();

  const [resources, setResources] = useState<ResourceListItem[]>([]);
  const [workspaceScenes, setWorkspaceScenes] = useState<WorkspaceScene[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [resourceSearchKeyword, setResourceSearchKeyword] = useState("");
  const [selectedResource, setSelectedResource] =
    useState<ResourceListItem | null>(null);
  const [resourceProfile, setResourceProfile] =
    useState<DataResourceProfile | null>(null);
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
  const [currentMapView, setCurrentMapView] = useState<MapViewState | null>(
    null,
  );
  const mapInstanceRef = useRef<MapboxMap | null>(null);
  const startupScanStartedRef = useRef(false);
  const loadedSceneIdRef = useRef<number | null>(null);
  const permissions = user?.permissions ?? emptyPermissions;
  const userRoles = user?.roles ?? [];

  const layerGroups = useLayerGroups(user ? `user-${user.id}` : "anonymous");
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

  const loadSearchItems = useCallback(async () => {
    if (!permissions.canBrowseData) {
      return;
    }
    try {
      const [sceneResponse, achievementResponse] = await Promise.all([
        api.workspaces(),
        api.achievements(),
      ]);
      setWorkspaceScenes(sceneResponse.items);
      setAchievements(achievementResponse.items);
    } catch (error) {
      message.warning(
        error instanceof Error ? error.message : "搜索内容加载失败",
      );
    }
  }, [message, permissions.canBrowseData]);

  useEffect(() => {
    void loadSearchItems();
  }, [loadSearchItems]);

  useEffect(() => {
    const keyword = searchParams.get("resourceQ")?.trim() ?? "";
    setResourceSearchKeyword(keyword);
    if (!permissions.canBrowseData) {
      return;
    }
    if (keyword) {
      setDataPanelOpen(true);
      void loadResources({ q: keyword });
    }
  }, [loadResources, permissions.canBrowseData, searchParams]);

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

  async function fetchResourceProfile(resource: ResourceListItem) {
    setSelectedResource(resource);
    setLoadingProfile(true);
    try {
      const profile = await api.resourceProfile(resource);
      setResourceProfile(profile);
      return profile;
    } catch (error) {
      setResourceProfile(null);
      message.error(
        error instanceof Error ? error.message : "读取字段和元信息失败",
      );
      return null;
    } finally {
      setLoadingProfile(false);
    }
  }

  async function handleSelectResource(resource: ResourceListItem) {
    await fetchResourceProfile(resource);
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

  async function handleQueryAndLoad(attributeFilters: AttributeFilter[]) {
    if (!permissions.canQueryData || !permissions.canLoadVectorLayer) {
      message.warning(permissionDeniedMessage);
      return;
    }
    if (!selectedResource) {
      message.warning("请先选择数据资源");
      return;
    }
    if (!resourceProfile) {
      message.warning("请先等待字段和元信息加载完成");
      return;
    }
    await loadVectorResource(
      selectedResource,
      resourceProfile,
      attributeFilters,
      {
        spatialFilter,
        errorMessage: "查询并加载失败",
      },
    );
  }

  async function handleQuickLoadResource(resource: ResourceListItem) {
    const profile = await fetchResourceProfile(resource);
    if (!profile) {
      return;
    }
    if (resource.isRenderable && resource.dataType === "raster") {
      loadRasterResource(resource, profile);
      return;
    }
    if (resource.isQueryable) {
      await loadVectorResource(resource, profile, [], {
        spatialFilter: null,
        errorMessage: "快速加载失败",
      });
    }
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
    loadRasterResource(selectedResource, resourceProfile);
  }

  function loadRasterResource(
    resource: DataResource,
    profile: DataResourceProfile,
  ) {
    if (!permissions.canLoadRasterLayer) {
      message.warning(permissionDeniedMessage);
      return;
    }
    const group = createRasterLayerGroup(resource, profile);
    if (!group) return;
    layerGroups.addGroup(group);
    setSelectedLayerId(group.children[0]?.id ?? null);
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

  async function loadVectorResource(
    resource: ResourceListItem,
    profile: DataResourceProfile,
    attributeFilters: AttributeFilter[],
    options: {
      spatialFilter: SpatialFilter | null;
      errorMessage: string;
    },
  ) {
    if (!permissions.canQueryData || !permissions.canLoadVectorLayer) {
      message.warning(permissionDeniedMessage);
      return;
    }
    setQuerying(true);
    try {
      const result = await api.queryResource(resource, {
        attributeFilters,
        spatialFilter: options.spatialFilter,
        limit: bootstrap.limits.queryResultLimit,
      });
      showGeojsonWarnings(notification, result.warnings);
      const resultMessage = `查询命中 ${result.totalCount} 条，返回 ${result.returnedCount} 条`;
      if (result.returnedCount === 0) {
        message.warning(resultMessage);
        return;
      }
      const group = createVectorLayerGroup(resource, profile, result, {
        attributeFilters,
        spatialFilter: options.spatialFilter,
      });
      layerGroups.addGroup(group);
      setSelectedLayerId(group.children[0]?.id ?? null);
      setDataPanelOpen(false);
      message.success(resultMessage);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : options.errorMessage,
      );
    } finally {
      setQuerying(false);
    }
  }

  const handleMapReady = useCallback(
    (map: MapboxMap) => {
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
          map.fitBounds(bounds, fitBoundsOptionsForVisibleFrame(map));
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
        fitBoundsOptionsForVisibleFrame(map),
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
        .filter(Boolean) as LngLatBounds[];
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
        map.fitBounds(firstRasterBound, fitBoundsOptionsForVisibleFrame(map));
        return;
      }
      if (!bounds) {
        message.warning("无法计算图层组范围");
        return;
      }
      map.fitBounds(bounds, fitBoundsOptionsForVisibleFrame(map));
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

  const saveWorkspace = useCallback(
    async (
      kind: WorkspaceSceneKind,
      values: { name: string; description?: string; targetId?: number },
    ) => {
      const label = kind === "project" ? "工程" : "专题";
      const notificationKey = `workspace-save-${kind}-${Date.now()}`;
      const targetName = values.name.trim();
      try {
        openWorkspaceProgressNotification(notification, {
          key: notificationKey,
          title: values.targetId ? `正在覆盖${label}` : `正在保存${label}`,
          percent: 15,
          status: "active",
          detail: "正在整理当前图层、视图和符号化配置",
        });
        const snapshot = workspaceSnapshot(
          layerGroups.groups,
          selectedLayerId,
          currentMapView,
        );
        openWorkspaceProgressNotification(notification, {
          key: notificationKey,
          title: values.targetId ? `正在覆盖${label}` : `正在保存${label}`,
          percent: 55,
          status: "active",
          detail: "正在写入工作区快照",
        });
        const saved = values.targetId
          ? await api.updateWorkspace(values.targetId, {
              kind,
              name: targetName,
              description: values.description?.trim() ?? "",
              snapshot,
            })
          : await api.createWorkspace({
              kind,
              name: targetName,
              description: values.description?.trim() ?? "",
              snapshot,
            });
        if ("id" in saved) {
          setWorkspaceScenes((current) => {
            const others = current.filter((item) => item.id !== saved.id);
            return [saved, ...others];
          });
        }
        openWorkspaceProgressNotification(notification, {
          key: notificationKey,
          title: values.targetId ? `${label}已覆盖` : `${label}已保存`,
          percent: 100,
          status: "success",
          detail: targetName,
        });
      } catch (error) {
        openWorkspaceProgressNotification(notification, {
          key: notificationKey,
          title: `${label}保存失败`,
          percent: 100,
          status: "exception",
          detail: error instanceof Error ? error.message : `${label}保存失败`,
        });
        throw error;
      }
    },
    [currentMapView, layerGroups.groups, notification, selectedLayerId],
  );

  const restoreWorkspaceGroups = useCallback(
    async (
      savedGroups: WorkspaceSceneSnapshot["groups"],
      onProgress?: (state: { percent: number; detail: string }) => void,
    ): Promise<LoadedLayerGroup[]> => {
      if (!Array.isArray(savedGroups)) {
        return [];
      }
      const totalLayers = savedGroups.reduce(
        (total, group) => total + (group.children?.length ?? 0),
        0,
      );
      let processedLayers = 0;
      const updateRestoreProgress = (detail: string) => {
        if (!onProgress) {
          return;
        }
        const layerProgress =
          totalLayers > 0
            ? Math.round((processedLayers / totalLayers) * 70)
            : 70;
        onProgress({
          percent: Math.min(85, 10 + layerProgress),
          detail,
        });
      };
      const restored: LoadedLayerGroup[] = [];
      for (const savedGroup of savedGroups) {
        const restoredChildren: LoadedLayer[] = [];
        for (const savedLayer of savedGroup.children ?? []) {
          updateRestoreProgress(`正在恢复图层：${savedLayer.name}`);
          if (isLoadedVectorLayer(savedLayer)) {
            restoredChildren.push(savedLayer);
            processedLayers += 1;
            updateRestoreProgress(`已恢复图层：${savedLayer.name}`);
            continue;
          }
          if (savedLayer.layerType === "vector") {
            if (
              !savedLayer.query ||
              !permissions.canQueryData ||
              !permissions.canLoadVectorLayer
            ) {
              processedLayers += 1;
              updateRestoreProgress(`已跳过图层：${savedLayer.name}`);
              continue;
            }
            try {
              const profile = await api.resourceProfile(
                savedLayer.sourceResource,
              );
              const result = await api.queryResource(
                savedLayer.sourceResource,
                {
                  attributeFilters: savedLayer.query.attributeFilters,
                  spatialFilter: savedLayer.query.spatialFilter,
                  limit: bootstrap.limits.queryResultLimit,
                },
              );
              showGeojsonWarnings(notification, result.warnings);
              const queryGroup = createVectorLayerGroup(
                savedLayer.sourceResource,
                profile,
                result,
                savedLayer.query,
              );
              const queryLayer = queryGroup.children[0];
              if (queryLayer?.layerType === "vector") {
                restoredChildren.push({
                  ...queryLayer,
                  id: savedLayer.id,
                  name: savedLayer.name,
                  visible: savedLayer.visible,
                  summary: savedLayer.summary,
                  metadata: savedLayer.metadata,
                  symbolization:
                    savedLayer.symbolization as LoadedVectorLayer["symbolization"],
                  fields: savedLayer.fields,
                });
              }
            } catch (error) {
              message.warning(
                error instanceof Error
                  ? `图层“${savedLayer.name}”恢复失败：${error.message}`
                  : `图层“${savedLayer.name}”恢复失败`,
              );
            }
            processedLayers += 1;
            updateRestoreProgress(`已处理图层：${savedLayer.name}`);
            continue;
          }
          restoredChildren.push({
            id: savedLayer.id,
            name: savedLayer.name,
            layerType: "raster",
            sourceResource: savedLayer.sourceResource as DataResource,
            tileUrl: savedLayer.tileUrl,
            imageCoordinates: savedLayer.imageCoordinates,
            rasterDatasetId: savedLayer.rasterDatasetId,
            rasterLayerId: savedLayer.rasterLayerId,
            rasterMetadata: savedLayer.rasterMetadata,
            renderStatus: savedLayer.renderStatus,
            renderProgress: savedLayer.renderProgress,
            renderMessages: savedLayer.renderMessages,
            geometryType: savedLayer.geometryType,
            visible: savedLayer.visible,
            summary: savedLayer.summary,
            metadata: savedLayer.metadata,
            symbolization:
              savedLayer.symbolization as LoadedRasterLayer["symbolization"],
            fields: savedLayer.fields,
          });
          processedLayers += 1;
          updateRestoreProgress(`已恢复图层：${savedLayer.name}`);
        }
        if (restoredChildren.length > 0) {
          restored.push({ ...savedGroup, children: restoredChildren });
        }
      }
      return restored;
    },
    [
      bootstrap.limits.queryResultLimit,
      message,
      notification,
      permissions.canLoadVectorLayer,
      permissions.canQueryData,
    ],
  );

  const loadWorkspaceScene = useCallback(
    async (scene: WorkspaceScene) => {
      const label = scene.kind === "project" ? "工程" : "专题";
      const notificationKey = `workspace-load-${scene.id}`;
      const snapshot = scene.snapshot as WorkspaceSceneSnapshot;
      if (!Array.isArray(snapshot.groups)) {
        message.warning("该工作区快照不包含可恢复的图层");
        return;
      }
      openWorkspaceProgressNotification(notification, {
        key: notificationKey,
        title: `正在加载${label}`,
        percent: 8,
        status: "active",
        detail: scene.name,
      });
      const restoredGroups = await restoreWorkspaceGroups(
        snapshot.groups,
        (state) => {
          openWorkspaceProgressNotification(notification, {
            key: notificationKey,
            title: `正在加载${label}`,
            percent: state.percent,
            status: "active",
            detail: state.detail,
          });
        },
      );
      if (restoredGroups.length === 0) {
        openWorkspaceProgressNotification(notification, {
          key: notificationKey,
          title: `${label}加载失败`,
          percent: 100,
          status: "exception",
          detail: "该工作区快照没有可恢复的图层",
        });
        message.warning("该工作区快照没有可恢复的图层");
        return;
      }
      openWorkspaceProgressNotification(notification, {
        key: notificationKey,
        title: `正在加载${label}`,
        percent: 90,
        status: "active",
        detail: "正在应用图层和地图视图",
      });
      layerGroups.replaceGroups(restoredGroups);
      setSelectedLayerId(snapshot.selectedLayerId ?? null);
      setTableLayer(null);
      setSelectedFeature(null);
      if (snapshot.mapView && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo({
          center: snapshot.mapView.center,
          zoom: snapshot.mapView.zoom,
          bearing: snapshot.mapView.bearing,
          pitch: snapshot.mapView.pitch,
          duration: 800,
          essential: true,
        });
      }
      openWorkspaceProgressNotification(notification, {
        key: notificationKey,
        title: `${label}已加载`,
        percent: 100,
        status: "success",
        detail: scene.name,
      });
    },
    [layerGroups, message, notification, restoreWorkspaceGroups],
  );

  useEffect(() => {
    const sceneIdText = searchParams.get("sceneId")?.trim();
    if (!sceneIdText) {
      loadedSceneIdRef.current = null;
      return;
    }
    const sceneId = Number(sceneIdText);
    if (!Number.isInteger(sceneId) || sceneId <= 0) {
      message.warning("工程或专题参数无效");
      return;
    }
    if (loadedSceneIdRef.current === sceneId) {
      return;
    }
    loadedSceneIdRef.current = sceneId;
    async function loadSceneFromUrl() {
      try {
        const scene =
          workspaceScenes.find((item) => item.id === sceneId) ??
          (await api.workspace(sceneId));
        await loadWorkspaceScene(scene);
      } catch (error) {
        loadedSceneIdRef.current = null;
        message.error(
          error instanceof Error ? error.message : "工程或专题加载失败",
        );
      }
    }
    void loadSceneFromUrl();
  }, [loadWorkspaceScene, message, searchParams, workspaceScenes]);

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
    replaceGroups: layerGroups.replaceGroups,
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
    moveLayer: layerGroups.moveLayer,
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
    workspaceScenes,
    saveWorkspace,
  };

  const renderDataPanel = () => (
    <DataPanel
      resources={resources}
      profile={resourceProfile}
      selectedResourceId={selectedResource?.id ?? null}
      loadingProfile={loadingProfile}
      querying={querying}
      permissions={permissions}
      searchKeyword={resourceSearchKeyword}
      onFilterResources={loadResources}
      onSelectResource={handleSelectResource}
      onQuickLoadResource={handleQuickLoadResource}
      onQueryAndLoad={handleQueryAndLoad}
      onLoadRaster={handleLoadRaster}
    />
  );
  const dataPanel = renderDataPanel();

  return (
    <Layout className="workspace">
      <WorkspaceHeader
        activeTab="map"
        canBrowseData={permissions.canBrowseData}
        dataPanel={dataPanel}
        dataPanelOpen={dataPanelOpen}
        resources={resources}
        workspaceScenes={workspaceScenes}
        achievements={achievements}
        searchKeyword={resourceSearchKeyword}
        onDataPanelOpenChange={setDataPanelOpen}
        onGlobalSearch={(keyword) => {
          setResourceSearchKeyword(keyword);
        }}
        onQuickLoadResource={(resource) =>
          void handleQuickLoadResource(resource)
        }
        onLoadWorkspaceScene={loadWorkspaceScene}
        onOpenAchievement={(achievement) => {
          message.info(`成果详情正在接入：${achievement.title}`);
        }}
        onSearchFocus={() => {
          if (permissions.canBrowseData) {
            void loadSearchItems();
          }
        }}
      />
      <div className="workspace-body">
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
            onViewStateChange={setCurrentMapView}
          />
        </main>
        <aside className="floating-panel floating-panel-left">
          <ConfigProvider theme={workspacePanelTheme}>
            <LayerContext.Provider value={layerContextValue}>
              <Tabs
                className="workspace-side-tabs workspace-left-tabs"
                defaultActiveKey="data"
                size="small"
                items={[
                  {
                    key: "data",
                    label: (
                      <span className="tab-label">
                        <DatabaseOutlined style={{ fontSize: 14 }} />
                        数据
                      </span>
                    ),
                    children: renderDataPanel(),
                  },
                  {
                    key: "layers",
                    label: (
                      <span className="tab-label">
                        <ApartmentOutlined style={{ fontSize: 14 }} />
                        图层
                      </span>
                    ),
                    children: <LayerPanel />,
                  },
                  {
                    key: "projects",
                    label: (
                      <span className="tab-label">
                        <FolderOpenOutlined style={{ fontSize: 14 }} />
                        工程
                      </span>
                    ),
                    children: (
                      <WorkspaceScenePanel
                        kind="project"
                        items={workspaceScenes.filter(
                          (scene) => scene.kind === "project",
                        )}
                        onLoad={loadWorkspaceScene}
                        onRefresh={loadSearchItems}
                        onUpdate={(updated) =>
                          setWorkspaceScenes((current) =>
                            current.map((item) =>
                              item.id === updated.id ? updated : item,
                            ),
                          )
                        }
                        onDelete={(sceneId) =>
                          setWorkspaceScenes((current) =>
                            current.filter((item) => item.id !== sceneId),
                          )
                        }
                      />
                    ),
                  },
                  {
                    key: "topics",
                    label: (
                      <span className="tab-label">
                        <AppstoreOutlined style={{ fontSize: 14 }} />
                        专题
                      </span>
                    ),
                    children: (
                      <WorkspaceScenePanel
                        kind="topic"
                        items={workspaceScenes.filter(
                          (scene) => scene.kind === "topic",
                        )}
                        onLoad={loadWorkspaceScene}
                        onRefresh={loadSearchItems}
                        onUpdate={(updated) =>
                          setWorkspaceScenes((current) =>
                            current.map((item) =>
                              item.id === updated.id ? updated : item,
                            ),
                          )
                        }
                        onDelete={(sceneId) =>
                          setWorkspaceScenes((current) =>
                            current.filter((item) => item.id !== sceneId),
                          )
                        }
                      />
                    ),
                  },
                ]}
              />
              <LayerDataTableModal
                layer={tableLayer}
                open={Boolean(tableLayer)}
                onClose={() => setTableLayer(null)}
                onSelectionChange={handleSelectionChange}
              />
            </LayerContext.Provider>
          </ConfigProvider>
        </aside>
        <aside
          className="floating-panel floating-panel-right"
          aria-label="要素信息面板"
        >
          <ConfigProvider theme={workspacePanelTheme}>
            <RightSidePanel
              selectedFeature={selectedFeature}
              currentView={currentMapView}
            />
          </ConfigProvider>
        </aside>
        <aside
          className="floating-panel-bottom"
          aria-label="底部数据与绘制面板"
        >
          <ConfigProvider theme={workspacePanelTheme}>
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
          </ConfigProvider>
        </aside>
      </div>
    </Layout>
  );
}

function WorkspaceScenePanel({
  kind,
  items,
  onLoad,
  onRefresh,
  onUpdate,
  onDelete,
}: {
  kind: WorkspaceSceneKind;
  items: WorkspaceScene[];
  onLoad: (scene: WorkspaceScene) => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  onUpdate: (scene: WorkspaceScene) => void;
  onDelete: (sceneId: number) => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ name: string; description: string }>();
  const [loading, setLoading] = useState(false);
  const [editingScene, setEditingScene] = useState<WorkspaceScene | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const label = kind === "project" ? "工程" : "专题";

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      await onRefresh();
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : `${label}加载失败`,
      );
    } finally {
      setLoading(false);
    }
  }, [label, message, onRefresh]);

  async function removeScene(scene: WorkspaceScene) {
    try {
      await api.deleteWorkspace(scene.id);
      onDelete(scene.id);
      message.success(`${label}已删除`);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : `${label}删除失败`,
      );
    }
  }

  function openEditScene(scene: WorkspaceScene) {
    setEditingScene(scene);
    form.setFieldsValue({
      name: scene.name,
      description: scene.description,
    });
  }

  async function submitEditScene() {
    if (!editingScene) {
      return;
    }
    let values: { name: string; description?: string };
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const name = values.name.trim();
    const description = values.description?.trim() ?? "";
    setSavingEdit(true);
    try {
      const updated = await api.updateWorkspace(editingScene.id, {
        name,
        description,
      });
      if ("id" in updated) {
        onUpdate(updated);
      }
      setEditingScene(null);
      message.success(`${label}已更新`);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : `${label}更新失败`,
      );
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <section className="panel-section topic-workspace-panel">
      <Button size="small" onClick={() => void loadItems()} loading={loading}>
        刷新
      </Button>
      {items.length === 0 ? (
        <Empty
          className="layer-empty"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={`暂无已保存${label}`}
        />
      ) : (
        <div className="topic-scenario-list">
          {items.map((scene) => (
            <div key={scene.id} className="topic-scenario-row">
              <div className="topic-scenario-main">
                <span>
                  <strong>{scene.name}</strong>
                  <small>
                    {scene.description ||
                      new Date(scene.updatedAt).toLocaleString("zh-CN", {
                        hour12: false,
                      })}
                  </small>
                </span>
              </div>
              <Space size={4}>
                <Button size="small" onClick={() => void onLoad(scene)}>
                  加载
                </Button>
                <Button
                  size="small"
                  icon={<EditOutlined style={{ fontSize: 14 }} />}
                  onClick={() => openEditScene(scene)}
                />
                <Popconfirm
                  title={`删除${label}`}
                  description={`确认删除“${scene.name}”？`}
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => removeScene(scene)}
                >
                  <Button
                    className="topic-scenario-delete-button"
                    size="small"
                    danger
                    icon={<DeleteOutlined style={{ fontSize: 14 }} />}
                  />
                </Popconfirm>
              </Space>
            </div>
          ))}
        </div>
      )}
      <Modal
        title={`编辑${label}`}
        open={Boolean(editingScene)}
        okText="保存"
        cancelText="取消"
        confirmLoading={savingEdit}
        onOk={() => void submitEditScene()}
        onCancel={() => setEditingScene(null)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="name"
            label={`${label}名称`}
            rules={[
              {
                required: true,
                whitespace: true,
                message: `请输入${label}名称`,
              },
              { max: 160, message: `${label}名称不能超过 160 个字符` },
            ]}
          >
            <Input placeholder={`请输入${label}名称`} />
          </Form.Item>
          <Form.Item name="description" label={`${label}说明`}>
            <Input.TextArea
              rows={4}
              maxLength={1000}
              showCount
              placeholder={`请输入${label}说明`}
            />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}

function workspaceSnapshot(
  groups: LoadedLayerGroup[],
  selectedLayerId: string | null,
  mapView: MapViewState | null,
): WorkspaceSceneSnapshot {
  return {
    version: 2,
    groups: groups.map(toSavedWorkspaceGroup),
    selectedLayerId,
    mapView,
    savedAt: new Date().toISOString(),
  };
}

function toSavedWorkspaceGroup(
  group: LoadedLayerGroup,
): SavedWorkspaceLayerGroup {
  return {
    ...group,
    children: group.children.map(toSavedWorkspaceLayer),
  };
}

function toSavedWorkspaceLayer(layer: LoadedLayer): SavedWorkspaceLayer {
  const base = {
    id: layer.id,
    name: layer.name,
    layerType: layer.layerType,
    sourceResource: layer.sourceResource,
    geometryType: layer.geometryType,
    visible: layer.visible,
    summary: layer.summary,
    metadata: layer.metadata,
    symbolization: layer.symbolization,
    fields: layer.fields,
  };
  if (layer.layerType === "vector") {
    return {
      ...base,
      layerType: "vector",
      query: layer.query ?? {
        attributeFilters: [],
        spatialFilter: null,
      },
    };
  }
  return {
    ...base,
    layerType: "raster",
    tileUrl: layer.tileUrl,
    imageCoordinates: layer.imageCoordinates,
    rasterDatasetId: layer.rasterDatasetId,
    rasterLayerId: layer.rasterLayerId,
    rasterMetadata: layer.rasterMetadata,
    renderStatus: layer.renderStatus,
    renderProgress: layer.renderProgress,
    renderMessages: layer.renderMessages,
  };
}

function isLoadedVectorLayer(
  layer: SavedWorkspaceLayer | LoadedLayer,
): layer is LoadedVectorLayer {
  return (
    layer.layerType === "vector" &&
    "geojson" in layer &&
    typeof layer.geojson === "object" &&
    layer.geojson !== null
  );
}

function openWorkspaceProgressNotification(
  notification: ReturnType<typeof App.useApp>["notification"],
  options: {
    key: string;
    title: string;
    percent: number;
    status: "active" | "success" | "exception";
    detail: string;
  },
) {
  notification.open({
    key: options.key,
    message: options.title,
    description: (
      <Space orientation="vertical" size={6} style={{ width: "100%" }}>
        <Space size={8}>
          <Spin spinning={options.status === "active"} size="small" />
          <Typography.Text type="secondary">
            {options.percent}% · {options.detail}
          </Typography.Text>
        </Space>
      </Space>
    ),
    duration: options.status === "active" ? 0 : 3,
  });
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
