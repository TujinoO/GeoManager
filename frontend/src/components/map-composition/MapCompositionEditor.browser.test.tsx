import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { Map as MapboxMap } from "mapbox-gl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { defaultCompositionLayout } from "../../map-composition/layout";
import { renderCompositionPng } from "../../map-composition/render";
import type { MapComposition } from "../../types";
import MapCompositionEditor from "./MapCompositionEditor";

vi.mock("../../api/client", () => ({
  api: {
    updateMapComposition: vi.fn(),
    createMapCompositionVersion: vi.fn(),
    downloadMapCompositionVersion: vi.fn(),
    mapComposition: vi.fn(),
  },
}));

vi.mock("../../map-composition/render", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../map-composition/render")>();
  return {
    ...actual,
    renderCompositionPng: vi.fn(),
  };
});

const renderCompositionPngMock = vi.mocked(renderCompositionPng);

function mapStub() {
  return { on: vi.fn(), off: vi.fn() } as unknown as MapboxMap;
}

const composition: MapComposition = {
  id: 31,
  projectId: 12,
  projectName: "联调工程",
  name: "联调专题图",
  description: "",
  status: "draft",
  layout: defaultCompositionLayout("联调专题图", [80, 35, 90, 45]),
  owner: { id: 1, username: "owner", displayName: "制图员" },
  audienceGroups: [],
  currentVersion: null,
  publishedVersion: null,
  versions: [],
  isOwner: true,
  canPreview: false,
  canDownload: false,
  canEditLayout: true,
  canPublish: false,
  canUnpublish: false,
  canRestoreProject: false,
  canLoadSourceProject: true,
  canDelete: true,
  createdAt: "2026-07-14T10:00:00+08:00",
  updatedAt: "2026-07-14T10:00:00+08:00",
};

function editor(
  bounds: [number, number, number, number],
  map: MapboxMap | null = null,
) {
  return (
    <ConfigProvider locale={zhCN}>
      <AntApp>
        <MapCompositionEditor
          open
          composition={composition}
          map={map}
          groups={[]}
          workspaceSnapshot={{
            version: 2,
            groups: [],
            selectedLayerId: null,
            mapView: null,
          }}
          fallbackBounds={bounds}
          sourceText="数据来源：联调数据"
          canExport
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </AntApp>
    </ConfigProvider>
  );
}

