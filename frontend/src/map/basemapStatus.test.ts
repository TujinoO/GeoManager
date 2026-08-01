import { describe, expect, it } from "vitest";
import {
  activeBasemapScopeKey,
  classifyBasemapStatus,
  initialBasemapDiagnostics,
  isBasemapResourceError,
  isBasemapSourceId,
  resetBasemapDiagnosticsForSwitch,
  type ActiveBasemapDescriptor,
  type BasemapDiagnostics,
  type BrowserNetworkSnapshot,
} from "./basemapStatus";

const normalNetwork: BrowserNetworkSnapshot = {
  online: true,
  effectiveType: "4g",
  rttMs: 80,
  downlinkMbps: 10,
};

const activeBasemap: ActiveBasemapDescriptor = {
  id: "tianditu-imagery",
  generation: 3,
  sourceIds: ["tianditu-image", "tianditu-labels"],
  resourceMarkers: ["tianditu.gov.cn"],
};

function diagnostics(
  patch: Partial<BasemapDiagnostics> = {},
): BasemapDiagnostics {
  return {
    ...initialBasemapDiagnostics(normalNetwork),
    platform: "reachable",
    platformChecking: false,
    platformLatencyMs: 120,
    basemap: "ready",
    basemapLatencyMs: 640,
    checkedAt: 1,
    ...patch,
  };
}

describe("classifyBasemapStatus", () => {
  it("reports a browser-side network outage first", () => {
    const result = classifyBasemapStatus(
      diagnostics({ network: { ...normalNetwork, online: false } }),
    );

    expect(result).toMatchObject({
      kind: "network",
      tone: "error",
      label: "网络已断开",
    });
  });

  it("attributes a failed health check to the platform connection", () => {
    const result = classifyBasemapStatus(
      diagnostics({ platform: "unreachable", platformLatencyMs: null }),
    );

    expect(result).toMatchObject({
      kind: "platform",
      tone: "error",
      label: "平台连接异常",
    });
  });

  it("attributes tile failures to the basemap service when the platform is reachable", () => {
    const result = classifyBasemapStatus(
      diagnostics({ basemap: "failed", recentBasemapFailures: 2 }),
    );

    expect(result).toMatchObject({
      kind: "service",
      tone: "error",
      label: "底图服务异常",
    });
  });

  it("attributes tile failures to a browser-reported slow network", () => {
    const result = classifyBasemapStatus(
      diagnostics({
        network: { ...normalNetwork, rttMs: 1_500 },
        basemap: "failed",
        recentBasemapFailures: 1,
      }),
    );

    expect(result).toMatchObject({
      kind: "network",
      tone: "error",
      label: "网络可能不稳定",
    });
  });

  it("reports a slow basemap separately from a healthy platform", () => {
    const result = classifyBasemapStatus(
      diagnostics({ basemapLatencyMs: 4_200 }),
    );

    expect(result).toMatchObject({
      kind: "service",
      tone: "warning",
      label: "底图延迟较高",
    });
  });

  it("reports the healthy latency state", () => {
    const result = classifyBasemapStatus(diagnostics());

    expect(result).toMatchObject({
      kind: "healthy",
      tone: "success",
      label: "底图正常",
    });
  });

  it("keeps business and query sources out of basemap diagnostics", () => {
    expect(isBasemapSourceId("composite")).toBe(true);
    expect(isBasemapSourceId("osm-raster")).toBe(true);
    expect(isBasemapSourceId("loaded-raster-12")).toBe(false);
    expect(isBasemapSourceId("query-spatial-filter")).toBe(false);
  });

  it("recognizes external basemap errors without a source id", () => {
    expect(
      isBasemapResourceError({
        error: new Error(
          "Failed to fetch https://a.tile.openstreetmap.org/4/12/6.png",
        ),
      }),
    ).toBe(true);
    expect(
      isBasemapResourceError({
        sourceId: "loaded-raster-12",
        error: new Error(
          "Failed to fetch /api/raster/tiles/12/hash/4/12/6.png",
        ),
      }),
    ).toBe(false);
  });

  it("matches only the explicitly active basemap sources", () => {
    expect(isBasemapSourceId("tianditu-image", activeBasemap)).toBe(true);
    expect(isBasemapSourceId("composite", activeBasemap)).toBe(false);
    expect(isBasemapSourceId("loaded-raster-12", activeBasemap)).toBe(false);
    expect(isBasemapSourceId("tianditu-image", null)).toBe(false);
  });

  it("uses active resource markers without attributing business source errors", () => {
    expect(
      isBasemapResourceError(
        {
          error: new Error(
            "Failed to fetch https://t0.tianditu.gov.cn/img_w/wmts",
          ),
        },
        activeBasemap,
      ),
    ).toBe(true);
    expect(
      isBasemapResourceError(
        {
          error: new Error("Failed to fetch https://api.mapbox.com/style"),
        },
        activeBasemap,
      ),
    ).toBe(false);
    expect(
      isBasemapResourceError(
        {
          sourceId: "loaded-raster-12",
          error: new Error(
            "Failed to fetch https://t0.tianditu.gov.cn/img_w/wmts",
          ),
        },
        activeBasemap,
      ),
    ).toBe(false);
    expect(
      isBasemapResourceError(
        { error: new Error("unrelated error") },
        { ...activeBasemap, resourceMarkers: [" "] },
      ),
    ).toBe(false);
  });

  it("changes scope identity when the basemap generation changes", () => {
    expect(activeBasemapScopeKey(activeBasemap)).not.toBe(
      activeBasemapScopeKey({ ...activeBasemap, generation: 4 }),
    );
    expect(activeBasemapScopeKey(activeBasemap)).not.toBe(
      activeBasemapScopeKey({
        ...activeBasemap,
        requireAllSourceIds: true,
      }),
    );
    expect(activeBasemapScopeKey(undefined)).toBe("legacy");
    expect(activeBasemapScopeKey(null)).toBe("none");
  });

  it("resets basemap measurements without discarding platform diagnostics", () => {
    const current = diagnostics({
      basemap: "failed",
      basemapLatencyMs: 4_200,
      basemapLoadingSince: null,
      recentBasemapFailures: 3,
    });

    expect(resetBasemapDiagnosticsForSwitch(current, 8_000)).toEqual({
      ...current,
      basemap: "loading",
      basemapLatencyMs: null,
      basemapLoadingSince: 8_000,
      recentBasemapFailures: 0,
    });
  });
});
