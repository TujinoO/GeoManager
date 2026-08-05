import {
  CheckCircleFilled,
  CloudServerOutlined,
  DisconnectOutlined,
  LoadingOutlined,
  ReloadOutlined,
  WarningFilled,
  WifiOutlined,
} from "@ant-design/icons";
import { Button, Popover } from "antd";
import type { Map as MapboxMap } from "mapbox-gl";
import { useEffect, useState } from "react";
import {
  useBasemapStatus,
  type BasemapRetryProbe,
} from "../hooks/useBasemapStatus";
import {
  basemapSlowThresholdMsFor,
  classifyBasemapStatus,
  isBrowserConnectionSlow,
  visibleTiandituFailure,
  type ActiveBasemapDescriptor,
  type RecentTiandituFailureDiagnostics,
  type BasemapStatusPresentation,
} from "../map/basemapStatus";

export interface BasemapStatusIndicatorProps {
  map: MapboxMap | null;
  activeBasemap?: ActiveBasemapDescriptor | null;
  activeBasemapName?: string;
  retryBasemap?: BasemapRetryProbe;
}

export default function BasemapStatusIndicator({
  map,
  activeBasemap,
  activeBasemapName,
  retryBasemap,
}: BasemapStatusIndicatorProps) {
  const { diagnostics, refresh } = useBasemapStatus(map, {
    activeBasemap,
    retryBasemap,
  });
  const [, setClock] = useState(0);
  const now = Date.now();
  const recentTiandituFailure = visibleTiandituFailure(diagnostics, now);
  const hasExpiringTiandituFailure =
    recentTiandituFailure?.details.failureWindow?.tripped === false;

  useEffect(() => {
    if (diagnostics.basemap !== "loading" && !hasExpiringTiandituFailure)
      return;
    const intervalId = window.setInterval(
      () => setClock((current) => current + 1),
      1_000,
    );
    return () => window.clearInterval(intervalId);
  }, [diagnostics.basemap, hasExpiringTiandituFailure]);

  const presentation = classifyBasemapStatus(
    diagnostics,
    now,
    basemapSlowThresholdMsFor(activeBasemap),
  );
  const latency = primaryLatency(
    presentation,
    diagnostics,
    activeBasemap?.provider,
  );
  const content = (
    <div className="basemap-status-details">
      <div className="basemap-status-details-heading">
        <strong>网络与底图状态</strong>
        <span
          className={`basemap-status-badge basemap-status-${presentation.tone}`}
        >
          {presentation.label}
        </span>
      </div>
      <p className="basemap-status-summary">{presentation.summary}</p>
      <dl className="basemap-status-list">
        <StatusRow
          icon={<WifiOutlined />}
          label="浏览器网络"
          value={networkDetail(diagnostics.network)}
        />
        <StatusRow
          icon={<CloudServerOutlined />}
          label="平台接口"
          value={platformDetail(diagnostics)}
        />
        <StatusRow
          icon={<StatusIcon presentation={presentation} />}
          label="底图服务"
          value={formatBasemapServiceDetail(
            activeBasemapName,
            basemapDetail(diagnostics, now, activeBasemap?.provider),
          )}
        />
      </dl>
      <div className="basemap-status-actions">
        <Button
          size="small"
          icon={<ReloadOutlined />}
          loading={diagnostics.platformChecking}
          onClick={refresh}
        >
          重新检测
        </Button>
        <span>浏览器端实时判断，仅用于快速排查</span>
      </div>
    </div>
  );

  return (
    <Popover content={content} placement="topLeft" trigger="click">
      <button
        type="button"
        className={`basemap-status-trigger basemap-status-${presentation.tone}`}
        aria-label={`底图服务状态：${presentation.label}`}
        aria-live="polite"
      >
        <StatusIcon presentation={presentation} />
        <span className="basemap-status-label">{presentation.label}</span>
        {latency !== null ? (
          <span className="basemap-status-latency">{latency} ms</span>
        ) : null}
      </button>
    </Popover>
  );
}

export function formatBasemapServiceDetail(
  activeBasemapName: string | null | undefined,
  detail: string,
) {
  const normalizedName = activeBasemapName?.trim();
  return normalizedName ? `${normalizedName} · ${detail}` : detail;
}

function StatusRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="basemap-status-row">
      <dt>
        {icon}
        <span>{label}</span>
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

