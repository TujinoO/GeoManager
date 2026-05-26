import { Badge, Button, Empty, Input, List, Slider, Switch, Tooltip, Typography } from 'antd';
import { Eye, EyeOff, Info, Layers, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LoadedLayer } from '../types';

interface Props {
  layers: LoadedLayer[];
  onVisibilityChange: (layerId: string, visible: boolean) => void;
  onOpacityChange: (layerId: string, value: number) => void;
  onRemoveLayer: (layerId: string) => void;
}

export default function LayerPanel({ layers, onVisibilityChange, onOpacityChange, onRemoveLayer }: Props) {
  const [query, setQuery] = useState('');
  const filteredLayers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return layers;
    }
    return layers.filter((layer) => `${layer.name} ${layer.sourceResource.name}`.toLowerCase().includes(keyword));
  }, [layers, query]);

  return (
    <section className="panel-section">
      <div className="panel-title">
        <Layers size={18} />
        <Typography.Title level={5}>已加载图层</Typography.Title>
        <Badge count={layers.filter((layer) => layer.visible).length} color="#2f7d62" />
      </div>
      <Input
        prefix={<Search size={15} />}
        placeholder="搜索已加载图层"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        allowClear
      />
      <List
        className="layer-list"
        dataSource={filteredLayers}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已加载图层" /> }}
        renderItem={(layer) => (
          <List.Item className="layer-row">
            <div className="layer-row-main">
              <div className="layer-heading">
                <Switch
                  checked={layer.visible}
                  size="small"
                  checkedChildren={<Eye size={12} />}
                  unCheckedChildren={<EyeOff size={12} />}
                  onChange={(checked) => onVisibilityChange(layer.id, checked)}
                />
                <div>
                  <Typography.Text strong>{layer.name}</Typography.Text>
                  <div className="layer-meta">{layer.summary}</div>
                </div>
              </div>
              <div className="icon-cluster">
                <Tooltip title={`来源数据：${layer.sourceResource.name}`}>
                  <Button size="small" type="text" icon={<Info size={15} />} />
                </Tooltip>
                <Tooltip title="移除">
                  <Button size="small" type="text" icon={<Trash2 size={15} />} onClick={() => onRemoveLayer(layer.id)} />
                </Tooltip>
              </div>
            </div>
            <div className="opacity-row">
              <Typography.Text type="secondary">透明度</Typography.Text>
              <Slider value={layer.opacity} min={5} max={100} onChange={(value) => onOpacityChange(layer.id, value)} />
            </div>
          </List.Item>
        )}
      />
    </section>
  );
}
