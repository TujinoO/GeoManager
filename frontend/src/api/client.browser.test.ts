import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportLayersPayload, ResourceListItem } from "../types";
import {
  ApiError,
  api,
  registerForbiddenHandler,
  unregisterForbiddenHandler,
} from "./client";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function setTestCookie(value: string) {
  // oxlint-disable-next-line unicorn/no-document-cookie -- tests need to seed document.cookie for CSRF coverage.
  document.cookie = value;
}

function capturedRequest(fetchMock: ReturnType<typeof vi.fn>, index = 0) {
  return fetchMock.mock.calls[index]?.[0] as Request;
}

function requestPath(request: Request) {
  const url = new URL(request.url);
  return `${url.pathname}${url.search}`;
}

describe("api client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setTestCookie("csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/");
  });

  afterEach(() => {
    unregisterForbiddenHandler();
    vi.unstubAllGlobals();
  });

  it("sends JSON POST requests with CSRF token and included credentials", async () => {
    setTestCookie("csrftoken=secure%20token");
    fetchMock.mockResolvedValue(jsonResponse({ user: { id: 1 } }));

    await api.login("tester", "pass12345", true);

    const request = capturedRequest(fetchMock);
    const headers = request.headers;
    expect(requestPath(request)).toBe("/api/auth/login/");
    expect(request.method).toBe("POST");
    expect(request.credentials).toBe("include");
    expect(headers.get("X-CSRFToken")).toBe("secure token");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(await request.clone().text())).toEqual({
      username: "tester",
      password: "pass12345",
      remember: true,
    });
  });

  it("does not force JSON content type for FormData uploads", async () => {
    setTestCookie("csrftoken=form-token");
    fetchMock.mockResolvedValue(
      jsonResponse({
        columns: [],
        rows: [],
        rowCount: 0,
        suggestedTableName: "survey",
        suggestedName: "survey",
        detected: {
          isGeographic: false,
          longitudeColumn: null,
          latitudeColumn: null,
          coordinateStats: null,
          validationIssues: [],
        },
        limitations: [],
      }),
    );

    await api.importPreview(
      new File(["name\nA\n"], "survey.csv", { type: "text/csv" }),
    );

    const request = capturedRequest(fetchMock);
    const headers = request.headers;
    const body = await request.clone().formData();
    const contentType = headers.get("Content-Type");
    expect(body.get("file")).toBeInstanceOf(File);
    expect(headers.get("X-CSRFToken")).toBe("form-token");
    expect(
      contentType === null || contentType.startsWith("multipart/form-data"),
    ).toBe(true);
  });

  it("throws ApiError with server detail for JSON errors", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: "无权访问该数据资源" }, { status: 403 }),
    );

    let capturedError: unknown;
    try {
      await api.layers();
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(ApiError);
    expect(capturedError).toMatchObject({
      status: 403,
      message: "无权访问该数据资源",
      data: { detail: "无权访问该数据资源" },
    });
  });

  it("notifies once when concurrent business requests report an expired session", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ detail: "请先登录" }, { status: 401 })),
    );
    let finishRefresh: (() => void) | undefined;
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = resolve;
        }),
    );
    registerForbiddenHandler(refresh);

    const requests = [api.layers(), api.layers()];
    await Promise.allSettled(requests);

    expect(refresh).toHaveBeenCalledTimes(1);
    finishRefresh?.();
    await Promise.resolve();
  });

  it("does not treat expected authentication 401 responses as session expiry", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ detail: "请先登录" }, { status: 401 })),
    );
    const refresh = vi.fn();
    registerForbiddenHandler(refresh);

    await expect(api.me()).rejects.toMatchObject({ status: 401 });
    await expect(api.login("missing", "wrong", false)).rejects.toMatchObject({
      status: 401,
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not surface full HTML debug pages as the error message", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        "<!DOCTYPE html><html><head><title>OperationalError at /api/admin/data/resources/</title></head><body>debug</body></html>",
        {
          status: 500,
          headers: { "Content-Type": "text/html" },
        },
      ),
    );

    await expect(api.adminDataResources()).rejects.toMatchObject({
      status: 500,
      message: "服务器内部错误：OperationalError at /api/admin/data/resources/",
    });
  });

  it("uses data-resource endpoints for registered resources", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const resource = {
      id: 7,
      name: "样地资源",
      dataType: "vector",
    } as ResourceListItem;

    await api.resourceProfile(resource);

    expect(requestPath(capturedRequest(fetchMock))).toBe(
      "/api/catalog/resources/7/profile/",
    );
  });

  it("serializes import validation payload into multipart form data", async () => {
    setTestCookie("csrftoken=validate-token");
    fetchMock.mockResolvedValue(
      jsonResponse({
        coordinateStats: {
          totalRows: 3,
          validRows: 3,
          missingRows: 0,
          errorMinMeters: 0.05,
          errorMaxMeters: 0.55,
        },
        validationIssues: [],
        duplicateTarget: null,
      }),
    );

    await api.importValidate(
      new File(["sample_id,lon,lat\nTP-1,87.600,43.800\n"], "points.csv", {
        type: "text/csv",
      }),
      {
        importMode: "geographic",
        tableName: "tarim_poplar_monitoring_2026",
        longitudeColumn: "lon",
        latitudeColumn: "lat",
      },
    );

    const request = capturedRequest(fetchMock);
    const body = await request.clone().formData();
    expect(requestPath(request)).toBe("/api/catalog/import/validate/");
    expect(request.method).toBe("POST");
    expect(request.headers.get("X-CSRFToken")).toBe("validate-token");
    expect(JSON.parse(String(body.get("payload")))).toEqual({
      importMode: "geographic",
      tableName: "tarim_poplar_monitoring_2026",
      longitudeColumn: "lon",
      latitudeColumn: "lat",
    });
  });

  it("serializes vector import payloads through generated multipart endpoints", async () => {
    setTestCookie("csrftoken=vector-token");
    fetchMock.mockResolvedValue(
      jsonResponse({
        mode: "vector",
        resourceId: 8,
        resourceName: "新疆自治区边界",
        vectorDatasetId: 3,
        layerId: 9,
        layerName: "xinjiang_boundary",
        sourceLayerName: "boundary",
        importedFeatures: 1,
        skippedFeatures: 0,
        bounds: [73.5, 34.3, 96.3, 49.1],
        geometryType: "Polygon",
        coordinateSystem: "EPSG:4326",
        sourceEncoding: "GB18030",
        validationIssues: [],
      }),
    );

    await api.commitVectorImport(
      new File(["vector"], "boundary.zip", { type: "application/zip" }),
      {
        name: "新疆自治区边界",
        domainType: "vector",
        sourceLayerName: "boundary",
        tableName: "xinjiang_boundary",
        encoding: "GB18030",
        sourceCrs: null,
        repairInvalidGeometries: false,
        skipInvalidGeometries: false,
        duplicateConfirmed: false,
        accessGroupIds: [],
        fieldMetadata: { Name: "名称" },
      },
    );

    const request = capturedRequest(fetchMock);
    const body = await request.clone().formData();
    expect(requestPath(request)).toBe("/api/catalog/vector-import/commit/");
    expect(request.headers.get("X-CSRFToken")).toBe("vector-token");
    expect(JSON.parse(String(body.get("payload")))).toMatchObject({
      domainType: "vector",
      sourceLayerName: "boundary",
      encoding: "GB18030",
    });
  });

  it("uploads raster packages with a selected primary file", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        primaryFileName: "scene.dat",
        sourceFormat: "ENVI",
        files: [],
        metadata: {
          size: [512, 512],
          driver: "ENVI",
          coordinateSystem: 32645,
          bands: [],
        },
        bounds4326: [88, 40, 88.1, 40.1],
        defaultRules: { mode: "gray", bands: [1] },
        suggestedName: "scene",
        rasterKind: "continuous",
        resampling: "bilinear",
        warnings: [],
      }),
    );

    await api.previewRasterImport(
      [new File(["data"], "scene.dat"), new File(["ENVI"], "scene.hdr")],
      "scene.dat",
    );

    const request = capturedRequest(fetchMock);
    const body = await request.clone().formData();
    expect(requestPath(request)).toBe("/api/raster/import/preview/");
    expect(body.getAll("files")).toHaveLength(2);
    expect(body.get("primaryFileName")).toBe("scene.dat");
  });

  it("serializes raster import configuration with all package files", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: "raster-import-job",
        kind: "import",
        status: "queued",
        stage: "queued",
        progressPercent: 0,
        messages: [],
        result: null,
        error: "",
        startedAt: 1,
        finishedAt: null,
      }),
    );

    await api.importRaster([new File(["tif"], "worldview.tif")], {
      primaryFileName: "worldview.tif",
      name: "WorldView 影像",
      rasterKind: "imagery",
      resampling: "bilinear",
      defaultRules: { mode: "rgb", bands: [5, 3, 2] },
      accessGroupIds: [2],
    });

    const request = capturedRequest(fetchMock);
    const body = await request.clone().formData();
    expect(requestPath(request)).toBe("/api/raster/import/");
    expect(body.getAll("files")).toHaveLength(1);
    expect(JSON.parse(String(body.get("payload")))).toMatchObject({
      primaryFileName: "worldview.tif",
      rasterKind: "imagery",
      defaultRules: { bands: [5, 3, 2] },
      accessGroupIds: [2],
    });
  });

  it("uses data-resource query endpoint for registered resources", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const resource = {
      id: 7,
      name: "样地资源",
      dataType: "vector",
    } as ResourceListItem;

    await api.queryResource(resource, {
      attributeFilters: [],
      spatialFilter: null,
      limit: 10,
    });

    expect(requestPath(capturedRequest(fetchMock))).toBe(
      "/api/catalog/resources/7/query/",
    );
  });

  it("starts custom raster rendering with explicit rules mode and dataset reference", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: "raster-render-job",
        status: "queued",
        progressPercent: 0,
        messages: [],
      }),
    );

    await api.renderRasterAsync({
      datasetId: 2,
      layerId: null,
      rulesMode: "custom",
      rules: {
        mode: "unique",
        bands: [1],
        palette: "poplar",
        uniqueValues: [
          { value: 1, color: "#2f7d62", label: "胡杨" },
          { value: 2, color: "#d8b365", label: "其他植被" },
        ],
      },
    });

    const request = capturedRequest(fetchMock);
    expect(requestPath(request)).toBe("/api/raster/render/async/");
    expect(JSON.parse(await request.clone().text())).toMatchObject({
      datasetId: 2,
      layerId: null,
      rulesMode: "custom",
      rules: {
        mode: "unique",
        bands: [1],
      },
    });
  });

  it("extracts export filenames from content-disposition headers", async () => {
    fetchMock.mockResolvedValue(
      new Response("zip-content", {
        status: 200,
        headers: {
          "Content-Disposition": 'attachment; filename="layers.zip"',
        },
      }),
    );
    const payload = {
      epsg: 4326,
      reproject: false,
      clip: false,
      clipGeometry: null,
      items: [],
    } as ExportLayersPayload;

    const result = await api.exportLayers(payload);

    expect(result.filename).toBe("layers.zip");
    expect(await result.blob.text()).toBe("zip-content");
  });

  it("decodes UTF-8 map composition filenames instead of using the zip fallback", async () => {
    fetchMock.mockResolvedValue(
      new Response("%PDF-1.4", {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition":
            "attachment; filename*=utf-8''text2%E4%B8%93%E9%A2%98%E5%9B%BE_V2.pdf",
        },
      }),
    );

    const result = await api.downloadMapCompositionVersion(2, 2);

    expect(result.filename).toBe("text2专题图_V2.pdf");
    expect(await result.blob.text()).toBe("%PDF-1.4");
  });
});
