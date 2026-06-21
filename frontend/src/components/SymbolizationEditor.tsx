import {
  Alert,
  App,
  Button,
  Card,
  ColorPicker,
  Divider,
  Input,
  InputNumber,
  Segmented,
  Select,
  Slider,
  Space,
  Switch,
  Tabs,
  Typography,
} from "antd";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { api } from "../api/client";
import {
  normalizeSymbolIconImage,
  type Anchor,
  type CircleSymbolization,
  type FillSymbolization,
  type HeatmapSymbolization,
  type LineSymbolization,
  type RasterSymbolization,
  type SymbolLayerSymbolization,
  type VectorSymbolization,
} from "../symbolization";
import type { RasterBandMetadata, ResourceField } from "../types";

const anchorOptions: Anchor[] = [
  "center",
  "left",
  "right",
  "top",
  "bottom",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

const rgbBandLabels = ["R", "G", "B"] as const;
const heatmapPalettes = [
  {
    label: "生态密度",
    value: [
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0,
      "rgba(0, 0, 0, 0)",
      0.12,
      "rgba(72, 202, 228, 0.22)",
      0.32,
      "#48cae4",
      0.55,
      "#80ed99",
      0.76,
      "#ffd166",
      0.92,
      "#f77f00",
      1,
      "#d62828",
    ],
  },
  {
    label: "冷暖过渡",
    value: [
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0,
      "rgba(0, 0, 0, 0)",
      0.25,
      "#3b82f6",
      0.55,
      "#22c55e",
      0.78,
      "#facc15",
      1,
      "#ef4444",
    ],
  },
  {
    label: "单色强度",
    value: [
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0,
      "rgba(0, 0, 0, 0)",
      0.35,
      "rgba(34, 197, 143, 0.35)",
      0.7,
      "rgba(34, 197, 143, 0.72)",
      1,
      "#eafff8",
    ],
  },
] as const;

const symbolizationLabels: Record<string, string> = {
  A: "Alpha 透明度",
  "circle-color": "圆点颜色",
  "circle-radius": "圆点半径",
  "circle-blur": "圆点模糊",
  "circle-opacity": "圆点不透明度",
  "circle-stroke-color": "圆点描边颜色",
  "circle-stroke-width": "圆点描边宽度",
  "circle-stroke-opacity": "圆点描边不透明度",
  "circle-pitch-alignment": "圆点俯仰对齐方式",
  "circle-pitch-scale": "圆点俯仰缩放基准",
  "circle-translate": "圆点平移偏移",
  "circle-translate-anchor": "圆点平移锚点",
  "circle-emissive-strength": "圆点自发光强度",
  "circle-sort-key": "圆点排序键",
  "symbol-placement": "符号放置方式",
  "symbol-spacing": "符号间距",
  "symbol-sort-key": "符号排序键",
  "symbol-z-order": "符号层级顺序",
  "symbol-avoid-edges": "避开瓦片边缘",
  "icon-image": "图标名称",
  "icon-size": "图标大小",
  "icon-size-scale-range": "图标缩放范围",
  "icon-anchor": "图标锚点",
  "icon-offset": "图标偏移",
  "icon-padding": "图标碰撞留白",
  "icon-rotate": "图标旋转角度",
  "icon-pitch-alignment": "图标俯仰对齐方式",
  "icon-rotation-alignment": "图标旋转对齐方式",
  "icon-text-fit": "图标适配文字",
  "icon-text-fit-padding": "图标适配文字留白",
  "icon-allow-overlap": "允许图标重叠",
  "icon-ignore-placement": "图标忽略避让",
  "icon-optional": "图标可选显示",
  "icon-keep-upright": "图标保持正向",
  "icon-color": "图标颜色",
  "icon-opacity": "图标不透明度",
  "icon-halo-color": "图标光晕颜色",
  "icon-halo-width": "图标光晕宽度",
  "icon-halo-blur": "图标光晕模糊",
  "icon-translate": "图标平移偏移",
  "icon-translate-anchor": "图标平移锚点",
  "icon-emissive-strength": "图标自发光强度",
  "icon-color-brightness-min": "图标最低亮度",
  "icon-color-brightness-max": "图标最高亮度",
  "icon-color-contrast": "图标对比度",
  "icon-color-saturation": "图标饱和度",
  "icon-occlusion-opacity": "图标遮挡不透明度",
  "text-field": "标注字段",
  "text-font": "标注字体",
  "text-size": "标注字号",
  "text-max-width": "标注最大宽度",
  "text-line-height": "标注行高",
  "text-letter-spacing": "标注字距",
  "text-justify": "标注对齐方式",
  "text-anchor": "标注锚点",
  "text-offset": "标注偏移",
  "text-radial-offset": "标注径向偏移",
  "text-variable-anchor": "标注可变锚点",
  "text-writing-mode": "标注书写方向",
  "text-padding": "标注碰撞留白",
  "text-rotate": "标注旋转角度",
  "text-pitch-alignment": "标注俯仰对齐方式",
  "text-rotation-alignment": "标注旋转对齐方式",
  "text-transform": "标注大小写转换",
  "text-allow-overlap": "允许标注重叠",
  "text-ignore-placement": "标注忽略避让",
  "text-optional": "标注可选显示",
  "text-keep-upright": "标注保持正向",
  "text-color": "标注颜色",
  "text-opacity": "标注不透明度",
  "text-halo-color": "标注光晕颜色",
  "text-halo-width": "标注光晕宽度",
  "text-halo-blur": "标注光晕模糊",
  "text-translate": "标注平移偏移",
  "text-translate-anchor": "标注平移锚点",
  "text-emissive-strength": "标注自发光强度",
  "text-occlusion-opacity": "标注遮挡不透明度",
  "heatmap-weight": "热力权重",
  "heatmap-intensity": "热力强度",
  "heatmap-radius": "热力半径",
  "heatmap-opacity": "热力不透明度",
  "heatmap-color": "热力色带",
  "line-color": "线颜色",
  "line-width": "线宽",
  "line-opacity": "线不透明度",
  "line-blur": "线模糊",
  "line-cap": "线端点样式",
  "line-join": "线连接样式",
  "line-miter-limit": "斜接限制",
  "line-round-limit": "圆角限制",
  "line-offset": "线偏移",
  "line-gap-width": "线间隙宽度",
  "line-dasharray": "虚线数组",
  "line-translate": "线平移偏移",
  "line-translate-anchor": "线平移锚点",
  "line-emissive-strength": "线自发光强度",
  "fill-color": "填充颜色",
  "fill-opacity": "填充不透明度",
  "fill-outline-color": "填充描边颜色",
  "fill-antialias": "填充抗锯齿",
  "fill-sort-key": "填充排序键",
  "fill-translate": "填充平移偏移",
  "fill-translate-anchor": "填充平移锚点",
  "fill-emissive-strength": "填充自发光强度",
  "启用 nodata": "启用无数据值",
};

const symbolizationOptionLabels: Record<string, string> = {
  auto: "自动",
  map: "地图",
  viewport: "视口",
  center: "中心",
  left: "左侧",
  right: "右侧",
  top: "上方",
  bottom: "下方",
  "top-left": "左上",
  "top-right": "右上",
  "bottom-left": "左下",
  "bottom-right": "右下",
  point: "点",
  line: "沿线",
  "line-center": "线中心",
  "viewport-y": "视口 Y 轴",
  source: "数据源顺序",
  none: "无",
  width: "宽度",
  height: "高度",
  both: "宽高",
  horizontal: "水平",
  vertical: "垂直",
  uppercase: "大写",
  lowercase: "小写",
  butt: "平头",
  round: "圆头",
  square: "方头",
  bevel: "斜角",
  miter: "尖角",
  mask: "掩膜",
  poplar: "胡杨专题",
  viridis: "Viridis 连续色带",
  terrain: "地形色带",
  thermal: "热力色带",
};

function displaySymbolizationLabel(label: string) {
  return symbolizationLabels[label] ?? label;
}

function displaySymbolizationOption(option: string) {
  return symbolizationOptionLabels[option] ?? option;
}

function isNumericResourceField(field: ResourceField) {
  const type = field.type.toLowerCase();
  return (
    type.includes("int") ||
    type.includes("float") ||
    type.includes("double") ||
    type.includes("decimal") ||
    type.includes("number") ||
    type.includes("numeric") ||
    type.includes("real")
  );
}

export function VectorSymbolizationEditor({
  value,
  fields,
  geometryType,
  onChange,
  onApply,
}: {
  value: VectorSymbolization;
  fields: ResourceField[];
  geometryType?: string;
  onChange: (value: VectorSymbolization) => void;
  onApply?: () => void;
}) {
  const { message } = App.useApp();

  const copyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      message.success("符号化方案 JSON 已复制");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "复制失败");
    }
  }, [value, message]);
  function updateRoot<Key extends keyof VectorSymbolization>(
    key: Key,
    nextValue: VectorSymbolization[Key],
  ) {
    onChange({ ...value, [key]: nextValue });
  }

  function updateCircle<Key extends keyof CircleSymbolization>(
    key: Key,
    nextValue: CircleSymbolization[Key],
  ) {
    onChange({ ...value, circle: { ...value.circle, [key]: nextValue } });
  }

  function updateSymbol<Key extends keyof SymbolLayerSymbolization>(
    key: Key,
    nextValue: SymbolLayerSymbolization[Key],
  ) {
    onChange({ ...value, symbol: { ...value.symbol, [key]: nextValue } });
  }

  function updateLine<Key extends keyof LineSymbolization>(
    key: Key,
    nextValue: LineSymbolization[Key],
  ) {
    onChange({ ...value, line: { ...value.line, [key]: nextValue } });
  }

  function updateFill<Key extends keyof FillSymbolization>(
    key: Key,
    nextValue: FillSymbolization[Key],
  ) {
    onChange({ ...value, fill: { ...value.fill, [key]: nextValue } });
  }

  function updateHeatmap<Key extends keyof HeatmapSymbolization>(
    key: Key,
    nextValue: HeatmapSymbolization[Key],
  ) {
    onChange({ ...value, heatmap: { ...value.heatmap, [key]: nextValue } });
  }

  function applyPreset(kind: "point" | "symbol" | "heatmap" | "line" | "fill") {
    if (kind === "point") {
      onChange({
        ...value,
        pointMode: "circle",
        circle: {
          ...value.circle,
          circleColor: "#2f7d62",
          circleRadius: 7,
          circleStrokeColor: "#f4cb68",
          circleStrokeWidth: 1.6,
        },
      });
    } else if (kind === "symbol") {
      onChange({
        ...value,
        pointMode: "symbol",
        symbol: {
          ...value.symbol,
          iconImage: "gm-marker",
          iconColor: "#d9a441",
          iconHaloColor: "#173f39",
          iconHaloWidth: 0.8,
          iconSize: 1.15,
          textColor: "#173f39",
          textHaloColor: "#ffffff",
          textHaloWidth: 1.2,
        },
      });
    } else if (kind === "heatmap") {
      onChange({
        ...value,
        pointMode: "heatmap",
        heatmap: {
          ...value.heatmap,
          heatmapWeight: 0.72,
          heatmapWeightField: "",
          heatmapWeightFieldMax: 1,
          heatmapIntensity: 0.9,
          heatmapRadius: 24,
          heatmapOpacity: 0.78,
          heatmapColor: [
            ...(heatmapPalettes[0]?.value ?? value.heatmap.heatmapColor),
          ],
        },
      });
    } else if (kind === "line") {
      onChange({
        ...value,
        line: {
          ...value.line,
          lineColor: "#2f7d62",
          lineWidth: 2.4,
          lineDasharray: [1, 0],
        },
      });
    } else {
      onChange({
        ...value,
        fill: {
          ...value.fill,
          fillColor: "#2f7d62",
          fillOpacity: 0.42,
          fillOutlineColor: "#f4cb68",
        },
      });
    }
  }

  const textFieldOptions = [
    { value: "", label: "不显示" },
    ...fields.map((field) => ({
      value: "{" + field.name + "}",
      label: field.name,
    })),
  ];
  const labelFieldOptions =
    value.symbol.textField &&
    !textFieldOptions.some((option) => option.value === value.symbol.textField)
      ? [
          { value: value.symbol.textField, label: value.symbol.textField },
          ...textFieldOptions,
        ]
      : textFieldOptions;
  const defaultLabelField =
    labelFieldOptions.find((option) => option.value)?.value ?? "";
  const labelEnabled = value.symbol.textField.trim().length > 0;
  const selectedHeatmapWeightField = value.heatmap.heatmapWeightField ?? "";
  const heatmapWeightFieldOptions = [
    { value: "", label: "按点位数量" },
    ...fields.filter(isNumericResourceField).map((field) => ({
      value: field.name,
      label: field.description
        ? `${field.name} · ${field.description}`
        : field.name,
    })),
  ];
  const normalizedGeometry = (geometryType ?? "").toLowerCase();
  const geometryUnknown =
    !normalizedGeometry ||
    normalizedGeometry.includes("mixed") ||
    normalizedGeometry.includes("geometrycollection");
  const geometry = {
    hasPoint: geometryUnknown || normalizedGeometry.includes("point"),
    hasLine: geometryUnknown || normalizedGeometry.includes("line"),
    hasPolygon: geometryUnknown || normalizedGeometry.includes("polygon"),
  };
  const geometrySummary = geometryUnknown
    ? "自动识别可用表达方式"
    : geometryType;
  const iconOptions = [
    { value: "gm-marker", label: "定位标记" },
    { value: "gm-station", label: "监测站点" },
    { value: "gm-sample", label: "调查样点" },
    { value: "gm-plot", label: "植被样方" },
    { value: "gm-water", label: "水文点位" },
    { value: "gm-alert", label: "风险预警" },
    { value: "gm-priority", label: "重点点位" },
  ];
  const selectedIconImage = normalizeSymbolIconImage(value.symbol.iconImage);
  const iconImageOptions = iconOptions.some(
    (option) => option.value === selectedIconImage,
  )
    ? iconOptions
    : [
        { value: selectedIconImage, label: selectedIconImage },
        ...iconOptions,
      ];
  const currentHeatmapColor = JSON.stringify(value.heatmap.heatmapColor);
  const heatmapPaletteOptions: Array<{ label: string; value: string }> =
    heatmapPalettes.map((palette) => ({
      label: palette.label,
      value: JSON.stringify(palette.value),
    }));
  if (
    !heatmapPaletteOptions.some(
      (option) => option.value === currentHeatmapColor,
    )
  ) {
    heatmapPaletteOptions.unshift({
      label: "当前自定义色带",
      value: currentHeatmapColor,
    });
  }

  type LinePattern = "solid" | "dash" | "dot";
  const dashHead = value.line.lineDasharray[0] ?? 1;
  const dashGap = value.line.lineDasharray[1] ?? 0;
  const linePattern: LinePattern =
    dashGap <= 0 ? "solid" : dashHead <= 1 ? "dot" : "dash";

  function updateLinePattern(pattern: LinePattern) {
    const nextDasharray: [number, number] =
      pattern === "solid" ? [1, 0] : pattern === "dash" ? [3, 2] : [1, 2];
    updateLine("lineDasharray", nextDasharray);
  }

  function updateLabelEnabled(enabled: boolean) {
    updateSymbol("textField", enabled ? defaultLabelField : "");
  }

  function updateLabelCollision(mode: "avoid" | "overlap") {
    const allowOverlap = mode === "overlap";
    onChange({
      ...value,
      symbol: {
        ...value.symbol,
        textAllowOverlap: allowOverlap,
        textIgnorePlacement: allowOverlap,
      },
    });
  }

  return (
    <Card
      className="symbolization-card symbolization-card-redesigned"
      size="small"
      title={<SymbolizationTitle title="图层样式" onApply={onApply} />}
    >
      <Space orientation="vertical" className="full-width symbolization-stack">
        <section className="symbolization-section">
          <div className="symbolization-section-head">
            <div>
              <Typography.Text strong>表达方式</Typography.Text>
              <Typography.Text type="secondary">
                {geometrySummary} · 先选择图层要如何被看见
              </Typography.Text>
            </div>
          </div>
          {geometry.hasPoint && (
            <ControlRow label="点数据表达">
              <Segmented
                block
                value={value.pointMode}
                options={[
                  { value: "circle", label: "单点符号" },
                  { value: "symbol", label: "图标标记" },
                  { value: "heatmap", label: "密度热力" },
                ]}
                onChange={(mode) =>
                  updateRoot(
                    "pointMode",
                    mode as VectorSymbolization["pointMode"],
                  )
                }
              />
            </ControlRow>
          )}
          <div className="symbolization-preset-grid">
            {geometry.hasPoint && (
              <>
                <Button
                  className={
                    value.pointMode === "circle"
                      ? "symbolization-preset-button is-active"
                      : "symbolization-preset-button"
                  }
                  onClick={() => applyPreset("point")}
                >
                  <span>调查点</span>
                  <small>清晰展示单个采样点</small>
                </Button>
                <Button
                  className={
                    value.pointMode === "symbol"
                      ? "symbolization-preset-button is-active"
                      : "symbolization-preset-button"
                  }
                  onClick={() => applyPreset("symbol")}
                >
                  <span>监测站</span>
                  <small>用图标强调站点类别</small>
                </Button>
                <Button
                  className={
                    value.pointMode === "heatmap"
                      ? "symbolization-preset-button is-active"
                      : "symbolization-preset-button"
                  }
                  onClick={() => applyPreset("heatmap")}
                >
                  <span>密度热力</span>
                  <small>查看点位聚集强弱</small>
                </Button>
              </>
            )}
            {geometry.hasLine && (
              <>
                <Button
                  className="symbolization-preset-button"
                  onClick={() => applyPreset("line")}
                >
                  <span>河流线</span>
                  <small>连续线条，适合河道边界</small>
                </Button>
                <Button
                  className="symbolization-preset-button"
                  onClick={() => {
                    applyPreset("line");
                    updateLinePattern("dash");
                  }}
                >
                  <span>虚线辅助线</span>
                  <small>适合规划线和参考线</small>
                </Button>
              </>
            )}
            {geometry.hasPolygon && (
              <>
                <Button
                  className="symbolization-preset-button"
                  onClick={() => applyPreset("fill")}
                >
                  <span>保护区</span>
                  <small>半透明填充保留底图信息</small>
                </Button>
                <Button
                  className="symbolization-preset-button"
                  onClick={() =>
                    onChange({
                      ...value,
                      fill: {
                        ...value.fill,
                        fillColor: "#8fb9d9",
                        fillOpacity: 0.36,
                        fillOutlineColor: "#174f46",
                      },
                    })
                  }
                >
                  <span>分区填色</span>
                  <small>弱化填充，突出边界</small>
                </Button>
              </>
            )}
          </div>
        </section>

        <section className="symbolization-section">
          <div className="symbolization-section-head">
            <div>
              <Typography.Text strong>基础样式</Typography.Text>
              <Typography.Text type="secondary">
                只保留最常改、最容易判断效果的样式项
              </Typography.Text>
            </div>
          </div>
          <Space
            orientation="vertical"
            className="full-width symbolization-stack"
          >
            <ControlRow label="图层透明度">
              <Slider
                value={value.opacity}
                min={5}
                max={100}
                onChange={(opacity) => updateRoot("opacity", opacity)}
              />
            </ControlRow>

            {geometry.hasPoint && value.pointMode === "circle" && (
              <>
                <ColorField
                  label="点颜色"
                  value={value.circle.circleColor}
                  onChange={(next) => updateCircle("circleColor", next)}
                />
                <NumberField
                  label="点大小"
                  value={value.circle.circleRadius}
                  min={2}
                  max={80}
                  step={0.5}
                  onChange={(next) => updateCircle("circleRadius", next)}
                />
                <ColorField
                  label="描边颜色"
                  value={value.circle.circleStrokeColor}
                  onChange={(next) => updateCircle("circleStrokeColor", next)}
                />
                <NumberField
                  label="描边粗细"
                  value={value.circle.circleStrokeWidth}
                  min={0}
                  max={20}
                  step={0.2}
                  onChange={(next) => updateCircle("circleStrokeWidth", next)}
                />
              </>
            )}

            {geometry.hasPoint && value.pointMode === "symbol" && (
              <>
                <ControlRow label="图标类型">
                  <Select
                    className="full-width"
                    showSearch
                    value={selectedIconImage}
                    options={iconImageOptions}
                    onChange={(next) => updateSymbol("iconImage", next)}
                  />
                </ControlRow>
                <ColorField
                  label="图标颜色"
                  value={value.symbol.iconColor}
                  onChange={(next) => updateSymbol("iconColor", next)}
                />
                <NumberField
                  label="图标大小"
                  value={value.symbol.iconSize}
                  min={0.2}
                  max={5}
                  step={0.05}
                  onChange={(next) => updateSymbol("iconSize", next)}
                />
              </>
            )}

            {geometry.hasPoint && value.pointMode === "heatmap" && (
              <>
                <Alert
                  type="info"
                  showIcon
                  title={
                    selectedHeatmapWeightField
                      ? `密度热力按 ${selectedHeatmapWeightField} 字段加权，缩放时自动淡出为点位明细。`
                      : "密度热力用于显示点位聚集程度，当前按点位数量计算密度，缩放时自动淡出为点位明细。"
                  }
                />
                <ControlRow label="权重字段">
                  <Select
                    className="full-width"
                    value={selectedHeatmapWeightField}
                    options={heatmapWeightFieldOptions}
                    onChange={(next) =>
                      updateHeatmap("heatmapWeightField", next)
                    }
                  />
                </ControlRow>
                {selectedHeatmapWeightField && (
                  <NumberField
                    label="权重上限"
                    value={value.heatmap.heatmapWeightFieldMax ?? 1}
                    min={1}
                    max={100000}
                    step={1}
                    onChange={(next) =>
                      updateHeatmap("heatmapWeightFieldMax", next)
                    }
                  />
                )}
                <ControlRow label="热力色带">
                  <Select
                    className="full-width"
                    value={currentHeatmapColor}
                    options={heatmapPaletteOptions}
                    onChange={(next) =>
                      updateHeatmap("heatmapColor", JSON.parse(next))
                    }
                  />
                </ControlRow>
                <NumberField
                  label="影响半径"
                  value={value.heatmap.heatmapRadius ?? 24}
                  min={1}
                  max={80}
                  step={1}
                  onChange={(next) => updateHeatmap("heatmapRadius", next)}
                />
                <NumberField
                  label="热力强度"
                  value={value.heatmap.heatmapIntensity ?? 0.9}
                  min={0}
                  max={3}
                  step={0.1}
                  onChange={(next) => updateHeatmap("heatmapIntensity", next)}
                />
                <NumberField
                  label="热力透明度"
                  value={value.heatmap.heatmapOpacity ?? 0.78}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(next) => updateHeatmap("heatmapOpacity", next)}
                />
              </>
            )}

            {geometry.hasLine && (
              <>
                <Divider className="symbolization-divider" />
                <ColorField
                  label="线颜色"
                  value={value.line.lineColor}
                  onChange={(next) => updateLine("lineColor", next)}
                />
                <NumberField
                  label="线宽"
                  value={value.line.lineWidth}
                  min={0}
                  max={40}
                  step={0.2}
                  onChange={(next) => updateLine("lineWidth", next)}
                />
                <ControlRow label="线型">
                  <Segmented
                    block
                    value={linePattern}
                    options={[
                      { value: "solid", label: "实线" },
                      { value: "dash", label: "虚线" },
                      { value: "dot", label: "点线" },
                    ]}
                    onChange={(next) => updateLinePattern(next as LinePattern)}
                  />
                </ControlRow>
              </>
            )}

            {geometry.hasPolygon && (
              <>
                <Divider className="symbolization-divider" />
                <ColorField
                  label="填充颜色"
                  value={value.fill.fillColor}
                  onChange={(next) => updateFill("fillColor", next)}
                />
                <NumberField
                  label="填充透明度"
                  value={value.fill.fillOpacity}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(next) => updateFill("fillOpacity", next)}
                />
                <ColorField
                  label="边界颜色"
                  value={value.fill.fillOutlineColor}
                  onChange={(next) => updateFill("fillOutlineColor", next)}
                />
              </>
            )}
          </Space>
        </section>

        {geometry.hasPoint && value.pointMode !== "heatmap" && (
          <section className="symbolization-section">
            <div className="symbolization-section-head">
              <div>
                <Typography.Text strong>标注</Typography.Text>
                <Typography.Text type="secondary">
                  点位名称、编号等文字信息在这里统一设置
                </Typography.Text>
              </div>
            </div>
            <Space
              orientation="vertical"
              className="full-width symbolization-stack"
            >
              <ControlRow label="显示标注">
                <Switch
                  checked={labelEnabled}
                  disabled={!defaultLabelField && !labelEnabled}
                  onChange={updateLabelEnabled}
                />
              </ControlRow>
              <ControlRow label="标注字段">
                <Select
                  className="full-width"
                  disabled={!labelEnabled}
                  value={value.symbol.textField}
                  options={labelFieldOptions}
                  onChange={(next) => updateSymbol("textField", next)}
                />
              </ControlRow>
              <NumberField
                label="字号"
                value={value.symbol.textSize}
                min={8}
                max={48}
                step={1}
                onChange={(next) => updateSymbol("textSize", next)}
              />
              <ColorField
                label="文字颜色"
                value={value.symbol.textColor}
                onChange={(next) => updateSymbol("textColor", next)}
              />
              <ColorField
                label="描边颜色"
                value={value.symbol.textHaloColor}
                onChange={(next) => updateSymbol("textHaloColor", next)}
              />
              <ControlRow label="避让策略">
                <Segmented
                  block
                  value={value.symbol.textAllowOverlap ? "overlap" : "avoid"}
                  options={[
                    { value: "avoid", label: "自动避让" },
                    { value: "overlap", label: "允许重叠" },
                  ]}
                  onChange={(next) =>
                    updateLabelCollision(next as "avoid" | "overlap")
                  }
                />
              </ControlRow>
            </Space>
          </section>
        )}

        <details className="symbolization-advanced">
          <summary>
            <span>高级设置</span>
          </summary>
          <Space
            orientation="vertical"
            className="full-width symbolization-stack"
          >
            <Button size="small" onClick={copyJson}>
              复制符号化 JSON
            </Button>

            {geometry.hasPoint && value.pointMode === "circle" && (
              <>
                <Typography.Text strong>圆点高级</Typography.Text>
                <NumberField
                  label="circle-blur"
                  value={value.circle.circleBlur}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(next) => updateCircle("circleBlur", next)}
                />
                <NumberField
                  label="circle-opacity"
                  value={value.circle.circleOpacity}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(next) => updateCircle("circleOpacity", next)}
                />
                <NumberField
                  label="circle-sort-key"
                  value={value.circle.circleSortKey}
                  step={1}
                  onChange={(next) => updateCircle("circleSortKey", next)}
                />
                <Tuple2Field
                  label="circle-translate"
                  value={value.circle.circleTranslate}
                  onChange={(next) => updateCircle("circleTranslate", next)}
                />
              </>
            )}

            {geometry.hasPoint && value.pointMode === "symbol" && (
              <>
                <Typography.Text strong>图标高级</Typography.Text>
                <TextField
                  label="icon-image"
                  value={value.symbol.iconImage}
                  onChange={(next) => updateSymbol("iconImage", next)}
                />
                <SelectField
                  label="symbol-placement"
                  value={value.symbol.symbolPlacement}
                  options={["point", "line", "line-center"]}
                  onChange={(next) => updateSymbol("symbolPlacement", next)}
                />
                <NumberField
                  label="symbol-spacing"
                  value={value.symbol.symbolSpacing}
                  min={1}
                  step={1}
                  onChange={(next) => updateSymbol("symbolSpacing", next)}
                />
                <NumberField
                  label="icon-padding"
                  value={value.symbol.iconPadding}
                  min={0}
                  step={1}
                  onChange={(next) => updateSymbol("iconPadding", next)}
                />
                <NumberField
                  label="icon-rotate"
                  value={value.symbol.iconRotate}
                  min={-360}
                  max={360}
                  step={1}
                  onChange={(next) => updateSymbol("iconRotate", next)}
                />
                <SelectField
                  label="icon-anchor"
                  value={value.symbol.iconAnchor}
                  options={anchorOptions}
                  onChange={(next) => updateSymbol("iconAnchor", next)}
                />
                <Tuple2Field
                  label="icon-offset"
                  value={value.symbol.iconOffset}
                  onChange={(next) => updateSymbol("iconOffset", next)}
                />
                <Tuple4Field
                  label="icon-text-fit-padding"
                  value={value.symbol.iconTextFitPadding}
                  onChange={(next) => updateSymbol("iconTextFitPadding", next)}
                />
                <BooleanField
                  label="icon-allow-overlap"
                  value={value.symbol.iconAllowOverlap}
                  onChange={(next) => updateSymbol("iconAllowOverlap", next)}
                />
              </>
            )}

            {geometry.hasPoint && value.pointMode === "heatmap" && (
              <>
                <Typography.Text strong>热力高级</Typography.Text>
                <NumberField
                  label="heatmap-weight"
                  value={value.heatmap.heatmapWeight ?? 0.72}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(next) => updateHeatmap("heatmapWeight", next)}
                />
              </>
            )}

            {geometry.hasPoint && value.pointMode !== "heatmap" && (
              <>
                <Divider className="symbolization-divider" />
                <Typography.Text strong>标注高级</Typography.Text>
                <TextListField
                  label="text-font"
                  value={value.symbol.textFont}
                  onChange={(next) => updateSymbol("textFont", next)}
                />
                <NumberField
                  label="text-max-width"
                  value={value.symbol.textMaxWidth}
                  min={0}
                  step={0.5}
                  onChange={(next) => updateSymbol("textMaxWidth", next)}
                />
                <Tuple2Field
                  label="text-offset"
                  value={value.symbol.textOffset}
                  onChange={(next) => updateSymbol("textOffset", next)}
                />
                <MultiSelectField
                  label="text-variable-anchor"
                  value={value.symbol.textVariableAnchor}
                  options={anchorOptions}
                  onChange={(next) =>
                    updateSymbol(
                      "textVariableAnchor",
                      next as SymbolLayerSymbolization["textVariableAnchor"],
                    )
                  }
                />
                <MultiSelectField
                  label="text-writing-mode"
                  value={value.symbol.textWritingMode}
                  options={["horizontal", "vertical"]}
                  onChange={(next) =>
                    updateSymbol(
                      "textWritingMode",
                      next as SymbolLayerSymbolization["textWritingMode"],
                    )
                  }
                />
                <NumberField
                  label="text-halo-width"
                  value={value.symbol.textHaloWidth}
                  min={0}
                  max={20}
                  step={0.5}
                  onChange={(next) => updateSymbol("textHaloWidth", next)}
                />
              </>
            )}

            {geometry.hasLine && (
              <>
                <Divider className="symbolization-divider" />
                <Typography.Text strong>线高级</Typography.Text>
                <NumberField
                  label="line-opacity"
                  value={value.line.lineOpacity}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(next) => updateLine("lineOpacity", next)}
                />
                <SelectField
                  label="line-cap"
                  value={value.line.lineCap}
                  options={["butt", "round", "square"]}
                  onChange={(next) => updateLine("lineCap", next)}
                />
                <SelectField
                  label="line-join"
                  value={value.line.lineJoin}
                  options={["bevel", "round", "miter", "none"]}
                  onChange={(next) => updateLine("lineJoin", next)}
                />
                <Tuple2Field
                  label="line-dasharray"
                  value={value.line.lineDasharray}
                  onChange={(next) => updateLine("lineDasharray", next)}
                />
                <Tuple2Field
                  label="line-translate"
                  value={value.line.lineTranslate}
                  onChange={(next) => updateLine("lineTranslate", next)}
                />
              </>
            )}

            {geometry.hasPolygon && (
              <>
                <Divider className="symbolization-divider" />
                <Typography.Text strong>面高级</Typography.Text>
                <BooleanField
                  label="fill-antialias"
                  value={value.fill.fillAntialias}
                  onChange={(next) => updateFill("fillAntialias", next)}
                />
                <NumberField
                  label="fill-sort-key"
                  value={value.fill.fillSortKey}
                  step={1}
                  onChange={(next) => updateFill("fillSortKey", next)}
                />
                <Tuple2Field
                  label="fill-translate"
                  value={value.fill.fillTranslate}
                  onChange={(next) => updateFill("fillTranslate", next)}
                />
              </>
            )}
          </Space>
        </details>
      </Space>
    </Card>
  );
}

