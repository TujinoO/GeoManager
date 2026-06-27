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
  "gm-point": drawPoint,
  "gm-sample": drawSample,
  "gm-plot": drawPlot,
  "gm-transect": drawTransect,
  "gm-collection": drawCollection,
  "gm-revisit": drawRevisit,
  "gm-populus": drawPopulus,
  "gm-tree": drawTree,
  "gm-leaf": drawLeaf,
  "gm-seed": drawSeed,
  "gm-species": drawSpecies,
  "gm-community": drawCommunity,
  "gm-ancient-tree": drawAncientTree,
  "gm-station": drawStation,
  "gm-water": drawWater,
  "gm-groundwater": drawGroundwater,
  "gm-soil": drawSoil,
  "gm-salinity": drawSalinity,
  "gm-climate": drawClimate,
  "gm-sensor": drawSensor,
  "gm-satellite": drawSatellite,
  "gm-pixel": drawPixel,
  "gm-ndvi": drawNdvi,
  "gm-npp": drawNpp,
  "gm-imagery": drawImagery,
  "gm-zonal": drawZonal,
  "gm-dna": drawDna,
  "gm-tube": drawTube,
  "gm-vial": drawVial,
  "gm-core-germplasm": drawCoreGermplasm,
  "gm-germplasm": drawGermplasm,
  "gm-alert": drawAlert,
  "gm-error": drawError,
  "gm-pending": drawPending,
  "gm-confirmed": drawConfirmed,
  "gm-quality": drawQuality,
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

function drawPoint(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  fillCircle(ctx, 32 * unit, 32 * unit, 20 * unit);
  cutCircle(ctx, 32 * unit, 32 * unit, 8 * unit);
  fillCircle(ctx, 32 * unit, 32 * unit, 4 * unit);
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
  roundedRect(ctx, 10 * unit, 10 * unit, 44 * unit, 44 * unit, 7 * unit);
  ctx.fill();
  cutRoundedRect(ctx, 17 * unit, 17 * unit, 30 * unit, 30 * unit, 4 * unit);
  fillCircle(ctx, 32 * unit, 32 * unit, 5 * unit);
}

function drawTransect(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  strokePath(ctx, 7 * unit, () => {
    ctx.moveTo(14 * unit, 50 * unit);
    ctx.lineTo(50 * unit, 14 * unit);
  });
  fillCircle(ctx, 14 * unit, 50 * unit, 8 * unit);
  fillCircle(ctx, 32 * unit, 32 * unit, 8 * unit);
  fillCircle(ctx, 50 * unit, 14 * unit, 8 * unit);
  cutCircle(ctx, 14 * unit, 50 * unit, 3 * unit);
  cutCircle(ctx, 32 * unit, 32 * unit, 3 * unit);
  cutCircle(ctx, 50 * unit, 14 * unit, 3 * unit);
}

function drawCollection(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  fillCircle(ctx, 23 * unit, 17 * unit, 7 * unit);
  fillCircle(ctx, 34 * unit, 14 * unit, 7 * unit);
  fillCircle(ctx, 44 * unit, 19 * unit, 6 * unit);
  roundedRect(ctx, 13 * unit, 25 * unit, 38 * unit, 29 * unit, 8 * unit);
  ctx.fill();
  cutRoundedRect(ctx, 19 * unit, 31 * unit, 26 * unit, 15 * unit, 4 * unit);
}

function drawRevisit(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  fillCircle(ctx, 32 * unit, 32 * unit, 25 * unit);
  cutCircle(ctx, 32 * unit, 32 * unit, 16 * unit);
  fillPolygon(ctx, [
    [45 * unit, 8 * unit],
    [57 * unit, 17 * unit],
    [45 * unit, 26 * unit],
  ]);
}

function drawPopulus(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  roundedRect(ctx, 29 * unit, 30 * unit, 6 * unit, 27 * unit, 3 * unit);
  ctx.fill();
  fillCircle(ctx, 32 * unit, 21 * unit, 15 * unit);
  fillCircle(ctx, 22 * unit, 32 * unit, 11 * unit);
  fillCircle(ctx, 42 * unit, 32 * unit, 11 * unit);
  fillCircle(ctx, 32 * unit, 39 * unit, 12 * unit);
  cutStrokePath(ctx, 3 * unit, () => {
    ctx.moveTo(32 * unit, 34 * unit);
    ctx.lineTo(24 * unit, 24 * unit);
    ctx.moveTo(32 * unit, 34 * unit);
    ctx.lineTo(41 * unit, 24 * unit);
  });
}

