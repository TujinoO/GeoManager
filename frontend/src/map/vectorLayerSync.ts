import type { Map as MapboxMap } from "mapbox-gl";
import type { LoadedLayer, LoadedVectorLayer } from "../types";
import { clamp, sourceIdFor } from "../utils/geometry";
import { removeVectorInteraction } from "./featureInteraction";
import { getMapState } from "./mapState";
import {
  buildVectorPaintProperties,
  removeStyleLayer,
  stateColor,
  stateNumber,
  upsertLayer,
} from "./styleHelpers";

export function addLoadedStyleLayers(
  map: MapboxMap,
  sourceId: string,
  layer: LoadedVectorLayer,
) {
  const style = layer.symbolization;
  const layerOpacity = clamp(style.opacity / 100, 0, 1);
  const {
    circleOpacity,
    circleStrokeOpacity,
    symbolIconOpacity,
    symbolTextOpacity,
    lineOpacity,
    fillOpacity,
  } = buildVectorPaintProperties(style, layerOpacity);

  upsertLayer(map, {
    id: `${sourceId}-fill`,
    type: "fill",
    source: sourceId,
    filter: ["==", ["geometry-type"], "Polygon"],
    layout: { "fill-sort-key": style.fill.fillSortKey },
    paint: {
      "fill-color": stateColor(style.fill.fillColor),
      "fill-opacity": stateNumber(
        fillOpacity,
        clamp(fillOpacity + 0.16, 0, 1),
        clamp(fillOpacity + 0.08, 0, 1),
      ),
      "fill-outline-color": style.fill.fillOutlineColor,
      "fill-antialias": style.fill.fillAntialias,
      "fill-translate": style.fill.fillTranslate,
      "fill-translate-anchor": style.fill.fillTranslateAnchor,
      "fill-emissive-strength": style.fill.fillEmissiveStrength,
    },
  });
  upsertLayer(map, {
    id: `${sourceId}-line`,
    type: "line",
    source: sourceId,
    filter: [
      "match",
      ["geometry-type"],
      ["LineString", "Polygon"],
      true,
      false,
    ],
    layout: {
      "line-cap": style.line.lineCap,
      "line-join": style.line.lineJoin,
      "line-miter-limit": style.line.lineMiterLimit,
      "line-round-limit": style.line.lineRoundLimit,
    },
    paint: {
      "line-color": stateColor(style.line.lineColor),
      "line-width": stateNumber(
        style.line.lineWidth,
        style.line.lineWidth + 2,
        style.line.lineWidth + 1,
      ),
      "line-opacity": stateNumber(
        lineOpacity,
        clamp(lineOpacity + 0.16, 0, 1),
        clamp(lineOpacity + 0.08, 0, 1),
      ),
      "line-blur": style.line.lineBlur,
      "line-offset": style.line.lineOffset,
      "line-gap-width": style.line.lineGapWidth,
      "line-dasharray": style.line.lineDasharray,
      "line-translate": style.line.lineTranslate,
      "line-translate-anchor": style.line.lineTranslateAnchor,
      "line-emissive-strength": style.line.lineEmissiveStrength,
    },
  });

  if (style.pointMode === "heatmap") {
    removeStyleLayer(map, `${sourceId}-point`);
    removeStyleLayer(map, `${sourceId}-symbol`);
    upsertLayer(map, {
      id: `${sourceId}-heatmap`,
      type: "heatmap",
      source: sourceId,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "heatmap-weight": style.heatmap.heatmapWeight,
        "heatmap-intensity": style.heatmap.heatmapIntensity,
        "heatmap-radius": style.heatmap.heatmapRadius,
        "heatmap-opacity": clamp(
          style.heatmap.heatmapOpacity * layerOpacity,
          0,
          1,
        ),
        "heatmap-color": style.heatmap.heatmapColor as never,
      },
    });
  } else if (style.pointMode === "circle") {
    removeStyleLayer(map, `${sourceId}-heatmap`);
    removeStyleLayer(map, `${sourceId}-symbol`);
    upsertLayer(map, {
      id: `${sourceId}-point`,
      type: "circle",
      source: sourceId,
      filter: ["==", ["geometry-type"], "Point"],
      layout: { "circle-sort-key": style.circle.circleSortKey },
      paint: {
        "circle-color": stateColor(style.circle.circleColor),
        "circle-radius": stateNumber(
          style.circle.circleRadius,
          style.circle.circleRadius + 3,
          style.circle.circleRadius + 1.8,
        ),
        "circle-blur": style.circle.circleBlur,
        "circle-opacity": stateNumber(
          circleOpacity,
          clamp(circleOpacity + 0.16, 0, 1),
          clamp(circleOpacity + 0.08, 0, 1),
        ),
        "circle-pitch-alignment": style.circle.circlePitchAlignment,
        "circle-pitch-scale": style.circle.circlePitchScale,
        "circle-stroke-color": style.circle.circleStrokeColor,
        "circle-stroke-opacity": circleStrokeOpacity,
        "circle-stroke-width": stateNumber(
          style.circle.circleStrokeWidth,
          style.circle.circleStrokeWidth + 1.2,
          style.circle.circleStrokeWidth + 0.6,
        ),
        "circle-translate": style.circle.circleTranslate,
        "circle-translate-anchor": style.circle.circleTranslateAnchor,
        "circle-emissive-strength": style.circle.circleEmissiveStrength,
      },
    });
  } else {
    removeStyleLayer(map, `${sourceId}-heatmap`);
    removeStyleLayer(map, `${sourceId}-point`);
    const symbolLayout: Record<string, unknown> = {
      "symbol-placement": style.symbol.symbolPlacement,
      "symbol-spacing": style.symbol.symbolSpacing,
      "symbol-avoid-edges": style.symbol.symbolAvoidEdges,
      "symbol-sort-key": style.symbol.symbolSortKey,
      "symbol-z-order": style.symbol.symbolZOrder,
      "icon-image": style.symbol.iconImage,
      "icon-size": style.symbol.iconSize,
      "icon-size-scale-range": style.symbol.iconSizeScaleRange,
      "icon-allow-overlap": style.symbol.iconAllowOverlap,
      "icon-ignore-placement": style.symbol.iconIgnorePlacement,
      "icon-optional": style.symbol.iconOptional,
      "icon-anchor": style.symbol.iconAnchor,
      "icon-offset": style.symbol.iconOffset,
      "icon-padding": style.symbol.iconPadding,
      "icon-keep-upright": style.symbol.iconKeepUpright,
      "icon-rotate": style.symbol.iconRotate,
      "icon-pitch-alignment": style.symbol.iconPitchAlignment,
      "icon-rotation-alignment": style.symbol.iconRotationAlignment,
      "icon-text-fit": style.symbol.iconTextFit,
      "icon-text-fit-padding": style.symbol.iconTextFitPadding,
      "text-field": style.symbol.textField,
      "text-font": style.symbol.textFont,
      "text-size": style.symbol.textSize,
      "text-max-width": style.symbol.textMaxWidth,
      "text-line-height": style.symbol.textLineHeight,
      "text-letter-spacing": style.symbol.textLetterSpacing,
      "text-justify": style.symbol.textJustify,
      "text-anchor": style.symbol.textAnchor,
      "text-offset": style.symbol.textOffset,
      "text-radial-offset": style.symbol.textRadialOffset,
      "text-writing-mode": style.symbol.textWritingMode,
      "text-padding": style.symbol.textPadding,
      "text-keep-upright": style.symbol.textKeepUpright,
      "text-allow-overlap": style.symbol.textAllowOverlap,
      "text-ignore-placement": style.symbol.textIgnorePlacement,
      "text-optional": style.symbol.textOptional,
      "text-rotate": style.symbol.textRotate,
      "text-pitch-alignment": style.symbol.textPitchAlignment,
      "text-rotation-alignment": style.symbol.textRotationAlignment,
      "text-transform": style.symbol.textTransform,
    };
    if (style.symbol.textVariableAnchor.length > 0) {
      symbolLayout["text-variable-anchor"] = style.symbol.textVariableAnchor;
    }
    upsertLayer(map, {
      id: `${sourceId}-symbol`,
      type: "symbol",
      source: sourceId,
      filter: ["==", ["geometry-type"], "Point"],
      layout: symbolLayout,
      paint: {
        "icon-color": stateColor(style.symbol.iconColor),
        "icon-opacity": stateNumber(
          symbolIconOpacity,
          clamp(symbolIconOpacity + 0.16, 0, 1),
          clamp(symbolIconOpacity + 0.08, 0, 1),
        ),
        "icon-halo-color": style.symbol.iconHaloColor,
        "icon-halo-width": style.symbol.iconHaloWidth,
        "icon-halo-blur": style.symbol.iconHaloBlur,
        "icon-translate": style.symbol.iconTranslate,
        "icon-translate-anchor": style.symbol.iconTranslateAnchor,
        "icon-emissive-strength": style.symbol.iconEmissiveStrength,
        "icon-color-brightness-min": style.symbol.iconColorBrightnessMin,
        "icon-color-brightness-max": style.symbol.iconColorBrightnessMax,
        "icon-color-contrast": style.symbol.iconColorContrast,
        "icon-color-saturation": style.symbol.iconColorSaturation,
        "icon-occlusion-opacity": style.symbol.iconOcclusionOpacity,
        "text-color": stateColor(style.symbol.textColor),
        "text-opacity": stateNumber(
          symbolTextOpacity,
          clamp(symbolTextOpacity + 0.16, 0, 1),
          clamp(symbolTextOpacity + 0.08, 0, 1),
        ),
        "text-halo-color": style.symbol.textHaloColor,
        "text-halo-width": style.symbol.textHaloWidth,
        "text-halo-blur": style.symbol.textHaloBlur,
        "text-translate": style.symbol.textTranslate,
        "text-translate-anchor": style.symbol.textTranslateAnchor,
        "text-emissive-strength": style.symbol.textEmissiveStrength,
        "text-occlusion-opacity": style.symbol.textOcclusionOpacity,
      },
    });
  }
}

