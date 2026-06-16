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
import type {
  Alignment,
  Anchor,
  CircleSymbolization,
  FillSymbolization,
  GroupSymbolization,
  LineSymbolization,
  MapViewport,
  RasterSymbolization,
  SymbolLayerSymbolization,
  VectorSymbolization,
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

const alignmentOptions: Alignment[] = ["auto", "map", "viewport"];
const mapViewportOptions: MapViewport[] = ["map", "viewport"];
const rgbBandLabels = ["R", "G", "B"] as const;

export function GroupSymbolizationEditor({
  value,
  onChange,
}: {
  value: GroupSymbolization;
  onChange: (value: GroupSymbolization) => void;
}) {
  return (
    <Card className="symbolization-card" size="small" title="图层组符号化">
      <ControlRow label="透明度">
        <Slider
          value={value.opacity}
          min={5}
          max={100}
          onChange={(opacity) => onChange({ ...value, opacity })}
        />
      </ControlRow>
    </Card>
  );
}

export function VectorSymbolizationEditor({
  value,
  fields,
  onChange,
  onApply,
}: {
  value: VectorSymbolization;
  fields: ResourceField[];
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

  const textFieldOptions = [
    { value: "", label: "不显示" },
    ...fields.map((field) => ({ value: `{${field.name}}`, label: field.name })),
  ];

  return (
    <Card
      className="symbolization-card"
      size="small"
      title={
        <SymbolizationTitle
          title="矢量符号化"
          onApply={onApply}
          onCopy={copyJson}
        />
      }
    >
      <Tabs
        size="small"
        items={[
          {
            key: "common",
            label: "通用",
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
                    onChange={(opacity) => updateRoot("opacity", opacity)}
                  />
                </ControlRow>
                <ControlRow label="点图层类型">
                  <Segmented
                    block
                    value={value.pointMode}
                    options={[
                      { value: "circle", label: "circle" },
                      { value: "symbol", label: "symbol" },
                    ]}
                    onChange={(mode) =>
                      updateRoot(
                        "pointMode",
                        mode as VectorSymbolization["pointMode"],
                      )
                    }
                  />
                </ControlRow>
              </Space>
            ),
          },
          {
            key: "circle",
            label: "circle",
            children: (
              <Space
                orientation="vertical"
                className="full-width symbolization-stack"
              >
                <ColorField
                  label="circle-color"
                  value={value.circle.circleColor}
                  onChange={(next) => updateCircle("circleColor", next)}
                />
                <NumberField
                  label="circle-radius"
                  value={value.circle.circleRadius}
                  min={0}
                  max={80}
                  step={0.5}
                  onChange={(next) => updateCircle("circleRadius", next)}
                />
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
                <ColorField
                  label="circle-stroke-color"
                  value={value.circle.circleStrokeColor}
                  onChange={(next) => updateCircle("circleStrokeColor", next)}
                />
                <NumberField
                  label="circle-stroke-width"
                  value={value.circle.circleStrokeWidth}
                  min={0}
                  max={20}
                  step={0.2}
                  onChange={(next) => updateCircle("circleStrokeWidth", next)}
                />
                <NumberField
                  label="circle-stroke-opacity"
                  value={value.circle.circleStrokeOpacity}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(next) => updateCircle("circleStrokeOpacity", next)}
                />
                <SelectField
                  label="circle-pitch-alignment"
                  value={value.circle.circlePitchAlignment}
                  options={mapViewportOptions}
                  onChange={(next) =>
                    updateCircle("circlePitchAlignment", next)
                  }
                />
                <SelectField
                  label="circle-pitch-scale"
                  value={value.circle.circlePitchScale}
                  options={mapViewportOptions}
                  onChange={(next) => updateCircle("circlePitchScale", next)}
                />
                <Tuple2Field
                  label="circle-translate"
                  value={value.circle.circleTranslate}
                  onChange={(next) => updateCircle("circleTranslate", next)}
                />
                <SelectField
                  label="circle-translate-anchor"
                  value={value.circle.circleTranslateAnchor}
                  options={mapViewportOptions}
                  onChange={(next) =>
                    updateCircle("circleTranslateAnchor", next)
                  }
                />
                <NumberField
                  label="circle-emissive-strength"
                  value={value.circle.circleEmissiveStrength}
                  min={0}
                  max={5}
                  step={0.1}
                  onChange={(next) =>
                    updateCircle("circleEmissiveStrength", next)
                  }
                />
                <NumberField
                  label="circle-sort-key"
                  value={value.circle.circleSortKey}
                  step={1}
                  onChange={(next) => updateCircle("circleSortKey", next)}
                />
              </Space>
            ),
          },
          {
            key: "symbol",
            label: "symbol",
            children: (
              <Space
                orientation="vertical"
                className="full-width symbolization-stack"
              >
                <Typography.Text strong>layout</Typography.Text>
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
                  label="symbol-sort-key"
                  value={value.symbol.symbolSortKey}
                  step={1}
                  onChange={(next) => updateSymbol("symbolSortKey", next)}
                />
                <SelectField
                  label="symbol-z-order"
                  value={value.symbol.symbolZOrder}
                  options={["auto", "viewport-y", "source"]}
                  onChange={(next) => updateSymbol("symbolZOrder", next)}
                />
                <BooleanField
                  label="symbol-avoid-edges"
                  value={value.symbol.symbolAvoidEdges}
                  onChange={(next) => updateSymbol("symbolAvoidEdges", next)}
                />
                <Divider className="symbolization-divider" />
                <Typography.Text strong>icon layout</Typography.Text>
                <TextField
                  label="icon-image"
                  value={value.symbol.iconImage}
                  onChange={(next) => updateSymbol("iconImage", next)}
                />
                <NumberField
                  label="icon-size"
                  value={value.symbol.iconSize}
                  min={0}
                  max={10}
                  step={0.05}
                  onChange={(next) => updateSymbol("iconSize", next)}
                />
                <Tuple2Field
                  label="icon-size-scale-range"
                  value={value.symbol.iconSizeScaleRange}
                  onChange={(next) => updateSymbol("iconSizeScaleRange", next)}
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
                  label="icon-pitch-alignment"
                  value={value.symbol.iconPitchAlignment}
                  options={alignmentOptions}
                  onChange={(next) => updateSymbol("iconPitchAlignment", next)}
                />
                <SelectField
                  label="icon-rotation-alignment"
                  value={value.symbol.iconRotationAlignment}
                  options={alignmentOptions}
                  onChange={(next) =>
                    updateSymbol("iconRotationAlignment", next)
                  }
                />
                <SelectField
                  label="icon-text-fit"
                  value={value.symbol.iconTextFit}
                  options={["none", "width", "height", "both"]}
                  onChange={(next) => updateSymbol("iconTextFit", next)}
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
                <BooleanField
                  label="icon-ignore-placement"
                  value={value.symbol.iconIgnorePlacement}
                  onChange={(next) => updateSymbol("iconIgnorePlacement", next)}
                />
                <BooleanField
                  label="icon-optional"
                  value={value.symbol.iconOptional}
                  onChange={(next) => updateSymbol("iconOptional", next)}
                />
                <BooleanField
                  label="icon-keep-upright"
                  value={value.symbol.iconKeepUpright}
                  onChange={(next) => updateSymbol("iconKeepUpright", next)}
                />
                <Divider className="symbolization-divider" />
                <Typography.Text strong>icon paint</Typography.Text>
                <ColorField
                  label="icon-color"
                  value={value.symbol.iconColor}
                  onChange={(next) => updateSymbol("iconColor", next)}
                />
                <NumberField
                  label="icon-opacity"
                  value={value.symbol.iconOpacity}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(next) => updateSymbol("iconOpacity", next)}
                />
                <ColorField
                  label="icon-halo-color"
                  value={value.symbol.iconHaloColor}
                  onChange={(next) => updateSymbol("iconHaloColor", next)}
                />
                <NumberField
                  label="icon-halo-width"
                  value={value.symbol.iconHaloWidth}
                  min={0}
                  max={20}
                  step={0.5}
                  onChange={(next) => updateSymbol("iconHaloWidth", next)}
                />
                <NumberField
                  label="icon-halo-blur"
                  value={value.symbol.iconHaloBlur}
                  min={0}
                  max={20}
                  step={0.5}
                  onChange={(next) => updateSymbol("iconHaloBlur", next)}
                />
                <Tuple2Field
                  label="icon-translate"
                  value={value.symbol.iconTranslate}
                  onChange={(next) => updateSymbol("iconTranslate", next)}
                />
                <SelectField
                  label="icon-translate-anchor"
                  value={value.symbol.iconTranslateAnchor}
                  options={mapViewportOptions}
                  onChange={(next) => updateSymbol("iconTranslateAnchor", next)}
                />
                <NumberField
                  label="icon-emissive-strength"
                  value={value.symbol.iconEmissiveStrength}
                  min={0}
                  max={5}
                  step={0.1}
                  onChange={(next) =>
                    updateSymbol("iconEmissiveStrength", next)
                  }
                />
                <NumberField
                  label="icon-color-brightness-min"
                  value={value.symbol.iconColorBrightnessMin}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(next) =>
                    updateSymbol("iconColorBrightnessMin", next)
                  }
                />
                <NumberField
                  label="icon-color-brightness-max"
                  value={value.symbol.iconColorBrightnessMax}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(next) =>
                    updateSymbol("iconColorBrightnessMax", next)
                  }
                />
                <NumberField
                  label="icon-color-contrast"
                  value={value.symbol.iconColorContrast}
                  min={-1}
                  max={1}
                  step={0.05}
                  onChange={(next) => updateSymbol("iconColorContrast", next)}
                />
                <NumberField
                  label="icon-color-saturation"
                  value={value.symbol.iconColorSaturation}
                  min={-1}
                  max={1}
                  step={0.05}
                  onChange={(next) => updateSymbol("iconColorSaturation", next)}
                />
                <NumberField
                  label="icon-occlusion-opacity"
                  value={value.symbol.iconOcclusionOpacity}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(next) =>
                    updateSymbol("iconOcclusionOpacity", next)
                  }
                />
              </Space>
            ),
          },
          {
            key: "text",
            label: "text",
            children: (
              <Space
                orientation="vertical"
                className="full-width symbolization-stack"
              >
                <Typography.Text strong>text layout</Typography.Text>
                <ControlRow label="text-field">
                  <Select
                    className="full-width"
                    showSearch
                    value={value.symbol.textField}
                    options={textFieldOptions}
                    onChange={(next) => updateSymbol("textField", next)}
                  />
                </ControlRow>
                <TextListField
                  label="text-font"
                  value={value.symbol.textFont}
                  onChange={(next) => updateSymbol("textFont", next)}
                />
                <NumberField
                  label="text-size"
                  value={value.symbol.textSize}
                  min={0}
                  max={80}
                  step={0.5}
                  onChange={(next) => updateSymbol("textSize", next)}
                />
                <NumberField
                  label="text-max-width"
                  value={value.symbol.textMaxWidth}
                  min={0}
                  step={0.5}
                  onChange={(next) => updateSymbol("textMaxWidth", next)}
                />
                <NumberField
                  label="text-line-height"
                  value={value.symbol.textLineHeight}
                  min={0}
                  step={0.05}
                  onChange={(next) => updateSymbol("textLineHeight", next)}
                />
                <NumberField
                  label="text-letter-spacing"
                  value={value.symbol.textLetterSpacing}
                  min={0}
                  step={0.01}
                  onChange={(next) => updateSymbol("textLetterSpacing", next)}
                />
                <SelectField
                  label="text-justify"
                  value={value.symbol.textJustify}
                  options={["auto", "left", "center", "right"]}
                  onChange={(next) => updateSymbol("textJustify", next)}
                />
                <SelectField
                  label="text-anchor"
                  value={value.symbol.textAnchor}
                  options={anchorOptions}
                  onChange={(next) => updateSymbol("textAnchor", next)}
                />
                <Tuple2Field
                  label="text-offset"
                  value={value.symbol.textOffset}
                  onChange={(next) => updateSymbol("textOffset", next)}
                />
                <NumberField
                  label="text-radial-offset"
                  value={value.symbol.textRadialOffset}
                  step={0.1}
                  onChange={(next) => updateSymbol("textRadialOffset", next)}
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
                  label="text-padding"
                  value={value.symbol.textPadding}
                  min={0}
                  step={1}
                  onChange={(next) => updateSymbol("textPadding", next)}
                />
                <NumberField
                  label="text-rotate"
                  value={value.symbol.textRotate}
                  min={-360}
                  max={360}
                  step={1}
                  onChange={(next) => updateSymbol("textRotate", next)}
                />
                <SelectField
                  label="text-pitch-alignment"
                  value={value.symbol.textPitchAlignment}
                  options={alignmentOptions}
                  onChange={(next) => updateSymbol("textPitchAlignment", next)}
                />
                <SelectField
                  label="text-rotation-alignment"
                  value={value.symbol.textRotationAlignment}
                  options={alignmentOptions}
                  onChange={(next) =>
                    updateSymbol("textRotationAlignment", next)
                  }
                />
                <SelectField
                  label="text-transform"
                  value={value.symbol.textTransform}
                  options={["none", "uppercase", "lowercase"]}
                  onChange={(next) => updateSymbol("textTransform", next)}
                />
                <BooleanField
                  label="text-allow-overlap"
                  value={value.symbol.textAllowOverlap}
                  onChange={(next) => updateSymbol("textAllowOverlap", next)}
                />
                <BooleanField
                  label="text-ignore-placement"
                  value={value.symbol.textIgnorePlacement}
                  onChange={(next) => updateSymbol("textIgnorePlacement", next)}
                />
                <BooleanField
                  label="text-optional"
                  value={value.symbol.textOptional}
                  onChange={(next) => updateSymbol("textOptional", next)}
                />
                <BooleanField
                  label="text-keep-upright"
                  value={value.symbol.textKeepUpright}
                  onChange={(next) => updateSymbol("textKeepUpright", next)}
                />
                <Divider className="symbolization-divider" />
                <Typography.Text strong>text paint</Typography.Text>
                <ColorField
                  label="text-color"
                  value={value.symbol.textColor}
                  onChange={(next) => updateSymbol("textColor", next)}
                />
                <NumberField
                  label="text-opacity"
                  value={value.symbol.textOpacity}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(next) => updateSymbol("textOpacity", next)}
                />
                <ColorField
                  label="text-halo-color"
                  value={value.symbol.textHaloColor}
                  onChange={(next) => updateSymbol("textHaloColor", next)}
                />
                <NumberField
                  label="text-halo-width"
                  value={value.symbol.textHaloWidth}
                  min={0}
                  max={20}
                  step={0.5}
                  onChange={(next) => updateSymbol("textHaloWidth", next)}
                />
                <NumberField
                  label="text-halo-blur"
                  value={value.symbol.textHaloBlur}
                  min={0}
                  max={20}
                  step={0.5}
                  onChange={(next) => updateSymbol("textHaloBlur", next)}
                />
                <Tuple2Field
                  label="text-translate"
                  value={value.symbol.textTranslate}
                  onChange={(next) => updateSymbol("textTranslate", next)}
                />
                <SelectField
                  label="text-translate-anchor"
                  value={value.symbol.textTranslateAnchor}
                  options={mapViewportOptions}
                  onChange={(next) => updateSymbol("textTranslateAnchor", next)}
                />
                <NumberField
                  label="text-emissive-strength"
                  value={value.symbol.textEmissiveStrength}
                  min={0}
                  max={5}
                  step={0.1}
                  onChange={(next) =>
                    updateSymbol("textEmissiveStrength", next)
                  }
                />
                <NumberField
                  label="text-occlusion-opacity"
                  value={value.symbol.textOcclusionOpacity}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(next) =>
                    updateSymbol("textOcclusionOpacity", next)
                  }
                />
              </Space>
            ),
          },
          {
            key: "line",
            label: "line",
            children: (
              <Space
                orientation="vertical"
                className="full-width symbolization-stack"
              >
                <ColorField
                  label="line-color"
                  value={value.line.lineColor}
                  onChange={(next) => updateLine("lineColor", next)}
                />
                <NumberField
                  label="line-width"
                  value={value.line.lineWidth}
                  min={0}
                  max={40}
                  step={0.2}
                  onChange={(next) => updateLine("lineWidth", next)}
                />
                <NumberField
                  label="line-opacity"
                  value={value.line.lineOpacity}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(next) => updateLine("lineOpacity", next)}
                />
                <NumberField
                  label="line-blur"
                  value={value.line.lineBlur}
                  min={0}
                  max={10}
                  step={0.2}
                  onChange={(next) => updateLine("lineBlur", next)}
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
                <NumberField
                  label="line-miter-limit"
                  value={value.line.lineMiterLimit}
                  min={0}
                  step={0.1}
                  onChange={(next) => updateLine("lineMiterLimit", next)}
                />
                <NumberField
                  label="line-round-limit"
                  value={value.line.lineRoundLimit}
                  min={0}
                  step={0.05}
                  onChange={(next) => updateLine("lineRoundLimit", next)}
                />
                <NumberField
                  label="line-offset"
                  value={value.line.lineOffset}
                  step={0.5}
                  onChange={(next) => updateLine("lineOffset", next)}
                />
                <NumberField
                  label="line-gap-width"
                  value={value.line.lineGapWidth}
                  min={0}
                  step={0.5}
                  onChange={(next) => updateLine("lineGapWidth", next)}
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
                <SelectField
                  label="line-translate-anchor"
                  value={value.line.lineTranslateAnchor}
                  options={mapViewportOptions}
                  onChange={(next) => updateLine("lineTranslateAnchor", next)}
                />
                <NumberField
                  label="line-emissive-strength"
                  value={value.line.lineEmissiveStrength}
                  min={0}
                  max={5}
                  step={0.1}
                  onChange={(next) => updateLine("lineEmissiveStrength", next)}
                />
              </Space>
            ),
          },
          {
            key: "fill",
            label: "fill",
            children: (
              <Space
                orientation="vertical"
                className="full-width symbolization-stack"
              >
                <ColorField
                  label="fill-color"
                  value={value.fill.fillColor}
                  onChange={(next) => updateFill("fillColor", next)}
                />
                <NumberField
                  label="fill-opacity"
                  value={value.fill.fillOpacity}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(next) => updateFill("fillOpacity", next)}
                />
                <ColorField
                  label="fill-outline-color"
                  value={value.fill.fillOutlineColor}
                  onChange={(next) => updateFill("fillOutlineColor", next)}
                />
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
                <SelectField
                  label="fill-translate-anchor"
                  value={value.fill.fillTranslateAnchor}
                  options={mapViewportOptions}
                  onChange={(next) => updateFill("fillTranslateAnchor", next)}
                />
                <NumberField
                  label="fill-emissive-strength"
                  value={value.fill.fillEmissiveStrength}
                  min={0}
                  max={5}
                  step={0.1}
                  onChange={(next) => updateFill("fillEmissiveStrength", next)}
                />
              </Space>
            ),
          },
        ]}
      />
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
      : [{ band: 1, description: "Band 1", type: "Byte" } as RasterBandMetadata]
  ).map((band) => ({
    value: band.band,
    label: `${band.band} · ${band.description || band.type}`,
  }));
  const alphaBandOptions = [
    { value: "mask", label: "mask" },
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
                        value={`Band ${band}`}
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
      <span>{label}</span>
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
        options={options.map((option) => ({ value: option, label: option }))}
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
        options={options.map((option) => ({ value: option, label: option }))}
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
