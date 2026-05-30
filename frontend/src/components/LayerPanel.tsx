import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  InputNumber,
  Popover,
  Progress,
  Segmented,
  Space,
  Switch,
  Tooltip,
  Typography,
} from "antd";
import {
  ChevronDown,
  ChevronRight,
  Crosshair,
  Download,
  Eye,
  EyeOff,
  FileStack,
  FolderTree,
  GripVertical,
  Info,
  Layers,
  Palette,
  Search,
  Trash2,
} from "lucide-react";
import { type DragEvent, useEffect, useMemo, useState } from "react";
import { type DropPlacement, useLayerContext } from "../hooks/LayerContext";
import type { DrawMode } from "../map/spatialDraw";
import type {
  GroupSymbolization,
  RasterSymbolization,
  VectorSymbolization,
} from "../symbolization";
import type {
  ExportLayerItem,
  LoadedLayer,
  LoadedLayerGroup,
  RasterBandMetadata,
  ResourceField,
} from "../types";
import {
  GroupSymbolizationEditor,
  RasterSymbolizationEditor,
  VectorSymbolizationEditor,
} from "./SymbolizationEditor";

export default function LayerPanel() {
  const ctx = useLayerContext();
  const groups = ctx.groups;
  const [query, setQuery] = useState("");
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<{
    groupId: string;
    placement: DropPlacement;
  } | null>(null);
  const filteredGroups = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return groups;
    }
    return groups
      .map((group) => {
        const groupMatched = `${group.name} ${group.sourceResource.name}`
          .toLowerCase()
          .includes(keyword);
        const children = group.children.filter((layer) =>
          `${layer.name} ${layer.sourceResource.name} ${layer.summary}`
            .toLowerCase()
            .includes(keyword),
        );
        return groupMatched ? group : { ...group, children };
      })
      .filter((group) => group.children.length > 0);
  }, [groups, query]);

  const keyword = query.trim();

  function toggleGroup(groupId: string) {
    setCollapsedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  function handleDragStart(event: DragEvent<HTMLElement>, groupId: string) {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", groupId);
    setDraggingGroupId(groupId);
  }

  function handleDragOver(
    event: DragEvent<HTMLElement>,
    targetGroupId: string,
  ) {
    const sourceGroupId =
      draggingGroupId ?? event.dataTransfer.getData("text/plain");
    if (!sourceGroupId || sourceGroupId === targetGroupId) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = event.currentTarget.getBoundingClientRect();
    const placement =
      event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDragTarget({ groupId: targetGroupId, placement });
  }

  function handleDrop(event: DragEvent<HTMLElement>, targetGroupId: string) {
    const sourceGroupId =
      event.dataTransfer.getData("text/plain") || draggingGroupId;
    if (!sourceGroupId || sourceGroupId === targetGroupId) {
      setDraggingGroupId(null);
      setDragTarget(null);
      return;
    }
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const placement =
      event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    ctx.reorderGroups(sourceGroupId, targetGroupId, placement);
    setDraggingGroupId(null);
    setDragTarget(null);
  }

  function handleLayerSymbolizationChange(
    groupId: string,
    layerId: string,
    symbolization: VectorSymbolization | RasterSymbolization,
  ) {
    if (!ctx.canUseCustomSymbolization) {
      return;
    }
    const targetLayer = ctx.groups
      .find((g) => g.id === groupId)
      ?.children.find((l) => l.id === layerId);
    ctx.setLayerSymbolization(groupId, layerId, symbolization);
    if (
      "mode" in symbolization &&
      "bands" in symbolization &&
      targetLayer?.layerType === "raster"
    ) {
      ctx.startRasterRender(
        groupId,
        layerId,
        symbolization,
        { ...targetLayer, symbolization },
        "custom",
      );
    }
  }

  return (
    <section className="panel-section">
      <div className="panel-title">
        <Layers size={18} />
        <Typography.Title level={5}>已加载图层</Typography.Title>
        <Badge
          count={groups.filter((group) => group.visible).length}
          color="#2f7d62"
        />
      </div>
      <Input
        prefix={<Search size={15} />}
        placeholder="搜索图层组或图层"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        allowClear
      />
      {filteredGroups.length > 0 ? (
        <div className="layer-tree" role="tree" aria-label="已加载图层组">
          {filteredGroups.map((group) => {
            const expanded = keyword ? true : !collapsedGroupIds.has(group.id);
            const dropClass =
              dragTarget?.groupId === group.id
                ? ` layer-group-drop-${dragTarget.placement}`
                : "";
            return (
              <div
                key={group.id}
                className={`layer-group-shell${draggingGroupId === group.id ? " is-dragging" : ""}${dropClass}`}
                role="treeitem"
                tabIndex={0}
                aria-expanded={expanded}
                onDragOver={(event) => handleDragOver(event, group.id)}
                onDragLeave={() => setDragTarget(null)}
                onDrop={(event) => handleDrop(event, group.id)}
              >
                <LayerGroupNode
                  group={group}
                  expanded={expanded}
                  onToggleExpand={() => toggleGroup(group.id)}
                  onDragStart={(event) => handleDragStart(event, group.id)}
                  onDragEnd={() => {
                    setDraggingGroupId(null);
                    setDragTarget(null);
                  }}
                  onVisibilityChange={ctx.setGroupVisibility}
                  onNameChange={ctx.setGroupName}
                  onSymbolizationChange={ctx.setGroupSymbolization}
                  onLocate={ctx.locateGroup}
                  onRemove={ctx.removeGroup}
                  exportItems={exportItemsForGroup(group)}
                />
                {expanded && (
                  <fieldset className="layer-children">
                    {group.children.map((layer) => (
                      <LayerItemNode
                        key={layer.id}
                        groupId={group.id}
                        layer={layer}
                        onVisibilityChange={ctx.setLayerVisibility}
                        onNameChange={ctx.setLayerName}
                        onSymbolizationChange={handleLayerSymbolizationChange}
                        onLocate={ctx.locateLayer}
                        onRemove={ctx.removeLayer}
                        exportItems={exportItemsForLayer(layer)}
                      />
                    ))}
                  </fieldset>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          className="layer-empty"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无已加载图层"
        />
      )}
    </section>
  );
}

interface GroupNodeProps {
  group: LoadedLayerGroup;
  expanded: boolean;
  onToggleExpand: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onVisibilityChange: (groupId: string, visible: boolean) => void;
  onNameChange: (groupId: string, name: string) => void;
  onSymbolizationChange: (groupId: string, value: GroupSymbolization) => void;
  onLocate: (groupId: string) => void;
  onRemove: (groupId: string) => void;
  exportItems: ExportLayerItem[];
}

function LayerGroupNode({
  group,
  expanded,
  onToggleExpand,
  onDragStart,
  onDragEnd,
  onVisibilityChange,
  onNameChange,
  onSymbolizationChange,
  onLocate,
  onRemove,
  exportItems,
}: GroupNodeProps) {
  const ctx = useLayerContext();
  return (
    <div className="layer-tree-node layer-tree-node-group">
      <div className="layer-row-main">
        <div className="layer-heading">
          <Tooltip title={expanded ? "折叠图层组" : "展开图层组"}>
            <Button
              className="layer-icon-button"
              type="text"
              size="small"
              aria-label={expanded ? `折叠${group.name}` : `展开${group.name}`}
              icon={
                expanded ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )
              }
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpand();
              }}
            />
          </Tooltip>
          <Switch
            className="visibility-switch"
            checked={group.visible}
            size="small"
            checkedChildren={<Eye size={10} />}
            unCheckedChildren={<EyeOff size={10} />}
            onChange={(checked) => onVisibilityChange(group.id, checked)}
          />
          <FolderTree size={14} />
        </div>
        <div className="layer-row-tools">
          <NodeActions
            metadata={group.metadata}
            symbolization={group.symbolization}
            fields={[]}
            subjectName={group.name}
            onSymbolizationChange={(next) =>
              onSymbolizationChange(group.id, next as GroupSymbolization)
            }
            onLocate={() => onLocate(group.id)}
            onRemove={() => onRemove(group.id)}
            exportItems={exportItems}
            canUseCustomSymbolization={ctx.canUseCustomSymbolization}
            canExportData={ctx.canExportData}
          />
          <Tooltip title="拖动排序">
            <Button
              className="layer-drag-handle action-btn"
              type="text"
              size="small"
              aria-label={`拖动${group.name}排序`}
              draggable
              icon={<GripVertical size={14} />}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onClick={(event) => event.stopPropagation()}
            />
          </Tooltip>
        </div>
      </div>
      <div className="layer-name-row">
        <Typography.Text
          strong
          editable={{
            onChange: (next) =>
              onNameChange(group.id, next.trim() || group.name),
          }}
        >
          {group.name}
        </Typography.Text>
      </div>
    </div>
  );
}

interface LayerNodeProps {
  groupId: string;
  layer: LoadedLayer;
  onVisibilityChange: (
    groupId: string,
    layerId: string,
    visible: boolean,
  ) => void;
  onNameChange: (groupId: string, layerId: string, name: string) => void;
  onSymbolizationChange: (
    groupId: string,
    layerId: string,
    value: VectorSymbolization | RasterSymbolization,
  ) => void;
  onLocate: (groupId: string, layerId: string) => void;
  onRemove: (groupId: string, layerId: string) => void;
  exportItems: ExportLayerItem[];
}

function LayerItemNode({
  groupId,
  layer,
  onVisibilityChange,
  onNameChange,
  onSymbolizationChange,
  onLocate,
  onRemove,
  exportItems,
}: LayerNodeProps) {
  const ctx = useLayerContext();
  return (
    <div className="layer-tree-node">
      <div className="layer-row-main">
        <div className="layer-heading">
          <Switch
            className="visibility-switch"
            checked={layer.visible}
            size="small"
            checkedChildren={<Eye size={10} />}
            unCheckedChildren={<EyeOff size={10} />}
            onChange={(checked) =>
              onVisibilityChange(groupId, layer.id, checked)
            }
          />
          <FileStack size={14} />
        </div>
        <NodeActions
          metadata={layer.metadata}
          symbolization={layer.symbolization}
          fields={layer.fields}
          rasterBands={
            layer.layerType === "raster"
              ? (layer.rasterMetadata?.bands ?? [])
              : []
          }
          rasterDatasetId={
            layer.layerType === "raster" ? layer.rasterDatasetId : undefined
          }
          subjectName={layer.name}
          onSymbolizationChange={(next) =>
            onSymbolizationChange(
              groupId,
              layer.id,
              next as VectorSymbolization | RasterSymbolization,
            )
          }
          onLocate={() => onLocate(groupId, layer.id)}
          onRemove={() => onRemove(groupId, layer.id)}
          exportItems={exportItems}
          canUseCustomSymbolization={ctx.canUseCustomSymbolization}
          canExportData={ctx.canExportData}
        />
      </div>
      <div className="layer-name-row">
        <Typography.Text
          strong
          editable={{
            onChange: (next) =>
              onNameChange(groupId, layer.id, next.trim() || layer.name),
          }}
        >
          {layer.name}
        </Typography.Text>
      </div>
    </div>
  );
}

interface NodeActionProps {
  metadata: Record<string, string | number | boolean | null | undefined>;
  symbolization: GroupSymbolization | VectorSymbolization | RasterSymbolization;
  fields: ResourceField[];
  rasterBands?: RasterBandMetadata[];
  rasterDatasetId?: number;
  subjectName: string;
  onSymbolizationChange: (
    value: GroupSymbolization | VectorSymbolization | RasterSymbolization,
  ) => void;
  onLocate: () => void;
  onRemove: () => void;
  exportItems: ExportLayerItem[];
  canUseCustomSymbolization: boolean;
  canExportData: boolean;
}

function NodeActions({
  metadata,
  symbolization,
  fields,
  rasterBands = [],
  rasterDatasetId,
  subjectName,
  onSymbolizationChange,
  onLocate,
  onRemove,
  exportItems,
  canUseCustomSymbolization,
  canExportData,
}: NodeActionProps) {
  const ctx = useLayerContext();
  const { message } = App.useApp();
  const [symbolizationOpen, setSymbolizationOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [draftSymbolization, setDraftSymbolization] = useState(symbolization);
  const [exportReproject, setExportReproject] = useState(false);
  const [exportClip, setExportClip] = useState(false);
  const [exportEpsg, setExportEpsg] = useState<number | null>(
    defaultExportEpsg(exportItems),
  );
  const [exportRunning, setExportRunning] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessages, setExportMessages] = useState<string[]>([]);
  const isDeferredSymbolization =
    isVectorSymbolization(symbolization) ||
    isRasterSymbolization(symbolization);

  useEffect(() => {
    if (!symbolizationOpen) {
      setDraftSymbolization(symbolization);
    }
  }, [symbolization, symbolizationOpen]);

  function handleSymbolizationOpenChange(open: boolean) {
    if (open && !canUseCustomSymbolization) {
      return;
    }
    setSymbolizationOpen(open);
    if (open) {
      setDraftSymbolization(symbolization);
    }
  }

  function handleExportOpenChange(open: boolean) {
    if (open && !canExportData) {
      return;
    }
    setExportOpen(open);
    if (open) {
      setExportEpsg(defaultExportEpsg(exportItems));
      setExportProgress(0);
      setExportMessages([]);
    }
  }

  async function confirmExport() {
    const exportableItems = exportItems.filter(
      (item) => item.layerType === "vector" || item.datasetId,
    );
    if (exportableItems.length === 0) {
      message.warning("当前对象没有可导出的数据");
      return;
    }
    if (exportReproject && !exportEpsg) {
      message.warning("请填写目标坐标系 EPSG");
      return;
    }
    if (exportClip && !ctx.exportClipGeometry) {
      message.warning("请先在地图上绘制裁切范围");
      return;
    }
    setExportRunning(true);
    try {
      await ctx.exportLayers(
        exportableItems,
        {
          epsg: exportEpsg,
          reproject: exportReproject,
          clip: exportClip,
          clipGeometry: exportClip ? ctx.exportClipGeometry : null,
        },
        ({ percent, messages }) => {
          setExportProgress(percent);
          setExportMessages(messages);
        },
      );
      setExportOpen(false);
    } finally {
      setExportRunning(false);
    }
  }

  function applyDraftSymbolization() {
    if (!canUseCustomSymbolization) {
      return;
    }
    onSymbolizationChange(draftSymbolization);
    setSymbolizationOpen(false);
  }

  function renderSymbolizationEditor() {
    if (isVectorSymbolization(draftSymbolization) && isDeferredSymbolization) {
      return (
        <VectorSymbolizationEditor
          value={draftSymbolization}
          fields={fields}
          onChange={setDraftSymbolization}
          onApply={applyDraftSymbolization}
        />
      );
    }
    if (isRasterSymbolization(draftSymbolization) && isDeferredSymbolization) {
      return (
        <RasterSymbolizationEditor
          value={draftSymbolization}
          bands={rasterBands}
          datasetId={rasterDatasetId}
          onChange={setDraftSymbolization}
          onApply={applyDraftSymbolization}
        />
      );
    }
    return (
      <GroupSymbolizationEditor
        value={symbolization}
        onChange={onSymbolizationChange}
      />
    );
  }

  return (
    <button
      type="button"
      className="icon-cluster"
      onClick={(event) => event.stopPropagation()}
    >
      <Popover
        trigger="click"
        placement="leftTop"
        content={
          <MetadataCard metadata={metadata} title={`${subjectName} 元数据`} />
        }
      >
        <Tooltip title="元数据">
          <Button
            className="action-btn"
            size="small"
            type="text"
            aria-label={`${subjectName}元数据`}
            icon={<Info size={14} />}
          />
        </Tooltip>
      </Popover>
      <Tooltip title="定位">
        <Button
          className="action-btn"
          size="small"
          type="text"
          aria-label={`定位${subjectName}`}
          icon={<Crosshair size={14} />}
          onClick={onLocate}
        />
      </Tooltip>
      <Popover
        trigger="click"
        placement="leftTop"
        overlayClassName="symbolization-popover"
        open={exportOpen}
        onOpenChange={handleExportOpenChange}
        content={
          <ExportOptionsCard
            title={`导出 ${subjectName}`}
            epsg={exportEpsg}
            reproject={exportReproject}
            clip={exportClip}
            clipReady={Boolean(ctx.exportClipGeometry)}
            running={exportRunning}
            progress={exportProgress}
            messages={exportMessages}
            onEpsgChange={setExportEpsg}
            onReprojectChange={setExportReproject}
            onClipChange={(checked) => {
              setExportClip(checked);
              if (!checked) ctx.clearExportClipGeometry();
            }}
            onDrawClip={ctx.startExportClipDraw}
            onClearClip={ctx.clearExportClipGeometry}
            onExport={confirmExport}
          />
        }
      >
        {canExportData && (
          <Tooltip title="导出">
            <Button
              className="action-btn"
              size="small"
              type="text"
              aria-label={`导出${subjectName}`}
              icon={<Download size={14} />}
            />
          </Tooltip>
        )}
      </Popover>
      <Popover
        trigger="click"
        placement="leftTop"
        overlayClassName="symbolization-popover"
        open={symbolizationOpen}
        onOpenChange={handleSymbolizationOpenChange}
        content={renderSymbolizationEditor()}
      >
        {canUseCustomSymbolization && (
          <Tooltip title="符号化">
            <Button
              className="action-btn"
              size="small"
              type="text"
              aria-label={`${subjectName}符号化`}
              icon={<Palette size={14} />}
            />
          </Tooltip>
        )}
      </Popover>
      <Tooltip title="移除">
        <Button
          className="action-btn"
          size="small"
          type="text"
          aria-label={`移除${subjectName}`}
          icon={<Trash2 size={14} />}
          onClick={onRemove}
        />
      </Tooltip>
    </button>
  );
}

function isVectorSymbolization(
  value: GroupSymbolization | VectorSymbolization | RasterSymbolization,
): value is VectorSymbolization {
  return "pointMode" in value;
}

function isRasterSymbolization(
  value: GroupSymbolization | VectorSymbolization | RasterSymbolization,
): value is RasterSymbolization {
  return "mode" in value && "bands" in value;
}

function exportItemsForGroup(group: LoadedLayerGroup): ExportLayerItem[] {
  return group.children.flatMap((layer) => exportItemsForLayer(layer));
}

function exportItemsForLayer(layer: LoadedLayer): ExportLayerItem[] {
  if (layer.layerType === "vector") {
    return [
      {
        layerType: "vector",
        name: layer.name,
        resourceId: layer.sourceResource.id,
        geojson: layer.geojson,
        sourceCrs: layer.sourceResource.coordinateSystem,
      },
    ];
  }
  return [
    {
      layerType: "raster",
      name: layer.name,
      resourceId: layer.sourceResource.id,
      datasetId: layer.rasterDatasetId,
      sourceCrs:
        layer.rasterMetadata?.coordinateSystem ??
        layer.sourceResource.coordinateSystem,
    },
  ];
}

function MetadataCard({
  metadata,
  title,
}: {
  metadata: Record<string, string | number | boolean | null | undefined>;
  title: string;
}) {
  const entries = Object.entries(metadata).filter(
    ([, value]) => value !== undefined && value !== "",
  );
  return (
    <Card className="metadata-card" size="small" title={title}>
      <Descriptions size="small" column={1}>
        {entries.map(([key, value]) => (
          <Descriptions.Item key={key} label={key}>
            {String(value ?? "-")}
          </Descriptions.Item>
        ))}
      </Descriptions>
    </Card>
  );
}

function ExportOptionsCard({
  title,
  epsg,
  reproject,
  clip,
  clipReady,
  running,
  progress,
  messages,
  onEpsgChange,
  onReprojectChange,
  onClipChange,
  onDrawClip,
  onClearClip,
  onExport,
}: {
  title: string;
  epsg: number | null;
  reproject: boolean;
  clip: boolean;
  clipReady: boolean;
  running: boolean;
  progress: number;
  messages: string[];
  onEpsgChange: (value: number | null) => void;
  onReprojectChange: (value: boolean) => void;
  onClipChange: (value: boolean) => void;
  onDrawClip: (mode: DrawMode) => void;
  onClearClip: () => void;
  onExport: () => void;
}) {
  const latestMessage =
    messages.length > 0 ? messages[messages.length - 1] : "";
  return (
    <Card className="symbolization-card export-card" size="small" title={title}>
      <Space direction="vertical" className="full-width symbolization-stack">
        <div className="export-option-row">
          <Typography.Text strong>重投影</Typography.Text>
          <Switch checked={reproject} onChange={onReprojectChange} />
        </div>
        <label className="export-epsg-field" htmlFor="export-epsg-input">
          <span>目标坐标系 EPSG</span>
          <InputNumber
            id="export-epsg-input"
            className="full-width"
            min={1024}
            max={999999}
            value={epsg}
            disabled={!reproject}
            onChange={(value) =>
              onEpsgChange(typeof value === "number" ? value : null)
            }
          />
        </label>
        <div className="export-option-row">
          <Typography.Text strong>裁切</Typography.Text>
          <Switch checked={clip} onChange={onClipChange} />
        </div>
        {clip && (
          <Space direction="vertical" className="full-width compact-stack">
            <Segmented
              block
              options={[
                { label: "矩形", value: "rectangle" },
                { label: "圆形", value: "circle" },
                { label: "多边形", value: "polygon" },
              ]}
              onChange={(mode) => onDrawClip(mode as DrawMode)}
            />
            <div className="export-clip-actions">
              <Typography.Text type={clipReady ? "success" : "secondary"}>
                {clipReady ? "已绘制裁切范围" : "未绘制裁切范围"}
              </Typography.Text>
              <Button size="small" onClick={onClearClip} disabled={!clipReady}>
                清除
              </Button>
            </div>
          </Space>
        )}
        {running && (
          <Space direction="vertical" className="full-width compact-stack">
            <Progress percent={progress} size="small" />
            {latestMessage && (
              <Alert type="info" showIcon message={latestMessage} />
            )}
          </Space>
        )}
        <Button
          type="primary"
          icon={<Download size={15} />}
          loading={running}
          disabled={running || (clip && !clipReady)}
          onClick={onExport}
        >
          导出
        </Button>
      </Space>
    </Card>
  );
}

function defaultExportEpsg(items: ExportLayerItem[]) {
  for (const item of items) {
    const epsg = parseEpsg(item.sourceCrs);
    if (epsg) return epsg;
  }
  return 4326;
}

function parseEpsg(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const match = String(value ?? "").match(/EPSG[:\s-]*(\d{4,6})/i);
  return match ? Number(match[1]) : null;
}
