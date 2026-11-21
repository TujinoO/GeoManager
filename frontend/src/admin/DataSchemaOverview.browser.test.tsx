import "antd/dist/reset.css";
import "../styles.css";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { page } from "vitest/browser";
import { App as AntApp, ConfigProvider } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLocale } from "../i18n";
import { appTheme } from "../theme";
import type { DataSchemaSummary } from "../types";
import { fallbackTaxonomyTree } from "../utils/taxonomy";
import DataSchemaOverview from "./DataSchemaOverview";

const mockSummary = vi.hoisted(() => vi.fn<() => Promise<DataSchemaSummary>>());
vi.mock("../api/client", () => ({ api: { dataSchemaSummary: mockSummary } }));

const summary: DataSchemaSummary = {
  taxonomyVersion: "2026.07",
  catalogTree: fallbackTaxonomyTree,
  domains: [],
  entities: [],
  layers: [],
};

function show(canBrowseData = true, maxWidth = 1440) {
  return render(
    <ConfigProvider theme={appTheme}>
      <AntApp>
        <div style={{ maxWidth, margin: "12px auto" }}>
          <DataSchemaOverview canBrowseData={canBrowseData} />
        </div>
      </AntApp>
    </ConfigProvider>,
  );
}

function expectNoOverflow(taxonomy: HTMLElement) {
  for (const item of [
    taxonomy,
    ...taxonomy.querySelectorAll<HTMLElement>("article, li"),
  ]) {
    expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth + 1);
  }
}

beforeEach(() => {
  mockSummary.mockReset().mockResolvedValue(summary);
});

afterEach(async () => {
  await page.viewport(1600, 900);
});

describe("inventory taxonomy overview", () => {
  it("shows the four groups and fifteen categories without filler items", async () => {
    show();
    const taxonomy = await screen.findByRole("region", {
      name: "平台数据分类",
    });
    const groups = within(taxonomy).getAllByRole("article");
    expect(groups).toHaveLength(4);
    expect(within(taxonomy).getByText("个大类")).toHaveTextContent("4 个大类");
    expect(within(taxonomy).getAllByRole("listitem")).toHaveLength(15);
    expect(
      groups.map((group) => within(group).getAllByRole("listitem").length),
    ).toEqual([3, 4, 2, 6]);
    expect(
      within(taxonomy).getByRole("complementary", {
        name: "未分组（其他）数据",
      }),
    ).toBeVisible();
    const [first, second, third] = within(groups[0]).getAllByRole("listitem");
    expect(first.getBoundingClientRect().top).toBe(
      second.getBoundingClientRect().top,
    );
    expect(first.getBoundingClientRect().top).toBe(
      third.getBoundingClientRect().top,
    );
    expectNoOverflow(taxonomy);
    await page.screenshot({
      element: taxonomy.closest(".data-schema-card") ?? taxonomy,
      path: "../../output/playwright/inventory-taxonomy-desktop.png",
    });
  });

  it("adapts to available panel width independently of the browser width", async () => {
    show(true, 660);
    const taxonomy = await screen.findByRole("region", {
      name: "平台数据分类",
    });
    const group = within(taxonomy).getByRole("article", {
      name: "基础地理信息数据",
    });
    const heading = within(group).getByRole("heading");
    const list = within(group).getByRole("list");
    const [first, second, third] = within(list).getAllByRole("listitem");
    expect(list.getBoundingClientRect().top).toBeGreaterThan(
      heading.getBoundingClientRect().bottom,
    );
    expect(first.getBoundingClientRect().top).toBe(
      second.getBoundingClientRect().top,
    );
    expect(third.getBoundingClientRect().top).toBeGreaterThan(
      first.getBoundingClientRect().bottom,
    );
    expect(third.getBoundingClientRect().width).toBeCloseTo(
      list.getBoundingClientRect().width,
    );
    expectNoOverflow(taxonomy);
  });

  it("stacks categories and keeps both languages readable on a narrow screen", async () => {
    await page.viewport(390, 1900);
    show();
    const taxonomy = await screen.findByRole("region", {
      name: "平台数据分类",
    });
    const [first, second] = within(taxonomy).getAllByRole("listitem");
    expect(second.getBoundingClientRect().top).toBeGreaterThan(
      first.getBoundingClientRect().bottom,
    );
    expectNoOverflow(taxonomy);
    await page.screenshot({
      element: taxonomy.closest(".data-schema-card") ?? taxonomy,
      path: "../../output/playwright/inventory-taxonomy-mobile.png",
    });

    await setLocale("en-US");
    const translated = await screen.findByRole("region", {
      name: "Platform data taxonomy",
    });
    expect(
      within(translated).getByRole("heading", {
        name: "Base geographic information",
      }),
    ).toBeVisible();
    expect(
      within(translated).getByText("categories", {
        selector: ".data-schema-count",
      }),
    ).toHaveTextContent("15 categories");
    expectNoOverflow(translated);
  });

  it("keeps the permission gate and supports retry after a failed refresh", async () => {
    const hidden = show(false);
    expect(screen.getByText("当前账号暂无平台数据体系浏览权限")).toBeVisible();
    expect(mockSummary).not.toHaveBeenCalled();
    hidden.unmount();

    const { container } = show();
    const card = within(container);
    await card.findByRole("region", { name: "平台数据分类" });
    const refresh = screen.getByRole("button", { name: /刷新/ });
    await waitFor(() => expect(refresh).not.toHaveClass("ant-btn-loading"));
    mockSummary.mockRejectedValueOnce(new Error("加载失败"));
    fireEvent.click(refresh);
    await waitFor(() => expect(mockSummary).toHaveBeenCalledTimes(2));
    expect(await card.findByRole("alert")).toHaveTextContent("加载失败");
    expect(screen.getByRole("region", { name: "平台数据分类" })).toBeVisible();
    await waitFor(() => expect(refresh).not.toHaveClass("ant-btn-loading"));
    fireEvent.click(refresh);
    await waitFor(() =>
      expect(card.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(mockSummary).toHaveBeenCalledTimes(3);
  });
});
