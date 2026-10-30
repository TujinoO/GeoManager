import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import AnalysisImportPanel from "./AnalysisImportPanel";
import { genomeViews } from "./presentation";
import "antd/dist/reset.css";
import "./analysis.css";

const mocks = vi.hoisted(() => ({
  templates: vi.fn(),
  importTable: vi.fn(),
  validateGenome: vi.fn(),
  importGenome: vi.fn(),
}));
vi.mock("../../api/analysis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/analysis")>()),
  analysisApi: mocks,
}));
const checked = {
  valid: true,
  resourceId: null,
  rowCount: 2,
  issues: [],
  warnings: [],
  columns: ["sample_code", "value"],
  rows: [
    ["001", "0"],
    ["002", ""],
  ],
};
function mount() {
  const onImported = vi.fn();
  const onOpen = vi.fn();
  const onDirtyChange = vi.fn();
  const view = render(
    <App>
      <AnalysisImportPanel
        canImport
        onImported={onImported}
        onOpen={onOpen}
        onDirtyChange={onDirtyChange}
      />
    </App>,
  );
  return { ...view, onImported, onOpen, onDirtyChange };
}
async function choose(view: ReturnType<typeof mount>, file: File, index = 0) {
  const input = view.container.querySelectorAll('input[type="file"]')[index];
  if (!input) throw new Error("missing file input");
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "下一步：核查校验" }),
    ).toBeEnabled(),
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.templates.mockResolvedValue({
    version: "1",
    items: [
      {
        kind: "individual",
        name: "生态观测—个体",
        unit: "记录",
        columns: [],
        uniqueKey: ["record_id"],
      },
    ],
  });
  mocks.importTable.mockImplementation(async (body: FormData) => ({
    ...checked,
    resourceId: body.get("validateOnly") === "true" ? null : 120,
  }));
  mocks.validateGenome.mockResolvedValue({
    ...checked,
    rowCount: 60,
    columns: undefined,
    rows: undefined,
  });
  mocks.importGenome.mockResolvedValue({ assembly: { resourceId: 121 } });
});
afterEach(async () => {
  await page.viewport(1440, 900);
});

describe("nongeographic staged import", () => {
  it("requires successful validation, invalidates edited parameters, and commits only on confirmation", async () => {
    const view = mount();
    expect(screen.queryByText("字段与数据约束")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "下一步：核查校验" }),
    ).toBeDisabled();
    await choose(view, new File(["data"], "个体.csv", { type: "text/csv" }));
    fireEvent.click(screen.getByRole("button", { name: "下一步：核查校验" }));
    expect(
      screen.getByRole("button", { name: "下一步：确认入库" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /开始校验/ }));
    await screen.findByText("校验通过 · 2条记录");
    expect(view.onImported).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "导入数据名称" }), {
      target: { value: "修改后的调查" },
    });
    expect(
      screen.getByRole("button", { name: "下一步：确认入库" }),
    ).toBeDisabled();
    expect(screen.queryByText("校验通过 · 2条记录")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /开始校验/ }));
    await screen.findByText("校验通过 · 2条记录");
    fireEvent.click(screen.getByRole("button", { name: "下一步：确认入库" }));
    expect(mocks.importTable).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "确认入库" }));
    await screen.findByText("入库完成");
    expect(mocks.importTable.mock.calls[2][0].get("validateOnly")).toBe(
      "false",
    );
    expect(view.onImported).toHaveBeenCalledWith(120);
    fireEvent.click(screen.getByRole("button", { name: "打开数据分析" }));
    expect(view.onOpen).toHaveBeenCalledWith(120, "individual");
  });

  it("keeps failed validation from reaching confirmation and supports Excel sheet selection", async () => {
    mocks.importTable.mockRejectedValueOnce(new Error("缺少物种字段"));
    const view = mount();
    await choose(view, new File(["workbook"], "data.xlsx"));
    fireEvent.click(screen.getByRole("button", { name: "下一步：核查校验" }));
    fireEvent.change(screen.getByRole("textbox", { name: "工作表名称" }), {
      target: { value: "个体记录" },
    });
    fireEvent.click(screen.getByRole("button", { name: /开始校验/ }));
    await screen.findByText("缺少物种字段");
    expect(
      screen.getByRole("button", { name: "下一步：确认入库" }),
    ).toBeDisabled();
    expect(mocks.importTable.mock.calls[0][0].get("sheetName")).toBe(
      "个体记录",
    );
  });

  it("validates required genome roles before a separate final import", async () => {
    const view = mount();
    fireEvent.click(screen.getByRole("radio", { name: "基因组配套文件" }));
    const inputs = view.container.querySelectorAll('input[type="file"]');
    fireEvent.change(inputs[0]!, {
      target: { files: [new File([">chr1\nACGT"], "FG.fa")] },
    });
    expect(
      screen.getByRole("button", { name: "下一步：核查校验" }),
    ).toBeDisabled();
    await choose(view, new File(["gff"], "FG.gff3"), 1);
    fireEvent.click(screen.getByRole("button", { name: "下一步：核查校验" }));
    fireEvent.change(screen.getByRole("textbox", { name: "导入数据名称" }), {
      target: { value: "雌株组装" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "组装编号" }), {
      target: { value: "FG_v1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /检查文件与配套关系/ }));
    await screen.findByText("校验通过 · 60条基因");
    expect(mocks.importGenome).not.toHaveBeenCalled();
    expect(mocks.validateGenome.mock.calls[0][0].get("validateOnly")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "下一步：确认入库" }));
    fireEvent.click(screen.getByRole("button", { name: "确认入库" }));
    await screen.findByText("入库完成");
    expect(view.onImported).toHaveBeenCalledWith(121, true);
    expect(mocks.importGenome.mock.calls[0][0].get("validateOnly")).toBe(
      "false",
    );
  });

  it("fits mobile selection and validation layouts and only exposes supported genome pages", async () => {
    await page.viewport(390, 844);
    const view = mount();
    await choose(view, new File(["x"], "调查.csv"));
    fireEvent.click(screen.getByRole("button", { name: "下一步：核查校验" }));
    fireEvent.click(screen.getByRole("button", { name: /开始校验/ }));
    await screen.findByText("校验通过 · 2条记录");
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      window.innerWidth + 1,
    );
    expect(genomeViews.map((v) => v.value)).toEqual([
      "overview",
      "browser",
      "comparison",
      "sequence",
    ]);
  });
});
