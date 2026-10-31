import { requestJson, requestForm } from "./client";
import type {
  ContentArticle,
  ContentArticleInput,
  ContentArticleList,
  ContentAsset,
} from "./generated/types.gen";
export type { ContentArticle, ContentArticleInput };
export const contentApi = {
  articles: (options: Record<string, string | number> = {}) =>
    requestJson<ContentArticleList>(
      `/api/content/articles/?${new URLSearchParams(Object.entries(options).map(([k, v]) => [k, String(v)]))}`,
    ),
  article: (id: number) =>
    requestJson<ContentArticle>(`/api/content/articles/${id}/`),
  saveArticle: (id: number | null, body: ContentArticleInput) =>
    requestJson<ContentArticle>(
      id ? `/api/content/articles/${id}/` : "/api/content/articles/",
      { method: "POST", body },
    ),
  discardAsset: (id: number) =>
    requestJson<{ detail: string }>(`/api/content/assets/${id}/`, {
      method: "DELETE",
    }),
  uploadAsset: (id: number, file: File) => {
    const body = new FormData();
    body.set("file", file);
    return requestForm<ContentAsset>(
      `/api/content/articles/${id}/assets/`,
      body,
    );
  },
};
