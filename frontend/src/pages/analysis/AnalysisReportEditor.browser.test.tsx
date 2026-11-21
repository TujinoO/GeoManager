import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import AnalysisReportEditor from "./AnalysisReportEditor";
import type { AnalysisReportDocument } from "../../api/generated/types.gen";
import {
  captureReportFigures,
  renderReportPages,
  wrapReportText,
} from "./report-render";
import AnalysisChart from "../../components/AnalysisChart";
import "antd/dist/reset.css";
import "./analysis-refinement.css";

const { report, saveReport, updateResultArtifact } = vi.hoisted(() => ({
  report: vi.fn(),
  saveReport: vi.fn(),
  updateResultArtifact: vi.fn(),
}));
vi.mock("../../api/analysis", () => ({
  analysisApi: { report, saveReport },
  downloadBlob: vi.fn(),
}));
vi.mock("./report-render", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./report-render")>();
  return { ...actual, renderReportPages: vi.fn(actual.renderReportPages) };
});
const renderPages = vi.mocked(renderReportPages);

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
      expect(
        await screen.findByAltText("报告第1页", {}, { timeout: 15000 }),
      ).toBeVisible();
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

  it("updates the real preview automatically for text and figure edits without clearing the previous pages", async () => {
    await page.viewport(1440, 900);
    const imageData = document.createElement("canvas").toDataURL();
    const reportDocument: AnalysisReportDocument = {
      title: "生态调查报告",
      source: "原始来源",
      paragraphs: ["原始段落。"],
      figures: ["植物数量", "土壤含水率"].map((title, i) => ({
        id: `figure-${i}`,
        title,
        caption: "",
        imageData,
        included: true,
      })),
    };
    report.mockResolvedValueOnce({
      id: 98,
      status: "draft",
      sourceResourceId: 83,
      reportDocument,
    });
    renderPages.mockClear();
    render(
      <App>
        <AnalysisReportEditor open initialReportId={98} onClose={() => {}} />
      </App>,
    );
    const firstPageUrl = (
      await screen.findByAltText("报告第1页", {}, { timeout: 15000 })
    ).getAttribute("src");
    const title = screen.getByLabelText("报告标题");
    fireEvent.change(title, { target: { value: "暂用标题" } });
    fireEvent.change(title, { target: { value: "更新后的调查报告" } });
    fireEvent.change(screen.getByLabelText("数据来源与分析范围"), {
      target: { value: "2026 年样方调查" },
    });
    fireEvent.change(screen.getByLabelText("分析段落1"), {
      target: { value: "已补充筛选范围和样本数。" },
    });
    fireEvent.click(screen.getAllByRole("checkbox", { name: "纳入报告" })[0]!);
    fireEvent.change(screen.getByLabelText("图表标题2"), {
      target: { value: "土壤含水率分布" },
    });
    fireEvent.change(screen.getByLabelText("图表说明2"), {
      target: { value: "按流域汇总。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "上移土壤含水率分布" }));

    expect(screen.getByText("正在自动更新预览…")).toBeVisible();
    expect(title).toBeEnabled();
    expect(screen.getByAltText("报告第1页")).toHaveAttribute(
      "src",
      firstPageUrl,
    );
    await waitFor(
      () => {
        expect(screen.getByAltText("报告第1页")).not.toHaveAttribute(
          "src",
          firstPageUrl,
        );
      },
      { timeout: 5000 },
    );
    expect(renderPages).toHaveBeenCalledTimes(2);
    expect(renderPages).toHaveBeenLastCalledWith({
      title: "更新后的调查报告",
      source: "2026 年样方调查",
      paragraphs: ["已补充筛选范围和样本数。"],
      figures: [
        {
          ...reportDocument.figures[1],
          title: "土壤含水率分布",
          caption: "按流域汇总。",
        },
        { ...reportDocument.figures[0], included: false },
      ],
    });
  });

  it("saves the latest document and its pages even when an older preview is still rendering", async () => {
    let rejectOldRender!: (error: Error) => void;
    let resolveNewRender!: (pages: Blob[]) => void;
    const oldRender = new Promise<Blob[]>((_, reject) => {
      rejectOldRender = reject;
    });
    const newRender = new Promise<Blob[]>((resolve) => {
      resolveNewRender = resolve;
    });
    saveReport.mockReset();
    saveReport.mockResolvedValueOnce({ id: 99, status: "draft" });
    renderPages.mockClear();
    renderPages.mockImplementationOnce(() => oldRender);
    renderPages.mockImplementationOnce(() => newRender);
    report.mockResolvedValueOnce({
      id: 99,
      status: "draft",
      sourceResourceId: 83,
      reportDocument: {
        title: "原报告",
        source: "",
        paragraphs: [],
        figures: [],
      },
    });
    render(
      <App>
        <AnalysisReportEditor open initialReportId={99} onClose={() => {}} />
      </App>,
    );
    const title = await screen.findByLabelText("报告标题");
    await waitFor(() => expect(renderPages).toHaveBeenCalledTimes(1));
    fireEvent.change(title, { target: { value: "保存的最新标题" } });
    fireEvent.click(screen.getByRole("button", { name: "保存PDF草稿" }));
    expect(renderPages).toHaveBeenCalledTimes(1);
    expect(saveReport).not.toHaveBeenCalled();
    rejectOldRender(new Error("已过时的预览错误"));
    await waitFor(() => expect(renderPages).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/已过时的预览错误/)).not.toBeInTheDocument();
    expect(saveReport).not.toHaveBeenCalled();
    resolveNewRender([new Blob(["最新版本的页面"], { type: "image/png" })]);

    await waitFor(() => expect(saveReport).toHaveBeenCalledTimes(1));
    const payload = saveReport.mock.calls[0]![0] as FormData;
    expect(JSON.parse(String(payload.get("document"))).title).toBe(
      "保存的最新标题",
    );
    expect(await (payload.get("pages") as File).text()).toBe("最新版本的页面");
    expect(renderPages).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "保存的最新标题" }),
    );
    expect(await screen.findByText("草稿已保存")).toBeVisible();
  });

  it("keeps the previous preview on a render error and supports manual retry", async () => {
    report.mockResolvedValueOnce({
      id: 99,
      status: "draft",
      sourceResourceId: 83,
      reportDocument: {
        title: "原报告",
        source: "",
        paragraphs: [],
        figures: [],
      },
    });
    render(
      <App>
        <AnalysisReportEditor open initialReportId={99} onClose={() => {}} />
      </App>,
    );
    const firstPage = await screen.findByAltText(
      "报告第1页",
      {},
      { timeout: 5000 },
    );
    const firstPageUrl = firstPage.getAttribute("src");
    renderPages.mockRejectedValueOnce(new Error("页面生成失败"));
    fireEvent.change(screen.getByLabelText("报告标题"), {
      target: { value: "重新生成预览" },
    });
    expect(
      await screen.findByText(/预览更新失败，当前显示上一次的预览/),
    ).toBeVisible();
    expect(firstPage).toHaveAttribute("src", firstPageUrl);
    fireEvent.click(screen.getByRole("button", { name: "更新预览" }));
    await waitFor(
      () => {
        expect(screen.getByAltText("报告第1页")).not.toHaveAttribute(
          "src",
          firstPageUrl,
        );
      },
      { timeout: 5000 },
    );
    expect(screen.getByText("修改后自动预览")).toBeVisible();
  });

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
