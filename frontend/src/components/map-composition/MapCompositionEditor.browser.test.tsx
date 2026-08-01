import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultCompositionLayout } from "../../map-composition/layout";
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

function editor(bounds: [number, number, number, number]) {
  return (
    <ConfigProvider locale={zhCN}>
      <AntApp>
        <MapCompositionEditor
          open
          composition={composition}
          map={null}
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
});
