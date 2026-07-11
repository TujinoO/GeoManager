import {
  AimOutlined,
  BgColorsOutlined,
  DeleteOutlined,
  DownloadOutlined,
  DownOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FolderOpenOutlined,
  HolderOutlined,
  PlusOutlined,
  RightOutlined,
  SaveOutlined,
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
  type ReactNode,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "../api/client";
import {
  type DropPlacement,
  type ExportFormat,
  type LayerDropPlacement,
  useLayerContext,
} from "../hooks/LayerContext";
import {
  isGraduatedRenderer,
  isUniqueValueRenderer,
  type GroupSymbolization,
  type RasterSymbolization,
  type VectorSymbolization,
} from "../symbolization";
import {
  classValuesLabel,
  graduatedRangeLabel,
} from "../symbolizationTemplates";
import type {
  ExportLayerItem,
  LoadedLayer,
  LoadedLayerGroup,
  RasterBandMetadata,
  ResourceField,
  ResourceListItem,
  ResourceVisualizationSummary,
  WorkspaceSceneKind,
} from "../types";
import { createEmptyLayerGroup } from "../utils/layerFactory";
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
  const layerTreeLabel = groups.some((group) => group.isManual)
    ? "已加载图层与图层组"
    : "已加载图层";

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
    const sourceLayer =
      draggingLayer ??
      layerPayloadFromDrag(event.dataTransfer.getData("text/plain"));
    if (sourceLayer) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const rect = event.currentTarget.getBoundingClientRect();
      const placement =
        event.clientY < rect.top + rect.height / 2 ? "before" : "after";
      setLayerDropTargetIfChanged({
        groupId: targetGroupId,
        layerId: null,
        placement,
      });
      return;
    }

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
    const sourceLayer =
      layerPayloadFromDrag(event.dataTransfer.getData("text/plain")) ||
      draggingLayer;
    if (sourceLayer) {
      event.preventDefault();
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      const placement =
        event.clientY < rect.top + rect.height / 2 ? "before" : "after";
      ctx.extractLayer(
        sourceLayer.groupId,
        sourceLayer.layerId,
        targetGroupId,
        placement,
      );
      setDraggingLayer(null);
      setLayerDropTarget(null);
      return;
    }

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
    event.stopPropagation();
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

  function createManualLayerGroup() {
    const group = createEmptyLayerGroup(`图层组 ${groups.length + 1}`);
    ctx.addGroup(group);
    message.success("已新建图层组");
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
        <Button
          size="small"
          icon={<PlusOutlined style={{ fontSize: 14 }} />}
          onClick={createManualLayerGroup}
        >
          新建图层组
        </Button>
      </div>
      {groups.length > 0 ? (
        <div className="layer-tree" role="tree" aria-label={layerTreeLabel}>
          {groups.map((group) => {
            const standaloneLayer = standaloneLayerForGroup(group);
            const expanded = !collapsedGroupIds.has(group.id);
            const dropClass =
              dragTarget?.groupId === group.id
                ? ` layer-group-drop-${dragTarget.placement}`
                : layerDropTarget?.groupId === group.id &&
                    layerDropTarget.layerId === null &&
                    layerDropTarget.placement !== "inside"
                  ? ` layer-group-drop-${layerDropTarget.placement}`
                  : "";
            if (standaloneLayer) {
              return (
                <div
                  key={group.id}
                  className="layer-group-shell layer-standalone-shell"
                >
                  <LayerItemNode
                    groupId={group.id}
                    layer={standaloneLayer}
                    dragging={
                      draggingLayer?.groupId === group.id &&
                      draggingLayer.layerId === standaloneLayer.id
                    }
                    dropPlacement={
                      layerDropTarget?.groupId === group.id &&
                      layerDropTarget.layerId === standaloneLayer.id
                        ? layerDropTarget.placement
                        : null
                    }
                    onDragStart={(event) =>
                      handleLayerDragStart(event, group.id, standaloneLayer.id)
                    }
                    onDragEnd={() => {
                      setDraggingLayer(null);
                      setLayerDropTarget(null);
                    }}
                    onDragOver={(event) =>
                      handleLayerDragOverLayer(
                        event,
                        group.id,
                        standaloneLayer.id,
                      )
                    }
                    onDrop={(event) =>
                      handleLayerDrop(
                        event,
                        group.id,
                        standaloneLayer.id,
                        layerDropTarget?.placement ?? "after",
                      )
                    }
                    onVisibilityChange={ctx.setLayerVisibility}
                    onNameChange={ctx.setLayerName}
                    onSymbolizationChange={handleLayerSymbolizationChange}
                    onLocate={ctx.locateLayer}
                    onRemove={ctx.removeLayer}
                    onSelect={() =>
                      ctx.selectLayer(group.id, standaloneLayer.id)
                    }
                    selected={ctx.selectedLayerId === standaloneLayer.id}
                    exportItems={exportItemsForLayer(standaloneLayer)}
                  />
                </div>
              );
            }
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
                      layerDropTarget.layerId === null &&
                      layerDropTarget.placement === "inside"
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
                    {group.children.length === 0 ? (
                      <div className="layer-children-empty">拖动图层到此组</div>
                    ) : null}
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
                  className="workspace-save-overwrite-alert"
                  type="warning"
                  showIcon
                  title={`将覆盖“${selectedSaveTarget.name}”`}
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

function LayerTooltip({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <Tooltip
      title={title}
      color="rgba(6, 24, 32, 0.96)"
      rootClassName="layer-action-tooltip"
    >
      {children}
    </Tooltip>
  );
}

interface SaveWorkspaceFormValues {
  targetId?: number;
  name: string;
  description?: string;
}

function standaloneLayerForGroup(group: LoadedLayerGroup): LoadedLayer | null {
  if (group.isManual || group.children.length !== 1) {
    return null;
  }
  return group.children[0] ?? null;
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
          <LayerTooltip title={expanded ? "折叠" : "展开"}>
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
          </LayerTooltip>
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
          <LayerTooltip title="排序">
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
          </LayerTooltip>
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
  const fieldValueCounts = useMemo(
    () => buildFieldValueCounts(layer),
    [layer],
  );
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
          <LayerTooltip
            title={
              ctx.isLayerExtentVisible(layer.id)
                ? "隐藏图层范围"
                : "显示图层范围"
            }
          >
            <Switch
              className="layer-extent-switch"
              checked={ctx.isLayerExtentVisible(layer.id)}
              size="small"
              checkedChildren={<AimOutlined style={{ fontSize: 10 }} />}
              unCheckedChildren={<AimOutlined style={{ fontSize: 10 }} />}
              aria-label={`${ctx.isLayerExtentVisible(layer.id) ? "隐藏" : "显示"}${layer.name}范围`}
              onChange={(checked) =>
                ctx.setLayerExtentVisibility(layer.id, checked)
              }
            />
          </LayerTooltip>
        </div>
        <div className="layer-row-tools">
          <NodeActions
            symbolization={layer.symbolization}
            fields={layer.fields}
            fieldValueCounts={fieldValueCounts}
            geometryType={layer.geometryType}
            sourceResource={
              layer.layerType === "vector" ? layer.sourceResource : undefined
            }
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
          <LayerTooltip title="拖动排序">
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
          </LayerTooltip>
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
      <LayerLegend layer={layer} />
    </div>
  );
}

function LayerLegend({ layer }: { layer: LoadedLayer }) {
  if (layer.layerType !== "vector") return null;
  const renderer = layer.symbolization.renderer;
  const visibleClasses = isUniqueValueRenderer(renderer)
    ? [...renderer.classes, renderer.defaultClass]
        .filter((item) => item.visible)
        .map((item) => ({
          id: item.id,
          label: item.label,
          color: item.color,
          count: item.count,
          title: `${item.label}：${classValuesLabel(item)}`,
        }))
    : isGraduatedRenderer(renderer)
      ? [...renderer.classes, renderer.defaultClass]
          .filter((item) => item.visible)
          .map((item) => ({
            id: item.id,
            label: item.label,
            color: item.color,
            count: item.count,
            title: `${item.label}：${graduatedRangeLabel(item)}`,
          }))
      : [];
  if (visibleClasses.length === 0) return null;
  return (
    <div className="layer-legend-strip" aria-label={`${layer.name}图例`}>
      {visibleClasses.slice(0, 6).map((item) => (
        <span className="layer-legend-item" key={item.id}>
          <i style={{ backgroundColor: item.color }} />
          <span title={item.title}>{item.label}</span>
          <small>{item.count}</small>
        </span>
      ))}
      {visibleClasses.length > 6 && (
        <span className="layer-legend-more">
          +{visibleClasses.length - 6}
        </span>
      )}
    </div>
  );
}

function buildFieldValueCounts(layer: LoadedLayer) {
  if (layer.layerType !== "vector") return {};
  const result: Record<string, Record<string, number>> = {};
  for (const field of layer.fields) {
    const counts: Record<string, number> = {};
    for (const feature of layer.geojson.features) {
      const properties = feature.properties ?? {};
      const value = (properties as Record<string, unknown>)[field.name];
      if (value === null || value === undefined) continue;
      const key = String(value).trim();
      if (!key) continue;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    result[field.name] = counts;
  }
  return result;
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
  fieldValueCounts?: Record<string, Record<string, number>>;
  geometryType?: string;
  sourceResource?: ResourceListItem;
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
  fieldValueCounts,
  geometryType,
  sourceResource,
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
  const committedSymbolizationRef = useRef(symbolization);
  const [exportReproject, setExportReproject] = useState(false);
  const [exportClip, setExportClip] = useState(false);
  const [exportEpsg, setExportEpsg] = useState<number | null>(
    defaultExportEpsg(exportItems),
  );
  const [exportFormat, setExportFormat] = useState<ExportFormat>("geojson");
  const [exportRunning, setExportRunning] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessages, setExportMessages] = useState<string[]>([]);
  const [recommendedSymbolizations, setRecommendedSymbolizations] = useState<
    ResourceVisualizationSummary["recommendedSymbolizations"]
  >([]);
  const [
    recommendedSymbolizationsLoading,
    setRecommendedSymbolizationsLoading,
  ] = useState(false);
  const [recommendedSymbolizationsError, setRecommendedSymbolizationsError] =
    useState<string | null>(null);
  const recommendedRequestRef = useRef(0);
  const isDeferredSymbolization =
    isVectorSymbolization(symbolization) ||
    isRasterSymbolization(symbolization);
  const canPreviewRecommendedSymbolizations =
    isVectorSymbolization(symbolization) && Boolean(sourceResource);
  const canOpenSymbolization =
    canUseCustomSymbolization || canPreviewRecommendedSymbolizations;

  useEffect(() => {
    if (!symbolizationOpen) {
      setDraftSymbolization(symbolization);
    }
  }, [symbolization, symbolizationOpen]);

  function openSymbolizationModal() {
    if (!canOpenSymbolization) return;
    committedSymbolizationRef.current = symbolization;
    setDraftSymbolization(symbolization);
    setSymbolizationOpen(true);
    if (isVectorSymbolization(symbolization) && sourceResource) {
      void loadRecommendedSymbolizations(sourceResource);
    } else {
      setRecommendedSymbolizations([]);
      setRecommendedSymbolizationsError(null);
      setRecommendedSymbolizationsLoading(false);
    }
  }

  async function loadRecommendedSymbolizations(resource: ResourceListItem) {
    const requestId = recommendedRequestRef.current + 1;
    recommendedRequestRef.current = requestId;
    setRecommendedSymbolizationsLoading(true);
    setRecommendedSymbolizationsError(null);
    try {
      const summary = await api.resourceVisualizationSummary(resource);
      if (recommendedRequestRef.current !== requestId) return;
      setRecommendedSymbolizations(summary.recommendedSymbolizations ?? []);
    } catch (error) {
      if (recommendedRequestRef.current !== requestId) return;
      setRecommendedSymbolizations([]);
      setRecommendedSymbolizationsError(
        error instanceof Error ? error.message : "无法获取推荐符号化方案",
      );
    } finally {
      if (recommendedRequestRef.current === requestId) {
        setRecommendedSymbolizationsLoading(false);
      }
    }
  }

  function closeSymbolizationModal() {
    const committedSymbolization = committedSymbolizationRef.current;
    if (
      isVectorSymbolization(committedSymbolization) &&
      isVectorSymbolization(draftSymbolization)
    ) {
      onSymbolizationChange(committedSymbolization);
      setDraftSymbolization(committedSymbolization);
    }
    setSymbolizationOpen(false);
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
          format: exportFormat,
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
    committedSymbolizationRef.current = draftSymbolization;
    onSymbolizationChange(draftSymbolization);
    setSymbolizationOpen(false);
  }

  function previewVectorSymbolization(next: VectorSymbolization) {
    if (!canUseCustomSymbolization) return;
    setDraftSymbolization(next);
    onSymbolizationChange(next);
  }

  function renderSymbolizationEditor() {
    if (isVectorSymbolization(draftSymbolization) && isDeferredSymbolization) {
      return (
        <VectorSymbolizationEditor
          value={draftSymbolization}
          fields={fields}
          fieldValueCounts={fieldValueCounts}
          geometryType={geometryType}
          recommendedSymbolizations={recommendedSymbolizations}
          recommendedSymbolizationsLoading={recommendedSymbolizationsLoading}
          recommendedSymbolizationsError={recommendedSymbolizationsError}
          readOnly={!canUseCustomSymbolization}
          canApplyRecommendedSymbolizations={canUseCustomSymbolization}
          onChange={
            canUseCustomSymbolization ? previewVectorSymbolization : () => {}
          }
          onApply={
            canUseCustomSymbolization ? applyDraftSymbolization : undefined
          }
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
    <>
      <div
        className="icon-cluster"
        role="toolbar"
        aria-label={`${subjectName}图层操作`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {onOpenTable && (
          <LayerTooltip title="数据表">
            <Button
              className="action-btn"
              type="text"
              size="small"
              aria-label={`${subjectName}数据表`}
              icon={<TableOutlined style={{ fontSize: 14 }} />}
              onClick={onOpenTable}
            />
          </LayerTooltip>
        )}
        <LayerTooltip title="定位">
          <Button
            className="action-btn"
            type="text"
            size="small"
            aria-label={`定位${subjectName}`}
            icon={<AimOutlined style={{ fontSize: 14 }} />}
            onClick={onLocate}
          />
        </LayerTooltip>
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
                format={exportFormat}
                reproject={exportReproject}
                clip={exportClip}
                clipReady={Boolean(ctx.exportClipGeometry)}
                running={exportRunning}
                progress={exportProgress}
                messages={exportMessages}
                onEpsgChange={setExportEpsg}
                onFormatChange={setExportFormat}
                onReprojectChange={setExportReproject}
                onClipChange={setExportClip}
                onClearClip={ctx.clearExportClipGeometry}
                onExport={confirmExport}
              />
            }
          >
            <LayerTooltip title="导出">
              <Button
                className="action-btn"
                type="text"
                size="small"
                aria-label={`导出${subjectName}`}
                icon={<DownloadOutlined style={{ fontSize: 14 }} />}
              />
            </LayerTooltip>
          </Popover>
        )}
        {canOpenSymbolization && (
          <LayerTooltip
            title={
              canUseCustomSymbolization ? "符号化" : "推荐符号化预览"
            }
          >
            <Button
              className={`action-btn symbolization-action-btn${
                symbolizationOpen ? " is-active" : ""
              }`}
              type="text"
              size="small"
              aria-label={
                canUseCustomSymbolization
                  ? `${subjectName}符号化`
                  : `${subjectName}推荐符号化预览`
              }
              aria-expanded={symbolizationOpen}
              aria-haspopup="dialog"
              icon={<BgColorsOutlined style={{ fontSize: 14 }} />}
              onClick={openSymbolizationModal}
            />
          </LayerTooltip>
        )}
        <LayerTooltip title="移除">
          <Button
            className="action-btn"
            type="text"
            size="small"
            aria-label={`移除${subjectName}`}
            icon={<DeleteOutlined style={{ fontSize: 14 }} />}
            onClick={onRemove}
          />
        </LayerTooltip>
      </div>
      {canOpenSymbolization && (
        <Modal
          title={
            canUseCustomSymbolization
              ? `${subjectName}符号化`
              : `${subjectName}推荐符号化预览`
          }
          open={symbolizationOpen}
          footer={null}
          width="min(760px, calc(100vw - 32px))"
          wrapClassName="layer-symbolization-modal"
          onCancel={closeSymbolizationModal}
          destroyOnHidden
        >
          <Suspense fallback={<Spin />}>{renderSymbolizationEditor()}</Suspense>
        </Modal>
      )}
    </>
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
  format,
  reproject,
  clip,
  clipReady,
  running,
  progress,
  messages,
  onEpsgChange,
  onFormatChange,
  onReprojectChange,
  onClipChange,
  onClearClip,
  onExport,
}: {
  title: string;
  epsg: number | null;
  format: ExportFormat;
  reproject: boolean;
  clip: boolean;
  clipReady: boolean;
  running: boolean;
  progress: number;
  messages: string[];
  onEpsgChange: (value: number | null) => void;
  onFormatChange: (value: ExportFormat) => void;
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
          <Typography.Text strong>矢量格式</Typography.Text>
          <Segmented<ExportFormat>
            size="small"
            value={format}
            options={[
              { label: "GeoJSON", value: "geojson" },
              { label: "Shapefile", value: "shapefile" },
            ]}
            onChange={onFormatChange}
          />
        </div>
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
