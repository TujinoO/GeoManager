import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import type { AnalysisResult } from "../api/generated/types.gen";
import AnalysisPage from "./AnalysisPage";
import "antd/dist/reset.css";
import "../styles.css";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../contexts/AppContext", () => ({
  useAppContext: () => ({
    bootstrap: { systemName: "全球胡杨林生态系统保护数据共享平台" },
    user: {
      username: "layout-test",
      displayName: "布局测试管理员",
      roles: ["超级管理员"],
      permissions: {
        canBrowseData: true,
        canQueryData: true,
        canExportData: true,
        canUploadData: true,
        canAccessAdmin: true,
      },
    },
    setUser: vi.fn(),
  }),
}));
vi.mock("../api/client", () => ({
  api: {
    resources: vi.fn().mockResolvedValue({
      items: [
        {
          id: 91,
          name: "环境因子测试",
          dataType: "table",
          analysisKind: "traits",
          itemCount: 498,
        },
      ],
    }),
  },
}));
vi.mock("../api/analysis", () => ({
  analysisApi: {
    assemblies: vi.fn().mockResolvedValue({ items: [] }),
    views: vi.fn().mockResolvedValue({ items: [] }),
    query,
  },
  downloadBlob: vi.fn(),
}));

const result: AnalysisResult = {
  resourceId: 91,
  resourceName: "环境因子测试",
  kind: "traits",
  provenance: "synthetic",
  unit: "记录",
  total: 498,
  filteredCount: 498,
  offset: 0,
  rows: [{ plot: "A", height_m: 12 }],
  fields: [
    { name: "plot", numeric: false, n: 498, missing: 0 },
    {
      name: "height_m",
      numeric: true,
      n: 498,
      missing: 0,
      min: 1,
      max: 20,
      mean: 10,
      median: 10,
      q1: 5,
      q3: 15,
    },
  ],
  categories: [
    { label: "A", count: 166, value: 166 },
    { label: "B", count: 166, value: 166 },
    { label: "C", count: 166, value: 166 },
  ],
  histogram: [{ start: 1, end: 20, count: 498 }],
  scatter: [],
  heatmap: [],
  visuals: {
    metrics: [],
    boxes: [],
    matrices: [],
    dots: [],
    flows: [],
    nodes: [],
    edges: [],
    variantBins: [],
    variantClasses: [],
    notes: [],
  },
  warnings: [],
  pairedCount: 0,
  correlation: null,
  query: { groupBy: "plot", metric: "height_m" },
  scope: "full",
  generatedAt: "2026-10-30T00:00:00Z",
};

function renderPage() {
  return render(
    <App>
      <MemoryRouter initialEntries={["/nongeo?view=ecology&resourceId=91"]}>
        <AnalysisPage />
      </MemoryRouter>
    </App>,
  );
}

function expectInsideViewport(element: Element) {
  const rect = element.getBoundingClientRect();
  expect(rect.width).toBeGreaterThan(0);
  expect(rect.left).toBeGreaterThanOrEqual(-1);
  expect(rect.right).toBeLessThanOrEqual(
    document.documentElement.clientWidth + 1,
  );
}

afterEach(async () => {
  await page.viewport(1600, 900);
});

describe("analysis page responsive layout", () => {
  it.each([2560, 1920, 1440, 1280, 1024, 768, 390])(
    "keeps actions and both composition charts accessible at %ipx",
    async (width) => {
      await page.viewport(width, 900);
      query.mockResolvedValue(result);
      renderPage();
      await screen.findByRole("heading", { name: "结果概述" });
      for (const name of [/用户信息/, /数据导入/, /刷新资源/, /使用说明/]) {
        expectInsideViewport(screen.getByRole("button", { name }));
      }
      fireEvent.click(
        screen.getByRole("tab", { name: "组成与分类", exact: true }),
      );
      for (const name of ["分类记录组成", "分类计数空间"]) {
        const card = screen.getByRole("heading", { name }).closest("section")!;
        expectInsideViewport(card);
        await waitFor(() => expect(card.querySelector("svg")).not.toBeNull());
        expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
      }
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
        width + 1,
      );
      const main = screen.getByRole("main");
      if (main.clientWidth < 950) {
        const cards = [
          ...screen
            .getByRole("tabpanel", { name: "组成与分类" })
            .querySelectorAll(".analysis-chart-card"),
        ];
        expect(cards[1].getBoundingClientRect().top).toBeGreaterThan(
          cards[0].getBoundingClientRect().top,
        );
      }
      if (width === 1920 || width === 1024) {
        await page.screenshot({
          path: `../../output/playwright/analysis-layout-${width}.png`,
        });
      }
    },
  );

  it("shows a readable horizontal loading message", async () => {
    query.mockImplementation(() => new Promise(() => {}));
    await page.viewport(1024, 768);
    renderPage();
    const status = await screen.findByRole("status");
    expectInsideViewport(status);
    expect(status.getBoundingClientRect().width).toBeGreaterThan(160);
    expect(status.getBoundingClientRect().height).toBeLessThan(50);
  });
});
