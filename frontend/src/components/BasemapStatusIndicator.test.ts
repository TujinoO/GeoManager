import { describe, expect, it } from "vitest";
import {
  formatBasemapServiceDetail,
  formatTiandituFailureDiagnostic,
} from "./BasemapStatusIndicator";

describe("formatBasemapServiceDetail", () => {
  it("prefixes the diagnostic with the active basemap name", () => {
    expect(
      formatBasemapServiceDetail(
        "Mapbox 卫星实景图",
        "可访问 · 最近响应 620 ms",
      ),
    ).toBe("Mapbox 卫星实景图 · 可访问 · 最近响应 620 ms");
  });

  it("keeps the existing diagnostic when no display name is provided", () => {
    expect(formatBasemapServiceDetail(undefined, "正在加载当前视野")).toBe(
      "正在加载当前视野",
    );
    expect(formatBasemapServiceDetail("   ", "加载失败 · 最近 2 次")).toBe(
      "加载失败 · 最近 2 次",
    );
  });

  it("shows only sanitized Tianditu failure-window diagnostics", () => {
    expect(
      formatTiandituFailureDiagnostic({
        observedAt: 1_000,
        details: {
          attempts: 2,
          businessCode: "301018",
          failureKind: "transient",
          failureWindow: {
            consecutiveFailures: 1,
            failureCount: 1,
            failureRate: 0.125,
            sampleCount: 8,
            tripped: false,
            windowMs: 15_000,
          },
          layer: "cva",
          node: "t3",
          status: 403,
        },
      }),
    ).toBe("瞬时错误 · 瓦片失败 1/8（13%） · 业务码 301018 · 注记层 · t3");
  });
});
