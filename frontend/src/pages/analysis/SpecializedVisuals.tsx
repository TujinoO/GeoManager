import { useMemo, useState } from "react";
import { Segmented, Empty } from "antd";
import type { EChartsOption } from "echarts";
import type {
  AnalysisResult,
  AnalysisMatrix,
} from "../../api/generated/types.gen";
import AnalysisChart from "../../components/AnalysisChart";

import { fieldLabel, displayValue } from "./presentation";

const palette = [
  "#258f80",
  "#6c9ec2",
  "#9b8cc2",
  "#c5a16a",
  "#81b6a1",
  "#c9868c",
];
const grid = {
  left: 70,
  right: 35,
  top: 30,
  bottom: 65,
  outerBoundsMode: "same" as const,
  outerBoundsContain: "axisLabel" as const,
};
const axisLabel = {
  color: "#648078",
  fontSize: 11,
  width: 100,
  overflow: "truncate" as const,
};

export function rowStandardize(cells: AnalysisResult["heatmap"]) {
  const groups = new Map<string, number[]>();
  cells.forEach((c) => {
    if (c.value != null) groups.set(c.y, [...(groups.get(c.y) ?? []), c.value]);
  });
  return cells.map((c) => {
    const values = groups.get(c.y) ?? [];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(
      values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length,
    );
    return {
      ...c,
      value: c.value == null || !sd ? null : (c.value - mean) / sd,
    };
  });
}

export function matrixOption(matrix: AnalysisMatrix): EChartsOption {
  const xs = [...new Set(matrix.cells.map((c) => c.x))],
    ys = [...new Set(matrix.cells.map((c) => c.y))];
  const correlation = matrix.id === "sampleCorrelation";
  return {
    grid: { left: 108, right: 30, top: 26, bottom: 116 },
    xAxis: {
      type: "category",
      data: xs,
      axisLabel: { ...axisLabel, rotate: 40 },
    },
    yAxis: {
      type: "category",
      data: ys,
      axisLabel,
      splitArea: { show: true, areaStyle: { color: ["#f5f8f6"] } },
    },
    visualMap: {
      dimension: 2,
      min: correlation ? -1 : 0,
      max: correlation
        ? 1
        : Math.max(1, ...matrix.cells.map((c) => c.value ?? 0)),
      orient: "horizontal",
      left: "center",
      bottom: 6,
      itemWidth: 12,
      itemHeight: 120,
      text: correlation ? ["r = 1", "r = −1"] : ["记录数", "0"],
      inRange: {
        color: correlation
          ? ["#9a86be", "#f7faf8", "#238e80"]
          : ["#edf5f0", "#a8d4bd", "#288f81"],
      },
    },
    series: [
      {
        type: "heatmap",
        dimensions: [
          "列",
          "行",
          correlation ? "Pearson r" : "记录数",
          "有效数",
        ],
        encode: { x: 0, y: 1, tooltip: [2, 3] },
        data: matrix.cells
          .filter((c) => c.value != null)
          .map((c) => [xs.indexOf(c.x), ys.indexOf(c.y), c.value, c.n]),
        itemStyle: { borderWidth: 2, borderColor: "#ffffff", borderRadius: 2 },
        emphasis: { itemStyle: { borderColor: "#315953", borderWidth: 1 } },
      },
    ],
  };
}

