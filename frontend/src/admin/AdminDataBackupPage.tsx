import {
  CloudOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  HddOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { ProCard } from "@ant-design/pro-components";
import {
  Alert,
  App,
  Button,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Progress,
  Select,
  Skeleton,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import type {
  AdminDashboard,
  AdminBackupOverview,
  AdminBackupRun,
  AdminBackupSettings,
  AdminBackupSettingsUpdate,
  BackupPlanType,
  BackupTargetType,
} from "../types";
import { downloadBlob } from "../utils/download";

interface BackupFormValues {
  plans: {
    platform: PlanFormValues;
    research: PlanFormValues;
  };
  local: {
    directory: string;
  };
  objectStorage: {
    provider: "s3_compatible";
    endpoint: string;
    region: string;
    bucket: string;
    prefix: string;
    accessKeyId: string;
    secretAccessKey?: string;
  };
}

interface PlanFormValues {
  enabled: boolean;
  dailyAt: string;
  target: BackupTargetType;
  retentionCount: number;
  includeLogs: boolean;
}

const planMeta: Record<
  BackupPlanType,
  { title: string; icon: ReactNode; scope: string; source: string }
> = {
  research: {
    title: "科研数据备份",
    icon: <HddOutlined />,
    scope: "vector、raster、gene、table",
    source: "科研数据根目录",
  },
  platform: {
    title: "平台数据备份",
    icon: <DatabaseOutlined />,
    scope: "SQLite 数据库、上传附件、系统配置、可选运行日志",
    source: "业务数据根目录",
  },
};

const targetOptions = [
  { label: "云端对象存储", value: "object_storage" },
  { label: "本地目录", value: "local" },
];

const statusText: Record<string, string> = {
  queued: "等待中",
  running: "运行中",
  success: "成功",
  failed: "失败",
};

const statusColor: Record<string, string> = {
  queued: "default",
  running: "processing",
  success: "success",
  failed: "error",
};

export default function AdminDataBackupPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<BackupFormValues>();
  const [overview, setOverview] = useState<AdminBackupOverview | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [runs, setRuns] = useState<AdminBackupRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingTarget, setTestingTarget] = useState<BackupTargetType | null>(
    null,
  );
  const [startingPlan, setStartingPlan] = useState<BackupPlanType | null>(null);
  const [pollRunId, setPollRunId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const [overviewData, runData, dashboardData] = await Promise.all([
      api.adminBackupOverview(),
      api.adminBackupRuns({ current: 1, pageSize: 20 }),
      api.adminDashboard("day").catch(() => null),
    ]);
    setOverview(overviewData);
    setRuns(runData.items);
    setDashboard(dashboardData);
    form.setFieldsValue(settingsToFormValues(overviewData.settings));
  }, [form]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    loadData()
      .catch((error) => {
        if (!mounted) return;
        message.error(
          error instanceof Error ? error.message : "数据备份配置加载失败",
        );
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [loadData, message]);

  useEffect(() => {
    if (!pollRunId) return;
    const timer = window.setInterval(async () => {
      try {
        const run = await api.adminBackupRun(pollRunId);
        setRuns((current) => mergeRun(current, run));
        if (run.status === "success" || run.status === "failed") {
          window.clearInterval(timer);
          setPollRunId(null);
          await loadData();
        }
      } catch {
        window.clearInterval(timer);
        setPollRunId(null);
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [loadData, pollRunId]);

  async function handleSave() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const updated = await api.updateAdminBackupSettings(
        formValuesToPayload(values),
      );
      form.setFieldsValue(settingsToFormValues(updated));
      setOverview((current) =>
        current ? { ...current, settings: updated } : current,
      );
      message.success("数据备份配置已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestTarget(targetType: BackupTargetType) {
    const values = form.getFieldsValue(true);
    setTestingTarget(targetType);
    try {
      const result = await api.testAdminBackupTarget({
        targetType,
        local: targetType === "local" ? values.local : undefined,
        objectStorage:
          targetType === "object_storage"
            ? cleanObjectStoragePayload(values.objectStorage)
            : undefined,
      });
      if (result.status === "success") {
        message.success(result.message);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "连接测试失败");
    } finally {
      setTestingTarget(null);
    }
  }

  async function handleStartBackup(planType: BackupPlanType) {
    const values = form.getFieldsValue(true);
    const plan = values.plans[planType];
    setStartingPlan(planType);
    try {
      const run = await api.createAdminBackupRun({
        planType,
        targetType: plan.target,
        includeLogs: planType === "platform" ? plan.includeLogs : false,
      });
      setRuns((current) => mergeRun(current, run));
      setPollRunId(run.id);
      message.success("备份任务已创建");
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "备份任务创建失败",
      );
    } finally {
      setStartingPlan(null);
    }
  }

  const handleDownload = useCallback(
    async (run: AdminBackupRun) => {
      try {
        const result = await api.downloadAdminBackupRun(run.id);
        downloadBlob(result.blob, result.filename || run.archiveName);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "备份下载失败");
      }
    },
    [message],
  );

  const activeRun = useMemo(
    () =>
      [...(overview?.activeRuns ?? []), ...runs].find((run) =>
        ["queued", "running"].includes(run.status),
      ),
    [overview?.activeRuns, runs],
  );
  const columns = useMemo<ColumnsType<AdminBackupRun>>(
    () => backupRunColumns(handleDownload),
    [handleDownload],
  );
  const visibleInventoryScope = dashboard?.cards.dataOverview?.visibleResources;

  if (loading) {
    return (
      <ProCard className="admin-section-card">
        <Skeleton active paragraph={{ rows: 10 }} />
      </ProCard>
    );
  }

  if (!overview) {
    return <Empty description="数据备份配置加载失败" />;
  }

  return (
    <Form
      form={form}
      layout="vertical"
      className="admin-page-stack admin-backup-page"
    >
      <Alert
        type="info"
        showIcon
        title="数据备份属于系统级维护功能"
        description="推荐使用云端对象存储作为异地备份目标；本地目录仅适合作为临时导出或内网备份选项，不能替代容灾。"
      />

      <div className="backup-summary-grid">
        {overview.summaries.map((summary) => (
          <ProCard key={summary.planType} className="admin-section-card">
            <Space orientation="vertical" size={8}>
              <Space>
                {planMeta[summary.planType].icon}
                <Typography.Text strong>{summary.label}</Typography.Text>
              </Space>
              <Typography.Text type="secondary">
                {summary.source}
              </Typography.Text>
              <Typography.Title level={4} className="backup-summary-value">
                {formatBytes(summary.sizeBytes)}
              </Typography.Title>
              <Typography.Text type="secondary">
                {summary.fileCount} 个可备份文件
              </Typography.Text>
              {summary.planType === "platform" && visibleInventoryScope ? (
                <Typography.Text type="secondary">
                  存量登记 {formatBytes(visibleInventoryScope.totalSizeBytes)} /{" "}
                  {visibleInventoryScope.totalResources} 项 /{" "}
                  {visibleInventoryScope.totalItemCount} 条
                </Typography.Text>
              ) : null}
            </Space>
          </ProCard>
        ))}
        <ProCard className="admin-section-card">
          <Space orientation="vertical" size={8}>
            <Space>
              <CloudOutlined />
              <Typography.Text strong>云端目标</Typography.Text>
            </Space>
            <Typography.Text type="secondary">
              {overview.settings.objectStorage.configured
                ? overview.settings.objectStorage.bucket
                : "未配置完整"}
            </Typography.Text>
            <Tag
              color={
                overview.settings.objectStorage.configured
                  ? "success"
                  : "warning"
              }
            >
              {overview.settings.objectStorage.configured
                ? "可测试连接"
                : "待配置"}
            </Tag>
          </Space>
        </ProCard>
      </div>

      {activeRun ? (
        <ProCard title="当前备份任务" className="admin-section-card">
          <Space orientation="vertical" size={12} className="backup-full-width">
            <Space wrap>
              <Tag color={statusColor[activeRun.status]}>
                {statusText[activeRun.status] ?? activeRun.status}
              </Tag>
              <Typography.Text>{activeRun.archiveName}</Typography.Text>
            </Space>
            <Progress percent={activeRun.progressPercent} />
            <Typography.Text type="secondary">
              {lastItem(activeRun.messages ?? []) || "等待任务进度"}
            </Typography.Text>
          </Space>
        </ProCard>
      ) : null}

      <ProCard
        title="备份目标"
        className="admin-section-card"
        extra={
          <Space wrap>
            <Button
              icon={<ReloadOutlined />}
              loading={testingTarget === "local"}
              onClick={() => handleTestTarget("local")}
            >
              测试本地目录
            </Button>
            <Button
              icon={<CloudOutlined />}
              loading={testingTarget === "object_storage"}
              onClick={() => handleTestTarget("object_storage")}
            >
              测试云端目标
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
            >
              保存配置
            </Button>
          </Space>
        }
      >
        <div className="backup-target-grid">
          <div>
            <Typography.Title level={5}>本地备份</Typography.Title>
            <Form.Item
              name={["local", "directory"]}
              label="本地备份目录"
              extra="留空时使用业务数据根目录 backups/local/。"
            >
              <Input placeholder="留空使用默认目录" />
            </Form.Item>
          </div>
          <div>
            <Typography.Title level={5}>云端对象存储</Typography.Title>
            <div className="backup-form-grid">
              <Form.Item name={["objectStorage", "provider"]} label="服务类型">
                <Select
                  options={[
                    { label: "S3 兼容对象存储", value: "s3_compatible" },
                  ]}
                />
              </Form.Item>
              <Form.Item name={["objectStorage", "endpoint"]} label="Endpoint">
                <Input placeholder="https://s3.example.com" />
              </Form.Item>
              <Form.Item name={["objectStorage", "region"]} label="Region">
                <Input placeholder="cn-north-1" />
              </Form.Item>
              <Form.Item name={["objectStorage", "bucket"]} label="Bucket">
                <Input placeholder="geomanager-backups" />
              </Form.Item>
              <Form.Item name={["objectStorage", "prefix"]} label="Prefix">
                <Input placeholder="prod/" />
              </Form.Item>
              <Form.Item
                name={["objectStorage", "accessKeyId"]}
                label="Access Key ID"
              >
                <Input />
              </Form.Item>
              <Form.Item
                name={["objectStorage", "secretAccessKey"]}
                label="Secret Access Key"
                extra={
                  overview.settings.objectStorage.secretConfigured
                    ? `已配置：${overview.settings.objectStorage.secretPreview}`
                    : "未配置 Secret"
                }
              >
                <Input.Password
                  placeholder="不修改时留空"
                  autoComplete="new-password"
                />
              </Form.Item>
            </div>
          </div>
        </div>
      </ProCard>

      <div className="backup-card-grid">
        {(["research", "platform"] as BackupPlanType[]).map((planType) => (
          <ProCard
            key={planType}
            className="admin-section-card backup-plan-card"
            title={
              <Space size={8}>
                {planMeta[planType].icon}
                <span>{planMeta[planType].title}</span>
              </Space>
            }
            extra={
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={startingPlan === planType}
                onClick={() => handleStartBackup(planType)}
              >
                立即备份
              </Button>
            }
          >
            <Descriptions
              size="small"
              column={1}
              items={[
                {
                  key: "source",
                  label: "数据来源",
                  children: planMeta[planType].source,
                },
                {
                  key: "scope",
                  label: "备份范围",
                  children: planMeta[planType].scope,
                },
              ]}
            />
            <div className="backup-plan-form">
              <Form.Item
                name={["plans", planType, "enabled"]}
                label="启用自动备份"
                valuePropName="checked"
              >
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>
              <Form.Item
                name={["plans", planType, "dailyAt"]}
                label="每日时间"
                rules={[
                  {
                    pattern: /^([01]\d|2[0-3]):[0-5]\d$/,
                    message: "请输入 HH:mm 格式",
                  },
                ]}
              >
                <Input placeholder="02:00" />
              </Form.Item>
              <Form.Item name={["plans", planType, "target"]} label="备份目标">
                <Select options={targetOptions} />
              </Form.Item>
              <Form.Item
                name={["plans", planType, "retentionCount"]}
                label="保留份数"
              >
                <InputNumber
                  min={1}
                  max={365}
                  className="backup-number-input"
                />
              </Form.Item>
              {planType === "platform" ? (
                <Form.Item
                  name={["plans", planType, "includeLogs"]}
                  label="包含运行日志"
                  valuePropName="checked"
                >
                  <Switch checkedChildren="是" unCheckedChildren="否" />
                </Form.Item>
              ) : null}
            </div>
          </ProCard>
        ))}
      </div>

      <ProCard title="备份历史" className="admin-section-card">
        <Table<AdminBackupRun>
          rowKey="id"
          columns={columns}
          dataSource={runs}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1180 }}
        />
      </ProCard>
    </Form>
  );
}

function settingsToFormValues(settings: AdminBackupSettings): BackupFormValues {
  return {
    plans: settings.plans,
    local: settings.local,
    objectStorage: {
      provider: settings.objectStorage.provider,
      endpoint: settings.objectStorage.endpoint,
      region: settings.objectStorage.region,
      bucket: settings.objectStorage.bucket,
      prefix: settings.objectStorage.prefix,
      accessKeyId: settings.objectStorage.accessKeyId,
      secretAccessKey: "",
    },
  };
}

function formValuesToPayload(
  values: BackupFormValues,
): AdminBackupSettingsUpdate {
  return {
    plans: {
      platform: values.plans.platform,
      research: {
        ...values.plans.research,
        includeLogs: false,
      },
    },
    local: {
      directory: values.local.directory ?? "",
    },
    objectStorage: cleanObjectStoragePayload(values.objectStorage),
  };
}

function cleanObjectStoragePayload(
  value: BackupFormValues["objectStorage"],
): AdminBackupSettingsUpdate["objectStorage"] {
  const payload: NonNullable<AdminBackupSettingsUpdate["objectStorage"]> = {
    provider: value.provider,
    endpoint: value.endpoint ?? "",
    region: value.region ?? "",
    bucket: value.bucket ?? "",
    prefix: value.prefix ?? "",
    accessKeyId: value.accessKeyId ?? "",
  };
  if (value.secretAccessKey?.trim()) {
    payload.secretAccessKey = value.secretAccessKey.trim();
  }
  return payload;
}

function backupRunColumns(
  onDownload: (run: AdminBackupRun) => void,
): ColumnsType<AdminBackupRun> {
  return [
    {
      title: "备份类型",
      dataIndex: "planType",
      width: 120,
      render: (value: BackupPlanType) =>
        value === "platform" ? "平台数据" : "科研数据",
    },
    {
      title: "目标",
      dataIndex: "targetType",
      width: 120,
      render: (value: BackupTargetType) =>
        value === "local" ? "本地目录" : "云端对象存储",
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 110,
      render: (value: string) => (
        <Tag color={statusColor[value] ?? "default"}>
          {statusText[value] ?? value}
        </Tag>
      ),
    },
    {
      title: "触发方式",
      dataIndex: "trigger",
      width: 110,
      render: (value: string) => (value === "scheduled" ? "自动" : "手动"),
    },
    {
      title: "归档文件",
      dataIndex: "archiveName",
      width: 260,
      ellipsis: true,
    },
    {
      title: "大小",
      dataIndex: "sizeBytes",
      width: 110,
      render: (value: number) => formatBytes(value),
    },
    {
      title: "目标路径",
      dataIndex: "objectKey",
      width: 300,
      ellipsis: true,
      render: (_, record) => record.objectKey || record.localPath || "-",
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      width: 190,
      render: (value: string) => new Date(value).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 110,
      render: (_, record) =>
        record.targetType === "local" && record.status === "success" ? (
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => onDownload(record)}
          >
            下载
          </Button>
        ) : null,
    },
  ];
}

function mergeRun(runs: AdminBackupRun[], run: AdminBackupRun) {
  const next = runs.filter((item) => item.id !== run.id);
  return [run, ...next].sort((left, right) => right.id - left.id);
}

function lastItem(values: string[]) {
  return values.length ? values[values.length - 1] : "";
}

function formatBytes(value: number) {
  if (!value) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
