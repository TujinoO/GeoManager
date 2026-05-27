import { App, Button, Layout, Popover, Tag, Typography } from 'antd';
import mapboxgl from 'mapbox-gl';
import { Database, Layers, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import DataPanel from '../components/DataPanel';
import LayerPanel from '../components/LayerPanel';
import MapCanvas from '../components/MapCanvas';
import {
  cloneDefaultGroupSymbolization,
  cloneDefaultRasterSymbolization,
  cloneDefaultVectorSymbolization,
  rasterSymbolizationFromRules,
  type GroupSymbolization,
  type RasterSymbolization,
  type VectorSymbolization,
} from '../symbolization';
import type {
  AttributeFilter,
  Bootstrap,
  DataResource,
  DataResourceProfile,
  LoadedLayer,
  LoadedLayerGroup,
  RasterRenderResult,
  ResourceFilters,
  ResourceQueryResult,
  SpatialFilter,
  User,
} from '../types';

type DrawMode = SpatialFilter['mode'] | null;

interface Props {
  bootstrap: Bootstrap;
  user: User;
  onLogout: () => void;
}

export default function WorkspacePage({ bootstrap, user, onLogout }: Props) {
  const { message } = App.useApp();
  const [resources, setResources] = useState<DataResource[]>([]);
  const [selectedResource, setSelectedResource] = useState<DataResource | null>(null);
  const [resourceProfile, setResourceProfile] = useState<DataResourceProfile | null>(null);
  const [queryResult, setQueryResult] = useState<ResourceQueryResult | null>(null);
  const [loadedLayerGroups, setLoadedLayerGroups] = useState<LoadedLayerGroup[]>([]);
  const [spatialFilter, setSpatialFilter] = useState<SpatialFilter | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [dataPanelOpen, setDataPanelOpen] = useState(false);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);

  const mapLayers = useMemo(
    () =>
      loadedLayerGroups.flatMap((group) =>
        group.visible
          ? group.children
              .filter((layer) => layer.visible)
              .map((layer) => ({
                ...layer,
                symbolization: {
                  ...layer.symbolization,
                  opacity: Math.round((layer.symbolization.opacity * group.symbolization.opacity) / 100),
                },
              }))
          : [],
      ),
    [loadedLayerGroups],
  );

  useEffect(() => {
    loadResources({});
  }, []);

  async function loadResources(filters: ResourceFilters) {
    try {
      const response = await api.resources(filters);
      setResources(response.items);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '数据资源加载失败');
    }
  }

  async function handleSelectResource(resource: DataResource) {
    setSelectedResource(resource);
    setQueryResult(null);
    setLoadingProfile(true);
    try {
      const profile = await api.resourceProfile(resource.id);
      setResourceProfile(profile);
    } catch (error) {
      setResourceProfile(null);
      message.error(error instanceof Error ? error.message : '读取字段和元信息失败');
    } finally {
      setLoadingProfile(false);
    }
  }

  const handleSpatialFilterChange = useCallback((filter: SpatialFilter) => {
    setSpatialFilter(filter);
    setDrawMode(null);
  }, []);

  async function handleQuery(attributeFilters: AttributeFilter[]) {
    if (!selectedResource) {
      message.warning('请先选择数据资源');
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
      message.error(error instanceof Error ? error.message : '查询失败');
    } finally {
      setQuerying(false);
    }
  }

  function handleLoadResult() {
    if (!selectedResource || !resourceProfile || !queryResult) {
      return;
    }
    const now = new Date();
    const groupId = `query-${selectedResource.id}-${now.getTime()}`;
    const summary = `${queryResult.returnedCount}/${queryResult.totalCount} 条 · ${resourceProfile.geometryType || '空间数据'}`;
    const metadata = {
      数据名称: selectedResource.name,
      数据编号: selectedResource.code,
      数据类型: selectedResource.dataType,
      数据分类: selectedResource.category?.name,
      数据来源: selectedResource.source,
      提供单位: selectedResource.provider,
      空间范围: selectedResource.spatialExtent,
      坐标系统: selectedResource.coordinateSystem,
      返回条数: queryResult.returnedCount,
      命中条数: queryResult.totalCount,
      加载时间: now.toLocaleString('zh-CN', { hour12: false }),
    };
    const group: LoadedLayerGroup = {
      id: groupId,
      name: `${selectedResource.name} 查询组`,
      sourceResource: selectedResource,
      visible: true,
      summary,
      createdAt: now.toISOString(),
      metadata,
      symbolization: cloneDefaultGroupSymbolization(),
      children: [
        {
          id: `${groupId}-vector`,
          name: selectedResource.name,
          layerType: 'vector',
          sourceResource: selectedResource,
          geojson: queryResult.geojson,
          geometryType: resourceProfile.geometryType,
          visible: true,
          summary,
          metadata: {
            ...metadata,
            图层类型: '矢量',
            几何类型: resourceProfile.geometryType,
          },
          symbolization: cloneDefaultVectorSymbolization(),
          fields: queryResult.fields,
        },
      ],
    };
    setLoadedLayerGroups((current) => [group, ...current]);
    setDataPanelOpen(false);
    message.success('查询结果已加载到图层');
  }

  function handleLoadRaster() {
    if (!selectedResource || !resourceProfile?.raster) {
      message.warning('请先选择已完成预处理的栅格数据');
      return;
    }
    const raster = resourceProfile.raster;
    const now = new Date();
    const groupId = `raster-${raster.id}-${now.getTime()}`;
    const layerId = `${groupId}-image`;
    const symbolization = raster.defaultRules
      ? rasterSymbolizationFromRules(raster.defaultRules)
      : cloneDefaultRasterSymbolization();
    const summary = `${raster.bandCount} 波段 · ${raster.metadata.size.join(' x ') || '栅格'}`;
    const metadata = {
      数据名称: selectedResource.name,
      数据编号: selectedResource.code,
      数据类型: '栅格',
      文件格式: selectedResource.fileFormat,
      源文件: raster.sourcePath,
      预处理文件: raster.processedPath,
      坐标系统: selectedResource.coordinateSystem,
      波段数: raster.bandCount,
      加载时间: now.toLocaleString('zh-CN', { hour12: false }),
    };
    const group: LoadedLayerGroup = {
      id: groupId,
      name: `${selectedResource.name} 栅格组`,
      sourceResource: selectedResource,
      visible: true,
      summary,
      createdAt: now.toISOString(),
      metadata,
      symbolization: cloneDefaultGroupSymbolization(),
      children: [
        {
          id: layerId,
          name: selectedResource.name,
          layerType: 'raster',
          sourceResource: selectedResource,
          rasterDatasetId: raster.id,
          rasterLayerId: raster.mapLayerId,
          rasterMetadata: raster.metadata,
          imageCoordinates: raster.imageCoordinates,
          geometryType: 'Raster',
          visible: true,
          summary: '等待后台符号化',
          metadata: {
            ...metadata,
            图层类型: '栅格',
            加载方式: symbolization.loadMode === 'xyz' ? 'XYZ 瓦片' : '整图 PNG',
          },
          symbolization,
          fields: [],
          renderStatus: 'queued',
          renderProgress: 0,
          renderMessages: [],
        },
      ],
    };
    setLoadedLayerGroups((current) => [group, ...current]);
    setDataPanelOpen(false);
    void startRasterRender(groupId, layerId, symbolization, group.children[0]);
  }

  async function startRasterRender(
    groupId: string,
    layerId: string,
    symbolization: RasterSymbolization,
    layer: LoadedLayer,
  ) {
    const canvas = mapInstanceRef.current?.getCanvas();
    const width = Math.min(2400, Math.max(512, Math.round((canvas?.clientWidth ?? 1400) * window.devicePixelRatio)));
    const height = Math.min(1800, Math.max(512, Math.round((canvas?.clientHeight ?? 900) * window.devicePixelRatio)));
    updateLoadedLayer(groupId, layerId, (current) => ({
      ...current,
      summary: '后台符号化中',
      renderStatus: 'running',
      renderProgress: 5,
      renderMessages: ['提交符号化任务'],
      pngUrl: symbolization.loadMode === 'image' ? current.pngUrl : undefined,
      tileUrl: symbolization.loadMode === 'xyz' ? current.tileUrl : undefined,
    }));
    try {
      const job = await api.renderRasterAsync({
        datasetId: layer.rasterDatasetId,
        layerId: layer.rasterLayerId,
        width,
        height,
        rules: symbolization as unknown as Record<string, unknown>,
        delivery: symbolization.loadMode,
      });
      updateLoadedLayer(groupId, layerId, (current) => ({
        ...current,
        renderJobId: job.id,
        renderProgress: job.progressPercent,
        renderMessages: job.messages,
      }));
      void pollRasterRenderJob(job.id, groupId, layerId);
    } catch (error) {
      updateLoadedLayer(groupId, layerId, (current) => ({
        ...current,
        summary: '符号化失败',
        renderStatus: 'failed',
        renderMessages: [error instanceof Error ? error.message : '符号化失败'],
      }));
      message.error(error instanceof Error ? error.message : '符号化失败');
    }
  }

  async function pollRasterRenderJob(jobId: string, groupId: string, layerId: string) {
    for (;;) {
      await delay(900);
      try {
        const job = await api.rasterJob(jobId);
        updateLoadedLayer(groupId, layerId, (current) => ({
          ...current,
          renderStatus: job.status,
          renderProgress: job.progressPercent,
          renderMessages: job.messages,
        }));
        if (job.status === 'ready' && job.result) {
          applyRasterRenderResult(groupId, layerId, job.result as RasterRenderResult);
          return;
        }
        if (job.status === 'failed') {
          updateLoadedLayer(groupId, layerId, (current) => ({
            ...current,
            summary: '符号化失败',
            renderStatus: 'failed',
            renderMessages: job.messages.length > 0 ? job.messages : [job.error],
          }));
          message.error(job.error || '栅格符号化失败');
          return;
        }
      } catch (error) {
        updateLoadedLayer(groupId, layerId, (current) => ({
          ...current,
          summary: '进度查询失败',
          renderStatus: 'failed',
          renderMessages: [error instanceof Error ? error.message : '进度查询失败'],
        }));
        return;
      }
    }
  }

  function applyRasterRenderResult(groupId: string, layerId: string, result: RasterRenderResult) {
    updateLoadedLayer(groupId, layerId, (current) => {
      const currentRasterSymbolization = current.symbolization as RasterSymbolization;
      return {
        ...current,
        pngUrl: result.delivery === 'image' ? result.pngUrl : undefined,
        tileUrl: result.delivery === 'xyz' ? result.tileUrl : undefined,
        imageCoordinates: result.imageCoordinates,
        summary: result.delivery === 'xyz' ? 'XYZ 瓦片已就绪' : `PNG 已生成 · ${formatBytes(result.fileSize ?? 0)}`,
        renderStatus: 'ready',
        renderProgress: 100,
        symbolization: {
          ...rasterSymbolizationFromRules(result.rules),
          opacity: currentRasterSymbolization.opacity,
          loadMode: currentRasterSymbolization.loadMode,
        },
        metadata: {
          ...current.metadata,
          加载方式: result.delivery === 'xyz' ? 'XYZ 瓦片' : '整图 PNG',
          缓存标识: result.cacheKey,
          样式哈希: result.styleHash,
        },
      };
    });
  }

  function updateLoadedLayer(groupId: string, layerId: string, updater: (layer: LoadedLayer) => LoadedLayer) {
    setLoadedLayerGroups((current) =>
      current.map((group) =>
        group.id === groupId
          ? {
              ...group,
              children: group.children.map((layer) => (layer.id === layerId ? updater(layer) : layer)),
            }
          : group,
      ),
    );
  }

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    mapInstanceRef.current = map;
  }, []);

  const handleMapDestroy = useCallback(() => {
    mapInstanceRef.current = null;
  }, []);

  const locateLayer = useCallback((groupId: string, layerId: string) => {
    const map = mapInstanceRef.current;
    if (!map) {
      message.warning('地图尚未准备好');
      return;
    }
    const targetGroup = loadedLayerGroups.find((group) => group.id === groupId);
    const targetLayer = targetGroup?.children.find((layer) => layer.id === layerId);
    if (!targetLayer) {
      message.warning('当前图层没有可定位的数据');
      return;
    }
    if (targetLayer.imageCoordinates?.length) {
      const bounds = boundsFromImageCoordinates(targetLayer.imageCoordinates);
      if (bounds) {
        map.fitBounds(bounds, { padding: 72, duration: 900, essential: true });
        return;
      }
    }
    if (!targetLayer.geojson) {
      message.warning('当前图层没有可定位的数据');
      return;
    }
    fitGeojsonBounds(map, targetLayer.geojson, bootstrap.map.defaultCenter, bootstrap.map.defaultZoom);
  }, [bootstrap.map.defaultCenter, bootstrap.map.defaultZoom, loadedLayerGroups, message]);

  const locateGroup = useCallback((groupId: string) => {
    const map = mapInstanceRef.current;
    if (!map) {
      message.warning('地图尚未准备好');
      return;
    }
    const targetGroup = loadedLayerGroups.find((group) => group.id === groupId);
    if (!targetGroup) {
      return;
    }
    const geojsons = targetGroup.children.map((layer) => layer.geojson).filter(Boolean);
    const rasterBounds = targetGroup.children
      .map((layer) => (layer.imageCoordinates?.length ? boundsFromImageCoordinates(layer.imageCoordinates) : null))
      .filter(Boolean) as mapboxgl.LngLatBounds[];
    if (geojsons.length === 0 && rasterBounds.length === 0) {
      message.warning('该图层组没有可定位的数据');
      return;
    }
    const bounds = combinedFeatureBounds(geojsons as NonNullable<typeof geojsons[number]>[]);
    for (const rasterBound of rasterBounds) {
      if (bounds) {
        bounds.extend(rasterBound.getSouthWest());
        bounds.extend(rasterBound.getNorthEast());
      }
    }
    if (!bounds && rasterBounds.length > 0) {
      map.fitBounds(rasterBounds[0], { padding: 72, duration: 900, essential: true });
      return;
    }
    if (!bounds) {
      message.warning('无法计算图层组范围');
      return;
    }
    map.fitBounds(bounds, { padding: 72, duration: 900, essential: true });
  }, [loadedLayerGroups, message]);

  async function handleLogout() {
    try {
      await api.logout();
    } catch (error) {
      message.warning(error instanceof Error ? error.message : '退出接口异常，本地会话已清空');
    } finally {
      onLogout();
    }
  }

  return (
    <Layout className="workspace">
      <Layout.Header className="workspace-header">
        <div className="header-left">
          <div className="brand-block">
            <Database size={22} />
            <div>
              <Typography.Title level={4}>{bootstrap.systemName}</Typography.Title>
            </div>
          </div>
          <div className="header-primary-actions">
            <Popover
              trigger="click"
              placement="bottomLeft"
              open={dataPanelOpen}
              onOpenChange={setDataPanelOpen}
              overlayClassName="data-popover"
              content={
                <DataPanel
                  resources={resources}
                  profile={resourceProfile}
                  selectedResourceId={selectedResource?.id ?? null}
                  spatialFilter={spatialFilter}
                  drawMode={drawMode}
                  queryResult={queryResult}
                  loadingProfile={loadingProfile}
                  querying={querying}
                  onFilterResources={loadResources}
                  onSelectResource={handleSelectResource}
                  onDrawModeChange={setDrawMode}
                  onClearSpatialFilter={() => setSpatialFilter(null)}
                  onQuery={handleQuery}
                  onLoadResult={handleLoadResult}
                  onLoadRaster={handleLoadRaster}
                />
              }
            >
              <Button icon={<Layers size={16} />}>数据管理</Button>
            </Popover>
            {user.permissions.canAccessAdmin && (
              <Button icon={<Settings size={16} />} onClick={() => window.location.assign('/admin/')}>
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
            drawMode={drawMode}
            spatialFilter={spatialFilter}
            onSpatialFilterChange={handleSpatialFilterChange}
            onMapReady={handleMapReady}
            onMapDestroy={handleMapDestroy}
          />
        </main>
        <aside className="floating-panel floating-panel-left">
          <LayerPanel
            groups={loadedLayerGroups}
            onGroupVisibilityChange={(groupId, visible) =>
              setLoadedLayerGroups((current) =>
                current.map((group) => (group.id === groupId ? { ...group, visible } : group)),
              )
            }
            onGroupNameChange={(groupId, name) =>
              setLoadedLayerGroups((current) =>
                current.map((group) => (group.id === groupId ? { ...group, name } : group)),
              )
            }
            onGroupSymbolizationChange={(groupId, symbolization: GroupSymbolization) =>
              setLoadedLayerGroups((current) =>
                current.map((group) => (group.id === groupId ? { ...group, symbolization } : group)),
              )
            }
            onLayerVisibilityChange={(groupId, layerId, visible) =>
              setLoadedLayerGroups((current) =>
                current.map((group) =>
                  group.id === groupId
                    ? {
                        ...group,
                        children: group.children.map((layer) =>
                          layer.id === layerId ? { ...layer, visible } : layer,
                        ),
                      }
                    : group,
                ),
              )
            }
            onLayerNameChange={(groupId, layerId, name) =>
              setLoadedLayerGroups((current) =>
                current.map((group) =>
                  group.id === groupId
                    ? {
                        ...group,
                        children: group.children.map((layer) =>
                          layer.id === layerId ? { ...layer, name } : layer,
                        ),
                      }
                    : group,
                ),
              )
            }
            onLayerSymbolizationChange={(groupId, layerId, symbolization: VectorSymbolization | RasterSymbolization) => {
              const targetLayer = loadedLayerGroups
                .find((group) => group.id === groupId)
                ?.children.find((layer) => layer.id === layerId);
              setLoadedLayerGroups((current) =>
                current.map((group) =>
                  group.id === groupId
                    ? {
                        ...group,
                        children: group.children.map((layer) =>
                          layer.id === layerId ? { ...layer, symbolization } : layer,
                        ),
                      }
                    : group,
                ),
              );
              if (isRasterSymbolization(symbolization) && targetLayer) {
                void startRasterRender(groupId, layerId, symbolization, { ...targetLayer, symbolization });
              }
            }}
            onLocateGroup={locateGroup}
            onLocateLayer={locateLayer}
            onRemoveGroup={(groupId) =>
              setLoadedLayerGroups((current) => current.filter((group) => group.id !== groupId))
            }
            onRemoveLayer={(groupId, layerId) =>
              setLoadedLayerGroups((current) =>
                current
                  .map((group) =>
                    group.id === groupId
                      ? { ...group, children: group.children.filter((layer) => layer.id !== layerId) }
                      : group,
                  )
                  .filter((group) => group.children.length > 0),
              )
            }
            onGroupReorder={(sourceGroupId, targetGroupId, placement) =>
              setLoadedLayerGroups((current) => reorderLayerGroups(current, sourceGroupId, targetGroupId, placement))
            }
          />
        </aside>
      </div>
    </Layout>
  );
}

function reorderLayerGroups(
  groups: LoadedLayerGroup[],
  sourceGroupId: string,
  targetGroupId: string,
  placement: 'before' | 'after',
) {
  const sourceIndex = groups.findIndex((group) => group.id === sourceGroupId);
  const targetIndex = groups.findIndex((group) => group.id === targetGroupId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return groups;
  }

  const next = [...groups];
  const [source] = next.splice(sourceIndex, 1);
  const adjustedTargetIndex = next.findIndex((group) => group.id === targetGroupId);
  next.splice(placement === 'before' ? adjustedTargetIndex : adjustedTargetIndex + 1, 0, source);
  return next;
}

function fitGeojsonBounds(
  map: mapboxgl.Map,
  geojson: { type: 'FeatureCollection'; features: Array<Record<string, unknown>> },
  fallbackCenter: [number, number],
  fallbackZoom: number,
) {
  const bounds = combinedFeatureBounds([geojson]);
  if (bounds) {
    map.fitBounds(bounds, { padding: 72, duration: 900, essential: true });
    return;
  }
  map.flyTo({ center: fallbackCenter, zoom: fallbackZoom, duration: 900, essential: true });
}

function combinedFeatureBounds(
  collections: Array<{ type: 'FeatureCollection'; features: Array<Record<string, unknown>> }>,
) {
  const points: Array<[number, number]> = [];
  for (const collection of collections) {
    for (const feature of collection.features) {
      const geometry = feature.geometry as { type?: string; coordinates?: unknown } | undefined;
      if (!geometry?.type || geometry.coordinates === undefined) {
        continue;
      }
      extractCoordinates(geometry.coordinates, points);
    }
  }
  if (points.length === 0) {
    return null;
  }
  return points.reduce(
    (bounds, point) => bounds.extend(point),
    new mapboxgl.LngLatBounds(points[0], points[0]),
  );
}

function extractCoordinates(value: unknown, points: Array<[number, number]>) {
  if (!Array.isArray(value)) {
    return;
  }
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    points.push([value[0], value[1]]);
    return;
  }
  for (const item of value) {
    extractCoordinates(item, points);
  }
}

function boundsFromImageCoordinates(coordinates: Array<[number, number]>) {
  if (coordinates.length === 0) {
    return null;
  }
  return coordinates.reduce(
    (bounds, point) => bounds.extend(point),
    new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]),
  );
}

function isRasterSymbolization(
  value: VectorSymbolization | RasterSymbolization,
): value is RasterSymbolization {
  return 'mode' in value && 'bands' in value;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatBytes(value: number) {
  if (value <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
