import {
  AimOutlined,
  AreaChartOutlined,
  RadarChartOutlined,
} from "@ant-design/icons";
import { Tabs, Tag, Typography } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureInfo, MapViewState } from "../types";
import FeatureDetailPanel from "./FeatureDetailPanel";

const thumbnailMinIndicatorSizePx = 10;
const thumbnailTileSize = 256;
const thumbnailMaxMercatorLat = 85.05112878;
const thumbnailContextPaddingRatio = 1.85;
const thumbnailMinTileScale = 0.12;
const thumbnailMaxTileScale = 1;
const thumbnailMinZoom = 1;
const thumbnailMaxZoom = 10;
const thumbnailZoomOffset = 2;
const osmTileSubdomains = ["a", "b", "c"] as const;

export interface ThumbnailMapTile {
  center: [number, number];
  tileZoom: number;
  scale: number;
  tileUrlTemplate: string;
}

export const thumbnailMapTile: ThumbnailMapTile = {
  center: [81, 41],
  tileZoom: 5,
  scale: 0.38,
  tileUrlTemplate: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
};

interface ThumbnailTile {
  key: string;
  url: string;
  left: number;
  top: number;
  width: number;
  height: number;
}
interface ThumbnailExtentBox {
  left: number;
  top: number;
  width: number;
  height: number;
}
interface ThumbnailViewport {
  left: number;
  top: number;
  scale: number;
}
interface ThumbnailMapView {
  zoom: number;
  viewport: ThumbnailViewport;
}
const trendMonths = [
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
];
const ndviTrend = [
  0.48, 0.54, 0.52, 0.61, 0.64, 0.67, 0.65, 0.71, 0.68, 0.7, 0.69, 0.69,
];
const moistureTrend = [
  0.42, 0.47, 0.45, 0.51, 0.56, 0.57, 0.55, 0.6, 0.59, 0.61, 0.6, 0.6,
];
const overviewMetrics = [
  {
    label: "NDVI",
    value: "0.61",
    trend: [42, 48, 46, 54, 60, 62, 61],
    tone: "green",
  },
  {
    label: "风险面积",
    value: "14%",
    trend: [22, 20, 18, 19, 16, 15, 14],
    tone: "amber",
  },
  {
    label: "站点在线",
    value: "89%",
    trend: [82, 86, 84, 88, 91, 89, 89],
    tone: "cyan",
  },
] as const;
const ecologyBands = [
  { label: "优", value: 44, tone: "green" },
  { label: "良", value: 31, tone: "cyan" },
  { label: "风险", value: 17, tone: "amber" },
  { label: "异常", value: 8, tone: "red" },
] as const;
const factorScores = [
  { label: "植被覆盖", value: 86 },
  { label: "水体湿度", value: 72 },
  { label: "土壤稳定", value: 68 },
  { label: "盐渍化抑制", value: 59 },
  { label: "保护连通", value: 78 },
] as const;
const monitorStats = [
  { label: "在线站点", value: "128", hint: "+6 本周", tone: "green" },
  { label: "异常站点", value: "7", hint: "需复核", tone: "amber" },
  { label: "预警事件", value: "3", hint: "2 高风险", tone: "red" },
] as const;
const monitorEvents = [
  { time: "09:18", title: "塔里木河中段 NDVI 回升", level: "正常" },
  { time: "11:42", title: "样方 04 土壤含水率偏低", level: "关注" },
  { time: "14:05", title: "遥感产品完成月度镶嵌", level: "完成" },
] as const;
const riskMatrix = [
  [18, 34, 48, 22],
  [41, 68, 55, 29],
  [24, 52, 76, 61],
] as const;

interface Props {
  selectedFeature: FeatureInfo | null;
  currentView: MapViewState | null;
}

