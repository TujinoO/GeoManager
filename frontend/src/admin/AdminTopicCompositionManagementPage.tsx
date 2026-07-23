import {
  EyeOutlined,
  FileOutlined,
  FileImageOutlined,
  GlobalOutlined,
  ReloadOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { ProCard, StatisticCard } from "@ant-design/pro-components";
import {
  Alert,
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
  Tabs,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";
import type {
  MapComposition,
  ResultArtifact,
  WorkspaceAccessGroup,
} from "../types";
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

const resultStatusLabels = {
  draft: { text: "已下架/历史草稿", color: "default" },
  published: { text: "已发布", color: "green" },
} satisfies Record<ResultArtifact["status"], { text: string; color: string }>;

const resultTypeLabels: Record<ResultArtifact["resultType"], string> = {
  map: "地图",
  chart: "图表",
  report: "报告",
  table: "表格",
  image: "图片",
  other: "其他",
};

export default function AdminTopicCompositionManagementPage() {
  const { message } = AntApp.useApp();
  const [publishForm] = Form.useForm<{
    versionNumber?: number;
    audienceGroupIds: number[];
  }>();
  const navigate = useNavigate();
  const { user } = useAppContext();
  const [items, setItems] = useState<MapComposition[]>([]);
  const [resultItems, setResultItems] = useState<ResultArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewFormat, setPreviewFormat] = useState("");
  const [availableAudienceGroups, setAvailableAudienceGroups] = useState<
    WorkspaceAccessGroup[]
  >([]);
  const [publishingComposition, setPublishingComposition] =
    useState<MapComposition | null>(null);
  const [publishingArtifact, setPublishingArtifact] =
    useState<ResultArtifact | null>(null);
  const [publishing, setPublishing] = useState(false);
  const canManageCompositions = Boolean(
    user?.permissions.canViewMapCompositions ||
    user?.permissions.canChangeMapCompositions ||
    user?.permissions.canDeleteMapCompositions ||
    user?.permissions.canPublishMapCompositions,
  );
  const canManageArtifacts = Boolean(user?.permissions.canViewResultArtifacts);
  const canOpen = canManageCompositions || canManageArtifacts;
  const loadItems = useCallback(async () => {
    if (!canOpen) {
      setItems([]);
      return;
    }
    setLoading(true);
    const [compositionResponse, artifactResponse] = await Promise.allSettled([
      canManageCompositions
        ? api.mapCompositions()
        : Promise.resolve({ items: [], availableAudienceGroups: [] }),
      canManageArtifacts
        ? api.resultArtifacts()
        : Promise.resolve({ items: [], availableAccessGroups: [] }),
    ]);
    if (compositionResponse.status === "fulfilled") {
      setItems(compositionResponse.value.items);
    } else {
      setItems([]);
      message.error("专题图成果加载失败");
    }
    if (artifactResponse.status === "fulfilled") {
      setResultItems(artifactResponse.value.items);
    } else {
      setResultItems([]);
      message.error("导入成果加载失败");
    }
    const compositionGroups =
      compositionResponse.status === "fulfilled"
        ? compositionResponse.value.availableAudienceGroups
        : [];
    const artifactGroups =
      artifactResponse.status === "fulfilled"
        ? artifactResponse.value.availableAccessGroups
        : [];
    setAvailableAudienceGroups(
      [...compositionGroups, ...artifactGroups].filter(
        (group, groupIndex, groups) =>
          groups.findIndex((candidate) => candidate.id === group.id) ===
          groupIndex,
      ),
    );
    setLoading(false);
  }, [canManageArtifacts, canManageCompositions, canOpen, message]);

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

  const filteredResultItems = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("zh-CN");
    return resultItems.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (!keyword) return true;
      return [
        item.name,
        item.description,
        item.provider,
        item.fileName,
        item.owner.displayName,
        item.owner.username,
      ].some((value) =>
        (value ?? "").toLocaleLowerCase("zh-CN").includes(keyword),
      );
    });
  }, [query, resultItems, status]);

  const metrics = useMemo(
    () => ({
      total: items.length + resultItems.length,
      mapping: items.length,
      imported: resultItems.length,
      published:
        items.filter((item) => item.status === "published").length +
        resultItems.filter((item) => item.status === "published").length,
    }),
    [items, resultItems],
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
      setPreviewFormat("png");
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
    setPublishingArtifact(null);
    setPublishingComposition(composition);
    publishForm.setFieldsValue({
      versionNumber,
      audienceGroupIds: composition.audienceGroups.map((group) => group.id),
    });
  }

  async function submitPublish() {
    if (!publishingComposition && !publishingArtifact) return;
    const values = await publishForm.validateFields();
    setPublishing(true);
    try {
      if (publishingComposition) {
        const result = await api.publishMapComposition(
          publishingComposition.id,
          {
            versionNumber: values.versionNumber!,
            audienceGroupIds: values.audienceGroupIds,
          },
        );
        setItems((current) =>
          current.map((item) => (item.id === result.id ? result : item)),
        );
        notifyWorkspaceInventoryChanged("composition");
      } else if (publishingArtifact) {
        const result = await api.updateResultArtifact(publishingArtifact.id, {
          action: "publish",
          accessGroupIds: values.audienceGroupIds,
        });
        if (!("deleted" in result)) {
          setResultItems((current) =>
            current.map((item) => (item.id === result.id ? result : item)),
          );
        }
        notifyWorkspaceInventoryChanged("result");
      }
      setPublishingComposition(null);
      setPublishingArtifact(null);
      message.success("成果已发布");
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

  async function previewArtifact(artifact: ResultArtifact) {
    if (!artifact.canPreview) {
      message.warning("该成果格式不支持在线预览");
      return;
    }
    try {
      const result = await api.downloadResultArtifact(artifact.id, "preview");
      const nextUrl = URL.createObjectURL(result.blob);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
      setPreviewTitle(artifact.name);
      setPreviewFormat(artifact.fileFormat);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "成果预览失败");
    }
  }

  async function downloadArtifact(artifact: ResultArtifact) {
    try {
      const result = await api.downloadResultArtifact(artifact.id);
      downloadBlob(result.blob, result.filename);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "成果下载失败");
    }
  }

  function openArtifactPublish(artifact: ResultArtifact) {
    setPublishingComposition(null);
    setPublishingArtifact(artifact);
    publishForm.setFieldsValue({
      versionNumber: undefined,
      audienceGroupIds: artifact.accessGroups.map((group) => group.id),
    });
  }

  async function unpublishArtifact(artifact: ResultArtifact) {
    try {
      const result = await api.updateResultArtifact(artifact.id, {
        action: "unpublish",
      });
      if (!("deleted" in result)) {
        setResultItems((current) =>
          current.map((item) => (item.id === result.id ? result : item)),
        );
      }
      notifyWorkspaceInventoryChanged("result");
      message.success("成果已下架");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "成果下架失败");
    }
  }

  async function deleteArtifact(artifact: ResultArtifact) {
    try {
      await api.updateResultArtifact(artifact.id, { action: "delete" });
      setResultItems((current) =>
        current.filter((item) => item.id !== artifact.id),
      );
      notifyWorkspaceInventoryChanged("result");
      message.success("成果文件已删除");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "成果删除失败");
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

  const resultColumns: ColumnsType<ResultArtifact> = [
    {
      title: "成果名称",
      dataIndex: "name",
      key: "name",
      width: 280,
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Typography.Text strong>{record.name}</Typography.Text>
          <Typography.Text type="secondary" className="admin-table-subtext">
            {record.provider || record.fileName}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "来源 / 类型",
      key: "type",
      width: 190,
      render: (_, record) => (
        <Space wrap size={4}>
          <Tag color={record.sourceType === "analysis" ? "blue" : "gold"}>
            {record.sourceType === "analysis" ? "平台分析" : "直接导入"}
          </Tag>
          <Tag>{resultTypeLabels[record.resultType]}</Tag>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (value: ResultArtifact["status"]) => (
        <Tag color={resultStatusLabels[value].color}>
          {resultStatusLabels[value].text}
        </Tag>
      ),
    },
    {
      title: "创建者",
      key: "owner",
      width: 160,
      render: (_, record) =>
        record.owner.displayName || record.owner.username || "系统维护",
    },
    {
      title: "文件",
      key: "file",
      width: 140,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text>{record.fileFormat.toUpperCase()}</Typography.Text>
          <Typography.Text type="secondary">
            {formatFileSize(record.sizeBytes)}
          </Typography.Text>
        </Space>
      ),
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
      width: 340,
      render: (_, record) => (
        <Space wrap>
          <Button
            type="link"
            icon={<EyeOutlined />}
            disabled={!record.canPreview}
            onClick={() => void previewArtifact(record)}
          >
            预览
          </Button>
          <Button
            type="link"
            disabled={!record.canDownload}
            onClick={() => void downloadArtifact(record)}
          >
            下载
          </Button>
          <Button
            type="link"
            disabled={!record.canPublish}
            onClick={() => openArtifactPublish(record)}
          >
            {record.status === "published" ? "更新范围" : "发布"}
          </Button>
          {record.canUnpublish ? (
            <Button type="link" onClick={() => void unpublishArtifact(record)}>
              下架
            </Button>
          ) : null}
          <Popconfirm
            title="删除成果文件"
            description={`确认删除“${record.name}”？成果记录和文件将被永久删除且不可恢复。`}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            disabled={!record.canDelete}
            onConfirm={() => void deleteArtifact(record)}
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
        <Alert
          showIcon
          type="info"
          title="统一成果管理"
          description="专题图成果沿用制图查看、导出和发布权限；导入成果使用独立的查看、导入、下载、发布和删除权限。对象所属用户只能执行已获授权操作，平台管理主体可管理全部成果。"
          style={{ marginBottom: 16 }}
        />
        <Form layout="vertical">
          <div className="inventory-toolbar">
            <Form.Item className="inventory-search-item">
              <Input
                allowClear
                value={query}
                placeholder="按成果名称、来源工程、文件、单位或创建者快速搜索"
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
                  { value: "draft", label: "草稿 / 已下架" },
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
            title: "全部成果",
            value: metrics.total,
            prefix: <FileOutlined />,
          }}
        />
        <StatisticCard
          statistic={{
            title: "专题图成果",
            value: metrics.mapping,
            prefix: <FileImageOutlined />,
          }}
        />
        <StatisticCard
          statistic={{
            title: "导入成果",
            value: metrics.imported,
            prefix: <UploadOutlined />,
          }}
        />
        <StatisticCard
          statistic={{ title: "已发布", value: metrics.published }}
        />
      </StatisticCard.Group>

      <ProCard className="admin-section-card inventory-table-card">
        <Tabs
          items={[
            ...(canManageCompositions
              ? [
                  {
                    key: "mapping",
                    label: `专题图成果（${filteredItems.length}）`,
                    children: (
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
                            emptyText: (
                              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            ),
                          }}
                        />
                      </div>
                    ),
                  },
                ]
              : []),
            ...(canManageArtifacts
              ? [
                  {
                    key: "artifacts",
                    label: `导入成果（${filteredResultItems.length}）`,
                    children: (
                      <div className="inventory-table-scroll">
                        <Table<ResultArtifact>
                          rowKey="id"
                          loading={loading}
                          columns={resultColumns}
                          dataSource={filteredResultItems}
                          scroll={{ x: 1440 }}
                          pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            showTotal: (total) => `共 ${total} 条`,
                          }}
                          locale={{
                            emptyText: (
                              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            ),
                          }}
                        />
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </ProCard>

      <Modal
        title={previewTitle}
        open={Boolean(previewUrl)}
        footer={null}
        width="min(1000px, 92vw)"
        onCancel={() => setPreviewUrl("")}
      >
        {previewUrl && previewFormat === "pdf" ? (
          <iframe
            className="result-pdf-preview"
            src={previewUrl}
            title={previewTitle}
          />
        ) : previewUrl ? (
          <img
            className="map-composition-preview-image"
            src={previewUrl}
            alt={previewTitle}
          />
        ) : null}
      </Modal>
      <Modal
        title={publishingArtifact ? "发布导入成果" : "发布专题图成果"}
        open={Boolean(publishingComposition || publishingArtifact)}
        okText="确认发布"
        confirmLoading={publishing}
        onOk={() => void submitPublish()}
        onCancel={() => {
          setPublishingComposition(null);
          setPublishingArtifact(null);
        }}
        destroyOnHidden
      >
        <Form form={publishForm} layout="vertical">
          {publishingComposition ? (
            <Form.Item
              name="versionNumber"
              label="正式发布版本"
              rules={[{ required: true, message: "请选择发布版本" }]}
            >
              <Select
                options={publishingComposition.versions.map((version) => ({
                  value: version.versionNumber,
                  label: `V${version.versionNumber} · ${version.format.toUpperCase()}`,
                }))}
              />
            </Form.Item>
          ) : null}
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

function formatFileSize(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
