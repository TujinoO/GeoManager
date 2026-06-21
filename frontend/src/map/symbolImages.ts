import type { Map as MapboxMap } from "mapbox-gl";
import {
  normalizeSymbolIconImage,
  platformSymbolIconIds,
  type PlatformSymbolIconId,
} from "../symbolization";

type IconPainter = (ctx: CanvasRenderingContext2D, size: number) => void;

const iconSize = 64;
const iconPixelRatio = 2;
const defaultIconColor = "#2f7d62";

const iconPainters: Record<PlatformSymbolIconId, IconPainter> = {
  "gm-marker": drawMarker,
  "gm-station": drawStation,
  "gm-sample": drawSample,
  "gm-plot": drawPlot,
  "gm-water": drawWater,
  "gm-alert": drawAlert,
  "gm-priority": drawPriority,
};

export function registerPlatformSymbolImages(map: MapboxMap) {
  for (const id of platformSymbolIconIds) {
    registerPlatformSymbolImage(map, id, defaultIconColor);
  }
}

export function platformSymbolImageId(iconImage: string, color: string) {
  const normalizedId = normalizeSymbolIconImage(iconImage);
  if (!isPlatformSymbolIconId(normalizedId)) return normalizedId;
  return `${normalizedId}--${colorKey(color)}`;
}

export function ensurePlatformSymbolImage(
  map: MapboxMap,
  iconImage: string,
  color: string,
) {
  const normalizedId = normalizeSymbolIconImage(iconImage);
  if (isPlatformSymbolIconId(normalizedId)) {
    registerPlatformSymbolImage(map, normalizedId, color);
  }
}

export function isPlatformSymbolImage(iconImage: string) {
  return isPlatformSymbolIconId(normalizeSymbolIconImage(iconImage));
}

export function bindPlatformSymbolImageFallback(map: MapboxMap) {
  const handleStyleImageMissing = (event: { id?: string }) => {
    const id = event.id;
    if (!id) return;
    const parsed = parsePlatformSymbolImageId(id);
    if (parsed) {
      registerPlatformSymbolImage(map, parsed.iconId, parsed.color);
      return;
    }
    const normalizedId = normalizeSymbolIconImage(id);
    if (isPlatformSymbolIconId(normalizedId)) {
      registerPlatformSymbolImage(map, normalizedId, defaultIconColor);
    }
  };

  map.on("styleimagemissing", handleStyleImageMissing);
  return () => map.off("styleimagemissing", handleStyleImageMissing);
}

function registerPlatformSymbolImage(
  map: MapboxMap,
  id: PlatformSymbolIconId,
  color: string,
) {
  const imageId = platformSymbolImageId(id, color);
  if (map.hasImage(imageId)) return;
  map.addImage(imageId, createIconImage(iconPainters[id], color), {
    pixelRatio: iconPixelRatio,
  });
}

function isPlatformSymbolIconId(id: string): id is PlatformSymbolIconId {
  return platformSymbolIconIds.includes(id as PlatformSymbolIconId);
}

function createIconImage(paint: IconPainter, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = iconSize;
  canvas.height = iconSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new ImageData(iconSize, iconSize);
  }

  ctx.clearRect(0, 0, iconSize, iconSize);
  ctx.fillStyle = color;
  paint(ctx, iconSize);
  const image = ctx.getImageData(0, 0, iconSize, iconSize);
  return {
    width: iconSize,
    height: iconSize,
    data: image.data,
  };
}

function colorKey(color: string) {
  const normalized = color.trim().toLowerCase();
  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hexMatch?.[1]) return hexMatch[1];
  const key = normalized.replace(/[^a-z0-9]/g, "").slice(0, 24);
  return key || "default";
}

function parsePlatformSymbolImageId(imageId: string) {
  const [iconId, color] = imageId.split("--");
  if (!iconId || !color || !isPlatformSymbolIconId(iconId)) return null;
  return { iconId, color: `#${color}` };
}

