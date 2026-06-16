import createClient, { type Middleware } from "openapi-fetch";
import type {
  Achievement,
  AdminDashboard,
  AdminDashboardServer,
  AdminDataResource,
  AdminDataResourceExportFilters,
  AdminDataResourceFilters,
  AdminDataResourceList,
  AdminDataResourceUpdate,
  AdminOperationLog,
  AdminOperationLogQuery,
  AdminProfile,
  AdminProfilePasswordUpdate,
  AdminProfilePermissionsUpdate,
  AdminProfileUpdate,
  AdminSettings,
  AdminSettingsUpdate,
  Bootstrap,
  DataCatalog,
  DataResourceProfile,
  ExportLayersPayload,
  Group,
  GroupCreateRequest,
  GroupListResponse,
  GroupUpdateRequest,
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
  UserCreateRequest,
  UserCreateResponse,
  UserGroupUpdateRequest,
  UserPasswordResetResponse,
  UserPermissionUpdateRequest,
  UserUpdateRequest,
  WorkspaceScene,
  WorkspaceSceneCreateRequest,
  WorkspaceSceneKind,
  WorkspaceSceneUpdateRequest,
} from "../types";
import { isDataResource } from "../utils/resources";
import type { paths } from "./schema";

interface ListResponse<T> {
  items: T[];
}

