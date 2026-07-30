import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapboxMap, MapSourceDataEvent } from "mapbox-gl";
import {
  initialBasemapDiagnostics,
  isBasemapResourceError,
  isBasemapSourceId,
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

export function useBasemapStatus(map: MapboxMap | null) {
  const [diagnostics, setDiagnostics] = useState<BasemapDiagnostics>(() =>
    initialBasemapDiagnostics(readBrowserNetwork()),
  );
  const mountedRef = useRef(true);
  const healthAbortRef = useRef<AbortController | null>(null);
  const lastHealthCheckRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      healthAbortRef.current?.abort();
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

    const timeoutId = window.setTimeout(
      () => controller.abort(),
      healthCheckTimeoutMs,
    );
    const startedAt = performance.now();
    try {
      const response = await fetch("/api/health/", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      if (!mountedRef.current || controller.signal.aborted) return;
      setDiagnostics((current) => ({
        ...current,
        platform: "reachable",
        platformChecking: false,
        platformLatencyMs: Math.max(
          1,
          Math.round(performance.now() - startedAt),
        ),
        checkedAt: Date.now(),
      }));
    } catch {
      if (!mountedRef.current || controller.signal.aborted) return;
      setDiagnostics((current) => ({
        ...current,
        platform: "unreachable",
        platformChecking: false,
        platformLatencyMs: null,
        checkedAt: Date.now(),
      }));
    } finally {
      window.clearTimeout(timeoutId);
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
    if (!map) return;

    const attachedAt = performance.now();
    const tileStarts = new BasemapTileRequestTimings();
    const reportReady = (latencyMs: number | null) => {
      setDiagnostics((current) => ({
        ...current,
        basemap: "ready",
        basemapLatencyMs:
          latencyMs === null
            ? current.basemapLatencyMs
            : smoothLatency(current.basemapLatencyMs, latencyMs),
        basemapLoadingSince: null,
        recentBasemapFailures: 0,
      }));
    };
    const handleSourceLoading = (event: MapSourceDataEvent) => {
      if (!isBasemapSourceId(event.sourceId)) return;
      const key = tileRequestKey(event);
      if (key !== undefined) {
        tileStarts.start(key, performance.now());
      }
      setDiagnostics((current) => ({
        ...current,
        basemap: "loading",
        basemapLoadingSince: current.basemapLoadingSince ?? Date.now(),
      }));
    };
    const handleSourceData = (event: MapSourceDataEvent) => {
      if (!isBasemapSourceId(event.sourceId)) return;
      const key = tileRequestKey(event);
      const startedAt = tileStarts.finish(key);
      if (event.sourceDataType === "error") {
        reportBasemapFailure(setDiagnostics);
        void checkPlatform();
        return;
      }

      const latencyMs =
        startedAt === undefined
          ? null
          : Math.max(1, Math.round(performance.now() - startedAt));
      if (event.isSourceLoaded) {
        reportReady(latencyMs);
      } else if (latencyMs !== null) {
        setDiagnostics((current) => ({
          ...current,
          basemapLatencyMs: smoothLatency(current.basemapLatencyMs, latencyMs),
        }));
      }
    };
    const handleMapLoad = () =>
      reportReady(Math.max(1, Math.round(performance.now() - attachedAt)));
    const handleIdle = () => {
      tileStarts.clear();
      setDiagnostics((current) => {
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
        event.sourceId !== undefined && !isBasemapSourceId(event.sourceId);
      if (
        !isBasemapResourceError(event) &&
        (map.loaded() || clearlyBusinessResource)
      ) {
        return;
      }
      tileStarts.clear();
      reportBasemapFailure(setDiagnostics);
      void checkPlatform();
    };

    map.on("sourcedataloading", handleSourceLoading);
    map.on("sourcedata", handleSourceData);
    map.on("load", handleMapLoad);
    map.on("idle", handleIdle);
    map.on("error", handleMapError);
    if (map.loaded()) {
      reportReady(null);
    }

    return () => {
      map.off("sourcedataloading", handleSourceLoading);
      map.off("sourcedata", handleSourceData);
      map.off("load", handleMapLoad);
      map.off("idle", handleIdle);
      map.off("error", handleMapError);
      tileStarts.clear();
    };
  }, [checkPlatform, map]);

  const refresh = useCallback(() => {
    const network = readBrowserNetwork();
    setDiagnostics((current) => ({
      ...current,
      network,
      basemap: map?.loaded() ? "ready" : "loading",
      basemapLoadingSince: map?.loaded() ? null : Date.now(),
      recentBasemapFailures: map?.loaded() ? 0 : current.recentBasemapFailures,
    }));
    void checkPlatform(true);
  }, [checkPlatform, map]);

  return { diagnostics, refresh };
}

function reportBasemapFailure(
  setDiagnostics: React.Dispatch<React.SetStateAction<BasemapDiagnostics>>,
) {
  setDiagnostics((current) => ({
    ...current,
    basemap: "failed",
    basemapLoadingSince: null,
    recentBasemapFailures: current.recentBasemapFailures + 1,
  }));
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
