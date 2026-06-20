import { FileDoneOutlined } from "@ant-design/icons";
import {
  App as AntApp,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";
import type {
  AdminAchievement,
  AdminAchievementFilters,
  AdminAchievementList,
} from "../types";
import ManagedCollectionPage, {
  type AccessScopeId,
  type FilterField,
  type ManagedFormValues,
  isSuperadminGroup,
  realAccessGroupIds,
  withFixedAccessScopes,
} from "./ManagedCollectionPage";

type AchievementFormValues = ManagedFormValues & {
  title: string;
  summary?: string;
  source?: string;
  displayOrder?: number;
  relatedLayerId?: number | null;
};

const statusLabels = {
  draft: { text: "草稿", color: "default" },
  published: { text: "已发布", color: "green" },
  archived: { text: "已归档", color: "gold" },
} as const;

const initialList: AdminAchievementList = {
  items: [],
  total: 0,
  availableAccessGroups: [],
};

const filterFields: FilterField[] = [
  {
    name: "status",
    label: "发布状态",
    kind: "select",
    options: [
      { value: "draft", label: "草稿" },
      { value: "published", label: "已发布" },
      { value: "archived", label: "已归档" },
    ],
  },
  { name: "category", label: "成果分类", kind: "input" },
  { name: "source", label: "成果来源", kind: "input" },
];

export default function AdminAchievementManagementPage() {
  const { message } = AntApp.useApp();
  const { user } = useAppContext();
  const [filters, setFilters] = useState<AdminAchievementFilters>({
    current: 1,
    pageSize: 10,
  });
  const [data, setData] = useState<AdminAchievementList>(initialList);
  const [loading, setLoading] = useState(false);
  const canMaintain = Boolean(user?.permissions.canMaintainData);

  const metrics = useMemo(() => {
    const published = data.items.filter(
      (item) => item.status === "published",
    ).length;
    const draft = data.items.filter((item) => item.status === "draft").length;
    const restricted = data.items.filter(
      (item) => item.accessGroups.length > 0,
    ).length;
    return { published, draft, restricted };
  }, [data.items]);

  const loadItems = useCallback(
    async (nextFilters: AdminAchievementFilters) => {
      setLoading(true);
      try {
        const result = await api.adminAchievements(nextFilters);
        setData(result);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "成果加载失败");
      } finally {
        setLoading(false);
      }
    },
    [message],
  );

  useEffect(() => {
    if (canMaintain) {
      void loadItems(filters);
    }
  }, [canMaintain, filters, loadItems]);

  if (!canMaintain) {
    return <Navigate to="/admin/profile" replace />;
  }

  async function saveItem(item: AdminAchievement, values: ManagedFormValues) {
    try {
      const formValues = values as AchievementFormValues;
      const updated = await api.updateAdminAchievement(item.id, {
        action: "update",
        title: formValues.title,
        summary: formValues.summary ?? "",
        source: formValues.source ?? "",
        displayOrder: Number(formValues.displayOrder ?? item.displayOrder),
        relatedLayerId: formValues.relatedLayerId ?? null,
        status: item.status,
        accessGroupIds: realAccessGroupIds(formValues.accessGroupIds),
      });
      if ("id" in updated) {
        replaceItem(updated);
        message.success("成果信息和权限已保存");
        return updated;
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function changeStatus(item: AdminAchievement, status: string) {
    try {
      const nextStatus =
        status === "published" || status === "archived" ? status : "draft";
      const updated = await api.updateAdminAchievement(item.id, {
        action: "setStatus",
        status: nextStatus,
      });
      if ("id" in updated) {
        replaceItem(updated);
      }
      message.success(`成果状态已更新为 ${statusLabels[nextStatus].text}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "状态更新失败");
    }
  }

  async function deleteItem(item: AdminAchievement, confirmationName: string) {
    try {
      await api.updateAdminAchievement(item.id, {
        action: "delete",
        confirmationName,
      });
      setData((current) => ({
        ...current,
        items: current.items.filter((entry) => entry.id !== item.id),
        total: Math.max(current.total - 1, 0),
      }));
      message.success("成果已删除");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  function replaceItem(item: AdminAchievement) {
    setData((current) => ({
      ...current,
      items: current.items.map((entry) =>
        entry.id === item.id ? item : entry,
      ),
    }));
  }

  const columns: ColumnsType<AdminAchievement> = [
    {
      title: "成果标题",
      dataIndex: "title",
      key: "title",
      width: 280,
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Typography.Text strong>{record.title}</Typography.Text>
          <Typography.Text type="secondary" className="admin-table-subtext">
            {record.code}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "分类",
      key: "category",
      width: 120,
      render: (_, record) => record.category?.name || "未分类",
    },
    {
      title: "发布状态",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (_, record) => (
        <Select
          size="small"
          value={record.status}
          disabled={!canMaintain}
          onChange={(value) => changeStatus(record, value)}
          options={[
            { value: "draft", label: "草稿" },
            { value: "published", label: "已发布" },
            { value: "archived", label: "已归档" },
          ]}
        />
      ),
    },
    {
      title: "来源",
      dataIndex: "source",
      key: "source",
      width: 190,
      render: (value: string) => value || "未记录",
    },
    {
      title: "维护用户",
      key: "owner",
      width: 150,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <span>{record.owner.displayName}</span>
          <Typography.Text type="secondary" className="admin-table-subtext">
            {record.owner.username || "未记录"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "排序",
      dataIndex: "displayOrder",
      key: "displayOrder",
      width: 88,
    },
  ];

  return (
    <ManagedCollectionPage<AdminAchievement>
      items={data.items}
      total={data.total}
      accessGroups={data.availableAccessGroups}
      loading={loading}
      filters={filters}
      filterFields={filterFields}
      columns={columns}
      stats={[
        { title: "当前成果", value: data.total, prefix: <FileDoneOutlined /> },
        { title: "本页发布", value: metrics.published },
        { title: "本页草稿", value: metrics.draft },
        { title: "本页受限访问", value: metrics.restricted },
      ]}
      rowName={(item) => item.title}
      drawerTitle="成果配置"
      deleteTitle="删除成果"
      deleteDescription="删除会移除成果登记、展示配置和共享范围，不会删除关联的数据资源或图层。请输入成果标题确认。"
      ownerScopeLabel="维护用户本人可见"
      canMaintain={canMaintain}
      detailItems={(item) => [
        { label: "成果标题", value: item.title },
        { label: "成果编号", value: item.code },
        { label: "分类", value: item.category?.name || "未分类" },
        {
          label: "状态",
          value: (
            <Tag color={statusLabels[item.status].color}>
              {statusLabels[item.status].text}
            </Tag>
          ),
        },
        { label: "维护用户", value: item.owner.displayName },
        {
          label: "创建时间",
          value: new Date(item.createdAt).toLocaleString("zh-CN"),
        },
      ]}
      formInitialValues={(item) => ({
        title: item.title,
        summary: item.summary,
        source: item.source,
        displayOrder: item.displayOrder,
        relatedLayerId: item.relatedLayerId,
        accessGroupIds: withFixedAccessScopes(
          item.accessGroups
            .filter((group) => !isSuperadminGroup(group))
            .map((group) => group.id as AccessScopeId),
        ),
      })}
      renderFormItems={(_, maintainable) => (
        <>
          <Typography.Title level={5}>基础信息</Typography.Title>
          <Form.Item
            name="title"
            label="成果标题"
            rules={[{ required: true, message: "请输入成果标题" }]}
          >
            <Input disabled={!maintainable} />
          </Form.Item>
          <Form.Item name="summary" label="成果摘要">
            <Input.TextArea rows={4} disabled={!maintainable} />
          </Form.Item>
          <Form.Item name="source" label="成果来源">
            <Input disabled={!maintainable} />
          </Form.Item>
          <Form.Item name="displayOrder" label="展示排序">
            <InputNumber min={0} precision={0} disabled={!maintainable} />
          </Form.Item>
          <Form.Item name="relatedLayerId" label="关联图层 ID">
            <InputNumber min={1} precision={0} disabled={!maintainable} />
          </Form.Item>
        </>
      )}
      onFilterChange={(nextFilters) =>
        setFilters(nextFilters as AdminAchievementFilters)
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
