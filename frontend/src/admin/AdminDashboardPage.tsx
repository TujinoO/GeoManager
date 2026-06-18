import {
  BarChartOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  HddOutlined,
} from "@ant-design/icons";
import { ProCard } from "@ant-design/pro-components";
import {
  App,
  BorderBeam,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { oceanBorderBeam } from "../components/oceanBorderBeam";
import { useAppContext } from "../contexts/AppContext";
import type { AdminDashboard, AdminDashboardServer } from "../types";
import { UserSummaryCards } from "./UserSummaryCards";

const serverRefreshMs = 5000;
type ActivePeriod = "day" | "week" | "month";

const periodLabels: Record<ActivePeriod, string> = {
  day: "今日",
  week: "本周",
  month: "本月",
};

type DataOverviewCard = NonNullable<AdminDashboard["cards"]["dataOverview"]>;

const dataTypeLabels: Record<string, string> = {
  vector: "矢量",
  raster: "栅格",
  gene: "基因",
  table: "表格",
  document: "文档",
  image: "图片",
};

interface AdminDashboardPageProps {
  scope?: "all" | "data" | "operations";
}

export default function AdminDashboardPage({
  scope = "all",
}: AdminDashboardPageProps) {
  const { message } = App.useApp();
  const { user } = useAppContext();
  const [period, setPeriod] = useState<ActivePeriod>("day");
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [server, setServer] = useState<AdminDashboardServer | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [serverLoading, setServerLoading] = useState(true);
  const showDataCards = scope === "all" || scope === "data";
  const showOperationCards = scope === "all" || scope === "operations";
  const canViewServerCards = Boolean(
    showOperationCards && user?.permissions.canViewDashboardSystemCard,
  );

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    try {
      setDashboard(await api.adminDashboard(period));
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "Dashboard 加载失败",
      );
    } finally {
      setDashboardLoading(false);
    }
  }, [message, period]);

  const loadServer = useCallback(async () => {
    if (!canViewServerCards) {
      setServer(null);
      setServerLoading(false);
      return;
    }
    try {
      setServer(await api.adminDashboardServer());
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "服务器监控加载失败",
      );
    } finally {
      setServerLoading(false);
    }
  }, [canViewServerCards, message]);

  useEffect(() => {
    loadDashboard();
    loadServer();
  }, [loadDashboard, loadServer]);

  useEffect(() => {
    if (!canViewServerCards) {
      return;
    }
    const timer = window.setInterval(loadServer, serverRefreshMs);
    return () => window.clearInterval(timer);
  }, [canViewServerCards, loadServer]);

  const activeChartData = useMemo(() => {
    return (dashboard?.cards.activeUsers?.series ?? []).map((item) => ({
      label: item.label,
      count: item.count,
    }));
  }, [dashboard]);
  const hasMetricCards = Boolean(
    showDataCards &&
    (dashboard?.cards.resources ||
      dashboard?.cards.layers ||
      dashboard?.cards.rasters ||
      dashboard?.cards.dataOverview),
  );
  const hasServerCards = Boolean(
    server?.cards.cpu || server?.cards.memory || server?.cards.disks,
  );
  const hasDashboardCards =
    hasMetricCards ||
    Boolean(
      showOperationCards &&
      (dashboard?.cards.users || dashboard?.cards.activeUsers),
    );
  const hasAnyAuthorizedCard = hasDashboardCards || canViewServerCards;

  if (dashboardLoading || !dashboard) {
    return (
      <div className="admin-page-stack">
        <ProCard className="admin-section-card">
          <Skeleton active paragraph={{ rows: 8 }} />
        </ProCard>
      </div>
    );
  }

  return (
    <div className="admin-dashboard admin-page-stack">
      {!hasAnyAuthorizedCard && (
        <ProCard className="admin-section-card">
          <Empty
            description={
              scope === "data"
                ? "当前账号暂无可查看的数据 Dashboard 卡片"
                : "当前账号暂无可查看的 Dashboard 卡片"
            }
          />
        </ProCard>
      )}

      {hasMetricCards && (
        <section className="admin-dashboard-section">
          <div className="admin-dashboard-section-heading">
            <Typography.Title level={4}>数据概览</Typography.Title>
          </div>
          <Row gutter={[16, 16]}>
            {dashboard.cards.resources && (
              <MetricCard
                title="数据资源"
                value={dashboard.cards.resources.total}
                suffix="项"
                icon={<DatabaseOutlined />}
                description={`启用 ${dashboard.cards.resources.active} 项`}
              />
            )}
            {dashboard.cards.layers && (
              <MetricCard
                title="图层数"
                value={dashboard.cards.layers.total}
                suffix="个"
                icon={<ClusterOutlined />}
                description={`启用 ${dashboard.cards.layers.active} 个`}
              />
            )}
            {dashboard.cards.rasters && (
              <MetricCard
                title="栅格数量"
                value={dashboard.cards.rasters.resources}
                suffix="项"
                icon={<HddOutlined />}
                description={`栅格数据集 ${dashboard.cards.rasters.datasets} 个，栅格图层 ${dashboard.cards.rasters.layers} 个`}
              />
            )}
            {dashboard.cards.dataOverview && (
              <>
                <MetricCard
                  title="数据总大小"
                  value={formatBytes(
                    dashboard.cards.dataOverview.totalSizeBytes,
                  )}
                  suffix=""
                  icon={<HddOutlined />}
                  description={`启用 ${dashboard.cards.dataOverview.activeResources} / ${dashboard.cards.dataOverview.totalResources} 项`}
                />
                <MetricCard
                  title="数据条目数"
                  value={dashboard.cards.dataOverview.totalItemCount}
                  suffix="条"
                  icon={<DatabaseOutlined />}
                  description="按导入行数、栅格数据集和扫描文件统计"
                />
              </>
            )}
          </Row>
          {dashboard.cards.dataOverview && (
            <DataOverviewDetail overview={dashboard.cards.dataOverview} />
          )}
        </section>
      )}

      {showOperationCards && dashboard.cards.users && (
        <section className="admin-dashboard-section">
          <div className="admin-dashboard-section-heading">
            <Typography.Title level={4}>用户信息</Typography.Title>
            <Typography.Text type="secondary">
              当前系统共 {dashboard.cards.users.total} 个账号
            </Typography.Text>
          </div>
          <UserSummaryCards
            metrics={{
              active: dashboard.cards.users.active,
              disabled: dashboard.cards.users.disabled,
              groups: dashboard.cards.users.groups,
            }}
          />
        </section>
      )}

      {showOperationCards && dashboard.cards.activeUsers && (
        <section className="admin-dashboard-section">
          <BorderBeam color={oceanBorderBeam}>
            <Card
              className="admin-active-card admin-dashboard-card"
              variant="borderless"
              styles={{ body: { padding: 0 } }}
            >
              <div className="admin-active-tabs">
                <div className="admin-active-tab-current">活跃用户</div>
                <div className="admin-active-actions">
                  {(["day", "week", "month"] as ActivePeriod[]).map((item) => (
                    <Button
                      type="text"
                      className={period === item ? "active" : ""}
                      key={item}
                      onClick={() => setPeriod(item)}
                    >
                      {periodLabels[item]}
                    </Button>
                  ))}
                  <Tag color="green">
                    {dashboard.cards.activeUsers.rangeStart} 至{" "}
                    {dashboard.cards.activeUsers.rangeEnd}
                  </Tag>
                </div>
              </div>
              <Row
                className="admin-active-body"
                gutter={[24, 16]}
                align="stretch"
              >
                <Col xs={24} xl={16}>
                  <div className="admin-active-chart-heading">
                    <Space size={18} wrap>
                      <Statistic
                        title={`${periodLabels[period]}活跃用户`}
                        value={dashboard.cards.activeUsers.count}
                        suffix="人"
                      />
                      <Statistic
                        title="登录次数"
                        value={dashboard.cards.activeUsers.loginCount}
                        suffix="次"
                      />
                    </Space>
                  </div>
                  <div className="admin-active-chart">
                    <ActiveUsersChart data={activeChartData} />
                  </div>
                </Col>
                <Col xs={24} xl={8}>
                  <div className="admin-active-rank">
                    <Typography.Title level={4}>活跃用户排名</Typography.Title>
                    <ul>
                      {dashboard.cards.activeUsers.ranking.map(
                        (item, index) => (
                          <li key={item.userId}>
                            <span
                              className={
                                index < 3
                                  ? "admin-rank-number active"
                                  : "admin-rank-number"
                              }
                            >
                              {index + 1}
                            </span>
                            <span
                              className="admin-rank-title"
                              title={item.username}
                            >
                              {item.displayName}
                            </span>
                            <span>{item.loginCount}</span>
                          </li>
                        ),
                      )}
                    </ul>
                    {dashboard.cards.activeUsers.ranking.length === 0 && (
                      <Typography.Text type="secondary">
                        当前周期暂无登录记录
                      </Typography.Text>
                    )}
                  </div>
                </Col>
              </Row>
            </Card>
          </BorderBeam>
        </section>
      )}

      {canViewServerCards && (serverLoading || !server || hasServerCards) && (
        <section className="admin-dashboard-section">
          <div className="admin-dashboard-section-heading">
            <Typography.Title level={4}>服务器信息</Typography.Title>
            <Typography.Text type="secondary">
              每 5 秒自动刷新
              {server ? ` · ${formatDateTime(server.generatedAt)}` : ""}
            </Typography.Text>
          </div>
          {serverLoading || !server ? (
            <ProCard className="admin-section-card">
              <Skeleton active paragraph={{ rows: 5 }} />
            </ProCard>
          ) : (
            <Row gutter={[16, 16]}>
              {server.cards.cpu && (
                <ServerCard
                  title="CPU"
                  model={server.cards.cpu.model}
                  usage={server.cards.cpu.usagePercent}
                  lines={[
                    `物理核心 ${server.cards.cpu.physicalCount}，逻辑核心 ${server.cards.cpu.logicalCount}`,
                    `负载 ${server.cards.cpu.loadAverage.join(" / ")}`,
                  ]}
                  icon={<BarChartOutlined />}
                />
              )}
              {server.cards.memory && (
                <ServerCard
                  title="内存"
                  model={server.cards.memory.model}
                  usage={server.cards.memory.usagePercent}
                  lines={[
                    `数量 ${server.cards.memory.slotCount}`,
                    `${formatBytes(server.cards.memory.usedBytes)} / ${formatBytes(
                      server.cards.memory.totalBytes,
                    )}`,
                  ]}
                  icon={<DatabaseOutlined />}
                />
              )}
              {server.cards.disks && (
                <ServerCard
                  title="硬盘"
                  model={diskModelText(server)}
                  usage={server.cards.disks.usagePercent}
                  lines={[
                    `数量 ${server.cards.disks.count}`,
                    `${formatBytes(server.cards.disks.usedBytes)} / ${formatBytes(
                      server.cards.disks.totalBytes,
                    )}`,
                  ]}
                  icon={<HddOutlined />}
                />
              )}
            </Row>
          )}
        </section>
      )}
    </div>
  );
}

