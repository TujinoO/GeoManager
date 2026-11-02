import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { App as AntApp } from "antd";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import type { ContentArticle } from "../api/content";
import { aboutAssets } from "../about/aboutSections";
import { setLocale } from "../i18n";
import AboutV2Page from "./AboutV2Page";
import EditorialPage from "./EditorialPage";
import "antd/dist/reset.css";
import "../styles.css";
import "../styles/about-v2.css";

const api = vi.hoisted(() => ({ articles: vi.fn(), article: vi.fn() }));
vi.mock("../api/content", () => ({ contentApi: api }));
vi.mock("../contexts/AppContext", () => ({
  useAppContext: () => ({ user: { permissions: { canBrowseData: true } } }),
}));
vi.mock("../components/WorkspaceHeader", () => ({
  default: () => <header className="workspace-header">GPEDSP</header>,
}));

const article: ContentArticle = {
  id: 1,
  kind: "news",
  title: "胡杨保护研究与团队交流",
  summary: "分享科研进展与团队活动。",
  category: "科研进展",
  body: "团队开展胡杨保护研究。",
  status: "published",
  source: "团队动态",
  links: [],
  eventDate: "2026-11-02",
  publishedAt: "2026-11-02",
  coverUrl: aboutAssets.teamGreenhouseImage,
  pinned: false,
  revision: 1,
  assets: [],
};
function show(path: string) {
  return render(
    <AntApp>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/about/:section/:institutionId?"
            element={<AboutV2Page />}
          />
          <Route
            path="/news/:articleId?"
            element={<EditorialPage kind="news" />}
          />
        </Routes>
      </MemoryRouter>
    </AntApp>,
  );
}
function sidebar(english = false) {
  return within(
    screen.getByRole("navigation", { name: english ? "About Us" : "关于我们" }),
  );
}
beforeEach(async () => {
  await setLocale("zh-CN");
  api.articles.mockResolvedValue({
    items: [article],
    total: 1,
    canEdit: false,
  });
  api.article.mockResolvedValue(article);
});
afterEach(async () => {
  await page.viewport(1600, 900);
});

it("keeps one About sidebar and its selected item through news list, detail and return navigation", async () => {
  show("/about/members/tarim-university");
  expect(sidebar().getAllByRole("button")).toHaveLength(6);
  fireEvent.click(sidebar().getByRole("button", { name: /团队动态/ }));
  fireEvent.click(await screen.findByRole("button", { name: article.title }));
  await screen.findByText(article.body);
  expect(sidebar().getByRole("button", { name: /团队动态/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  fireEvent.click(screen.getByRole("button", { name: "返回列表" }));
  await screen.findByRole("button", { name: article.title });
  for (const [label, title] of [
    ["系统简介", "系统简介"],
    ["团队介绍", "团队介绍"],
    ["团队成员", "团队成员"],
    ["联系我们", "联系我们"],
    ["帮助文档", "帮助文档"],
  ]) {
    fireEvent.click(sidebar().getByRole("button", { name: new RegExp(label) }));
    expect(
      sidebar().getByRole("button", { name: new RegExp(title) }),
    ).toHaveAttribute("aria-current", "page");
    expect(sidebar().getByRole("button", { name: /团队动态/ })).toBeVisible();
  }
});

it("shares English About navigation with directly opened news details", async () => {
  await setLocale("en-US");
  show("/news/1");
  await screen.findByText(article.body);
  expect(
    sidebar(true).getByRole("button", { name: /Team News/ }),
  ).toHaveAttribute("aria-current", "page");
  fireEvent.click(
    sidebar(true).getByRole("button", { name: /Research Network/ }),
  );
  expect(
    sidebar(true).getByRole("button", { name: /Research Network/ }),
  ).toHaveAttribute("aria-current", "page");
  fireEvent.click(sidebar(true).getByRole("button", { name: /Team News/ }));
  await screen.findByRole("button", { name: article.title });
});

it("places the shared navigation beside desktop news and above mobile news without horizontal overflow", async () => {
  show("/news");
  await screen.findByRole("button", { name: article.title });
  const nav = screen.getByRole("complementary", { name: "关于我们" });
  const main = screen.getByRole("main");
  expect(nav.getBoundingClientRect().right).toBeLessThanOrEqual(
    main.getBoundingClientRect().left + 1,
  );
  await page.screenshot({
    path: "../../output/content-refinement-20261102/news-sidebar-desktop.png",
  });
  await page.viewport(390, 844);
  await waitFor(() =>
    expect(nav.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      main.getBoundingClientRect().top,
    ),
  );
  expect(main.scrollWidth).toBeLessThanOrEqual(main.clientWidth + 1);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
    window.innerWidth + 1,
  );
  await page.screenshot({
    path: "../../output/content-refinement-20261102/news-sidebar-mobile.png",
  });
});
