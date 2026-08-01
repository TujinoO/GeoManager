import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapboxMap, MapSourceDataEvent } from "mapbox-gl";
import {
  activeBasemapScopeKey,
  initialBasemapDiagnostics,
  isBasemapResourceError,
  isBasemapSourceId,
  resetBasemapDiagnosticsForSwitch,
  type ActiveBasemapDescriptor,
  type BasemapDiagnostics,
  type BrowserNetworkSnapshot,
} from "../map/basemapStatus";

const healthCheckIntervalMs = 30_000;
const healthCheckTimeoutMs = 5_000;
const maxTrackedTileRequests = 512;

type NetworkInformationLike = EventTarget & {
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
};

type MapResourceErrorEvent = {
  error?: unknown;
  sourceId?: string;
};

export interface BasemapProbeResult {
  ok: boolean;
  latencyMs?: number | null;
}

export interface BasemapRetryProbeContext {
  activeBasemap: ActiveBasemapDescriptor | null | undefined;
  signal: AbortSignal;
}

export type BasemapRetryProbe = (
  context: BasemapRetryProbeContext,
) => BasemapProbeResult | void | Promise<BasemapProbeResult | void>;

export interface UseBasemapStatusOptions {
  activeBasemap?: ActiveBasemapDescriptor | null;
  retryBasemap?: BasemapRetryProbe;
}

export type PlatformHealthProbeResult =
  | { status: "reachable"; latencyMs: number }
  | { status: "unreachable"; latencyMs: null }
  | { status: "cancelled"; latencyMs: null };

