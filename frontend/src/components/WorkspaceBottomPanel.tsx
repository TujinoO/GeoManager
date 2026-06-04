import {
  App,
  Button,
  Descriptions,
  Empty,
  Segmented,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { Download, Info, MousePointer2, Upload, X } from "lucide-react";
import { useRef } from "react";
import type { DrawMode } from "../map/spatialDraw";
import type { GeoJsonGeometry, LoadedLayer, SpatialFilter } from "../types";
import { downloadBlob } from "../utils/download";

type DrawPurpose = "query";

interface Props {
  selectedLayer: LoadedLayer | null;
  spatialFilter: SpatialFilter | null;
  exportClipGeometry: GeoJsonGeometry | null;
  layerExtentVisible: boolean;
  activeDraw: { purpose: DrawPurpose; mode: NonNullable<DrawMode> } | null;
  onStartQueryDraw: (mode: DrawMode | null) => void;
  onLayerExtentVisibleChange: (visible: boolean) => void;
  onClearSpatialFilter: () => void;
  onImportSpatialFilter: (filter: SpatialFilter) => void;
}

export default function WorkspaceBottomPanel({
  selectedLayer,
  spatialFilter,
  exportClipGeometry,
  layerExtentVisible,
  activeDraw,
  onStartQueryDraw,
  onLayerExtentVisibleChange,
  onClearSpatialFilter,
  onImportSpatialFilter,
}: Props) {
  return (
    <Tabs
      className="workspace-bottom-tabs"
      size="small"
      tabPlacement="bottom"
      items={[
        {
          key: "draw",
          label: (
            <span className="tab-label">
              <MousePointer2 size={14} />
              空间范围
            </span>
          ),
          children: (
            <DrawingPanel
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
          key: "metadata",
          label: (
            <span className="tab-label">
              <Info size={14} />
              元数据
            </span>
          ),
          children: (
            <MetadataPanel
              layer={selectedLayer}
              layerExtentVisible={layerExtentVisible}
              onLayerExtentVisibleChange={onLayerExtentVisibleChange}
            />
          ),
        },
      ]}
    />
  );
}

function MetadataPanel({
  layer,
  layerExtentVisible,
  onLayerExtentVisibleChange,
}: {
  layer: LoadedLayer | null;
  layerExtentVisible: boolean;
  onLayerExtentVisibleChange: (visible: boolean) => void;
}) {
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
    空间范围: layer.metadata.空间范围 ?? layer.sourceResource.spatialExtent,
  };
  const entries = Object.entries(metadata).filter(
    ([, value]) => value !== undefined && value !== "",
  );

  return (
    <section className="bottom-card-panel">
      <div className="bottom-card-heading">
        <Space size={8}>
          <Info size={15} />
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
              {key === "空间范围" ? (
                <Space size={8} wrap>
                  <Typography.Text>{String(value ?? "-")}</Typography.Text>
                  <Switch
                    size="small"
                    checked={layerExtentVisible}
                    checkedChildren="显示"
                    unCheckedChildren="隐藏"
                    onChange={onLayerExtentVisibleChange}
                  />
                </Space>
              ) : (
                String(value ?? "-")
              )}
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
}: Omit<
  Props,
  "selectedLayer" | "layerExtentVisible" | "onLayerExtentVisibleChange"
>) {
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
            icon={<X size={13} />}
            disabled={!currentGeometry}
            onClick={onClearSpatialFilter}
          >
            清除
          </Button>
          <Button
            size="small"
            icon={<Upload size={13} />}
            onClick={() => fileInputRef.current?.click()}
          >
            导入
          </Button>
          <Button
            size="small"
            icon={<Download size={13} />}
            disabled={!currentGeometry}
            onClick={handleExportGeojson}
          >
            导出
          </Button>
        </Space>
      </section>
    </div>
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
