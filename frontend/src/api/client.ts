import type {
  Achievement,
  Bootstrap,
  DataCatalog,
  DataResource,
  DataResourceProfile,
  ExportLayersPayload,
  MapLayer,
  RasterJob,
  RasterRenderResult,
  ResourceFilters,
  ResourceQueryPayload,
  ResourceQueryResult,
  SearchResult,
  User,
} from '../types';

interface ListResponse<T> {
  items: T[];
}

interface MeResponse {
  authenticated: boolean;
  user: User;
}

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (method !== 'GET') {
    headers.set('X-CSRFToken', getCookie('csrftoken') ?? '');
  }

  const response = await fetch(path, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('Content-Type') ?? '';
  const data = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    throw new ApiError(data?.detail ?? `请求失败：${response.status}`, response.status);
  }
  return data as T;
}

async function requestBlob(path: string, options: RequestInit = {}): Promise<{ blob: Blob; filename: string }> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (method !== 'GET') {
    headers.set('X-CSRFToken', getCookie('csrftoken') ?? '');
  }

  const response = await fetch(path, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const contentType = response.headers.get('Content-Type') ?? '';
    const data = contentType.includes('application/json') ? await response.json() : null;
    throw new ApiError(data?.detail ?? `请求失败：${response.status}`, response.status);
  }
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'layers-export.zip';
  return { blob: await response.blob(), filename };
}

function getCookie(name: string): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

export const api = {
  bootstrap: () => request<Bootstrap>('/api/bootstrap/'),
  csrf: () => request<{ detail: string }>('/api/auth/csrf/'),
  me: () => request<MeResponse>('/api/auth/me/'),
  login: (username: string, password: string, remember: boolean) =>
    request<{ user: User }>('/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password, remember }),
    }),
  logout: () =>
    request<{ detail: string }>('/api/auth/logout/', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  catalogs: () => request<ListResponse<DataCatalog>>('/api/catalog/directories/'),
  resources: (filters: ResourceFilters = {}) =>
    request<ListResponse<DataResource>>(`/api/catalog/resources/?${toQueryString(filters)}`),
  resourceProfile: (resourceId: number) =>
    request<DataResourceProfile>(`/api/catalog/resources/${resourceId}/profile/`),
  queryResource: (resourceId: number, payload: ResourceQueryPayload) =>
    request<ResourceQueryResult>(`/api/catalog/resources/${resourceId}/query/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  exportLayers: (payload: ExportLayersPayload) =>
    requestBlob('/api/catalog/export/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  layers: () => request<ListResponse<MapLayer>>('/api/layers/'),
  achievements: () => request<ListResponse<Achievement>>('/api/achievements/'),
  search: (query: string) => request<SearchResult>(`/api/search/?q=${encodeURIComponent(query)}`),
  renderRaster: (
    layerId: number,
    width: number,
    height: number,
    rulesMode: 'default' | 'custom' = 'default',
    rules?: Record<string, unknown>,
  ) =>
    request<RasterRenderResult>(
      '/api/raster/render/',
      {
        method: 'POST',
        body: JSON.stringify({ layerId, width, height, rulesMode, rules }),
      },
    ),
  renderRasterAsync: (payload: {
    layerId?: number | null;
    datasetId?: number | null;
    width: number;
    height: number;
    rules?: Record<string, unknown>;
    rulesMode?: 'default' | 'custom';
    delivery: 'image' | 'xyz';
  }) =>
    request<RasterJob>('/api/raster/render/async/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  rasterJob: (jobId: string) => request<RasterJob>(`/api/raster/jobs/${jobId}/`),
  scanRasterSources: () =>
    request<RasterJob>('/api/raster/scan/', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  rasterCacheStatus: () =>
    request<{ count: number; readyCount: number; failedCount: number; totalBytes: number }>('/api/raster/cache/status/'),
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

export { ApiError };