export default function RightSidePanel({
  selectedFeature,
  currentView,
}: Props) {
  return (
    <div className="right-panel-stack">
      <section
        className="right-map-overview-panel"
        aria-label="当前视角平面缩略图"
      >
        <FlatMapThumbnail currentView={currentView} />
      </section>

      <section
        className="right-eco-panel"
        aria-label="生态数据展示窗口（示意）"
      >
        <div className="right-panel-heading right-panel-heading-main">
          <span>
            <RadarChartOutlined style={{ fontSize: 15 }} />
            <Typography.Text strong>生态数据展示窗口（示意）</Typography.Text>
          </span>
          <Tag color={selectedFeature ? "green" : "default"}>
            {selectedFeature ? "已选要素" : "等待选取"}
          </Tag>
        </div>
        <Tabs
          className="right-side-tabs"
          size="small"
          items={[
            {
              key: "overview",
              label: (
                <span className="tab-label">
                  <AreaChartOutlined style={{ fontSize: 14 }} />
                  概览
                </span>
              ),
              children: <EcologyOverviewPanel />,
            },
            {
              key: "feature",
              label: (
                <span className="tab-label">
                  <AimOutlined style={{ fontSize: 14 }} />
                  要素
                </span>
              ),
              children: <EcologyFactorPanel feature={selectedFeature} />,
            },
            {
              key: "monitor",
              label: (
                <span className="tab-label">
                  <RadarChartOutlined style={{ fontSize: 14 }} />
                  监测
                </span>
              ),
              children: <EcologyMonitorPanel />,
            },
          ]}
        />
      </section>
    </div>
  );
}

function FlatMapThumbnail({
  currentView,
}: {
  currentView: MapViewState | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };
    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const thumbnail = useMemo(
    () =>
      buildThumbnail(currentView, containerSize.width, containerSize.height),
    [containerSize.height, containerSize.width, currentView],
  );

  return (
    <div className="right-map-mini">
      <div
        ref={containerRef}
        className="right-map-mini-canvas"
        aria-label="当前范围二维地图缩略图"
        role="img"
      >
        {thumbnail.tiles.map((tile) => (
          <img
            key={tile.key}
            className="right-map-mini-tile"
            src={tile.url}
            alt=""
            style={{
              left: tile.left,
              top: tile.top,
              width: tile.width,
              height: tile.height,
            }}
            draggable={false}
          />
        ))}
        {thumbnail.extent ? (
          <span
            className="right-map-mini-extent"
            style={{
              left: thumbnail.extent.left,
              top: thumbnail.extent.top,
              width: thumbnail.extent.width,
              height: thumbnail.extent.height,
            }}
          />
        ) : null}
      </div>
      {!currentView ? (
        <div className="right-map-mini-empty">
          <Typography.Text type="secondary">等待地图视角</Typography.Text>
        </div>
      ) : null}
    </div>
  );
}

export function buildThumbnail(
  currentView: MapViewState | null,
  width: number,
  height: number,
  mapTile: ThumbnailMapTile = thumbnailMapTile,
) {
  if (width <= 0 || height <= 0) {
    return {
      tiles: [] as ThumbnailTile[],
      extent: null as ThumbnailExtentBox | null,
    };
  }
  const overview = currentView
    ? thumbnailViewportForMapView(currentView, width, height)
    : {
        zoom: mapTile.tileZoom,
        viewport: thumbnailViewportForMapTile(mapTile, width, height),
      };
  return {
    tiles: thumbnailTiles(
      overview.zoom,
      overview.viewport,
      width,
      height,
      mapTile.tileUrlTemplate,
    ),
    extent: currentView
      ? thumbnailExtentBox(
          currentView.bounds,
          overview.zoom,
          overview.viewport,
          width,
          height,
        )
      : null,
  };
}

export function thumbnailViewportForMapTile(
  mapTile: ThumbnailMapTile,
  width: number,
  height: number,
): ThumbnailViewport {
  const center = lngLatToWorldPixel(mapTile.center, mapTile.tileZoom);
  const scale = Math.max(0.05, mapTile.scale);
  return {
    left: center.x - width / (2 * scale),
    top: center.y - height / (2 * scale),
    scale,
  };
}

