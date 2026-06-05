import type {
  Achievement,
  Bootstrap,
  DataCatalog,
  DataResourceProfile,
  ExportLayersPayload,
  ImportCommitPayload,
  ImportCommitResult,
  ImportPreview,
  ImportValidatePayload,
  ImportValidateResult,
  MapLayerListItem,
  RasterJob,
  RasterRenderResult,
  RasterUniqueValuesResult,
  ResourceFilters,
  ResourceListItem,
  ResourceQueryPayload,
  ResourceQueryResult,
  SearchResult,
  User,
} from "../types";
import { isDataResource } from "../utils/resources";

interface ListResponse<T> {
  items: T[];
}

interface MeResponse {
  authenticated: boolean;
  user: User;
}

class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    if (!(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
  }
  if (method !== "GET") {
    headers.set("X-CSRFToken", getCookie("csrftoken") ?? "");
  }

  const response = await fetch(path, {
    ...options,
    method,
    headers,
    credentials: "include",
  });

  const contentType = response.headers.get("Content-Type") ?? "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;
  if (!response.ok) {
    throw new ApiError(
      data?.detail ?? `请求失败：${response.status}`,
      response.status,
      data,
    );
  }
  return data as T;
}

async function requestBlob(
  path: string,
  options: RequestInit = {},
): Promise<{ blob: Blob; filename: string }> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (method !== "GET") {
    headers.set("X-CSRFToken", getCookie("csrftoken") ?? "");
  }

  const response = await fetch(path, {
    ...options,
    method,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const contentType = response.headers.get("Content-Type") ?? "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : null;
    throw new ApiError(
      data?.detail ?? `请求失败：${response.status}`,
      response.status,
    );
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename =
    disposition.match(/filename="([^"]+)"/)?.[1] ?? "layers-export.zip";
  return { blob: await response.blob(), filename };
}

function getCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export const api = {
  bootstrap: () => request<Bootstrap>("/api/bootstrap/"),
  csrf: () => request<{ detail: string }>("/api/auth/csrf/"),
  me: () => request<MeResponse>("/api/auth/me/"),
  login: (username: string, password: string, remember: boolean) =>
    request<{ user: User }>("/api/auth/login/", {
      method: "POST",
      body: JSON.stringify({ username, password, remember }),
    }),
  register: (
    username: string,
    email: string,
    password: string,
    passwordConfirm: string,
  ) =>
    request<{ user: User; detail: string }>("/api/auth/register/", {
      method: "POST",
      body: JSON.stringify({ username, email, password, passwordConfirm }),
    }),
  logout: () =>
    request<{ detail: string }>("/api/auth/logout/", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  catalogs: () =>
    request<ListResponse<DataCatalog>>("/api/catalog/directories/"),
  resources: (filters: ResourceFilters = {}) =>
    request<ListResponse<ResourceListItem>>(
      `/api/catalog/resources/?${toQueryString(filters)}`,
    ),
  scanCatalogSources: () =>
    request<ListResponse<ResourceListItem> & { count: number }>(
      "/api/catalog/scan/",
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    ),
  importPreview: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<ImportPreview>("/api/catalog/import/preview/", {
      method: "POST",
      body,
    });
  },
  importCommit: (file: File, payload: ImportCommitPayload) => {
    const body = new FormData();
    body.append("file", file);
    body.append("payload", JSON.stringify(payload));
    return request<ImportCommitResult>("/api/catalog/import/commit/", {
      method: "POST",
      body,
    });
  },
  importValidate: (file: File, payload: ImportValidatePayload) => {
    const body = new FormData();
    body.append("file", file);
    body.append("payload", JSON.stringify(payload));
    return request<ImportValidateResult>("/api/catalog/import/validate/", {
      method: "POST",
      body,
    });
  },
  resourceProfile: (resource: ResourceListItem) =>
    request<DataResourceProfile>(resourceEndpoint(resource, "profile")),
  queryResource: (resource: ResourceListItem, payload: ResourceQueryPayload) =>
    request<ResourceQueryResult>(resourceEndpoint(resource, "query"), {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  exportLayers: (payload: ExportLayersPayload) =>
    requestBlob("/api/catalog/export/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  exportLayersAsync: (payload: ExportLayersPayload) =>
    request<RasterJob>("/api/catalog/export/async/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  downloadExport: (path: string) => requestBlob(path),
  layers: () => request<ListResponse<MapLayerListItem>>("/api/layers/"),
  achievements: () => request<ListResponse<Achievement>>("/api/achievements/"),
  search: (query: string) =>
    request<SearchResult>(`/api/search/?q=${encodeURIComponent(query)}`),
  renderRaster: (
    layerId: number,
    rulesMode: "default" | "custom" = "default",
    rules?: Record<string, unknown>,
  ) =>
    request<RasterRenderResult>("/api/raster/render/", {
      method: "POST",
      body: JSON.stringify({ layerId, rulesMode, rules }),
    }),
  renderRasterAsync: (payload: {
    layerId?: number | null;
    datasetId?: number | null;
    rules?: Record<string, unknown>;
    rulesMode?: "default" | "custom";
  }) =>
    request<RasterJob>("/api/raster/render/async/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  rasterJob: (jobId: string) =>
    request<RasterJob>(`/api/raster/jobs/${jobId}/`),
  classifyRasterUniqueValues: (datasetId: number, band: number) =>
    request<RasterUniqueValuesResult>("/api/raster/unique-values/", {
      method: "POST",
      body: JSON.stringify({ datasetId, band }),
    }),
  scanRasterSources: () =>
    request<RasterJob>("/api/raster/scan/", {
      method: "POST",
      body: JSON.stringify({}),
    }),
};

function toQueryString(filters: ResourceFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  return params.toString();
}

function resourceEndpoint(
  resource: ResourceListItem,
  action: "profile" | "query",
) {
  if (isDataResource(resource)) {
    return `/api/catalog/resources/${resource.id}/${action}/`;
  }
  return `/api/layers/${encodeURIComponent(resource.name)}/${action}/`;
}

export { ApiError };
