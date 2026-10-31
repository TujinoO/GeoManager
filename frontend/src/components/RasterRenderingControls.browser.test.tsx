import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { LayerContext, type LayerContextValue } from "../hooks/LayerContext";
import { cloneDefaultRasterSymbolization } from "../symbolization";
import type { LoadedRasterLayer } from "../types";
import RasterRenderingControls from "./RasterRenderingControls";

function setup(canEdit = true, busy = false) {
  const value = cloneDefaultRasterSymbolization();
  const layer = {
    id: "raster",
    layerType: "raster",
    renderStatus: busy ? "running" : "ready",
    symbolization: value,
  } as LoadedRasterLayer;
  const context = {
    groups: [{ id: "group", children: [layer] }],
    canUseCustomSymbolization: canEdit,
    setLayerSymbolization: vi.fn(),
    startRasterRender: vi.fn(),
  } as unknown as LayerContextValue;
  render(
    <LayerContext.Provider value={context}>
      <RasterRenderingControls
        layer={layer}
        value={value}
        bands={[{ band: 1, label: "第一波段" }]}
      />
    </LayerContext.Provider>,
  );
  return context;
}
it("applies a local draft only after the user requests backend rendering", () => {
  const ctx = setup();
  fireEvent.click(screen.getByRole("switch", { name: "NoData透明" }));
  expect(ctx.startRasterRender).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "应用渲染方案" }));
  expect(ctx.startRasterRender).toHaveBeenCalledWith(
    "group",
    "raster",
    expect.objectContaining({ nodata: { enabled: false } }),
    expect.anything(),
    "custom",
  );
});
it("blocks customization without permission and while rendering", () => {
  setup(false);
  expect(screen.getByRole("button", { name: "应用渲染方案" })).toBeDisabled();
});
it("blocks duplicate rendering while a job is running", () => {
  const ctx = setup(true, true);
  expect(screen.getByRole("button", { name: "正在渲染" })).toBeDisabled();
  expect(ctx.startRasterRender).not.toHaveBeenCalled();
});
