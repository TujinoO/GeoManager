import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
  App as AntApp,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Space,
  Select,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";
import type {
  AdminDataResource,
  AdminDataResourceFilters,
  AdminDataResourceGroup,
  AdminDataResourceList,
} from "../types";
import { downloadBlob } from "../utils/download";
import DataSchemaOverview from "./DataSchemaOverview";
import { fallbackTaxonomyTree, flattenTaxonomy } from "../utils/taxonomy";
import ManagedCollectionPage, {
  type AccessScopeId,
  type FilterField,
  type ManagedCollectionTableRenderArgs,
  type ManagedFormValues,
  realAccessGroupIds,
  withFixedAccessScopes,
} from "./ManagedCollectionPage";

type VisualizationFormValues = ManagedFormValues & {
  categoryCode: string;
  layerName: string;
  defaultVisible: boolean;
  pointColor?: string;
  symbolizationJson?: string;
  rasterRulesJson?: string;
};

const dataTypeLabels: Record<AdminDataResource["dataType"], string> = {
  vector: "矢量",
  raster: "栅格",
  gene: "基因",
  table: "表格",
  document: "文档",
  image: "图片",
};

const statusLabels = {
  active: { text: "启用", color: "green" },
  inactive: { text: "禁用", color: "default" },
} as const;

const initialList: AdminDataResourceList = {
  items: [],
  total: 0,
  summary: {
    total: 0,
    activeCount: 0,
    inactiveCount: 0,
    restrictedCount: 0,
    sizeBytes: 0,
    itemCount: 0,
  },
  groupSummaries: [],
  availableAccessGroups: [],
  inventoryGroups: [],
};

const allInventoryGroupId = "__all__";
const unclassifiedInventoryGroupId = "__unclassified__";

type CategoryInventoryGroupId = `__category__:${string}`;
type InventoryGroupId =
  | number
  | typeof allInventoryGroupId
  | typeof unclassifiedInventoryGroupId
  | CategoryInventoryGroupId;
type InventoryGroupKind =
  | "all"
  | "category-root"
  | "category-leaf"
  | "unclassified"
  | "custom";
type InventoryGroupSummary = AdminDataResourceList["groupSummaries"][number];
type GroupModalState = { kind: "create" } | null;

interface InventoryGroup {
  id: InventoryGroupId;
  name: string;
  resources: AdminDataResource[];
  resourceCount: number;
  sizeBytes: number;
  itemCount: number;
  enabled: boolean;
  partiallyEnabled: boolean;
  kind: InventoryGroupKind;
  subgroups: InventoryGroup[];
}

interface InventoryGroupDefinition {
  id: InventoryGroupId;
  name: string;
  kind: InventoryGroupKind;
  categoryCode?: string;
  children?: InventoryGroupDefinition[];
}

const allInventoryGroup: InventoryGroupDefinition = {
  id: allInventoryGroupId,
  name: "全部数据",
  kind: "all",
};

const categoryInventoryGroups: InventoryGroupDefinition[] =
  fallbackTaxonomyTree.map((root) => ({
    id: `__category__:${root.categoryCode}` as CategoryInventoryGroupId,
    name: root.name,
    kind: "category-root",
    categoryCode: root.categoryCode,
    children: root.children.map((child) => ({
      id: `__category__:${child.categoryCode}` as CategoryInventoryGroupId,
      name: child.name,
      kind: "category-leaf",
      categoryCode: child.categoryCode,
    })),
  }));

const unclassifiedInventoryGroup: InventoryGroupDefinition = {
  id: unclassifiedInventoryGroupId,
  name: "未分组（其他）",
  kind: "unclassified",
};

const inventoryGroupNameColumnWidth = 220;
const inventoryResourceNameColumnWidth = 260;
const inventoryActionColumnWidth = 112;
const inventoryTableScrollX = 1280;
const inventoryResourceColumnWidths: Record<string, number> = {
  name: inventoryResourceNameColumnWidth,
  dataType: 92,
  dataSize: 150,
  status: 112,
  source: 190,
  uploader: 150,
  dataDate: 120,
  updatedAt: 190,
  actions: inventoryActionColumnWidth,
};
const inventoryEllipsisColumnKeys = new Set([
  "name",
  "source",
  "uploader",
  "dataDate",
  "updatedAt",
]);

const filterFields: FilterField[] = [
  {
    name: "categoryCode",
    label: "权威业务分类",
    kind: "select",
    options: flattenTaxonomy(fallbackTaxonomyTree).map((node) => ({
      value: node.categoryCode,
      label: node.path.join(" / "),
    })),
  },
  {
    name: "classificationStatus",
    label: "归类状态",
    kind: "select",
    options: [
      { value: "classified", label: "已分类" },
      { value: "pending", label: "待归类" },
    ],
  },
  {
    name: "dataType",
    label: "数据类型",
    kind: "select",
    options: Object.entries(dataTypeLabels).map(([value, label]) => ({
      value,
      label,
    })),
  },
  {
    name: "status",
    label: "状态",
    kind: "select",
    options: [
      { value: "active", label: "启用" },
      { value: "inactive", label: "禁用" },
    ],
  },
  { name: "source", label: "数据来源", kind: "input" },
  { name: "provider", label: "提供单位", kind: "input" },
  { name: "dateFrom", label: "起始日期", kind: "date" },
  { name: "dateTo", label: "截止日期", kind: "date" },
];

