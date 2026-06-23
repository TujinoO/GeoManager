import {
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
  App as AntApp,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
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
  AdminDataResourceList,
} from "../types";
import { downloadBlob } from "../utils/download";
import ManagedCollectionPage, {
  type AccessScopeId,
  type FilterField,
  type ManagedCollectionTableRenderArgs,
  type ManagedFormValues,
  realAccessGroupIds,
  withFixedAccessScopes,
} from "./ManagedCollectionPage";

type VisualizationFormValues = ManagedFormValues & {
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
  availableAccessGroups: [],
};

const defaultInventoryGroupId = "__default__";

type InventoryGroupId = string;

interface InventoryGroup {
  id: InventoryGroupId;
  name: string;
  resources: AdminDataResource[];
  sizeBytes: number;
  itemCount: number;
  enabled: boolean;
  isDefault: boolean;
}

interface InventoryGroupDefinition {
  id: InventoryGroupId;
  name: string;
  isDefault: boolean;
}

const defaultInventoryGroup: InventoryGroupDefinition = {
  id: defaultInventoryGroupId,
  name: "默认分组",
  isDefault: true,
};

const filterFields: FilterField[] = [
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
    pageSize: 10,
  });
  const [data, setData] = useState<AdminDataResourceList>(initialList);
  const [loading, setLoading] = useState(false);
  const [groupDefinitions, setGroupDefinitions] = useState<
    InventoryGroupDefinition[]
  >([defaultInventoryGroup]);
  const [resourceGroupIds, setResourceGroupIds] = useState<
    Record<number, InventoryGroupId>
  >({});
  const [newGroupName, setNewGroupName] = useState("");
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [draggingResourceId, setDraggingResourceId] = useState<number | null>(
    null,
  );
  const [updatingGroupId, setUpdatingGroupId] =
    useState<InventoryGroupId | null>(null);

  const canView = Boolean(user?.permissions.canViewDataResources);
  const canChange = Boolean(user?.permissions.canChangeDataResources);
  const canDelete = Boolean(user?.permissions.canDeleteDataResources);
  const canUpload = Boolean(user?.permissions.canUploadData);
  const canExport = Boolean(user?.permissions.canExportData);
  const canOpenInventory =
    canView || canChange || canDelete || canUpload || canExport;

  const metrics = useMemo(() => {
    const active = data.items.filter((item) => item.status === "active").length;
    const inactive = data.items.filter(
      (item) => item.status === "inactive",
    ).length;
    const restricted = data.items.filter(
      (item) => item.accessGroups.length > 0,
    ).length;
    return { active, inactive, restricted };
  }, [data.items]);

  const inventoryGroups = useMemo(
    () => buildInventoryGroups(data.items, groupDefinitions, resourceGroupIds),
    [data.items, groupDefinitions, resourceGroupIds],
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

  function addInventoryGroup() {
    const trimmedName = newGroupName.trim();
    if (!trimmedName) {
      message.warning("请输入组别名称");
      return;
    }
    if (groupDefinitions.some((group) => group.name === trimmedName)) {
      message.warning("组别名称已存在");
      return;
    }
    setGroupDefinitions((current) => [
      ...current,
      {
        id: `custom-${Date.now()}`,
        name: trimmedName,
        isDefault: false,
      },
    ]);
    setNewGroupName("");
    setGroupModalOpen(false);
    message.success(`已新增组别：${trimmedName}`);
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

  function renameInventoryGroup(group: InventoryGroup, nextName: string) {
    if (group.isDefault) {
      return;
    }
    const trimmedName = nextName.trim();
    if (!trimmedName) {
      message.warning("组别名称不能为空");
      return;
    }
    if (
      groupDefinitions.some(
        (definition) =>
          definition.id !== group.id && definition.name === trimmedName,
      )
    ) {
      message.warning("组别名称已存在");
      return;
    }
    setGroupDefinitions((current) =>
      current.map((definition) =>
        definition.id === group.id
          ? { ...definition, name: trimmedName }
          : definition,
      ),
    );
  }

  function moveResourceToGroup(resourceId: number, groupId: InventoryGroupId) {
    setResourceGroupIds((current) => ({
      ...current,
      [resourceId]: groupId,
    }));
  }

  function deleteInventoryGroup(group: InventoryGroup) {
    if (group.isDefault) {
      return;
    }
    setResourceGroupIds((current) => {
      const next = { ...current };
      group.resources.forEach((resource) => {
        next[resource.id] = defaultInventoryGroupId;
      });
      return next;
    });
    setGroupDefinitions((current) =>
      current.filter((definition) => definition.id !== group.id),
    );
    message.success(`已删除组别：${group.name}，组内数据已进入默认分组`);
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

  const columns: ColumnsType<AdminDataResource> = [
    {
      title: "数据资源",
      dataIndex: "name",
      key: "name",
      width: 260,
      render: (_, record) => <Button type="link">{record.name}</Button>,
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
        <Space orientation="vertical" size={0}>
          <span>{record.source || "未记录"}</span>
          <Typography.Text type="secondary" className="admin-table-subtext">
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
        <Space orientation="vertical" size={0}>
          <span>{uploaderDisplayName(record)}</span>
          {record.uploader?.username && (
            <Typography.Text type="secondary" className="admin-table-subtext">
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
    const groupColumns: ColumnsType<InventoryGroup> = [
      {
        title: "组名",
        dataIndex: "name",
        key: "name",
        width: 260,
        render: (_, group) => (
          <Space>
            {group.isDefault ? (
              <Typography.Text strong>{group.name}</Typography.Text>
            ) : (
              <Input
                aria-label={`${group.name}组名`}
                defaultValue={group.name}
                onPressEnter={(event) =>
                  renameInventoryGroup(group, event.currentTarget.value)
                }
                onBlur={(event) =>
                  renameInventoryGroup(group, event.currentTarget.value)
                }
              />
            )}
            {group.isDefault && <Tag>默认分组</Tag>}
          </Space>
        ),
      },
      {
        title: "总数据规模",
        key: "groupSize",
        width: 180,
        render: (_, group) => (
          <Space orientation="vertical" size={0}>
            <span>{formatBytes(group.sizeBytes)}</span>
            <Typography.Text type="secondary" className="admin-table-subtext">
              {group.itemCount} 条，{group.resources.length} 项数据
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: "启用状态",
        key: "groupAccess",
        width: 150,
        render: (_, group) => {
          const disabled =
            group.resources.length === 0 ||
            (!canChange &&
              !group.resources.every((resource) => resource.canManageAccess));
          return (
            <Switch
              size="small"
              aria-label={`${group.name}组别状态`}
              checked={group.enabled}
              loading={updatingGroupId === group.id}
              checkedChildren="启用"
              unCheckedChildren="禁用"
              disabled={disabled}
              onChange={(checked) => toggleGroupStatus(group, checked)}
            />
          );
        },
      },
      {
        title: "操作",
        key: "groupActions",
        width: 96,
        render: (_, group) =>
          group.isDefault ? (
            <Tooltip title="默认分组不可删除">
              <Button
                icon={<DeleteOutlined />}
                disabled
                aria-label="删除默认分组"
              />
            </Tooltip>
          ) : (
            <Popconfirm
              title="删除组别"
              description="删除后该组内数据会进入默认分组，数据本身不会被删除。"
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
    ];

    const groupPagination = {
      ...pagination,
      showTotal: (nextTotal: number) => (
        <Space size={12} wrap>
          <span>共 {nextTotal} 条</span>
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setNewGroupName("");
              setGroupModalOpen(true);
            }}
          >
            新增组别
          </Button>
        </Space>
      ),
    };

    return (
      <Space orientation="vertical" size={12} className="inventory-group-table">
        <Table<InventoryGroup>
          rowKey={(group) => String(group.id)}
          loading={tableLoading}
          columns={groupColumns}
          dataSource={inventoryGroups}
          scroll={{ x: 1280 }}
          pagination={groupPagination}
          onRow={(group) => ({
            onDragOver: (event) => event.preventDefault(),
            onDrop: () => {
              if (draggingResourceId !== null) {
                moveResourceToGroup(draggingResourceId, group.id);
                setDraggingResourceId(null);
              }
            },
          })}
          expandable={{
            defaultExpandAllRows: true,
            expandedRowRender: (group) => (
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggingResourceId !== null) {
                    moveResourceToGroup(draggingResourceId, group.id);
                    setDraggingResourceId(null);
                  }
                }}
              >
                <Table<AdminDataResource>
                  rowKey="id"
                  size="small"
                  columns={tableColumns}
                  dataSource={group.resources}
                  pagination={false}
                  scroll={{ x: 1280 }}
                  onRow={(resource) => ({
                    draggable: true,
                    onDragStart: () => setDraggingResourceId(resource.id),
                    onDragEnd: () => setDraggingResourceId(null),
                  })}
                />
              </div>
            ),
          }}
        />
      </Space>
    );
  };

  return (
    <>
      <ManagedCollectionPage<AdminDataResource>
        items={data.items}
        total={data.total}
        accessGroups={data.availableAccessGroups}
        loading={loading}
        filters={filters}
        filterFields={filterFields}
        columns={columns}
        stats={[
          { title: "当前结果", value: data.total },
          { title: "本页启用", value: metrics.active, prefix: <EyeOutlined /> },
          {
            title: "本页禁用",
            value: metrics.inactive,
            prefix: <StopOutlined />,
          },
          { title: "本页受限访问", value: metrics.restricted },
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
        open={groupModalOpen}
        okText="新建"
        cancelText="取消"
        onOk={addInventoryGroup}
        onCancel={() => setGroupModalOpen(false)}
      >
        <Input
          autoFocus
          allowClear
          value={newGroupName}
          placeholder="输入组别名称"
          onChange={(event) => setNewGroupName(event.target.value)}
          onPressEnter={addInventoryGroup}
        />
      </Modal>
    </>
  );
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
  groupDefinitions: InventoryGroupDefinition[],
  resourceGroupIds: Record<number, InventoryGroupId>,
): InventoryGroup[] {
  const validGroupIds = new Set(groupDefinitions.map((group) => group.id));
  return groupDefinitions.map((group) =>
    createInventoryGroup({
      ...group,
      resources: resources.filter((resource) => {
        const assignedGroupId = resourceGroupIds[resource.id];
        return group.id === normalizeGroupId(assignedGroupId, validGroupIds);
      }),
    }),
  );
}

function createInventoryGroup({
  id,
  name,
  resources,
  isDefault,
}: {
  id: InventoryGroupId;
  name: string;
  resources: AdminDataResource[];
  isDefault: boolean;
}): InventoryGroup {
  return {
    id,
    name,
    resources,
    enabled:
      resources.length > 0 &&
      resources.every((resource) => resource.status === "active"),
    isDefault,
    sizeBytes: resources.reduce(
      (total, resource) => total + (resource.sizeBytes ?? 0),
      0,
    ),
    itemCount: resources.reduce(
      (total, resource) => total + (resource.itemCount ?? 0),
      0,
    ),
  };
}

function normalizeGroupId(
  groupId: InventoryGroupId | undefined,
  validGroupIds: Set<InventoryGroupId>,
) {
  return groupId && validGroupIds.has(groupId)
    ? groupId
    : defaultInventoryGroupId;
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
