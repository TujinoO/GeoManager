import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { App } from "antd";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AnalysisResult,
  GenomeSummary,
} from "../../api/generated/types.gen";
import TableAnalysisPanel from "./TableAnalysisPanel";
import GenomeAnalysisPanel, { GenomeComparison } from "./GenomeAnalysisPanel";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    query: vi.fn(),
    export: vi.fn(),
    save: vi.fn(),
    summary: vi.fn(),
    genes: vi.fn(),
    gene: vi.fn(),
    sequence: vi.fn(),
  },
}));
vi.mock("../../api/analysis", () => ({
  analysisApi: mockApi,
  downloadBlob: vi.fn(),
}));
vi.mock("../../components/AnalysisChart", () => ({
  default: ({
    title,
    subtitle,
    extra,
  }: {
    title: string;
    subtitle?: string;
    extra?: React.ReactNode;
  }) => (
    <div>
      <h3>{title}</h3>
      <p>{subtitle}</p>
      {extra}
    </div>
  ),
}));

const result: AnalysisResult = {
  resourceId: 1,
  resourceName: "生态测试",
  kind: "traits",
  provenance: "synthetic",
  unit: "观测记录",
  total: 50,
  filteredCount: 50,
  offset: 0,
  rows: [{ record_id: "r1", height_m: 0 }],
  fields: [
    {
      name: "height_m",
      numeric: true,
      n: 50,
      missing: 0,
      min: 0,
      max: 20,
      mean: 10,
      median: 10,
      q1: 5,
      q3: 15,
    },
  ],
  categories: [],
  histogram: [],
  scatter: [],
  pairedCount: 0,
  correlation: null,
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
  query: { metric: "height_m" },
  scope: "full",
  generatedAt: "2026-10-29T00:00:00Z",
};
function table(id = 1, canExport = true) {
  return (
    <App>
      <TableAnalysisPanel
        resourceId={id}
        canExport={canExport}
        onSaved={vi.fn()}
      />
    </App>
  );
}

