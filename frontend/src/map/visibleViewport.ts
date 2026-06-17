import type { Map as MapboxMap } from "mapbox-gl";
import type { MapViewState } from "../types";

type Edge = "top" | "right" | "bottom" | "left";

interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface VisibleFrame {
  left: number;
  top: number;
  width: number;
  height: number;
  containerWidth: number;
  containerHeight: number;
  insets: Insets;
}

const overlayEdges: Array<{ selector: string; edge: Edge }> = [
  { selector: ".workspace-header", edge: "top" },
  { selector: ".floating-panel-left", edge: "left" },
  { selector: ".floating-panel-right", edge: "right" },
  { selector: ".floating-panel-bottom", edge: "bottom" },
];

const minimumVisibleSize = 120;

export function readVisibleMapViewState(map: MapboxMap): MapViewState {
  const frame = getVisibleMapFrame(map);
  const center = normalizeLngLat(
    map.unproject([frame.left + frame.width / 2, frame.top + frame.height / 2]),
  );
  const bounds = readVisibleBounds(map, frame);

  return {
    center,
    bounds,
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

export function fitBoundsOptionsForVisibleFrame(
  map: MapboxMap,
  basePadding = 72,
) {
  const frame = getVisibleMapFrame(map);
  const padding = normalizePadding(
    {
      top: frame.insets.top + basePadding,
      right: frame.insets.right + basePadding,
      bottom: frame.insets.bottom + basePadding,
      left: frame.insets.left + basePadding,
    },
    frame.containerWidth,
    frame.containerHeight,
  );

  return {
    padding,
    duration: 900,
    essential: true,
  };
}

function getVisibleMapFrame(map: MapboxMap): VisibleFrame {
  const container = map.getContainer();
  const rect = container.getBoundingClientRect();
  const root = container.closest(".workspace") ?? container.ownerDocument;
  const insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

  for (const { selector, edge } of overlayEdges) {
    for (const overlay of Array.from(
      root.querySelectorAll<HTMLElement>(selector),
    )) {
      if (!isVisibleOverlay(overlay)) continue;
      const overlayRect = overlay.getBoundingClientRect();
      if (!rectsIntersect(rect, overlayRect)) continue;
      insets[edge] = Math.max(
        insets[edge],
        insetForEdge(edge, rect, overlayRect),
      );
    }
  }

  const normalizedInsets = normalizeInsets(insets, rect.width, rect.height);
  return {
    left: normalizedInsets.left,
    top: normalizedInsets.top,
    width: Math.max(
      minimumVisibleSize,
      rect.width - normalizedInsets.left - normalizedInsets.right,
    ),
    height: Math.max(
      minimumVisibleSize,
      rect.height - normalizedInsets.top - normalizedInsets.bottom,
    ),
    containerWidth: rect.width,
    containerHeight: rect.height,
    insets: normalizedInsets,
  };
}

function readVisibleBounds(
  map: MapboxMap,
  frame: VisibleFrame,
): [number, number, number, number] {
  const right = frame.left + frame.width;
  const bottom = frame.top + frame.height;
  const points = [
    normalizeLngLat(map.unproject([frame.left, frame.top])),
    normalizeLngLat(map.unproject([right, frame.top])),
    normalizeLngLat(map.unproject([right, bottom])),
    normalizeLngLat(map.unproject([frame.left, bottom])),
  ];
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];
}

function isVisibleOverlay(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number.parseFloat(style.opacity || "1") > 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function rectsIntersect(a: DOMRect, b: DOMRect) {
  return (
    Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
    Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)
  );
}

function insetForEdge(edge: Edge, mapRect: DOMRect, overlayRect: DOMRect) {
  if (edge === "top") {
    return clamp(overlayRect.bottom - mapRect.top, 0, mapRect.height);
  }
  if (edge === "right") {
    return clamp(mapRect.right - overlayRect.left, 0, mapRect.width);
  }
  if (edge === "bottom") {
    return clamp(mapRect.bottom - overlayRect.top, 0, mapRect.height);
  }
  return clamp(overlayRect.right - mapRect.left, 0, mapRect.width);
}

function normalizeInsets(
  insets: Insets,
  width: number,
  height: number,
): Insets {
  const horizontal = normalizePair(insets.left, insets.right, width);
  const vertical = normalizePair(insets.top, insets.bottom, height);
  return {
    top: vertical.start,
    right: horizontal.end,
    bottom: vertical.end,
    left: horizontal.start,
  };
}

function normalizePadding(
  padding: Insets,
  width: number,
  height: number,
): Insets {
  const horizontal = normalizePair(padding.left, padding.right, width);
  const vertical = normalizePair(padding.top, padding.bottom, height);
  return {
    top: Math.round(vertical.start),
    right: Math.round(horizontal.end),
    bottom: Math.round(vertical.end),
    left: Math.round(horizontal.start),
  };
}

function normalizePair(start: number, end: number, total: number) {
  const maxCombined = Math.max(0, total - minimumVisibleSize);
  const combined = start + end;
  if (combined <= maxCombined || combined <= 0) {
    return { start, end };
  }
  const ratio = maxCombined / combined;
  return { start: start * ratio, end: end * ratio };
}

function normalizeLngLat(lngLat: {
  lng: number;
  lat: number;
}): [number, number] {
  return [clamp(lngLat.lng, -180, 180), clamp(lngLat.lat, -90, 90)];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
