import {
  AimOutlined,
  AreaChartOutlined,
  RadarChartOutlined,
} from "@ant-design/icons";
import { Tabs, Tag, Typography } from "antd";
import type { FeatureInfo } from "../types";
import FeatureDetailPanel from "./FeatureDetailPanel";

interface Props {
  selectedFeature: FeatureInfo | null;
}

export default function RightSidePanel({ selectedFeature }: Props) {
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
          <Tag color="cyan">示意</Tag>
        </div>
        <div className="right-map-mini">
          <svg viewBox="0 0 320 112" role="img" aria-label="当前范围平面缩略图">
            <path
              d="M0 82 C54 54 94 78 136 54 S222 24 320 38 L320 112 L0 112 Z"
              fill="#1f8b72"
              opacity=".52"
            />
            <path
              d="M0 88 C74 64 112 82 174 58 S250 40 320 48"
              fill="none"
              stroke="#43d7ff"
              strokeWidth="10"
              opacity=".58"
            />
            <path
              d="M18 30 C70 42 98 20 146 34 S228 60 300 26"
              fill="none"
              stroke="#dff8ee"
              strokeWidth="1.2"
              opacity=".28"
            />
            <rect
              x="120"
              y="32"
              width="108"
              height="52"
              rx="7"
              fill="none"
              stroke="#f2b84b"
              strokeWidth="3"
            />
            <circle cx="174" cy="58" r="5" fill="#f2b84b" />
          </svg>
        </div>
        <div className="right-map-meta">
          <span>中心范围：中亚胡杨林样区</span>
          <span>当前缩放：视图同步</span>
        </div>
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
