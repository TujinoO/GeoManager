import {
  App,
  Badge,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popover,
  Progress,
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
import { useLayerContext } from "../hooks/LayerContext";
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

type DropPlacement = "before" | "after";

export default function LayerPanel() {
  const ctx = useLayerContext();
  const { message } = App.useApp();
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
  const [exportTarget, setExportTarget] = useState<{
    name: string;
    items: ExportLayerItem[];
  } | null>(null);
  const [exportEpsg, setExportEpsg] = useState<number | null>(4326);
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

  function openExportDialog(name: string, items: ExportLayerItem[]) {
    if (!ctx.canExportData) {
      message.warning(ctx.permissionDeniedMessage);
      return;
    }
    const exportableItems = items.filter(
      (item) => item.layerType === "vector" || item.datasetId,
    );
    if (exportableItems.length === 0) {
      message.warning("当前对象没有可导出的数据");
      return;
    }
    setExportTarget({ name, items: exportableItems });
    setExportEpsg(4326);
  }

  async function confirmExport() {
    if (!exportTarget || !exportEpsg) return;
    await ctx.exportLayers(exportTarget.items, exportEpsg);
    setExportTarget(null);
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
                  onExport={() =>
                    openExportDialog(group.name, exportItemsForGroup(group))
                  }
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
                        onExport={() =>
                          openExportDialog(
                            layer.name,
                            exportItemsForLayer(layer),
                          )
                        }
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
      <Modal
        title={`导出 ${exportTarget?.name ?? ""}`}
        open={Boolean(exportTarget)}
        okText="导出"
        cancelText="取消"
        onOk={confirmExport}
        onCancel={() => setExportTarget(null)}
      >
        <label className="export-epsg-field" htmlFor="export-epsg-input">
          <span>目标坐标系 EPSG</span>
          <InputNumber
            id="export-epsg-input"
            className="full-width"
            min={1024}
            max={999999}
            value={exportEpsg}
            onChange={(value) =>
              setExportEpsg(typeof value === "number" ? value : null)
            }
          />
        </label>
      </Modal>
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
  onExport: () => void;
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
  onExport,
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
            onExport={onExport}
            canUseCustomSymbolization={ctx.canUseCustomSymbolization}
            canExportData={ctx.canExportData}
            permissionDeniedMessage={ctx.permissionDeniedMessage}
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
  onExport: () => void;
}

function LayerItemNode({
  groupId,
  layer,
  onVisibilityChange,
  onNameChange,
  onSymbolizationChange,
  onLocate,
  onRemove,
  onExport,
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
          onExport={onExport}
          canUseCustomSymbolization={ctx.canUseCustomSymbolization}
          canExportData={ctx.canExportData}
          permissionDeniedMessage={ctx.permissionDeniedMessage}
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
        {layer.layerType === "raster" && layer.renderStatus === "running" && (
          <Progress
            className="layer-render-progress"
            percent={layer.renderProgress ?? 0}
            size="small"
            showInfo={false}
          />
        )}
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
  onExport: () => void;
  canUseCustomSymbolization: boolean;
  canExportData: boolean;
  permissionDeniedMessage: string;
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
  onExport,
  canUseCustomSymbolization,
  canExportData,
  permissionDeniedMessage,
}: NodeActionProps) {
  const [symbolizationOpen, setSymbolizationOpen] = useState(false);
  const [draftSymbolization, setDraftSymbolization] = useState(symbolization);
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

  function applyDraftSymbolization() {
    if (!canUseCustomSymbolization) {
      return;
    }
    onSymbolizationChange(draftSymbolization);
    setSymbolizationOpen(false);
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
      <Tooltip title={canExportData ? "导出" : permissionDeniedMessage}>
        <span>
          <Button
            className="action-btn"
            size="small"
            type="text"
            aria-label={`导出${subjectName}`}
            icon={<Download size={14} />}
            disabled={!canExportData}
            onClick={onExport}
          />
        </span>
      </Tooltip>
      <Popover
        trigger="click"
        placement="leftTop"
        overlayClassName="symbolization-popover"
        open={symbolizationOpen}
        onOpenChange={handleSymbolizationOpenChange}
        content={
          isVectorSymbolization(draftSymbolization) &&
          isDeferredSymbolization ? (
            <VectorSymbolizationEditor
              value={draftSymbolization}
              fields={fields}
              onChange={setDraftSymbolization}
              onApply={applyDraftSymbolization}
            />
          ) : isRasterSymbolization(draftSymbolization) &&
            isDeferredSymbolization ? (
            <RasterSymbolizationEditor
              value={draftSymbolization}
              bands={rasterBands}
              datasetId={rasterDatasetId}
              onChange={setDraftSymbolization}
              onApply={applyDraftSymbolization}
            />
          ) : (
            <GroupSymbolizationEditor
              value={symbolization}
              onChange={onSymbolizationChange}
            />
          )
        }
      >
        <Tooltip
          title={canUseCustomSymbolization ? "符号化" : permissionDeniedMessage}
        >
          <span>
            <Button
              className="action-btn"
              size="small"
              type="text"
              aria-label={`${subjectName}符号化`}
              icon={<Palette size={14} />}
              disabled={!canUseCustomSymbolization}
            />
          </span>
        </Tooltip>
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
      },
    ];
  }
  return [
    {
      layerType: "raster",
      name: layer.name,
      resourceId: layer.sourceResource.id,
      datasetId: layer.rasterDatasetId,
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
