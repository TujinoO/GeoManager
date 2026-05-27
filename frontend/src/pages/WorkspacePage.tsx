import { App, Button, Layout, Popover, Tag, Typography } from 'antd';
import mapboxgl from 'mapbox-gl';
import { Database, Layers, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import DataPanel from '../components/DataPanel';
import LayerPanel from '../components/LayerPanel';
import MapCanvas from '../components/MapCanvas';
import { LayerContext, type LayerContextValue } from '../hooks/LayerContext';
import { useLayerGroups } from '../hooks/useLayerGroups';
import { useRasterRender } from '../hooks/useRasterRender';
import { createVectorLayerGroup, createRasterLayerGroup } from '../utils/layerFactory';
import {
  boundsFromImageCoordinates,
  combinedFeatureBounds,
  fitGeojsonBounds,
} from '../utils/geometry';
import type {
  AttributeFilter,
  Bootstrap,
  DataResource,
  DataResourceProfile,
  LoadedLayer,
  LoadedRasterLayer,
  LoadedVectorLayer,
  ResourceFilters,
  ResourceQueryResult,
  SpatialFilter,
  User,
} from '../types';
import type { VectorSymbolization, RasterSymbolization } from '../symbolization';

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
  const [spatialFilter, setSpatialFilter] = useState<SpatialFilter | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [dataPanelOpen, setDataPanelOpen] = useState(false);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);

  const layerGroups = useLayerGroups();
  const { startRasterRender, setMapInstance } = useRasterRender(layerGroups.updateRasterLayer);

  const mapLayers = useMemo(
    () =>
      layerGroups.groups.flatMap((group) =>
        group.visible
          ? group.children
              .filter((layer) => layer.visible)
              .map((layer) => ({
                ...layer,
                symbolization: {
                  ...layer.symbolization,
                  opacity: Math.round((layer.symbolization.opacity * group.symbolization.opacity) / 100),
                },
              } as LoadedLayer))
          : [],
      ),
    [layerGroups.groups],
  );

  useEffect(() => { loadResources({}); }, []);

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
    if (!selectedResource) { message.warning('请先选择数据资源'); return; }
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
    if (!selectedResource || !resourceProfile || !queryResult) return;
    const group = createVectorLayerGroup(selectedResource, resourceProfile, queryResult);
    layerGroups.addGroup(group);
    setDataPanelOpen(false);
    message.success('查询结果已加载到图层');
  }

  function handleLoadRaster() {
    if (!selectedResource || !resourceProfile?.raster) {
      message.warning('请先选择已完成预处理的栅格数据');
      return;
    }
    const group = createRasterLayerGroup(selectedResource, resourceProfile);
    if (!group) return;
    layerGroups.addGroup(group);
    setDataPanelOpen(false);
    const child = group.children[0] as LoadedRasterLayer;
    void startRasterRender(group.id, child.id, child.symbolization, child);
  }

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    mapInstanceRef.current = map;
    setMapInstance(map);
  }, [setMapInstance]);

  const handleMapDestroy = useCallback(() => {
    mapInstanceRef.current = null;
    setMapInstance(null);
  }, [setMapInstance]);

  const locateLayer = useCallback((groupId: string, layerId: string) => {
    const map = mapInstanceRef.current;
    if (!map) { message.warning('地图尚未准备好'); return; }
    const targetGroup = layerGroups.groups.find((g) => g.id === groupId);
    const targetLayer = targetGroup?.children.find((l) => l.id === layerId);
    if (!targetLayer) { message.warning('当前图层没有可定位的数据'); return; }
    if (targetLayer.layerType === 'raster' && targetLayer.imageCoordinates?.length) {
      const bounds = boundsFromImageCoordinates(targetLayer.imageCoordinates);
      if (bounds) { map.fitBounds(bounds, { padding: 72, duration: 900, essential: true }); return; }
    }
    if (targetLayer.layerType !== 'vector' || !targetLayer.geojson) { message.warning('当前图层没有可定位的数据'); return; }
    fitGeojsonBounds(map, targetLayer.geojson, bootstrap.map.defaultCenter, bootstrap.map.defaultZoom);
  }, [bootstrap.map.defaultCenter, bootstrap.map.defaultZoom, layerGroups.groups, message]);

  const locateGroup = useCallback((groupId: string) => {
    const map = mapInstanceRef.current;
    if (!map) { message.warning('地图尚未准备好'); return; }
    const targetGroup = layerGroups.groups.find((g) => g.id === groupId);
    if (!targetGroup) return;
    const geojsons = targetGroup.children
      .filter((l): l is import('../types').LoadedVectorLayer => l.layerType === 'vector')
      .map((l) => l.geojson);
    const rasterBounds = targetGroup.children
      .filter((l) => l.layerType === 'raster' && l.imageCoordinates?.length)
      .map((l) => boundsFromImageCoordinates((l as import('../types').LoadedRasterLayer).imageCoordinates!))
      .filter(Boolean) as mapboxgl.LngLatBounds[];
    if (geojsons.length === 0 && rasterBounds.length === 0) { message.warning('该图层组没有可定位的数据'); return; }
    const bounds = combinedFeatureBounds(geojsons);
    for (const rasterBound of rasterBounds) {
      if (bounds) { bounds.extend(rasterBound.getSouthWest()); bounds.extend(rasterBound.getNorthEast()); }
    }
    if (!bounds && rasterBounds.length > 0) { map.fitBounds(rasterBounds[0], { padding: 72, duration: 900, essential: true }); return; }
    if (!bounds) { message.warning('无法计算图层组范围'); return; }
    map.fitBounds(bounds, { padding: 72, duration: 900, essential: true });
  }, [layerGroups.groups, message]);

  async function handleLogout() {
    try { await api.logout(); }
    catch (error) { message.warning(error instanceof Error ? error.message : '退出接口异常，本地会话已清空'); }
    finally { onLogout(); }
  }

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
    startRasterRender: (groupId, layerId, symbolization, layer) => void startRasterRender(groupId, layerId, symbolization, layer),
    locateLayer,
    locateGroup,
    mapRef: mapInstanceRef,
  };

  return (
    <Layout className="workspace">      <Layout.Header className="workspace-header">
        <div className="header-left">
          <div className="brand-block">
            <Database size={22} />
            <div><Typography.Title level={4}>{bootstrap.systemName}</Typography.Title></div>
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
              <Button icon={<Settings size={16} />} onClick={() => window.location.assign('/admin/')}>后台管理</Button>
            )}
          </div>
        </div>
        <div className="header-account-actions">
          <div className="role-tags">
            {user.roles.map((role) => (<Tag key={role} color="green">{role}</Tag>))}
          </div>
          <Button icon={<ShieldCheck size={16} />} className="user-button">{user.displayName}</Button>
          <Button icon={<LogOut size={16} />} onClick={handleLogout}>退出</Button>
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
          <LayerContext.Provider value={layerContextValue}>
            <LayerPanel />
          </LayerContext.Provider>
        </aside>
      </div>
    </Layout>
  );
}
