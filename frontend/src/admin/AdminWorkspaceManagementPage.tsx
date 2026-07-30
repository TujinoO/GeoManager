import { FolderOpenOutlined, GlobalOutlined } from "@ant-design/icons";
import {
  App as AntApp,
  Button,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";
import type {
  AdminWorkspaceFilters,
  AdminWorkspaceList,
  AdminWorkspaceScene,
} from "../types";
import ManagedCollectionPage, {
  type AccessScopeId,
  type FilterField,
  type ManagedFormValues,
  realAccessGroupIds,
  withFixedAccessScopes,
} from "./ManagedCollectionPage";
import {
  isWorkspaceInventoryChange,
  notifyWorkspaceInventoryChanged,
  workspaceInventoryChangedEvent,
} from "../workspace/workspaceSync";

type WorkspaceFormValues = ManagedFormValues & {
  name: string;
  description?: string;
  kind: AdminWorkspaceScene["kind"];
};

const statusLabels = {
  active: { text: "启用", color: "green" },
  inactive: { text: "禁用", color: "default" },
} as const;

const kindLabels: Record<AdminWorkspaceScene["kind"], string> = {
  project: "工程",
};

const initialList: AdminWorkspaceList = {
  items: [],
  total: 0,
  availableAccessGroups: [],
};

const filterFields: FilterField[] = [
  {
    name: "status",
    label: "状态",
    kind: "select",
    options: [
      { value: "active", label: "启用" },
      { value: "inactive", label: "禁用" },
    ],
  },
];

export default function AdminWorkspaceManagementPage({
  kind,
}: {
  kind: AdminWorkspaceScene["kind"];
}) {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const { user } = useAppContext();
  const [filters, setFilters] = useState<AdminWorkspaceFilters>({
    kind,
    status: "active",
    current: 1,
    pageSize: 10,
  });
  const [data, setData] = useState<AdminWorkspaceList>(initialList);
  const [loading, setLoading] = useState(false);
  const canView = Boolean(user?.permissions.canViewWorkspaces);
  const canChange = Boolean(user?.permissions.canChangeWorkspaces);
  const canMaintain = canChange;
  const canDelete = Boolean(user?.permissions.canDeleteWorkspaces);
  const canOpen = canView || canChange || canDelete;
  const label = kindLabels[kind];

  const metrics = useMemo(() => {
    const active = data.items.filter((item) => item.status === "active").length;
    const inactive = data.items.filter(
      (item) => item.status === "inactive",
    ).length;
    const shared = data.items.filter(
      (item) => item.accessGroups.length > 0,
    ).length;
    return { active, inactive, shared };
  }, [data.items]);

  const loadItems = useCallback(
    async (nextFilters: AdminWorkspaceFilters) => {
      setLoading(true);
      try {
        const result = await api.adminWorkspaces(nextFilters);
        setData(result);
      } catch (error) {
        message.error(
          error instanceof Error ? error.message : `${label}加载失败`,
        );
      } finally {
        setLoading(false);
      }
    },
    [label, message],
  );

  useEffect(() => {
    if (canOpen) {
      void loadItems(filters);
    }
  }, [canOpen, filters, loadItems]);

  useEffect(() => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      kind,
      current: 1,
    }));
  }, [kind]);

  useEffect(() => {
    function refreshFromEvent(event: Event) {
      const detail = event instanceof CustomEvent ? event.detail : undefined;
      if (isWorkspaceInventoryChange(detail)) {
        void loadItems(filters);
      }
    }
    function refreshFromStorage(event: StorageEvent) {
      if (event.key !== workspaceInventoryChangedEvent || !event.newValue) {
        return;
      }
      try {
        if (isWorkspaceInventoryChange(JSON.parse(event.newValue))) {
          void loadItems(filters);
        }
      } catch {
        return;
      }
    }
    function refreshOnFocus() {
      if (document.visibilityState === "visible") {
        void loadItems(filters);
      }
    }
    window.addEventListener(workspaceInventoryChangedEvent, refreshFromEvent);
    window.addEventListener("storage", refreshFromStorage);
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      window.removeEventListener(
        workspaceInventoryChangedEvent,
        refreshFromEvent,
      );
      window.removeEventListener("storage", refreshFromStorage);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [filters, loadItems]);

  if (!canOpen) {
    return <Navigate to="/admin/profile" replace />;
  }

  async function saveItem(
    item: AdminWorkspaceScene,
    values: ManagedFormValues,
  ) {
    try {
      if (!canMaintain || !item.canEdit) {
        if (!item.canManageAccess) {
          message.warning(`当前用户无${label}编辑权限`);
          return;
        }
        const updated = await api.updateAdminWorkspace(item.id, {
          action: "updateAccess",
          accessGroupIds: realAccessGroupIds(values.accessGroupIds),
        });
        if ("id" in updated) {
          replaceItem(updated);
          notifyWorkspaceInventoryChanged("workspace");
          message.success(`${label}可见范围已保存`);
          return updated;
        }
        return;
      }
      const formValues = values as WorkspaceFormValues;
      const updated = await api.updateAdminWorkspace(item.id, {
        action: "update",
        name: formValues.name,
        description: formValues.description ?? "",
        kind: formValues.kind,
        status: item.status,
        accessGroupIds: realAccessGroupIds(formValues.accessGroupIds),
      });
      if ("id" in updated) {
        replaceItem(updated);
        notifyWorkspaceInventoryChanged("workspace");
        message.success(`${label}信息和权限已保存`);
        return updated;
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function toggleStatus(item: AdminWorkspaceScene, checked: boolean) {
    if (!canMaintain || !item.canEdit) {
      message.warning(`当前用户无${label}编辑权限`);
      return;
    }
    try {
      const updated = await api.updateAdminWorkspace(item.id, {
        action: "setStatus",
        status: checked ? "active" : "inactive",
      });
      if ("id" in updated) {
        replaceItem(updated);
        notifyWorkspaceInventoryChanged("workspace");
      }
      message.success(`已${checked ? "启用" : "禁用"} ${item.name}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "状态更新失败");
    }
  }

  async function deleteItem(
    item: AdminWorkspaceScene,
    confirmationName: string,
  ) {
    if (!canDelete || !item.canDelete) {
      message.warning(`当前用户无${label}删除权限`);
      return;
    }
    try {
      await api.updateAdminWorkspace(item.id, {
        action: "delete",
        confirmationName,
      });
      setData((current) => ({
        ...current,
        items: current.items.filter((entry) => entry.id !== item.id),
        total: Math.max(current.total - 1, 0),
      }));
      notifyWorkspaceInventoryChanged("workspace");
      message.success(`${label}已删除`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  function replaceItem(item: AdminWorkspaceScene) {
    setData((current) => ({
      ...current,
      items: current.items.map((entry) =>
        entry.id === item.id ? item : entry,
      ),
    }));
  }

  const columns: ColumnsType<AdminWorkspaceScene> = [
    {
      title: `${label}名称`,
      dataIndex: "name",
      key: "name",
      width: 260,
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Typography.Text strong>{record.name}</Typography.Text>
          <Typography.Text type="secondary" className="admin-table-subtext">
            {record.description || "未填写说明"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "类型",
      dataIndex: "kind",
      key: "kind",
      width: 96,
      render: (value: AdminWorkspaceScene["kind"]) => (
        <Tag>{kindLabels[value]}</Tag>
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
          disabled={!canMaintain || !record.canEdit}
          onChange={(checked) => toggleStatus(record, checked)}
        />
      ),
    },
    {
      title: "所属用户",
      key: "owner",
      width: 160,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <span>{ownerDisplayName(record)}</span>
          <Typography.Text type="secondary" className="admin-table-subtext">
            {record.owner.username}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "可见范围",
      key: "accessGroups",
      width: 240,
      render: (_, record) => (
        <Space wrap size={[4, 4]}>
          <Tag color="cyan">所属用户</Tag>
          {record.accessGroups.map((group) => (
            <Tag key={group.id} color={group.isGuest ? "orange" : "blue"}>
              {group.name}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "快照图层",
      key: "layers",
      width: 104,
      align: "center",
      render: (_, record) => workspaceLayerCount(record),
    },
    {
      title: "地图加载",
      key: "load",
      width: 112,
      render: (_, record) => (
        <Button
          type="link"
          icon={<GlobalOutlined />}
          disabled={record.status !== "active"}
          onClick={() => navigate(`/map?sceneId=${record.id}`)}
        >
          打开
        </Button>
      ),
    },
  ];

  return (
    <ManagedCollectionPage<AdminWorkspaceScene>
      items={data.items}
      total={data.total}
      accessGroups={data.availableAccessGroups}
      loading={loading}
      filters={filters}
      filterFields={filterFields}
      columns={columns}
      stats={[
        {
          title: `当前${label}`,
          value: data.total,
          prefix: <FolderOpenOutlined />,
        },
        { title: "本页启用", value: metrics.active },
        { title: "本页禁用", value: metrics.inactive },
        { title: "本页已共享", value: metrics.shared },
      ]}
      rowName={(item) => item.name}
      drawerTitle={`${label}配置`}
      deleteTitle={`删除${label}`}
      deleteDescription={`删除会移除该${label}保存项和共享配置，不会删除原始数据资源。请输入完整名称确认。`}
      ownerScopeLabel="所属用户本人可见"
      accessScopeNotice={
        <Typography.Text type="secondary">
          所属用户本人始终可见；平台会自动保留必要的系统访问范围。
        </Typography.Text>
      }
      canMaintain={canMaintain}
      canMaintainItem={(item) => item.canEdit}
      canDelete={canDelete}
      canDeleteItem={(item) => item.canDelete}
      detailItems={(item) => [
        { label: `${label}名称`, value: item.name },
        { label: "类型", value: kindLabels[item.kind] },
        {
          label: "状态",
          value: (
            <Tag color={statusLabels[item.status].color}>
              {statusLabels[item.status].text}
            </Tag>
          ),
        },
        { label: "所属用户", value: ownerDisplayName(item) },
        {
          label: "创建时间",
          value: new Date(item.createdAt).toLocaleString("zh-CN"),
        },
        {
          label: "快照图层数",
          value: workspaceLayerCount(item),
        },
        {
          label: "额外可见角色",
          value:
            item.accessGroups.map((group) => group.name).join("、") ||
            "未额外共享",
        },
      ]}
      formInitialValues={(item) => ({
        name: item.name,
        description: item.description,
        kind: item.kind,
        accessGroupIds: withFixedAccessScopes(
          item.accessGroups.map((group) => group.id as AccessScopeId),
        ),
      })}
      renderFormItems={(_, maintainable) => (
        <>
          <Typography.Title level={5}>基础信息</Typography.Title>
          <Form.Item
            name="name"
            label={`${label}名称`}
            rules={[{ required: true, message: `请输入${label}名称` }]}
          >
            <Input disabled={!maintainable} />
          </Form.Item>
          <Form.Item name="description" label={`${label}说明`}>
            <Input.TextArea rows={4} disabled={!maintainable} />
          </Form.Item>
          <Form.Item name="kind" label="类型">
            <Select
              disabled={!maintainable}
              options={[
                { value: "project", label: "工程" },
                { value: "topic", label: "专题" },
              ]}
            />
          </Form.Item>
        </>
      )}
      onFilterChange={(nextFilters) =>
        setFilters({
          ...(nextFilters as AdminWorkspaceFilters),
          kind,
        })
      }
      onPageChange={(current, pageSize) =>
        setFilters((currentFilters) => ({
          ...currentFilters,
          current,
          pageSize,
        }))
      }
      onSave={saveItem}
      onDelete={deleteItem}
    />
  );
}

function ownerDisplayName(item: AdminWorkspaceScene): string {
  return item.owner.displayName || item.owner.username;
}

function workspaceLayerCount(item: AdminWorkspaceScene): number {
  const groups = item.snapshot.groups;
  if (!Array.isArray(groups)) return 0;
  return groups.reduce((total, group) => {
    if (!group || typeof group !== "object") return total;
    const children = (group as { children?: unknown }).children;
    return total + (Array.isArray(children) ? children.length : 0);
  }, 0);
}
