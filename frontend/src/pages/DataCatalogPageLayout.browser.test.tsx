import { render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { setLocale } from "../i18n";
import DataCatalogPage from "./DataCatalogPage";
import "antd/dist/reset.css";
import "../styles.css";

vi.mock("../contexts/AppContext", () => ({
  useAppContext: () => ({
    user: {
      username: "layout-test",
      displayName: "布局测试管理员",
      roles: ["超级管理员"],
      permissions: { canBrowseData: true, canAccessAdmin: true },
    },
    setUser: vi.fn(),
  }),
}));
vi.mock("../api/client", () => ({
  api: {
    resources: vi.fn().mockResolvedValue({ items: [] }),
    dataSchemaSummary: vi.fn().mockResolvedValue({ catalogTree: [] }),
  },
}));

afterEach(async () => {
  window.scrollTo(0, 0);
  await page.viewport(1600, 900);
});

describe("homepage floating navigation", () => {
  it.each([
    { locale: "zh-CN" as const, width: 1920 },
    { locale: "zh-CN" as const, width: 390 },
    { locale: "en-US" as const, width: 1920 },
    { locale: "en-US" as const, width: 390 },
  ])(
    "shows the global conservation theme at $width px in $locale",
    async ({ locale, width }) => {
      await page.viewport(width, 900);
      await setLocale(locale);
      const { container } = render(
        <App>
          <MemoryRouter initialEntries={["/data"]}>
            <DataCatalogPage />
          </MemoryRouter>
        </App>,
      );
      await waitFor(() =>
        expect(container.querySelector(".ant-spin-spinning")).toBeNull(),
      );
      const title = screen.getByRole("heading", {
        name:
          locale === "zh-CN"
            ? "全球胡杨林保护数据资源目录"
            : "Global Populus euphratica Conservation Data Catalog",
      });
      expect(container.textContent).not.toMatch(
        /智慧监测|干旱区|Arid-region|APF-EIMP/,
      );
      const hero = container.querySelector(".data-catalog-hero")!;
      for (const element of [
        title,
        hero,
        container.querySelector(".data-catalog-hero-context")!,
      ]) {
        const rect = element.getBoundingClientRect();
        expect(rect.left).toBeGreaterThanOrEqual(0);
        expect(rect.right).toBeLessThanOrEqual(
          document.documentElement.clientWidth,
        );
        expect(element.scrollWidth).toBeLessThanOrEqual(
          element.clientWidth + 1,
        );
      }
      await page.screenshot({
        path: `../../output/playwright/homepage-global-theme-${locale}-${width}.png`,
      });
    },
  );

  it.each([1920, 1024, 390])(
    "keeps the menu visible and usable while scrolling at %ipx",
    async (width) => {
      await page.viewport(width, 720);
      const { container } = render(
        <App>
          <MemoryRouter initialEntries={["/data"]}>
            <div className="route-enter">
              <DataCatalogPage />
            </div>
          </MemoryRouter>
        </App>,
      );
      await waitFor(() =>
        expect(container.querySelector(".ant-spin-spinning")).toBeNull(),
      );
      const header = screen.getByRole("banner");
      const initial = header.getBoundingClientRect();
      const hero = container.querySelector(".data-catalog-hero")!;
      expect(hero.getBoundingClientRect().top).toBeGreaterThan(initial.bottom);
      window.scrollTo(0, document.documentElement.scrollHeight);
      await waitFor(() => expect(window.scrollY).toBeGreaterThan(200));
      await waitFor(() =>
        expect(header.getBoundingClientRect().top).toBeCloseTo(initial.top, 0),
      );
      const rect = header.getBoundingClientRect();
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(
        document.documentElement.clientWidth,
      );
      const account = screen.getByRole("button", { name: /用户信息/ });
      const accountRect = account.getBoundingClientRect();
      expect(
        account.contains(
          document.elementFromPoint(
            accountRect.left + accountRect.width / 2,
            accountRect.top + accountRect.height / 2,
          ),
        ),
      ).toBe(true);
      const toolbar = container.querySelector(".data-catalog-toolbar")!;
      toolbar.scrollIntoView({ block: "start" });
      await waitFor(() =>
        expect(toolbar.getBoundingClientRect().top).toBeGreaterThanOrEqual(
          header.getBoundingClientRect().bottom,
        ),
      );
      if (width === 1920 || width === 390) {
        await page.screenshot({
          path: `../../output/playwright/homepage-floating-menu-${width}.png`,
        });
      }
    },
  );
});
