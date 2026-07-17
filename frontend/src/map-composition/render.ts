import type { Map as MapboxMap } from "mapbox-gl";
import {
  drawImageCover,
  drawLegend,
  drawNorthArrow,
  drawTextElement,
  pixelBox,
} from "./canvasElements";
import { drawGrid, drawOverviewExtent } from "./canvasGrid";
import { drawScaleBar } from "./canvasScale";
import type { CompositionLegendItem } from "./legend";
import type { MapCompositionLayout } from "./layout";
import { isBoxWithinPage } from "./layoutGeometry";
import { fitOverviewBounds, renderBoundsImage } from "./mapImage";

export interface CompositionIssue {
  level: "error" | "warning";
  message: string;
}

export interface CompositionRenderOptions {
  outputDpi?: number;
  mapDpi?: number;
  signal?: AbortSignal;
}

export async function renderCompositionPng(
  map: MapboxMap,
  layout: MapCompositionLayout,
  legendItems: CompositionLegendItem[],
  accessToken?: string,
  options: CompositionRenderOptions = {},
): Promise<Blob> {
  const dpi = options.outputDpi ?? layout.page.dpi;
  const mapDpi = options.mapDpi ?? dpi;
  const pxPerMm = dpi / 25.4;
  const mapPxPerMm = mapDpi / 25.4;
  const width = Math.round(layout.page.widthMm * pxPerMm);
  const height = Math.round(layout.page.heightMm * pxPerMm);
  validateOutputSize(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持专题图画布");
  context.fillStyle = layout.page.backgroundColor;
  context.fillRect(0, 0, width, height);

  const mapBox = pixelBox(layout.mapFrame, pxPerMm);
  const mapRenderBox = pixelBox(layout.mapFrame, mapPxPerMm);
  const mapImage = await renderBoundsImage(
    map,
    layout.mapFrame.bounds,
    Math.ceil(mapRenderBox.width),
    Math.ceil(mapRenderBox.height),
    accessToken,
    options.signal,
  );
  try {
    context.save();
    context.beginPath();
    context.rect(mapBox.x, mapBox.y, mapBox.width, mapBox.height);
    context.clip();
    drawImageCover(context, mapImage, mapBox);
    context.restore();
  } finally {
    mapImage.close();
  }
  drawGrid(context, mapBox, layout.mapFrame.bounds, layout.grid, pxPerMm);
  context.strokeStyle = layout.mapFrame.borderColor;
  context.lineWidth = Math.max(
    1,
    layout.mapFrame.borderWidthPt * 0.352778 * pxPerMm,
  );
  context.strokeRect(mapBox.x, mapBox.y, mapBox.width, mapBox.height);

  if (layout.overview.enabled) {
    const overviewBox = pixelBox(layout.overview, pxPerMm);
    const overviewRenderBox = pixelBox(layout.overview, mapPxPerMm);
    const overviewBounds = fitOverviewBounds(
      layout.overview.bounds,
      layout.mapFrame.bounds,
      overviewRenderBox.width,
      overviewRenderBox.height,
    );
    const overviewImage = await renderBoundsImage(
      map,
      overviewBounds,
      Math.ceil(overviewRenderBox.width),
      Math.ceil(overviewRenderBox.height),
      accessToken,
      options.signal,
    );
    try {
      context.save();
      context.beginPath();
      context.rect(
        overviewBox.x,
        overviewBox.y,
        overviewBox.width,
        overviewBox.height,
      );
      context.clip();
      drawImageCover(context, overviewImage, overviewBox);
      context.restore();
    } finally {
      overviewImage.close();
    }
    context.strokeStyle = "#475569";
    context.lineWidth = Math.max(1, pxPerMm * 0.3);
    context.strokeRect(
      overviewBox.x,
      overviewBox.y,
      overviewBox.width,
      overviewBox.height,
    );
    drawOverviewExtent(
      context,
      overviewBox,
      overviewBounds,
      layout.mapFrame.bounds,
      layout.overview.borderColor,
    );
  }

  drawTextElement(context, layout.title, pxPerMm);
  drawTextElement(context, layout.subtitle, pxPerMm);
  drawLegend(context, layout, legendItems, pxPerMm);
  drawTextElement(context, layout.source, pxPerMm);
  drawTextElement(context, layout.note, pxPerMm);
  if (layout.northArrow.enabled) {
    drawNorthArrow(context, pixelBox(layout.northArrow, pxPerMm));
  }
  if (layout.scaleBar.enabled) {
    drawScaleBar(
      context,
      pixelBox(layout.scaleBar, pxPerMm),
      layout.mapFrame.bounds,
      layout.scaleBar.color,
    );
  }
  return canvasBlob(canvas);
}

export function compositionIssues(
  layout: MapCompositionLayout,
  legendItems: CompositionLegendItem[],
): CompositionIssue[] {
  const issues: CompositionIssue[] = [];
  const width = Math.round((layout.page.widthMm * layout.page.dpi) / 25.4);
  const height = Math.round((layout.page.heightMm * layout.page.dpi) / 25.4);
  if (width > 8192 || height > 8192 || width * height > 36_000_000) {
    issues.push({
      level: "error",
      message: "页面尺寸超过平台安全限制，请降低 DPI、纸张规格或改用较小版式",
    });
  }
  if (!layout.title.enabled || !layout.title.text.trim()) {
    issues.push({ level: "error", message: "专题图缺少标题" });
  }
  const [west, south, east, north] = layout.mapFrame.bounds;
  if (west >= east || south >= north) {
    issues.push({
      level: "error",
      message: "主地图范围的西/南坐标必须小于东/北坐标",
    });
  }
  if (layout.legend.enabled && legendItems.length === 0) {
    issues.push({
      level: "warning",
      message: "图例已启用，但当前没有可见图层",
    });
  }
  if (!layout.source.enabled || !layout.source.text.trim()) {
    issues.push({ level: "warning", message: "建议填写数据来源" });
  }
  if (!layout.note.enabled || !layout.note.text.trim()) {
    issues.push({ level: "warning", message: "建议填写制图说明" });
  }
  if (!isBoxWithinPage(layout, layout.mapFrame)) {
    issues.push({ level: "error", message: "主地图框超出纸张范围" });
  }
  for (const element of [
    layout.title,
    layout.subtitle,
    layout.legend,
    layout.overview,
    layout.northArrow,
    layout.scaleBar,
    layout.source,
    layout.note,
  ]) {
    if (element.enabled && !isBoxWithinPage(layout, element)) {
      issues.push({
        level: "error",
        message: "存在超出纸张范围的地图整饰要素",
      });
      break;
    }
  }
  return issues;
}

function validateOutputSize(width: number, height: number) {
  if (width > 8192 || height > 8192 || width * height > 36_000_000) {
    throw new Error("出图尺寸超过平台安全限制，请降低 DPI 或纸张规格");
  }
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("专题图画布生成失败"));
    }, "image/png");
  });
}
