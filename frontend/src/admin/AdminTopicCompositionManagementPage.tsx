import {
  EyeOutlined,
  FileImageOutlined,
  GlobalOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { ProCard, StatisticCard } from "@ant-design/pro-components";
import {
  App as AntApp,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";
import type { MapComposition, WorkspaceAccessGroup } from "../types";
import { downloadBlob } from "../utils/download";
import {
  isWorkspaceInventoryChange,
  notifyWorkspaceInventoryChanged,
  workspaceInventoryChangedEvent,
} from "../workspace/workspaceSync";

const statusLabels: Record<
  MapComposition["status"],
  { text: string; color: string }
> = {
  draft: { text: "草稿", color: "default" },
  completed: { text: "未发布", color: "blue" },
  published: { text: "已发布", color: "green" },
};

type StatusFilter = "all" | MapComposition["status"];

export default function AdminTopicCompositionManagementPage() {
  const { message } = AntApp.useApp();
  const [publishForm] = Form.useForm<{
    versionNumber: number;
    audienceGroupIds: number[];
  }>();
  const navigate = useNavigate();
  const { user } = useAppContext();
  const [items, setItems] = useState<MapComposition[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [availableAudienceGroups, setAvailableAudienceGroups] = useState<
    WorkspaceAccessGroup[]
  >([]);
  const [publishingComposition, setPublishingComposition] =
    useState<MapComposition | null>(null);
  const [publishing, setPublishing] = useState(false);
  const canOpen = Boolean(
    user?.permissions.canViewMapCompositions ||
    user?.permissions.canChangeMapCompositions ||
    user?.permissions.canDeleteMapCompositions ||
    user?.permissions.canPublishMapCompositions,
  );
  const loadItems = useCallback(async () => {
    if (!canOpen) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const result = await api.mapCompositions();
      setItems(result.items);
      setAvailableAudienceGroups(result.availableAudienceGroups);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "专题加载失败");
    } finally {
      setLoading(false);
    }
  }, [canOpen, message]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    function refreshFromEvent(event: Event) {
      const detail = event instanceof CustomEvent ? event.detail : undefined;
      if (isWorkspaceInventoryChange(detail)) {
        void loadItems();
      }
    }
    function refreshFromStorage(event: StorageEvent) {
      if (event.key !== workspaceInventoryChangedEvent || !event.newValue) {
        return;
      }
      try {
        if (isWorkspaceInventoryChange(JSON.parse(event.newValue))) {
          void loadItems();
        }
      } catch {
        return;
      }
    }
    function refreshOnFocus() {
      if (document.visibilityState === "visible") {
        void loadItems();
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
  }, [loadItems]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("zh-CN");
    return items.filter((item) => {
      const statusMatched = status === "all" || item.status === status;
      if (!statusMatched) return false;
      if (!keyword) return true;
      return [
        item.name,
        item.description,
        item.projectName,
        item.owner.displayName,
        item.owner.username,
      ].some((value) =>
        (value ?? "").toLocaleLowerCase("zh-CN").includes(keyword),
      );
    });
  }, [items, query, status]);

  const metrics = useMemo(
    () => ({
      total: items.length,
      draft: items.filter((item) => item.status === "draft").length,
      completed: items.filter((item) => item.status === "completed").length,
      published: items.filter((item) => item.status === "published").length,
    }),
    [items],
  );

  if (!canOpen) {
    return <Navigate to="/admin/profile" replace />;
  }

  async function preview(composition: MapComposition) {
    if (!composition.currentVersion) {
      message.warning("该专题暂无可预览成果");
      return;
    }
    try {
      const result = await api.downloadMapCompositionVersion(
        composition.id,
        composition.currentVersion.versionNumber,
        "preview",
      );
      const nextUrl = URL.createObjectURL(result.blob);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
      setPreviewTitle(
        `${composition.name} V${composition.currentVersion.versionNumber}`,
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : "专题预览失败");
    }
  }

  async function download(composition: MapComposition) {
    if (!composition.currentVersion) {
      message.warning("该专题暂无可下载成果");
      return;
    }
    try {
      const result = await api.downloadMapCompositionVersion(
        composition.id,
        composition.currentVersion.versionNumber,
      );
      downloadBlob(result.blob, result.filename);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "专题下载失败");
    }
  }

  async function unpublish(composition: MapComposition) {
    try {
      const result = await api.unpublishMapComposition(composition.id);
      setItems((current) =>
        current.map((item) => (item.id === result.id ? result : item)),
      );
      notifyWorkspaceInventoryChanged("composition");
      message.success("专题已下架");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "专题下架失败");
    }
  }

  function openPublish(composition: MapComposition) {
    const versionNumber =
      composition.publishedVersion?.versionNumber ??
      composition.currentVersion?.versionNumber;
    if (!versionNumber) {
      message.warning("该专题尚未生成成果版本");
      return;
    }
    setPublishingComposition(composition);
    publishForm.setFieldsValue({
      versionNumber,
      audienceGroupIds: composition.audienceGroups.map((group) => group.id),
    });
  }

  async function submitPublish() {
    if (!publishingComposition) return;
    const values = await publishForm.validateFields();
    setPublishing(true);
    try {
      const result = await api.publishMapComposition(
        publishingComposition.id,
        values,
      );
      setItems((current) =>
        current.map((item) => (item.id === result.id ? result : item)),
      );
      notifyWorkspaceInventoryChanged("composition");
      setPublishingComposition(null);
      message.success("专题已发布");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "专题发布失败");
    } finally {
      setPublishing(false);
    }
  }

  async function deleteComposition(composition: MapComposition) {
    try {
      await api.deleteMapComposition(composition.id);
      setItems((current) =>
        current.filter((item) => item.id !== composition.id),
      );
      notifyWorkspaceInventoryChanged("composition");
      message.success("专题已删除");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "专题删除失败");
    }
  }

  const columns: ColumnsType<MapComposition> = [
    {
      title: "专题名称",
      dataIndex: "name",
      key: "name",
      width: 260,
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Typography.Text strong>{record.name}</Typography.Text>
          <Typography.Text type="secondary" className="admin-table-subtext">
            来源工程：{record.projectName}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "类型",
      key: "type",
      width: 96,
      render: () => <Tag>专题出图</Tag>,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 112,
      render: (value: MapComposition["status"]) => (
        <Tag color={statusLabels[value].color}>{statusLabels[value].text}</Tag>
      ),
    },
    {
      title: "所属用户",
      key: "owner",
      width: 160,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <span>{record.owner.displayName || record.owner.username}</span>
          <Typography.Text type="secondary" className="admin-table-subtext">
            {record.owner.username}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "成果版本",
      key: "version",
      width: 112,
      render: (_, record) =>
        record.currentVersion
          ? `V${record.currentVersion.versionNumber}`
          : "未生成",
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 190,
      render: (value: string) => new Date(value).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "actions",
      width: 360,
      render: (_, record) => (
        <Space wrap>
          <Button
            type="link"
            icon={<GlobalOutlined />}
            onClick={() => navigate(`/map?sceneId=${record.projectId}`)}
          >
            打开工程
          </Button>
          <Button
            type="link"
            icon={<EyeOutlined />}
            disabled={!record.canPreview || !record.currentVersion}
            onClick={() => void preview(record)}
          >
            预览
          </Button>
          <Button
            type="link"
            disabled={!record.canDownload || !record.currentVersion}
            onClick={() => void download(record)}
          >
            下载
          </Button>
          <Button
            type="link"
            disabled={!record.canPublish}
            onClick={() => openPublish(record)}
          >
            {record.status === "published" ? "更新发布" : "发布"}
          </Button>
          {record.canUnpublish ? (
            <Button type="link" onClick={() => void unpublish(record)}>
              下架
            </Button>
          ) : null}
          <Popconfirm
            title="删除专题"
            description={`确认删除“${record.name}”？专题、全部版本记录和成果文件将被永久删除且不可恢复。`}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            disabled={!record.canDelete}
            onConfirm={() => void deleteComposition(record)}
          >
            <Button type="link" danger disabled={!record.canDelete}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="admin-page-stack admin-inventory-page">
      <ProCard className="admin-section-card">
        <Form layout="vertical">
          <div className="inventory-toolbar">
            <Form.Item className="inventory-search-item">
              <Input
                allowClear
                value={query}
                placeholder="按名称、来源工程或所属用户快速搜索"
                onChange={(event) => setQuery(event.target.value)}
              />
            </Form.Item>
            <Space wrap>
              <Select<StatusFilter>
                value={status}
                style={{ width: 144 }}
                onChange={setStatus}
                options={[
                  { value: "all", label: "全部状态" },
                  { value: "draft", label: "草稿" },
                  { value: "completed", label: "未发布" },
                  { value: "published", label: "已发布" },
                ]}
              />
              <Button
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={() => void loadItems()}
              >
                刷新
              </Button>
            </Space>
          </div>
        </Form>
      </ProCard>

      <StatisticCard.Group className="inventory-stat-group">
        <StatisticCard
          statistic={{
            title: "当前专题",
            value: metrics.total,
            prefix: <FileImageOutlined />,
          }}
        />
        <StatisticCard statistic={{ title: "草稿", value: metrics.draft }} />
        <StatisticCard
          statistic={{ title: "未发布", value: metrics.completed }}
        />
        <StatisticCard
          statistic={{ title: "已发布", value: metrics.published }}
        />
      </StatisticCard.Group>

      <ProCard className="admin-section-card inventory-table-card">
        <div className="inventory-table-scroll">
          <Table<MapComposition>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={filteredItems}
            scroll={{ x: 1280 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            locale={{
              emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        </div>
      </ProCard>

      <Modal
        title={previewTitle}
        open={Boolean(previewUrl)}
        footer={null}
        width="min(1000px, 92vw)"
        onCancel={() => setPreviewUrl("")}
      >
        {previewUrl ? (
          <img
            className="map-composition-preview-image"
            src={previewUrl}
            alt={previewTitle}
          />
        ) : null}
      </Modal>
      <Modal
        title="发布专题"
        open={Boolean(publishingComposition)}
        okText="确认发布"
        confirmLoading={publishing}
        onOk={() => void submitPublish()}
        onCancel={() => setPublishingComposition(null)}
        destroyOnHidden
      >
        <Form form={publishForm} layout="vertical">
          <Form.Item
            name="versionNumber"
            label="正式发布版本"
            rules={[{ required: true, message: "请选择发布版本" }]}
          >
            <Select
              options={(publishingComposition?.versions ?? []).map(
                (version) => ({
                  value: version.versionNumber,
                  label: `V${version.versionNumber} · ${version.format.toUpperCase()}`,
                }),
              )}
            />
          </Form.Item>
          <Form.Item
            name="audienceGroupIds"
            label="发布可见角色"
            rules={[{ required: true, message: "请至少选择一个可见角色" }]}
          >
            <Select
              mode="multiple"
              options={availableAudienceGroups.map((group) => ({
                value: group.id,
                label: group.name,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