function drawTree(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  roundedRect(ctx, 28 * unit, 32 * unit, 8 * unit, 24 * unit, 3 * unit);
  ctx.fill();
  fillCircle(ctx, 32 * unit, 23 * unit, 19 * unit);
  fillCircle(ctx, 21 * unit, 34 * unit, 12 * unit);
  fillCircle(ctx, 43 * unit, 34 * unit, 12 * unit);
}

function drawLeaf(ctx: CanvasRenderingContext2D, size: number) {
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
  cutStrokePath(ctx, 3 * unit, () => {
    ctx.moveTo(18 * unit, 44 * unit);
    ctx.bezierCurveTo(
      26 * unit,
      34 * unit,
      38 * unit,
      24 * unit,
      49 * unit,
      14 * unit,
    );
  });
}

function drawSeed(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  ctx.beginPath();
  ctx.ellipse(
    32 * unit,
    33 * unit,
    15 * unit,
    24 * unit,
    -0.35,
    0,
    Math.PI * 2,
  );
  ctx.closePath();
  ctx.fill();
  cutStrokePath(ctx, 3 * unit, () => {
    ctx.moveTo(31 * unit, 14 * unit);
    ctx.bezierCurveTo(
      26 * unit,
      28 * unit,
      28 * unit,
      42 * unit,
      37 * unit,
      53 * unit,
    );
  });
}

function drawSpecies(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  strokePath(ctx, 5 * unit, () => {
    ctx.moveTo(32 * unit, 18 * unit);
    ctx.lineTo(18 * unit, 45 * unit);
    ctx.moveTo(32 * unit, 18 * unit);
    ctx.lineTo(46 * unit, 45 * unit);
    ctx.moveTo(18 * unit, 45 * unit);
    ctx.lineTo(46 * unit, 45 * unit);
  });
  fillCircle(ctx, 32 * unit, 18 * unit, 10 * unit);
  fillCircle(ctx, 18 * unit, 45 * unit, 10 * unit);
  fillCircle(ctx, 46 * unit, 45 * unit, 10 * unit);
}

function drawCommunity(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  fillCircle(ctx, 25 * unit, 28 * unit, 15 * unit);
  fillCircle(ctx, 39 * unit, 28 * unit, 15 * unit);
  fillCircle(ctx, 32 * unit, 42 * unit, 15 * unit);
  cutCircle(ctx, 32 * unit, 33 * unit, 6 * unit);
}