function StatusIcon({
  presentation,
}: {
  presentation: BasemapStatusPresentation;
}) {
  if (presentation.kind === "checking") return <LoadingOutlined spin />;
  if (presentation.kind === "healthy") return <CheckCircleFilled />;
  if (presentation.kind === "network" && presentation.tone === "error") {
    return <DisconnectOutlined />;
  }
  return <WarningFilled />;
}

function networkDetail(
  network: ReturnType<typeof useBasemapStatus>["diagnostics"]["network"],
) {
  if (!network.online) return "已断开";
  const parts = [isBrowserConnectionSlow(network) ? "连接较慢" : "已连接"];
  if (network.effectiveType) parts.push(network.effectiveType.toUpperCase());
  if (network.rttMs !== null) parts.push(`RTT ${network.rttMs} ms`);
  return parts.join(" · ");
}

function platformDetail(
  diagnostics: ReturnType<typeof useBasemapStatus>["diagnostics"],
) {
  if (diagnostics.platform === "checking") return "检测中";
  if (diagnostics.platform === "unreachable") return "未响应";
  return diagnostics.platformLatencyMs === null
    ? "可访问"
    : `可访问 · ${diagnostics.platformLatencyMs} ms`;
}

export function basemapDetail(
  diagnostics: ReturnType<typeof useBasemapStatus>["diagnostics"],
  now = Date.now(),
  provider?: ActiveBasemapDescriptor["provider"],
) {
  const failure = visibleTiandituFailure(diagnostics, now);
  const failureDetail = failure
    ? formatTiandituFailureDiagnostic(failure)
    : null;
  if (
    diagnostics.basemap === "failed" ||
    diagnostics.recentBasemapFailures > 0
  ) {
    return failureDetail
      ? `加载失败 · ${failureDetail}`
      : `加载失败 · 最近 ${diagnostics.recentBasemapFailures} 次`;
  }
  if (
    failureDetail &&
    failure?.details.failureKind === "transient" &&
    failure.details.failureWindow?.tripped === false
  ) {
    return `局部波动 · ${failureDetail}`;
  }
  if (failureDetail) return `服务异常 · ${failureDetail}`;
  if (diagnostics.basemap === "loading") return "正在加载当前视野";
  if (diagnostics.basemap === "unknown") return "等待地图初始化";
  return diagnostics.basemapLatencyMs === null
    ? "可访问"
    : provider === "tianditu"
      ? `可访问 · 近期瓦片就绪（含客户端排队）${diagnostics.basemapLatencyMs} ms`
      : `可访问 · 最近响应 ${diagnostics.basemapLatencyMs} ms`;
}

export function formatTiandituFailureDiagnostic(
  failure: RecentTiandituFailureDiagnostics,
) {
  const { details } = failure;
  const parts = [tiandituFailureKindLabel(details.failureKind)];
  const window = details.failureWindow;
  if (window && window.sampleCount > 0) {
    const percentage = Math.round(
      Math.max(0, Math.min(1, window.failureRate)) * 100,
    );
    parts.push(
      `瓦片失败 ${window.failureCount}/${window.sampleCount}（${percentage}%）`,
    );
  }
  if (details.businessCode) parts.push(`业务码 ${details.businessCode}`);
  if (details.layer) {
    parts.push(details.layer === "vec" ? "矢量层" : "注记层");
  }
  if (details.node) parts.push(details.node);
  return parts.join(" · ");
}

function tiandituFailureKindLabel(
  kind: RecentTiandituFailureDiagnostics["details"]["failureKind"],
) {
  if (kind === "credentials") return "凭证异常";
  if (kind === "rate-limit") return "请求限流";
  if (kind === "permanent") return "永久错误";
  return "瞬时错误";
}

export function primaryLatency(
  presentation: BasemapStatusPresentation,
  diagnostics: ReturnType<typeof useBasemapStatus>["diagnostics"],
  provider?: ActiveBasemapDescriptor["provider"],
) {
  if (presentation.tone === "error" || presentation.label === "底图局部波动") {
    return null;
  }
  if (presentation.kind === "platform") {
    return diagnostics.platformLatencyMs;
  }
  if (presentation.kind === "network" && diagnostics.network.rttMs !== null) {
    return diagnostics.network.rttMs;
  }
  if (provider === "tianditu" && presentation.kind === "healthy") return null;
  return diagnostics.basemapLatencyMs;
}
