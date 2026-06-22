import {
  AimOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  DownloadOutlined,
  InfoCircleOutlined,
  TableOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Descriptions,
  Empty,
  Segmented,
  Space,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { useRef } from "react";
import type { DrawMode } from "../map/spatialDraw";
import type { GeoJsonGeometry, LoadedLayer, SpatialFilter } from "../types";
import { downloadBlob } from "../utils/download";
import { resourceSpatialExtent } from "../utils/resources";

type DrawPurpose = "query";

interface Props {
  selectedLayer: LoadedLayer | null;
  spatialFilter: SpatialFilter | null;
  exportClipGeometry: GeoJsonGeometry | null;
  activeDraw: { purpose: DrawPurpose; mode: NonNullable<DrawMode> } | null;
  onStartQueryDraw: (mode: DrawMode | null) => void;
  onClearSpatialFilter: () => void;
  onImportSpatialFilter: (filter: SpatialFilter) => void;
}

export default function WorkspaceBottomPanel({
  selectedLayer,
  spatialFilter,
  exportClipGeometry,
  activeDraw,
  onStartQueryDraw,
  onClearSpatialFilter,
  onImportSpatialFilter,
}: Props) {
  return (
    <Tabs
      className="workspace-bottom-tabs"
      size="small"
      items={[
        {
          key: "spatial",
          label: (
            <span className="tab-label">
              <AimOutlined style={{ fontSize: 14 }} />
              空间查询
            </span>
          ),
          children: (
            <SpatialQueryPanel
              selectedLayer={selectedLayer}
              spatialFilter={spatialFilter}
              exportClipGeometry={exportClipGeometry}
              activeDraw={activeDraw}
              onStartQueryDraw={onStartQueryDraw}
              onClearSpatialFilter={onClearSpatialFilter}
              onImportSpatialFilter={onImportSpatialFilter}
            />
          ),
        },
        {
          key: "estimate",
          label: (
            <span className="tab-label">
              <BarChartOutlined style={{ fontSize: 14 }} />
              命中预估
            </span>
          ),
          children: <HitEstimatePanel selectedLayer={selectedLayer} />,
        },
        {
          key: "result",
          label: (
            <span className="tab-label">
              <TableOutlined style={{ fontSize: 14 }} />
              结果
            </span>
          ),
          children: <MetadataPanel layer={selectedLayer} />,
        },
        {
          key: "time",
          label: (
            <span className="tab-label">
              <ClockCircleOutlined style={{ fontSize: 14 }} />
              时间
            </span>
          ),
          children: (
            <BottomPlaceholderPanel
              title="时间筛选"
              description="后续在这里接入时间范围、监测周期和时序结果联动。"
            />
          ),
        },
        {
          key: "legend",
          label: (
            <span className="tab-label">
              <InfoCircleOutlined style={{ fontSize: 14 }} />
              图例
            </span>
          ),
          children: <LegendPlaceholderPanel />,
        },
      ]}
    />
  );
}

function SpatialQueryPanel({
  spatialFilter,
  exportClipGeometry,
  activeDraw,
  onStartQueryDraw,
  onClearSpatialFilter,
  onImportSpatialFilter,
}: Props) {
  const currentGeometry = spatialFilter?.geometry ?? exportClipGeometry;
  const rangeLabel = spatialFilter
    ? `已绘制${spatialModeName(spatialFilter.mode)}`
    : currentGeometry
      ? "已设置范围"
      : "未设置范围";

  return (
    <div className="spatial-query-grid">
      <section className="spatial-query-region spatial-query-tools">
        <div className="bottom-region-heading">
          <span>
            <AimOutlined style={{ fontSize: 15 }} />
            <strong>范围工具</strong>
          </span>
          <Tag color={currentGeometry ? "green" : "default"}>{rangeLabel}</Tag>
        </div>
        <DrawingPanel
          spatialFilter={spatialFilter}
          exportClipGeometry={exportClipGeometry}
          activeDraw={activeDraw}
          onStartQueryDraw={onStartQueryDraw}
          onClearSpatialFilter={onClearSpatialFilter}
          onImportSpatialFilter={onImportSpatialFilter}
        />
      </section>
    </div>
  );
}

function HitEstimatePanel({
  selectedLayer,
}: {
  selectedLayer: LoadedLayer | null;
}) {
  return (
    <section className="spatial-query-region spatial-query-insight">
      <div className="bottom-region-heading">
        <span>
          <BarChartOutlined style={{ fontSize: 15 }} />
          <strong>查询命中预估</strong>
        </span>
        <Typography.Text type="secondary">当前仅为布局占位</Typography.Text>
      </div>
      <div className="spatial-insight-grid">
        <div className="spatial-layer-card">
          <Typography.Text strong>
            {selectedLayer?.name ?? "请选择已加载图层"}
          </Typography.Text>
          <Typography.Text type="secondary">
            {selectedLayer
              ? selectedLayer.summary
              : "绘制范围后，后续查询结果将在这里联动展示。"}
          </Typography.Text>
        </div>
        <div
          className="spatial-hit-preview"
          role="img"
          aria-label="查询命中预估图"
        >
          <span style={{ height: "44%" }} />
          <span style={{ height: "66%" }} />
          <span style={{ height: "82%" }} />
          <span style={{ height: "56%" }} />
          <span style={{ height: "72%" }} />
          <span style={{ height: "38%" }} />
        </div>
        <div className="spatial-symbol-list">
          <span>
            <i className="spatial-symbol spatial-symbol-border" />
            查询范围边框
          </span>
          <span>
            <i className="spatial-symbol" />
            胡杨林分布
          </span>
          <span>
            <i className="spatial-symbol spatial-symbol-water" />
            水文监测
          </span>
        </div>
      </div>
    </section>
  );
}

function MetadataPanel({ layer }: { layer: LoadedLayer | null }) {
  if (!layer) {
    return (
      <Empty
        className="bottom-panel-empty"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="请选择一个已加载图层"
      />
    );
  }

  const metadata = {
    ...layer.metadata,
    空间范围:
      layer.metadata.空间范围 ?? resourceSpatialExtent(layer.sourceResource),
  };
  const entries = Object.entries(metadata).filter(
    ([, value]) => value !== undefined && value !== "",
  );

  return (
    <section className="bottom-card-panel">
      <div className="bottom-card-heading">
        <Space size={8}>
          <InfoCircleOutlined style={{ fontSize: 15 }} />
          <Typography.Text strong>{layer.name}</Typography.Text>
          <Tag color={layer.layerType === "vector" ? "green" : "blue"}>
            {layer.layerType === "vector" ? "矢量" : "栅格"}
          </Tag>
        </Space>
        <Typography.Text type="secondary">{layer.summary}</Typography.Text>
      </div>
      {entries.length > 0 ? (
        <Descriptions size="small" column={1} bordered>
          {entries.map(([key, value]) => (
            <Descriptions.Item key={key} label={key}>
              {String(value ?? "-")}
            </Descriptions.Item>
          ))}
        </Descriptions>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无元数据" />
      )}
    </section>
  );
}

function DrawingPanel({
  spatialFilter,
  exportClipGeometry,
  activeDraw,
  onStartQueryDraw,
  onClearSpatialFilter,
  onImportSpatialFilter,
}: Omit<Props, "selectedLayer">) {
  const { message } = App.useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentGeometry = spatialFilter?.geometry ?? exportClipGeometry;

  async function handleImportGeojson(file: File) {
    try {
      const geometry = geometryFromGeojson(JSON.parse(await file.text()));
      if (!geometry) {
        message.warning("GeoJSON 中未找到可用的面状范围");
        return;
      }
      onImportSpatialFilter({ mode: inferSpatialMode(geometry), geometry });
      message.success("空间范围已导入");
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "GeoJSON 文件读取失败",
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleExportGeojson() {
    if (!currentGeometry) {
      message.warning("请先绘制或导入空间范围");
      return;
    }
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { purpose: "spatial-range" },
          geometry: currentGeometry,
        },
      ],
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], {
      type: "application/geo+json;charset=utf-8",
    });
    downloadBlob(
      blob,
      `spatial-range-${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[-:T]/g, "")}.geojson`,
    );
  }

  return (
    <div className="drawing-panel-grid">
      <section className="drawing-control-block">
        <div className="spatial-range-control-row">
          <Segmented
            block
            className="spatial-range-mode-selector"
            value={activeDraw?.purpose === "query" ? activeDraw.mode : "none"}
            options={[
              { label: "无", value: "none" },
              { label: "矩形", value: "rectangle" },
              { label: "圆", value: "circle" },
              { label: "椭圆", value: "ellipse" },
              { label: "多边形", value: "polygon" },
            ]}
            onChange={(nextValue) =>
              onStartQueryDraw(
                nextValue === "none" ? null : (nextValue as DrawMode),
              )
            }
          />
        </div>
        <input
          ref={fileInputRef}
          className="visually-hidden-file-input"
          type="file"
          accept=".geojson,.json,application/geo+json,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImportGeojson(file);
          }}
        />
        <Space size={8} wrap className="spatial-range-actions">
          {spatialFilter && (
            <Tag color="green">已绘制{spatialModeName(spatialFilter.mode)}</Tag>
          )}
          {!spatialFilter && exportClipGeometry && (
            <Tag color="blue">已设置</Tag>
          )}
          <Button
            size="small"
            icon={<CloseOutlined style={{ fontSize: 13 }} />}
            disabled={!currentGeometry}
            onClick={onClearSpatialFilter}
          >
            清除
          </Button>
          <Button
            size="small"
            icon={<UploadOutlined style={{ fontSize: 13 }} />}
            onClick={() => fileInputRef.current?.click()}
          >
            导入空间范围
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined style={{ fontSize: 13 }} />}
            disabled={!currentGeometry}
            onClick={handleExportGeojson}
          >
            导出空间范围
          </Button>
        </Space>
      </section>
    </div>
  );
}

function BottomPlaceholderPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="bottom-placeholder-panel">
      <Typography.Text strong>{title}</Typography.Text>
      <Typography.Text type="secondary">{description}</Typography.Text>
    </section>
  );
}

function LegendPlaceholderPanel() {
  return (
    <section className="bottom-placeholder-panel legend-placeholder-panel">
      <Typography.Text strong>当前图例</Typography.Text>
      <div className="spatial-symbol-list spatial-symbol-list-wide">
        <span>
          <i className="spatial-symbol spatial-symbol-border" />
          查询范围边框
        </span>
        <span>
          <i className="spatial-symbol" />
          胡杨林分布
        </span>
        <span>
          <i className="spatial-symbol spatial-symbol-water" />
          水文监测
        </span>
        <span>
          <i className="spatial-symbol spatial-symbol-risk" />
          风险区域
        </span>
      </div>
    </section>
  );
}

function spatialModeName(mode: SpatialFilter["mode"]) {
  const names = {
    rectangle: "矩形",
    circle: "圆",
    ellipse: "椭圆",
    polygon: "多边形",
  };
  return names[mode];
}

function geometryFromGeojson(value: unknown): GeoJsonGeometry | null {
  if (!isGeojsonObject(value)) return null;
  if (isSupportedGeometry(value)) return value;
  if (value.type === "Feature" && isSupportedGeometry(value.geometry)) {
    return value.geometry;
  }
  if (value.type === "FeatureCollection" && Array.isArray(value.features)) {
    for (const feature of value.features) {
      if (isGeojsonObject(feature) && isSupportedGeometry(feature.geometry)) {
        return feature.geometry;
      }
    }
  }
  return null;
}

function isGeojsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSupportedGeometry(value: unknown): value is GeoJsonGeometry {
  if (!isGeojsonObject(value)) return false;
  return (
    typeof value.type === "string" &&
    ["Polygon", "MultiPolygon"].includes(value.type) &&
    "coordinates" in value
  );
}

function inferSpatialMode(geometry: GeoJsonGeometry): SpatialFilter["mode"] {
  if (geometry.type === "Polygon" && isRectanglePolygon(geometry.coordinates)) {
    return "rectangle";
  }
  return "polygon";
}

function isRectanglePolygon(coordinates: unknown) {
  if (!Array.isArray(coordinates) || !Array.isArray(coordinates[0])) {
    return false;
  }
  return coordinates[0].length === 5;
}
