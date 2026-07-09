import type {
  AdminDashboard,
  AdminDashboardServer,
  AdminBackupOverview,
  AdminBackupRun,
  AdminBackupRunCreate,
  AdminBackupRunFilters,
  AdminBackupSettings,
  AdminBackupSettingsUpdate,
  AdminBackupTargetTestPayload,
  AdminBackupTargetTestResult,
  AdminDataResource,
  AdminDataResourceGroup,
  AdminDataResourceGroupUpdate,
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
  AdminSystemLog,
  AdminSystemLogQuery,
  AdminWorkspaceFilters,
  AdminWorkspaceList,
  AdminWorkspaceScene,
  AdminWorkspaceUpdate,
  Bootstrap,
  DataCatalog,
  DataSchemaSummary,
  DataResourceProfile,
  ExportLayersPayload,
  GermplasmAccessionFilters,
  GermplasmAccessionList,
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
  ResourceVisualizationSummary,
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
import type * as sdkTypes from "./generated/sdk.gen";

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

type SdkModule = typeof sdkTypes;
type SdkFunction = (...args: never[]) => Promise<HeyApiResponse>;
let sdkPromise: Promise<SdkModule> | null = null;
let sdkConfigured = false;
const sdk = new Proxy({} as SdkModule, {
  get(_target, property: keyof SdkModule) {
    return (...args: never[]) =>
      getSdk().then((module) => (module[property] as SdkFunction)(...args));
  },
});

function getSdk() {
  sdkPromise ??= Promise.all([
    import("./generated/client.gen"),
    import("./generated/sdk.gen"),
  ]).then(([clientModule, sdkModule]) => {
    if (!sdkConfigured) {
      clientModule.client.setConfig({
        baseUrl: "",
        credentials: "include",
        fetch: (request) => fetch(request),
      });
      clientModule.client.interceptors.request.use((request) => {
        if (request.method !== "GET") {
          request.headers.set("X-CSRFToken", getCookie("csrftoken") ?? "");
        }
        return request;
      });
      sdkConfigured = true;
    }
    return sdkModule;
  });
  return sdkPromise;
}

interface HeyApiResponse<T = unknown> {
  data?: T;
  error?: unknown;
  response?: Response;
}

async function unwrap<T>(request: Promise<HeyApiResponse>): Promise<T> {
  const { data, error, response } = await request;
  if (error !== undefined) {
    const status = response?.status ?? 0;
    if (status === 403 && onForbiddenHandler) {
      onForbiddenHandler();
    }
    throw new ApiError(errorMessage(error, status), status, error);
  }
  return data as T;
}

async function unwrapBlob(
  request: Promise<HeyApiResponse>,
): Promise<{ blob: Blob; filename: string }> {
  const { data, error, response } = await request;
  const status = response?.status ?? 0;
  if (error !== undefined) {
    if (status === 403 && onForbiddenHandler) {
      onForbiddenHandler();
    }
    throw new ApiError(errorMessage(error, status), status, error);
  }
  if (!(data instanceof Blob)) {
    throw new ApiError("导出响应内容为空", status, data);
  }
  return {
    blob: data,
    filename: response ? filenameFromResponse(response) : "layers-export.zip",
  };
}

function errorMessage(error: unknown, status: number) {
  if (typeof error === "string" && error) {
    return readableErrorText(error, status);
  }
  if (isRecord(error) && typeof error.detail === "string") {
    return error.detail;
  }
  return status > 0 ? `请求失败：${status}` : "网络请求失败";
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

function getCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

async function requestJson<T>(
  url: string,
  options: {
    method?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const headers = new Headers();
  const init: RequestInit = { method, credentials: "include", headers };
  if (method !== "GET") {
    headers.set("X-CSRFToken", getCookie("csrftoken") ?? "");
  }
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(options.body);
  }
  const request = new Request(url, init);
  const response = await fetch(request);
  const data = await parseResponseBody(response);
  if (!response.ok) {
    if (response.status === 403 && onForbiddenHandler) {
      onForbiddenHandler();
    }
    throw new ApiError(
      errorMessage(data, response.status),
      response.status,
      data,
    );
  }
  return data as T;
}

interface FormRequestOptions {
  onUploadProgress?: (percent: number) => void;
}

async function requestForm<T>(
  url: string,
  formData: FormData,
  options: FormRequestOptions = {},
): Promise<T> {
  if (options.onUploadProgress) {
    return requestFormWithUploadProgress<T>(url, formData, options);
  }
  const headers = new Headers();
  headers.set("X-CSRFToken", getCookie("csrftoken") ?? "");
  const response = await fetch(
    new Request(url, {
      method: "POST",
      credentials: "include",
      headers,
      body: formData,
    }),
  );
  const data = await parseResponseBody(response);
  if (!response.ok) {
    if (response.status === 403 && onForbiddenHandler) {
      onForbiddenHandler();
    }
    throw new ApiError(
      errorMessage(data, response.status),
      response.status,
      data,
    );
  }
  return data as T;
}

function requestFormWithUploadProgress<T>(
  url: string,
  formData: FormData,
  options: FormRequestOptions,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.setRequestHeader("X-CSRFToken", getCookie("csrftoken") ?? "");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) {
        return;
      }
      options.onUploadProgress?.(
        Math.min(99, Math.round((event.loaded / event.total) * 100)),
      );
    };

    xhr.onerror = () => {
      reject(new ApiError("网络请求失败", xhr.status || 0));
    };

    xhr.onload = () => {
      const data = parseXhrBody(xhr);
      if (xhr.status < 200 || xhr.status >= 300) {
        if (xhr.status === 403 && onForbiddenHandler) {
          onForbiddenHandler();
        }
        reject(new ApiError(errorMessage(data, xhr.status), xhr.status, data));
        return;
      }
      options.onUploadProgress?.(100);
      resolve(data as T);
    };

    xhr.send(formData);
  });
}

