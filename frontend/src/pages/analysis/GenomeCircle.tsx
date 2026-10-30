import { useMemo, useRef } from "react";
import { Button } from "antd";
import type { GenomeSummary } from "../../api/generated/types.gen";
import { downloadBlob } from "../../api/analysis";

const point = (radius: number, angle: number) =>
  [320 + radius * Math.cos(angle), 292 + radius * Math.sin(angle)] as const;
function sector(inner: number, outer: number, start: number, end: number) {
  const a = point(outer, start),
    b = point(outer, end),
    c = point(inner, end),
    d = point(inner, start);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${a} A ${outer} ${outer} 0 ${large} 1 ${b} L ${c} A ${inner} ${inner} 0 ${large} 0 ${d} Z`;
}
const format = (n: number) =>
  n.toLocaleString("zh-CN", { maximumFractionDigits: 2 });

export default function GenomeCircle({
  sequences,
  selectedId,
  onSelect,
  canExport,
  code,
}: {
  sequences: GenomeSummary["sequences"];
  selectedId?: string;
  onSelect: (id: string) => void;
  canExport: boolean;
  code: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const tracks = useMemo(() => {
    const total = sequences.reduce((a, b) => a + b.length, 0),
      gap = 0.018;
    let angle = -Math.PI / 2;
    return sequences.map((s) => {
      const start = angle,
        end =
          start +
          ((Math.PI * 2 - gap * sequences.length) * s.length) /
            Math.max(1, total);
      angle = end + gap;
      return { ...s, start, end };
    });
  }, [sequences]);
  const maxDensity = Math.max(
    1,
    ...sequences.flatMap((s) =>
      s.bins.map((b) => (b.geneCount * 1e6) / (b.end - b.start + 1)),
    ),
  );
  const selected = sequences.find((s) => s.id === selectedId);
  function save() {
    if (!ref.current) return;
    downloadBlob(
      new Blob([new XMLSerializer().serializeToString(ref.current)], {
        type: "image/svg+xml;charset=utf-8",
      }),
      `${code}-circular-genome.svg`,
    );
  }
  return (
    <section className="analysis-card analysis-genome-atlas">
      <div className="analysis-card-heading">
        <div>
          <h3>染色体环形图谱</h3>
          <p>
            从外到内：染色体长度、基因起点密度、GC含量。点击染色体联动下方窗口。
          </p>
        </div>
        <Button size="small" disabled={!canExport} onClick={save}>
          导出SVG
        </Button>
      </div>
      <div className="analysis-atlas-layout">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          ref={ref}
          viewBox="0 0 640 634"
          className="analysis-genome-circle"
          role="img"
          aria-label="基因组长度、密度与GC环形图谱"
          style={{
            fontFamily: "Microsoft YaHei, sans-serif",
            background: "#ffffff",
          }}
        >
          <rect width="640" height="634" fill="#ffffff" rx="6" />
          {[165, 182.5, 200, 205, 225, 232, 245].map((radius) => (
            <circle
              key={radius}
              cx="320"
              cy="292"
              r={radius}
              fill="none"
              stroke="#e9f0ec"
              strokeWidth=".8"
            />
          ))}
          {tracks.map((s, i) => {
            const sweep = s.end - s.start,
              mid = (s.end + s.start) / 2,
              label = point(266, mid);
            return (
              <g
                key={s.id}
                className="analysis-circle-chromosome"
                role="button"
                tabIndex={0}
                aria-label={`环形图选择${s.name}`}
                onClick={() => onSelect(s.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(s.id);
                  }
                }}
              >
                <title>{`${s.name} · ${format(s.length / 1e6)} Mb · ${s.geneCount.toLocaleString()} genes`}</title>
                <path
                  d={sector(232, 245, s.start, s.end)}
                  fill={i % 2 === 0 ? "#5b9e8c" : "#87b5a5"}
                  stroke={selectedId === s.id ? "#225c52" : "#fff"}
                  strokeWidth={selectedId === s.id ? 2.5 : 0.7}
                />
                {s.bins.map((b) => {
                  const start = s.start + ((b.start - 1) / s.length) * sweep,
                    end = s.start + (b.end / s.length) * sweep;
                  const density = (b.geneCount * 1e6) / (b.end - b.start + 1);
                  return (
                    <g key={b.start}>
                      <title>{`${s.name}:${b.start}–${b.end} · ${format(density)} 基因/Mb · GC ${b.gc == null ? "未计算" : format(b.gc * 100) + "%"}`}</title>
                      <path
                        d={sector(205, 225, start, end)}
                        fill={`rgb(${Math.round(235 - (105 * density) / maxDensity)},${Math.round(232 - (125 * density) / maxDensity)},${Math.round(245 - (56 * density) / maxDensity)})`}
                      />
                      {b.gc != null && (
                        <path
                          d={sector(165, 165 + 35 * b.gc, start, end)}
                          fill="#589eb8"
                          opacity=".8"
                        />
                      )}
                    </g>
                  );
                })}
                {Array.from(
                  { length: Math.floor(s.length / 1e7) + 1 },
                  (_, j) => {
                    const a = s.start + ((j * 1e7) / s.length) * sweep,
                      p = point(247, a),
                      q = point(251, a);
                    return (
                      <line
                        key={j}
                        x1={p[0]}
                        y1={p[1]}
                        x2={q[0]}
                        y2={q[1]}
                        stroke="#8ca99d"
                        strokeWidth=".8"
                      />
                    );
                  },
                )}
                <text
                  className="analysis-circle-label"
                  x={label[0]}
                  y={label[1] + 4}
                  textAnchor="middle"
                  fill={selectedId === s.id ? "#225c52" : "#648078"}
                  fontSize="12"
                  fontWeight={selectedId === s.id ? 600 : 400}
                >
                  {s.name}
                </text>
              </g>
            );
          })}
          <text
            x="320"
            y="260"
            textAnchor="middle"
            fill="#7b938a"
            fontSize="12"
          >
            {selected?.name ?? "命名染色体"}
          </text>
          <text
            x="320"
            y="296"
            textAnchor="middle"
            fill="#225c52"
            fontSize="30"
            fontWeight="500"
          >
            {format(
              (selected?.length ??
                sequences.reduce((a, b) => a + b.length, 0)) / 1e6,
            )}
            <tspan fontSize="13"> Mb</tspan>
          </text>
          <line x1="278" x2="362" y1="313" y2="313" stroke="#c9ddd2" />
          <text
            x="320"
            y="341"
            textAnchor="middle"
            fill="#648078"
            fontSize="12"
          >
            {selected
              ? `${selected.geneCount.toLocaleString()} 个基因模型`
              : `${sequences.length} 条染色体`}
          </text>
          <line x1="140" x2="500" y1="584" y2="584" stroke="#e3ede8" />
          <text
            x="320"
            y="610"
            className="analysis-circle-caption"
            textAnchor="middle"
            fill="#7b938a"
            fontSize="11"
          >
            等比例染色体弧长 · 外圈每10 Mb刻度 · 无比对连接线
          </text>
        </svg>
        <aside className="analysis-atlas-key" aria-label="环形图图例">
          <div>
            <i style={{ background: "#68a290" }} />
            <strong>染色体</strong>
            <p>弧长对应bp长度。仅显示命名染色体，其他序列在明细中保留。</p>
          </div>
          <div>
            <i
              style={{ background: "linear-gradient(90deg,#ebe8f5,#826bbd)" }}
            />
            <strong>基因密度</strong>
            <p>
              每Mb基因起点数，共用色阶
              <br />0 — {format(maxDensity)} 基因/Mb
            </p>
          </div>
          <div>
            <i style={{ background: "#589eb8" }} />
            <strong>GC含量</strong>
            <p>轨道径向高度表示0–100%。分母为有效ACGT；缺失不填色。</p>
          </div>
          <span>1 Mb窗口 · 末窗口按实际长度计算</span>
        </aside>
      </div>
    </section>
  );
}