interface PlatformHealthProbeOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export async function probePlatformHealth({
  signal,
  timeoutMs = healthCheckTimeoutMs,
  fetchImpl = fetch,
  now = () => performance.now(),
}: PlatformHealthProbeOptions = {}): Promise<PlatformHealthProbeResult> {
  if (signal?.aborted) {
    return { status: "cancelled", latencyMs: null };
  }

  const controller = new AbortController();
  let cancelledExternally = false;
  let timedOut = false;
  const cancel = () => {
    cancelledExternally = true;
    controller.abort();
  };
  signal?.addEventListener("abort", cancel, { once: true });
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const startedAt = now();

  try {
    const response = await fetchImpl("/api/health/", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (cancelledExternally) {
      return { status: "cancelled", latencyMs: null };
    }
    if (timedOut || !response.ok) {
      return { status: "unreachable", latencyMs: null };
    }
    return {
      status: "reachable",
      latencyMs: Math.max(1, Math.round(now() - startedAt)),
    };
  } catch {
    return cancelledExternally
      ? { status: "cancelled", latencyMs: null }
      : { status: "unreachable", latencyMs: null };
  } finally {
    globalThis.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", cancel);
  }
}

export class BasemapTileRequestTimings {
  private readonly starts = new Map<number | string, number>();

  constructor(private readonly maxEntries = maxTrackedTileRequests) {}

  start(key: number | string, startedAt: number): void {
    if (!this.starts.has(key) && this.starts.size >= this.maxEntries) {
      const oldestKey = this.starts.keys().next().value;
      if (oldestKey !== undefined) {
        this.starts.delete(oldestKey);
      }
    }
    this.starts.set(key, startedAt);
  }

  finish(key: number | string | undefined): number | undefined {
    if (key === undefined) return undefined;
    const startedAt = this.starts.get(key);
    this.starts.delete(key);
    return startedAt;
  }

  clear(): void {
    this.starts.clear();
  }
}

export class BasemapSourceLoadCycle {
  private expectedSourceIds = new Set<string>();
  private readonly readySourceIds = new Set<string>();
  private failed = false;

  constructor(sourceIds: Iterable<string> = []) {
    this.replaceExpectedSources(sourceIds);
  }

  reset(sourceIds: Iterable<string> = this.expectedSourceIds): void {
    this.replaceExpectedSources(sourceIds);
    this.readySourceIds.clear();
    this.failed = false;
  }

  loading(sourceId: string, sourceIds: Iterable<string> = []): void {
    this.syncExpectedSources(sourceIds);
    this.expectedSourceIds.add(sourceId);
    this.readySourceIds.delete(sourceId);
  }

  loaded(sourceId: string, sourceIds: Iterable<string> = []): boolean {
    this.syncExpectedSources(sourceIds);
    this.expectedSourceIds.add(sourceId);
    this.readySourceIds.add(sourceId);
    if (!this.allExpectedSourcesReady()) return false;
    this.failed = false;
    return true;
  }

  fail(sourceIds: Iterable<string> = []): void {
    this.syncExpectedSources(sourceIds);
    this.readySourceIds.clear();
    this.failed = true;
  }

  completeFromMapLifecycle(sourceIds: Iterable<string> = []): boolean {
    this.syncExpectedSources(sourceIds);
    if (this.failed) return false;
    for (const sourceId of this.expectedSourceIds) {
      this.readySourceIds.add(sourceId);
    }
    return true;
  }

  hasFailure(): boolean {
    return this.failed;
  }

  private allExpectedSourcesReady(): boolean {
    return (
      this.expectedSourceIds.size > 0 &&
      [...this.expectedSourceIds].every((sourceId) =>
        this.readySourceIds.has(sourceId),
      )
    );
  }

  private syncExpectedSources(sourceIds: Iterable<string>): void {
    const nextSourceIds = normalizedSourceIds(sourceIds);
    if (nextSourceIds.size === 0) return;
    this.expectedSourceIds = nextSourceIds;
    for (const sourceId of this.readySourceIds) {
      if (!nextSourceIds.has(sourceId)) {
        this.readySourceIds.delete(sourceId);
      }
    }
  }

  private replaceExpectedSources(sourceIds: Iterable<string>): void {
    this.expectedSourceIds = normalizedSourceIds(sourceIds);
  }
}

export function useBasemapStatus(
  map: MapboxMap | null,
  options: UseBasemapStatusOptions = {},
) {
  const scopeKey = activeBasemapScopeKey(options.activeBasemap);
  const [diagnostics, setDiagnostics] = useState<BasemapDiagnostics>(() =>
    initialBasemapDiagnostics(readBrowserNetwork()),
  );
  const mountedRef = useRef(true);
  const healthAbortRef = useRef<AbortController | null>(null);
  const retryAbortRef = useRef<AbortController | null>(null);
  const lastHealthCheckRef = useRef(0);
  const activeBasemapRef = useRef(options.activeBasemap);
  const activeScopeKeyRef = useRef(scopeKey);
  const committedScopeKeyRef = useRef(scopeKey);
  const pendingScopeKeyRef = useRef<string | null>(null);
  const loadCycleRef = useRef<BasemapSourceLoadCycle | null>(null);
  const retryBasemapRef = useRef(options.retryBasemap);
  activeBasemapRef.current = options.activeBasemap;
  activeScopeKeyRef.current = scopeKey;
  retryBasemapRef.current = options.retryBasemap;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      healthAbortRef.current?.abort();
      retryAbortRef.current?.abort();
    };
  }, []);

  const checkPlatform = useCallback(async (force = false) => {
    const network = readBrowserNetwork();
    setDiagnostics((current) => ({ ...current, network }));
    if (!network.online) {
      setDiagnostics((current) => ({
        ...current,
        network,
        platformChecking: false,
      }));
      return;
    }

    const now = Date.now();
    if (!force && now - lastHealthCheckRef.current < 5_000) {
      return;
    }
    lastHealthCheckRef.current = now;
    healthAbortRef.current?.abort();
    const controller = new AbortController();
    healthAbortRef.current = controller;
    setDiagnostics((current) => ({
      ...current,
      platform: current.checkedAt === null ? "checking" : current.platform,
      platformChecking: true,
    }));
    try {
      const result = await probePlatformHealth({ signal: controller.signal });
      if (!mountedRef.current || result.status === "cancelled") return;
      setDiagnostics((current) =>
        result.status === "reachable"
          ? {
              ...current,
              platform: "reachable",
              platformChecking: false,
              platformLatencyMs: result.latencyMs,
              checkedAt: Date.now(),
            }
          : {
              ...current,
              platform: "unreachable",
              platformChecking: false,
              platformLatencyMs: null,
              checkedAt: Date.now(),
            },
      );
    } finally {
      if (healthAbortRef.current === controller) {
        healthAbortRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    const connection = browserConnection();
    const syncNetwork = () => {
      const network = readBrowserNetwork();
      setDiagnostics((current) => ({ ...current, network }));
      if (network.online) {
        void checkPlatform(true);
      }
    };

    window.addEventListener("online", syncNetwork);
    window.addEventListener("offline", syncNetwork);
    connection?.addEventListener("change", syncNetwork);
    void checkPlatform(true);
    const intervalId = window.setInterval(
      () => void checkPlatform(),
      healthCheckIntervalMs,
    );
    return () => {
      window.removeEventListener("online", syncNetwork);
      window.removeEventListener("offline", syncNetwork);
      connection?.removeEventListener("change", syncNetwork);
      window.clearInterval(intervalId);
    };
  }, [checkPlatform]);

  useEffect(() => {
    if (committedScopeKeyRef.current === scopeKey) return;
    committedScopeKeyRef.current = scopeKey;
    retryAbortRef.current?.abort();
    retryAbortRef.current = null;
    pendingScopeKeyRef.current = scopeKey;
    const network = readBrowserNetwork();
    setDiagnostics((current) => ({
      ...resetBasemapDiagnosticsForSwitch(current),
      network,
    }));
  }, [scopeKey]);

  useEffect(() => {
    if (!map) return;

    const scopedBasemap = activeBasemapRef.current;
    const scopedKey = scopeKey;
    const attachedAt = performance.now();
    const tileStarts = new BasemapTileRequestTimings();
    const loadCycle = new BasemapSourceLoadCycle(
      currentBasemapSourceIds(map, scopedBasemap),
    );
    loadCycleRef.current = loadCycle;
    let observedScopedActivity = false;
    const updateDiagnostics = (
      updater: (current: BasemapDiagnostics) => BasemapDiagnostics,
    ) => {
      setDiagnostics((current) =>
        activeScopeKeyRef.current === scopedKey ? updater(current) : current,
      );
    };
    const reportReady = (latencyMs: number | null) => {
      if (pendingScopeKeyRef.current === scopedKey) {
        pendingScopeKeyRef.current = null;
      }
      updateDiagnostics((current) =>
        readyBasemapDiagnostics(current, latencyMs),
      );
    };
    const handleSourceLoading = (event: MapSourceDataEvent) => {
      const sourceId = event.sourceId;
      if (!sourceId || !isBasemapSourceId(sourceId, scopedBasemap)) return;
      observedScopedActivity = true;
      loadCycle.loading(sourceId, currentBasemapSourceIds(map, scopedBasemap));
      const key = tileRequestKey(event);
      if (key !== undefined) {
        tileStarts.start(key, performance.now());
      }
      updateDiagnostics((current) => ({
        ...current,
        basemap: "loading",
        basemapLoadingSince: current.basemapLoadingSince ?? Date.now(),
      }));
    };
    const handleSourceData = (event: MapSourceDataEvent) => {
      const sourceId = event.sourceId;
      if (!sourceId || !isBasemapSourceId(sourceId, scopedBasemap)) return;
      observedScopedActivity = true;
      const activeSourceIds = currentBasemapSourceIds(map, scopedBasemap);
      const key = tileRequestKey(event);
      const startedAt = tileStarts.finish(key);
      if (event.sourceDataType === "error") {
        loadCycle.fail(activeSourceIds);
        updateDiagnostics(failedBasemapDiagnostics);
        void checkPlatform();
        return;
      }

      const latencyMs =
        startedAt === undefined
          ? null
          : Math.max(1, Math.round(performance.now() - startedAt));
      if (event.isSourceLoaded && loadCycle.loaded(sourceId, activeSourceIds)) {
        reportReady(latencyMs);
      } else if (latencyMs !== null) {
        updateDiagnostics((current) => ({
          ...current,
          basemapLatencyMs: smoothLatency(current.basemapLatencyMs, latencyMs),
        }));
      }
    };
    const handleMapLoad = () => {
      if (
        pendingScopeKeyRef.current === scopedKey &&
        scopedBasemap !== undefined &&
        !observedScopedActivity
      ) {
        return;
      }
      if (
        loadCycle.completeFromMapLifecycle(
          currentBasemapSourceIds(map, scopedBasemap),
        )
      ) {
        reportReady(Math.max(1, Math.round(performance.now() - attachedAt)));
      }
    };
    const handleIdle = () => {
      tileStarts.clear();
      if (
        pendingScopeKeyRef.current === scopedKey &&
        scopedBasemap !== undefined &&
        !observedScopedActivity
      ) {
        return;
      }
      if (
        !loadCycle.completeFromMapLifecycle(
          currentBasemapSourceIds(map, scopedBasemap),
        )
      ) {
        return;
      }
      updateDiagnostics((current) => {
        const latencyMs =
          current.basemapLoadingSince === null
            ? null
            : Date.now() - current.basemapLoadingSince;
        return {
          ...current,
          basemap: "ready",
          basemapLatencyMs:
            latencyMs === null
              ? current.basemapLatencyMs
              : smoothLatency(current.basemapLatencyMs, latencyMs),
          basemapLoadingSince: null,
          recentBasemapFailures: 0,
        };
      });
    };
    const handleMapError = (event: MapResourceErrorEvent) => {
      const clearlyBusinessResource =
        event.sourceId !== undefined &&
        !isBasemapSourceId(event.sourceId, scopedBasemap);
      const isBasemapError = isBasemapResourceError(event, scopedBasemap);
      if (scopedBasemap !== undefined && !isBasemapError) {
        return;
      }
      if (!isBasemapError && (map.loaded() || clearlyBusinessResource)) {
        return;
      }
      tileStarts.clear();
      loadCycle.fail(currentBasemapSourceIds(map, scopedBasemap));
      updateDiagnostics(failedBasemapDiagnostics);
      void checkPlatform();
    };

    map.on("sourcedataloading", handleSourceLoading);
    map.on("sourcedata", handleSourceData);
    map.on("load", handleMapLoad);
    map.on("idle", handleIdle);
    map.on("error", handleMapError);
    if (
      map.loaded() &&
      pendingScopeKeyRef.current !== scopedKey &&
      loadCycle.completeFromMapLifecycle(
        currentBasemapSourceIds(map, scopedBasemap),
      )
    ) {
      reportReady(null);
    }

    return () => {
      map.off("sourcedataloading", handleSourceLoading);
      map.off("sourcedata", handleSourceData);
      map.off("load", handleMapLoad);
      map.off("idle", handleIdle);
      map.off("error", handleMapError);
      tileStarts.clear();
      if (loadCycleRef.current === loadCycle) {
        loadCycleRef.current = null;
      }
    };
  }, [checkPlatform, map, scopeKey]);

  const refresh = useCallback(() => {
    const network = readBrowserNetwork();
    const retryBasemap = retryBasemapRef.current;
    const scopedKey = activeScopeKeyRef.current;
    const currentBasemap = activeBasemapRef.current;
    const loadCycle = loadCycleRef.current;
    const activeSourceIds = map
      ? currentBasemapSourceIds(map, currentBasemap)
      : [];
    loadCycle?.reset(activeSourceIds);
    const updateDiagnostics = (
      updater: (current: BasemapDiagnostics) => BasemapDiagnostics,
    ) => {
      setDiagnostics((current) =>
        activeScopeKeyRef.current === scopedKey ? updater(current) : current,
      );
    };
    updateDiagnostics((current) =>
      retryBasemap
        ? {
            ...resetBasemapDiagnosticsForSwitch(current),
            network,
          }
        : {
            ...current,
            network,
            basemap: map?.loaded() ? "ready" : "loading",
            basemapLoadingSince: map?.loaded() ? null : Date.now(),
            recentBasemapFailures: map?.loaded()
              ? 0
              : current.recentBasemapFailures,
          },
    );
    if (!retryBasemap && map?.loaded()) {
      loadCycle?.completeFromMapLifecycle(activeSourceIds);
    }
    void checkPlatform(true);

    if (!retryBasemap) return;
    pendingScopeKeyRef.current = scopedKey;
    retryAbortRef.current?.abort();
    const controller = new AbortController();
    retryAbortRef.current = controller;
    const startedAt = performance.now();
    void (async () => {
      try {
        const result = await retryBasemap({
          activeBasemap: activeBasemapRef.current,
          signal: controller.signal,
        });
        if (
          result === undefined ||
          controller.signal.aborted ||
          activeScopeKeyRef.current !== scopedKey
        ) {
          return;
        }
        if (result.ok) {
          if (pendingScopeKeyRef.current === scopedKey) {
            pendingScopeKeyRef.current = null;
          }
          loadCycle?.completeFromMapLifecycle(activeSourceIds);
          const latencyMs =
            result.latencyMs == null
              ? Math.max(1, Math.round(performance.now() - startedAt))
              : result.latencyMs;
          updateDiagnostics((current) =>
            readyBasemapDiagnostics(current, latencyMs),
          );
        } else {
          if (pendingScopeKeyRef.current === scopedKey) {
            pendingScopeKeyRef.current = null;
          }
          loadCycle?.fail(activeSourceIds);
          updateDiagnostics(failedBasemapDiagnostics);
        }
      } catch {
        if (
          !controller.signal.aborted &&
          activeScopeKeyRef.current === scopedKey
        ) {
          if (pendingScopeKeyRef.current === scopedKey) {
            pendingScopeKeyRef.current = null;
          }
          loadCycle?.fail(activeSourceIds);
          updateDiagnostics(failedBasemapDiagnostics);
        }
      } finally {
        if (retryAbortRef.current === controller) {
          retryAbortRef.current = null;
        }
      }
    })();
  }, [checkPlatform, map]);

  return { diagnostics, refresh };
}

function readyBasemapDiagnostics(
  current: BasemapDiagnostics,
  latencyMs: number | null,
): BasemapDiagnostics {
  return {
    ...current,
    basemap: "ready",
    basemapLatencyMs:
      latencyMs === null
        ? current.basemapLatencyMs
        : smoothLatency(current.basemapLatencyMs, latencyMs),
    basemapLoadingSince: null,
    recentBasemapFailures: 0,
  };
}

function failedBasemapDiagnostics(
  current: BasemapDiagnostics,
): BasemapDiagnostics {
  return {
    ...current,
    basemap: "failed",
    basemapLoadingSince: null,
    recentBasemapFailures: current.recentBasemapFailures + 1,
  };
}

function smoothLatency(current: number | null, sample: number) {
  const normalizedSample = Math.max(1, Math.round(sample));
  return current === null
    ? normalizedSample
    : Math.round(current * 0.65 + normalizedSample * 0.35);
}

function tileRequestKey(event: MapSourceDataEvent) {
  return event.coord && event.sourceId
    ? `${event.sourceId}:${event.coord.key}`
    : undefined;
}

function currentBasemapSourceIds(
  map: MapboxMap,
  activeBasemap: ActiveBasemapDescriptor | null | undefined,
) {
  try {
    return Object.keys(map.getStyle().sources ?? {}).filter((sourceId) =>
      isBasemapSourceId(sourceId, activeBasemap),
    );
  } catch {
    return [];
  }
}

function normalizedSourceIds(sourceIds: Iterable<string>) {
  const normalized = new Set<string>();
  for (const sourceId of sourceIds) {
    if (sourceId) normalized.add(sourceId);
  }
  return normalized;
}

function readBrowserNetwork(): BrowserNetworkSnapshot {
  const connection = browserConnection();
  return {
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    effectiveType: connection?.effectiveType ?? null,
    rttMs: finiteNumber(connection?.rtt),
    downlinkMbps: finiteNumber(connection?.downlink),
  };
}

function browserConnection() {
  if (typeof navigator === "undefined") return null;
  const candidate = navigator as NavigatorWithConnection;
  return (
    candidate.connection ??
    candidate.mozConnection ??
    candidate.webkitConnection ??
    null
  );
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