describe("analysis panel workflows", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockApi.query.mockResolvedValue(result);
  });

  it("initializes assembly comparison after the resource directory finishes loading", async () => {
    mockApi.summary.mockImplementation(() => new Promise(() => {}));
    const ui = render(<GenomeComparison assemblies={[]} canExport={false} />);
    const assemblies = [
      {
        id: 1,
        resourceId: 10,
        code: "FG",
        name: "雌株",
        version: "1",
        sex: "female",
        provenance: "observed",
        status: "ready",
        totalBp: 100,
        geneCount: 1,
      },
      {
        id: 2,
        resourceId: 20,
        code: "MG",
        name: "雄株",
        version: "1",
        sex: "male",
        provenance: "observed",
        status: "ready",
        totalBp: 200,
        geneCount: 2,
      },
    ];
    ui.rerender(<GenomeComparison assemblies={assemblies} canExport={false} />);
    await waitFor(() =>
      expect(mockApi.summary).toHaveBeenCalledWith(1, expect.any(AbortSignal)),
    );
    expect(mockApi.summary).toHaveBeenCalledWith(2, expect.any(AbortSignal));
  });

  it("switches expression heatmap meaning explicitly without changing or refetching records", async () => {
    mockApi.query.mockResolvedValue({
      ...result,
      kind: "expression",
      visuals: {
        ...result.visuals,
        metrics: [{ label: "表达基因", value: "1", note: "当前数据" }],
      },
      heatmap: [
        { x: "s1", y: "g1", value: 0 },
        { x: "s2", y: "g1", value: 2 },
      ],
    });
    render(table());
    expect(await screen.findByText("基因表达模式")).toBeVisible();
    fireEvent.click(screen.getByText("行Z分数"));
    expect(await screen.findByText(/各基因在当前显示样本内/)).toBeVisible();
    expect(mockApi.query).toHaveBeenCalledTimes(1);
  });

  it("shows an API failure and retries the same resource", async () => {
    mockApi.query.mockRejectedValueOnce(new Error("资源读取失败"));
    render(table());
    expect(await screen.findByText("资源读取失败")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /重\s*试/ }));
    expect(await screen.findByText("结果概述")).toBeVisible();
    expect(mockApi.query).toHaveBeenCalledTimes(2);
  });

  it("renders records without randomUUID on a public HTTP origin", async () => {
    const uuid = vi.spyOn(crypto, "randomUUID");
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
    mockApi.query.mockResolvedValue({
      ...result,
      rows: [{ height_m: 0 }, { height_m: 0 }, { height_m: 12 }],
    });
    try {
      render(table());
      expect(await screen.findByText("结果概述")).toBeVisible();
      fireEvent.click(screen.getByRole("tab", { name: "数据明细" }));
      const rows = document.querySelectorAll("tr[data-row-key]");
      expect(rows).toHaveLength(3);
      const keys = [...rows].map((row) => row.getAttribute("data-row-key"));
      expect(new Set(keys).size).toBe(3);
      fireEvent.change(screen.getByLabelText("分析关键词"), {
        target: { value: "胡杨" },
      });
      expect(
        [...document.querySelectorAll("tr[data-row-key]")].map((row) =>
          row.getAttribute("data-row-key"),
        ),
      ).toEqual(keys);
    } finally {
      uuid.mockRestore();
    }
  });

  it("does not overwrite a new resource with an older asynchronous result", async () => {
    let finishOld: (value: AnalysisResult) => void = () => undefined;
    mockApi.query.mockImplementationOnce(
      () =>
        new Promise<AnalysisResult>((resolve) => {
          finishOld = resolve;
        }),
    );
    const ui = render(table());
    await waitFor(() => expect(mockApi.query).toHaveBeenCalledTimes(1));
    ui.rerender(table(2));
    expect(await screen.findByText("结果概述")).toBeVisible();
    await act(async () => {
      finishOld({ ...result, resourceName: "过期的资源" });
    });
    expect(screen.getByText("结果概述")).toBeVisible();
    expect(screen.queryByText("过期的资源")).toBeNull();
  });

  it("uses the active keyword for full export and honors export permissions", async () => {
    const ui = render(table(1, false));
    await screen.findByText("结果概述");
    expect(screen.getByRole("button", { name: /下载结果/ })).toBeDisabled();
    ui.rerender(table());
    fireEvent.change(screen.getByLabelText("分析关键词"), {
      target: { value: "胡杨" },
    });
    fireEvent.keyDown(screen.getByLabelText("分析关键词"), {
      key: "Enter",
      code: "Enter",
      charCode: 13,
    });
    await waitFor(() =>
      expect(mockApi.query.mock.calls.at(-1)?.[1]).toMatchObject({
        keyword: "胡杨",
        offset: 0,
      }),
    );
    mockApi.export.mockResolvedValue(new Blob(["record_id\nr1"]));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /下载结果/ })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /下载结果/ }));
    fireEvent.click(await screen.findByText("下载数据表（CSV）"));
    await waitFor(() =>
      expect(mockApi.export).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ keyword: "胡杨" }),
      ),
    );
  });

  it("distinguishes grouping categories from numeric statistics", async () => {
    mockApi.query.mockResolvedValue({
      ...result,
      fields: [
        ...result.fields,
        { name: "life_form", numeric: false, n: 50, missing: 0 },
        { name: "record_id", numeric: false, n: 50, missing: 0 },
      ],
      query: { metric: "height_m", groupBy: "life_form" },
    });
    render(table());
    await screen.findByText("结果概述");
    const groupControl = screen.getByRole("combobox", { name: "分组依据" });
    const metricControl = screen.getByRole("combobox", { name: "统计指标" });
    expect(groupControl).toBeEnabled();
    expect(metricControl).toBeEnabled();
    fireEvent.mouseDown(groupControl);
    await waitFor(() =>
      expect(groupControl).toHaveAttribute("aria-expanded", "true"),
    );
    const dropdown = document.querySelector(
      ".ant-select-dropdown:not(.ant-select-dropdown-hidden)",
    );
    expect(dropdown?.textContent).toContain("生活型");
    expect(dropdown?.textContent).not.toContain("株高");
    expect(dropdown?.textContent).not.toContain("记录编号");
  });

  it("keeps an empty result explicit instead of substituting demonstration records", async () => {
    mockApi.query.mockResolvedValue({ ...result, filteredCount: 0, rows: [] });
    render(table());
    expect(
      await screen.findByText("当前筛选没有记录，图表为空；请调整或清除条件"),
    ).toBeVisible();
  });

  it("zooms on the searched gene chromosome when the selector was on another chromosome", async () => {
    const summary = {
      assembly: { id: 1, code: "FG", provenance: "synthetic", sex: "female" },
      totalBp: 20000,
      sequenceCount: 2,
      chromosomeCount: 2,
      sequenceN50: 10000,
      gc: 0.3,
      nCount: 0,
      geneCount: 1,
      transcriptCount: 1,
      proteinCount: 1,
      sequences: ["chr01", "chr02"].map((name) => ({
        id: name,
        name,
        length: 10000,
        geneCount: 1,
        bins: [],
      })),
      files: [],
      warnings: [],
      sourceUrl: "",
    } as unknown as GenomeSummary;
    const gene = {
      id: "test-gene",
      originalId: "test-gene",
      seqid: "chr02",
      start: 2000,
      end: 3000,
      strand: "+",
      proteinCount: 0,
    };
    mockApi.summary.mockResolvedValue(summary);
    mockApi.genes.mockResolvedValue({ items: [gene], total: 1, offset: 0 });
    mockApi.gene.mockResolvedValue({ gene, features: [], sequences: [] });
    render(
      <App>
        <GenomeAnalysisPanel assemblyId={1} mode="browser" canExport={false} />
      </App>,
    );
    await screen.findByRole("heading", { name: /test-gene.*基因结构/ });
    fireEvent.change(screen.getByLabelText("全量基因检索"), {
      target: { value: "test-gene" },
    });
    fireEvent.keyDown(screen.getByLabelText("全量基因检索"), {
      key: "Enter",
      code: "Enter",
      charCode: 13,
    });
    await waitFor(() =>
      expect(mockApi.genes.mock.calls.at(-1)?.[1].q).toBe("test-gene"),
    );
    await screen.findByRole("heading", { name: /test-gene.*基因结构/ });
    fireEvent.click(screen.getByRole("button", { name: "放大区间" }));
    await waitFor(() =>
      expect(mockApi.genes.mock.calls.at(-1)?.[1]).toMatchObject({
        seqid: "chr02",
        q: "",
      }),
    );
  });
});
