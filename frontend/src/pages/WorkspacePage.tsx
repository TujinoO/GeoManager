import { App, Button, Layout, Tag, Typography } from 'antd';
import { Database, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import DataPanel from '../components/DataPanel';
import LayerPanel from '../components/LayerPanel';
import MapCanvas from '../components/MapCanvas';
import type {
  AttributeFilter,
  Bootstrap,
  DataResource,
  DataResourceProfile,
  LoadedLayer,
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
  const [loadedLayers, setLoadedLayers] = useState<LoadedLayer[]>([]);
  const [spatialFilter, setSpatialFilter] = useState<SpatialFilter | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [querying, setQuerying] = useState(false);

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
    const layer: LoadedLayer = {
      id: `result-${selectedResource.id}-${Date.now()}`,
      name: `${selectedResource.name} 查询结果`,
      sourceResource: selectedResource,
      geojson: queryResult.geojson,
      geometryType: resourceProfile.geometryType,
      visible: true,
      opacity: 90,
      summary: `${queryResult.returnedCount}/${queryResult.totalCount} 条 · ${resourceProfile.geometryType || '空间数据'}`,
    };
    setLoadedLayers((current) => [layer, ...current]);
    message.success('查询结果已加载到图层');
  }

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
        <div className="brand-block">
          <Database size={22} />
          <div>
            <Typography.Title level={4}>{bootstrap.systemName}</Typography.Title>
          </div>
        </div>
        <div className="header-actions">
          {user.roles.map((role) => (
            <Tag key={role} color="green">
              {role}
            </Tag>
          ))}
          {user.permissions.canAccessAdmin && (
            <Button icon={<Settings size={16} />} onClick={() => window.location.assign('/admin/')}>
              后台管理
            </Button>
          )}
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
            loadedLayers={loadedLayers}
            drawMode={drawMode}
            spatialFilter={spatialFilter}
            onSpatialFilterChange={handleSpatialFilterChange}
          />
        </main>
        <aside className="floating-panel floating-panel-left">
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
          />
        </aside>
        <aside className="floating-panel floating-panel-right">
          <LayerPanel
            layers={loadedLayers}
            onVisibilityChange={(layerId, visible) =>
              setLoadedLayers((current) =>
                current.map((layer) => (layer.id === layerId ? { ...layer, visible } : layer)),
              )
            }
            onOpacityChange={(layerId, opacity) =>
              setLoadedLayers((current) =>
                current.map((layer) => (layer.id === layerId ? { ...layer, opacity } : layer)),
              )
            }
            onRemoveLayer={(layerId) => setLoadedLayers((current) => current.filter((layer) => layer.id !== layerId))}
          />
        </aside>
      </div>
    </Layout>
  );
}
