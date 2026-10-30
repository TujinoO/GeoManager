import {
  Alert,
  App,
  Button,
  Empty,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Segmented,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import type {
  GenomeAssemblyItem,
  GenomeSummary,
  GenomeGeneList,
  GenomeGeneDetail,
  GenomeSequenceResult,
} from "../../api/generated/types.gen";
import { analysisApi, downloadBlob } from "../../api/analysis";
import AnalysisChart from "../../components/AnalysisChart";
import { Metric } from "./TableAnalysisPanel";
import GenomeCircle from "./GenomeCircle";

import AnalysisDownloads from "./AnalysisDownloads";
import { displayValue } from "./presentation";

const n = (v: number) =>
  v.toLocaleString("zh-CN", { maximumFractionDigits: 2 });

export default function GenomeAnalysisPanel({
  assemblyId,
  mode,
  canExport,
}: {
  assemblyId: number;
  mode: "genome" | "browser";
  canExport: boolean;
}) {
  const { message } = App.useApp();
  const reportRef = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<GenomeSummary | null>(null);
  const [error, setError] = useState("");
  const [queryError, setQueryError] = useState("");
  const [loading, setLoading] = useState(false);
  const [seqid, setSeqid] = useState<string>();
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<{ start?: number; end?: number }>({});
  const [startDraft, setStartDraft] = useState<number | null>(1);
  const [endDraft, setEndDraft] = useState<number | null>(100000);
  const [offset, setOffset] = useState(0);
  const [genes, setGenes] = useState<GenomeGeneList | null>(null);
  const [selectedGene, setSelectedGene] = useState<string>();
  const [detail, setDetail] = useState<GenomeGeneDetail | null>(null);
  const [sequence, setSequence] = useState<GenomeSequenceResult | null>(null);
  const [sequenceError, setSequenceError] = useState("");
  const [sequenceRequest, setSequenceRequest] =
    useState<Record<string, string | number>>();
  const [refresh, setRefresh] = useState(0);
  const [atlasMode, setAtlasMode] = useState("circle");

  useEffect(() => {
    const abort = new AbortController();
    setSummary(null);
    setError("");
    analysisApi
      .summary(assemblyId, abort.signal)
      .then((s) => {
        if (abort.signal.aborted) return;
        setSummary(s);
        setSeqid(
          s.sequences.find((q) => q.name === "chr01")?.id ?? s.sequences[0]?.id,
        );
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : "组装读取失败");
      });
    return () => abort.abort();
  }, [assemblyId, refresh]);
  useEffect(() => {
    if (!summary) return;
    const abort = new AbortController();
    setLoading(true);
    setQueryError("");
    setGenes(null);
    setSelectedGene(undefined);
    setDetail(null);
    setSequence(null);
    analysisApi
      .genes(
        assemblyId,
        {
          q: search,
          seqid: search ? undefined : seqid,
          ...(search ? {} : range),
          offset,
          limit: 20,
        },
        abort.signal,
      )
      .then((g) => {
        if (abort.signal.aborted) return;
        setGenes(g);
        setSelectedGene(g.items[0]?.id);
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted)
          setQueryError(e instanceof Error ? e.message : "基因检索失败");
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [assemblyId, summary, search, seqid, range, offset]);
  useEffect(() => {
    setDetail(null);
    setSequence(null);
    setSequenceRequest(undefined);
    if (!selectedGene) return;
    const abort = new AbortController();
    analysisApi
      .gene(assemblyId, selectedGene, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setDetail(value);
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted)
          setQueryError(e instanceof Error ? e.message : "基因模型读取失败");
      });
    return () => abort.abort();
  }, [assemblyId, selectedGene]);
  useEffect(() => {
    setSequence(null);
    setSequenceError("");
    if (!sequenceRequest) return;
    const abort = new AbortController();
    analysisApi
      .sequence(assemblyId, sequenceRequest, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setSequence(value);
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted)
          setSequenceError(e instanceof Error ? e.message : "序列读取失败");
      });
    return () => abort.abort();
  }, [assemblyId, sequenceRequest]);

  const selected = summary?.sequences.find((s) => s.id === seqid);
  const chromosomes = useMemo(
    () =>
      (summary?.sequences ?? [])
        .filter((s) => /^chr\d+$/i.test(s.name))
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true }),
        ),
    [summary],
  );
  const maximum = Math.max(1, ...chromosomes.map((s) => s.length));
  const densityOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 70, right: 70, top: 30, bottom: 62 },
      tooltip: { trigger: "axis", confine: true, renderMode: "richText" },
      legend: { top: 0, textStyle: { color: "#5f7974" } },
      xAxis: {
        type: "category",
        data: selected?.bins.map((b) => n((b.start - 1) / 1e6)) ?? [],
        name: "Mb",
      },
      yAxis: [
        { type: "value", name: "基因/Mb" },
        { type: "value", name: "GC %", min: 0, max: 100 },
      ],
      series: [
        {
          name: "基因密度",
          type: "bar",
          data:
            selected?.bins.map(
              (b) => (b.geneCount * 1e6) / (b.end - b.start + 1),
            ) ?? [],
          itemStyle: { color: "#927dd7" },
        },
        {
          name: "GC",
          type: "line",
          yAxisIndex: 1,
          showSymbol: false,
          data:
            selected?.bins.map((b) => (b.gc == null ? null : b.gc * 100)) ?? [],
        },
      ],
      dataZoom: [{ type: "slider", bottom: 4 }],
    }),
    [selected],
  );
  const lengthOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 65, right: 25, top: 20, bottom: 65 },
      xAxis: {
        type: "category",
        data: chromosomes.map((s) => s.name.replace("chr", "")),
      },
      yAxis: { type: "value", name: "长度 / Mb" },
      series: [
        {
          type: "bar",
          data: chromosomes.map((s) => s.length / 1e6),
          itemStyle: { color: "#46a3d8", borderRadius: [5, 5, 0, 0] },
        },
      ],
    }),
    [chromosomes],
  );

  function chooseChromosome(id: string) {
    setSeqid(id);
    setSearch("");
    setKeyword("");
    setRange({});
    setOffset(0);
    const s = summary?.sequences.find((q) => q.id === id);
    setStartDraft(1);
    setEndDraft(Math.min(100000, s?.length ?? 100000));
  }
  function applyRange() {
    if (
      !selected ||
      startDraft == null ||
      endDraft == null ||
      startDraft < 1 ||
      endDraft < startDraft ||
      endDraft > selected.length
    ) {
      void message.warning("请填写染色体范围内的有效闭区间");
      return;
    }
    setSearch("");
    setKeyword("");
    setOffset(0);
    setRange({ start: startDraft, end: endDraft });
  }
  function zoom(factor: number) {
    const target =
      search && detail
        ? summary?.sequences.find((s) => s.id === detail.gene.seqid)
        : selected;
    if (!target) return;
    const start = (search ? undefined : range.start) ?? detail?.gene.start ?? 1,
      end =
        (search ? undefined : range.end) ??
        detail?.gene.end ??
        Math.min(target.length, 100000);
    const center = (start + end) / 2,
      width = Math.max(100, (end - start + 1) * factor);
    const a = Math.max(1, Math.floor(center - width / 2)),
      b = Math.min(target.length, Math.ceil(center + width / 2));
    setSeqid(target.id);
    setStartDraft(a);
    setEndDraft(b);
    setRange({ start: a, end: b });
    setSearch("");
    setKeyword("");
    setOffset(0);
  }
  if (error)
    return (
      <Alert
        type="error"
        title="基因组加载失败"
        description={error}
        action={<Button onClick={() => setRefresh((v) => v + 1)}>重试</Button>}
      />
    );
  if (!summary)
    return (
      <div className="analysis-loading">
        <Spin />
      </div>
    );
  return (
    <div className="analysis-genome" ref={reportRef}>
      <div className="analysis-source-line">
        <span>
          {summary.assembly.code} · {displayValue(summary.assembly.sex)} ·
          坐标包含起止碱基
        </span>
        <AnalysisDownloads
          title={summary.assembly.name}
          paragraphs={[
            `该参考组装包含${n(summary.totalBp)} bp、${summary.sequenceCount}条序列、${summary.chromosomeCount}条命名染色体。`,
            `注释基因模型${n(summary.geneCount)}个，配套蛋白${n(summary.proteinCount)}条，GC含量${summary.gc == null ? "未计算" : n(summary.gc * 100)}%。`,
            "图谱展示染色体长度、基因起点密度和GC变化，基因结构可按编号或区间检索。",
          ]}
          source={summary.sourceUrl}
          scope={() => reportRef.current}
          disabled={!canExport}
        />
      </div>
      <section className="analysis-summary">
        <h3>结果概述</h3>
        <p>
          该参考组装总长 {n(summary.totalBp)} bp，包含 {n(summary.geneCount)}{" "}
          个基因模型与 {n(summary.proteinCount)}{" "}
          条蛋白序列。图谱展示染色体结构及序列组成，基因结构页面可用于定位基因并读取配套序列。
        </p>
      </section>
      {mode === "genome" && (
        <>
          <div className="analysis-metrics">
            <Metric
              label="基因组长度"
              value={`${n(summary.totalBp / 1e6)} Mb`}
              note={`${n(summary.sequenceCount)} 条序列 · ${n(summary.chromosomeCount)} 条命名染色体`}
            />
            <Metric
              label="基因模型 / 蛋白"
              value={`${n(summary.geneCount)} / ${n(summary.proteinCount)}`}
              note={`转录本 ${n(summary.transcriptCount)}`}
            />
            <Metric
              label="FASTA序列N50"
              value={`${n(summary.sequenceN50 / 1e6)} Mb`}
              note="按整条FASTA序列计算"
            />
            <Metric
              label="GC含量"
              value={summary.gc == null ? "—" : `${n(summary.gc * 100)}%`}
              note={`分母ACGT · N碱基 ${n(summary.nCount)}`}
            />
          </div>
          <div className="analysis-atlas-switch">
            <Segmented
              aria-label="基因组图谱形式"
              value={atlasMode}
              onChange={(value) => setAtlasMode(String(value))}
              options={[
                { label: "环形多轨道", value: "circle" },
                { label: "线性染色体", value: "linear" },
              ]}
            />
          </div>
          {atlasMode === "circle" ? (
            <GenomeCircle
              sequences={chromosomes}
              selectedId={seqid}
              onSelect={chooseChromosome}
              canExport={canExport}
              code={summary.assembly.code}
            />
          ) : (
            <section className="analysis-card">
              <div className="analysis-card-heading">
                <h3>全基因组图谱</h3>
                <p>
                  长度表示染色体规模，颜色表示每Mb基因起点密度。点击或键盘选择后查看下方窗口。
                </p>
              </div>
              <div className="analysis-karyotype-scroll">
                <svg
                  className="analysis-karyotype"
                  viewBox={`0 0 ${Math.max(760, chromosomes.length * 47 + 100)} 370`}
                  role="img"
                  aria-label="可选择的染色体图谱"
                >
                  <text x="10" y="30" fill="#5f7974" fontSize="12">
                    Mb
                  </text>
                  {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                    <g key={t}>
                      <line
                        x1="55"
                        y1={45 + t * 255}
                        x2={Math.max(740, chromosomes.length * 47 + 80)}
                        y2={45 + t * 255}
                        stroke="#d8e9e1"
                      />
                      <text x="8" y={49 + t * 255} fill="#5f7974" fontSize="12">
                        {n((maximum * t) / 1e6)}
                      </text>
                    </g>
                  ))}
                  {chromosomes.map((s, i) => (
                    <g
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`选择${s.name}`}
                      onClick={() => chooseChromosome(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          chooseChromosome(s.id);
                        }
                      }}
                      className="analysis-chromosome"
                    >
                      <title>
                        {s.name} · {n(s.length)} bp · {s.geneCount} genes
                      </title>
                      <rect
                        x={70 + i * 47}
                        y="45"
                        width="24"
                        height={(255 * s.length) / maximum}
                        rx="7"
                        fill="#e4ecf3"
                        stroke={s.id === seqid ? "#128d81" : "#9cbbaf"}
                        strokeWidth={s.id === seqid ? 3 : 1}
                      />
                      {s.bins.map((b) => (
                        <rect
                          key={b.start}
                          x={72 + i * 47}
                          y={46 + ((b.start - 1) / maximum) * 255}
                          width="20"
                          height={Math.max(
                            0.5,
                            ((b.end - b.start + 1) / maximum) * 254,
                          )}
                          fill={`rgba(120,102,190,${Math.min(1, 0.15 + (b.geneCount * 1e6) / (b.end - b.start + 1) / 180)})`}
                        />
                      ))}
                      <text
                        x={82 + i * 47}
                        y="327"
                        textAnchor="middle"
                        fill="#225c52"
                        fontSize="12"
                      >
                        {s.name.replace("chr", "")}
                      </text>
                      <text
                        x={82 + i * 47}
                        y="347"
                        textAnchor="middle"
                        fill="#5f7974"
                        fontSize="10"
                      >
                        {n(s.length / 1e6)}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </section>
          )}
          <div className="analysis-chart-grid">
            <AnalysisChart
              title={`${selected?.name ?? "序列"} · GC与基因密度`}
              subtitle="基因按起点入箱；末窗口按实际长度归一化"
              option={densityOption}
              canExport={canExport}
            />
            <AnalysisChart
              title="命名染色体长度"
              subtitle="其他序列保留在下方明细中"
              option={lengthOption}
              canExport={canExport}
            />
          </div>
        </>
      )}
      <section className="analysis-card">
        <div className="analysis-toolbar">
          <Select
            aria-label="染色体选择"
            showSearch
            optionFilterProp="label"
            value={seqid}
            options={summary.sequences.map((s) => ({
              label: `${s.name} · ${n(s.length)} bp`,
              value: s.id,
            }))}
            onChange={chooseChromosome}
          />
          <Input.Search
            aria-label="全量基因检索"
            placeholder="原始 / GWH / 转录本 / 蛋白编号（跨染色体）"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={(s) => {
              setSearch(s.trim());
              setOffset(0);
            }}
            allowClear
          />
        </div>
        <div className="analysis-toolbar">
          <InputNumber
            aria-label="区间起点"
            value={startDraft}
            min={1}
            max={selected?.length}
            precision={0}
            onChange={setStartDraft}
          />
          <span>—</span>
          <InputNumber
            aria-label="区间终点"
            value={endDraft}
            min={1}
            max={selected?.length}
            precision={0}
            onChange={setEndDraft}
          />
          <Button onClick={applyRange}>定位区间</Button>
          <Button onClick={() => zoom(0.5)}>放大区间</Button>
          <Button onClick={() => zoom(2)}>缩小区间</Button>
          <Button
            onClick={() => {
              setRange({});
              setSearch("");
              setKeyword("");
              setOffset(0);
            }}
          >
            整条序列
          </Button>
        </div>
        {search && <Tag>跨染色体编号检索：{search}</Tag>}
        {range.start && (
          <Tag>
            区间：{n(range.start)}–{n(range.end ?? 0)} bp
          </Tag>
        )}
        {queryError && <Alert type="error" title={queryError} />}
        <Table
          size="small"
          rowKey="id"
          loading={loading}
          dataSource={genes?.items ?? []}
          scroll={{ x: 720 }}
          rowSelection={{
            type: "radio",
            selectedRowKeys: selectedGene ? [selectedGene] : [],
            onChange: (keys) => setSelectedGene(String(keys[0])),
          }}
          onRow={(row) => ({ onClick: () => setSelectedGene(row.id) })}
          columns={[
            {
              title: "原始基因编号",
              dataIndex: "id",
              width: 180,
              ellipsis: true,
            },
            {
              title: "GWH编号",
              dataIndex: "accession",
              width: 170,
              ellipsis: true,
            },
            { title: "序列", dataIndex: "seqid", width: 180, ellipsis: true },
            { title: "起点 bp", dataIndex: "start", render: n },
            { title: "终点 bp", dataIndex: "end", render: n },
            { title: "链", dataIndex: "strand", width: 50 },
            { title: "蛋白", dataIndex: "proteinCount", width: 65 },
          ]}
          pagination={{
            current: Math.floor(offset / 20) + 1,
            total: genes?.total,
            pageSize: 20,
            showSizeChanger: false,
            onChange: (page) => setOffset((page - 1) * 20),
            showTotal: (total) => `命中 ${n(total)} 个基因模型`,
          }}
        />
      </section>
      {detail ? (
        <section className="analysis-card">
          <div className="analysis-card-heading">
            <h3>{detail.gene.id} · 基因结构</h3>
            <p>
              {detail.gene.seqid}：{n(detail.gene.start)}–{n(detail.gene.end)}{" "}
              bp · {detail.gene.strand}链 · 原始注释的所有转录本与子特征
            </p>
          </div>
          <GeneTracks detail={detail} />
          <Space wrap>
            <Button
              onClick={() =>
                setSequenceRequest({
                  role: "genome",
                  seqid: detail.gene.seqid,
                  start: detail.gene.start,
                  end: Math.min(detail.gene.end, detail.gene.start + 999),
                  strand: detail.gene.strand === "-" ? "-" : "+",
                })
              }
            >
              查看基因DNA（最多1000bp）
            </Button>
            {detail.sequences.map((s) => (
              <Button
                key={`${s.role}:${s.id}`}
                onClick={() =>
                  setSequenceRequest({
                    role: s.role,
                    seqid: s.id,
                    start: 1,
                    end: Math.min(s.length, 100000),
                  })
                }
              >
                {displayValue(s.role)} · {s.id} · {n(s.length)}
                {s.role === "protein" ? " aa" : " nt"}
              </Button>
            ))}
          </Space>
          {detail.sequences.length === 0 && (
            <Alert
              type="info"
              title="该模型没有已配套的蛋白/CDS/RNA序列，结构注释保留"
            />
          )}
          {sequenceError && <Alert type="error" title={sequenceError} />}
          {sequence && (
            <div className="analysis-sequence">
              <div className="analysis-source-line">
                <span>
                  {sequence.id} · {displayValue(sequence.role)} ·{" "}
                  {sequence.start}–{sequence.end} · {sequence.strand} · 全长{" "}
                  {n(sequence.length)}
                </span>
                <Button
                  size="small"
                  disabled={!canExport}
                  onClick={() =>
                    downloadBlob(
                      new Blob(
                        [
                          `>${sequence.id} role=${displayValue(sequence.role)} region=${sequence.start}-${sequence.end} strand=${sequence.strand}\n${sequence.sequence.match(/.{1,80}/g)?.join("\n") ?? ""}\n`,
                        ],
                        { type: "text/plain" },
                      ),
                      `${sequence.id}.fasta`,
                    )
                  }
                >
                  下载当前序列FASTA
                </Button>
              </div>
              <pre>{sequence.sequence}</pre>
            </div>
          )}
        </section>
      ) : genes?.total === 0 ? (
        <Empty description="该范围或编号没有基因模型，不补造注释" />
      ) : null}
      {summary.warnings.length > 0 && (
        <Alert
          type="warning"
          title="数据配套与完整性说明"
          description={summary.warnings.join("；")}
        />
      )}
      <details className="analysis-card">
        <summary>全部序列与来源文件（含其他序列）</summary>
        <Table
          rowKey="id"
          size="small"
          scroll={{ x: 650 }}
          dataSource={summary.sequences}
          columns={[
            { title: "序列ID", dataIndex: "id", ellipsis: true },
            { title: "别名", dataIndex: "name", ellipsis: true },
            { title: "长度 bp", dataIndex: "length", render: n },
            { title: "基因", dataIndex: "geneCount" },
          ]}
          pagination={{ pageSize: 10 }}
        />
        <p className="analysis-break">
          来源：{summary.sourceUrl || "用户上传"}
        </p>
        {summary.files.map((f) => (
          <p key={f.role} className="analysis-break">
            <Tag>{displayValue(f.role)}</Tag>
            {f.name} · {n(f.size / 1024 / 1024)} MiB
          </p>
        ))}
      </details>
    </div>
  );
}