export function thumbnailViewportForMapView(
  currentView: MapViewState,
  width: number,
  height: number,
): ThumbnailMapView {
  const targetZoom = clamp(
    Math.floor(currentView.zoom) - thumbnailZoomOffset,
    thumbnailMinZoom,
    thumbnailMaxZoom,
  );
  const normalizedBounds = normalizeThumbnailBounds(currentView);
  let selectedZoom = targetZoom;
  let selectedMetrics = thumbnailFitMetrics(
    normalizedBounds,
    selectedZoom,
    width,
    height,
  );

  while (
    selectedZoom > thumbnailMinZoom &&
    selectedMetrics.fitScale < thumbnailMinTileScale
  ) {
    selectedZoom -= 1;
    selectedMetrics = thumbnailFitMetrics(
      normalizedBounds,
      selectedZoom,
      width,
      height,
    );
  }

  const scale = clamp(
    selectedMetrics.fitScale,
    thumbnailMinTileScale,
    thumbnailMaxTileScale,
  );
  const center = lngLatToWorldPixel(normalizedBounds.center, selectedZoom);
  return {
    zoom: selectedZoom,
    viewport: {
      left: center.x - width / (2 * scale),
      top: center.y - height / (2 * scale),
      scale,
    },
  };
}

export function thumbnailTiles(
  zoom: number,
  viewport: ThumbnailViewport,
  width: number,
  height: number,
  tileUrlTemplate = thumbnailMapTile.tileUrlTemplate,
) {
  const tileCount = 2 ** zoom;
  const minTileX = Math.floor(viewport.left / thumbnailTileSize);
  const maxTileX = Math.floor(
    (viewport.left + width / viewport.scale) / thumbnailTileSize,
  );
  const minTileY = Math.max(0, Math.floor(viewport.top / thumbnailTileSize));
  const maxTileY = Math.min(
    tileCount - 1,
    Math.floor((viewport.top + height / viewport.scale) / thumbnailTileSize),
  );
  const displayTileSize = thumbnailTileSize * viewport.scale;
  const tiles: ThumbnailTile[] = [];
  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      const wrappedX = wrapTileX(tileX, tileCount);
      const subdomain =
        osmTileSubdomains[Math.abs(tileX + tileY) % osmTileSubdomains.length] ??
        "a";
      const rawLeft =
        (tileX * thumbnailTileSize - viewport.left) * viewport.scale;
      const rawTop =
        (tileY * thumbnailTileSize - viewport.top) * viewport.scale;
      const left = Math.floor(rawLeft);
      const top = Math.floor(rawTop);
      const right = Math.ceil(rawLeft + displayTileSize) + 1;
      const bottom = Math.ceil(rawTop + displayTileSize) + 1;
      tiles.push({
        key: `${zoom}-${tileX}-${tileY}`,
        url: tileUrlTemplate
          .replace("{s}", subdomain)
          .replace("{z}", String(zoom))
          .replace("{x}", String(wrappedX))
          .replace("{y}", String(tileY)),
        left,
        top,
        width: right - left,
        height: bottom - top,
      });
    }
  }
  return tiles;
}

export function thumbnailExtentBox(
  bounds: MapViewState["bounds"],
  zoom: number,
  viewport: ThumbnailViewport,
  canvasWidth: number,
  canvasHeight: number,
): ThumbnailExtentBox {
  const [west, south, east, north] = bounds;
  const extent = ensureMinimumThumbnailExtent(
    zoom,
    {
      west,
      east,
      south,
      north,
    },
    viewport.scale,
  );
  const northwest = lngLatToWorldPixel([extent.west, extent.north], zoom);
  const southeast = lngLatToWorldPixel([extent.east, extent.south], zoom);
  const rawBox = {
    left: Math.round((northwest.x - viewport.left) * viewport.scale),
    top: Math.round((northwest.y - viewport.top) * viewport.scale),
    width: Math.round(
      Math.max(1, (southeast.x - northwest.x) * viewport.scale),
    ),
    height: Math.round(
      Math.max(1, (southeast.y - northwest.y) * viewport.scale),
    ),
  };
  return constrainThumbnailExtentBox(rawBox, canvasWidth, canvasHeight);
}

