import { describe, it, expect } from "vitest";
import {
  reportDocument,
  fieldLabel,
  filterLabel,
  resultMetrics,
} from "./presentation";
import type { AnalysisResult } from "../../api/generated/types.gen";

describe("readable analysis reports", () => {
  it("embeds visible chart and genome SVG with escaped user text and excludes hidden charts", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<section class="analysis-chart-card" style="width:300px"><h3>测量图</h3><svg width="300" height="100"><text>0与缺失</text></svg></section><section class="analysis-chart-card" style="display:none"><svg><text>隐藏页</text></svg></section><svg class="analysis-genome-circle" width="300" height="300"><text>chr01</text></svg>';
    document.body.append(root);
    const report = reportDocument(
      "<script>title</script>",
      ["A&B <记录>"],
      root,
      "数据来源",
    );
    expect(report).toContain("&lt;script&gt;");
    expect(report).not.toContain("<script>");
    expect(report).toContain("A&amp;B &lt;记录&gt;");
    expect(report).toContain("chr01");
    expect(report).toContain("测量图");
    expect(report).not.toContain("隐藏页");
    expect((report.match(/<svg/g) ?? []).length).toBe(2);
    root.remove();
  });
  it("translates labels while retaining source field identifiers", () => {
    expect(fieldLabel("length_bp")).toContain("bp");
    expect(fieldLabel("gene_id")).toBe("基因编号");
    expect(filterLabel("gte")).toBe("不小于");
  });
  it("distinguishes absent quality records from a recorded zero passing count", () => {
    const partial = {
      filteredCount: 2,
      fields: [{ name: "quality_flag", n: 0 }],
      visuals: {
        metrics: [
          { label: "通过质控", value: "0", note: "仅quality_flag=pass" },
        ],
      },
    } as AnalysisResult;
    expect(resultMetrics(partial)[0].value).toBe("未提供");
    expect(
      resultMetrics({
        ...partial,
        fields: [{ ...partial.fields[0]!, n: 2 }],
      })[0],
    ).toEqual({
      label: "通过质控",
      value: "0",
      note: "仅统计明确登记为通过的记录",
    });
  });
});
