import {
  AimOutlined,
  AreaChartOutlined,
  RadarChartOutlined,
} from "@ant-design/icons";
import { Tabs, Tag, Typography } from "antd";
import mapboxgl, {
  type GeoJSONSource,
  type Map as MapboxMap,
  type MapboxOptions,
} from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import {
  applyChineseBasemapLanguage,
  mapLabelLanguage,
  osmChineseVectorStyle,
} from "../map/basemapStyle";
import type { FeatureInfo, MapViewState } from "../types";
import FeatureDetailPanel from "./FeatureDetailPanel";

const thumbnailZoomOffset = 4;
const thumbnailMinZoom = 0;
const thumbnailMaxZoom = 17;
const thumbnailExtentSourceId = "thumbnail-current-view-extent";
const thumbnailExtentLayerId = "thumbnail-current-view-extent-line";

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
        <div className="right-panel-heading">
          <span>
            <AimOutlined style={{ fontSize: 15 }} />
            <Typography.Text strong>当前视角平面缩略图</Typography.Text>
          </span>
          <Tag color={currentView ? "cyan" : "default"}>
            {currentView ? "范围同步" : "同步中"}
          </Tag>
        </div>
        <FlatMapThumbnail currentView={currentView} />
      </section>

      <section className="right-eco-panel" aria-label="生态数据展示窗口">
        <div className="right-panel-heading right-panel-heading-main">
          <span>
            <RadarChartOutlined style={{ fontSize: 15 }} />
            <Typography.Text strong>生态数据展示窗口</Typography.Text>
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
              children: <FeatureDetailPanel feature={selectedFeature} />,
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
  const mapRef = useRef<MapboxMap | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!currentView || !container || mapRef.current || mapUnavailable) {
      return;
    }
    const mapOptions: MapboxOptions = {
      container,
      style: osmChineseVectorStyle,
      center: currentView.center,
      zoom: zoomForThumbnail(currentView.zoom),
      bearing: 0,
      pitch: 0,
      projection: "mercator",
      language: mapLabelLanguage,
      localIdeographFontFamily:
        '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif',
      attributionControl: false,
      interactive: false,
      performanceMetricsCollection: false,
    };
    try {
      const nextMap = new mapboxgl.Map(mapOptions);
      nextMap.on("style.load", () => {
        applyChineseBasemapLanguage(nextMap);
        updateThumbnailExtent(nextMap, currentView.bounds);
      });
      nextMap.once("load", () => nextMap.resize());
      mapRef.current = nextMap;
      resizeObserverRef.current = new ResizeObserver(() => nextMap.resize());
      resizeObserverRef.current.observe(container);
    } catch {
      setMapUnavailable(true);
    }
  }, [currentView, mapUnavailable]);

  useEffect(() => {
    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentView) return;
    map.jumpTo({
      center: currentView.center,
      zoom: zoomForThumbnail(currentView.zoom),
      bearing: 0,
      pitch: 0,
    });
    if (map.isStyleLoaded()) {
      updateThumbnailExtent(map, currentView.bounds);
    } else {
      map.once("load", () => updateThumbnailExtent(map, currentView.bounds));
    }
  }, [currentView]);

  return (
    <div className="right-map-mini">
      <div
        ref={containerRef}
        className="right-map-mini-canvas"
        aria-label="当前范围二维地图缩略图"
        role="img"
      />
      {!currentView || mapUnavailable ? (
        <div className="right-map-mini-empty">
          <Typography.Text type="secondary">
            {mapUnavailable ? "2D 地图不可用" : "等待地图视角"}
          </Typography.Text>
        </div>
      ) : null}
    </div>
  );
}

function zoomForThumbnail(mapZoom: number) {
  const zoom = Number.isFinite(mapZoom) ? mapZoom : thumbnailMinZoom;
  return Math.min(
    thumbnailMaxZoom,
    Math.max(thumbnailMinZoom, zoom - thumbnailZoomOffset),
  );
}

function updateThumbnailExtent(map: MapboxMap, bounds: MapViewState["bounds"]) {
  const [west, south, east, north] = bounds;
  const data: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
      },
    ],
  };
  const source = map.getSource(thumbnailExtentSourceId) as
    | GeoJSONSource
    | undefined;
  if (source) {
    source.setData(data);
  } else {
    map.addSource(thumbnailExtentSourceId, {
      type: "geojson",
      data,
    });
  }
  if (!map.getLayer(thumbnailExtentLayerId)) {
    map.addLayer({
      id: thumbnailExtentLayerId,
      type: "line",
      source: thumbnailExtentSourceId,
      paint: {
        "line-color": "#ef4444",
        "line-width": 2,
        "line-opacity": 0.96,
      },
    });
  }
}

function EcologyOverviewPanel() {
  return (
    <div className="eco-tab-panel eco-overview-panel">
      <div className="eco-status-card">
        <div className="eco-gauge">
          <strong>82</strong>
          <span>生态指数</span>
        </div>
        <div className="eco-metrics">
          <span>
            <strong>0.61</strong>
            NDVI
          </span>
          <span>
            <strong>14%</strong>
            风险面积
          </span>
          <span>
            <strong>89%</strong>
            站点在线
          </span>
        </div>
      </div>
      <div className="eco-trend-card">
        <div className="right-panel-heading">
          <Typography.Text strong>NDVI / 水分趋势</Typography.Text>
          <Typography.Text type="secondary">近 12 月</Typography.Text>
        </div>
        <svg viewBox="0 0 300 112" role="img" aria-label="趋势图占位">
          <g stroke="#dff8ee" opacity=".14">
            <path d="M0 26 H300" />
            <path d="M0 56 H300" />
            <path d="M0 86 H300" />
          </g>
          <polyline
            points="0,78 30,64 58,68 88,50 116,44 146,38 174,42 204,30 232,36 262,32 300,34"
            fill="none"
            stroke="#22c58f"
            strokeWidth="4"
          />
          <polyline
            points="0,88 30,80 58,82 88,70 116,60 146,58 174,62 204,52 232,54 262,50 300,52"
            fill="none"
            stroke="#43d7ff"
            strokeWidth="3"
          />
        </svg>
      </div>
    </div>
  );
}

function EcologyMonitorPanel() {
  return (
    <div className="eco-tab-panel eco-monitor-panel">
      <div className="monitor-grid">
        {["植被", "水文", "土壤", "气象", "样地", "遥感"].map((item) => (
          <span key={item}>
            <strong>{item}</strong>
            <small>待接入</small>
          </span>
        ))}
      </div>
      <div className="monitor-placeholder">
        <Typography.Text strong>监测数据窗口</Typography.Text>
        <Typography.Text type="secondary">
          后续在此接入站点在线状态、异常预警和时序监测结果。
        </Typography.Text>
      </div>
    </div>
  );
}