function constrainThumbnailExtentBox(
  box: ThumbnailExtentBox,
  canvasWidth: number,
  canvasHeight: number,
): ThumbnailExtentBox {
  const right = box.left + box.width;
  const bottom = box.top + box.height;
  const visibleLeft = Math.max(0, box.left);
  const visibleTop = Math.max(0, box.top);
  const visibleRight = Math.min(canvasWidth, right);
  const visibleBottom = Math.min(canvasHeight, bottom);
  const intersects = visibleRight > visibleLeft && visibleBottom > visibleTop;

  if (intersects) {
    const centerX = (visibleLeft + visibleRight) / 2;
    const centerY = (visibleTop + visibleBottom) / 2;
    const width = Math.min(
      canvasWidth,
      Math.max(thumbnailMinIndicatorSizePx, visibleRight - visibleLeft),
    );
    const height = Math.min(
      canvasHeight,
      Math.max(thumbnailMinIndicatorSizePx, visibleBottom - visibleTop),
    );
    return {
      left: clamp(centerX - width / 2, 0, canvasWidth - width),
      top: clamp(centerY - height / 2, 0, canvasHeight - height),
      width,
      height,
    };
  }

  return {
    left: clamp(
      box.left + box.width / 2 - thumbnailMinIndicatorSizePx / 2,
      0,
      canvasWidth - thumbnailMinIndicatorSizePx,
    ),
    top: clamp(
      box.top + box.height / 2 - thumbnailMinIndicatorSizePx / 2,
      0,
      canvasHeight - thumbnailMinIndicatorSizePx,
    ),
    width: thumbnailMinIndicatorSizePx,
    height: thumbnailMinIndicatorSizePx,
  };
}

function ensureMinimumThumbnailExtent(
  zoom: number,
  extent: { west: number; east: number; south: number; north: number },
  viewportScale: number,
) {
  const centerLng = (extent.west + extent.east) / 2;
  const centerLat = (extent.south + extent.north) / 2;
  const westPoint = lngLatToWorldPixel([extent.west, centerLat], zoom);
  const eastPoint = lngLatToWorldPixel([extent.east, centerLat], zoom);
  const southPoint = lngLatToWorldPixel([centerLng, extent.south], zoom);
  const northPoint = lngLatToWorldPixel([centerLng, extent.north], zoom);
  const widthPx = Math.abs(eastPoint.x - westPoint.x);
  const heightPx = Math.abs(southPoint.y - northPoint.y);
  const minIndicatorWorldPx = thumbnailMinIndicatorSizePx / viewportScale;
  if (widthPx >= minIndicatorWorldPx && heightPx >= minIndicatorWorldPx) {
    return extent;
  }

  const centerPoint = lngLatToWorldPixel([centerLng, centerLat], zoom);
  const halfWidthPx = Math.max(widthPx, minIndicatorWorldPx) / 2;
  const halfHeightPx = Math.max(heightPx, minIndicatorWorldPx) / 2;
  const southwest = worldPixelToLngLat(
    centerPoint.x - halfWidthPx,
    centerPoint.y + halfHeightPx,
    zoom,
  );
  const northeast = worldPixelToLngLat(
    centerPoint.x + halfWidthPx,
    centerPoint.y - halfHeightPx,
    zoom,
  );
  return {
    west: Math.max(-180, southwest[0]),
    east: Math.min(180, northeast[0]),
    south: Math.max(-85, southwest[1]),
    north: Math.min(85, northeast[1]),
  };
}