export function RasterSymbolizationEditor({
  value,
  bands,
  onChange,
  onApply,
  datasetId,
}: {
  value: RasterSymbolization;
  bands: RasterBandMetadata[];
  onChange: (value: RasterSymbolization) => void;
  onApply?: () => void;
  datasetId?: number;
}) {
  const { message } = App.useApp();
  const [classifying, setClassifying] = useState(false);
  const bandOptions = (
    bands.length > 0
      ? bands
      : [{ band: 1, description: "波段 1", type: "Byte" } as RasterBandMetadata]
  ).map((band) => ({
    value: band.band,
    label: `${band.band} · ${band.description || band.type}`,
  }));
  const alphaBandOptions = [
    { value: "mask", label: "掩膜" },
    { value: "none", label: "无" },
    ...bandOptions,
  ];
  const selectedBands =
    value.mode === "rgb"
      ? [value.bands[0] ?? 1, value.bands[1] ?? 1, value.bands[2] ?? 1]
      : [value.bands[0] ?? 1];
  const uniqueBand = selectedBands[0] ?? 1;
  const uniqueBandMeta = bands.find((band) => band.band === uniqueBand);
  const uniqueBandIsInteger = uniqueBandMeta
    ? isIntegerRasterBand(uniqueBandMeta)
    : true;

  function update(next: Partial<RasterSymbolization>) {
    onChange({ ...value, ...next });
  }

  function updateBand(index: number, band: number) {
    const nextBands =
      value.mode === "rgb"
        ? [value.bands[0] ?? 1, value.bands[1] ?? 1, value.bands[2] ?? 1]
        : [value.bands[0] ?? 1];
    nextBands[index] = band;
    update({ bands: nextBands });
  }

  function updateMode(mode: RasterSymbolization["mode"]) {
    const current = value.bands.length > 0 ? value.bands : [1];
    const nextBands =
      mode === "rgb"
        ? [
            current[0] ?? 1,
            current[1] ?? current[0] ?? 1,
            current[2] ?? current[1] ?? current[0] ?? 1,
          ]
        : [current[0] ?? 1];
    update({ mode, bands: nextBands });
  }

  const copyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      message.success("符号化方案 JSON 已复制");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "复制失败");
    }
  }, [value, message]);

  async function classifyUniqueValues() {
    if (!datasetId) {
      message.warning("缺少栅格数据集编号");
      return;
    }
    if (!uniqueBandIsInteger) {
      message.warning("唯一值分类仅支持整型波段");
      return;
    }
    setClassifying(true);
    try {
      const result = await api.classifyRasterUniqueValues(
        datasetId,
        uniqueBand,
      );
      update({
        mode: "unique",
        bands: [uniqueBand],
        uniqueValues: result.items,
      });
      message.success(`已分类 ${result.items.length} 个唯一值`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "唯一值分类失败");
    } finally {
      setClassifying(false);
    }
  }

  function updateStretchBand(
    band: number,
    key: "min" | "max",
    nextValue: number,
  ) {
    const bandKey = String(band);
    const current = value.stretch.perBand[bandKey] ?? { min: 0, max: 255 };
    update({
      stretch: {
        ...value.stretch,
        perBand: {
          ...value.stretch.perBand,
          [bandKey]: { ...current, [key]: nextValue },
        },
      },
    });
  }

  function updateUniqueColor(index: number, color: string) {
    const next = value.uniqueValues.map((item, itemIndex) =>
      itemIndex === index ? { ...item, color } : item,
    );
    update({ uniqueValues: next });
  }

  return (
    <Card
      className="symbolization-card"
      size="small"
      title={
        <SymbolizationTitle
          title="栅格符号化"
          onApply={onApply}
          onCopy={copyJson}
        />
      }
    >
      <Tabs
        size="small"
        items={[
          {
            key: "render",
            label: "渲染",
            children: (
              <Space
                orientation="vertical"
                className="full-width symbolization-stack"
              >
                <ControlRow label="透明度">
                  <Slider
                    value={value.opacity}
                    min={5}
                    max={100}
                    onChange={(opacity) => update({ opacity })}
                  />
                </ControlRow>
                <ControlRow label="模式">
                  <Segmented
                    block
                    value={value.mode}
                    options={[
                      { value: "gray", label: "灰度" },
                      { value: "rgb", label: "RGB" },
                      { value: "pseudocolor", label: "伪彩色" },
                      { value: "unique", label: "唯一值" },
                    ]}
                    onChange={(mode) =>
                      updateMode(mode as RasterSymbolization["mode"])
                    }
                  />
                </ControlRow>
                {selectedBands.map((band, index) => {
                  const label =
                    value.mode === "rgb"
                      ? (rgbBandLabels[index] ?? "band")
                      : "波段";
                  return (
                    <ControlRow key={label} label={label}>
                      <Select
                        className="full-width"
                        value={band}
                        options={bandOptions}
                        onChange={(nextBand) => updateBand(index, nextBand)}
                      />
                    </ControlRow>
                  );
                })}
                {value.mode === "rgb" && (
                  <ControlRow label="A">
                    <Select
                      className="full-width"
                      value={value.alphaBand ?? "none"}
                      options={alphaBandOptions}
                      onChange={(nextBand) =>
                        update({
                          alphaBand:
                            nextBand === "none"
                              ? null
                              : (nextBand as RasterSymbolization["alphaBand"]),
                        })
                      }
                    />
                  </ControlRow>
                )}
                <BooleanField
                  label="启用 nodata"
                  value={value.nodata.enabled}
                  onChange={(enabled) =>
                    update({ nodata: { ...value.nodata, enabled } })
                  }
                />
                {value.mode === "pseudocolor" && (
                  <SelectField
                    label="色带"
                    value={value.palette}
                    options={
                      ["poplar", "viridis", "terrain", "thermal"] as const
                    }
                    onChange={(palette) => update({ palette })}
                  />
                )}
              </Space>
            ),
          },
          {
            key: "stretch",
            label: "拉伸",
            children: (
              <Space
                orientation="vertical"
                className="full-width symbolization-stack"
              >
                <BooleanField
                  label="启用拉伸"
                  value={value.stretch.enabled}
                  onChange={(enabled) =>
                    update({ stretch: { ...value.stretch, enabled } })
                  }
                />
                {Array.from(new Set(selectedBands)).map((band) => {
                  const stretch = value.stretch.perBand[String(band)] ?? {
                    min: 0,
                    max: 255,
                  };
                  return (
                    <Space.Compact key={band} className="full-width">
                      <Input
                        className="stretch-band-label"
                        value={`波段 ${band}`}
                        disabled
                      />
                      <InputNumber
                        value={stretch.min}
                        step={1}
                        onChange={(next) =>
                          updateStretchBand(
                            band,
                            "min",
                            typeof next === "number" ? next : 0,
                          )
                        }
                      />
                      <InputNumber
                        value={stretch.max}
                        step={1}
                        onChange={(next) =>
                          updateStretchBand(
                            band,
                            "max",
                            typeof next === "number" ? next : 255,
                          )
                        }
                      />
                    </Space.Compact>
                  );
                })}
              </Space>
            ),
          },
          {
            key: "unique",
            label: "唯一值",
            children: (
              <Space
                orientation="vertical"
                className="full-width symbolization-stack"
              >
                <ControlRow label="分类波段">
                  <Select
                    className="full-width"
                    value={uniqueBand}
                    options={bandOptions}
                    onChange={(nextBand) =>
                      update({ mode: "unique", bands: [nextBand] })
                    }
                  />
                </ControlRow>
                {!uniqueBandIsInteger && (
                  <Alert
                    type="warning"
                    showIcon
                    title="唯一值分类仅支持整型波段，浮点型波段不适用。"
                  />
                )}
                <Button
                  block
                  loading={classifying}
                  disabled={!datasetId || !uniqueBandIsInteger}
                  onClick={classifyUniqueValues}
                >
                  分类
                </Button>
                {value.uniqueValues.length === 0 && (
                  <Typography.Text type="secondary">
                    选择整型波段后点击分类，即时计算唯一值。
                  </Typography.Text>
                )}
                {value.uniqueValues.map((item) => (
                  <ControlRow
                    key={item.value}
                    label={item.label || String(item.value)}
                  >
                    <ColorPicker
                      value={item.color}
                      showText
                      onChangeComplete={(color) =>
                        updateUniqueColor(
                          value.uniqueValues.indexOf(item),
                          color.toHexString(),
                        )
                      }
                    />
                  </ControlRow>
                ))}
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );
}

function isIntegerRasterBand(band: RasterBandMetadata) {
  const type = band.type.toLowerCase();
  return (
    band.isInteger ||
    ((type.includes("int") || type.includes("byte")) && !type.includes("float"))
  );
}

function SymbolizationTitle({
  title,
  onApply,
  onCopy,
}: {
  title: string;
  onApply?: () => void;
  onCopy?: () => void;
}) {
  return (
    <div className="symbolization-title">
      <span>{title}</span>
      <Space size={4}>
        {onCopy && (
          <Button size="small" autoInsertSpace={false} onClick={onCopy}>
            复制 JSON
          </Button>
        )}
        {onApply && (
          <Button
            type="primary"
            size="small"
            autoInsertSpace={false}
            onClick={onApply}
          >
            确定
          </Button>
        )}
      </Space>
    </div>
  );
}

function ControlRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="symbolization-control-row">
      <span title={label}>{displaySymbolizationLabel(label)}</span>
      <div>{children}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <ControlRow label={label}>
      <InputNumber
        className="full-width"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(next) => onChange(typeof next === "number" ? next : 0)}
      />
    </ControlRow>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ControlRow label={label}>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </ControlRow>
  );
}