function ActiveUsersChart({
  data,
}: {
  data: { label: string; count: number }[];
}) {
  const maxCount = Math.max(...data.map((item) => item.count), 0);
  if (data.length === 0) {
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
    );
  }
  return (
    <div
      className="admin-active-lite-chart"
      role="list"
      aria-label="活跃用户柱状图"
    >
      {data.map((item) => {
        const ratio = maxCount > 0 ? item.count / maxCount : 0;
        return (
          <div
            className="admin-active-lite-bar"
            role="listitem"
            key={item.label}
            title={`${item.label}：${item.count} 次`}
          >
            <div className="admin-active-lite-bar-track">
              <div
                className="admin-active-lite-bar-fill"
                style={{
                  height: `${Math.max(ratio * 100, item.count ? 6 : 0)}%`,
                }}
              />
            </div>
            <div className="admin-active-lite-bar-value">{item.count}</div>
            <div className="admin-active-lite-bar-label">{item.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function MetricCard({
  title,
  value,
  suffix,
  icon,
  description,
}: {
  title: string;
  value: number | string;
  suffix: string;
  icon: ReactNode;
  description: string;
}) {
  return (
    <Col xs={24} sm={12} xl={8}>
      <BorderBeam color={oceanBorderBeam}>
        <Card className="admin-dashboard-metric" variant="borderless">
          <div className="admin-dashboard-metric-icon">{icon}</div>
          <Statistic title={title} value={value} suffix={suffix} />
          <Typography.Text type="secondary">{description}</Typography.Text>
        </Card>
      </BorderBeam>
    </Col>
  );
}

function DataOverviewDetail({ overview }: { overview: DataOverviewCard }) {
  return (
    <BorderBeam color={oceanBorderBeam}>
      <Card
        className="admin-dashboard-card admin-data-overview-detail"
        variant="borderless"
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={overview.uploaders?.length ? 12 : 24}>
            <Typography.Title level={5}>数据类型分布</Typography.Title>
            <div className="admin-data-overview-list">
              {overview.typeBreakdown.map((item) => (
                <div key={item.dataType} className="admin-data-overview-row">
                  <Space>
                    <Tag>{dataTypeLabels[item.dataType] ?? item.dataType}</Tag>
                    <Typography.Text>{item.count} 项</Typography.Text>
                  </Space>
                  <Typography.Text type="secondary">
                    {formatBytes(item.sizeBytes)} / {item.itemCount} 条
                  </Typography.Text>
                </div>
              ))}
            </div>
          </Col>
          {overview.uploaders && overview.uploaders.length > 0 && (
            <Col xs={24} xl={12}>
              <Typography.Title level={5}>上传用户统计</Typography.Title>
              <div className="admin-data-overview-list">
                {overview.uploaders.map((item) => (
                  <div
                    key={`${item.user.id}-${item.user.username}`}
                    className="admin-data-overview-row"
                  >
                    <Space orientation="vertical" size={0}>
                      <Typography.Text strong>
                        {item.user.displayName}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        {item.user.username || "未记录"}
                      </Typography.Text>
                    </Space>
                    <Typography.Text type="secondary">
                      {item.resourceCount} 项 / {formatBytes(item.sizeBytes)} /{" "}
                      {item.itemCount} 条
                    </Typography.Text>
                  </div>
                ))}
              </div>
            </Col>
          )}
        </Row>
      </Card>
    </BorderBeam>
  );
}

function ServerCard({
  title,
  model,
  usage,
  lines,
  icon,
}: {
  title: string;
  model: string;
  usage: number;
  lines: string[];
  icon: ReactNode;
}) {
  return (
    <Col xs={24} lg={8}>
      <BorderBeam color={oceanBorderBeam}>
        <Card className="admin-dashboard-card" variant="borderless">
          <div className="admin-server-card-heading">
            <Space>
              <span className="admin-dashboard-metric-icon">{icon}</span>
              <Typography.Text strong>{title}</Typography.Text>
            </Space>
            <Tag
              color={usage >= 90 ? "error" : usage >= 75 ? "warning" : "green"}
            >
              {usage}%
            </Tag>
          </div>
          <Typography.Paragraph className="admin-server-model">
            {model || "未识别型号"}
          </Typography.Paragraph>
          <Progress
            percent={usage}
            status={usage >= 90 ? "exception" : "normal"}
            strokeColor={usage >= 75 ? "#d48806" : "#2f7d62"}
          />
          <div className="admin-server-lines">
            {lines.map((line) => (
              <Typography.Text type="secondary" key={line}>
                {line}
              </Typography.Text>
            ))}
          </div>
        </Card>
      </BorderBeam>
    </Col>
  );
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function diskModelText(server: AdminDashboardServer) {
  const disks = server.cards.disks;
  if (!disks) {
    return "";
  }
  const models = disks.devices
    .map((device) => device.model || device.name)
    .filter(Boolean);
  return models.length > 0 ? models.join("、") : disks.mount;
}
