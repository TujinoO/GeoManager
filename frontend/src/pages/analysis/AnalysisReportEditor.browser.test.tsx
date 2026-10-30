import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import AnalysisReportEditor from "./AnalysisReportEditor";
import {
  captureReportFigures,
  renderReportPages,
  wrapReportText,
} from "./report-render";
import AnalysisChart from "../../components/AnalysisChart";
import "antd/dist/reset.css";
import "./analysis-refinement.css";

const { saveReport, updateResultArtifact } = vi.hoisted(() => ({
  saveReport: vi.fn(),
  updateResultArtifact: vi.fn(),
}));
vi.mock("../../api/analysis", () => ({
  analysisApi: { saveReport },
  downloadBlob: vi.fn(),
}));
vi.mock("../../api/client", () => ({ api: { updateResultArtifact } }));
vi.mock("../../contexts/AppContext", () => ({
  useAppContext: () => ({
    user: {
      permissions: {
        canImportResultArtifacts: true,
        canExportData: true,
        canViewResultArtifacts: true,
      },
    },
  }),
}));

describe("editable resource analysis reports", () => {
  it("captures rendered ECharts pie and treemap instead of blank initialization frames", async () => {
    const view = render(
      <div data-testid="charts">
        <AnalysisChart
          title="组成"
          canExport
          option={{
            series: [
              {
                type: "pie",
                data: [
                  { name: "A", value: 3 },
                  { name: "B", value: 5 },
                ],
              },
            ],
          }}
        />
        <AnalysisChart
          title="分类"
          canExport
          option={{
            series: [
              {
                type: "treemap",
                data: [
                  { name: "A", value: 3, itemStyle: { color: "#16b8a9" } },
                  { name: "B", value: 5, itemStyle: { color: "#927dd7" } },
                ],
              },
            ],
          }}
        />
      </div>,
    );
    const figures = await captureReportFigures(view.getByTestId("charts"));
    expect(figures).toHaveLength(2);
    for (const figure of figures) {
      const img = await createImageBitmap(
        await (await fetch(figure.imageData)).blob(),
      );
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      img.close();
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let colored = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (
          Math.max(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!) -
            Math.min(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!) >
          25
        )
          colored++;
      expect(colored).toBeGreaterThan(1000);
    }
  });
  it.each([390, 1440])(
    "captures all chart candidates, edits one draft and freezes review at %ipx",
    async (width) => {
      await page.viewport(width, 900);
      saveReport.mockReset();
      updateResultArtifact.mockReset();
      saveReport.mockImplementation(async (body: FormData) => ({
        id: 97,
        name: "报告",
        status: "draft",
        canSubmitReview: true,
        canDownload: true,
        downloadUrl: "/report.pdf",
        reportDocument: JSON.parse(String(body.get("document"))),
      }));
      updateResultArtifact.mockResolvedValue({
        id: 97,
        name: "报告",
        status: "in_review",
        canSubmitReview: false,
        canDownload: true,
        downloadUrl: "/report.pdf",
      });
      const chart = (
        <article className="analysis-chart-card">
          <h3>群落指标分布</h3>
          <p>逐对排除缺测</p>
          <button>
            <svg width="14" height="14">
              <path d="M0 0 L14 14" />
            </svg>
            SVG
          </button>
          <div className="analysis-chart-viewport">
            <svg width="800" height="300" xmlns="http://www.w3.org/2000/svg">
              <rect x="20" y="20" width="200" height="160" fill="#128d81" />
              <text x="250" y="90">
                群落观测
              </text>
            </svg>
          </div>
        </article>
      );
      render(
        <App>
          <AnalysisReportEditor
            open
            resourceId={83}
            title="群落观测"
            paragraphs={["当前资源包含516个样方观测记录。"]}
            charts={chart}
            onClose={() => {}}
          />
        </App>,
      );
      const title = await screen.findByLabelText("报告标题");
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "保存PDF草稿" }),
        ).toBeEnabled(),
      );
      expect(await screen.findByAltText("报告第1页")).toBeVisible();
      expect(
        screen.getAllByRole("checkbox", { name: "纳入报告" }),
      ).toHaveLength(1);
      fireEvent.change(title, { target: { value: "群落完整分析报告" } });
      fireEvent.click(screen.getByRole("button", { name: "保存PDF草稿" }));
      await waitFor(() => expect(saveReport).toHaveBeenCalledTimes(1), {
        timeout: 10000,
      });
      expect(saveReport.mock.calls[0]?.[0].get("resourceId")).toBe("83");
      expect(
        saveReport.mock.calls[0]?.[0].getAll("pages").length,
      ).toBeGreaterThan(0);
      const savedFigure = JSON.parse(
        String(saveReport.mock.calls[0]?.[0].get("document")),
      ).figures[0];
      const figureImage = await createImageBitmap(
        await (await fetch(savedFigure.imageData)).blob(),
      );
      expect(figureImage.width).toBe(2400);
      expect(figureImage.height).toBe(900);
      figureImage.close();
      expect(
        await screen.findByRole("button", { name: "提交审核" }),
      ).toBeEnabled();
      fireEvent.change(screen.getByLabelText("分析段落1"), {
        target: { value: "补充有效值说明。" },
      });
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "保存PDF草稿" }),
        ).toBeEnabled(),
      );
      fireEvent.click(screen.getByRole("button", { name: "保存PDF草稿" }));
      await waitFor(() => expect(saveReport).toHaveBeenCalledTimes(2), {
        timeout: 10000,
      });
      expect(saveReport.mock.calls[1]?.[1]).toBe(97);
      fireEvent.click(await screen.findByRole("button", { name: "提交审核" }));
      expect(await screen.findByText("待审核")).toBeVisible();
      expect(screen.getByLabelText("报告标题")).toBeDisabled();
      const dialog = screen.getByRole("dialog");
      expect(dialog.getBoundingClientRect().width).toBeLessThanOrEqual(width);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
    },
  );

  it("wraps long Chinese analysis and exports multi-page A4 PNGs without losing paragraphs", async () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    ctx.font = "30px sans-serif";
    const text = "功能多样性与土壤环境指标的关系。".repeat(100);
    expect(wrapReportText(ctx, text, 300).join("")).toBe(text);
    const pages = await renderReportPages({
      title: "群落分析",
      source: "原始调查资料",
      paragraphs: [text, text],
      figures: [],
    });
    expect(pages.length).toBeGreaterThan(1);
    const image = await createImageBitmap(pages[0]!);
    expect([image.width, image.height]).toEqual([1984, 2806]);
    image.close();
  });
});