export function removeLoadedLayerGroup(map: MapboxMap, sourceId: string) {
  removeLayerGroup(map, sourceId, [
    `${sourceId}-raster`,
    `${sourceId}-heatmap`,
    `${sourceId}-fill`,
    `${sourceId}-line`,
    `${sourceId}-point`,
    `${sourceId}-symbol`,
  ]);
}

export function removeLayerGroup(
  map: MapboxMap,
  sourceId: string,
  layerIds: string[],
  options?: { cleanInteraction?: boolean },
) {
  const cleanInteraction = options?.cleanInteraction ?? true;
  layerIds.forEach((id) => {
    if (cleanInteraction) removeVectorInteraction(map, id);
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource(sourceId)) map.removeSource(sourceId);
  if (cleanInteraction) getMapState(map).rasterSourceKeys.delete(sourceId);
}

export function reorderLoadedStyleLayers(
  map: MapboxMap,
  layers: LoadedLayer[],
) {
  for (const layer of [...layers].reverse()) {
    const sourceId = sourceIdFor(layer.id);
    for (const styleLayerId of [
      `${sourceId}-raster`,
      `${sourceId}-heatmap`,
      `${sourceId}-fill`,
      `${sourceId}-line`,
      `${sourceId}-point`,
      `${sourceId}-symbol`,
    ]) {
      if (map.getLayer(styleLayerId)) map.moveLayer(styleLayerId);
    }
  }
}
