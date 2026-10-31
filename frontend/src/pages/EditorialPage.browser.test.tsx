import { App as AntApp } from "antd";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentArticle } from "../api/content";
import { setLocale } from "../i18n";

const api = vi.hoisted(() => ({
  articles: vi.fn(),
  article: vi.fn(),
  saveArticle: vi.fn(),
  uploadAsset: vi.fn(),
  discardAsset: vi.fn(),
}));
vi.mock("../api/content", () => ({ contentApi: api }));
vi.mock("../contexts/AppContext", () => ({
  useAppContext: () => ({
    user: { id: 1, permissions: { canBrowseData: true } },
  }),
}));
vi.mock("../components/WorkspaceHeader", () => ({
  default: ({ activeTab }: { activeTab: string }) => (
    <div data-testid="navigation" data-active-tab={activeTab}>
      导航
    </div>
  ),
}));
import EditorialPage from "./EditorialPage";

const article: ContentArticle = {
  id: 1,
  kind: "news",
  title: "学术会议",
  summary: "报告资料",
  category: "学术会议",
  body: "原有正文",
  status: "draft",
  source: "会议海报",
  links: [],
  eventDate: "2026-09-11",
  publishedAt: "",
  coverUrl: "",
  pinned: false,
  revision: 3,
  assets: [
    {
      id: 10,
      name: "封面.png",
      url: "/test-cover.png",
      mimeType: "image/png",
      caption: "原图说明",
      pending: false,
    },
  ],
};
function show(kind: "knowledge" | "news" = "news", detail = true) {
  const base = kind === "knowledge" ? "/science-updates" : "/news";
  return render(
    <AntApp>
      <MemoryRouter initialEntries={[detail ? `${base}/1` : base]}>
        <Routes>
          <Route
            path={`${base}/:articleId?`}
            element={<EditorialPage kind={kind} />}
          />
        </Routes>
      </MemoryRouter>
    </AntApp>,
  );
}
beforeEach(async () => {
  await setLocale("zh-CN");
  vi.clearAllMocks();
  api.articles.mockResolvedValue({ items: [article], total: 1, canEdit: true });
  api.article.mockResolvedValue(article);
  api.saveArticle.mockResolvedValue({ ...article, revision: 4 });
  api.discardAsset.mockResolvedValue({ detail: "已撤销" });
});
describe("editorial content management", () => {
  it.each(["knowledge", "news"] as const)(
    "lets editors create and publish %s content from its own page",
    async (kind) => {
      const item = { ...article, kind };
      api.articles.mockResolvedValue({
        items: [item],
        total: 1,
        canEdit: true,
      });
      show(kind, false);
      const label = kind === "knowledge" ? "发布科普" : "发布团队动态";
      fireEvent.click(await screen.findByRole("button", { name: label }));
      expect(screen.getByTestId("navigation")).toHaveAttribute(
        "data-active-tab",
        kind === "knowledge" ? "knowledge" : "about",
      );
      const dialog = screen.getByRole("dialog");
      fireEvent.change(within(dialog).getByLabelText("标题"), {
        target: { value: "新发布标题" },
      });
      fireEvent.change(
        within(dialog).getByLabelText("正文（段落以空行分隔，## 表示小标题）"),
        { target: { value: "新的正文" } },
      );
      fireEvent.mouseDown(within(dialog).getByLabelText("发布状态"));
      fireEvent.click(
        await screen.findByText("已发布", {
          selector: ".ant-select-item-option-content",
        }),
      );
      fireEvent.click(within(dialog).getByRole("button", { name: /保\s*存/ }));
      await waitFor(() =>
        expect(api.saveArticle).toHaveBeenCalledWith(
          null,
          expect.objectContaining({
            kind,
            title: "新发布标题",
            body: "新的正文",
            status: "published",
          }),
        ),
      );
    },
  );

  it.each(["knowledge", "news"] as const)(
    "keeps %s readable without publishing or management controls for readers",
    async (kind) => {
      const item = { ...article, kind, status: "published" };
      api.article.mockResolvedValue(item);
      api.articles.mockResolvedValue({
        items: [item],
        total: 1,
        canEdit: false,
      });
      show(kind);
      await screen.findByText("原有正文");
      expect(
        screen.queryByRole("button", {
          name: /发布科普|发布团队动态|编辑内容/,
        }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("switch", { name: "管理内容" }),
      ).not.toBeInTheDocument();
    },
  );

  it("keeps the publishing button available in the empty state and includes drafts only when requested", async () => {
    api.articles.mockResolvedValue({ items: [], total: 0, canEdit: true });
    show("news", false);
    await screen.findByText("暂无已发布内容");
    expect(screen.getByRole("button", { name: "发布团队动态" })).toBeEnabled();
    fireEvent.click(screen.getByRole("switch", { name: "管理内容" }));
    await waitFor(() =>
      expect(api.articles).toHaveBeenLastCalledWith(
        expect.objectContaining({ kind: "news", manage: "1", offset: 0 }),
      ),
    );
    await screen.findByText("暂无内容，可新建条目");
  });

  it.each(["knowledge", "news"] as const)(
    "keeps internal source notes out of the %s reader while preserving captions and reading links",
    async (kind) => {
      const source =
        "《时空智能科普栏目.docx》第 8 篇；正文、配图与延伸阅读依照原文。";
      const figure = "图 8｜左为果树下套种，右为纯果园。保留具体图像解释。";
      const item = {
        ...article,
        kind,
        source,
        category: kind === "knowledge" ? "农业用水" : article.category,
        links: [
          { title: "继续阅读原始研究", url: "https://example.org/research" },
        ],
        assets: [{ ...article.assets[0], caption: figure }],
      };
      api.articles.mockResolvedValue({
        items: [item],
        total: 1,
        canEdit: true,
      });
      api.article.mockResolvedValue(item);
      const view = show(kind);
      await screen.findByText("原有正文");
      expect(screen.queryByText(source)).not.toBeInTheDocument();
      expect(document.querySelector(".editorial-source")).toBeNull();
      expect(screen.getByText(figure)).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /继续阅读原始研究/ }),
      ).toHaveAttribute("href", "https://example.org/research");
      fireEvent.click(screen.getByRole("button", { name: "编辑内容" }));
      expect(screen.getByLabelText("编辑备注（仅内部保存）")).toHaveValue(
        source,
      );
      expect(screen.getByLabelText("图片或附件说明: 封面.png")).toHaveValue(
        figure,
      );
      view.unmount();
    },
  );
  it("preserves unsaved text, caption and revision while uploading an attachment", async () => {
    const view = show();
    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "编辑内容" },
        { timeout: 5000 },
      ),
    );
    fireEvent.change(screen.getByLabelText("标题"), {
      target: { value: "更新的会议标题" },
    });
    fireEvent.change(screen.getByLabelText("图片或附件说明: 封面.png"), {
      target: { value: "修改的图注" },
    });
    api.uploadAsset.mockResolvedValue({
      id: 11,
      name: "资料.pdf",
      url: "/test.pdf",
      mimeType: "application/pdf",
      caption: "",
      pending: true,
    });
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: {
        files: [
          new File(["%PDF-test"], "资料.pdf", { type: "application/pdf" }),
        ],
      },
    });
    await screen.findByLabelText("图片或附件说明: 资料.pdf");
    expect(screen.getByLabelText("标题")).toHaveValue("更新的会议标题");
    expect(screen.getByLabelText("图片或附件说明: 封面.png")).toHaveValue(
      "修改的图注",
    );
    fireEvent.click(screen.getByRole("button", { name: "设为封面" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /保\s*存/,
      }),
    );
    await waitFor(() =>
      expect(api.saveArticle).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          title: "更新的会议标题",
          revision: 3,
          commitAssetIds: [11],
          coverAssetId: 10,
          assetCaptions: [
            { id: 10, caption: "修改的图注" },
            { id: 11, caption: "" },
          ],
        }),
      ),
    );
    view.unmount();
  });
  it("does not let a delayed category response overwrite the current filter", async () => {
    let resolveOld!: (result: unknown) => void;
    api.articles.mockImplementation((query) =>
      query.category === "学术交流"
        ? new Promise((resolve) => {
            resolveOld = resolve;
          })
        : Promise.resolve({
            items: [{ ...article, title: query.category || "初始条目" }],
            total: 1,
            canEdit: false,
          }),
    );
    render(
      <AntApp>
        <MemoryRouter initialEntries={["/news"]}>
          <Routes>
            <Route path="/news" element={<EditorialPage kind="news" />} />
          </Routes>
        </MemoryRouter>
      </AntApp>,
    );
    await screen.findByText("初始条目");
    fireEvent.click(
      screen.getByRole("button", { name: "学术交流", exact: true }),
    );
    await waitFor(() => expect(resolveOld).toBeDefined());
    fireEvent.click(
      screen.getByRole("button", { name: "科研进展", exact: true }),
    );
    await waitFor(() =>
      expect(document.querySelector(".editorial-card h3")?.textContent).toBe(
        "科研进展",
      ),
    );
    resolveOld({
      items: [{ ...article, title: "迟到旧条目" }],
      total: 1,
      canEdit: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(screen.queryByText("迟到旧条目")).not.toBeInTheDocument();
    expect(document.querySelector(".editorial-card h3")?.textContent).toBe(
      "科研进展",
    );
  });
  it("discards a staged upload when editing is cancelled", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "编辑内容" }));
    api.uploadAsset.mockResolvedValue({
      id: 99,
      name: "staged.pdf",
      url: "/pending",
      mimeType: "application/pdf",
      caption: "",
      pending: true,
    });
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: {
        files: [
          new File(["%PDF-test"], "staged.pdf", { type: "application/pdf" }),
        ],
      },
    });
    await screen.findByLabelText("图片或附件说明: staged.pdf");
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /取\s*消/,
      }),
    );
    await waitFor(() => expect(api.discardAsset).toHaveBeenCalledWith(99));
    expect(api.saveArticle).not.toHaveBeenCalled();
  });
  it("translates controls while retaining the original article body", async () => {
    await setLocale("en-US");
    show();
    expect(
      await screen.findByRole("button", { name: "Edit content" }),
    ).toBeEnabled();
    expect(screen.getByText("原有正文")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit content" }));
    expect(screen.getByLabelText("Title")).toHaveValue("学术会议");
    expect(
      screen.getByRole("button", { name: "Upload image or PDF" }),
    ).toBeEnabled();
  });
  it("stages attachment removal until the article is saved", async () => {
    const view = show();
    fireEvent.click(await screen.findByRole("button", { name: "编辑内容" }));
    fireEvent.click(screen.getByRole("button", { name: "移除附件" }));
    expect(api.saveArticle).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /保\s*存/,
      }),
    );
    await waitFor(() =>
      expect(api.saveArticle).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          removeAssetIds: [10],
          assetCaptions: [],
          coverAssetId: null,
        }),
      ),
    );
    view.unmount();
    show();
    expect(
      await screen.findByRole("button", { name: "编辑内容" }),
    ).toBeEnabled();
  });
});
