import { describe, expect, it } from "vitest";
import { formatBasemapServiceDetail } from "./BasemapStatusIndicator";

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
});