interface PaginatedListResponse<T> extends ListResponse<T> {
  total: number;
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

const client = createClient<paths>({
  credentials: "include",
  fetch: (request) => fetch(request),
});

const csrfMiddleware: Middleware = {
  onRequest({ request }) {
    if (request.method !== "GET") {
      request.headers.set("X-CSRFToken", getCookie("csrftoken") ?? "");
    }
    return request;
  },
};

client.use(csrfMiddleware);

interface OpenApiResponse<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

async function unwrap<T>(
  request: Promise<OpenApiResponse<unknown>>,
): Promise<T> {
  const { data, error, response } = await request;
  if (error !== undefined) {
    if (response.status === 403 && onForbiddenHandler) {
      onForbiddenHandler();
    }
    throw new ApiError(
      errorMessage(error, response.status),
      response.status,
      error,
    );
  }
  return data as T;
}

async function unwrapBlob(
  request: Promise<OpenApiResponse<unknown>>,
): Promise<{ blob: Blob; filename: string }> {
  const { data, error, response } = await request;
  if (error !== undefined) {
    if (response.status === 403 && onForbiddenHandler) {
      onForbiddenHandler();
    }
    throw new ApiError(
      errorMessage(error, response.status),
      response.status,
      error,
    );
  }
  if (!(data instanceof Blob)) {
    throw new ApiError("导出响应内容为空", response.status, data);
  }
  return {
    blob: data,
    filename: filenameFromResponse(response),
  };
}

function errorMessage(error: unknown, status: number) {
  if (typeof error === "string" && error) {
    return readableErrorText(error, status);
  }
  if (isRecord(error) && typeof error.detail === "string") {
    return error.detail;
  }
  return `请求失败：${status}`;
}

function readableErrorText(text: string, status: number) {
  const trimmed = text.trim();
  if (/^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    const title = trimmed.match(/<title>(.*?)<\/title>/is)?.[1];
    const cleanedTitle = title ? stripHtml(title).trim() : "";
    return cleanedTitle
      ? `服务器内部错误：${cleanedTitle}`
      : `服务器内部错误：${status}`;
  }
  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed;
}

function stripHtml(text: string) {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function filenameFromResponse(response: Response) {
  const disposition = response.headers.get("Content-Disposition") ?? "";
  return disposition.match(/filename="([^"]+)"/)?.[1] ?? "layers-export.zip";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function importFileBody(file: File) {
  return {
    body: { file: file.name },
    bodySerializer: () => {
      const body = new FormData();
      body.append("file", file);
      return body;
    },
  };
}

function importFilePayloadBody(
  file: File,
  payload: ImportCommitPayload | ImportValidatePayload,
) {
  const serializedPayload = JSON.stringify(payload);
  return {
    body: { file: file.name, payload: serializedPayload },
    bodySerializer: () => {
      const body = new FormData();
      body.append("file", file);
      body.append("payload", serializedPayload);
      return body;
    },
  };
}

function getCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

type ForbiddenHandler = () => void;
let onForbiddenHandler: ForbiddenHandler | null = null;

export function registerForbiddenHandler(handler: ForbiddenHandler) {
  onForbiddenHandler = handler;
}

export function unregisterForbiddenHandler() {
  onForbiddenHandler = null;
}

export const api = {
  bootstrap: () => unwrap<Bootstrap>(client.GET("/api/bootstrap/")),
  csrf: () => unwrap<{ detail: string }>(client.GET("/api/auth/csrf/")),
  me: () => unwrap<MeResponse>(client.GET("/api/auth/me/")),
  login: (username: string, password: string, remember: boolean) =>
    unwrap<{ user: User }>(
      client.POST("/api/auth/login/", {
        body: { username, password, remember },
      }),
    ),
  register: (
    username: string,
    email: string,
    password: string,
    passwordConfirm: string,
  ) =>
    unwrap<{ user: User; detail: string }>(
      client.POST("/api/auth/register/", {
        body: { username, email, password, passwordConfirm },
      }),
    ),
  logout: () => unwrap<{ detail: string }>(client.POST("/api/auth/logout/")),
  adminProfile: () => unwrap<AdminProfile>(client.GET("/api/admin/profile/")),
  updateAdminProfile: (payload: AdminProfileUpdate) =>
    unwrap<AdminProfile>(
      client.POST("/api/admin/profile/update/", {
        body: payload,
      }),
    ),
  updateAdminProfilePermissions: (payload: AdminProfilePermissionsUpdate) =>
    unwrap<AdminProfile>(
      client.POST("/api/admin/profile/permissions/", {
        body: payload,
      }),
    ),
  updateAdminProfilePassword: (payload: AdminProfilePasswordUpdate) =>
    unwrap<{ detail: string }>(
      client.POST("/api/admin/profile/password/", {
        body: payload,
      }),
    ),
  adminOperationLogs: (filters: AdminOperationLogQuery = {}) =>
    unwrap<PaginatedListResponse<AdminOperationLog>>(
      client.GET("/api/admin/operation-logs/", {
        params: { query: filters },
      }),
    ),
  adminDashboard: (period: "day" | "week" | "month" = "day") =>
    unwrap<AdminDashboard>(
      client.GET("/api/admin/dashboard/", {
        params: { query: { period } },
      }),
    ),
  adminDashboardServer: () =>
    unwrap<AdminDashboardServer>(client.GET("/api/admin/dashboard/server/")),
  adminUsers: () => unwrap<ListResponse<User>>(client.GET("/api/users/")),
  createAdminUser: (payload: UserCreateRequest) =>
    unwrap<UserCreateResponse>(
      client.POST("/api/users/", {
        body: payload,
      }),
    ),
  updateAdminUserGroups: (userId: number, payload: UserGroupUpdateRequest) =>
    unwrap<User>(
      client.POST("/api/users/{userId}/groups/", {
        params: { path: { userId } },
        body: payload,
      }),
    ),
  updateAdminUserPermissions: (
    userId: number,
    payload: UserPermissionUpdateRequest,
  ) =>
    unwrap<User>(
      client.POST("/api/users/{userId}/permissions/", {
        params: { path: { userId } },
        body: payload,
      }),
    ),
  updateAdminUser: (userId: number, payload: UserUpdateRequest) =>
    unwrap<User>(
      client.POST("/api/users/{userId}/", {
        params: { path: { userId } },
        body: payload,
      }),
    ),
  resetAdminUserPassword: (userId: number) =>
    unwrap<UserPasswordResetResponse>(
      client.POST("/api/users/{userId}/password/reset/", {
        params: { path: { userId } },
      }),
    ),
  deleteAdminUser: (userId: number) =>
    unwrap<{ detail: string }>(
      client.POST("/api/users/{userId}/", {
        params: { path: { userId } },
        body: { action: "delete" },
      }),
    ),
  adminGroups: () => unwrap<GroupListResponse>(client.GET("/api/groups/")),
  createAdminGroup: (payload: GroupCreateRequest) =>
    unwrap<Group>(
      client.POST("/api/groups/", {
        body: payload,
      }),
    ),
  updateAdminGroup: (groupId: number, payload: GroupUpdateRequest) =>
    unwrap<Group>(
      client.POST("/api/groups/{groupId}/", {
        params: { path: { groupId } },
        body: payload,
      }),
    ),
  deleteAdminGroup: (groupId: number) =>
    unwrap<{ detail: string }>(
      client.POST("/api/groups/{groupId}/", {
        params: { path: { groupId } },
        body: { action: "delete" },
      }),
    ),
  adminSettings: () =>
    unwrap<AdminSettings>(client.GET("/api/admin/settings/")),
  updateAdminSettings: (payload: AdminSettingsUpdate) =>
    unwrap<AdminSettings>(
      client.POST("/api/admin/settings/", {
        body: payload,
      }),
    ),
  adminDataResources: (filters: AdminDataResourceFilters = {}) =>
    unwrap<AdminDataResourceList>(
      client.GET("/api/admin/data/resources/", {
        params: { query: filters },
      }),
    ),
  updateAdminDataResource: (
    resourceId: number,
    payload: AdminDataResourceUpdate,
  ) =>
    unwrap<AdminDataResource | { detail: string }>(
      client.POST("/api/admin/data/resources/{id}/", {
        params: { path: { id: resourceId } },
        body: payload,
      }),
    ),
  exportAdminDataResources: (filters: AdminDataResourceExportFilters) =>
    unwrapBlob(
      client.GET("/api/admin/data/resources/export/", {
        params: { query: filters },
        parseAs: "blob",
      }),
    ),
  catalogs: () =>
    unwrap<ListResponse<DataCatalog>>(client.GET("/api/catalog/directories/")),
  resources: (filters: ResourceFilters = {}) =>
    unwrap<ListResponse<ResourceListItem>>(
      client.GET("/api/catalog/resources/", {
        params: { query: filters },
      }),
    ),
  scanCatalogSources: () =>
    unwrap<ListResponse<ResourceListItem> & { count: number }>(
      client.POST("/api/catalog/scan/"),
    ),
  workspaces: (kind?: WorkspaceSceneKind) =>
    unwrap<ListResponse<WorkspaceScene>>(
      client.GET("/api/catalog/workspaces/", {
        params: { query: kind ? { kind } : {} },
      }),
    ),
  createWorkspace: (payload: WorkspaceSceneCreateRequest) =>
    unwrap<WorkspaceScene>(
      client.POST("/api/catalog/workspaces/", {
        body: payload,
      }),
    ),
  workspace: (workspaceId: number) =>
    unwrap<WorkspaceScene>(
      client.GET("/api/catalog/workspaces/{workspaceId}/", {
        params: { path: { workspaceId } },
      }),
    ),
  updateWorkspace: (
    workspaceId: number,
    payload: WorkspaceSceneUpdateRequest,
  ) =>
    unwrap<WorkspaceScene | { detail: string }>(
      client.POST("/api/catalog/workspaces/{workspaceId}/", {
        params: { path: { workspaceId } },
        body: payload,
      }),
    ),
  deleteWorkspace: (workspaceId: number) =>
    unwrap<{ detail: string }>(
      client.POST("/api/catalog/workspaces/{workspaceId}/", {
        params: { path: { workspaceId } },
        body: { action: "delete" },
      }),
    ),
  importPreview: (file: File) =>
    unwrap<ImportPreview>(
      client.POST("/api/catalog/import/preview/", importFileBody(file)),
    ),
  importCommit: (file: File, payload: ImportCommitPayload) =>
    unwrap<ImportCommitResult>(
      client.POST(
        "/api/catalog/import/commit/",
        importFilePayloadBody(file, payload),
      ),
    ),
  importValidate: (file: File, payload: ImportValidatePayload) =>
    unwrap<ImportValidateResult>(
      client.POST(
        "/api/catalog/import/validate/",
        importFilePayloadBody(file, payload),
      ),
    ),
  resourceProfile: (resource: ResourceListItem) => {
    if (isDataResource(resource)) {
      return unwrap<DataResourceProfile>(
        client.GET("/api/catalog/resources/{id}/profile/", {
          params: { path: { id: resource.id } },
        }),
      );
    }
    return unwrap<DataResourceProfile>(
      client.GET("/api/layers/{layer_name}/profile/", {
        params: { path: { layer_name: resource.name } },
      }),
    );
  },
  queryResource: (
    resource: ResourceListItem,
    payload: ResourceQueryPayload,
  ) => {
    if (isDataResource(resource)) {
      return unwrap<ResourceQueryResult>(
        client.POST("/api/catalog/resources/{id}/query/", {
          params: { path: { id: resource.id } },
          body: payload,
        }),
      );
    }
    return unwrap<ResourceQueryResult>(
      client.POST("/api/layers/{layer_name}/query/", {
        params: { path: { layer_name: resource.name } },
        body: payload,
      }),
    );
  },
  exportLayers: (payload: ExportLayersPayload) =>
    unwrapBlob(
      client.POST("/api/catalog/export/", {
        body: payload,
        parseAs: "blob",
      }),
    ),
  exportLayersAsync: (payload: ExportLayersPayload) =>
    unwrap<RasterJob>(
      client.POST("/api/catalog/export/async/", {
        body: payload,
      }),
    ),
  downloadExport: (jobId: string) =>
    unwrapBlob(
      client.GET("/api/catalog/export/jobs/{job_id}/download/", {
        params: { path: { job_id: jobId } },
        parseAs: "blob",
      }),
    ),
  layers: () =>
    unwrap<ListResponse<MapLayerListItem>>(client.GET("/api/layers/")),
  achievements: () =>
    unwrap<ListResponse<Achievement>>(client.GET("/api/achievements/")),
  search: (query: string) =>
    unwrap<SearchResult>(
      client.GET("/api/search/", {
        params: { query: { q: query } },
      }),
    ),
  renderRaster: (
    layerId: number,
    rulesMode: "default" | "custom" = "default",
    rules?: Record<string, unknown>,
  ) =>
    unwrap<RasterRenderResult>(
      client.POST("/api/raster/render/", {
        body: { layerId, rulesMode, rules },
      }),
    ),
  renderRasterAsync: (payload: {
    layerId?: number | null;
    datasetId?: number | null;
    rules?: Record<string, unknown>;
    rulesMode?: "default" | "custom";
  }) =>
    unwrap<RasterJob>(
      client.POST("/api/raster/render/async/", {
        body: payload,
      }),
    ),
  rasterJob: (jobId: string) =>
    unwrap<RasterJob>(
      client.GET("/api/raster/jobs/{job_id}/", {
        params: { path: { job_id: jobId } },
      }),
    ),
  classifyRasterUniqueValues: (datasetId: number, band: number) =>
    unwrap<RasterUniqueValuesResult>(
      client.POST("/api/raster/unique-values/", {
        body: { datasetId, band },
      }),
    ),
  scanRasterSources: () => unwrap<RasterJob>(client.POST("/api/raster/scan/")),
};

export { ApiError };