function drawMarker(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  ctx.beginPath();
  ctx.moveTo(32 * unit, 59 * unit);
  ctx.bezierCurveTo(
    18 * unit,
    44 * unit,
    12 * unit,
    34 * unit,
    12 * unit,
    24 * unit,
  );
  ctx.bezierCurveTo(
    12 * unit,
    13 * unit,
    21 * unit,
    6 * unit,
    32 * unit,
    6 * unit,
  );
  ctx.bezierCurveTo(
    43 * unit,
    6 * unit,
    52 * unit,
    13 * unit,
    52 * unit,
    24 * unit,
  );
  ctx.bezierCurveTo(
    52 * unit,
    34 * unit,
    46 * unit,
    44 * unit,
    32 * unit,
    59 * unit,
  );
  ctx.closePath();
  ctx.fill();
  cutCircle(ctx, 32 * unit, 24 * unit, 7 * unit);
}

function drawStation(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  ctx.beginPath();
  ctx.moveTo(32 * unit, 7 * unit);
  ctx.lineTo(57 * unit, 32 * unit);
  ctx.lineTo(32 * unit, 57 * unit);
  ctx.lineTo(7 * unit, 32 * unit);
  ctx.closePath();
  ctx.fill();
  cutCircle(ctx, 32 * unit, 32 * unit, 9 * unit);
}

function drawSample(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  fillCircle(ctx, 32 * unit, 32 * unit, 25 * unit);
  cutCircle(ctx, 32 * unit, 32 * unit, 15 * unit);
  fillCircle(ctx, 32 * unit, 32 * unit, 6 * unit);
}

function drawPlot(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  ctx.beginPath();
  ctx.moveTo(51 * unit, 12 * unit);
  ctx.bezierCurveTo(
    34 * unit,
    10 * unit,
    14 * unit,
    20 * unit,
    10 * unit,
    42 * unit,
  );
  ctx.bezierCurveTo(
    24 * unit,
    52 * unit,
    43 * unit,
    45 * unit,
    51 * unit,
    12 * unit,
  );
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.translate(31 * unit, 34 * unit);
  ctx.rotate(-0.65);
  roundedRect(ctx, -3 * unit, -22 * unit, 6 * unit, 38 * unit, 3 * unit);
  ctx.fill();
  ctx.restore();
}

function drawWater(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  ctx.beginPath();
  ctx.moveTo(32 * unit, 5 * unit);
  ctx.bezierCurveTo(
    46 * unit,
    22 * unit,
    55 * unit,
    34 * unit,
    55 * unit,
    45 * unit,
  );
  ctx.bezierCurveTo(
    55 * unit,
    57 * unit,
    45 * unit,
    62 * unit,
    32 * unit,
    62 * unit,
  );
  ctx.bezierCurveTo(
    19 * unit,
    62 * unit,
    9 * unit,
    57 * unit,
    9 * unit,
    45 * unit,
  );
  ctx.bezierCurveTo(
    9 * unit,
    34 * unit,
    18 * unit,
    22 * unit,
    32 * unit,
    5 * unit,
  );
  ctx.closePath();
  ctx.fill();
}

function drawAlert(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  ctx.beginPath();
  ctx.moveTo(32 * unit, 7 * unit);
  ctx.lineTo(60 * unit, 56 * unit);
  ctx.lineTo(4 * unit, 56 * unit);
  ctx.closePath();
  ctx.fill();
  cutRoundedRect(ctx, 29 * unit, 24 * unit, 6 * unit, 18 * unit, 3 * unit);
  cutCircle(ctx, 32 * unit, 49 * unit, 3.4 * unit);
}

function drawPriority(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  const cx = 32 * unit;
  const cy = 33 * unit;
  const outer = 28 * unit;
  const inner = 12 * unit;
  ctx.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function fillCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

function cutCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  fillCircle(ctx, x, y, radius);
  ctx.restore();
}

function cutRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  roundedRect(ctx, x, y, width, height, radius);
  ctx.fill();
  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const nextRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + nextRadius, y);
  ctx.lineTo(x + width - nextRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + nextRadius);
  ctx.lineTo(x + width, y + height - nextRadius);
  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - nextRadius,
    y + height,
  );
  ctx.lineTo(x + nextRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - nextRadius);
  ctx.lineTo(x, y + nextRadius);
  ctx.quadraticCurveTo(x, y, x + nextRadius, y);
  ctx.closePath();
}
