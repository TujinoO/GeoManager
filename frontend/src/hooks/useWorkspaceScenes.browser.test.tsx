import { App as AntApp } from "antd";
import { workspaceInventoryChangedEvent } from "../workspace/workspaceSync";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useWorkspaceScenes } from "./useWorkspaceScenes";
import type { LoadedLayerGroup, WorkspaceSceneSummary } from "../types";

const mocks = vi.hoisted(() => ({
  workspaces: vi.fn(),
  workspace: vi.fn(),
  restore: vi.fn(),
}));
vi.mock("../api/client", () => ({ api: mocks }));
vi.mock("../workspace/workspaceRestore", () => ({
  restoreWorkspaceGroups: mocks.restore,
}));
const group = {
  id: "restored",
  children: [
    {
      id: "valid-layer",
      layerType: "vector",
      sourceResource: { id: 1 },
      symbolization: {},
    },
  ],
} as unknown as LoadedLayerGroup;
const summary = {
  id: 1,
  kind: "project",
  name: "分页工程",
} as WorkspaceSceneSummary;
function options() {
  return {
    canViewWorkspaces: true,
    canQueryData: true,
    canLoadVectorLayer: true,
    canLoadRasterLayer: true,
    queryResultLimit: 30000,
    groups: [],
    selectedLayerId: null,
    currentMapView: null,
    mapRef: { current: null },
    replaceGroups: vi.fn(),
    setSelectedLayerId: vi.fn(),
    onWorkspaceLoaded: vi.fn(),
  };
}
function response(name: string, total = 1) {
  return {
    items: [{ ...summary, name }],
    total,
    limit: 24,
    offset: 0,
    availableAccessGroups: [],
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.restore.mockResolvedValue({ groups: [group], issues: [] });
});
function show() {
  const setup = options();
  const view = renderHook(() => useWorkspaceScenes(setup), {
    wrapper: ({ children }) => <AntApp>{children}</AntApp>,
  });
  return { ...view, setup };
}

it("coalesces identical in-flight list requests and ignores a late old search", async () => {
  const pending: Array<(value: unknown) => void> = [];
  mocks.workspaces.mockImplementation(
    () => new Promise((resolve) => pending.push(resolve)),
  );
  const { result } = show();
  let first!: Promise<unknown>,
    duplicate!: Promise<unknown>,
    latest!: Promise<unknown>;
  act(() => {
    first = result.current.loadWorkspaceScenes({ q: "旧搜索" });
    duplicate = result.current.loadWorkspaceScenes({ q: "旧搜索" });
  });
  expect(mocks.workspaces).toHaveBeenCalledTimes(1);
  act(() => {
    latest = result.current.loadWorkspaceScenes({ q: "新搜索" });
  });
  await act(async () => {
    pending[1]!(response("新结果"));
    await latest;
  });
  await act(async () => {
    pending[0]!(response("旧结果"));
    await Promise.all([first, duplicate]);
  });
  expect(result.current.workspaceScenes[0]!.name).toBe("新结果");
  expect(result.current.workspaceQuery.q).toBe("新搜索");
});

it("loads details on demand and repairs a selected layer that cannot be restored", async () => {
  mocks.workspace.mockResolvedValue({
    ...summary,
    snapshot: { groups: [group], selectedLayerId: "missing" },
  });
  const { result, setup } = show();
  await act(async () => {
    await result.current.loadWorkspaceScene(summary);
  });
  expect(mocks.workspace).toHaveBeenCalledWith(1);
  expect(setup.replaceGroups).toHaveBeenCalledWith([group]);
  expect(setup.setSelectedLayerId).toHaveBeenCalledWith("valid-layer");
});

it("moves back to the last available page after the last page becomes empty", async () => {
  mocks.workspaces
    .mockResolvedValueOnce({ items: [], total: 25, limit: 24, offset: 48 })
    .mockResolvedValueOnce(response("最后一页", 25));
  const { result } = show();
  await act(async () => {
    await result.current.loadWorkspaceScenes({ q: "", offset: 48 });
  });
  expect(mocks.workspaces).toHaveBeenLastCalledWith({
    q: "",
    offset: 24,
    limit: 24,
  });
  expect(result.current.workspaceQuery.offset).toBe(24);
});

it("refreshes after an inventory change instead of reusing a pre-save list", async () => {
  const pending: Array<(value: unknown) => void> = [];
  mocks.workspaces.mockImplementation(
    () => new Promise((resolve) => pending.push(resolve)),
  );
  const { result } = show();
  let old!: Promise<unknown>;
  act(() => {
    old = result.current.loadWorkspaceScenes();
  });
  act(() => {
    window.dispatchEvent(
      new CustomEvent(workspaceInventoryChangedEvent, {
        detail: { kind: "workspace", at: Date.now() },
      }),
    );
  });
  expect(mocks.workspaces).toHaveBeenCalledTimes(2);
  await act(async () => {
    pending[1]!(response("刚保存的工程"));
    await Promise.resolve();
  });
  await act(async () => {
    pending[0]!(response("保存前列表"));
    await old;
  });
  expect(result.current.workspaceScenes[0]!.name).toBe("刚保存的工程");
});