export default function SpecializedVisuals({
  result,
  canExport,
}: {
  result: AnalysisResult;
  canExport: boolean;
}) {
  const [heatScale, setHeatScale] = useState("log");
  const v = result.visuals;
  const flowStageSizes = new Map<string, Set<string>>();
  v.flows
    .flatMap((f) => [f.source, f.target])
    .forEach((name) => {
      const stage = name.split(" · ")[0] ?? name;
      const nodes = flowStageSizes.get(stage) ?? new Set<string>();
      nodes.add(name);
      flowStageSizes.set(stage, nodes);
    });
  const flowMinimumWidth = Math.max(
    0,
    ...[...flowStageSizes.values()].map((nodes) =>
      nodes.size > 4 ? nodes.size * 90 : 0,
    ),
  );
  const box = useMemo<EChartsOption>(
    () => ({
      grid,
      xAxis: {
        type: "category",
        data: v.boxes.map((b) => displayValue(b.label)),
        axisLabel: { ...axisLabel, rotate: 15 },
      },
      yAxis: {
        type: "value",
        name: fieldLabel(result.query.metric),
        nameTruncate: { maxWidth: 100 },
        scale: true,
      },
      series: [
        {
          type: "boxplot",
          name: "最小 / Q1 / 中位 / Q3 / 最大",
          data: v.boxes.map((b, i) => ({
            name: `${b.label} · n=${b.n}`,
            value: [b.min, b.q1, b.median, b.q3, b.max],
            itemStyle: {
              color: palette[i % palette.length] + "35",
              borderColor: palette[i % palette.length],
              borderWidth: 1.5,
            },
          })),
          boxWidth: [12, 38],
        },
      ],
    }),
    [v.boxes, result.query.metric],
  );
  const flow = useMemo<EChartsOption>(
    () => ({
      color: palette,
      media: [
        {
          query: { maxWidth: 420 },
          option: {
            series: [
              {
                orient: "vertical",
                left: 8,
                right: 8,
                top: 46,
                bottom: 28,
                nodeWidth: 7,
                nodeGap: 22,
                label: {
                  position: "top",
                  fontSize: 10,
                  width: 78,
                  overflow: "truncate",
                },
              },
            ],
          },
        },
      ],
      series: [
        {
          type: "sankey",
          left: 10,
          right: 130,
          top: 32,
          bottom: 20,
          nodeWidth: 8,
          nodeGap: 22,
          draggable: false,
          layoutIterations: 32,
          data: [...new Set(v.flows.flatMap((f) => [f.source, f.target]))].map(
            (name) => ({ name }),
          ),
          links: v.flows,
          lineStyle: { color: "gradient", opacity: 0.22, curveness: 0.5 },
          itemStyle: { borderWidth: 0, borderRadius: 3 },
          label: {
            color: "#48695f",
            fontSize: 11,
            width: 115,
            overflow: "truncate",
          },
          emphasis: { focus: "adjacency", lineStyle: { opacity: 0.6 } },
        },
      ],
    }),
    [v.flows],
  );
  const network = useMemo<EChartsOption>(() => {
    const dbs = [...new Set(v.nodes.map((n) => n.category))];
    const max = Math.max(1, ...v.nodes.map((n) => n.value));
    const nodes = v.nodes.map((n, i) => ({
      id: n.id,
      name: n.label,
      value: n.value,
      symbolSize: 22 + 34 * Math.sqrt(n.value / max),
      label: { show: i < 8 },
      category: dbs.indexOf(n.category),
      itemStyle: {
        borderWidth: 3,
        borderColor: "#fff",
        shadowBlur: 8,
        shadowColor: "#174c3210",
      },
    }));
    return {
      color: palette,
      media: [
        {
          query: { maxWidth: 420 },
          option: {
            series: [
              {
                left: 35,
                right: 90,
                top: 60,
                bottom: 70,
                label: { width: 60, fontSize: 10 },
                data: nodes.map((node) => ({
                  ...node,
                  symbolSize: 10 + 14 * Math.sqrt(node.value / max),
                })),
              },
            ],
          },
        },
      ],
      legend: { bottom: 0, data: dbs, textStyle: { color: "#648078" } },
      series: [
        {
          type: "graph",
          layout: "circular",
          circular: { rotateLabel: false },
          left: 105,
          right: 105,
          top: 65,
          bottom: 70,
          data: nodes,
          links: v.edges.map((e) => ({
            ...e,
            name: `共同基因 ${e.value} · Jaccard ${e.score.toFixed(3)}`,
            lineStyle: { width: 1 + e.score * 7, opacity: 0.25 },
          })),
          categories: dbs.map((name) => ({ name })),
          label: {
            show: true,
            position: "right",
            color: "#48695f",
            fontSize: 11,
            width: 88,
            overflow: "truncate",
          },
          lineStyle: { color: "#699c8e", curveness: 0.18 },
          emphasis: { focus: "adjacency", lineStyle: { opacity: 0.9 } },
        },
      ],
    };
  }, [v.nodes, v.edges]);
  const functionalCoverage = useMemo<EChartsOption>(
    () => ({
      color: palette,
      series: [
        {
          type: "treemap",
          left: 8,
          right: 8,
          top: 24,
          bottom: 24,
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          data: v.nodes.map((node) => ({
            name: node.label,
            value: node.value,
          })),
          label: {
            color: "#fff",
            fontSize: 12,
            formatter: "{b}\n{c} 个基因",
            lineHeight: 22,
            overflow: "truncate",
          },
          itemStyle: { borderColor: "#fff", borderWidth: 4, borderRadius: 3 },
          emphasis: { itemStyle: { borderColor: "#d6e6db" } },
        },
      ],
    }),
    [v.nodes],
  );
  const dots = useMemo<EChartsOption>(() => {
    const xs = [...new Set(v.dots.map((d) => d.x))],
      ys = [...new Set(v.dots.map((d) => d.y))];
    return {
      grid: { ...grid, left: 125, bottom: 90 },
      xAxis: { type: "category", data: xs, axisLabel },
      yAxis: { type: "category", data: ys, axisLabel },
      visualMap: {
        dimension: 2,
        min: 0,
        max: Math.max(1, ...v.dots.map((d) => d.value)),
        orient: "horizontal",
        left: "center",
        bottom: 5,
        itemHeight: 120,
        itemWidth: 10,
        inRange: { color: ["#cfe5d7", "#258f80", "#546eae"] },
        text: ["log2(均值+1)", "0"],
      },
      series: [
        {
          type: "scatter",
          dimensions: [
            "样本组",
            "基因",
            "log2(均值+1)",
            "正值比例",
            "有效样本数",
          ],
          encode: { x: 0, y: 1, tooltip: [2, 3, 4] },
          symbolSize: (value) => Math.max(3, Math.sqrt(value[3]) * 20),
          data: v.dots.map((d) => ({
            value: [xs.indexOf(d.x), ys.indexOf(d.y), d.value, d.fraction, d.n],
            itemStyle: {
              opacity: d.fraction === 0 ? 0.2 : 0.9,
              borderColor: "#618b7e",
              borderWidth: d.fraction === 0 ? 1 : 0,
            },
          })),
        },
      ],
    };
  }, [v.dots]);
  const heat = useMemo<EChartsOption>(() => {
    const cells =
      heatScale === "z" ? rowStandardize(result.heatmap) : result.heatmap;
    const xs = [...new Set(cells.map((d) => d.x))],
      ys = [...new Set(cells.map((d) => d.y))];
    return {
      grid: { left: 125, right: 28, top: 20, bottom: 106 },
      xAxis: {
        type: "category",
        data: xs,
        axisLabel: { ...axisLabel, rotate: 35 },
      },
      yAxis: {
        type: "category",
        data: ys,
        axisLabel,
        splitArea: { show: true, areaStyle: { color: ["#f4f7f5"] } },
      },
      visualMap: {
        min: heatScale === "z" ? -2.5 : 0,
        max:
          heatScale === "z"
            ? 2.5
            : Math.max(1, ...cells.map((d) => d.value ?? 0)),
        dimension: 2,
        orient: "horizontal",
        left: "center",
        bottom: 5,
        itemWidth: 12,
        itemHeight: 160,
        text:
          heatScale === "z" ? ["Z ≥ 2.5", "Z ≤ −2.5"] : ["log2(value+1)", "0"],
        inRange: {
          color:
            heatScale === "z"
              ? ["#9683b9", "#f5f9f6", "#2c9783"]
              : ["#edf5ef", "#a5d0b5", "#258f80", "#4f6f9f"],
        },
      },
      series: [
        {
          type: "heatmap",
          data: cells
            .filter((c) => c.value != null)
            .map((c) => [xs.indexOf(c.x), ys.indexOf(c.y), c.value]),
          itemStyle: {
            borderColor: "#ffffff",
            borderWidth: 1.5,
            borderRadius: 2,
          },
          emphasis: { itemStyle: { borderColor: "#456b60", borderWidth: 1 } },
        },
      ],
    };
  }, [result.heatmap, heatScale]);
  const positions = useMemo<EChartsOption>(() => {
    const chrs = [...new Set(v.variantBins.map((b) => b.chromosome))].sort(
      (a, b) => a.localeCompare(b, undefined, { numeric: true }),
    );
    const max = Math.max(1, ...v.variantBins.map((b) => b.count));
    const scale =
      Math.max(0, ...v.variantBins.map((b) => b.end)) < 1e6 ? 1e3 : 1e6;
    const coordinateUnit = scale === 1e3 ? "kb" : "Mb";
    return {
      grid: { ...grid, left: 82, bottom: 86 },
      xAxis: {
        type: "value",
        name: `导入坐标 / ${coordinateUnit}`,
        nameLocation: "middle",
        nameGap: 34,
        splitNumber: 4,
        axisLabel: { hideOverlap: true },
      },
      yAxis: { type: "category", data: chrs, axisLabel },
      visualMap: {
        dimension: 2,
        min: 0,
        max,
        orient: "horizontal",
        left: "center",
        bottom: 2,
        itemHeight: 120,
        itemWidth: 10,
        inRange: { color: ["#cee2d7", "#248e80"] },
        text: ["记录数", "0"],
      },
      series: [
        {
          type: "scatter",
          dimensions: [
            `位置${coordinateUnit}`,
            "染色体",
            "记录数",
            "起点bp",
            "终点bp",
          ],
          encode: { x: 0, y: 1, tooltip: [2, 3, 4] },
          symbolSize: (value) => 4 + 18 * Math.sqrt(value[2] / max),
          data: v.variantBins
            .filter((b) => b.count > 0)
            .map((b) => [
              (b.start + b.end) / (2 * scale),
              chrs.indexOf(b.chromosome),
              b.count,
              b.start,
              b.end,
            ]),
          itemStyle: { opacity: 0.85 },
        },
      ],
    };
  }, [v.variantBins]);
  const variants = useMemo<EChartsOption>(
    () => ({
      grid: { ...grid, left: 85 },
      xAxis: { type: "value", name: "记录数" },
      yAxis: {
        type: "category",
        data: v.variantClasses.map((c) => c.label).reverse(),
        axisLabel,
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 16,
          data: v.variantClasses
            .map((c, i) => ({
              value: c.count,
              itemStyle: {
                color: palette[i % palette.length],
                borderRadius: [0, 3, 3, 0],
              },
            }))
            .reverse(),
          label: { show: true, position: "right", color: "#648078" },
        },
      ],
    }),
    [v.variantClasses],
  );
  if (!v.metrics.length) return null;
  return (
    <div className="analysis-specialized">
      <div className="analysis-section-caption">
        <span>
          {
            (
              {
                traits: "群落与性状",
                samples: "样品结构",
                molecular: "测定分布",
                expression: "表达模式",
                function: "功能图谱",
                variants: "变异概貌",
                sequence: "序列长度与组成",
              } as Record<string, string>
            )[result.kind]
          }
        </span>
        <small>基于当前筛选 · 悬停查看数值 · 右上角可导出SVG</small>
      </div>
      {!!v.flows.length && (
        <AnalysisChart
          title="样品来源与材料构成"
          subtitle="来源 → 性别 → 材料；线宽表示样品数。窄屏转为纵向；类别较多时可横向滚动"
          option={flow}
          height={400}
          canExport={canExport}
          minimumWidth={flowMinimumWidth}
        />
      )}
      {result.kind === "expression" && (
        <AnalysisChart
          title="基因表达模式"
          subtitle={
            heatScale === "z"
              ? "各基因在当前显示样本内对log2表达做Z标准化；常数行和缺失留空；颜色截断于±2.5，无聚类排序"
              : "颜色为log2(value+1)；缺失留空；按原表顺序展示前40基因×24样品"
          }
          option={heat}
          height={Math.max(
            400,
            Math.min(
              850,
              new Set(result.heatmap.map((c) => c.y)).size * 17 + 130,
            ),
          )}
          canExport={canExport}
          extra={
            <Segmented
              aria-label="表达热图色标"
              size="small"
              value={heatScale}
              onChange={(v) => setHeatScale(String(v))}
              options={[
                { label: "log表达", value: "log" },
                { label: "行Z分数", value: "z" },
              ]}
            />
          }
        />
      )}
      {!!v.nodes.length && (
        <div className="analysis-chart-grid">
          <AnalysisChart
            title="功能共注释图谱"
            subtitle={`${v.nodes.length}个功能条目 · ${v.edges.length}条共同注释关系；节点为去重基因数，连线为共同基因数；前8节点显示标签，其余悬停查看`}
            option={network}
            height={390}
            canExport={canExport}
          />
          <AnalysisChart
            title="功能条目覆盖"
            subtitle="面积为各条目的去重基因数；可多重归属，不表示基因总数占比；前20条目"
            option={functionalCoverage}
            height={390}
            canExport={canExport}
          />
        </div>
      )}
      <div className="analysis-chart-grid">
        {!!v.boxes.length && (
          <AnalysisChart
            title={
              result.kind === "molecular"
                ? "批次测定分布"
                : result.kind === "variants"
                  ? "染色体质量分布"
                  : result.kind === "sequence"
                    ? "序列长度分布"
                    : "分组性状分布"
            }
            subtitle={`${fieldLabel(result.query.metric)} · 每组显示全部有效值的五数概括；悬停查看n与分位数`}
            option={box}
            height={350}
            canExport={canExport}
          />
        )}
        {v.matrices.map((m) => (
          <AnalysisChart
            key={m.id}
            title={m.title}
            subtitle={m.method}
            option={matrixOption(m)}
            height={Math.max(
              350,
              Math.min(640, new Set(m.cells.map((c) => c.y)).size * 19 + 150),
            )}
            canExport={canExport}
          />
        ))}
        {!!v.dots.length && (
          <AnalysisChart
            title="基因与样本组表达"
            subtitle="颜色：log2(均值+1) · 气泡面积：严格正值比例（0–100%）；悬停查看有效样本数"
            option={dots}
            height={Math.max(
              400,
              Math.min(640, new Set(v.dots.map((d) => d.y)).size * 19 + 130),
            )}
            canExport={canExport}
          />
        )}
        {!!v.variantBins.length && (
          <AnalysisChart
            title="染色体变异位置图"
            subtitle="坐标来自导入记录；每条染色体独立分箱，气泡面积为记录数"
            option={positions}
            height={350}
            canExport={canExport}
          />
        )}
        {!!v.variantClasses.length && (
          <AnalysisChart
            title="等位基因变化构成"
            subtitle="保留SNV替换方向，另列插入、缺失与复杂变异；按记录计数"
            option={variants}
            height={350}
            canExport={canExport}
          />
        )}
      </div>
      {!v.boxes.length && result.kind === "molecular" && (
        <Empty description="请先按marker筛选单一测定标记，再比较批次分布" />
      )}
      <details className="analysis-chart-notes">
        <summary>统计方法与显示范围</summary>
        {v.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </details>
    </div>
  );
}
