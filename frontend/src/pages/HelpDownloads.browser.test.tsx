import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import { page } from "vitest/browser";
import { DocsSection } from "./AboutPage";
import { aboutSections } from "../about/aboutSections";
import "antd/dist/reset.css";
import "../styles.css";

afterEach(async () => {
  await page.viewport(1440, 900);
});
it("provides one help PDF and one resource template pack with the current import guidance", async () => {
  const view = render(
    <MemoryRouter initialEntries={["/about/docs?article=nongeo-import"]}>
      <div className="about-page">
        <DocsSection section={aboutSections.find((s) => s.key === "docs")!} />
      </div>
    </MemoryRouter>,
  );
  expect(
    view.container.querySelectorAll('a[href$="CAPFED-help-center.pdf"]'),
  ).toHaveLength(1);
  expect(
    screen.getByRole("link", { name: /下载数据资源模板/ }),
  ).toHaveAttribute("href", "/downloads/data-resource-templates.zip");
  expect(screen.getByText("确认入库", { exact: true })).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "非地理数据字段规范", exact: true }),
  );
  expect(screen.getByText("测定值（value）")).toBeInTheDocument();
  expect(screen.getByText("基因序列统计数据字段")).toBeInTheDocument();
  await page.viewport(390, 844);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
    window.innerWidth + 1,
  );
  await page.screenshot({
    path: "../../output/playwright/help-fields-mobile.png",
  });
});