function TextListField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <ControlRow label={label}>
      <Select
        className="full-width"
        mode="tags"
        value={value}
        onChange={onChange}
      />
    </ControlRow>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ControlRow label={label}>
      <ColorPicker
        value={value}
        showText
        onChangeComplete={(color) => onChange(color.toHexString())}
      />
    </ControlRow>
  );
}

function SelectField<Option extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Option;
  options: readonly Option[];
  onChange: (value: Option) => void;
}) {
  return (
    <ControlRow label={label}>
      <Select
        className="full-width"
        value={value}
        options={options.map((option) => ({
          value: option,
          label: displaySymbolizationOption(option),
        }))}
        onChange={onChange}
      />
    </ControlRow>
  );
}

function MultiSelectField<Option extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Option[];
  options: readonly Option[];
  onChange: (value: Option[]) => void;
}) {
  return (
    <ControlRow label={label}>
      <Select
        className="full-width"
        mode="multiple"
        value={value}
        options={options.map((option) => ({
          value: option,
          label: displaySymbolizationOption(option),
        }))}
        onChange={onChange}
      />
    </ControlRow>
  );
}

function BooleanField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <ControlRow label={label}>
      <Switch checked={value} onChange={onChange} />
    </ControlRow>
  );
}

function Tuple2Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: [number, number];
  onChange: (value: [number, number]) => void;
}) {
  return (
    <ControlRow label={label}>
      <Space.Compact className="full-width">
        <InputNumber
          value={value[0]}
          onChange={(next) =>
            onChange([typeof next === "number" ? next : 0, value[1]])
          }
        />
        <InputNumber
          value={value[1]}
          onChange={(next) =>
            onChange([value[0], typeof next === "number" ? next : 0])
          }
        />
      </Space.Compact>
    </ControlRow>
  );
}

function Tuple4Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: [number, number, number, number];
  onChange: (value: [number, number, number, number]) => void;
}) {
  function update(index: number, next: number | null) {
    const tuple: [number, number, number, number] = [...value];
    tuple[index] = typeof next === "number" ? next : 0;
    onChange(tuple);
  }

  return (
    <ControlRow label={label}>
      <Space.Compact className="full-width">
        <InputNumber value={value[0]} onChange={(next) => update(0, next)} />
        <InputNumber value={value[1]} onChange={(next) => update(1, next)} />
        <InputNumber value={value[2]} onChange={(next) => update(2, next)} />
        <InputNumber value={value[3]} onChange={(next) => update(3, next)} />
      </Space.Compact>
    </ControlRow>
  );
}
