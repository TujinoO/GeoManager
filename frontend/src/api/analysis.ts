import type {
  AnalysisQuery,
  AnalysisResult,
  AnalysisTemplateCatalog,
  AnalysisImportResult,
  AnalysisSavedView,
  AnalysisViewList,
  GenomeAssemblyList,
  GenomeSummary,
  GenomeGeneList,
  GenomeGeneDetail,
  GenomeSequenceResult,
  ResultArtifact,
} from "./generated/types.gen";

export class AnalysisApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: unknown,
  ) {
    super(message);
  }
}

async function request<T>(
  url: string,
  body?: object | FormData,
  signal?: AbortSignal,
): Promise<T> {
  const csrf =
    document.cookie
      .split("; ")
      .find((s) => s.startsWith("csrftoken="))
      ?.slice(10) ?? "";
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    credentials: "include",
    signal,
    headers:
      body instanceof FormData
        ? { "X-CSRFToken": csrf }
        : { "Content-Type": "application/json", "X-CSRFToken": csrf },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const content = response.headers.get("content-type") ?? "";
  const data: unknown = content.includes("json")
    ? await response.json()
    : await response.blob();
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "detail" in data
        ? String(data.detail)
        : `请求失败（${response.status}）`;
    throw new AnalysisApiError(message, response.status, data);
  }
  return data as T;
}

const params = (values: Record<string, string | number | undefined>) =>
  new URLSearchParams(
    Object.entries(values)
      .filter((entry) => entry[1] !== undefined && entry[1] !== "")
      .map(([key, value]) => [key, String(value)]),
  ).toString();

export const analysisApi = {
  report: (id: number) =>
    request<ResultArtifact>(`/api/analysis/reports/${id}/`),
  saveReport: (body: FormData, id?: number) =>
    request<ResultArtifact>(
      id ? `/api/analysis/reports/${id}/` : "/api/analysis/reports/",
      body,
    ),
  templates: () => request<AnalysisTemplateCatalog>("/api/analysis/templates/"),
  importTable: (body: FormData) =>
    request<AnalysisImportResult>("/api/analysis/import/", body),
  query: (id: number, body: AnalysisQuery, signal?: AbortSignal) =>
    request<AnalysisResult>(
      `/api/analysis/resources/${id}/query/`,
      body,
      signal,
    ),
  export: (id: number, body: AnalysisQuery) =>
    request<Blob>(`/api/analysis/resources/${id}/export/`, body),
  views: () => request<AnalysisViewList>("/api/analysis/views/"),
  save: (resourceId: number, name: string, query: AnalysisQuery) =>
    request<AnalysisSavedView>("/api/analysis/views/", {
      resourceId,
      name,
      query,
    }),
  assemblies: () => request<GenomeAssemblyList>("/api/omics/assemblies/"),
  summary: (id: number, signal?: AbortSignal) =>
    request<GenomeSummary>(
      `/api/omics/assemblies/${id}/summary/`,
      undefined,
      signal,
    ),
  genes: (
    id: number,
    values: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ) =>
    request<GenomeGeneList>(
      `/api/omics/assemblies/${id}/genes/?${params(values)}`,
      undefined,
      signal,
    ),
  gene: (id: number, geneId: string, signal?: AbortSignal) =>
    request<GenomeGeneDetail>(
      `/api/omics/assemblies/${id}/genes/${encodeURIComponent(geneId)}/`,
      undefined,
      signal,
    ),
  sequence: (
    id: number,
    values: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ) =>
    request<GenomeSequenceResult>(
      `/api/omics/assemblies/${id}/sequence/?${params(values)}`,
      undefined,
      signal,
    ),
  importGenome: (body: FormData) =>
    request<GenomeSummary>("/api/omics/import/", body),
  validateGenome: (body: FormData) =>
    request<AnalysisImportResult>("/api/omics/import/", body),
};

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
