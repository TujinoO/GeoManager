import {
  AimOutlined,
  CloseOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  FileSearchOutlined,
  FolderOpenOutlined,
  LoadingOutlined,
  PushpinOutlined,
  TableOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Empty,
  Segmented,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import type { MapImageExportOptions, TileZoomRange } from "../map/mapExport";
import type { DrawMode } from "../map/spatialDraw";
import type {
  DataResourceProfile,
  GeoJsonGeometry,
  LoadedLayer,
  ResourceListItem,
  SpatialFilter,
} from "../types";
import { downloadBlob } from "../utils/download";
import { extractCoordinates } from "../utils/geometry";
import { resourceSpatialExtent } from "../utils/resources";

export type SpatialQueryTarget = "selectedResource" | "selectedLayer";

export interface SpatialQueryWorkbenchResult {
  id: string;
  target: SpatialQueryTarget;
  targetName: string;
  resourceName: string;
  rangeMode: SpatialFilter["mode"] | null;
  totalCount: number;
  returnedCount: number;
  limit: number;
  limitExceeded: boolean;
  bounds: number[];
  elapsedMs: number;
  warningCount: number;
  loadedLayerName?: string | null;
}

type DrawPurpose = "query";

interface Props {
  resources: ResourceListItem[];
  layers: LoadedLayer[];
  selectedResource: ResourceListItem | null;
  selectedResourceProfile: DataResourceProfile | null;
  selectedLayer: LoadedLayer | null;
  spatialFilter: SpatialFilter | null;
  exportClipGeometry: GeoJsonGeometry | null;
  activeDraw: { purpose: DrawPurpose; mode: NonNullable<DrawMode> } | null;
  spatialQuerying: boolean;
  spatialQueryResult: SpatialQueryWorkbenchResult | null;
  canExportData: boolean;
  exportTileZoomRange: TileZoomRange;
  canUseCurrentViewRange: boolean;
  canUseSelectedLayerRange: boolean;
  loadingResourceProfile: boolean;
  onSelectTargetResource: (resourceId: number | null) => Promise<void> | void;
  onSelectTargetLayer: (layerId: string | null) => void;
  onStartQueryDraw: (mode: DrawMode | null) => void;
  onClearSpatialFilter: () => void;
  onImportSpatialFilter: (filter: SpatialFilter) => void;
  onUseCurrentViewRange: () => void;
  onUseSelectedLayerRange: () => void;
  onRunSpatialQuery: (target: SpatialQueryTarget) => Promise<void> | void;
  onLoadSpatialResult: () => void;
  onLocateSpatialResult: () => void;
  onOpenSpatialResultTable: () => void;
  onExportSpatialResult: () => void;
  onClearSpatialResult: () => void;
  onExportMapPng: (options: MapImageExportOptions) => Promise<void>;
}

export default function SpatialQueryWorkbench({
  resources,
  layers,
  selectedResource,
  selectedResourceProfile,
  selectedLayer,
  spatialFilter,
  exportClipGeometry,
  activeDraw,
  spatialQuerying,
  spatialQueryResult,
  canExportData,
  exportTileZoomRange,
  canUseCurrentViewRange,
  canUseSelectedLayerRange,
  loadingResourceProfile,
  onSelectTargetResource,
  onSelectTargetLayer,
  onStartQueryDraw,
  onClearSpatialFilter,
  onImportSpatialFilter,
  onUseCurrentViewRange,
  onUseSelectedLayerRange,
  onRunSpatialQuery,
  onLoadSpatialResult,
  onLocateSpatialResult,
  onOpenSpatialResultTable,
  onExportSpatialResult,
  onClearSpatialResult,
  onExportMapPng,
}: Props) {
  const [target, setTarget] = useState<SpatialQueryTarget>("selectedResource");
  const currentGeometry = spatialFilter?.geometry ?? exportClipGeometry;
  const targetStates = useMemo(
    () =>
      spatialTargetStates(
        selectedResource,
        selectedResourceProfile,
        selectedLayer,
      ),
    [selectedLayer, selectedResource, selectedResourceProfile],
  );
  const activeTarget = targetStates[target];

  return (
    <section className="spatial-workbench" aria-label="空间查询工作台">
      <div className="spatial-workbench-heading">
        <span>
          <AimOutlined style={{ fontSize: 15 }} />
          <Typography.Text strong>空间查询工作台</Typography.Text>
        </span>
        <Typography.Text type="secondary">
          底部面板仅处理空间范围筛选，字段查询仍保留在左侧数据面板
        </Typography.Text>
      </div>
      <div className="spatial-workbench-grid">
        <RangeSection
          spatialFilter={spatialFilter}
          exportClipGeometry={exportClipGeometry}
          activeDraw={activeDraw}
          canExportData={canExportData}
          exportTileZoomRange={exportTileZoomRange}
          canUseCurrentViewRange={canUseCurrentViewRange}
          canUseSelectedLayerRange={canUseSelectedLayerRange}
          onStartQueryDraw={onStartQueryDraw}
          onClearSpatialFilter={onClearSpatialFilter}
          onImportSpatialFilter={onImportSpatialFilter}
          onUseCurrentViewRange={onUseCurrentViewRange}
          onUseSelectedLayerRange={onUseSelectedLayerRange}
          onExportMapPng={onExportMapPng}
        />
        <TargetSection
          target={target}
          resources={resources}
          layers={layers}
          selectedResource={selectedResource}
          selectedLayer={selectedLayer}
          loadingResourceProfile={loadingResourceProfile}
          targetStates={targetStates}
          onTargetChange={setTarget}
          onSelectTargetResource={onSelectTargetResource}
          onSelectTargetLayer={onSelectTargetLayer}
        />
        <ResultSection
          target={target}
          targetReady={activeTarget.ready}
          hasRange={Boolean(currentGeometry)}
          result={spatialQueryResult}
          querying={spatialQuerying}
          canExportData={canExportData}
          onRunSpatialQuery={onRunSpatialQuery}
          onLoadSpatialResult={onLoadSpatialResult}
          onLocateSpatialResult={onLocateSpatialResult}
          onOpenSpatialResultTable={onOpenSpatialResultTable}
          onExportSpatialResult={onExportSpatialResult}
          onClearSpatialResult={onClearSpatialResult}
        />
      </div>
    </section>
  );
}

function RangeSection({
  spatialFilter,
  exportClipGeometry,
  activeDraw,
  canExportData,
  exportTileZoomRange,
  canUseCurrentViewRange,
  canUseSelectedLayerRange,
  onStartQueryDraw,
  onClearSpatialFilter,
  onImportSpatialFilter,
  onUseCurrentViewRange,
  onUseSelectedLayerRange,
  onExportMapPng,
}: Pick<
  Props,
  | "spatialFilter"
  | "exportClipGeometry"
  | "activeDraw"
  | "canExportData"
  | "exportTileZoomRange"
  | "canUseCurrentViewRange"
  | "canUseSelectedLayerRange"
  | "onStartQueryDraw"
  | "onClearSpatialFilter"
  | "onImportSpatialFilter"
  | "onUseCurrentViewRange"
  | "onUseSelectedLayerRange"
  | "onExportMapPng"
>) {
  const geometry = spatialFilter?.geometry ?? exportClipGeometry;
  const rangeLabel = spatialFilter
    ? `已设置${spatialModeName(spatialFilter.mode)}`
    : geometry
      ? "已设置范围"
      : "未设置范围";
  const metrics = geometryMetrics(geometry);

  return (
    <section className="spatial-workbench-section">
      <SectionHeading
        icon={<AimOutlined style={{ fontSize: 15 }} />}
        title="空间范围"
        tag={<Tag color={geometry ? "green" : "default"}>{rangeLabel}</Tag>}
      />
      <DrawingPanel
        spatialFilter={spatialFilter}
        exportClipGeometry={exportClipGeometry}
        activeDraw={activeDraw}
        canExportData={canExportData}
        exportTileZoomRange={exportTileZoomRange}
        canUseCurrentViewRange={canUseCurrentViewRange}
        canUseSelectedLayerRange={canUseSelectedLayerRange}
        onStartQueryDraw={onStartQueryDraw}
        onClearSpatialFilter={onClearSpatialFilter}
        onImportSpatialFilter={onImportSpatialFilter}
        onUseCurrentViewRange={onUseCurrentViewRange}
        onUseSelectedLayerRange={onUseSelectedLayerRange}
        onExportMapPng={onExportMapPng}
      />
      <div className="spatial-workbench-meta">
        <Metric label="范围坐标" value={metrics.boundsLabel} />
        <Metric label="估算面积" value={metrics.areaLabel} />
      </div>
    </section>
  );
}

function TargetSection({
  target,
  resources,
  layers,
  selectedResource,
  selectedLayer,
  loadingResourceProfile,
  targetStates,
  onTargetChange,
  onSelectTargetResource,
  onSelectTargetLayer,
}: {
  target: SpatialQueryTarget;
  resources: ResourceListItem[];
  layers: LoadedLayer[];
  selectedResource: ResourceListItem | null;
  selectedLayer: LoadedLayer | null;
  loadingResourceProfile: boolean;
  targetStates: Record<SpatialQueryTarget, SpatialTargetState>;
  onTargetChange: (target: SpatialQueryTarget) => void;
  onSelectTargetResource: (resourceId: number | null) => Promise<void> | void;
  onSelectTargetLayer: (layerId: string | null) => void;
}) {
  const active = targetStates[target];
  const resourceOptions = useMemo(
    () =>
      resources
        .filter(
          (resource) => resource.dataType === "vector" && resource.isQueryable,
        )
        .map((resource) => ({
          value: resource.id,
          label: resource.name,
          title: resourceSpatialExtent(resource),
        })),
    [resources],
  );
  const layerOptions = useMemo(
    () =>
      layers
        .filter(
          (layer) =>
            layer.layerType === "vector" &&
            layer.sourceResource.isQueryable &&
            layer.sourceResource.id > 0,
        )
        .map((layer) => ({
          value: layer.id,
          label: layer.name,
          title: resourceSpatialExtent(layer.sourceResource),
        })),
    [layers],
  );

  return (
    <section className="spatial-workbench-section">
      <SectionHeading
        icon={<DatabaseOutlined style={{ fontSize: 15 }} />}
        title="查询对象"
        tag={<Tag color={active.ready ? "green" : "default"}>{active.tag}</Tag>}
      />
      <Segmented
        block
        className="spatial-target-selector"
        value={target}
        options={[
          {
            label: "资源",
            value: "selectedResource",
            disabled: resourceOptions.length === 0 && !selectedResource,
          },
          {
            label: "图层",
            value: "selectedLayer",
            disabled: layerOptions.length === 0 && !selectedLayer,
          },
        ]}
        onChange={(nextValue) => onTargetChange(nextValue as SpatialQueryTarget)}
      />
      {target === "selectedResource" ? (
        <div className="spatial-target-picker-row">
          <Select
            allowClear
            showSearch
            className="spatial-target-select"
            size="small"
            loading={loadingResourceProfile}
            value={selectedResource?.id}
            placeholder="选择可查询矢量资源"
            optionFilterProp="label"
            options={resourceOptions}
            notFoundContent="暂无可查询资源"
            onChange={(value) => void onSelectTargetResource(value ?? null)}
          />
          <Button
            size="small"
            icon={<CloseOutlined style={{ fontSize: 13 }} />}
            disabled={!selectedResource}
            onClick={() => void onSelectTargetResource(null)}
          >
            清除
          </Button>
        </div>
      ) : (
        <div className="spatial-target-picker-row">
          <Select
            allowClear
            showSearch
            className="spatial-target-select"
            size="small"
            value={selectedLayer?.id}
            placeholder="选择已加载矢量图层"
            optionFilterProp="label"
            options={layerOptions}
            notFoundContent="暂无可用图层"
            onChange={(value) => onSelectTargetLayer(value ?? null)}
          />
          <Button
            size="small"
            icon={<CloseOutlined style={{ fontSize: 13 }} />}
            disabled={!selectedLayer}
            onClick={() => onSelectTargetLayer(null)}
          >
            清除
          </Button>
        </div>
      )}
      <div className="spatial-target-card">
        <Typography.Text strong>{active.name}</Typography.Text>
        <Typography.Text type="secondary">{active.description}</Typography.Text>
        <Space size={6} wrap>
          <Tag color={active.ready ? "green" : "default"}>{active.typeLabel}</Tag>
          {active.extent ? <Tag>{active.extent}</Tag> : null}
        </Space>
      </div>
    </section>
  );
}

function ResultSection({
  target,
  targetReady,
  hasRange,
  result,
  querying,
  canExportData,
  onRunSpatialQuery,
  onLoadSpatialResult,
  onLocateSpatialResult,
  onOpenSpatialResultTable,
  onExportSpatialResult,
  onClearSpatialResult,
}: {
  target: SpatialQueryTarget;
  targetReady: boolean;
  hasRange: boolean;
  result: SpatialQueryWorkbenchResult | null;
  querying: boolean;
  canExportData: boolean;
  onRunSpatialQuery: (target: SpatialQueryTarget) => Promise<void> | void;
  onLoadSpatialResult: () => void;
  onLocateSpatialResult: () => void;
  onOpenSpatialResultTable: () => void;
  onExportSpatialResult: () => void;
  onClearSpatialResult: () => void;
}) {
  const status = spatialResultStatus(result, querying, hasRange, targetReady);
  const hasResultRows = Boolean(result && result.returnedCount > 0);
  const resultLoaded = Boolean(result?.loadedLayerName);
  const canRun = hasRange && targetReady && !querying;

  return (
    <section className="spatial-workbench-section spatial-workbench-result">
      <SectionHeading
        icon={
          querying ? (
            <LoadingOutlined style={{ fontSize: 15 }} />
          ) : (
            <FileSearchOutlined style={{ fontSize: 15 }} />
          )
        }
        title="查询结果与操作"
        tag={<Tag color={status.color}>{status.label}</Tag>}
      />
      {result ? (
        <div className="spatial-result-summary">
          <div className="spatial-result-title">
            <Typography.Text strong>{result.targetName}</Typography.Text>
            <Typography.Text type="secondary">
              {result.loadedLayerName
                ? `已加载为图层：${result.loadedLayerName}`
                : "临时结果，加载后进入图层树管理"}
            </Typography.Text>
          </div>
          <div className="spatial-result-metrics">
            <Metric label="命中" value={`${result.totalCount} 条`} />
            <Metric label="返回" value={`${result.returnedCount} 条`} />
            <Metric
              label="截断"
              value={result.limitExceeded ? `超过 ${result.limit}` : "否"}
            />
            <Metric label="耗时" value={`${result.elapsedMs} ms`} />
            <Metric
              label="边界"
              value={formatBounds(result.bounds) || "无有效范围"}
            />
            <Metric
              label="警告"
              value={result.warningCount ? `${result.warningCount} 项` : "无"}
            />
          </div>
        </div>
      ) : (
        <Empty
          className="spatial-result-empty"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={status.description}
        />
      )}
      <div className="spatial-result-actions">
        <Button
          type="primary"
          icon={<FileSearchOutlined style={{ fontSize: 14 }} />}
          loading={querying}
          disabled={!canRun}
          onClick={() => void onRunSpatialQuery(target)}
        >
          执行查询
        </Button>
        <Button
          icon={<FolderOpenOutlined style={{ fontSize: 14 }} />}
          disabled={!hasResultRows || resultLoaded}
          onClick={onLoadSpatialResult}
        >
          加载为图层
        </Button>
        <Button
          icon={<PushpinOutlined style={{ fontSize: 14 }} />}
          disabled={!hasResultRows}
          onClick={onLocateSpatialResult}
        >
          定位
        </Button>
        <Button
          icon={<TableOutlined style={{ fontSize: 14 }} />}
          disabled={!hasResultRows}
          onClick={onOpenSpatialResultTable}
        >
          属性表
        </Button>
        <Tooltip title={canExportData ? undefined : "当前用户无数据导出权限"}>
          <Button
            icon={<DownloadOutlined style={{ fontSize: 14 }} />}
            disabled={!hasResultRows || !canExportData}
            onClick={onExportSpatialResult}
          >
            导出
          </Button>
        </Tooltip>
        <Button
          icon={<CloseOutlined style={{ fontSize: 14 }} />}
          disabled={!result}
          onClick={onClearSpatialResult}
        >
          清空
        </Button>
      </div>
    </section>
  );
}

function DrawingPanel({
  spatialFilter,
  exportClipGeometry,
  activeDraw,
  canExportData,
  exportTileZoomRange,
  canUseCurrentViewRange,
  canUseSelectedLayerRange,
  onStartQueryDraw,
  onClearSpatialFilter,
  onImportSpatialFilter,
  onUseCurrentViewRange,
  onUseSelectedLayerRange,
  onExportMapPng,
}: Pick<
  Props,
  | "spatialFilter"
  | "exportClipGeometry"
  | "activeDraw"
  | "canExportData"
  | "exportTileZoomRange"
  | "canUseCurrentViewRange"
  | "canUseSelectedLayerRange"
  | "onStartQueryDraw"
  | "onClearSpatialFilter"
  | "onImportSpatialFilter"
  | "onUseCurrentViewRange"
  | "onUseSelectedLayerRange"
  | "onExportMapPng"
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

  function handleExportMapImage() {
    const tileZoom = Math.min(
      exportTileZoomRange.max,
      Math.max(exportTileZoomRange.min, 8),
    );
    void onExportMapPng({ format: "png", dpi: 150, tileZoom });
  }

  return (
    <div className="spatial-range-tools">
      <Segmented
        block
        className="spatial-range-mode-selector"
        value={activeDraw?.purpose === "query" ? activeDraw.mode : "none"}
        options={[
          { label: "无", value: "none" },
          { label: "矩形", value: "rectangle" },
          { label: "圆形", value: "circle" },
          { label: "椭圆", value: "ellipse" },
          { label: "多边形", value: "polygon" },
        ]}
        onChange={(nextValue) =>
          onStartQueryDraw(nextValue === "none" ? null : (nextValue as DrawMode))
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
      <div className="spatial-range-action-grid">
        <Button
          size="small"
          disabled={!canUseCurrentViewRange}
          onClick={onUseCurrentViewRange}
        >
          当前视图
        </Button>
        <Button
          size="small"
          disabled={!canUseSelectedLayerRange}
          onClick={onUseSelectedLayerRange}
        >
          图层范围
        </Button>
        <Button
          size="small"
          icon={<UploadOutlined style={{ fontSize: 13 }} />}
          onClick={() => fileInputRef.current?.click()}
        >
          导入
        </Button>
        <Button
          size="small"
          icon={<DownloadOutlined style={{ fontSize: 13 }} />}
          disabled={!currentGeometry}
          onClick={handleExportGeojson}
        >
          导出范围
        </Button>
        <Button
          size="small"
          icon={<DownloadOutlined style={{ fontSize: 13 }} />}
          disabled={!currentGeometry || !canExportData}
          onClick={handleExportMapImage}
        >
          地图图片
        </Button>
        <Button
          size="small"
          icon={<CloseOutlined style={{ fontSize: 13 }} />}
          disabled={!currentGeometry}
          onClick={onClearSpatialFilter}
        >
          清除
        </Button>
      </div>
    </div>
  );
}

function SectionHeading({
  icon,
  title,
  tag,
}: {
  icon: React.ReactNode;
  title: string;
  tag?: React.ReactNode;
}) {
  return (
    <div className="spatial-section-heading">
      <span>
        {icon}
        <Typography.Text strong>{title}</Typography.Text>
      </span>
      {tag}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="spatial-metric">
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Typography.Text>{value || "-"}</Typography.Text>
    </span>
  );
}

interface SpatialTargetState {
  ready: boolean;
  tag: string;
  name: string;
  description: string;
  typeLabel: string;
  extent: string;
}

function spatialTargetStates(
  selectedResource: ResourceListItem | null,
  selectedResourceProfile: DataResourceProfile | null,
  selectedLayer: LoadedLayer | null,
): Record<SpatialQueryTarget, SpatialTargetState> {
  const resourceReady =
    selectedResource?.dataType === "vector" &&
    selectedResource.isQueryable &&
    Boolean(selectedResourceProfile);
  const layerReady =
    selectedLayer?.layerType === "vector" &&
    selectedLayer.sourceResource.isQueryable &&
    selectedLayer.sourceResource.id > 0;

  return {
    selectedResource: {
      ready: resourceReady,
      tag: resourceReady ? "可查询" : "未就绪",
      name: selectedResource?.name ?? "未选择资源",
      description: selectedResource
        ? resourceReady
          ? "左侧当前资源，可按底部空间范围筛选"
          : "上方已选择的资源不可查询，或字段信息尚未加载完成"
        : "请通过上方下拉框选择可查询矢量资源",
      typeLabel: selectedResource?.dataType === "vector" ? "矢量资源" : "资源",
      extent: selectedResource ? resourceSpatialExtent(selectedResource) : "",
    },
    selectedLayer: {
      ready: layerReady,
      tag: layerReady ? "可查询" : "未就绪",
      name: selectedLayer?.name ?? "未选择图层",
      description: selectedLayer
        ? layerReady
          ? "图层树当前图层，将按来源资源重新执行空间查询"
          : "上方已选择的图层不是可反查来源资源的矢量图层"
        : "请通过上方下拉框选择已加载矢量图层",
      typeLabel: selectedLayer?.layerType === "vector" ? "矢量图层" : "图层",
      extent: selectedLayer
        ? String(
            selectedLayer.metadata.空间范围 ??
              resourceSpatialExtent(selectedLayer.sourceResource) ??
              "",
          )
        : "",
    },
  };
}

function spatialResultStatus(
  result: SpatialQueryWorkbenchResult | null,
  querying: boolean,
  hasRange: boolean,
  targetReady: boolean,
) {
  if (querying) {
    return {
      label: "查询中",
      color: "processing",
      description: "正在查询空间范围内的要素",
    };
  }
  if (result?.returnedCount === 0) {
    return {
      label: "无命中结果",
      color: "default",
      description: "当前空间范围内没有命中要素",
    };
  }
  if (result?.loadedLayerName) {
    return {
      label: "已加载图层",
      color: "green",
      description: "查询结果已进入图层树",
    };
  }
  if (result) {
    return {
      label: result.limitExceeded ? "结果超过上限" : "查询成功",
      color: result.limitExceeded ? "warning" : "green",
      description: "查询完成，可加载为结果图层",
    };
  }
  if (hasRange && targetReady) {
    return {
      label: "待执行",
      color: "blue",
      description: "范围和对象已就绪",
    };
  }
  return {
    label: "未查询",
    color: "default",
    description: "设置空间范围并选择查询对象",
  };
}

function spatialModeName(mode: SpatialFilter["mode"]) {
  const names: Record<SpatialFilter["mode"], string> = {
    rectangle: "矩形范围",
    circle: "圆形范围",
    ellipse: "椭圆范围",
    polygon: "多边形范围",
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

function geometryMetrics(geometry: GeoJsonGeometry | null | undefined) {
  if (!geometry) {
    return { boundsLabel: "未设置", areaLabel: "未设置" };
  }
  return {
    boundsLabel: formatBounds(boundsForGeometry(geometry)) || "无有效坐标",
    areaLabel: formatArea(estimateAreaSqKm(geometry)),
  };
}

function boundsForGeometry(geometry: GeoJsonGeometry): number[] {
  const points: Array<[number, number]> = [];
  extractCoordinates((geometry as { coordinates?: unknown }).coordinates, points);
  if (points.length === 0) return [];
  const lngs = points.map((point) => point[0]);
  const lats = points.map((point) => point[1]);
  return [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ].map((value) => Number(value.toFixed(6)));
}

function formatBounds(bounds: number[]) {
  if (bounds.length < 4) return "";
  return `${bounds[0]?.toFixed(4)}, ${bounds[1]?.toFixed(4)} - ${bounds[2]?.toFixed(4)}, ${bounds[3]?.toFixed(4)}`;
}

function estimateAreaSqKm(geometry: GeoJsonGeometry): number | null {
  const coordinates = geometry.coordinates;
  if (geometry.type === "Polygon" && Array.isArray(coordinates)) {
    return Math.abs(ringAreaSqKm(coordinates[0]));
  }
  if (geometry.type === "MultiPolygon" && Array.isArray(coordinates)) {
    return coordinates.reduce(
      (total, polygon) =>
        total +
        (Array.isArray(polygon) ? Math.abs(ringAreaSqKm(polygon[0])) : 0),
      0,
    );
  }
  return null;
}

function ringAreaSqKm(ring: unknown): number {
  if (!Array.isArray(ring) || ring.length < 4) return 0;
  const points = ring.filter(isCoordinatePair);
  if (points.length < 4) return 0;
  const avgLat =
    points.reduce((total, point) => total + point[1], 0) / points.length;
  const lngScale = 111.32 * Math.cos((avgLat * Math.PI) / 180);
  const latScale = 110.574;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) continue;
    area += current[0] * lngScale * (next[1] * latScale);
    area -= next[0] * lngScale * (current[1] * latScale);
  }
  return area / 2;
}

function isCoordinatePair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

function formatArea(value: number | null) {
  if (value === null) return "暂不计算";
  if (!Number.isFinite(value) || value <= 0) return "小于 0.01 km²";
  if (value < 1) return `${value.toFixed(2)} km²`;
  return `${Math.round(value).toLocaleString("zh-CN")} km²`;
}
