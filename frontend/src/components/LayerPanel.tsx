import {
  AimOutlined,
  BgColorsOutlined,
  DeleteOutlined,
  DownloadOutlined,
  DownOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FileOutlined,
  FolderOpenOutlined,
  HolderOutlined,
  RightOutlined,
  SaveOutlined,
  SearchOutlined,
  TableOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popover,
  Progress,
  Segmented,
  Select,
  Space,
  Spin,
  Switch,
  Tooltip,
  Typography,
} from "antd";
import {
  type DragEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type DropPlacement,
  type LayerDropPlacement,
  useLayerContext,
} from "../hooks/LayerContext";
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
  WorkspaceSceneKind,
} from "../types";
import { resourceExportId } from "../utils/resources";

const RasterSymbolizationEditor = lazy(() =>
  import("./SymbolizationEditor").then((module) => ({
    default: module.RasterSymbolizationEditor,
  })),
);
const VectorSymbolizationEditor = lazy(() =>
  import("./SymbolizationEditor").then((module) => ({
    default: module.VectorSymbolizationEditor,
  })),
);

export default function LayerPanel() {
  const ctx = useLayerContext();
  const { message } = App.useApp();
  const [saveForm] = Form.useForm<SaveWorkspaceFormValues>();
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
  const [draggingLayer, setDraggingLayer] = useState<{
    groupId: string;
    layerId: string;
  } | null>(null);
  const [layerDropTarget, setLayerDropTarget] = useState<{
    groupId: string;
    layerId: string | null;
    placement: LayerDropPlacement;
  } | null>(null);
  const [saveKind, setSaveKind] = useState<WorkspaceSceneKind>("project");
  const [saveMode, setSaveMode] = useState<"create" | "update">("create");
  const [saveOpen, setSaveOpen] = useState(false);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const groupDragFrameRef = useRef<number | null>(null);
  const groupDragPendingRef = useRef<{
    element: HTMLElement;
    clientY: number;
    targetGroupId: string;
  } | null>(null);
  const layerDragFrameRef = useRef<number | null>(null);
  const layerDragPendingRef = useRef<{
    element: HTMLElement;
    clientY: number;
    targetGroupId: string;
    targetLayerId: string;
  } | null>(null);
  const selectedSaveTargetId = Form.useWatch("targetId", saveForm);
  const saveTargetScenes = useMemo(
    () => ctx.workspaceScenes.filter((scene) => scene.kind === saveKind),
    [ctx.workspaceScenes, saveKind],
  );
  const selectedSaveTarget = useMemo(
    () => saveTargetScenes.find((scene) => scene.id === selectedSaveTargetId),
    [saveTargetScenes, selectedSaveTargetId],
  );
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

  const setDragTargetIfChanged = useCallback(
    (next: { groupId: string; placement: DropPlacement } | null) => {
      setDragTarget((current) =>
        current?.groupId === next?.groupId &&
        current?.placement === next?.placement
          ? current
          : next,
      );
    },
    [],
  );

  const setLayerDropTargetIfChanged = useCallback(
    (
      next: {
        groupId: string;
        layerId: string | null;
        placement: LayerDropPlacement;
      } | null,
    ) => {
      setLayerDropTarget((current) =>
        current?.groupId === next?.groupId &&
        current?.layerId === next?.layerId &&
        current?.placement === next?.placement
          ? current
          : next,
      );
    },
    [],
  );

  const scheduleGroupDragTarget = useCallback(
    (element: HTMLElement, clientY: number, targetGroupId: string) => {
      groupDragPendingRef.current = { element, clientY, targetGroupId };
      if (groupDragFrameRef.current !== null) return;
      groupDragFrameRef.current = window.requestAnimationFrame(() => {
        groupDragFrameRef.current = null;
        const pending = groupDragPendingRef.current;
        groupDragPendingRef.current = null;
        if (!pending) return;
        const rect = pending.element.getBoundingClientRect();
        const placement =
          pending.clientY < rect.top + rect.height / 2 ? "before" : "after";
        setDragTargetIfChanged({
          groupId: pending.targetGroupId,
          placement,
        });
      });
    },
    [setDragTargetIfChanged],
  );

  const scheduleLayerDragTarget = useCallback(
    (
      element: HTMLElement,
      clientY: number,
      targetGroupId: string,
      targetLayerId: string,
    ) => {
      layerDragPendingRef.current = {
        element,
        clientY,
        targetGroupId,
        targetLayerId,
      };
      if (layerDragFrameRef.current !== null) return;
      layerDragFrameRef.current = window.requestAnimationFrame(() => {
        layerDragFrameRef.current = null;
        const pending = layerDragPendingRef.current;
        layerDragPendingRef.current = null;
        if (!pending) return;
        const rect = pending.element.getBoundingClientRect();
        const placement =
          pending.clientY < rect.top + rect.height / 2 ? "before" : "after";
        setLayerDropTargetIfChanged({
          groupId: pending.targetGroupId,
          layerId: pending.targetLayerId,
          placement,
        });
      });
    },
    [setLayerDropTargetIfChanged],
  );

  useEffect(() => {
    return () => {
      if (groupDragFrameRef.current !== null) {
        window.cancelAnimationFrame(groupDragFrameRef.current);
      }
      if (layerDragFrameRef.current !== null) {
        window.cancelAnimationFrame(layerDragFrameRef.current);
      }
    };
  }, []);

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

  function openSaveWorkspace(kind: WorkspaceSceneKind) {
    if (groups.length === 0) {
      message.warning("当前没有可保存的图层");
      return;
    }
    setSaveKind(kind);
    setSaveMode("create");
    saveForm.setFieldsValue({
      targetId: undefined,
      name: "",
      description: "",
    });
    setSaveOpen(true);
  }

  async function submitSaveWorkspace() {
    const values = await saveForm.validateFields();
    const targetScene =
      saveMode === "update"
        ? saveTargetScenes.find((scene) => scene.id === values.targetId)
        : null;
    if (saveMode === "update" && !targetScene) {
      message.warning(
        `请选择要覆盖的${saveKind === "project" ? "工程" : "专题"}`,
      );
      return;
    }
    setSavingWorkspace(true);
    try {
      await ctx.saveWorkspace(
        saveKind,
        saveMode === "update" && targetScene
          ? {
              targetId: targetScene.id,
              name: targetScene.name,
              description: targetScene.description,
            }
          : values,
      );
      setSaveOpen(false);
    } finally {
      setSavingWorkspace(false);
    }
  }

  function handleDragStart(event: DragEvent<HTMLElement>, groupId: string) {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `group:${groupId}`);
    setDraggingGroupId(groupId);
  }

  function handleDragOver(
    event: DragEvent<HTMLElement>,
    targetGroupId: string,
  ) {
    const sourceGroupId =
      draggingGroupId ??
      groupIdFromDrag(event.dataTransfer.getData("text/plain"));
    if (!sourceGroupId || sourceGroupId === targetGroupId) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    scheduleGroupDragTarget(event.currentTarget, event.clientY, targetGroupId);
  }

  function handleDrop(event: DragEvent<HTMLElement>, targetGroupId: string) {
    const sourceGroupId =
      groupIdFromDrag(event.dataTransfer.getData("text/plain")) ||
      draggingGroupId;
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

  function handleLayerDragStart(
    event: DragEvent<HTMLElement>,
    groupId: string,
    layerId: string,
  ) {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `layer:${groupId}:${layerId}`);
    setDraggingLayer({ groupId, layerId });
  }

  function handleLayerDragOverGroup(
    event: DragEvent<HTMLElement>,
    targetGroupId: string,
  ) {
    const sourceLayer =
      draggingLayer ??
      layerPayloadFromDrag(event.dataTransfer.getData("text/plain"));
    if (!sourceLayer) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setLayerDropTargetIfChanged({
      groupId: targetGroupId,
      layerId: null,
      placement: "inside",
    });
  }

  function handleLayerDragOverLayer(
    event: DragEvent<HTMLElement>,
    targetGroupId: string,
    targetLayerId: string,
  ) {
    const sourceLayer =
      draggingLayer ??
      layerPayloadFromDrag(event.dataTransfer.getData("text/plain"));
    if (!sourceLayer || sourceLayer.layerId === targetLayerId) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    scheduleLayerDragTarget(
      event.currentTarget,
      event.clientY,
      targetGroupId,
      targetLayerId,
    );
  }

  function handleLayerDrop(
    event: DragEvent<HTMLElement>,
    targetGroupId: string,
    targetLayerId: string | null,
    placement: LayerDropPlacement,
  ) {
    const sourceLayer =
      layerPayloadFromDrag(event.dataTransfer.getData("text/plain")) ||
      draggingLayer;
    if (!sourceLayer) {
      setDraggingLayer(null);
      setLayerDropTarget(null);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    ctx.moveLayer(
      sourceLayer.groupId,
      sourceLayer.layerId,
      targetGroupId,
      targetLayerId,
      placement,
    );
    setDraggingLayer(null);
    setLayerDropTarget(null);
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
      <div className="layer-save-actions">
        <Button
          size="small"
          icon={<SaveOutlined style={{ fontSize: 14 }} />}
          disabled={groups.length === 0}
          onClick={() => openSaveWorkspace("project")}
        >
          保存为工程
        </Button>
        <Button
          size="small"
          icon={<SaveOutlined style={{ fontSize: 14 }} />}
          disabled={groups.length === 0}
          onClick={() => openSaveWorkspace("topic")}
        >
          保存为专题
        </Button>
      </div>
      <Input
        prefix={<SearchOutlined style={{ fontSize: 15 }} />}
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
                  onLocate={ctx.locateGroup}
                  onRemove={ctx.removeGroup}
                  onSelect={() => {
                    const firstLayer = group.children[0];
                    if (firstLayer) {
                      ctx.selectLayer(group.id, firstLayer.id);
                    }
                  }}
                  exportItems={exportItemsForGroup(group)}
                />
                {expanded && (
                  <fieldset
                    className={
                      layerDropTarget?.groupId === group.id &&
                      layerDropTarget.layerId === null
                        ? "layer-children layer-children-drop-inside"
                        : "layer-children"
                    }
                    onDragOver={(event) =>
                      handleLayerDragOverGroup(event, group.id)
                    }
                    onDrop={(event) =>
                      handleLayerDrop(event, group.id, null, "inside")
                    }
                  >
                    {group.children.map((layer) => (
                      <LayerItemNode
                        key={layer.id}
                        groupId={group.id}
                        layer={layer}
                        dragging={
                          draggingLayer?.groupId === group.id &&
                          draggingLayer.layerId === layer.id
                        }
                        dropPlacement={
                          layerDropTarget?.groupId === group.id &&
                          layerDropTarget.layerId === layer.id
                            ? layerDropTarget.placement
                            : null
                        }
                        onDragStart={(event) =>
                          handleLayerDragStart(event, group.id, layer.id)
                        }
                        onDragEnd={() => {
                          setDraggingLayer(null);
                          setLayerDropTarget(null);
                        }}
                        onDragOver={(event) =>
                          handleLayerDragOverLayer(event, group.id, layer.id)
                        }
                        onDrop={(event) =>
                          handleLayerDrop(
                            event,
                            group.id,
                            layer.id,
                            layerDropTarget?.placement ?? "after",
                          )
                        }
                        onVisibilityChange={ctx.setLayerVisibility}
                        onNameChange={ctx.setLayerName}
                        onSymbolizationChange={handleLayerSymbolizationChange}
                        onLocate={ctx.locateLayer}
                        onRemove={ctx.removeLayer}
                        onSelect={() => ctx.selectLayer(group.id, layer.id)}
                        selected={ctx.selectedLayerId === layer.id}
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
      <Modal
        title={saveKind === "project" ? "保存为工程" : "保存为专题"}
        open={saveOpen}
        okText="保存"
        confirmLoading={savingWorkspace}
        onOk={submitSaveWorkspace}
        onCancel={() => setSaveOpen(false)}
        destroyOnHidden
      >
        <Form form={saveForm} layout="vertical">
          <Form.Item label="保存方式">
            <Segmented
              block
              value={saveMode}
              options={[
                { label: "新建", value: "create" },
                {
                  label: `覆盖已有${saveKind === "project" ? "工程" : "专题"}`,
                  value: "update",
                  disabled: saveTargetScenes.length === 0,
                },
              ]}
              onChange={(value) => {
                const nextMode = value as "create" | "update";
                setSaveMode(nextMode);
                if (nextMode === "create") {
                  saveForm.setFieldsValue({
                    targetId: undefined,
                    name: "",
                    description: "",
                  });
                  return;
                }
                const firstScene = saveTargetScenes[0];
                saveForm.setFieldsValue({
                  targetId: firstScene?.id,
                  name: firstScene?.name ?? "",
                  description: firstScene?.description ?? "",
                });
              }}
            />
          </Form.Item>
          {saveMode === "update" ? (
            <>
              <Form.Item
                name="targetId"
                label={saveKind === "project" ? "选择工程" : "选择专题"}
                rules={[{ required: true, message: "请选择保存目标" }]}
              >
                <Select
                  placeholder={`请选择要覆盖的${saveKind === "project" ? "工程" : "专题"}`}
                  options={saveTargetScenes.map((scene) => ({
                    value: scene.id,
                    label: scene.name,
                  }))}
                  onChange={(targetId) => {
                    const scene = saveTargetScenes.find(
                      (item) => item.id === targetId,
                    );
                    saveForm.setFieldsValue({
                      name: scene?.name ?? "",
                      description: scene?.description ?? "",
                    });
                  }}
                />
              </Form.Item>
              {selectedSaveTarget ? (
                <Alert
                  type="warning"
                  showIcon
                  message={`将覆盖“${selectedSaveTarget.name}”`}
                  description="当前图层树、视图状态和符号化配置会替换该保存项的快照，名称和说明保持不变。"
                />
              ) : null}
            </>
          ) : (
            <>
              <Form.Item
                name="name"
                label={saveKind === "project" ? "工程名称" : "专题名称"}
                rules={[{ required: true, message: "请输入名称" }]}
              >
                <Input maxLength={80} />
              </Form.Item>
              <Form.Item name="description" label="说明">
                <Input.TextArea rows={3} maxLength={300} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </section>
  );
}

interface SaveWorkspaceFormValues {
  targetId?: number;
  name: string;
  description?: string;
}

interface GroupNodeProps {
  group: LoadedLayerGroup;
  expanded: boolean;
  onToggleExpand: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onVisibilityChange: (groupId: string, visible: boolean) => void;
  onNameChange: (groupId: string, name: string) => void;
  onLocate: (groupId: string) => void;
  onRemove: (groupId: string) => void;
  onSelect: () => void;
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
  onLocate,
  onRemove,
  onSelect,
  exportItems,
}: GroupNodeProps) {
  const ctx = useLayerContext();
  return (
    <div className="layer-tree-node layer-tree-node-group">
      <div className="layer-row-main">
        <div className="layer-heading">
          <Tooltip title={expanded ? "折叠" : "展开"}>
            <Button
              className="layer-icon-button"
              type="text"
              size="small"
              aria-label={expanded ? `折叠${group.name}` : `展开${group.name}`}
              icon={
                expanded ? (
                  <DownOutlined style={{ fontSize: 14 }} />
                ) : (
                  <RightOutlined style={{ fontSize: 14 }} />
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
            checkedChildren={<EyeOutlined style={{ fontSize: 10 }} />}
            unCheckedChildren={
              <EyeInvisibleOutlined style={{ fontSize: 10 }} />
            }
            onChange={(checked) => onVisibilityChange(group.id, checked)}
          />
          <FolderOpenOutlined style={{ fontSize: 14 }} />
        </div>
        <div className="layer-row-tools">
          <NodeActions
            symbolization={group.symbolization}
            fields={[]}
            subjectName={group.name}
            onSymbolizationChange={() => undefined}
            onLocate={() => onLocate(group.id)}
            onRemove={() => onRemove(group.id)}
            exportItems={exportItems}
            canUseCustomSymbolization={false}
            canExportData={ctx.canExportData}
          />
          <Tooltip title="排序">
            <Button
              className="layer-drag-handle action-btn"
              type="text"
              size="small"
              aria-label={`拖动${group.name}排序`}
              draggable
              icon={<HolderOutlined style={{ fontSize: 14 }} />}
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
        <Button size="small" type="link" onClick={onSelect}>
          选中
        </Button>
      </div>
    </div>
  );
}

interface LayerNodeProps {
  groupId: string;
  layer: LoadedLayer;
  dragging: boolean;
  dropPlacement: LayerDropPlacement | null;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
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
  onSelect: () => void;
  selected: boolean;
  exportItems: ExportLayerItem[];
}

function LayerItemNode({
  groupId,
  layer,
  dragging,
  dropPlacement,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onVisibilityChange,
  onNameChange,
  onSymbolizationChange,
  onLocate,
  onRemove,
  onSelect,
  selected,
  exportItems,
}: LayerNodeProps) {
  const ctx = useLayerContext();
  const dropClass = dropPlacement ? ` layer-drop-${dropPlacement}` : "";
  return (
    <div
      className={`layer-tree-node${selected ? " layer-tree-node-selected" : ""}${dragging ? " is-dragging" : ""}${dropClass}`}
      role="treeitem"
      tabIndex={0}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="layer-row-main">
        <div className="layer-heading">
          <Switch
            className="visibility-switch"
            checked={layer.visible}
            size="small"
            checkedChildren={<EyeOutlined style={{ fontSize: 10 }} />}
            unCheckedChildren={
              <EyeInvisibleOutlined style={{ fontSize: 10 }} />
            }
            onChange={(checked) =>
              onVisibilityChange(groupId, layer.id, checked)
            }
          />
          <FileOutlined style={{ fontSize: 14 }} />
        </div>
        <div className="layer-row-tools">
          <NodeActions
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
            onOpenTable={() => ctx.openLayerTable(groupId, layer.id)}
          />
          <Tooltip title="拖动排序">
            <Button
              className="layer-drag-handle action-btn"
              type="text"
              size="small"
              aria-label={`拖动${layer.name}排序`}
              draggable
              icon={<HolderOutlined style={{ fontSize: 14 }} />}
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
              onNameChange(groupId, layer.id, next.trim() || layer.name),
          }}
        >
          {layer.name}
        </Typography.Text>
        <Button
          size="small"
          type={selected ? "primary" : "link"}
          onClick={onSelect}
        >
          {selected ? "已选" : "选中"}
        </Button>
      </div>
    </div>
  );
}

function groupIdFromDrag(value: string): string | null {
  const match = value.match(/^group:(.+)$/);
  return match?.[1] ?? null;
}

function layerPayloadFromDrag(
  value: string,
): { groupId: string; layerId: string } | null {
  const match = value.match(/^layer:([^:]+):(.+)$/);
  if (!match?.[1] || !match[2]) return null;
  return { groupId: match[1], layerId: match[2] };
}

interface NodeActionProps {
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
  onOpenTable?: () => void;
  exportItems: ExportLayerItem[];
  canUseCustomSymbolization: boolean;
  canExportData: boolean;
}

function NodeActions({
  symbolization,
  fields,
  rasterBands = [],
  rasterDatasetId,
  subjectName,
  onSymbolizationChange,
  onLocate,
  onRemove,
  onOpenTable,
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
      message.warning("请先在底部图形绘制中设置空间范围");
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
    return null;
  }

  return (
    <div
      className="icon-cluster"
      role="toolbar"
      aria-label={`${subjectName}图层操作`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {onOpenTable && (
        <Tooltip title="数据表">
          <Button
            className="action-btn"
            type="text"
            size="small"
            aria-label={`${subjectName}数据表`}
            icon={<TableOutlined style={{ fontSize: 14 }} />}
            onClick={onOpenTable}
          />
        </Tooltip>
      )}
      <Tooltip title="定位">
        <Button
          className="action-btn"
          type="text"
          size="small"
          aria-label={`定位${subjectName}`}
          icon={<AimOutlined style={{ fontSize: 14 }} />}
          onClick={onLocate}
        />
      </Tooltip>
      {canExportData && (
        <Popover
          trigger="click"
          placement="leftTop"
          classNames={{ root: "symbolization-popover" }}
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
              onClipChange={setExportClip}
              onClearClip={ctx.clearExportClipGeometry}
              onExport={confirmExport}
            />
          }
        >
          <Tooltip title="导出">
            <Button
              className="action-btn"
              type="text"
              size="small"
              aria-label={`导出${subjectName}`}
              icon={<DownloadOutlined style={{ fontSize: 14 }} />}
            />
          </Tooltip>
        </Popover>
      )}
      {canUseCustomSymbolization && (
        <Popover
          trigger="click"
          placement="leftTop"
          classNames={{ root: "symbolization-popover" }}
          open={symbolizationOpen}
          onOpenChange={handleSymbolizationOpenChange}
          content={
            <Suspense fallback={<Spin size="small" />}>
              {renderSymbolizationEditor()}
            </Suspense>
          }
        >
          <Tooltip title="符号化">
            <Button
              className="action-btn"
              type="text"
              size="small"
              aria-label={`${subjectName}符号化`}
              icon={<BgColorsOutlined style={{ fontSize: 14 }} />}
            />
          </Tooltip>
        </Popover>
      )}
      <Tooltip title="移除">
        <Button
          className="action-btn"
          type="text"
          size="small"
          aria-label={`移除${subjectName}`}
          icon={<DeleteOutlined style={{ fontSize: 14 }} />}
          onClick={onRemove}
        />
      </Tooltip>
    </div>
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
        resourceId: resourceExportId(layer.sourceResource),
        geojson: layer.geojson,
        sourceCrs: layer.sourceResource.coordinateSystem,
      },
    ];
  }
  return [
    {
      layerType: "raster",
      name: layer.name,
      resourceId: resourceExportId(layer.sourceResource),
      datasetId: layer.rasterDatasetId,
      sourceCrs:
        layer.rasterMetadata?.coordinateSystem ??
        layer.sourceResource.coordinateSystem,
    },
  ];
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
  onClearClip: () => void;
  onExport: () => void;
}) {
  const latestMessage =
    messages.length > 0 ? messages[messages.length - 1] : "";
  return (
    <Card className="symbolization-card export-card" size="small" title={title}>
      <Space orientation="vertical" className="full-width symbolization-stack">
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
          <Space orientation="vertical" className="full-width compact-stack">
            <div className="export-clip-actions">
              <Typography.Text type={clipReady ? "success" : "secondary"}>
                {clipReady
                  ? "已设置空间范围"
                  : "请在底部图形绘制中设置空间范围"}
              </Typography.Text>
              <Button size="small" onClick={onClearClip} disabled={!clipReady}>
                清除
              </Button>
            </div>
          </Space>
        )}
        {running && (
          <Space orientation="vertical" className="full-width compact-stack">
            <Progress percent={progress} size="small" />
            {latestMessage && (
              <Alert type="info" showIcon title={latestMessage} />
            )}
          </Space>
        )}
        <Button
          type="primary"
          icon={<DownloadOutlined style={{ fontSize: 15 }} />}
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
