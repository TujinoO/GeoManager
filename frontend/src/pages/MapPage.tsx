import {
  AimOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  DownOutlined,
  FolderOpenOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { App, Button, ConfigProvider, Layout, Spin, Tabs, Tooltip } from "antd";
import type { LngLatBounds, Map as MapboxMap } from "mapbox-gl";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import DataPanel from "../components/DataPanel";
import LayerDataTableModal from "../components/LayerDataTableModal";
import LayerPanel from "../components/LayerPanel";
import RightSidePanel from "../components/RightSidePanel";
import SpatialQueryWorkbench, {
  type SpatialQueryTarget,
  type SpatialQueryWorkbenchResult,
} from "../components/SpatialQueryWorkbench";
import WorkspaceScenePanel from "../components/WorkspaceScenePanel";
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
import { useWorkspaceScenes } from "../hooks/useWorkspaceScenes";
import { clearFeatureState, getMapState } from "../map/mapState";
import {
  exportMapRangeImage,
  inferBasemapTileZoomRange,
  type MapImageExportOptions,
  type TileZoomRange,
} from "../map/mapExport";
import type { DrawMode } from "../map/spatialDraw";
import { workspacePanelTheme } from "../theme";
import type {
  AttributeFilter,
  DataDomainType,
  DataSchemaSummary,
  DataResource,
  DataResourceProfile,
  ExportLayerItem,
  FeatureInfo,
  GeoJsonFeatureCollection,
  GeoJsonGeometry,
  LoadedLayer,
  LoadedRasterLayer,
  LoadedVectorLayer,
  MapViewState,
  ResourceFilters,
  ResourceListItem,
  ResourceQueryResult,
  ResourceVisualizationSummary,
  SpatialFilter,
} from "../types";
import { downloadBlob } from "../utils/download";
import {
  boundsFromImageCoordinates,
  combinedFeatureBounds,
  fitGeojsonBounds,
  geometryFromBoundsText,
  rectangleGeometry,
  sourceIdFor,
} from "../utils/geometry";
import {
  createRasterLayerGroup,
  createVectorLayerGroup,
} from "../utils/layerFactory";
import { resourceSpatialExtent } from "../utils/resources";
import { showGeojsonWarnings } from "../workspace/workspaceNotifications";

type DrawPurpose = "query";
type LeftPanelTabKey = "data" | "layers" | "projects" | "topics";
const leftPanelTabKeys = new Set<string>([
  "data",
  "layers",
  "projects",
  "topics",
]);

interface SpatialQueryContext {
  target: SpatialQueryTarget;
  targetName: string;
  resource: ResourceListItem;
  profile: DataResourceProfile;
  query: {
    attributeFilters: AttributeFilter[];
    spatialFilter: SpatialFilter | null;
  };
}

const emptyPermissions = {
  canAccessAdmin: false,
  canManageFeaturePermissions: false,
  canCreateUser: false,
  canViewOperationLogs: false,
  canViewAllOperationLogs: false,
  canViewOwnOperationLogs: false,
  canViewGroupOperationLogs: false,
  canViewSystemLogs: false,
  canManageSystemSettings: false,
  canManageDataBackup: false,
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
  canViewDataResources: false,
  canCreateDataResources: false,
  canChangeDataResources: false,
  canDeleteDataResources: false,
  canLoadVectorLayer: false,
  canLoadRasterLayer: false,
  canUseCustomSymbolization: false,
  canUseAiInterpretation: false,
  canExportData: false,
  canViewWorkspaces: false,
  canCreateWorkspaces: false,
  canChangeWorkspaces: false,
  canDeleteWorkspaces: false,
  canManageRasterData: false,
};

const fallbackDomainTypeOptions: Array<{
  value: DataDomainType;
  label: string;
}> = [
  { value: "germplasm", label: "种质数据" },
  { value: "individual", label: "个体数据" },
  { value: "community", label: "群落数据" },
  { value: "population", label: "种群数据" },
  { value: "field_survey", label: "野外调查数据" },
  { value: "remote_sensing", label: "遥感影像数据" },
  { value: "molecular", label: "分子数据" },
  { value: "genome", label: "基因组数据" },
];

const MapCanvas = lazy(() => import("../components/MapCanvas"));

interface LastGeoInsightCache {
  resource: ResourceListItem | null;
  profile: DataResourceProfile | null;
  layer: LoadedLayer | null;
  feature: FeatureInfo | null;
  summary: ResourceVisualizationSummary | null;
}

let lastGeoInsightCache: LastGeoInsightCache | null = null;

export default function MapPage() {
  const { bootstrap, user } = useAppContext();
  const { message, notification } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialGeoInsightCache = lastGeoInsightCache;

  const [resources, setResources] = useState<ResourceListItem[]>([]);
  const [dataSchema, setDataSchema] = useState<DataSchemaSummary | null>(null);
  const [resourceSearchKeyword, setResourceSearchKeyword] = useState("");
  const [selectedResource, setSelectedResource] =
    useState<ResourceListItem | null>(
      () => initialGeoInsightCache?.resource ?? null,
    );
  const [resourceProfile, setResourceProfile] =
    useState<DataResourceProfile | null>(
      () => initialGeoInsightCache?.profile ?? null,
    );
  const [spatialTargetResource, setSpatialTargetResource] =
    useState<ResourceListItem | null>(null);
  const [spatialTargetResourceProfile, setSpatialTargetResourceProfile] =
    useState<DataResourceProfile | null>(null);
  const [spatialTargetLayerId, setSpatialTargetLayerId] = useState<
    string | null
  >(null);
  const [spatialFilter, setSpatialFilter] = useState<SpatialFilter | null>(
    null,
  );
  const [spatialQuerying, setSpatialQuerying] = useState(false);
  const [spatialQueryData, setSpatialQueryData] =
    useState<ResourceQueryResult | null>(null);
  const [spatialQueryContext, setSpatialQueryContext] =
    useState<SpatialQueryContext | null>(null);
  const [spatialQueryResult, setSpatialQueryResult] =
    useState<SpatialQueryWorkbenchResult | null>(null);
  const [spatialWorkbenchOpen, setSpatialWorkbenchOpen] = useState(false);
  const [activeDraw, setActiveDraw] = useState<{
    purpose: DrawPurpose;
    mode: NonNullable<DrawMode>;
  } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<FeatureInfo | null>(
    () => initialGeoInsightCache?.feature ?? null,
  );
  const [visualizationSummary, setVisualizationSummary] =
    useState<ResourceVisualizationSummary | null>(
      () => initialGeoInsightCache?.summary ?? null,
    );
  const [visualizationSummaryLoading, setVisualizationSummaryLoading] =
    useState(false);
  const [visualizationSummaryError, setVisualizationSummaryError] = useState<
    string | null
  >(null);
  const [loadingSpatialTargetProfile, setLoadingSpatialTargetProfile] =
    useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(
    () => initialGeoInsightCache?.layer?.id ?? null,
  );
  const [rememberedGeoInsight, setRememberedGeoInsight] =
    useState<LastGeoInsightCache | null>(() => initialGeoInsightCache);
  const [activeLeftPanel, setActiveLeftPanel] =
    useState<LeftPanelTabKey>("data");
  const [tableLayer, setTableLayer] = useState<LoadedLayer | null>(null);
  const [visibleLayerExtentIds, setVisibleLayerExtentIds] = useState<
    Set<string>
  >(() => new Set());
  const [currentMapView, setCurrentMapView] = useState<MapViewState | null>(
    null,
  );
  const [mapObject, setMapObject] = useState<MapboxMap | null>(null);
  const [exportTileZoomRange, setExportTileZoomRange] = useState<TileZoomRange>(
    { min: 0, max: 22 },
  );
  const mapInstanceRef = useRef<MapboxMap | null>(null);
  const startupScanStartedRef = useRef(false);
  const loadedSceneIdRef = useRef<number | null>(null);
  const lastMapErrorRef = useRef<{ message: string; timestamp: number } | null>(
    null,
  );
  const permissions = user?.permissions ?? emptyPermissions;
  const userRoles = user?.roles ?? [];
  const domainTypeOptions = useMemo(
    () =>
      dataSchema?.domains.length
        ? dataSchema.domains.map((domain) => ({
            value: domain.code,
            label: domain.name,
          }))
        : fallbackDomainTypeOptions,
    [dataSchema?.domains],
  );
  const selectedDomainType = useMemo(() => {
    const value = searchParams.get("domainType");
    return domainTypeOptions.some((option) => option.value === value)
      ? (value as DataDomainType)
      : null;
  }, [domainTypeOptions, searchParams]);
  const urlResourceFilters = useMemo<ResourceFilters>(() => {
    const keyword = searchParams.get("resourceQ")?.trim() ?? "";
    return {
      ...(keyword ? { q: keyword } : {}),
      ...(selectedDomainType ? { domainType: selectedDomainType } : {}),
    };
  }, [searchParams, selectedDomainType]);

  const layerGroups = useLayerGroups(user ? `user-${user.id}` : "anonymous");
  const { startRasterRender, setMapInstance } = useRasterRender(
    layerGroups.updateRasterLayer,
  );
  const permissionDeniedMessage = `当前角色"${userRoles.length > 0 ? userRoles.join("、") : "未分配角色"}"无权限`;
  const handleWorkspaceLoaded = useCallback(() => {
    setTableLayer(null);
    setSelectedFeature(null);
  }, []);
  const {
    workspaceScenes,
    loadWorkspaceScenes,
    loadWorkspaceScene,
    loadWorkspaceSceneById,
    saveWorkspace,
    updateWorkspaceScene,
    deleteWorkspaceScene,
  } = useWorkspaceScenes({
    canBrowseData: permissions.canBrowseData,
    canQueryData: permissions.canQueryData,
    canLoadVectorLayer: permissions.canLoadVectorLayer,
    queryResultLimit: bootstrap.limits.queryResultLimit,
    groups: layerGroups.groups,
    selectedLayerId,
    currentMapView,
    mapRef: mapInstanceRef,
    replaceGroups: layerGroups.replaceGroups,
    setSelectedLayerId,
    onWorkspaceLoaded: handleWorkspaceLoaded,
  });

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

  const allLayers = useMemo(
    () => layerGroups.groups.flatMap((group) => group.children),
    [layerGroups.groups],
  );
  const loadedSourceIds = useMemo(
    () => new Set(allLayers.map((layer) => sourceIdFor(layer.id))),
    [allLayers],
  );

  const syncExportTileZoomRange = useCallback(
    (map: MapboxMap | null = mapInstanceRef.current) => {
      if (!map) {
        setExportTileZoomRange({ min: 0, max: 22 });
        return;
      }
      let nextRange: TileZoomRange;
      try {
        nextRange = inferBasemapTileZoomRange(map.getStyle(), loadedSourceIds);
      } catch {
        return;
      }
      setExportTileZoomRange((currentRange) =>
        currentRange.min === nextRange.min && currentRange.max === nextRange.max
          ? currentRange
          : nextRange,
      );
    },
    [loadedSourceIds],
  );

  const selectedLayer = useMemo(() => {
    if (!selectedLayerId) {
      return null;
    }
    return allLayers.find((layer) => layer.id === selectedLayerId) ?? null;
  }, [allLayers, selectedLayerId]);

  const spatialTargetLayer = useMemo(() => {
    if (!spatialTargetLayerId) {
      return null;
    }
    return allLayers.find((layer) => layer.id === spatialTargetLayerId) ?? null;
  }, [allLayers, spatialTargetLayerId]);

  const rangeSourceLayer = spatialTargetLayer ?? selectedLayer;

  const activeInsightLayer = useMemo(() => {
    if (selectedFeature) {
      return (
        allLayers.find((layer) => layer.id === selectedFeature.layerId) ??
        selectedLayer
      );
    }
    return selectedLayer;
  }, [allLayers, selectedFeature, selectedLayer]);

  const activeInsightResource = useMemo(
    () => activeInsightLayer?.sourceResource ?? selectedResource,
    [activeInsightLayer, selectedResource],
  );

  const activeInsightProfile = useMemo(() => {
    if (
      !activeInsightResource ||
      resourceProfile?.resource.id !== activeInsightResource.id
    ) {
      return null;
    }
    return resourceProfile;
  }, [activeInsightResource, resourceProfile]);

  useEffect(() => {
    if (
      !activeInsightResource &&
      !activeInsightLayer &&
      !activeInsightProfile &&
      !selectedFeature &&
      !visualizationSummary
    ) {
      return;
    }

    setRememberedGeoInsight((current) => {
      const nextResource =
        activeInsightResource ?? activeInsightLayer?.sourceResource ?? current?.resource ?? null;
      const nextProfile =
        activeInsightProfile ??
        (nextResource && current?.profile?.resource.id === nextResource.id
          ? current.profile
          : null);
      const nextSummary =
        visualizationSummary &&
        nextResource &&
        visualizationSummary.resource.id === nextResource.id
          ? visualizationSummary
          : nextResource && current?.summary?.resource.id === nextResource.id
            ? current.summary
            : null;
      const nextLayer =
        activeInsightLayer ??
        (nextResource && current?.layer?.sourceResource.id === nextResource.id
          ? current.layer
          : null);
      const nextFeature = selectedFeature ?? current?.feature ?? null;

      if (!nextResource && !nextLayer && !nextSummary) {
        return current;
      }

      const nextCache: LastGeoInsightCache = {
        resource: nextResource,
        profile: nextProfile,
        layer: nextLayer,
        feature: nextFeature,
        summary: nextSummary,
      };
      lastGeoInsightCache = nextCache;
      return nextCache;
    });
  }, [
    activeInsightLayer,
    activeInsightProfile,
    activeInsightResource,
    selectedFeature,
    visualizationSummary,
  ]);

  const rightPanelSelectedLayer =
    activeInsightLayer ?? rememberedGeoInsight?.layer ?? null;
  const rightPanelSelectedResource =
    activeInsightResource ??
    rightPanelSelectedLayer?.sourceResource ??
    rememberedGeoInsight?.resource ??
    null;
  const rightPanelSelectedResourceProfile =
    activeInsightProfile ??
    (rightPanelSelectedResource &&
    rememberedGeoInsight?.profile?.resource.id === rightPanelSelectedResource.id
      ? rememberedGeoInsight.profile
      : null);
  const rightPanelVisualizationSummary =
    visualizationSummary ??
    (rightPanelSelectedResource &&
    rememberedGeoInsight?.summary?.resource.id === rightPanelSelectedResource.id
      ? rememberedGeoInsight.summary
      : null);
  const rightPanelSelectedFeature =
    selectedFeature ?? rememberedGeoInsight?.feature ?? null;
  const rightPanelVisualizationSummaryLoading =
    Boolean(activeInsightResource) && visualizationSummaryLoading;

  const spatialWorkbenchStatus = activeDraw
    ? "正在绘制空间范围"
    : spatialQuerying
      ? "正在执行空间查询"
      : spatialQueryResult
        ? `命中 ${spatialQueryResult.totalCount} 条，返回 ${spatialQueryResult.returnedCount} 条`
        : spatialFilter
          ? "已设置空间查询范围"
          : "范围绘制、查询对象与结果加载";

  useEffect(() => {
    if (!permissions.canBrowseData || !activeInsightResource) {
      setVisualizationSummary(null);
      setVisualizationSummaryError(null);
      setVisualizationSummaryLoading(false);
      return;
    }

    let ignore = false;
    setVisualizationSummaryLoading(true);
    setVisualizationSummaryError(null);
    api
      .resourceVisualizationSummary(activeInsightResource, {
        topN: 10,
        histogramBins: 8,
      })
      .then((summary) => {
        if (!ignore) {
          setVisualizationSummary(summary);
        }
      })
      .catch((error) => {
        if (!ignore) {
          setVisualizationSummary(null);
          setVisualizationSummaryError(
            error instanceof Error ? error.message : "可视化摘要加载失败",
          );
        }
      })
      .finally(() => {
        if (!ignore) {
          setVisualizationSummaryLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [activeInsightResource, permissions.canBrowseData]);

  const setLayerExtentVisibility = useCallback(
    (layerId: string, visible: boolean) => {
      setVisibleLayerExtentIds((current) => {
        if (current.has(layerId) === visible) {
          return current;
        }
        const next = new Set(current);
        if (visible) {
          next.add(layerId);
        } else {
          next.delete(layerId);
        }
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    const activeLayerIds = new Set(allLayers.map((layer) => layer.id));
    setVisibleLayerExtentIds((current) => {
      const next = new Set(
        [...current].filter((layerId) => activeLayerIds.has(layerId)),
      );
      return next.size === current.size ? current : next;
    });
    setSpatialTargetLayerId((current) =>
      current && !activeLayerIds.has(current) ? null : current,
    );
  }, [allLayers]);

  const layerExtentOverlays = useMemo(() => {
    return allLayers.flatMap((layer) => {
      if (!visibleLayerExtentIds.has(layer.id)) {
        return [];
      }
      const geometry = layerExtentGeometryFor(layer);
      return geometry ? [{ layer, geometry }] : [];
    });
  }, [allLayers, visibleLayerExtentIds]);

  const isLayerExtentVisible = useCallback(
    (layerId: string) => visibleLayerExtentIds.has(layerId),
    [visibleLayerExtentIds],
  );

  const sharedSpatialGeometry = spatialFilter?.geometry ?? null;

  function layerExtentGeometryFor(layer: LoadedLayer) {
    return geometryFromBoundsText(
      layer.metadata.空间范围 ?? resourceSpatialExtent(layer.sourceResource),
    );
  }

  const loadResources = useCallback(
    async (filters: ResourceFilters) => {
      try {
        const response = await api.resources(filters);
        const items = response.items;
        setResources(items);
        setSelectedResource((current) =>
          current && !items.some((item) => item.id === current.id)
            ? null
            : current,
        );
        setResourceProfile((current) =>
          current && !items.some((item) => item.id === current.resource.id)
            ? null
            : current,
        );
        setSpatialTargetResource((current) =>
          current && !items.some((item) => item.id === current.id)
            ? null
            : current,
        );
        setSpatialTargetResourceProfile((current) =>
          current && !items.some((item) => item.id === current.resource.id)
            ? null
            : current,
        );
        return items;
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
    void loadWorkspaceScenes();
  }, [loadWorkspaceScenes]);

  useEffect(() => {
    if (!permissions.canBrowseData) {
      setDataSchema(null);
      return;
    }
    let ignore = false;
    api
      .dataSchemaSummary()
      .then((result) => {
        if (!ignore) {
          setDataSchema(result);
        }
      })
      .catch(() => {
        if (!ignore) {
          setDataSchema(null);
        }
      });
    return () => {
      ignore = true;
    };
  }, [permissions.canBrowseData]);

  useEffect(() => {
    const keyword = urlResourceFilters.q?.trim() ?? "";
    setResourceSearchKeyword(keyword);
    if (!permissions.canBrowseData) {
      return;
    }
    void loadResources(urlResourceFilters);
  }, [loadResources, permissions.canBrowseData, urlResourceFilters]);

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
        await loadResources(urlResourceFilters);
      }
    }

    void scanAndRefreshResources();
  }, [
    loadResources,
    message,
    permissions.canBrowseData,
    urlResourceFilters,
    waitForJob,
  ]);

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

  async function fetchSpatialTargetResourceProfile(resource: ResourceListItem) {
    setSpatialTargetResource(resource);
    setLoadingSpatialTargetProfile(true);
    try {
      const profile = await api.resourceProfile(resource);
      setSpatialTargetResourceProfile(profile);
      return profile;
    } catch (error) {
      setSpatialTargetResourceProfile(null);
      message.error(
        error instanceof Error ? error.message : "读取查询对象元信息失败",
      );
      return null;
    } finally {
      setLoadingSpatialTargetProfile(false);
    }
  }

  async function handleSelectResource(resource: ResourceListItem) {
    await fetchResourceProfile(resource);
  }

  const handleSelectDataDomain = useCallback(
    (domainType: DataDomainType | null) => {
      setActiveLeftPanel("data");
      const nextParams = new URLSearchParams(searchParams);
      if (domainType) {
        nextParams.set("domainType", domainType);
      } else {
        nextParams.delete("domainType");
      }
      nextParams.delete("resourceQ");
      setSearchParams(nextParams);
      setResourceSearchKeyword("");
    },
    [searchParams, setSearchParams],
  );

  const handleLeftPanelChange = useCallback((key: string) => {
    if (isLeftPanelTabKey(key)) {
      setActiveLeftPanel(key);
    }
  }, []);

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
      setMapObject(map);
      setMapInstance(map);
    },
    [setMapInstance],
  );

  const handleMapDestroy = useCallback(() => {
    mapInstanceRef.current = null;
    setMapObject(null);
    setMapInstance(null);
  }, [setMapInstance]);

  const handleMapError = useCallback(
    (errorMessage: string) => {
      const now = Date.now();
      const previous = lastMapErrorRef.current;
      if (
        previous?.message === errorMessage &&
        now - previous.timestamp < 5000
      ) {
        return;
      }
      lastMapErrorRef.current = { message: errorMessage, timestamp: now };
      message.error(`地图加载异常：${errorMessage}`);
    },
    [message],
  );

  useEffect(() => {
    if (!mapObject) return;
    const sync = () => syncExportTileZoomRange(mapObject);
    mapObject.on("load", sync);
    mapObject.on("idle", sync);
    return () => {
      mapObject.off("load", sync);
      mapObject.off("idle", sync);
    };
  }, [mapObject, syncExportTileZoomRange]);

  const locateLayer = useCallback(
    async (groupId: string, layerId: string) => {
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
          map.fitBounds(bounds, await mapFitBoundsOptions(map));
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
        await mapFitBoundsOptions(map),
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
    async (groupId: string) => {
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
        map.fitBounds(firstRasterBound, await mapFitBoundsOptions(map));
        return;
      }
      if (!bounds) {
        message.warning("无法计算图层组范围");
        return;
      }
      map.fitBounds(bounds, await mapFitBoundsOptions(map));
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
          format: options.format,
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

  const exportCurrentMapPng = useCallback(
    async (options: MapImageExportOptions) => {
      if (!permissions.canExportData) {
        message.warning(permissionDeniedMessage);
        return;
      }
      const map = mapInstanceRef.current;
      if (!map) {
        message.warning("地图尚未准备好");
        return;
      }
      try {
        map.getStyle();
      } catch {
        message.warning("底图尚未加载完成，请稍后再导出");
        return;
      }
      if (!sharedSpatialGeometry) {
        message.warning("请先使用范围工具划定导出范围");
        return;
      }
      try {
        const blob = await exportMapRangeImage(map, sharedSpatialGeometry, {
          ...options,
          accessToken: bootstrap.map.mapboxAccessToken,
        });
        const extension = options.format === "png" ? "png" : "jpg";
        downloadBlob(
          blob,
          `map-2d-z${options.tileZoom}-${options.dpi}dpi-${new Date()
            .toISOString()
            .slice(0, 19)
            .replace(/[-:T]/g, "")}.${extension}`,
        );
        message.success(`地图 ${extension.toUpperCase()} 已导出`);
      } catch (error) {
        message.error(
          error instanceof Error ? error.message : "地图图片导出失败",
        );
      }
    },
    [
      bootstrap.map.mapboxAccessToken,
      message,
      permissionDeniedMessage,
      permissions.canExportData,
      sharedSpatialGeometry,
    ],
  );

  function handleUseCurrentViewRange() {
    if (!currentMapView) {
      message.warning("地图视图尚未就绪");
      return;
    }
    const [west, south, east, north] = currentMapView.bounds;
    if (![west, south, east, north].every(Number.isFinite)) {
      message.warning("当前视图范围无效");
      return;
    }
    setSpatialFilter({
      mode: "rectangle",
      geometry: rectangleGeometry([west, south], [east, north]),
    });
    setActiveDraw(null);
  }

  function handleUseSelectedLayerRange() {
    if (!rangeSourceLayer) {
      message.warning("请先在空间查询工作台或图层树选择图层");
      return;
    }
    const geometry = layerExtentGeometryFor(rangeSourceLayer);
    if (!geometry) {
      message.warning("当前图层没有可用空间范围");
      return;
    }
    setSpatialFilter({ mode: "rectangle", geometry });
    setActiveDraw(null);
  }

  function handleClearSpatialFilter() {
    setSpatialFilter(null);
    setActiveDraw(null);
  }

  function handleImportSpatialFilter(filter: SpatialFilter) {
    setSpatialFilter(filter);
    setActiveDraw(null);
    void locateImportedSpatialFilter(filter.geometry);
  }

  async function locateImportedSpatialFilter(geometry: GeoJsonGeometry) {
    const map = mapInstanceRef.current;
    if (!map) return;
    try {
      fitGeojsonBounds(
        map,
        geojsonFromGeometry(geometry),
        bootstrap.map.defaultCenter,
        bootstrap.map.defaultZoom,
        await mapFitBoundsOptions(map),
      );
    } catch {
      message.warning("空间范围已导入，但地图定位失败");
    }
  }

  function clearSpatialQueryState() {
    setSpatialQueryData(null);
    setSpatialQueryContext(null);
    setSpatialQueryResult(null);
  }

  async function handleSelectSpatialTargetResource(resourceId: number | null) {
    clearSpatialQueryState();
    if (resourceId === null) {
      setSpatialTargetResource(null);
      setSpatialTargetResourceProfile(null);
      return;
    }
    const resource = resources.find((item) => item.id === resourceId);
    if (!resource) {
      message.warning("当前资源列表中没有找到该资源");
      return;
    }
    if (resource.dataType !== "vector" || !resource.isQueryable) {
      message.warning("请选择可查询的矢量资源");
      return;
    }
    await fetchSpatialTargetResourceProfile(resource);
  }

  function handleSelectSpatialTargetLayer(layerId: string | null) {
    clearSpatialQueryState();
    if (layerId === null) {
      setSpatialTargetLayerId(null);
      return;
    }
    const layer = allLayers.find((item) => item.id === layerId);
    if (!layer || layer.layerType !== "vector") {
      message.warning("请选择已加载的矢量图层");
      return;
    }
    setSpatialTargetLayerId(layerId);
  }

  async function resolveSpatialQueryContext(
    target: SpatialQueryTarget,
    queryFilter: SpatialFilter,
  ): Promise<SpatialQueryContext | null> {
    const query = {
      attributeFilters: [],
      spatialFilter: queryFilter,
    };
    if (target === "selectedResource") {
      if (!spatialTargetResource) {
        message.warning("请先在空间查询工作台选择资源");
        return null;
      }
      if (
        spatialTargetResource.dataType !== "vector" ||
        !spatialTargetResource.isQueryable ||
        !spatialTargetResourceProfile
      ) {
        message.warning("当前资源不是可查询的矢量资源");
        return null;
      }
      return {
        target,
        targetName: spatialTargetResource.name,
        resource: spatialTargetResource,
        profile: spatialTargetResourceProfile,
        query,
      };
    }

    if (!spatialTargetLayer || spatialTargetLayer.layerType !== "vector") {
      message.warning("请先在空间查询工作台选择矢量图层");
      return null;
    }
    const resource = spatialTargetLayer.sourceResource;
    if (
      resource.id <= 0 ||
      resource.dataType !== "vector" ||
      !resource.isQueryable
    ) {
      message.warning("当前图层没有可反查的可查询来源资源");
      return null;
    }
    const profile =
      spatialTargetResource?.id === resource.id && spatialTargetResourceProfile
        ? spatialTargetResourceProfile
        : selectedResource?.id === resource.id && resourceProfile
          ? resourceProfile
          : await api.resourceProfile(resource);
    return {
      target,
      targetName: spatialTargetLayer.name,
      resource,
      profile,
      query,
    };
  }

  async function handleRunSpatialQuery(target: SpatialQueryTarget) {
    if (!permissions.canQueryData || !permissions.canLoadVectorLayer) {
      message.warning(permissionDeniedMessage);
      return;
    }
    if (!spatialFilter?.geometry) {
      message.warning("请先设置空间查询范围");
      return;
    }

    setSpatialQuerying(true);
    setSpatialQueryData(null);
    setSpatialQueryContext(null);
    setSpatialQueryResult(null);
    try {
      const context = await resolveSpatialQueryContext(target, spatialFilter);
      if (!context) {
        return;
      }
      const result = await api.queryResource(context.resource, {
        ...context.query,
        limit: bootstrap.limits.queryResultLimit,
      });
      showGeojsonWarnings(notification, result.warnings);
      setSpatialQueryData(result);
      setSpatialQueryContext(context);
      setSpatialQueryResult({
        id: `spatial-query-${context.resource.id}-${Date.now()}`,
        target,
        targetName: context.targetName,
        resourceName: context.resource.name,
        rangeMode: spatialFilter.mode,
        totalCount: result.totalCount,
        returnedCount: result.returnedCount,
        limit: result.limit,
        limitExceeded: result.limitExceeded,
        bounds: result.bounds,
        elapsedMs: result.elapsedMs,
        warningCount: result.warnings.length,
        loadedLayerName: null,
      });

      const resultMessage = spatialQueryMessage(result);
      if (result.returnedCount === 0) {
        message.warning(resultMessage);
      } else if (result.limitExceeded) {
        message.warning(resultMessage);
      } else {
        message.success(resultMessage);
      }
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "空间查询执行失败",
      );
    } finally {
      setSpatialQuerying(false);
    }
  }

  function createSpatialResultGroup() {
    if (!spatialQueryData || !spatialQueryContext || !spatialQueryResult) {
      return null;
    }
    if (spatialQueryData.returnedCount === 0) {
      return null;
    }
    const name =
      spatialQueryResult.loadedLayerName ??
      `空间查询结果 - ${spatialQueryContext.targetName}`;
    return createVectorLayerGroup(
      spatialQueryContext.resource,
      spatialQueryContext.profile,
      spatialQueryData,
      spatialQueryContext.query,
      {
        name,
        metadata: {
          查询类型: "空间查询",
          查询对象: spatialQueryContext.targetName,
          查询来源:
            spatialQueryContext.target === "selectedLayer"
              ? "当前图层"
              : "当前资源",
          来源资源: spatialQueryContext.resource.name,
          空间范围: spatialQueryContext.query.spatialFilter
            ? spatialFilterModeLabel(
                spatialQueryContext.query.spatialFilter.mode,
              )
            : "未设置",
          命中总数: spatialQueryData.totalCount,
          返回条数: spatialQueryData.returnedCount,
          返回上限: spatialQueryData.limit,
          结果截断: spatialQueryData.limitExceeded ? "是" : "否",
          后端耗时ms: spatialQueryData.elapsedMs,
        },
      },
    );
  }

  function handleLoadSpatialResult() {
    if (spatialQueryResult?.loadedLayerName) {
      message.info("空间查询结果已加载为图层");
      return;
    }
    const group = createSpatialResultGroup();
    if (!group) {
      message.warning("暂无可加载的空间查询结果");
      return;
    }
    layerGroups.addGroup(group);
    setSelectedLayerId(group.children[0]?.id ?? null);
    setSpatialQueryResult((current) =>
      current ? { ...current, loadedLayerName: group.name } : current,
    );
    message.success("空间查询结果已加载为图层");
  }

  async function handleLocateSpatialResult() {
    if (!spatialQueryData || spatialQueryData.returnedCount === 0) {
      message.warning("暂无可定位的空间查询结果");
      return;
    }
    const map = mapInstanceRef.current;
    if (!map) {
      message.warning("地图尚未准备好");
      return;
    }
    fitGeojsonBounds(
      map,
      spatialQueryData.geojson,
      bootstrap.map.defaultCenter,
      bootstrap.map.defaultZoom,
      await mapFitBoundsOptions(map),
    );
  }

  function handleOpenSpatialResultTable() {
    const group = createSpatialResultGroup();
    const layer = group?.children.find(
      (item): item is LoadedVectorLayer => item.layerType === "vector",
    );
    if (!layer) {
      message.warning("暂无可查看的空间查询结果");
      return;
    }
    setTableLayer(layer);
  }

  function handleExportSpatialResult() {
    if (!spatialQueryData || !spatialQueryContext || !spatialQueryResult) {
      message.warning("暂无可导出的空间查询结果");
      return;
    }
    if (spatialQueryData.returnedCount === 0) {
      message.warning("空间查询结果为空，无法导出");
      return;
    }
    void exportLayers(
      [
        {
          layerType: "vector",
          name:
            spatialQueryResult.loadedLayerName ??
            `空间查询结果 - ${spatialQueryContext.targetName}`,
          resourceId: spatialQueryContext.resource.id,
          geojson: spatialQueryData.geojson,
          sourceCrs:
            spatialQueryContext.resource.coordinateSystem || "EPSG:4326",
        },
      ],
      {
        epsg: 4326,
        reproject: true,
        clip: false,
        clipGeometry: null,
        format: "geojson",
      },
    ).catch(() => undefined);
  }

  function handleClearSpatialResult() {
    setSpatialQueryData(null);
    setSpatialQueryContext(null);
    setSpatialQueryResult(null);
  }

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
        await loadWorkspaceSceneById(sceneId);
      } catch (error) {
        loadedSceneIdRef.current = null;
        message.error(
          error instanceof Error ? error.message : "工程或专题加载失败",
        );
      }
    }
    void loadSceneFromUrl();
  }, [loadWorkspaceSceneById, message, searchParams]);

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
    isLayerExtentVisible,
    setLayerExtentVisibility,
    setLayerName: layerGroups.setLayerName,
    setLayerSymbolization: layerGroups.setLayerSymbolization,
    removeGroup: layerGroups.removeGroup,
    removeLayer: layerGroups.removeLayer,
    reorderGroups: layerGroups.reorderGroups,
    moveLayer: layerGroups.moveLayer,
    extractLayer: layerGroups.extractLayer,
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
      domainTypeOptions={domainTypeOptions}
      selectedDomainType={selectedDomainType}
      searchKeyword={resourceSearchKeyword}
      onFilterResources={loadResources}
      onSelectResource={handleSelectResource}
      onQuickLoadResource={handleQuickLoadResource}
      onQueryAndLoad={handleQueryAndLoad}
      onLoadRaster={handleLoadRaster}
    />
  );
  return (
    <Layout className="workspace">
      <WorkspaceHeader
        activeTab="map"
        canBrowseData={permissions.canBrowseData}
        resources={resources}
        workspaceScenes={workspaceScenes}
        dataSchema={dataSchema}
        selectedDomainType={selectedDomainType}
        searchKeyword={resourceSearchKeyword}
        onGlobalSearch={(keyword) => {
          setResourceSearchKeyword(keyword);
        }}
        onSelectDataDomain={handleSelectDataDomain}
        onQuickLoadResource={(resource) =>
          void handleQuickLoadResource(resource)
        }
        onLoadWorkspaceScene={loadWorkspaceScene}
        onSearchFocus={() => {
          if (permissions.canBrowseData) {
            void loadWorkspaceScenes();
          }
        }}
      />
      <div
        className={`workspace-body ${
          spatialWorkbenchOpen
            ? "workspace-body-spatial-open"
            : "workspace-body-spatial-collapsed"
        }`}
      >
        <main className="map-stage">
          <Suspense
            fallback={
              <div className="map-canvas-loading">
                <Spin size="large" />
              </div>
            }
          >
            <MapCanvas
              bootstrap={bootstrap}
              loadedLayers={mapLayers}
              drawMode={activeDraw?.mode ?? null}
              spatialFilter={spatialFilter}
              layerExtentOverlays={layerExtentOverlays}
              onDrawComplete={handleDrawComplete}
              onFeatureSelect={setSelectedFeature}
              onMapReady={handleMapReady}
              onMapDestroy={handleMapDestroy}
              onMapError={handleMapError}
              onViewStateChange={setCurrentMapView}
            />
          </Suspense>
        </main>
        <aside className="floating-panel floating-panel-left">
          <ConfigProvider theme={workspacePanelTheme}>
            <LayerContext.Provider value={layerContextValue}>
              <Tabs
                className="workspace-side-tabs workspace-left-tabs"
                activeKey={activeLeftPanel}
                onChange={handleLeftPanelChange}
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
                        onRefresh={loadWorkspaceScenes}
                        onUpdate={updateWorkspaceScene}
                        onDelete={deleteWorkspaceScene}
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
                        onRefresh={loadWorkspaceScenes}
                        onUpdate={updateWorkspaceScene}
                        onDelete={deleteWorkspaceScene}
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
              selectedFeature={rightPanelSelectedFeature}
              selectedResource={rightPanelSelectedResource}
              selectedResourceProfile={rightPanelSelectedResourceProfile}
              selectedLayer={rightPanelSelectedLayer}
              visualizationSummary={rightPanelVisualizationSummary}
              visualizationSummaryLoading={rightPanelVisualizationSummaryLoading}
              visualizationSummaryError={visualizationSummaryError}
              currentView={currentMapView}
              mapConfig={bootstrap.map}
            />
          </ConfigProvider>
        </aside>
        <aside
          id="spatial-query-workbench-panel"
          className={`floating-panel-bottom spatial-workbench-panel ${
            spatialWorkbenchOpen
              ? "spatial-workbench-panel-open"
              : "spatial-workbench-panel-collapsed"
          }`}
          aria-label="空间查询面板"
          aria-expanded={spatialWorkbenchOpen}
        >
          <ConfigProvider theme={workspacePanelTheme}>
            {spatialWorkbenchOpen ? (
              <>
                <Tooltip title="隐藏空间查询工作台">
                  <Button
                    className="spatial-workbench-collapse-button"
                    type="text"
                    icon={<DownOutlined style={{ fontSize: 14 }} />}
                    aria-label="隐藏空间查询工作台"
                    onClick={() => setSpatialWorkbenchOpen(false)}
                  />
                </Tooltip>
                <SpatialQueryWorkbench
                  resources={resources}
                  layers={allLayers}
                  selectedResource={spatialTargetResource}
                  selectedResourceProfile={spatialTargetResourceProfile}
                  selectedLayer={spatialTargetLayer}
                  exportClipGeometry={sharedSpatialGeometry}
                  spatialFilter={spatialFilter}
                  activeDraw={activeDraw}
                  spatialQuerying={spatialQuerying}
                  spatialQueryResult={spatialQueryResult}
                  canExportData={permissions.canExportData}
                  exportTileZoomRange={exportTileZoomRange}
                  canUseCurrentViewRange={Boolean(currentMapView)}
                  canUseSelectedLayerRange={Boolean(
                    rangeSourceLayer &&
                    layerExtentGeometryFor(rangeSourceLayer),
                  )}
                  loadingResourceProfile={loadingSpatialTargetProfile}
                  onSelectTargetResource={handleSelectSpatialTargetResource}
                  onSelectTargetLayer={handleSelectSpatialTargetLayer}
                  onStartQueryDraw={setQueryDrawMode}
                  onClearSpatialFilter={handleClearSpatialFilter}
                  onImportSpatialFilter={handleImportSpatialFilter}
                  onUseCurrentViewRange={handleUseCurrentViewRange}
                  onUseSelectedLayerRange={handleUseSelectedLayerRange}
                  onRunSpatialQuery={handleRunSpatialQuery}
                  onLoadSpatialResult={handleLoadSpatialResult}
                  onLocateSpatialResult={handleLocateSpatialResult}
                  onOpenSpatialResultTable={handleOpenSpatialResultTable}
                  onExportSpatialResult={handleExportSpatialResult}
                  onClearSpatialResult={handleClearSpatialResult}
                  onExportMapPng={exportCurrentMapPng}
                />
              </>
            ) : (
              <button
                className="spatial-workbench-peek-card"
                type="button"
                aria-label="打开空间查询工作台"
                aria-controls="spatial-query-workbench-panel"
                aria-expanded={spatialWorkbenchOpen}
                onClick={() => setSpatialWorkbenchOpen(true)}
              >
                <span className="spatial-workbench-peek-icon" aria-hidden>
                  <AimOutlined style={{ fontSize: 15 }} />
                </span>
                <span className="spatial-workbench-peek-copy">
                  <strong>打开空间查询工作台</strong>
                  <small>{spatialWorkbenchStatus}</small>
                </span>
                <span className="spatial-workbench-peek-action">
                  <span>打开</span>
                  <UpOutlined style={{ fontSize: 13 }} />
                </span>
              </button>
            )}
          </ConfigProvider>
        </aside>
      </div>
    </Layout>
  );
}

async function mapFitBoundsOptions(_map: MapboxMap) {
  const { fitBoundsOptions } = await import("../map/mapViewport");
  return fitBoundsOptions();
}

function geojsonFromGeometry(
  geometry: GeoJsonGeometry,
): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry,
        properties: {},
      },
    ],
  };
}

function isLeftPanelTabKey(key: string): key is LeftPanelTabKey {
  return leftPanelTabKeys.has(key);
}

function spatialFilterModeLabel(mode: SpatialFilter["mode"]) {
  const labels: Record<SpatialFilter["mode"], string> = {
    rectangle: "矩形范围",
    circle: "圆形范围",
    ellipse: "椭圆范围",
    polygon: "多边形范围",
  };
  return labels[mode];
}

function spatialQueryMessage(result: ResourceQueryResult) {
  const base = `空间查询命中 ${result.totalCount} 条，返回 ${result.returnedCount} 条`;
  if (result.returnedCount === 0) {
    return base;
  }
  if (result.limitExceeded) {
    return `${base}，已按上限截断`;
  }
  return base;
}
