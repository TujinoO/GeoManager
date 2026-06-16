import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportLayersPayload, ResourceListItem } from "../types";
import { ApiError, api } from "./client";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function setTestCookie(value: string) {
  // biome-ignore lint/suspicious/noDocumentCookie: tests need to seed document.cookie for CSRF coverage.
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

  it("encodes vector layer names for temporary GeoPackage resources", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const resource = {
      id: "vector_temp",
      name: "sample layer/一",
      dataType: "vector",
    } as ResourceListItem;

    await api.queryResource(resource, {
      attributeFilters: [],
      spatialFilter: null,
      limit: 10,
    });

    expect(requestPath(capturedRequest(fetchMock))).toBe(
      "/api/layers/sample%20layer%2F%E4%B8%80/query/",
    );
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
});
