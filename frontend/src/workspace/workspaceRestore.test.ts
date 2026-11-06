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
    renderRaster: vi.fn(),
    renderRasterAsync: vi.fn(),
    rasterJob: vi.fn(),
    rasterDatasets: vi.fn(),
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
    mockApi.renderRaster.mockReset();
    mockApi.renderRasterAsync.mockReset();
    mockApi.rasterJob.mockReset();
    mockApi.rasterDatasets.mockReset();
  });

  it("reports skipped vector layers when query metadata is missing", async () => {
    const result = await restoreWorkspaceGroups({
      savedGroups: [makeGroup([makeSavedVectorLayer({ query: undefined })])],
      canQueryData: true,
      canLoadVectorLayer: true,
      canLoadRasterLayer: true,
      canUseCustomSymbolization: true,
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
      canLoadRasterLayer: true,
      canUseCustomSymbolization: true,
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

  it("does not expose legacy categorical tiles when original raster validation fails", async () => {
    mockApi.resourceProfile.mockRejectedValue(new Error("栅格资源已停用"));

    const result = await restoreWorkspaceGroups({
      savedGroups: [
        makeGroup([
          makeSavedRasterLayer({
            rasterKind: "categorical",
            tileUrl: "/api/raster/tiles/7/v3-style/{z}/{x}/{y}.png?rv=3",
          }),
        ]),
      ],
      canQueryData: true,
      canLoadVectorLayer: true,
      canLoadRasterLayer: true,
      canUseCustomSymbolization: true,
      queryResultLimit: 30000,
      notification,
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].children).toHaveLength(1);
    expect(result.groups[0].children[0]).toMatchObject({
      layerType: "raster",
      tileUrl: undefined,
      renderStatus: "failed",
      renderProgress: 0,
    });
    expect(result.issues).toEqual([
      expect.objectContaining({
        layerName: "栅格图层",
        reason: "栅格资源已停用",
        action: "restored-with-warning",
      }),
    ]);
  });

  it("re-renders a legacy v3 categorical snapshot before exposing v4 tiles", async () => {
    const symbolization = cloneDefaultRasterSymbolization();
    symbolization.mode = "unique";
    symbolization.opacity = 72;
    symbolization.uniqueValues = [
      { value: 1, color: "#112233", label: "类别一" },
    ];
    mockApi.resourceProfile.mockResolvedValue({
      raster: {
        id: 7,
        mapLayerId: 9,
        rasterKind: "categorical",
        metadata: { size: [1024, 1024] },
      },
    });
    mockApi.renderRasterAsync.mockResolvedValue({
      status: "ready",
      result: {
        delivery: "xyz",
        datasetId: 7,
        layerId: 9,
        styleHash: "v4-style",
        tileUrl: "/api/raster/tiles/7/v4-style/{z}/{x}/{y}.png?rv=4",
        minZoom: 0,
        maxZoom: 16,
        tileSampling: "nearest",
        status: "ready",
        imageCoordinates: [
          [100, 40],
          [101, 40],
          [101, 39],
          [100, 39],
        ],
        rules: symbolization,
      },
    });

    const result = await restoreWorkspaceGroups({
      savedGroups: [
        makeGroup([
          makeSavedRasterLayer({
            rasterKind: "categorical",
            symbolization,
            tileUrl: "/api/raster/tiles/7/v3-style/{z}/{x}/{y}.png?rv=3",
          }),
        ]),
      ],
      canQueryData: true,
      canLoadVectorLayer: true,
      canLoadRasterLayer: true,
      canUseCustomSymbolization: true,
      queryResultLimit: 30000,
      notification,
    });

    expect(mockApi.renderRasterAsync).toHaveBeenCalledWith({
      datasetId: 7,
      layerId: 9,
      rules: symbolization,
      rulesMode: "custom",
    });
    const restoredLayer = result.groups[0]?.children[0];
    expect(restoredLayer).toMatchObject({
      layerType: "raster",
      tileUrl: "/api/raster/tiles/7/v4-style/{z}/{x}/{y}.png?rv=4",
      tileMinZoom: 0,
      tileMaxZoom: 16,
      tileSampling: "nearest",
      renderStatus: "ready",
      renderProgress: 100,
      symbolization: {
        opacity: 72,
        mode: "unique",
        uniqueValues: [{ value: 1, color: "#112233", label: "类别一" }],
      },
    });
    expect(result.issues).toEqual([]);
  });

  it("skips raster snapshot references when the current account cannot load rasters", async () => {
    const result = await restoreWorkspaceGroups({
      savedGroups: [makeGroup([makeSavedRasterLayer()])],
      canQueryData: true,
      canLoadVectorLayer: true,
      canLoadRasterLayer: false,
      queryResultLimit: 30000,
      notification,
    });

    expect(mockApi.resourceProfile).not.toHaveBeenCalled();
    expect(result.groups).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        layerName: "栅格图层",
        reason: expect.stringContaining("申请权限"),
        action: "skipped",
      }),
    ]);
  });

  const renderResult = {
    delivery: "xyz",
    datasetId: 8,
    layerId: 10,
    styleHash: "current-file-style",
    tileUrl: "/api/raster/tiles/8/current-file-style/{z}/{x}/{y}.png?rv=4",
    status: "ready",
    minZoom: 0,
    maxZoom: 15,
    rules: cloneDefaultRasterSymbolization(),
  };
  const restoreRaster = (layer = makeSavedRasterLayer()) =>
    restoreWorkspaceGroups({
      savedGroups: [makeGroup([layer])],
      canQueryData: true,
      canLoadVectorLayer: true,
      canLoadRasterLayer: true,
      canUseCustomSymbolization: true,
      queryResultLimit: 30000,
      notification,
    });

  it.each(["imagery", "continuous", "categorical"])(
    "registers saved %s rules even when a stale hash already has rv=4",
    async (rasterKind) => {
      mockApi.resourceProfile.mockResolvedValue({
        resource: makeResource({ dataType: "raster" }),
        raster: { id: 8, mapLayerId: 10, rasterKind },
      });
      mockApi.renderRasterAsync.mockResolvedValue({
        status: "queued",
        id: "job",
      });
      mockApi.rasterJob.mockResolvedValue({
        status: "ready",
        result: renderResult,
      });
      const saved = makeSavedRasterLayer({
        tileUrl: "/api/raster/tiles/7/old-file-style/{z}/{x}/{y}.png?rv=4",
      });
      const result = await restoreRaster(saved);
      expect(mockApi.renderRasterAsync).toHaveBeenCalledWith({
        datasetId: 8,
        layerId: 10,
        rules: saved.symbolization,
        rulesMode: "custom",
      });
      expect(mockApi.rasterJob).toHaveBeenCalledWith("job");
      expect(result.groups[0].children[0]).toMatchObject({
        rasterDatasetId: 8,
        rasterLayerId: 10,
        tileUrl: renderResult.tileUrl,
        renderStatus: "ready",
      });
      expect(result.issues).toEqual([]);
    },
  );

  const checksum = "a".repeat(64);
  const originalDataset = {
    id: 7,
    dataResourceId: null,
    sourceChecksumSha256: checksum,
    rasterKind: "categorical",
    bounds4326: [106, 36, 107, 37],
  };
  const replacementDataset = {
    ...originalDataset,
    id: 8,
    dataResourceId: 159,
    status: "ready",
  };
  const missingResource = () =>
    Object.assign(new Error("资源不存在"), { status: 404 });

  it("recovers a deleted resource only through a unique identical source checksum", async () => {
    const resource = makeResource({
      id: 159,
      name: "重新导入的资源",
      dataType: "raster",
    });
    mockApi.resourceProfile
      .mockRejectedValueOnce(missingResource())
      .mockResolvedValue({
        resource,
        raster: { ...replacementDataset, mapLayerId: 10 },
      });
    mockApi.rasterDatasets.mockResolvedValue({
      items: [originalDataset, replacementDataset],
    });
    mockApi.renderRasterAsync.mockResolvedValue({
      status: "ready",
      result: renderResult,
    });
    const result = await restoreRaster();
    expect(mockApi.resourceProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 159 }),
    );
    expect(result.groups[0].children[0]).toMatchObject({
      sourceResource: resource,
      rasterDatasetId: 8,
      rasterLayerId: 10,
      tileUrl: renderResult.tileUrl,
    });
    expect(result.issues).toEqual([]);
  });

  it.each([
    [
      "different content",
      { ...replacementDataset, sourceChecksumSha256: "b".repeat(64) },
    ],
    [
      "different bounds",
      { ...replacementDataset, bounds4326: [100, 30, 101, 31] },
    ],
    ["different raster kind", { ...replacementDataset, rasterKind: "imagery" }],
    ["failed import", { ...replacementDataset, status: "failed" }],
  ])(
    "does not rebind %s or keep requesting stale tiles",
    async (_, candidate) => {
      mockApi.resourceProfile.mockRejectedValue(missingResource());
      mockApi.rasterDatasets.mockResolvedValue({
        items: [originalDataset, candidate],
      });
      const result = await restoreRaster();
      expect(mockApi.renderRasterAsync).not.toHaveBeenCalled();
      expect(result.groups[0].children[0]).toMatchObject({
        tileUrl: undefined,
        renderStatus: "failed",
      });
      expect(result.issues).toHaveLength(1);
    },
  );

  it("refuses ambiguous identical reimports", async () => {
    mockApi.resourceProfile.mockRejectedValue(missingResource());
    mockApi.rasterDatasets.mockResolvedValue({
      items: [
        originalDataset,
        replacementDataset,
        { ...replacementDataset, id: 9, dataResourceId: 160 },
      ],
    });
    const result = await restoreRaster();
    expect(mockApi.resourceProfile).toHaveBeenCalledTimes(1);
    expect(result.groups[0].children[0]).toMatchObject({
      tileUrl: undefined,
      renderStatus: "failed",
    });
  });

  it("rechecks access to the replacement resource", async () => {
    mockApi.resourceProfile
      .mockRejectedValueOnce(missingResource())
      .mockRejectedValueOnce(
        Object.assign(new Error("Forbidden"), { status: 403 }),
      );
    mockApi.rasterDatasets.mockResolvedValue({
      items: [originalDataset, replacementDataset],
    });
    const result = await restoreRaster();
    expect(result.groups).toEqual([]);
    expect(mockApi.renderRasterAsync).not.toHaveBeenCalled();
  });

  it("keeps a failed render retryable without exposing its obsolete tiles", async () => {
    mockApi.resourceProfile.mockResolvedValue({
      resource: makeResource({ dataType: "raster" }),
      raster: { id: 8, mapLayerId: 10, rasterKind: "categorical" },
    });
    mockApi.renderRasterAsync.mockResolvedValue({
      status: "failed",
      error: "生成失败",
    });
    const result = await restoreRaster();
    expect(result.groups[0].children[0]).toMatchObject({
      tileUrl: undefined,
      renderStatus: "failed",
    });
    expect(result.issues).toEqual([
      expect.objectContaining({ reason: "生成失败" }),
    ]);
  });

  it("rejects a completed job that still returns an obsolete renderer", async () => {
    mockApi.resourceProfile.mockResolvedValue({
      resource: makeResource({ dataType: "raster" }),
      raster: { id: 8, mapLayerId: 10, rasterKind: "categorical" },
    });
    mockApi.renderRasterAsync.mockResolvedValue({
      status: "ready",
      result: {
        ...renderResult,
        tileUrl: "/api/raster/tiles/8/old/{z}/{x}/{y}.png?rv=3",
      },
    });
    const result = await restoreRaster();
    expect(result.groups[0].children[0]).toMatchObject({
      tileUrl: undefined,
      renderStatus: "failed",
    });
  });

  it("uses server defaults when the account cannot customize symbolization", async () => {
    mockApi.resourceProfile.mockResolvedValue({
      resource: makeResource({ dataType: "raster" }),
      raster: { id: 8, mapLayerId: 10, rasterKind: "categorical" },
    });
    mockApi.renderRasterAsync.mockResolvedValue({
      status: "ready",
      result: renderResult,
    });
    const result = await restoreWorkspaceGroups({
      savedGroups: [makeGroup([makeSavedRasterLayer()])],
      canQueryData: true,
      canLoadVectorLayer: true,
      canLoadRasterLayer: true,
      canUseCustomSymbolization: false,
      queryResultLimit: 30000,
      notification,
    });
    expect(mockApi.renderRasterAsync).toHaveBeenCalledWith({
      datasetId: 8,
      layerId: 10,
      rules: undefined,
      rulesMode: "default",
    });
    expect(result.issues).toEqual([]);
  });

  it("skips forbidden raster snapshot references instead of requesting stale tiles", async () => {
    mockApi.resourceProfile.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 }),
    );

    const result = await restoreWorkspaceGroups({
      savedGroups: [makeGroup([makeSavedRasterLayer()])],
      canQueryData: true,
      canLoadVectorLayer: true,
      canLoadRasterLayer: true,
      canUseCustomSymbolization: true,
      queryResultLimit: 30000,
      notification,
    });

    expect(result.groups).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        layerName: "栅格图层",
        reason: expect.stringContaining("申请权限"),
        action: "skipped",
      }),
    ]);
  });

  it("restores manually created empty groups", async () => {
    const result = await restoreWorkspaceGroups({
      savedGroups: [{ ...makeGroup([]), isManual: true }],
      canQueryData: true,
      canLoadVectorLayer: true,
      canLoadRasterLayer: true,
      canUseCustomSymbolization: true,
      queryResultLimit: 30000,
      notification,
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].isManual).toBe(true);
    expect(result.groups[0].children).toEqual([]);
    expect(result.issues).toEqual([]);
  });
});
