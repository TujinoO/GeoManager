import type { Map as MapboxMap } from "mapbox-gl";
import type { GeoJsonGeometry } from "../types";
import { extractCoordinates } from "../utils/geometry";

export async function exportCurrentMapViewPng(
  map: MapboxMap,
  geometry: GeoJsonGeometry,
): Promise<Blob> {
  const originalPitch = map.getPitch();
  const originalBearing = map.getBearing();

  if (originalPitch !== 0 || originalBearing !== 0) {
    map.jumpTo({ pitch: 0, bearing: 0 });
    await waitForMapIdle(map);
  }

  try {
    const crop = visibleGeometryCrop(map, geometry);
    if (!crop) {
      throw new Error("划定范围不在当前地图视角内");
    }
    return await cropMapCanvasToPng(map.getCanvas(), crop);
  } finally {
    if (originalPitch !== 0 || originalBearing !== 0) {
      map.jumpTo({ pitch: originalPitch, bearing: originalBearing });
      await waitForMapIdle(map);
    }
  }
}

function visibleGeometryCrop(map: MapboxMap, geometry: GeoJsonGeometry) {
  const coordinates: Array<[number, number]> = [];
  extractCoordinates(geometry.coordinates, coordinates);
  if (coordinates.length === 0) {
    return null;
  }

  const canvas = map.getCanvas();
  const scaleX = canvas.width / canvas.clientWidth;
  const scaleY = canvas.height / canvas.clientHeight;
  const points = coordinates
    .map((coordinate) => map.project(coordinate))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  if (points.length === 0) {
    return null;
  }

  const xs = points.map((point) => point.x * scaleX);
  const ys = points.map((point) => point.y * scaleY);
  const left = Math.max(0, Math.floor(Math.min(...xs)));
  const top = Math.max(0, Math.floor(Math.min(...ys)));
  const right = Math.min(canvas.width, Math.ceil(Math.max(...xs)));
  const bottom = Math.min(canvas.height, Math.ceil(Math.max(...ys)));
  const width = right - left;
  const height = bottom - top;

  return width > 0 && height > 0 ? { left, top, width, height } : null;
}

async function cropMapCanvasToPng(
  source: HTMLCanvasElement,
  crop: { left: number; top: number; width: number; height: number },
) {
  const output = document.createElement("canvas");
  output.width = crop.width;
  output.height = crop.height;
  const context = output.getContext("2d");
  if (!context) {
    throw new Error("浏览器不支持地图导出画布");
  }
  context.drawImage(
    source,
    crop.left,
    crop.top,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );
  return canvasToPngBlob(output);
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("地图导出失败"));
      }
    }, "image/png");
  });
}

function waitForMapIdle(map: MapboxMap) {
  return new Promise<void>((resolve) => {
    let timeoutId: number | null = null;
    const finish = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      map.off("idle", finish);
      resolve();
    };
    timeoutId = window.setTimeout(finish, 600);
    map.once("idle", finish);
  });
}