function normalizeThumbnailBounds(currentView: MapViewState) {
  const [rawWest, rawSouth, rawEast, rawNorth] = currentView.bounds;
  const west = clamp(rawWest, -180, 180);
  const east = clamp(rawEast, -180, 180);
  const south = clamp(
    rawSouth,
    -thumbnailMaxMercatorLat,
    thumbnailMaxMercatorLat,
  );
  const north = clamp(
    rawNorth,
    -thumbnailMaxMercatorLat,
    thumbnailMaxMercatorLat,
  );
  const center: [number, number] = [
    clamp(currentView.center[0], -180, 180),
    clamp(
      currentView.center[1],
      -thumbnailMaxMercatorLat,
      thumbnailMaxMercatorLat,
    ),
  ];

  return {
    west: Math.min(west, east),
    east: Math.max(west, east),
    south: Math.min(south, north),
    north: Math.max(south, north),
    center,
  };
}

function thumbnailFitMetrics(
  bounds: ReturnType<typeof normalizeThumbnailBounds>,
  zoom: number,
  width: number,
  height: number,
) {
  const westPoint = lngLatToWorldPixel([bounds.west, bounds.center[1]], zoom);
  const eastPoint = lngLatToWorldPixel([bounds.east, bounds.center[1]], zoom);
  const southPoint = lngLatToWorldPixel([bounds.center[0], bounds.south], zoom);
  const northPoint = lngLatToWorldPixel([bounds.center[0], bounds.north], zoom);
  const boundsWidth = Math.max(1, Math.abs(eastPoint.x - westPoint.x));
  const boundsHeight = Math.max(1, Math.abs(southPoint.y - northPoint.y));
  return {
    fitScale: Math.min(
      width / (boundsWidth * thumbnailContextPaddingRatio),
      height / (boundsHeight * thumbnailContextPaddingRatio),
    ),
  };
}

function lngLatToWorldPixel([lng, lat]: [number, number], zoom: number) {
  const worldSize = thumbnailTileSize * 2 ** zoom;
  const clampedLat = Math.max(
    -thumbnailMaxMercatorLat,
    Math.min(thumbnailMaxMercatorLat, lat),
  );
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * worldSize,
    y:
      (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldSize,
  };
}

function worldPixelToLngLat(
  x: number,
  y: number,
  zoom: number,
): [number, number] {
  const worldSize = thumbnailTileSize * 2 ** zoom;
  const lng = (x / worldSize) * 360 - 180;
  const mercatorY = Math.PI * (1 - (2 * y) / worldSize);
  const lat = (Math.atan(Math.sinh(mercatorY)) * 180) / Math.PI;
  return [lng, lat];
}