function parseXhrBody(xhr: XMLHttpRequest) {
  if (xhr.status === 204 || !xhr.responseText) {
    return undefined;
  }
  const contentType = xhr.getResponseHeader("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(xhr.responseText);
    } catch {
      return xhr.responseText;
    }
  }
  return xhr.responseText;
}

async function parseResponseBody(response: Response) {
  if (response.status === 204) {
    return undefined;
  }
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
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
  bootstrap: () => requestJson<Bootstrap>("/api/bootstrap/"),
  csrf: () => requestJson<{ detail: string }>("/api/auth/csrf/"),
  me: () => requestJson<MeResponse>("/api/auth/me/"),
  login: (username: string, password: string, remember: boolean) =>
    requestJson<{ user: User }>("/api/auth/login/", {
      method: "POST",
      body: { username, password, remember },
    }),
  guestLogin: () =>
    requestJson<{ user: User }>("/api/auth/guest-login/", { method: "POST" }),
  register: (
    username: string,
    email: string,
    password: string,
    passwordConfirm: string,
  ) =>
    requestJson<{ user: User; detail: string }>("/api/auth/register/", {
      method: "POST",
      body: { username, email, password, passwordConfirm },
    }),
  logout: () =>
    requestJson<{ detail: string }>("/api/auth/logout/", { method: "POST" }),
  adminProfile: () => unwrap<AdminProfile>(sdk.getAdminProfile()),
  updateAdminProfile: (payload: AdminProfileUpdate) =>
    unwrap<AdminProfile>(sdk.updateAdminProfile({ body: payload })),
  updateAdminProfilePermissions: (payload: AdminProfilePermissionsUpdate) =>
    unwrap<AdminProfile>(sdk.updateAdminProfilePermissions({ body: payload })),
  updateAdminProfilePassword: (payload: AdminProfilePasswordUpdate) =>
    unwrap<{ detail: string }>(
      sdk.updateAdminProfilePassword({ body: payload }),
    ),
  adminOperationLogs: (filters: AdminOperationLogQuery = {}) =>
    unwrap<PaginatedListResponse<AdminOperationLog>>(
      sdk.listAdminOperationLogs({ query: filters }),
    ),
  adminSystemLogs: (filters: AdminSystemLogQuery = {}) =>
    unwrap<AdminSystemLog>(sdk.listAdminSystemLogs({ query: filters })),
  adminDashboard: (period: "day" | "week" | "month" = "day") =>
    unwrap<AdminDashboard>(sdk.getAdminDashboard({ query: { period } })),
  adminDashboardServer: () =>
    unwrap<AdminDashboardServer>(sdk.getAdminDashboardServer()),
  adminUsers: () => unwrap<ListResponse<User>>(sdk.listUsers()),
  createAdminUser: (payload: UserCreateRequest) =>
    unwrap<UserCreateResponse>(sdk.createUser({ body: payload })),
  updateAdminUserGroups: (userId: number, payload: UserGroupUpdateRequest) =>
    unwrap<User>(sdk.updateUserGroups({ path: { userId }, body: payload })),
  updateAdminUserPermissions: (
    userId: number,
    payload: UserPermissionUpdateRequest,
  ) =>
    unwrap<User>(
      sdk.updateUserPermissions({ path: { userId }, body: payload }),
    ),
  updateAdminUser: (userId: number, payload: UserUpdateRequest) =>
    unwrap<User>(sdk.updateUserOrDelete({ path: { userId }, body: payload })),
  resetAdminUserPassword: (userId: number) =>
    unwrap<UserPasswordResetResponse>(
      sdk.resetUserPassword({ path: { userId } }),
    ),
  deleteAdminUser: (userId: number) =>
    unwrap<{ detail: string }>(
      sdk.updateUserOrDelete({
        path: { userId },
        body: { action: "delete" },
      }),
    ),
  adminGroups: () => unwrap<GroupListResponse>(sdk.listGroups()),
  createAdminGroup: (payload: GroupCreateRequest) =>
    unwrap<Group>(sdk.createGroup({ body: payload })),
  updateAdminGroup: (groupId: number, payload: GroupUpdateRequest) =>
    unwrap<Group>(
      sdk.updateOrDeleteGroup({ path: { groupId }, body: payload }),
    ),
  deleteAdminGroup: (groupId: number) =>
    unwrap<{ detail: string }>(
      sdk.updateOrDeleteGroup({
        path: { groupId },
        body: { action: "delete" },
      }),
    ),
  adminSettings: () => unwrap<AdminSettings>(sdk.getAdminSettings()),
  updateAdminSettings: (payload: AdminSettingsUpdate) =>
    unwrap<AdminSettings>(sdk.updateAdminSettings({ body: payload })),
  adminBackupOverview: () =>
    unwrap<AdminBackupOverview>(sdk.getAdminBackupOverview()),
  adminBackupSettings: () =>
    unwrap<AdminBackupSettings>(sdk.getAdminBackupSettings()),
  updateAdminBackupSettings: (payload: AdminBackupSettingsUpdate) =>
    unwrap<AdminBackupSettings>(
      sdk.updateAdminBackupSettings({ body: payload }),
    ),
  testAdminBackupTarget: (payload: AdminBackupTargetTestPayload) =>
    unwrap<AdminBackupTargetTestResult>(
      sdk.testAdminBackupTarget({ body: payload }),
    ),
  adminBackupRuns: (filters: AdminBackupRunFilters = {}) =>
    unwrap<PaginatedListResponse<AdminBackupRun>>(
      sdk.listAdminBackupRuns({ query: filters }),
    ),
  createAdminBackupRun: (payload: AdminBackupRunCreate) =>
    unwrap<AdminBackupRun>(sdk.createAdminBackupRun({ body: payload })),
  adminBackupRun: (runId: number) =>
    unwrap<AdminBackupRun>(sdk.getAdminBackupRun({ path: { runId } })),
  downloadAdminBackupRun: (runId: number) =>
    unwrapBlob(
      sdk.downloadAdminBackupRun({
        path: { runId },
        parseAs: "blob",
      }),
    ),
  dataSchemaSummary: () =>
    unwrap<DataSchemaSummary>(sdk.getDataSchemaSummary()),
  germplasmAccessions: (filters: GermplasmAccessionFilters = {}) =>
    unwrap<GermplasmAccessionList>(
      sdk.listGermplasmAccessions({ query: filters }),
    ),
  adminDataResources: (filters: AdminDataResourceFilters = {}) =>
    unwrap<AdminDataResourceList>(
      sdk.listAdminDataResources({ query: filters }),
    ),
  updateAdminDataResource: (
    resourceId: number,
    payload: AdminDataResourceUpdate,
  ) =>
    unwrap<AdminDataResource | { detail: string }>(
      sdk.updateAdminDataResource({
        path: { id: resourceId },
        body: payload,
      }),
    ),
  createAdminDataResourceGroup: (payload: AdminDataResourceGroupUpdate) =>
    unwrap<AdminDataResourceGroup>(
      sdk.createAdminDataResourceGroup({
        body: payload,
      }),
    ),
  updateAdminDataResourceGroup: (
    groupId: number,
    payload: AdminDataResourceGroupUpdate,
  ) =>
    unwrap<AdminDataResourceGroup | { detail: string }>(
      sdk.updateAdminDataResourceGroup({
        path: { groupId },
        body: payload,
      }),
    ),
  exportAdminDataResources: (filters: AdminDataResourceExportFilters) =>
    unwrapBlob(
      sdk.exportAdminDataResources({
        query: filters,
        parseAs: "blob",
      }),
    ),
  adminWorkspaces: (filters: AdminWorkspaceFilters = {}) =>
    unwrap<AdminWorkspaceList>(sdk.listAdminWorkspaces({ query: filters })),
  updateAdminWorkspace: (workspaceId: number, payload: AdminWorkspaceUpdate) =>
    unwrap<AdminWorkspaceScene | { detail: string }>(
      sdk.updateAdminWorkspace({
        path: { workspaceId },
        body: payload,
      }),
    ),
  catalogs: () => unwrap<ListResponse<DataCatalog>>(sdk.getDirectories()),
  resources: (filters: ResourceFilters = {}) =>
    unwrap<ListResponse<ResourceListItem>>(
      sdk.getResources({ query: filters }),
    ),
  scanCatalogSources: () =>
    unwrap<ListResponse<ResourceListItem> & { count: number }>(
      sdk.scanCatalogSources(),
    ),
  workspaces: (kind?: WorkspaceSceneKind) =>
    unwrap<ListResponse<WorkspaceScene>>(
      sdk.listCatalogWorkspaces({ query: kind ? { kind } : {} }),
    ),
  createWorkspace: (payload: WorkspaceSceneCreateRequest) =>
    unwrap<WorkspaceScene>(sdk.createCatalogWorkspace({ body: payload })),
  workspace: (workspaceId: number) =>
    unwrap<WorkspaceScene>(sdk.getCatalogWorkspace({ path: { workspaceId } })),
  updateWorkspace: (
    workspaceId: number,
    payload: WorkspaceSceneUpdateRequest,
  ) =>
    unwrap<WorkspaceScene | { detail: string }>(
      sdk.updateCatalogWorkspace({
        path: { workspaceId },
        body: payload,
      }),
    ),
  deleteWorkspace: (workspaceId: number) =>
    unwrap<{ detail: string }>(
      sdk.updateCatalogWorkspace({
        path: { workspaceId },
        body: { action: "delete" },
      }),
    ),
  importPreview: (file: File, sheetName?: string | null) => {
    const formData = new FormData();
    formData.append("file", file);
    if (sheetName) {
      formData.append("sheetName", sheetName);
    }
    return requestForm<ImportPreview>("/api/catalog/import/preview/", formData);
  },
  importCommit: (file: File, payload: ImportCommitPayload) =>
    unwrap<ImportCommitResult>(
      sdk.importCommit({ body: { file, payload: JSON.stringify(payload) } }),
    ),
  importValidate: (file: File, payload: ImportValidatePayload) =>
    unwrap<ImportValidateResult>(
      sdk.importValidate({ body: { file, payload: JSON.stringify(payload) } }),
    ),
  importRaster: (
    file: File,
    name: string,
    onUploadProgress?: (percent: number) => void,
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    if (name.trim()) {
      formData.append("name", name.trim());
    }
    return requestForm<RasterJob>("/api/raster/import/", formData, {
      onUploadProgress,
    });
  },
  resourceProfile: (resource: ResourceListItem) =>
    unwrap<DataResourceProfile>(
      sdk.getResourceProfile({ path: { id: resource.id } }),
    ),
  resourceVisualizationSummary: (
    resource: ResourceListItem,
    params: { topN?: number; histogramBins?: number } = {},
  ) =>
    unwrap<ResourceVisualizationSummary>(
      sdk.getResourceVisualizationSummary({
        path: { id: resource.id },
        query: params,
      }),
    ),
  queryResource: (resource: ResourceListItem, payload: ResourceQueryPayload) =>
    unwrap<ResourceQueryResult>(
      sdk.queryResource({
        path: { id: resource.id },
        body: payload,
      }),
    ),
  exportLayers: (payload: ExportLayersPayload) =>
    unwrapBlob(sdk.exportLayers({ body: payload, parseAs: "blob" })),
  exportLayersAsync: (payload: ExportLayersPayload) =>
    unwrap<RasterJob>(sdk.exportLayersAsync({ body: payload })),
  downloadExport: (jobId: string) =>
    unwrapBlob(
      sdk.downloadExport({
        path: { job_id: jobId },
        parseAs: "blob",
      }),
    ),
  layers: () => unwrap<ListResponse<MapLayerListItem>>(sdk.getLayers()),
  search: (query: string) =>
    unwrap<SearchResult>(sdk.search({ query: { q: query } })),
  renderRaster: (
    layerId: number,
    rulesMode: "default" | "custom" = "default",
    rules?: Record<string, unknown>,
  ) =>
    unwrap<RasterRenderResult>(
      sdk.renderRaster({ body: { layerId, rulesMode, rules } }),
    ),
  renderRasterAsync: (payload: {
    layerId?: number | null;
    datasetId?: number | null;
    rules?: Record<string, unknown>;
    rulesMode?: "default" | "custom";
  }) => unwrap<RasterJob>(sdk.renderRasterAsync({ body: payload })),
  rasterJob: (jobId: string) =>
    unwrap<RasterJob>(sdk.getJobStatus({ path: { job_id: jobId } })),
  classifyRasterUniqueValues: (datasetId: number, band: number) =>
    unwrap<RasterUniqueValuesResult>(
      sdk.getUniqueValues({ body: { datasetId, band } }),
    ),
  scanRasterSources: () => unwrap<RasterJob>(sdk.scanRasterSources()),
};

export { ApiError };
