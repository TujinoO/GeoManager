import type { AnalysisResult } from "../../api/generated/types.gen";

export const fieldNames: Record<string, string> = {
  record_id: "记录编号",
  plot_code: "样方编号",
  species: "物种",
  life_form: "生活型",
  region: "采集区域",
  height_m: "株高（m）",
  leaf_water_fraction: "叶片含水率",
  survey_date: "调查日期",
  sample_code: "样品编号",
  sex: "性别",
  material_type: "采样材料",
  is_core: "核心种质",
  longitude: "经度",
  latitude: "纬度",
  result_id: "测定编号",
  assay_code: "实验编号",
  marker: "测定指标",
  value: "测定值",
  unit: "单位",
  batch: "实验批次",
  quality_flag: "质检结果",
  assembly: "参考组装",
  gene_id: "基因编号",
  group: "样本分组",
  replicate: "生物重复",
  database: "注释数据库",
  database_version: "数据库版本",
  term_id: "功能条目编号",
  term_name: "功能名称",
  evidence: "注释证据",
  chromosome: "染色体",
  position: "碱基位置（bp）",
  ref: "参考等位基因",
  alt: "替代等位基因",
  genotype: "基因型",
  quality: "质量分数",
  filter: "过滤状态",
  sequence_id: "序列编号",
  sequence_type: "序列类型",
  length_bp: "核酸长度（bp）",
  length_aa: "蛋白长度（aa）",
  gc_fraction: "GC比例",
};
export const fieldLabel = (name?: string) =>
  name ? (fieldNames[name] ?? name) : "未选择";
export const displayValue = (value: unknown) =>
  (
    ({
      female: "雌株",
      male: "雄株",
      unknown: "未确认",
      true: "是",
      false: "否",
      pass: "通过",
      review: "待复核",
      failed: "未通过",
      control: "对照组",
      stress: "处理组",
      protein: "蛋白质",
      rna: "转录本",
      cds: "编码序列",
      genome: "基因组",
      gene: "基因区段",
    }) as Record<string, string>
  )[String(value)] ?? String(value);
export function resourceTitle(name: string) {
  return name.replace(/^\[合成演示\]\s*/, "").replace(/\s*·\s*丰富示例$/, "");
}
export const analysisTypes = [
  { id: "ecology", name: "生态观测", detail: "个体、群落、种群与功能性状" },
  { id: "samples", name: "样品与种质", detail: "样品来源、材料与核心种质" },
  { id: "molecular", name: "分子实验", detail: "生化测定、分子标记与实验批次" },
  {
    id: "genome",
    name: "基因组与组学",
    detail: "参考组装、序列、表达、注释与变异",
  },
];
export const genomeViews = [
  { value: "overview", label: "基因组概览" },
  { value: "browser", label: "基因结构" },
  { value: "comparison", label: "组装比较" },
  { value: "sequence", label: "序列统计" },
  { value: "expression", label: "基因表达" },
  { value: "function", label: "功能注释" },
  { value: "variants", label: "遗传变异" },
];
export function resultMetrics(result: AnalysisResult) {
  return result.visuals.metrics.map((item) => {
    const field =
      item.label === "实验批次"
        ? "batch"
        : item.label === "通过质控"
          ? "quality_flag"
          : undefined;
    if (
      result.filteredCount > 0 &&
      field &&
      result.fields.find((f) => f.name === field)?.n === 0
    )
      return {
        ...item,
        value: "未提供",
        note:
          field === "batch" ? "原始资料未登记批次" : "原始资料未登记质检结果",
      };
    return {
      ...item,
      note: item.note.replace(
        "仅quality_flag=pass",
        "仅统计明确登记为通过的记录",
      ),
    };
  });
}
export function resultSummary(result: AnalysisResult) {
  const n = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 3 });
  const lines = [
    `当前数据包含${n.format(result.total)}条记录，本次筛选纳入${n.format(result.filteredCount)}条。`,
  ];
  const metrics = resultMetrics(result);
  if (metrics.length)
    lines.push(metrics.map((m) => `${m.label}${m.value}`).join("，") + "。");
  const profile = result.fields.find(
    (f) => f.name === result.query.metric && f.numeric,
  );
  if (profile?.n && profile.mean != null)
    lines.push(
      `${fieldLabel(profile.name)}有${profile.n}个有效值，均值为${n.format(profile.mean)}，中位数为${n.format(profile.median ?? 0)}，范围为${n.format(profile.min ?? 0)}—${n.format(profile.max ?? 0)}${result.measurementUnit ? `（${result.measurementUnit}）` : ""}。`,
    );
  if (result.correlation != null)
    lines.push(
      `${fieldLabel(result.query.xField)}与${fieldLabel(result.query.yField)}的Pearson相关系数为${n.format(result.correlation)}，有效配对${result.pairedCount}组；相关性不代表因果关系。`,
    );
  if (result.kind === "expression")
    lines.push(
      "热图展示基因在各样本中的表达模式，相关矩阵比较样本表达的一致性；本页提供描述性分析，未进行差异表达检验。",
    );
  if (result.kind === "function")
    lines.push(
      "功能条目可共享同一基因，连线表示共同注释，不能将各条目数量相加作为基因总数。",
    );
  if (result.kind === "variants")
    lines.push(
      "变异位置按染色体分别展示；记录数与独立位点数分别统计，不由这些记录推断群体遗传差异。",
    );
  return lines;
}

export const escapeHtml = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function reportDocument(
  title: string,
  paragraphs: string[],
  scope: HTMLElement | null,
  source = "",
) {
  const figures = [
    ...(scope?.querySelectorAll(
      ".analysis-chart-card, .analysis-genome-circle",
    ) ?? []),
  ]
    .filter((e) => e.getBoundingClientRect().width > 0)
    .map((e) => {
      const svg = e.matches("svg") ? e : e.querySelector("svg");
      if (!svg) return "";
      const copy = svg.cloneNode(true) as SVGElement;
      copy.style.position = "static";
      copy.style.maxWidth = "100%";
      return `<figure><figcaption>${escapeHtml(e.querySelector("h3")?.textContent ?? "分析图")}</figcaption>${new XMLSerializer().serializeToString(copy)}</figure>`;
    })
    .join("");
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:15px/1.8 'Microsoft YaHei',sans-serif;max-width:1100px;margin:36px auto;padding:0 24px;color:#244a44}h1{border-bottom:3px solid #21a98f}figure{margin:24px 0;break-inside:avoid}svg{max-width:100%;height:auto}small{color:#60746e}@media print{body{margin:0}}</style><h1>${escapeHtml(title)}</h1><small>${escapeHtml(source)} · ${new Date().toLocaleString("zh-CN")}</small>${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}${figures}<p><small>图表保留当前筛选和显示范围。此报告可在浏览器中打印或另存为PDF。</small></p></html>`;
}

export const filterLabel = (op: string) =>
  (
    ({
      eq: "等于",
      contains: "包含",
      gte: "不小于",
      lte: "不大于",
      missing: "未填写",
    }) as Record<string, string>
  )[op] ?? op;
