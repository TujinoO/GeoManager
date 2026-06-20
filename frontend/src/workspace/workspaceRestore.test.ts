import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cloneDefaultGroupSymbolization,
  cloneDefaultRasterSymbolization,
  cloneDefaultVectorSymbolization,
} from "../symbolization";
import type {
  DataResource,
  SavedWorkspaceLayer,
  SavedWorkspaceLayerGroup,
} from "../types";
import type { AppNotification } from "./workspaceNotifications";
import { restoreWorkspaceGroups } from "./workspaceRestore";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    resourceProfile: vi.fn(),
    queryResource: vi.fn(),
  },
}));

vi.mock("../api/client", () => ({
  api: mockApi,
}));

function makeResource(overrides: Partial<DataResource> = {}): DataResource {
  return {
    id: 1,
    name: "测试资源",
    code: "test-resource",
    dataType: "vector",
    category: null,
    source: "测试来源",
    provider: "测试单位",
    dataDate: null,
    spatialExtent: "80,40,85,45",
    coordinateSystem: "EPSG:4326",
    fileFormat: "GPKG",
    description: "",
    qualityNote: "",
    status: "active",
    isQueryable: true,
    isRenderable: true,
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

function makeGroup(children: SavedWorkspaceLayer[]): SavedWorkspaceLayerGroup {
  return {
    id: "group-1",
    name: "测试图层组",
    sourceResource: children[0]?.sourceResource ?? makeResource(),
    visible: true,
    summary: "测试",
    createdAt: "2026-01-01T00:00:00.000Z",
    metadata: {},
    symbolization: cloneDefaultGroupSymbolization(),
    children,
  };
}

function makeSavedVectorLayer(
  overrides: Partial<SavedWorkspaceLayer> = {},
): SavedWorkspaceLayer {
  return {
    id: "vector-1",
    name: "矢量图层",
    layerType: "vector",
    sourceResource: makeResource(),
    geometryType: "Point",
    visible: true,
    summary: "10/10 条",
    metadata: {},
    symbolization: cloneDefaultVectorSymbolization(),
    fields: [],
    query: {
      attributeFilters: [],
      spatialFilter: null,
    },
    ...overrides,
  };
}

function makeSavedRasterLayer(
  overrides: Partial<SavedWorkspaceLayer> = {},
): SavedWorkspaceLayer {
  return {
    id: "raster-1",
    name: "栅格图层",
    layerType: "raster",
    sourceResource: makeResource({ dataType: "raster", name: "栅格资源" }),
    geometryType: "Raster",
    visible: true,
    summary: "XYZ 瓦片已就绪",
    metadata: {},
    symbolization: cloneDefaultRasterSymbolization(),
    fields: [],
    tileUrl: "/api/raster/tiles/7/hash/{z}/{x}/{y}.png",
    rasterDatasetId: 7,
    rasterLayerId: 9,
    renderStatus: "ready",
    renderProgress: 100,
    renderMessages: [],
    ...overrides,
  };
}

const notification = {
  warning: vi.fn(),
} as unknown as AppNotification;

describe("restoreWorkspaceGroups", () => {
  beforeEach(() => {
    mockApi.resourceProfile.mockReset();
    mockApi.queryResource.mockReset();
  });

  it("reports skipped vector layers when query metadata is missing", async () => {
    const result = await restoreWorkspaceGroups({
      savedGroups: [makeGroup([makeSavedVectorLayer({ query: undefined })])],
      canQueryData: true,
      canLoadVectorLayer: true,
      queryResultLimit: 30000,
      notification,
    });

    expect(result.groups).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        layerName: "矢量图层",
        reason: "缺少原始查询条件",
        action: "skipped",
      }),
    ]);
  });

  it("reports skipped vector layers when the original resource query fails", async () => {
    mockApi.resourceProfile.mockRejectedValue(new Error("原始资源不存在"));

    const result = await restoreWorkspaceGroups({
      savedGroups: [makeGroup([makeSavedVectorLayer()])],
      canQueryData: true,
      canLoadVectorLayer: true,
      queryResultLimit: 30000,
      notification,
    });

    expect(result.groups).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        layerName: "矢量图层",
        reason: "原始资源不存在",
        action: "skipped",
      }),
    ]);
  });

  it("keeps raster snapshot references but reports unavailable original raster data", async () => {
    mockApi.resourceProfile.mockRejectedValue(new Error("栅格资源已停用"));

    const result = await restoreWorkspaceGroups({
      savedGroups: [makeGroup([makeSavedRasterLayer()])],
      canQueryData: true,
      canLoadVectorLayer: true,
      queryResultLimit: 30000,
      notification,
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].children).toHaveLength(1);
    expect(result.issues).toEqual([
      expect.objectContaining({
        layerName: "栅格图层",
        reason: "栅格资源已停用",
        action: "restored-with-warning",
      }),
    ]);
  });

  it("restores manually created empty groups", async () => {
    const result = await restoreWorkspaceGroups({
      savedGroups: [{ ...makeGroup([]), isManual: true }],
      canQueryData: true,
      canLoadVectorLayer: true,
      queryResultLimit: 30000,
      notification,
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].isManual).toBe(true);
    expect(result.groups[0].children).toEqual([]);
    expect(result.issues).toEqual([]);
  });
});
