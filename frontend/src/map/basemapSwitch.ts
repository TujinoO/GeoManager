import type { Map as MapboxMap } from "mapbox-gl";
import type { FeatureStateTarget } from "./mapState";
import { getMapState } from "./mapState";

export interface BasemapCameraSnapshot {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface StableReadinessGate {
  check: () => void;
  cancel: () => void;
}

export function createStableReadinessGate(
  isReady: () => boolean,
  onReady: () => void,
  delayMs: number,
): StableReadinessGate {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timerId === null) return;
    clearTimeout(timerId);
    timerId = null;
  };
  const check = () => {
    if (!isReady()) {
      cancel();
      return;
    }
    if (timerId !== null) return;
    timerId = setTimeout(() => {
      timerId = null;
      if (isReady()) onReady();
    }, delayMs);
  };

  return { check, cancel };
}

export function readBasemapCamera(map: MapboxMap): BasemapCameraSnapshot {
  const center = map.getCenter();
  return {
    center: [center.lng, center.lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

export function restoreBasemapCamera(
  map: MapboxMap,
  snapshot: BasemapCameraSnapshot,
) {
  map.jumpTo(snapshot);
}

export function restoreSelectedFeatureState(
  map: MapboxMap,
  target: FeatureStateTarget | undefined,
) {
  const state = getMapState(map);
  state.hoveredFeature = undefined;
  if (!target || !map.getSource(target.source)) {
    state.selectedFeature = undefined;
    return false;
  }
  try {
    map.setFeatureState(target, { selected: true });
    state.selectedFeature = target;
    return true;
  } catch {
    state.selectedFeature = undefined;
    return false;
  }
}

export function basemapErrorMessage(error: unknown) {
  const message = nestedErrorMessage(error).trim() || "地图资源加载失败";
  return redactBasemapCredentials(message);
}

export function isHardBasemapStyleError(error: unknown) {
  const message = nestedErrorMessage(error).toLowerCase();
  return (
    /(?:^|\D)(?:401|403)(?:\D|$)/.test(message) ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("invalid token") ||
    message.includes("style is not done loading")
  );
}

export function redactBasemapCredentials(value: string) {
  return value
    .replace(/([?&](?:access_token|tk)=)[^&#\s]+/gi, "$1[已隐藏]")
    .replace(/\b(?:pk|sk)\.[A-Za-z0-9._-]+/g, "[已隐藏的地图凭证]");
}

function nestedErrorMessage(value: unknown, depth = 0): string {
  if (value == null || depth > 3) return "";
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  if (typeof value !== "object") return String(value);
  const record = value as Record<string, unknown>;
  return ["message", "url", "statusText", "error"]
    .map((key) => nestedErrorMessage(record[key], depth + 1))
    .filter(Boolean)
    .join(" ");
}