export default function AdminDataInventoryPage() {
  const { message } = AntApp.useApp();
  const { user } = useAppContext();
  const [filters, setFilters] = useState<AdminDataResourceFilters>({
    current: 1,
    pageSize: 50,
  });
  const [data, setData] = useState<AdminDataResourceList>(initialList);
  const [loading, setLoading] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupModal, setGroupModal] = useState<GroupModalState>(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<InventoryGroupId | null>(
    null,
  );
  const [editingGroupName, setEditingGroupName] = useState("");
  const [savingGroupId, setSavingGroupId] = useState<InventoryGroupId | null>(
    null,
  );
  const [draggingResourceId, setDraggingResourceId] = useState<number | null>(
    null,
  );
  const [movingResourceId, setMovingResourceId] = useState<number | null>(null);
  const [updatingGroupId, setUpdatingGroupId] =
    useState<InventoryGroupId | null>(null);

  const canView = Boolean(user?.permissions.canViewDataResources);
  const canChange = Boolean(user?.permissions.canChangeDataResources);
  const canDelete = Boolean(user?.permissions.canDeleteDataResources);
  const canUpload = Boolean(user?.permissions.canUploadData);
  const canExport = Boolean(user?.permissions.canExportData);
  const canBrowseData = Boolean(user?.permissions.canBrowseData);
  const canOpenInventory =
    canView || canChange || canDelete || canUpload || canExport;

  const inventoryGroups = useMemo(
    () =>
      buildInventoryGroups(
        data.items,
        data.inventoryGroups ?? [],
        data.groupSummaries,
      ),
    [data.groupSummaries, data.inventoryGroups, data.items],
  );

  const loadResources = useCallback(
    async (nextFilters: AdminDataResourceFilters) => {
      setLoading(true);
      try {
        const result = await api.adminDataResources(nextFilters);
        setData(result);
      } catch (error) {
        message.error(
          error instanceof Error ? error.message : "存量数据加载失败",
        );
      } finally {
        setLoading(false);
      }
    },
    [message],
  );

  useEffect(() => {
    if (canOpenInventory) {
      void loadResources(filters);
    }
  }, [canOpenInventory, filters, loadResources]);

  if (!canOpenInventory) {
    return <Navigate to="/admin/profile" replace />;
  }

  async function saveResourceSettings(
    resource: AdminDataResource,
    values: ManagedFormValues,
  ) {
    try {
      if (!canChange) {
        if (!resource.canManageAccess) {
          message.warning("当前用户不能修改该数据的可见范围");
          return;
        }
        const updated = await api.updateAdminDataResource(resource.id, {
          action: "updateAccess",
          accessGroupIds: realAccessGroupIds(values.accessGroupIds),
        });
        if ("id" in updated) {
          replaceResource(updated);
          void loadResources(filters);
          message.success("数据可见范围已保存");
          return updated;
        }
        return;
      }
      const formValues = values as VisualizationFormValues;
      const symbolization = parseJsonObject(
        formValues.symbolizationJson,
        "矢量符号",
      );
      if (resource.dataType === "vector") {
        symbolization.pointColor = formValues.pointColor;
      }
      const rasterRules = parseJsonObject(
        formValues.rasterRulesJson,
        "栅格规则",
      );
      const updated = await api.updateAdminDataResource(resource.id, {
        action: "update",
        categoryCode: formValues.categoryCode,
        accessGroupIds: realAccessGroupIds(formValues.accessGroupIds),
        visualization: {
          layerName: formValues.layerName,
          defaultVisible: formValues.defaultVisible,
          defaultOpacity: currentDefaultOpacity(resource),
          symbolization,
          rasterRules,
        },
      });
      if ("id" in updated) {
        replaceResource(updated);
        void loadResources(filters);
        message.success("数据权限与默认可视化方案已保存");
        return updated;
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function toggleStatus(resource: AdminDataResource, checked: boolean) {
    if (!canChange) {
      message.warning("当前用户无数据编辑权限");
      return;
    }
    const nextStatus = checked ? "active" : "inactive";
    try {
      const updated = await api.updateAdminDataResource(resource.id, {
        action: "setStatus",
        status: nextStatus,
      });
      if ("id" in updated) {
        replaceResource(updated);
      }
      void loadResources(filters);
      message.success(`已${checked ? "启用" : "禁用"} ${resource.name}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "状态更新失败");
    }
  }

  async function exportInventory(format: string) {
    if (!canExport) {
      message.warning("当前用户无数据导出权限");
      return;
    }
    try {
      const exportFormat = format === "xlsx" ? "xlsx" : "csv";
      const { blob, filename } = await api.exportAdminDataResources({
        ...exportFilters(filters),
        format: exportFormat,
      });
      downloadBlob(blob, filename);
      message.success(`已导出 ${exportFormat.toUpperCase()} 清单`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导出失败");
    }
  }

  async function deleteResource(
    resource: AdminDataResource,
    confirmationName: string,
  ) {
    if (!canDelete) {
      message.warning("当前用户无删除权限");
      return;
    }
    try {
      await api.updateAdminDataResource(resource.id, {
        action: "delete",
        confirmationName,
      });
      setData((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== resource.id),
        total: Math.max(current.total - 1, 0),
      }));
      void loadResources(filters);
      message.success("数据资源已删除");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  function replaceResource(resource: AdminDataResource) {
    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === resource.id ? resource : item,
      ),
    }));
  }

  function openCreateGroupModal() {
    setGroupName("");
    setGroupModal({ kind: "create" });
  }

  function startInlineEditGroup(group: InventoryGroup) {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  }

  async function saveGroupModal() {
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      message.warning("请输入组别名称");
      return;
    }
    if (inventoryGroups.some((group) => group.name === trimmedName)) {
      message.warning("组别名称已存在");
      return;
    }
    setSavingGroup(true);
    try {
      const created = await api.createAdminDataResourceGroup({
        name: trimmedName,
      });
      setData((current) => ({
        ...current,
        inventoryGroups: [...(current.inventoryGroups ?? []), created],
      }));
      void loadResources(filters);
      message.success(`已新增组别：${trimmedName}`);
      setGroupName("");
      setGroupModal(null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "组别保存失败");
    } finally {
      setSavingGroup(false);
    }
  }

  async function saveInlineGroupName(group: InventoryGroup) {
    if (group.kind !== "custom" || savingGroupId === group.id) {
      return;
    }
    const trimmedName = editingGroupName.trim();
    if (!trimmedName) {
      message.warning("请输入组别名称");
      setEditingGroupName(group.name);
      setEditingGroupId(null);
      return;
    }
    if (trimmedName === group.name) {
      setEditingGroupId(null);
      return;
    }
    if (
      inventoryGroups.some(
        (currentGroup) =>
          currentGroup.id !== group.id && currentGroup.name === trimmedName,
      )
    ) {
      message.warning("组别名称已存在");
      return;
    }
    setSavingGroupId(group.id);
    try {
      const updated = await api.updateAdminDataResourceGroup(Number(group.id), {
        action: "update",
        name: trimmedName,
      });
      if ("id" in updated) {
        replaceInventoryGroup(updated);
        void loadResources(filters);
        message.success("组别名称已更新");
      }
      setEditingGroupId(null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "组别保存失败");
    } finally {
      setSavingGroupId(null);
    }
  }

  async function toggleGroupStatus(group: InventoryGroup, checked: boolean) {
    const manageableResources = group.resources.filter(
      (resource) => canChange && resource.status !== groupStatus(checked),
    );
    if (manageableResources.length === 0) {
      message.warning("当前组别没有需要同步状态的数据");
      return;
    }
    setUpdatingGroupId(group.id);
    const updatedResources: AdminDataResource[] = [];
    try {
      for (const resource of manageableResources) {
        const updated = await api.updateAdminDataResource(resource.id, {
          action: "setStatus",
          status: groupStatus(checked),
        });
        if ("id" in updated) {
          updatedResources.push(updated);
        }
      }
      replaceResources(updatedResources);
      void loadResources(filters);
      message.success(`已${checked ? "启用" : "禁用"} ${group.name} 组内数据`);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "组别状态同步失败",
      );
      void loadResources(filters);
    } finally {
      setUpdatingGroupId(null);
    }
  }

  async function moveResourceToGroup(
    resourceId: number,
    group: InventoryGroup,
  ) {
    if (!canChange) {
      message.warning("当前用户无数据编辑权限");
      return;
    }
    const resource = data.items.find((item) => item.id === resourceId);
    if (!resource) {
      return;
    }
    if (!canAcceptInventoryDrop(group)) {
      return;
    }
    const nextGroupId = group.kind === "all" ? null : Number(group.id);
    if (resource.inventoryGroupId === nextGroupId) {
      return;
    }
    setMovingResourceId(resourceId);
    try {
      const updated = await api.updateAdminDataResource(resource.id, {
        action: "updateInventoryGroup",
        inventoryGroupId: nextGroupId,
      });
      if ("id" in updated) {
        replaceResource(updated);
      }
      void loadResources(filters);
      message.success(`已移动到${group.name}`);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "数据组别更新失败",
      );
    } finally {
      setMovingResourceId(null);
    }
  }

  async function deleteInventoryGroup(group: InventoryGroup) {
    if (group.kind !== "custom") {
      return;
    }
    setUpdatingGroupId(group.id);
    try {
      await api.updateAdminDataResourceGroup(Number(group.id), {
        action: "delete",
      });
      setData((current) => ({
        ...current,
        inventoryGroups: (current.inventoryGroups ?? []).filter(
          (item) => item.id !== group.id,
        ),
        items: current.items.map((item) =>
          item.inventoryGroupId === group.id
            ? { ...item, inventoryGroupId: null }
            : item,
        ),
      }));
      void loadResources(filters);
      message.success(`已删除组别：${group.name}，数据仍保留在权威业务分类中`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除组别失败");
    } finally {
      setUpdatingGroupId(null);
    }
  }

  function replaceResources(resources: AdminDataResource[]) {
    if (resources.length === 0) {
      return;
    }
    const byId = new Map(resources.map((resource) => [resource.id, resource]));
    setData((current) => ({
      ...current,
      items: current.items.map((item) => byId.get(item.id) ?? item),
    }));
  }

  function replaceInventoryGroup(group: AdminDataResourceGroup) {
    setData((current) => ({
      ...current,
      inventoryGroups: (current.inventoryGroups ?? []).map((item) =>
        item.id === group.id ? group : item,
      ),
    }));
  }

  const columns: ColumnsType<AdminDataResource> = [
    {
      title: "数据资源",
      dataIndex: "name",
      key: "name",
      width: inventoryResourceNameColumnWidth,
      ellipsis: true,
      render: (_, record) => (
        <Button
          type="link"
          className="inventory-resource-name-button"
          title={record.name}
        >
          {record.name}
        </Button>
      ),
    },
    {
      title: "业务分类",
      key: "category",
      width: 220,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text>
            {record.categoryPath.map((item) => item.name).join(" / ") ||
              "待归类"}
          </Typography.Text>
          {record.classificationStatus === "pending" && (
            <Tag color="orange">待归类</Tag>
          )}
        </Space>
      ),
    },
    {
      title: "类型",
      dataIndex: "dataType",
      key: "dataType",
      width: 92,
      render: (value: AdminDataResource["dataType"]) => (
        <Tag>{dataTypeLabels[value]}</Tag>
      ),
    },
    {
      title: "数据规模",
      key: "dataSize",
      width: 150,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <span>{formatBytes(record.sizeBytes ?? 0)}</span>
          <Typography.Text type="secondary" className="admin-table-subtext">
            {record.itemCount ?? 0} 条
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 112,
      render: (_, record) => (
        <Switch
          size="small"
          checked={record.status === "active"}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          disabled={!canChange}
          onChange={(checked) => toggleStatus(record, checked)}
        />
      ),
    },
    {
      title: "来源/单位",
      key: "source",
      width: 190,
      render: (_, record) => (
        <Space
          orientation="vertical"
          size={0}
          className="inventory-table-stack-cell"
        >
          <Typography.Text ellipsis={{ tooltip: record.source || "未记录" }}>
            {record.source || "未记录"}
          </Typography.Text>
          <Typography.Text
            type="secondary"
            className="admin-table-subtext"
            ellipsis={{ tooltip: record.provider || "未记录提供单位" }}
          >
            {record.provider || "未记录提供单位"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "上传用户",
      key: "uploader",
      width: 150,
      render: (_, record) => (
        <Space
          orientation="vertical"
          size={0}
          className="inventory-table-stack-cell"
        >
          <Typography.Text ellipsis={{ tooltip: uploaderDisplayName(record) }}>
            {uploaderDisplayName(record)}
          </Typography.Text>
          {record.uploader?.username && (
            <Typography.Text
              type="secondary"
              className="admin-table-subtext"
              ellipsis={{ tooltip: record.uploader.username }}
            >
              {record.uploader.username}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: "数据日期",
      dataIndex: "dataDate",
      key: "dataDate",
      width: 120,
      render: (value: string | null) => value || "-",
    },
  ];

  const renderGroupedTable = ({
    tableColumns,
    loading: tableLoading,
    pagination,
  }: ManagedCollectionTableRenderArgs<AdminDataResource>) => {
    const nestedTableColumns = prepareNestedTableColumns(tableColumns);
    const groupColumns: ColumnsType<InventoryGroup> = [
      {
        title: "组名",
        dataIndex: "name",
        key: "name",
        width: inventoryGroupNameColumnWidth,
        ellipsis: true,
        render: (_, group) => (
          <Space size={6} className="inventory-group-name-cell">
            {editingGroupId === group.id ? (
              <Input
                autoFocus
                size="small"
                aria-label={`编辑组别名称${group.name}`}
                className="inventory-group-name-input"
                value={editingGroupName}
                disabled={savingGroupId === group.id}
                onChange={(event) => setEditingGroupName(event.target.value)}
                onBlur={() => {
                  void saveInlineGroupName(group);
                }}
                onPressEnter={(event) => event.currentTarget.blur()}
              />
            ) : (
              <>
                <Typography.Text strong ellipsis={{ tooltip: group.name }}>
                  {group.name}
                </Typography.Text>
                {group.kind === "custom" && (
                  <Tooltip title="编辑组名">
                    <Button
                      type="text"
                      size="small"
                      aria-label={`编辑组别${group.name}`}
                      className="inventory-group-edit-button"
                      icon={<EditOutlined />}
                      onClick={() => startInlineEditGroup(group)}
                    />
                  </Tooltip>
                )}
                <Tag color={inventoryGroupKindColor(group.kind)}>
                  {inventoryGroupKindLabel(group.kind)}
                </Tag>
              </>
            )}
          </Space>
        ),
      },
      {
        title: "操作",
        key: "groupActions",
        width: inventoryActionColumnWidth,
        render: (_, group) =>
          group.kind !== "custom" ? (
            <Tooltip title="系统分组不可删除">
              <Button
                icon={<DeleteOutlined />}
                disabled
                aria-label={`删除系统分组${group.name}`}
              />
            </Tooltip>
          ) : (
            <Popconfirm
              title="删除组别"
              description="删除后仅移除自定义归档关系，数据仍保留在对应的权威业务分类中。"
              okText="删除"
              cancelText="取消"
              onConfirm={() => deleteInventoryGroup(group)}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={updatingGroupId === group.id}
                aria-label={`删除组别${group.name}`}
              />
            </Popconfirm>
          ),
      },
      {
        title: "总数据规模",
        key: "groupSize",
        width: 180,
        render: (_, group) => (
          <Space orientation="vertical" size={0}>
            <span>{formatBytes(group.sizeBytes)}</span>
            <Typography.Text
              type="secondary"
              className="admin-table-subtext"
              ellipsis={{
                tooltip: `${group.itemCount} 条，${group.resourceCount} 项数据`,
              }}
            >
              {group.itemCount} 条，{group.resourceCount} 项数据
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: "当前页状态",
        key: "groupAccess",
        width: 150,
        render: (_, group) => {
          const disabled =
            group.resources.length === 0 ||
            (!canChange &&
              !group.resources.every((resource) => resource.canManageAccess));
          return (
            <Checkbox
              className="inventory-group-status-checkbox"
              aria-label={`${group.name}组别状态`}
              checked={group.enabled}
              indeterminate={group.partiallyEnabled}
              disabled={disabled || updatingGroupId === group.id}
              onChange={(event) =>
                toggleGroupStatus(group, event.target.checked)
              }
            >
              {group.partiallyEnabled
                ? "部分启用"
                : group.enabled
                  ? "启用"
                  : "禁用"}
            </Checkbox>
          );
        },
      },
    ];

    const renderGroupResources = (group: InventoryGroup) => (
      <div
        onDragOver={(event) => {
          if (canAcceptInventoryDrop(group)) {
            event.preventDefault();
          }
        }}
        onDrop={() => {
          if (draggingResourceId !== null && canAcceptInventoryDrop(group)) {
            void moveResourceToGroup(draggingResourceId, group);
            setDraggingResourceId(null);
          }
        }}
      >
        <div className="inventory-group-page-note">
          <Typography.Text type="secondary">
            {group.resources.length === group.resourceCount
              ? `本页已显示该组全部 ${group.resourceCount} 项数据`
              : `当前页显示 ${group.resources.length} 项，该组共 ${group.resourceCount} 项；可使用上方分页查看其余数据`}
          </Typography.Text>
        </div>
        <Table<AdminDataResource>
          rowKey="id"
          size="small"
          className="inventory-group-resource-table"
          columns={nestedTableColumns}
          dataSource={group.resources}
          pagination={false}
          tableLayout="fixed"
          scroll={{ x: inventoryTableScrollX }}
          onRow={(resource) => ({
            draggable: canChange,
            onDragStart: () => setDraggingResourceId(resource.id),
            onDragEnd: () => setDraggingResourceId(null),
            className:
              movingResourceId === resource.id
                ? "inventory-resource-moving-row"
                : undefined,
          })}
        />
      </div>
    );

    const renderExpandedGroup = (group: InventoryGroup) =>
      group.subgroups.length > 0 ? (
        <Table<InventoryGroup>
          rowKey={(child) => String(child.id)}
          size="small"
          className="inventory-category-child-table"
          columns={groupColumns}
          dataSource={group.subgroups}
          tableLayout="fixed"
          scroll={{ x: inventoryTableScrollX }}
          pagination={false}
          expandable={{
            defaultExpandedRowKeys: group.subgroups
              .filter((child) => child.resourceCount > 0)
              .map((child) => child.id),
            rowExpandable: (child) => child.resourceCount > 0,
            expandedRowRender: renderGroupResources,
          }}
        />
      ) : (
        renderGroupResources(group)
      );

    return (
      <Space orientation="vertical" size={12} className="inventory-group-table">
        <div className="inventory-group-footer">
          <Pagination
            current={pagination.current}
            pageSize={pagination.pageSize}
            total={pagination.total}
            showSizeChanger={pagination.showSizeChanger}
            onChange={pagination.onChange}
            showTotal={(nextTotal) => `共 ${nextTotal} 项数据`}
          />
          <Button
            icon={<PlusOutlined />}
            aria-label="新增组别"
            className="inventory-add-group-button"
            disabled={!canChange}
            onClick={openCreateGroupModal}
          >
            新增组别
          </Button>
        </div>
        <Table<InventoryGroup>
          rowKey={(group) => String(group.id)}
          loading={tableLoading}
          columns={groupColumns}
          dataSource={inventoryGroups}
          tableLayout="fixed"
          scroll={{ x: inventoryTableScrollX }}
          pagination={false}
          onRow={(group) => ({
            onDragOver: (event) => {
              if (canAcceptInventoryDrop(group)) {
                event.preventDefault();
              }
            },
            onDrop: () => {
              if (
                draggingResourceId !== null &&
                canAcceptInventoryDrop(group)
              ) {
                void moveResourceToGroup(draggingResourceId, group);
                setDraggingResourceId(null);
              }
            },
          })}
          expandable={{
            defaultExpandedRowKeys: [
              ...categoryInventoryGroups.map((group) => group.id),
              unclassifiedInventoryGroupId,
              allInventoryGroupId,
            ],
            rowExpandable: (group) =>
              group.subgroups.length > 0 || group.resourceCount > 0,
            expandedRowRender: renderExpandedGroup,
          }}
        />
      </Space>
    );
  };

  return (
    <>
      <DataSchemaOverview canBrowseData={canBrowseData} />
      <ManagedCollectionPage<AdminDataResource>
        items={data.items}
        total={data.total}
        accessGroups={data.availableAccessGroups}
        loading={loading}
        filters={filters}
        filterFields={filterFields}
        columns={columns}
        stats={[
          { title: "筛选结果总数", value: data.summary.total },
          {
            title: "启用数据",
            value: data.summary.activeCount,
            prefix: <EyeOutlined />,
          },
          {
            title: "禁用数据",
            value: data.summary.inactiveCount,
            prefix: <StopOutlined />,
          },
          { title: "受限访问", value: data.summary.restrictedCount },
        ]}
        rowName={(item) => item.name}
        drawerTitle={canChange ? "存量数据配置" : "数据可见范围"}
        deleteTitle="删除存量数据"
        deleteDescription="删除会移除数据资源登记和关联图层；用户导入的表或矢量图层会同步清理。请输入数据名称确认。"
        ownerScopeLabel="上传者本人可见"
        canMaintain={canChange}
        canDelete={canDelete}
        canExport={canExport}
        exportFormats={["csv", "xlsx"]}
        renderTable={renderGroupedTable}
        detailItems={(resource) => [
          { label: "数据名称", value: resource.name },
          {
            label: "权威业务分类",
            value:
              resource.categoryPath.map((item) => item.name).join(" / ") ||
              "待归类",
          },
          { label: "类型", value: dataTypeLabels[resource.dataType] },
          {
            label: "状态",
            value: (
              <Tag color={statusLabels[resource.status].color}>
                {statusLabels[resource.status].text}
              </Tag>
            ),
          },
          {
            label: "上传用户",
            value: uploaderDisplayName(resource),
          },
          { label: "数据大小", value: formatBytes(resource.sizeBytes ?? 0) },
          { label: "数据条目数", value: resource.itemCount ?? 0 },
        ]}
        formInitialValues={(resource) => initialVisualizationValues(resource)}
        renderFormItems={(resource, maintainable) => (
          <>
            <Typography.Title level={5}>权威业务分类</Typography.Title>
            <Form.Item
              name="categoryCode"
              label="四大类叶节点"
              rules={[{ required: true, message: "请选择权威业务分类" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                disabled={!maintainable}
                options={flattenTaxonomy(fallbackTaxonomyTree)
                  .filter((node) => node.selectable)
                  .map((node) => ({
                    value: node.categoryCode,
                    label: node.path.join(" / "),
                  }))}
              />
            </Form.Item>
            <Typography.Title level={5}>默认可视化方案</Typography.Title>
            <Form.Item
              name="layerName"
              label="默认图层名称"
              rules={[{ required: true, message: "请输入默认图层名称" }]}
            >
              <Input disabled={!maintainable} />
            </Form.Item>
            <Form.Item
              name="defaultVisible"
              label="默认显示"
              valuePropName="checked"
            >
              <Switch
                checkedChildren="显示"
                unCheckedChildren="隐藏"
                disabled={!maintainable}
              />
            </Form.Item>
            {resource.dataType === "vector" && (
              <Form.Item name="pointColor" label="点位/主色">
                <Input type="color" disabled={!maintainable} />
              </Form.Item>
            )}
            <Form.Item name="symbolizationJson" label="矢量符号 JSON">
              <Input.TextArea
                rows={6}
                spellCheck={false}
                disabled={!maintainable}
              />
            </Form.Item>
            <Form.Item name="rasterRulesJson" label="栅格规则 JSON">
              <Input.TextArea
                rows={6}
                spellCheck={false}
                disabled={!maintainable}
              />
            </Form.Item>
          </>
        )}
        onFilterChange={(nextFilters) =>
          setFilters(nextFilters as AdminDataResourceFilters)
        }
        onPageChange={(current, pageSize) =>
          setFilters((currentFilters) => ({
            ...currentFilters,
            current,
            pageSize,
          }))
        }
        onSave={saveResourceSettings}
        onDelete={deleteResource}
        onExport={exportInventory}
      />
      <Modal
        title="新增组别"
        open={Boolean(groupModal)}
        okText="新建"
        okButtonProps={{ "aria-label": "新建" }}
        cancelText="取消"
        confirmLoading={savingGroup}
        onOk={saveGroupModal}
        onCancel={() => setGroupModal(null)}
      >
        <Input
          autoFocus
          allowClear
          value={groupName}
          placeholder="输入组别名称"
          onChange={(event) => setGroupName(event.target.value)}
          onPressEnter={saveGroupModal}
        />
      </Modal>
    </>
  );
}

function prepareNestedTableColumns(
  columns: ColumnsType<AdminDataResource>,
): ColumnsType<AdminDataResource> {
  const sortableColumns = columns.map(addResourceColumnSorter);
  const actionIndex = sortableColumns.findIndex(
    (column) => column.key === "actions",
  );
  const nameIndex = sortableColumns.findIndex(
    (column) => column.key === "name",
  );
  if (actionIndex < 0 || nameIndex < 0 || actionIndex === nameIndex + 1) {
    return sortableColumns;
  }

  const nextColumns = [...sortableColumns];
  const [actionColumn] = nextColumns.splice(actionIndex, 1);
  if (!actionColumn) {
    return sortableColumns;
  }
  const currentNameIndex = nextColumns.findIndex(
    (column) => column.key === "name",
  );
  nextColumns.splice(currentNameIndex + 1, 0, actionColumn);
  return nextColumns;
}

function addResourceColumnSorter(
  column: ColumnsType<AdminDataResource>[number],
): ColumnsType<AdminDataResource>[number] {
  if ("children" in column) {
    return column;
  }
  const key = String(column.key ?? "");
  const fixedColumn = {
    ...column,
    ...(inventoryResourceColumnWidths[key]
      ? { width: inventoryResourceColumnWidths[key] }
      : {}),
    ...(inventoryEllipsisColumnKeys.has(key) ? { ellipsis: true } : {}),
  };
  if (column.key === "name") {
    return {
      ...fixedColumn,
      sorter: resourceColumnSorters.name,
    };
  }
  if (column.key === "actions") {
    return fixedColumn;
  }
  const sorter = resourceColumnSorters[key];
  return sorter ? { ...fixedColumn, sorter } : fixedColumn;
}

const resourceColumnSorters: Record<
  string,
  (left: AdminDataResource, right: AdminDataResource) => number
> = {
  name: (left, right) => compareText(left.name, right.name),
  dataType: (left, right) =>
    compareText(dataTypeLabels[left.dataType], dataTypeLabels[right.dataType]),
  dataSize: (left, right) =>
    left.sizeBytes - right.sizeBytes || left.itemCount - right.itemCount,
  status: (left, right) =>
    compareText(
      statusLabels[left.status].text,
      statusLabels[right.status].text,
    ),
  source: (left, right) =>
    compareText(left.source, right.source) ||
    compareText(left.provider, right.provider),
  uploader: (left, right) =>
    compareText(uploaderDisplayName(left), uploaderDisplayName(right)),
  dataDate: (left, right) =>
    compareText(left.dataDate ?? "", right.dataDate ?? ""),
  updatedAt: (left, right) =>
    Date.parse(left.updatedAt) - Date.parse(right.updatedAt),
};

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "zh-CN");
}

function uploaderDisplayName(resource: AdminDataResource): string {
  return (
    resource.uploader?.displayName ||
    resource.uploader?.username ||
    resource.maintainer ||
    "未知"
  );
}

function initialVisualizationValues(
  resource: AdminDataResource,
): VisualizationFormValues {
  const visualization = resource.defaultVisualization;
  const layer = resource.defaultLayer;
  const symbolization: Record<string, unknown> =
    typeof visualization.symbolization === "object" &&
    visualization.symbolization !== null
      ? (visualization.symbolization as Record<string, unknown>)
      : (layer?.symbolization ?? {});
  const rasterRules: Record<string, unknown> =
    typeof visualization.rasterRules === "object" &&
    visualization.rasterRules !== null
      ? (visualization.rasterRules as Record<string, unknown>)
      : (layer?.rasterRules ?? {});
  return {
    categoryCode: resource.category?.code ?? "",
    layerName:
      textValue(visualization.layerName) || layer?.name || resource.name,
    defaultVisible: Boolean(
      visualization.defaultVisible ?? layer?.defaultVisible ?? false,
    ),
    pointColor: textValue(symbolization.pointColor) || "#2f7d62",
    symbolizationJson: JSON.stringify(symbolization, null, 2),
    rasterRulesJson: JSON.stringify(rasterRules, null, 2),
    accessGroupIds: withFixedAccessScopes(
      resource.accessGroups.map((group) => group.id as AccessScopeId),
    ),
  };
}

function buildInventoryGroups(
  resources: AdminDataResource[],
  persistedGroups: AdminDataResourceGroup[],
  groupSummaries: InventoryGroupSummary[],
): InventoryGroup[] {
  const groupDefinitions: InventoryGroupDefinition[] = [
    allInventoryGroup,
    ...categoryInventoryGroups,
    unclassifiedInventoryGroup,
    ...persistedGroups.map((group) => ({
      id: group.id,
      name: group.name,
      kind: "custom" as const,
    })),
  ];
  const summaryByKey = new Map(
    groupSummaries.map((summary) => [summary.key, summary]),
  );
  const buildGroup = (group: InventoryGroupDefinition): InventoryGroup =>
    createInventoryGroup({
      ...group,
      summary: summaryByKey.get(inventoryGroupSummaryKey(group)),
      resources: resources.filter((resource) =>
        resourceBelongsToInventoryGroup(resource, group),
      ),
      subgroups: (group.children ?? []).map(buildGroup),
    });
  return groupDefinitions.map(buildGroup);
}

function createInventoryGroup({
  id,
  name,
  resources,
  kind,
  summary,
  subgroups,
}: {
  id: InventoryGroupId;
  name: string;
  resources: AdminDataResource[];
  kind: InventoryGroupKind;
  summary?: InventoryGroupSummary;
  subgroups: InventoryGroup[];
}): InventoryGroup {
  const activeCount = resources.filter(
    (resource) => resource.status === "active",
  ).length;
  return {
    id,
    name,
    resources,
    resourceCount: summary?.resourceCount ?? resources.length,
    enabled: resources.length > 0 && activeCount === resources.length,
    partiallyEnabled: activeCount > 0 && activeCount < resources.length,
    kind,
    subgroups,
    sizeBytes:
      summary?.sizeBytes ??
      resources.reduce(
        (total, resource) => total + (resource.sizeBytes ?? 0),
        0,
      ),
    itemCount:
      summary?.itemCount ??
      resources.reduce(
        (total, resource) => total + (resource.itemCount ?? 0),
        0,
      ),
  };
}

function inventoryGroupSummaryKey(group: InventoryGroupDefinition) {
  return group.kind === "custom" ? `__custom__:${group.id}` : String(group.id);
}

function resourceBelongsToInventoryGroup(
  resource: AdminDataResource,
  group: InventoryGroupDefinition,
) {
  if (group.kind === "all") return true;
  if (group.kind === "unclassified") {
    return resource.classificationStatus === "pending" || !resource.category;
  }
  if (group.kind === "category-root" || group.kind === "category-leaf") {
    return resource.categoryPath.some(
      (item) => item.code === group.categoryCode,
    );
  }
  return resource.inventoryGroupId === group.id;
}

function inventoryGroupKindLabel(kind: InventoryGroupKind) {
  if (kind === "all") return "汇总";
  if (kind === "category-root") return "一级大类";
  if (kind === "category-leaf") return "业务小类";
  if (kind === "unclassified") return "待治理";
  return "自定义";
}

function inventoryGroupKindColor(kind: InventoryGroupKind) {
  if (kind === "all") return "blue";
  if (kind === "category-root") return "green";
  if (kind === "category-leaf") return "cyan";
  if (kind === "unclassified") return "orange";
  return "default";
}

function canAcceptInventoryDrop(group: InventoryGroup) {
  return group.kind === "all" || group.kind === "custom";
}

function groupStatus(enabled: boolean): AdminDataResource["status"] {
  return enabled ? "active" : "inactive";
}

function exportFilters(filters: AdminDataResourceFilters) {
  const { current, pageSize, ...rest } = filters;
  void current;
  void pageSize;
  return rest;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function currentDefaultOpacity(resource: AdminDataResource) {
  return Number(
    resource.defaultVisualization.defaultOpacity ??
      resource.defaultLayer?.defaultOpacity ??
      85,
  );
}

function parseJsonObject(value: string | undefined, label: string) {
  if (!value?.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error(`${label}必须是 JSON 对象`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${label}格式错误：${error.message}`);
    }
    throw new Error(`${label}格式错误`);
  }
}

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let current = value;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  return `${current.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
