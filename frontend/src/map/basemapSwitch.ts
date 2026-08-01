import type { Map as MapboxMap } from "mapbox-gl";
import type { BasemapDefinition, BasemapId } from "./basemapCatalog";
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

type BasemapSourceReadinessMap = Pick<
  MapboxMap,
  "getSource" | "isSourceLoaded"
>;

const rateLimitFallbackOrder: readonly BasemapId[] = [
  "mapbox-satellite",
  "osm",
];

export function areBasemapSourcesReady(
  map: BasemapSourceReadinessMap,
  definition: BasemapDefinition,
) {
  const existingSourceIds = definition.sourceIds.filter((sourceId) => {
    try {
      return Boolean(map.getSource(sourceId));
    } catch {
      return false;
    }
  });
  if (
    definition.requireAllSourceIds &&
    existingSourceIds.length !== definition.sourceIds.length
  ) {
    return false;
  }
  if (existingSourceIds.length === 0) return false;
  return existingSourceIds.every((sourceId) => {
    try {
      return map.isSourceLoaded(sourceId);
    } catch {
      return false;
    }
  });
}

export function resolveBasemapRateLimitFallback(
  catalog: readonly BasemapDefinition[],
  failedId: BasemapId,
) {
  for (const id of rateLimitFallbackOrder) {
    const candidate = catalog.find((definition) => definition.id === id);
    if (
      candidate &&
      candidate.id !== failedId &&
      candidate.credentials.available
    ) {
      return candidate;
    }
  }
  return undefined;
}

export function resolveBasemapTechnicalFallback(
  catalog: readonly BasemapDefinition[],
  failedId: BasemapId,
) {
  const fallback = catalog.find((definition) => definition.id === "osm");
  return fallback?.id !== failedId && fallback?.credentials.available
    ? fallback
    : undefined;
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
  if (isBasemapRateLimitError(error)) {
    return "底图服务请求过于频繁（HTTP 429），请稍后重试";
  }
  const message = nestedErrorMessage(error).trim() || "地图资源加载失败";
  return redactBasemapCredentials(message);
}

export function isHardBasemapStyleError(error: unknown) {
  if (isBasemapRateLimitError(error)) return true;
  const message = nestedErrorMessage(error).toLowerCase();
  return (
    /(?:^|\D)(?:401|403)(?:\D|$)/.test(message) ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("invalid token") ||
    message.includes("style is not done loading")
  );
}

export function isBasemapRateLimitError(error: unknown) {
  if (hasNestedHttpStatus(error, 429)) return true;
  const message = nestedErrorMessage(error)
    .replace(/https?:\/\/[^\s]+/gi, " ")
    .toLowerCase();
  if (/\bnot\s+rate[\s-]?limited\b/.test(message)) return false;
  return (
    message.includes("too many requests") ||
    /\brate[\s-]?limit(?:ed|ing)?\b/.test(message)
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

function hasNestedHttpStatus(
  value: unknown,
  expectedStatus: number,
  depth = 0,
): boolean {
  if (value == null || depth > 3 || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  for (const key of ["status", "statusCode"] as const) {
    const status = record[key];
    if (typeof status === "number" && status === expectedStatus) return true;
    if (
      typeof status === "string" &&
      /^\d{3}$/.test(status) &&
      Number(status) === expectedStatus
    ) {
      return true;
    }
  }
  for (const key of ["error", "response", "cause"] as const) {
    if (hasNestedHttpStatus(record[key], expectedStatus, depth + 1)) {
      return true;
    }
  }
  return false;
}