function wrapTileX(tileX: number, tileCount: number) {
  return ((tileX % tileCount) + tileCount) % tileCount;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function EcologyOverviewPanel() {
  return (
    <div className="eco-tab-panel eco-overview-panel">
      <div className="eco-status-card">
        <div className="eco-gauge">
          <div className="eco-gauge-core">
            <strong>82</strong>
            <span>生态指数</span>
          </div>
        </div>
        <div className="eco-metrics">
          {overviewMetrics.map((metric) => (
            <span
              className={`eco-metric-card eco-tone-${metric.tone}`}
              key={metric.label}
            >
              <strong>{metric.value}</strong>
              {metric.label}
              <Sparkline values={metric.trend} />
            </span>
          ))}
        </div>
      </div>
      <div className="eco-trend-card">
        <div className="right-panel-heading">
          <Typography.Text strong>NDVI / 水分趋势</Typography.Text>
          <Typography.Text type="secondary">近 12 月</Typography.Text>
        </div>
        <TrendChart />
        <div className="eco-chart-legend">
          <span className="eco-legend-ndvi">NDVI</span>
          <span className="eco-legend-water">水分指数</span>
          <span>峰值 0.71</span>
        </div>
      </div>
      <div className="eco-distribution-card">
        <div className="right-panel-heading">
          <Typography.Text strong>生态状态分布</Typography.Text>
          <Typography.Text type="secondary">示意占比</Typography.Text>
        </div>
        <div className="eco-band-bar">
          {ecologyBands.map((band) => (
            <i
              className={`eco-tone-${band.tone}`}
              key={band.label}
              style={{ width: `${band.value}%` }}
            />
          ))}
        </div>
        <div className="eco-band-labels">
          {ecologyBands.map((band) => (
            <span key={band.label}>
              <b>{band.value}%</b>
              {band.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function EcologyFactorPanel({ feature }: { feature: FeatureInfo | null }) {
  return (
    <div className="eco-tab-panel eco-factor-panel">
      <div className="eco-factor-card">
        <div className="right-panel-heading">
          <Typography.Text strong>生态要素画像</Typography.Text>
          <Typography.Text type="secondary">综合评分</Typography.Text>
        </div>
        <div className="eco-factor-layout">
          <RadarProfile />
          <div className="eco-factor-bars">
            {factorScores.map((item) => (
              <div className="eco-factor-row" key={item.label}>
                <span>{item.label}</span>
                <div className="eco-factor-track">
                  <i style={{ width: `${item.value}%` }} />
                </div>
                <b>{item.value}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="eco-rose-card" aria-label="生态要素结构示意">
        {factorScores.map((item, index) => (
          <span className="eco-rose-petal" key={item.label}>
            <i style={{ height: `${Math.max(34, item.value)}%` }} />
            <small>{item.label.slice(0, 2)}</small>
            <b>{index + 1}</b>
          </span>
        ))}
      </div>
      <div className="eco-feature-detail-shell">
        <FeatureDetailPanel feature={feature} />
      </div>
    </div>
  );
}

function EcologyMonitorPanel() {
  return (
    <div className="eco-tab-panel eco-monitor-panel">
      <div className="monitor-grid">
        {monitorStats.map((item) => (
          <span className={`eco-tone-${item.tone}`} key={item.label}>
            <strong>{item.value}</strong>
            <small>{item.label}</small>
            <em>{item.hint}</em>
          </span>
        ))}
      </div>
      <div className="eco-risk-card">
        <div className="right-panel-heading">
          <Typography.Text strong>区域风险热力</Typography.Text>
          <Typography.Text type="secondary">近 24 小时</Typography.Text>
        </div>
        <div className="eco-risk-matrix" aria-label="风险热力矩阵示意">
          {riskMatrix.flatMap((row, rowIndex) =>
            row.map((value, columnIndex) => (
              <i
                key={`${rowIndex}-${columnIndex}`}
                style={{ opacity: 0.34 + value / 120 }}
                title={`风险值 ${value}`}
              />
            )),
          )}
        </div>
      </div>
      <div className="monitor-placeholder">
        <div className="right-panel-heading">
          <Typography.Text strong>监测事件</Typography.Text>
          <Tag color="processing">模拟实时</Tag>
        </div>
        <div className="eco-timeline">
          {monitorEvents.map((event) => (
            <div className="eco-timeline-item" key={event.time}>
              <time>{event.time}</time>
              <span>
                <strong>{event.title}</strong>
                <small>{event.level}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: readonly number[] }) {
  return (
    <svg className="eco-sparkline" viewBox="0 0 72 24" aria-hidden="true">
      <polyline points={formatPoints(values, 72, 24)} />
    </svg>
  );
}

function TrendChart() {
  const ndviPoints = formatPoints(ndviTrend, 300, 110, 0.36, 0.74);
  const moisturePoints = formatPoints(moistureTrend, 300, 110, 0.36, 0.74);
  const areaPoints = `0,110 ${ndviPoints} 300,110`;
  return (
    <svg
      className="eco-trend-svg"
      viewBox="0 0 300 132"
      role="img"
      aria-label="NDVI 与水分指数趋势示意图"
    >
      <defs>
        <linearGradient id="ecoTrendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#20d6b0" stopOpacity=".36" />
          <stop offset="100%" stopColor="#20d6b0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="eco-chart-grid">
        <path d="M0 22 H300" />
        <path d="M0 54 H300" />
        <path d="M0 86 H300" />
      </g>
      <polygon className="eco-trend-area" points={areaPoints} />
      <polyline
        className="eco-trend-line eco-trend-line-ndvi"
        points={ndviPoints}
      />
      <polyline
        className="eco-trend-line eco-trend-line-water"
        points={moisturePoints}
      />
      {ndviTrend.map((value, index) => {
        const point = formatPoint(
          value,
          index,
          ndviTrend.length,
          300,
          110,
          0.36,
          0.74,
        );
        return (
          <circle
            className="eco-trend-dot"
            cx={point.x}
            cy={point.y}
            key={index}
            r={index === 7 ? 4 : 2.5}
          />
        );
      })}
      <g className="eco-chart-months">
        {trendMonths.map((month, index) => (
          <text
            key={month}
            x={(index / (trendMonths.length - 1)) * 300}
            y="128"
          >
            {month}
          </text>
        ))}
      </g>
    </svg>
  );
}

function RadarProfile() {
  const points = factorScores.map((item, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / factorScores.length;
    const radius = (item.value / 100) * 52;
    return `${70 + Math.cos(angle) * radius},${62 + Math.sin(angle) * radius}`;
  });
  const outer = factorScores.map((_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / factorScores.length;
    return `${70 + Math.cos(angle) * 52},${62 + Math.sin(angle) * 52}`;
  });
  return (
    <svg
      className="eco-radar-svg"
      viewBox="0 0 140 124"
      role="img"
      aria-label="生态要素雷达图"
    >
      <polygon className="eco-radar-grid" points={outer.join(" ")} />
      <polygon
        className="eco-radar-grid eco-radar-grid-inner"
        points={scalePolygon(outer, 70, 62, 0.58)}
      />
      {outer.map((point) => (
        <line
          className="eco-radar-axis"
          key={point}
          x1="70"
          y1="62"
          x2={point.split(",")[0]}
          y2={point.split(",")[1]}
        />
      ))}
      <polygon className="eco-radar-shape" points={points.join(" ")} />
      {points.map((point) => (
        <circle
          className="eco-radar-dot"
          key={point}
          cx={point.split(",")[0]}
          cy={point.split(",")[1]}
          r="3"
        />
      ))}
    </svg>
  );
}

function formatPoints(
  values: readonly number[],
  width: number,
  height: number,
  fixedMin?: number,
  fixedMax?: number,
) {
  return values
    .map((value, index) => {
      const point = formatPoint(
        value,
        index,
        values.length,
        width,
        height,
        fixedMin,
        fixedMax,
      );
      return `${point.x},${point.y}`;
    })
    .join(" ");
}

function formatPoint(
  value: number,
  index: number,
  length: number,
  width: number,
  height: number,
  fixedMin?: number,
  fixedMax?: number,
) {
  const min = fixedMin ?? Math.min(value, 0);
  const max = fixedMax ?? Math.max(value, 100);
  const range = Math.max(max - min, 1);
  return {
    x: (index / Math.max(length - 1, 1)) * width,
    y: height - ((value - min) / range) * (height - 12) - 6,
  };
}

function scalePolygon(
  points: string[],
  centerX: number,
  centerY: number,
  scale: number,
) {
  return points
    .map((point) => {
      const coordinates = point.split(",").map(Number);
      const x = coordinates[0];
      const y = coordinates[1];
      if (
        x === undefined ||
        y === undefined ||
        Number.isNaN(x) ||
        Number.isNaN(y)
      ) {
        return `${centerX},${centerY}`;
      }
      return `${centerX + (x - centerX) * scale},${centerY + (y - centerY) * scale}`;
    })
    .join(" ");
}