function GeneTracks({ detail }: { detail: GenomeGeneDetail }) {
  const g = detail.gene,
    width = Math.max(1, g.end - g.start + 1),
    x = (start: number) => 170 + ((start - g.start) / width) * 760;
  const tracks = [
    ...new Set(
      detail.features
        .filter((f) => !["gene", "mRNA", "transcript"].includes(f.type))
        .map((f) => `${f.parent || g.id} · ${f.type}`),
    ),
  ];
  return (
    <div className="analysis-gene-scroll">
      <svg
        viewBox={`0 0 1000 ${Math.max(120, tracks.length * 36 + 64)}`}
        className="analysis-gene-tracks"
        role="img"
        aria-label={`${g.id}的外显子与CDS轨道`}
      >
        <text x="170" y="20" fill="#5f7974" fontSize="12">
          {g.start} bp
        </text>
        <text x="930" y="20" textAnchor="end" fill="#5f7974" fontSize="12">
          {g.end} bp · {g.strand === "-" ? "← 负链" : "正链 →"}
        </text>
        {tracks.map((track, i) => (
          <g key={track}>
            <text x="4" y={58 + i * 36} fill="#5f7974" fontSize="11">
              <title>{track}</title>
              {track.length > 23 ? track.slice(0, 21) + "…" : track}
            </text>
            <line
              x1="170"
              x2="930"
              y1={53 + i * 36}
              y2={53 + i * 36}
              stroke="#a9c7bc"
            />
            {detail.features
              .filter((f) => `${f.parent || g.id} · ${f.type}` === track)
              .map((f) => (
                <rect
                  key={`${f.id}:${f.parent}:${f.type}:${f.start}:${f.end}`}
                  x={x(f.start)}
                  y={44 + i * 36}
                  width={Math.max(1, ((f.end - f.start + 1) / width) * 760)}
                  height="18"
                  rx="3"
                  fill={f.type === "CDS" ? "#16b8a9" : "#927dd7"}
                >
                  <title>
                    {f.type}: {f.start}–{f.end}; phase={f.phase}; {f.strand}
                  </title>
                </rect>
              ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function GenomeComparison({
  assemblies,
  canExport,
}: {
  assemblies: GenomeAssemblyItem[];
  canExport: boolean;
}) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState<number | undefined>(assemblies[0]?.id);
  const [right, setRight] = useState<number | undefined>(
    assemblies.find(
      (a) => a.id !== assemblies[0]?.id && a.sex !== assemblies[0]?.sex,
    )?.id ?? assemblies[1]?.id,
  );
  const [data, setData] = useState<GenomeSummary[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const first = assemblies.find((a) => a.id === left) ?? assemblies[0];
    if (first?.id !== left) setLeft(first?.id);
    if (!assemblies.some((a) => a.id === right))
      setRight(
        assemblies.find((a) => a.id !== first?.id && a.sex !== first?.sex)
          ?.id ?? assemblies.find((a) => a.id !== first?.id)?.id,
      );
  }, [assemblies, left, right]);
  useEffect(() => {
    setData([]);
    setError("");
    if (!left || !right || left === right) return;
    const abort = new AbortController();
    Promise.all([
      analysisApi.summary(left, abort.signal),
      analysisApi.summary(right, abort.signal),
    ])
      .then((value) => {
        if (!abort.signal.aborted) setData(value);
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : "对照读取失败");
      });
    return () => abort.abort();
  }, [left, right]);
  const option = useMemo<EChartsOption>(
    () => ({
      legend: { top: 0, textStyle: { color: "#5f7974" } },
      grid: { left: 60, right: 25, top: 45, bottom: 60 },
      xAxis: {
        type: "category",
        data: Array.from({ length: 19 }, (_, i) =>
          String(i + 1).padStart(2, "0"),
        ),
      },
      yAxis: { type: "value", name: "长度 / Mb" },
      series: data.map((d) => ({
        name: d.assembly.code,
        type: "bar",
        data: Array.from({ length: 19 }, (_, i) => {
          const length = d.sequences.find(
            (s) => s.name === `chr${String(i + 1).padStart(2, "0")}`,
          )?.length;
          return length == null ? null : length / 1e6;
        }),
      })),
    }),
    [data],
  );
  return (
    <div ref={reportRef}>
      <div className="analysis-toolbar">
        <Select
          aria-label="对照组装一"
          value={left}
          options={assemblies.map((a) => ({ label: a.code, value: a.id }))}
          onChange={setLeft}
        />
        <span>与</span>
        <Select
          aria-label="对照组装二"
          value={right}
          options={assemblies.map((a) => ({ label: a.code, value: a.id }))}
          onChange={setRight}
        />
        <AnalysisDownloads
          title="参考组装比较"
          paragraphs={
            data.length === 2
              ? data
                  .map(
                    (d) =>
                      `${d.assembly.code}：总长${n(d.totalBp)} bp，${n(d.geneCount)}个基因模型，${n(d.proteinCount)}条蛋白序列。`,
                  )
                  .concat(
                    "同名染色体按名称比较长度；没有序列比对时不推断同源关系或群体性别差异。",
                  )
              : []
          }
          source={data.map((d) => d.sourceUrl).join("；")}
          scope={() => reportRef.current}
          disabled={!canExport || data.length !== 2}
        />
      </div>
      <Alert
        type="info"
        title="两套参考组装统计对照"
        description="同名染色体仅用于长度分类对照。当前没有比对区段，不绘制共线性带；不能据此推断雌雄群体差异。"
      />
      {left === right ? (
        <Alert type="warning" title="请选择两套不同的组装" />
      ) : error ? (
        <Alert type="error" title={error} />
      ) : data.length === 2 ? (
        <>
          <AnalysisChart
            title="命名染色体长度对照"
            subtitle="Mb · 两组柱表示各自组装长度，无坐标对应假设"
            option={option}
            canExport={canExport}
          />
          <section className="analysis-card">
            <Table
              size="small"
              rowKey="metric"
              pagination={false}
              scroll={{ x: 600 }}
              dataSource={[
                {
                  metric: "组装长度 bp",
                  a: n(data[0]!.totalBp),
                  b: n(data[1]!.totalBp),
                },
                {
                  metric: "全部序列条数",
                  a: n(data[0]!.sequenceCount),
                  b: n(data[1]!.sequenceCount),
                },
                {
                  metric: "基因模型数",
                  a: n(data[0]!.geneCount),
                  b: n(data[1]!.geneCount),
                },
                {
                  metric: "蛋白条目数",
                  a: n(data[0]!.proteinCount),
                  b: n(data[1]!.proteinCount),
                },
                {
                  metric: "FASTA序列N50 bp",
                  a: n(data[0]!.sequenceN50),
                  b: n(data[1]!.sequenceN50),
                },
                {
                  metric: "GC（ACGT分母）",
                  a: data[0]!.gc == null ? "—" : n(data[0]!.gc * 100) + "%",
                  b: data[1]!.gc == null ? "—" : n(data[1]!.gc * 100) + "%",
                },
              ]}
              columns={[
                { title: "指标", dataIndex: "metric" },
                { title: data[0]!.assembly.code, dataIndex: "a" },
                { title: data[1]!.assembly.code, dataIndex: "b" },
              ]}
            />
          </section>
        </>
      ) : assemblies.length < 2 ? (
        <Empty description="请先接入至少两套参考组装" />
      ) : (
        <div className="analysis-loading">
          <Spin />
        </div>
      )}
    </div>
  );
}