function drawAncientTree(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  roundedRect(ctx, 27 * unit, 28 * unit, 10 * unit, 29 * unit, 4 * unit);
  ctx.fill();
  fillCircle(ctx, 32 * unit, 24 * unit, 22 * unit);
  cutCircle(ctx, 32 * unit, 24 * unit, 12 * unit);
  fillCircle(ctx, 32 * unit, 24 * unit, 6 * unit);
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

function drawGroundwater(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  drawWater(ctx, size);
  cutStrokePath(ctx, 4 * unit, () => {
    ctx.moveTo(17 * unit, 44 * unit);
    ctx.bezierCurveTo(
      24 * unit,
      39 * unit,
      31 * unit,
      49 * unit,
      38 * unit,
      44 * unit,
    );
    ctx.bezierCurveTo(
      43 * unit,
      41 * unit,
      48 * unit,
      42 * unit,
      52 * unit,
      45 * unit,
    );
  });
}

function drawSoil(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  roundedRect(ctx, 10 * unit, 14 * unit, 44 * unit, 39 * unit, 8 * unit);
  ctx.fill();
  for (const y of [25, 36, 47]) {
    cutStrokePath(ctx, 3 * unit, () => {
      ctx.moveTo(16 * unit, y * unit);
      ctx.bezierCurveTo(
        24 * unit,
        (y - 4) * unit,
        37 * unit,
        (y + 4) * unit,
        48 * unit,
        y * unit,
      );
    });
  }
}

function drawSalinity(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  fillPolygon(ctx, [
    [32 * unit, 6 * unit],
    [53 * unit, 18 * unit],
    [53 * unit, 46 * unit],
    [32 * unit, 58 * unit],
    [11 * unit, 46 * unit],
    [11 * unit, 18 * unit],
  ]);
  cutStrokePath(ctx, 4 * unit, () => {
    ctx.moveTo(32 * unit, 16 * unit);
    ctx.lineTo(32 * unit, 48 * unit);
    ctx.moveTo(18 * unit, 32 * unit);
    ctx.lineTo(46 * unit, 32 * unit);
    ctx.moveTo(22 * unit, 22 * unit);
    ctx.lineTo(42 * unit, 42 * unit);
    ctx.moveTo(42 * unit, 22 * unit);
    ctx.lineTo(22 * unit, 42 * unit);
  });
}

function drawClimate(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  fillCircle(ctx, 45 * unit, 20 * unit, 10 * unit);
  fillCircle(ctx, 24 * unit, 34 * unit, 13 * unit);
  fillCircle(ctx, 36 * unit, 30 * unit, 15 * unit);
  roundedRect(ctx, 15 * unit, 34 * unit, 36 * unit, 15 * unit, 7 * unit);
  ctx.fill();
  cutStrokePath(ctx, 3 * unit, () => {
    ctx.moveTo(18 * unit, 53 * unit);
    ctx.lineTo(47 * unit, 53 * unit);
  });
}

function drawSensor(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  roundedRect(ctx, 25 * unit, 31 * unit, 14 * unit, 24 * unit, 5 * unit);
  ctx.fill();
  fillCircle(ctx, 32 * unit, 25 * unit, 6 * unit);
  strokePath(ctx, 4 * unit, () => {
    ctx.moveTo(32 * unit, 31 * unit);
    ctx.lineTo(32 * unit, 16 * unit);
    ctx.moveTo(20 * unit, 11 * unit);
    ctx.quadraticCurveTo(32 * unit, 2 * unit, 44 * unit, 11 * unit);
    ctx.moveTo(16 * unit, 22 * unit);
    ctx.quadraticCurveTo(32 * unit, 10 * unit, 48 * unit, 22 * unit);
  });
}

function drawSatellite(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  ctx.save();
  ctx.translate(32 * unit, 32 * unit);
  ctx.rotate(-0.45);
  roundedRect(ctx, -10 * unit, -10 * unit, 20 * unit, 20 * unit, 4 * unit);
  ctx.fill();
  roundedRect(ctx, -31 * unit, -8 * unit, 16 * unit, 16 * unit, 3 * unit);
  ctx.fill();
  roundedRect(ctx, 15 * unit, -8 * unit, 16 * unit, 16 * unit, 3 * unit);
  ctx.fill();
  strokePath(ctx, 4 * unit, () => {
    ctx.moveTo(-15 * unit, 0);
    ctx.lineTo(-10 * unit, 0);
    ctx.moveTo(10 * unit, 0);
    ctx.lineTo(15 * unit, 0);
  });
  ctx.restore();
}

function drawPixel(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  const cells: Array<[number, number]> = [
    [12, 12],
    [28, 12],
    [44, 12],
    [12, 28],
    [28, 28],
    [44, 28],
    [12, 44],
    [28, 44],
    [44, 44],
  ];
  for (const [x, y] of cells) {
    roundedRect(ctx, x * unit, y * unit, 10 * unit, 10 * unit, 2 * unit);
    ctx.fill();
  }
}

function drawNdvi(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  drawLeaf(ctx, size);
  roundedRect(ctx, 12 * unit, 48 * unit, 9 * unit, 9 * unit, 2 * unit);
  ctx.fill();
  roundedRect(ctx, 27 * unit, 48 * unit, 9 * unit, 9 * unit, 2 * unit);
  ctx.fill();
  roundedRect(ctx, 42 * unit, 48 * unit, 9 * unit, 9 * unit, 2 * unit);
  ctx.fill();
}

function drawNpp(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  roundedRect(ctx, 12 * unit, 37 * unit, 8 * unit, 16 * unit, 3 * unit);
  ctx.fill();
  roundedRect(ctx, 26 * unit, 27 * unit, 8 * unit, 26 * unit, 3 * unit);
  ctx.fill();
  roundedRect(ctx, 40 * unit, 17 * unit, 8 * unit, 36 * unit, 3 * unit);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(36 * unit, 9 * unit);
  ctx.bezierCurveTo(
    26 * unit,
    12 * unit,
    20 * unit,
    20 * unit,
    20 * unit,
    29 * unit,
  );
  ctx.bezierCurveTo(
    30 * unit,
    29 * unit,
    37 * unit,
    22 * unit,
    36 * unit,
    9 * unit,
  );
  ctx.closePath();
  ctx.fill();
}

function drawImagery(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  roundedRect(ctx, 9 * unit, 12 * unit, 46 * unit, 40 * unit, 6 * unit);
  ctx.fill();
  cutRoundedRect(ctx, 15 * unit, 18 * unit, 34 * unit, 28 * unit, 3 * unit);
  fillPolygon(ctx, [
    [17 * unit, 44 * unit],
    [28 * unit, 31 * unit],
    [36 * unit, 40 * unit],
    [43 * unit, 30 * unit],
    [49 * unit, 44 * unit],
  ]);
  fillCircle(ctx, 23 * unit, 25 * unit, 4 * unit);
}

function drawZonal(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  roundedRect(ctx, 10 * unit, 10 * unit, 44 * unit, 44 * unit, 8 * unit);
  ctx.fill();
  cutStrokePath(ctx, 4 * unit, () => {
    ctx.moveTo(30 * unit, 10 * unit);
    ctx.bezierCurveTo(
      24 * unit,
      24 * unit,
      37 * unit,
      33 * unit,
      30 * unit,
      54 * unit,
    );
    ctx.moveTo(10 * unit, 32 * unit);
    ctx.bezierCurveTo(
      24 * unit,
      27 * unit,
      40 * unit,
      38 * unit,
      54 * unit,
      30 * unit,
    );
  });
}

function drawDna(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  strokePath(ctx, 4 * unit, () => {
    ctx.moveTo(22 * unit, 9 * unit);
    ctx.bezierCurveTo(
      47 * unit,
      19 * unit,
      17 * unit,
      43 * unit,
      42 * unit,
      55 * unit,
    );
    ctx.moveTo(42 * unit, 9 * unit);
    ctx.bezierCurveTo(
      17 * unit,
      19 * unit,
      47 * unit,
      43 * unit,
      22 * unit,
      55 * unit,
    );
    for (const y of [17, 27, 37, 47]) {
      ctx.moveTo(23 * unit, y * unit);
      ctx.lineTo(41 * unit, y * unit);
    }
  });
}

function drawTube(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  ctx.save();
  ctx.translate(32 * unit, 32 * unit);
  ctx.rotate(-0.42);
  roundedRect(ctx, -8 * unit, -25 * unit, 16 * unit, 50 * unit, 8 * unit);
  ctx.fill();
  cutRoundedRect(ctx, -5 * unit, -21 * unit, 10 * unit, 31 * unit, 4 * unit);
  ctx.restore();
}

function drawVial(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  roundedRect(ctx, 23 * unit, 8 * unit, 18 * unit, 10 * unit, 3 * unit);
  ctx.fill();
  roundedRect(ctx, 20 * unit, 16 * unit, 24 * unit, 40 * unit, 7 * unit);
  ctx.fill();
  cutStrokePath(ctx, 4 * unit, () => {
    ctx.moveTo(23 * unit, 36 * unit);
    ctx.lineTo(41 * unit, 36 * unit);
  });
}

function drawCoreGermplasm(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  fillCircle(ctx, 32 * unit, 33 * unit, 24 * unit);
  cutCircle(ctx, 32 * unit, 33 * unit, 13 * unit);
  fillPolygon(ctx, [
    [32 * unit, 15 * unit],
    [39 * unit, 32 * unit],
    [32 * unit, 50 * unit],
    [25 * unit, 32 * unit],
  ]);
}

function drawGermplasm(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  ctx.beginPath();
  ctx.ellipse(
    32 * unit,
    39 * unit,
    15 * unit,
    18 * unit,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(32 * unit, 29 * unit);
  ctx.bezierCurveTo(
    28 * unit,
    18 * unit,
    19 * unit,
    13 * unit,
    12 * unit,
    15 * unit,
  );
  ctx.bezierCurveTo(
    14 * unit,
    25 * unit,
    23 * unit,
    30 * unit,
    32 * unit,
    29 * unit,
  );
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(32 * unit, 29 * unit);
  ctx.bezierCurveTo(
    36 * unit,
    18 * unit,
    45 * unit,
    13 * unit,
    52 * unit,
    15 * unit,
  );
  ctx.bezierCurveTo(
    50 * unit,
    25 * unit,
    41 * unit,
    30 * unit,
    32 * unit,
    29 * unit,
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

function drawError(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  fillPolygon(ctx, [
    [23 * unit, 6 * unit],
    [41 * unit, 6 * unit],
    [58 * unit, 23 * unit],
    [58 * unit, 41 * unit],
    [41 * unit, 58 * unit],
    [23 * unit, 58 * unit],
    [6 * unit, 41 * unit],
    [6 * unit, 23 * unit],
  ]);
  cutStrokePath(ctx, 6 * unit, () => {
    ctx.moveTo(23 * unit, 23 * unit);
    ctx.lineTo(41 * unit, 41 * unit);
    ctx.moveTo(41 * unit, 23 * unit);
    ctx.lineTo(23 * unit, 41 * unit);
  });
}

function drawPending(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  fillCircle(ctx, 32 * unit, 32 * unit, 26 * unit);
  cutCircle(ctx, 32 * unit, 32 * unit, 17 * unit);
  fillCircle(ctx, 32 * unit, 32 * unit, 5 * unit);
  strokePath(ctx, 5 * unit, () => {
    ctx.moveTo(32 * unit, 32 * unit);
    ctx.lineTo(32 * unit, 18 * unit);
    ctx.moveTo(32 * unit, 32 * unit);
    ctx.lineTo(43 * unit, 39 * unit);
  });
}

function drawConfirmed(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  fillCircle(ctx, 32 * unit, 32 * unit, 27 * unit);
  cutStrokePath(ctx, 7 * unit, () => {
    ctx.moveTo(18 * unit, 33 * unit);
    ctx.lineTo(28 * unit, 43 * unit);
    ctx.lineTo(47 * unit, 22 * unit);
  });
}

function drawQuality(ctx: CanvasRenderingContext2D, size: number) {
  const unit = size / 64;
  ctx.beginPath();
  ctx.moveTo(32 * unit, 6 * unit);
  ctx.lineTo(53 * unit, 15 * unit);
  ctx.lineTo(50 * unit, 39 * unit);
  ctx.bezierCurveTo(
    47 * unit,
    50 * unit,
    39 * unit,
    57 * unit,
    32 * unit,
    60 * unit,
  );
  ctx.bezierCurveTo(
    25 * unit,
    57 * unit,
    17 * unit,
    50 * unit,
    14 * unit,
    39 * unit,
  );
  ctx.lineTo(11 * unit, 15 * unit);
  ctx.closePath();
  ctx.fill();
  cutStrokePath(ctx, 6 * unit, () => {
    ctx.moveTo(21 * unit, 33 * unit);
    ctx.lineTo(30 * unit, 42 * unit);
    ctx.lineTo(45 * unit, 25 * unit);
  });
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

function fillPolygon(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>,
) {
  if (points.length === 0) return;
  const [firstX, firstY] = points[0]!;
  ctx.beginPath();
  ctx.moveTo(firstX, firstY);
  for (const [x, y] of points.slice(1)) {
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function strokePath(
  ctx: CanvasRenderingContext2D,
  width: number,
  draw: () => void,
) {
  ctx.save();
  ctx.strokeStyle =
    typeof ctx.fillStyle === "string" ? ctx.fillStyle : defaultIconColor;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  draw();
  ctx.stroke();
  ctx.restore();
}

function cutStrokePath(
  ctx: CanvasRenderingContext2D,
  width: number,
  draw: () => void,
) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  draw();
  ctx.stroke();
  ctx.restore();
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