describe("MapCompositionEditor", () => {
  beforeEach(() => {
    vi.mocked(api.updateMapComposition).mockReset();
    vi.mocked(api.updateMapComposition).mockResolvedValue({
      ...composition,
      updatedAt: "2026-07-15T00:00:00Z",
    });
    renderCompositionPngMock.mockReset();
    renderCompositionPngMock.mockResolvedValue(
      new Blob(["preview"], { type: "image/png" }),
    );
  });

  it("keeps unsaved layout edits when the live map bounds change", async () => {
    const view = render(editor([80, 35, 90, 45]));
    const gridLabel = await screen.findByText("格网");
    const gridToggle = within(
      gridLabel.closest("label") as HTMLElement,
    ).getByRole("switch");

    expect(gridToggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(gridToggle);
    await waitFor(() =>
      expect(gridToggle).toHaveAttribute("aria-checked", "true"),
    );

    view.rerender(editor([81, 36, 91, 46]));

    await waitFor(() =>
      expect(gridToggle).toHaveAttribute("aria-checked", "true"),
    );
  });

  it("lets the user reuse and adjust the live workspace map range", async () => {
    render(editor([81, 36, 91, 46]));

    fireEvent.click(
      await screen.findByRole("button", { name: "使用当前工作台范围" }),
    );
    const westInput = screen.getAllByLabelText("西")[0] as HTMLInputElement;
    const eastInput = screen.getAllByLabelText("东")[0] as HTMLInputElement;
    await waitFor(() => expect(Number(westInput.value)).toBe(81));
    expect(Number(eastInput.value)).toBe(91);

    fireEvent.click(screen.getByRole("button", { name: "地图范围向右平移" }));
    await waitFor(() => expect(Number(westInput.value)).toBe(82.2));

    fireEvent.click(screen.getByRole("button", { name: "放大地图范围" }));
    await waitFor(() => expect(Number(westInput.value)).toBeGreaterThan(82.2));
  });

  it("auto previews the latest accumulated range at screen resolution", async () => {
    render(editor([81, 36, 91, 46], mapStub()));

    await screen.findByRole("img", { name: "专题图预览" });
    renderCompositionPngMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "使用当前工作台范围" }));
    const moveRight = screen.getByRole("button", {
      name: "地图范围向右平移",
    });
    fireEvent.click(moveRight);
    fireEvent.click(moveRight);

    await waitFor(() =>
      expect(renderCompositionPngMock).toHaveBeenCalledTimes(1),
    );
    const [, previewLayout, , , options] =
      renderCompositionPngMock.mock.calls[0]!;
    expect(previewLayout.mapFrame.bounds).toEqual([83.4, 36, 93.4, 46]);
    expect(options).toMatchObject({ outputDpi: 96, mapDpi: 96 });
  });

  it("does not restart an immediate refresh from the pending auto timer", async () => {
    render(editor([80, 35, 90, 45], mapStub()));

    await screen.findByRole("img", { name: "专题图预览" });
    renderCompositionPngMock.mockClear();

    let resolvePreview!: (blob: Blob) => void;
    renderCompositionPngMock.mockImplementationOnce(
      () =>
        new Promise<Blob>((resolve) => {
          resolvePreview = resolve;
        }),
    );
    fireEvent.click(screen.getByRole("button", { name: "地图范围向右平移" }));
    fireEvent.click(screen.getByRole("button", { name: "立即刷新" }));

    await waitFor(() =>
      expect(renderCompositionPngMock).toHaveBeenCalledTimes(1),
    );
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    expect(renderCompositionPngMock).toHaveBeenCalledTimes(1);
    expect(renderCompositionPngMock.mock.calls[0]![1].mapFrame.bounds).toEqual([
      81.2, 35, 91.2, 45,
    ]);
    resolvePreview(new Blob(["latest"], { type: "image/png" }));
  });

  it("automatically retries preview when a slow source style finally loads", async () => {
    const map = mapStub();
    renderCompositionPngMock.mockRejectedValueOnce(
      new Error("底图样式加载超时"),
    );
    const view = render(editor([80, 35, 90, 45], map));
    await waitFor(() =>
      expect(renderCompositionPngMock).toHaveBeenCalledTimes(1),
    );
    const handler = vi
      .mocked(map.on)
      .mock.calls.find(([event]) => event === "style.load")?.[1] as () => void;
    expect(handler).toBeTypeOf("function");
    handler();
    await screen.findByRole("img", { name: "专题图预览" });
    expect(renderCompositionPngMock).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(map.off).toHaveBeenCalledWith("style.load", handler);
  });
  it("retains edits and disables autosave after a save conflict", async () => {
    vi.mocked(api.updateMapComposition).mockRejectedValueOnce(
      new Error("内容已更新"),
    );
    render(editor([80, 35, 90, 45]));
    fireEvent.click(await screen.findByRole("button", { name: "添加文字" }));
    const text = screen.getByRole("textbox", { name: "选中要素文字" });
    fireEvent.change(text, { target: { value: "保留本地草稿" } });
    fireEvent.click(await screen.findByRole("button", { name: "保存草稿" }));
    await screen.findByText("保存失败：草稿仍保留在当前页面");
    expect(text).toHaveValue("保留本地草稿");
    expect(
      screen.getByRole("button", { name: "自动保存：关" }),
    ).toBeInTheDocument();
    const retry = screen.getByText("保存草稿").closest("button")!;
    await waitFor(() => expect(retry).not.toHaveClass("ant-btn-loading"));
    fireEvent.click(retry);
    await screen.findByText("已保存", { exact: true });
    expect(
      vi.mocked(api.updateMapComposition).mock.calls[1]?.[1],
    ).toMatchObject({ expectedUpdatedAt: composition.updatedAt });
  });

  it("saves the submitted snapshot without marking later edits saved", async () => {
    let complete!: (value: MapComposition) => void;
    vi.mocked(api.updateMapComposition).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    render(editor([80, 35, 90, 45]));
    fireEvent.click(await screen.findByRole("button", { name: "添加文字" }));
    const text = screen.getByRole("textbox", { name: "选中要素文字" });
    fireEvent.change(text, { target: { value: "提交时文字" } });
    fireEvent.click(await screen.findByRole("button", { name: "保存草稿" }));
    await waitFor(() =>
      expect(api.updateMapComposition).toHaveBeenCalledTimes(1),
    );
    fireEvent.change(text, { target: { value: "保存期间新文字" } });
    complete({ ...composition, updatedAt: "2026-07-15T00:00:00Z" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "保存草稿" })).not.toHaveClass(
        "ant-btn-loading",
      ),
    );
    await screen.findByText("未保存", { exact: true });
    expect(
      vi.mocked(api.updateMapComposition).mock.calls[0]?.[1].layout,
    ).toMatchObject({ extraTexts: [{ text: "提交时文字" }] });
    fireEvent.click(await screen.findByRole("button", { name: "保存草稿" }));
    await screen.findByText("已保存", { exact: true });
    expect(
      vi.mocked(api.updateMapComposition).mock.calls[1]?.[1],
    ).toMatchObject({
      expectedUpdatedAt: "2026-07-15T00:00:00Z",
      layout: { extraTexts: [{ text: "保存期间新文字" }] },
    });
  });

  it("autosaves edits after the idle interval", async () => {
    render(editor([80, 35, 90, 45]));
    fireEvent.click(await screen.findByRole("button", { name: "添加文字" }));
    await waitFor(
      () => expect(api.updateMapComposition).toHaveBeenCalledTimes(1),
      { timeout: 6000 },
    );
    await screen.findByText("已保存", { exact: true });
  });
  it("guards dirty close and refresh while keeping the editor available", async () => {
    render(editor([80, 35, 90, 45]));
    fireEvent.click(await screen.findByRole("button", { name: "添加文字" }));
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    fireEvent.click(document.querySelector(".ant-modal-close")!);
    await screen.findAllByText("保存制图草稿后关闭？");
    fireEvent.click(screen.getByRole("button", { name: "继续编辑" }));
    expect(
      screen.getByRole("textbox", { name: "选中要素文字" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));
    await screen.findByText("已保存", { exact: true });
    const cleanUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanUnload);
    expect(cleanUnload.defaultPrevented).toBe(false);
  });
});
