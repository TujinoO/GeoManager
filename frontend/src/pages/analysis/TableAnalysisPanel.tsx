import {
  Alert,
  App,
  Button,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import type {
  AnalysisQuery,
  AnalysisResult,
  AnalysisFilter,
} from "../../api/generated/types.gen";
import { analysisApi, downloadBlob } from "../../api/analysis";
import AnalysisChart from "../../components/AnalysisChart";
import {
  fieldLabel,
  filterLabel,
  displayValue,
  resourceTitle,
  resultSummary,
  resultMetrics,
} from "./presentation";
import AnalysisDownloads from "./AnalysisDownloads";
import SpecializedVisuals from "./SpecializedVisuals";

const number = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("zh-CN", { maximumFractionDigits: 3 });
const grid = {
  left: 66,
  right: 26,
  top: 24,
  bottom: 64,
  outerBoundsMode: "same" as const,
  outerBoundsContain: "axisLabel" as const,
};

export default function TableAnalysisPanel({
  resourceId,
  initialQuery,
  canExport,
  onSaved,
}: {
  resourceId: number;
  initialQuery?: AnalysisQuery;
  canExport: boolean;
  onSaved: () => void;
}) {
  const reportRef = useRef<HTMLDivElement>(null);
  const { message } = App.useApp();
  const [query, setQuery] = useState<AnalysisQuery>(
    initialQuery ?? { limit: 30, offset: 0 },
  );
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState(initialQuery?.keyword ?? "");
  const [filterField, setFilterField] = useState<string>();
  const [filterOp, setFilterOp] = useState<AnalysisFilter["op"]>("eq");
  const [filterValue, setFilterValue] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setResult(null);
    analysisApi
      .query(resourceId, query, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setResult(value);
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : "分析失败");
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [resourceId, query]);

  const fields = result?.fields ?? [];
  const numeric = fields.filter((f) => f.numeric);
  const grouping = fields.filter(
    (f) =>
      !f.numeric && !["record_id", "result_id", "survey_date"].includes(f.name),
  );
  const metric = query.metric || result?.query.metric || numeric[0]?.name;
  const group =
    query.groupBy ||
    result?.query.groupBy ||
    fields.find((f) => !f.numeric)?.name;
  const tableRows = useMemo(
    () =>
      (result?.rows ?? []).map((row) => ({
        ...row,
        // getRandomValues also works on public HTTP origins, unlike randomUUID.
        _analysisRowKey: crypto.getRandomValues(new Uint32Array(4)).join("-"),
      })),
    [result?.rows],
  );
  const profile = numeric.find((f) => f.name === metric);
  const categories = result?.categories ?? [];
  const histogram = result?.histogram ?? [];
  const categoryOption = useMemo<EChartsOption>(
    () => ({
      grid: { ...grid, left: 115 },
      tooltip: { trigger: "axis", confine: true, renderMode: "richText" },
      xAxis: { type: "value", name: query.metric ? "均值" : "计数" },
      yAxis: {
        type: "category",
        data: categories.map((c) => c.label).reverse(),
        axisLabel: { width: 95, overflow: "truncate" },
      },
      series: [
        {
          type: "bar",
          data: categories.map((c) => c.value).reverse(),
          barMaxWidth: 20,
          itemStyle: { borderRadius: [0, 5, 5, 0] },
        },
      ],
      dataZoom:
        categories.length > 12
          ? [{ type: "slider", yAxisIndex: 0, right: 0, start: 60, end: 100 }]
          : [],
    }),
    [categories, query.metric],
  );
  const pieOption = useMemo<EChartsOption>(
    () => ({
      legend: { bottom: 0, type: "scroll", textStyle: { color: "#5f7974" } },
      series: [
        {
          type: "pie",
          radius: ["42%", "68%"],
          center: ["50%", "43%"],
          label: { show: false },
          data: categories.map((c) => ({ name: c.label, value: c.count })),
        },
      ],
    }),
    [categories],
  );
  const histogramOption = useMemo<EChartsOption>(
    () => ({
      grid,
      xAxis: {
        type: "category",
        name: fieldLabel(metric),
        nameLocation: "middle",
        nameGap: 42,
        nameTruncate: { maxWidth: 180 },
        data: histogram.map((b) => number(b.start)),
        axisLabel: { rotate: 25 },
      },
      yAxis: { type: "value", name: "记录数" },
      series: [
        {
          type: "bar",
          data: histogram.map((b) => b.count),
          barCategoryGap: "5%",
          itemStyle: { color: "#927dd7", borderRadius: [4, 4, 0, 0] },
        },
      ],
    }),
    [histogram, metric],
  );
  const scatterOption = useMemo<EChartsOption>(
    () => ({
      grid,
      xAxis: {
        type: "value",
        name: fieldLabel(query.xField),
        nameLocation: "middle",
        nameGap: 36,
        nameTruncate: { maxWidth: 140 },
        scale: true,
      },
      yAxis: {
        type: "value",
        name: fieldLabel(query.yField),
        nameTruncate: { maxWidth: 100 },
        scale: true,
      },
      series: [
        {
          type: "scatter",
          symbolSize: 7,
          data: result?.scatter.map((p) => [p.x, p.y]) ?? [],
          itemStyle: { opacity: 0.65 },
        },
      ],
      dataZoom: [
        { type: "inside", xAxisIndex: 0 },
        { type: "slider", bottom: 5 },
      ],
    }),
    [query.xField, query.yField, result?.scatter],
  );
  const qualityOption = useMemo<EChartsOption>(
    () => ({
      grid: { ...grid, left: 120 },
      xAxis: { type: "value", max: 100, name: "完整率 %" },
      yAxis: {
        type: "category",
        data: fields.map((f) => fieldLabel(f.name)),
        axisLabel: { width: 105, overflow: "truncate" },
      },
      series: [
        {
          type: "bar",
          data: fields.map((f) =>
            result?.filteredCount ? (100 * f.n) / result.filteredCount : 0,
          ),
          barMaxWidth: 18,
        },
      ],
    }),
    [fields, result?.filteredCount],
  );
  const treemapOption = useMemo<EChartsOption>(
    () => ({
      series: [
        {
          type: "treemap",
          roam: false,
          breadcrumb: { show: false },
          data: categories.map((c) => ({ name: c.label, value: c.count })),
          label: { overflow: "truncate" },
          itemStyle: { borderColor: "#ffffff", borderWidth: 4 },
        },
      ],
    }),
    [categories],
  );

  function change(next: Partial<AnalysisQuery>) {
    setQuery((q) => ({ ...q, ...next, offset: 0 }));
  }
  function addFilter() {
    if (!filterField || (query.filters?.length ?? 0) >= 8) {
      void message.warning("请选择字段，最多8项条件");
      return;
    }
    change({
      filters: [
        ...(query.filters ?? []),
        { field: filterField, op: filterOp, value: filterValue },
      ],
    });
  }
  async function exportData() {
    setBusy(true);
    try {
      downloadBlob(
        await analysisApi.export(resourceId, query),
        `${resourceTitle(result?.resourceName ?? "数据分析")}-数据表.csv`,
      );
    } catch (e) {
      void message.error(e instanceof Error ? e.message : "导出失败");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    try {
      await analysisApi.save(resourceId, viewName, query);
      setSaveOpen(false);
      onSaved();
      void message.success("已保存分析条件，可从页首‘已保存的分析’重新打开");
    } catch (e) {
      void message.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  const charts = (
    <div className="analysis-chart-grid">
      <AnalysisChart
        title="分类与指标对照"
        subtitle={`${fieldLabel(group)} · ${query.metric ? fieldLabel(metric) + "均值" : "记录计数"}`}
        option={categoryOption}
        canExport={canExport}
        onSelect={(label) => {
          if (group)
            change({
              filters: [
                ...(query.filters ?? []).filter((f) => f.field !== group),
                { field: group, op: "eq", value: label },
              ],
            });
        }}
      />
      {numeric.length ? (
        <AnalysisChart
          title="数值分布"
          subtitle={`${fieldLabel(metric)} · 全部有效记录，10个区间`}
          option={histogramOption}
          canExport={canExport}
        />
      ) : (
        <AnalysisChart
          title="分类记录组成"
          subtitle="按当前展示类别计数；功能类别可能重叠"
          option={pieOption}
          canExport={canExport}
        />
      )}
    </div>
  );
  const overview = (
    <>
      <div className="analysis-metrics">
        {!result?.visuals.metrics.length && (
          <Metric
            label="筛选记录 / 总记录"
            value={`${number(result?.filteredCount)} / ${number(result?.total)}`}
            note={result?.unit ?? "记录"}
          />
        )}
        {result?.visuals.metrics.length ? (
          resultMetrics(result).map((item) => (
            <Metric
              key={item.label}
              label={item.label}
              value={item.value}
              note={item.note}
            />
          ))
        ) : numeric.length > 0 ? (
          <>
            <Metric
              label="有效数值"
              value={number(profile?.n)}
              note={fieldLabel(metric)}
            />
            <Metric
              label="中位数"
              value={number(profile?.median)}
              note={`Q1 ${number(profile?.q1)} · Q3 ${number(profile?.q3)}`}
            />
            <Metric
              label="均值"
              value={number(profile?.mean)}
              note={`范围 ${number(profile?.min)} – ${number(profile?.max)}`}
            />
          </>
        ) : (
          <>
            <Metric
              label="分类字段"
              value={fieldLabel(group)}
              note="可切换分类维度"
            />
            <Metric
              label="字段数"
              value={number(fields.length)}
              note="当前资源结构"
            />
            <Metric
              label="缺失单元格"
              value={number(fields.reduce((sum, f) => sum + f.missing, 0))}
              note="空值保留供质量检查"
            />
          </>
        )}
      </div>
      {result && (
        <section className="analysis-card analysis-summary">
          <h3>结果概述</h3>
          {resultSummary(result).map((text) => (
            <p key={text}>{text}</p>
          ))}
        </section>
      )}
      {result && <SpecializedVisuals result={result} canExport={canExport} />}
      {result?.kind === "sequence" && numeric.length > 0 && (
        <AnalysisChart
          title="序列指标频数分布"
          subtitle={`${fieldLabel(metric)} · 全部有效记录，10个区间`}
          option={histogramOption}
          canExport={canExport}
        />
      )}
      {!result?.visuals.metrics.length && charts}
    </>
  );
  const composition = (
    <div className="analysis-chart-grid">
      <AnalysisChart
        title="分类记录组成"
        subtitle={
          result?.kind === "function"
            ? "扇区为功能归属次数占比；类别可重叠，不是基因总数占比"
            : "颜色表示分类；扇区按记录数"
        }
        option={pieOption}
        canExport={canExport}
      />
      <AnalysisChart
        title="分类计数空间"
        subtitle="面积表示分类数量"
        option={treemapOption}
        canExport={canExport}
      />
    </div>
  );
  const traits = (
    <>
      <div className="analysis-toolbar">
        <Select
          aria-label="相关性X字段"
          placeholder="X数值字段"
          value={query.xField}
          options={numeric.map((f) => ({
            label: fieldLabel(f.name),
            value: f.name,
          }))}
          onChange={(xField) => change({ xField })}
        />
        <Select
          aria-label="相关性Y字段"
          placeholder="Y数值字段"
          value={query.yField}
          options={numeric.map((f) => ({
            label: fieldLabel(f.name),
            value: f.name,
          }))}
          onChange={(yField) => change({ yField })}
        />
        <Tag>
          Pearson r：{number(result?.correlation)} · 有效配对{" "}
          {number(result?.pairedCount)}
        </Tag>
      </div>
      <div className="analysis-chart-grid">
        <AnalysisChart
          title="性状与指标分布"
          option={histogramOption}
          canExport={canExport}
        />
        <AnalysisChart
          title="双指标关系"
          subtitle="选择两个不同数值字段；最多显示1000个点"
          option={scatterOption}
          canExport={canExport}
        />
      </div>
      <section className="analysis-card">
        <h3>指标五数概括</h3>
        <Table
          size="small"
          rowKey="name"
          pagination={false}
          scroll={{ x: 650 }}
          dataSource={numeric}
          columns={[
            {
              title: "字段",
              dataIndex: "name",
              ellipsis: true,
              render: fieldLabel,
            },
            ...["min", "q1", "median", "q3", "max"].map((key, i) => ({
              title: ["最小值", "Q1", "中位数", "Q3", "最大值"][i],
              dataIndex: key,
              render: (v: number | null) => number(v),
            })),
          ]}
        />
      </section>
    </>
  );
  const details = (
    <section className="analysis-card">
      <p>筛选后的完整记录可分页查看；导出包含全部筛选结果。</p>
      <Table
        size="small"
        rowKey="_analysisRowKey"
        scroll={{ x: Math.max(700, fields.length * 150) }}
        dataSource={tableRows}
        columns={fields.map((f) => ({
          title: fieldLabel(f.name),
          dataIndex: f.name,
          width: 150,
          ellipsis: true,
          render: (v: unknown) =>
            v == null || v === "" ? (
              <span className="analysis-muted">未填写</span>
            ) : (
              displayValue(v)
            ),
        }))}
        pagination={{
          current: Math.floor((query.offset ?? 0) / (query.limit ?? 30)) + 1,
          pageSize: query.limit ?? 30,
          total: result?.filteredCount,
          showSizeChanger: true,
          pageSizeOptions: [10, 30, 100, 500],
          onChange: (page, size) =>
            setQuery((q) => ({ ...q, offset: (page - 1) * size, limit: size })),
        }}
      />
    </section>
  );
  return (
    <div className="analysis-table-workbench" ref={reportRef}>
      <div className="analysis-toolbar">
        <Input.Search
          aria-label="分析关键词"
          placeholder="搜索当前表全部字段"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={() => change({ keyword })}
          allowClear
        />
        <div className="analysis-toolbar-field">
          <span title="决定分类图的类别；例如按生活型、物种或采集区域分组。">
            分组依据
          </span>
          <Select
            aria-label="分组依据"
            placeholder="选择分类"
            value={group}
            disabled={!grouping.length}
            options={grouping.map((f) => ({
              label: fieldLabel(f.name),
              value: f.name,
            }))}
            onChange={(groupBy) => change({ groupBy })}
          />
        </div>
        <div className="analysis-toolbar-field">
          <span title="决定数值分布与相关图的测量指标；选择后分类对照图显示该指标均值。">
            统计指标
          </span>
          <Select
            aria-label="统计指标"
            placeholder="无数值指标"
            value={metric}
            disabled={!numeric.length}
            options={numeric.map((f) => ({
              label: fieldLabel(f.name),
              value: f.name,
            }))}
            onChange={(metric) => change({ metric })}
          />
        </div>
        <Button onClick={() => setSaveOpen(true)} disabled={!result}>
          保存视图
        </Button>
        <AnalysisDownloads
          title={resourceTitle(result?.resourceName ?? "数据分析")}
          paragraphs={result ? resultSummary(result) : []}
          source={
            result
              ? `${result.resourceName}；关键词：${query.keyword || "未限定"}；字段筛选：${(query.filters ?? []).map((f) => `${fieldLabel(f.field)} ${filterLabel(f.op)} ${f.value}`).join("；") || "未限定"}；分组依据：${fieldLabel(group)}；统计指标：${fieldLabel(metric)}`
              : ""
          }
          scope={() => reportRef.current}
          disabled={!result || !canExport}
          busy={busy}
          onData={() => void exportData()}
        />
      </div>
      <details className="analysis-filter-controls">
        <summary>
          组合筛选 <span>按字段限定分析范围</span>
        </summary>
        <div className="analysis-toolbar analysis-filterbar">
          <Select
            aria-label="筛选字段"
            placeholder="筛选字段"
            value={filterField}
            options={fields.map((f) => ({
              label: fieldLabel(f.name),
              value: f.name,
            }))}
            onChange={setFilterField}
          />
          <Select
            aria-label="筛选方式"
            value={filterOp}
            onChange={setFilterOp}
            options={[
              { value: "eq", label: "等于" },
              { value: "contains", label: "包含" },
              { value: "gte", label: "大于等于" },
              { value: "lte", label: "小于等于" },
              { value: "missing", label: "缺失" },
            ]}
          />
          <Input
            aria-label="筛选值"
            placeholder="筛选值"
            value={filterValue}
            disabled={filterOp === "missing"}
            onChange={(e) => setFilterValue(e.target.value)}
          />
          <Button onClick={addFilter}>添加条件</Button>
          <Button
            onClick={() => {
              setKeyword("");
              setQuery({ limit: 30, offset: 0 });
            }}
          >
            清除条件
          </Button>
        </div>
      </details>
      <Space wrap>
        {(query.filters ?? []).map((f) => (
          <Tag
            key={`${f.field}:${filterLabel(f.op)}:${f.value}`}
            closable
            onClose={() =>
              change({ filters: query.filters?.filter((v) => v !== f) })
            }
          >
            {fieldLabel(f.field)} {filterLabel(f.op)} {displayValue(f.value)}
          </Tag>
        ))}
      </Space>
      {error ? (
        <Alert
          type="error"
          showIcon
          title="数据分析暂未完成"
          description={error}
          action={<Button onClick={() => setQuery({ ...query })}>重试</Button>}
        />
      ) : loading ? (
        <div className="analysis-loading">
          <Spin description="正在计算筛选后的全量统计">
            <div />
          </Spin>
        </div>
      ) : result ? (
        <>
          <div className="analysis-source-line">
            {result.measurementUnit && (
              <Tag>测量单位：{result.measurementUnit}</Tag>
            )}
            <span>
              当前筛选 {number(result.filteredCount)} 条 / 共{" "}
              {number(result.total)} 条记录
            </span>
          </div>
          {result.filteredCount === 0 && (
            <Alert
              type="info"
              showIcon
              title="当前筛选没有记录，图表为空；请调整或清除条件"
            />
          )}
          {result.kind === "variants" &&
            metric === "position" &&
            !histogram.length &&
            result.filteredCount > 0 && (
              <Alert
                type="info"
                title="位置分布需要先筛选单条染色体"
                description="不同染色体坐标分别解释；可改选质量指标查看全部记录的分布。"
              />
            )}
          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={[
              { key: "overview", label: "分析总览", children: overview },
              {
                key: "composition",
                label: "组成与分类",
                children: composition,
              },
              { key: "traits", label: "分布与相关", children: traits },
              { key: "table", label: "数据明细", children: details },
              {
                key: "quality",
                label: "数据检查",
                children: (
                  <>
                    <AnalysisChart
                      title="字段完整率"
                      option={qualityOption}
                      height={Math.max(300, fields.length * 27)}
                      canExport={canExport}
                    />
                    <section className="analysis-card">
                      <h3>数据与统计说明</h3>
                      <p>
                        资料类型：
                        {result.provenance === "synthetic"
                          ? "模拟资料"
                          : "观测或公开资料"}
                      </p>
                      <ul>
                        {result.warnings.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                      <p>
                        来源资源：{result.resourceName}（ID {resourceId}
                        ）。统计对象：{result.unit}
                        。零值保留，缺失和非有限值不进入数值统计。
                      </p>
                    </section>
                  </>
                ),
              },
            ]}
          />
        </>
      ) : (
        <Empty description="请选择数据资源" />
      )}
      <Modal
        title="保存分析条件"
        open={saveOpen}
        onCancel={() => setSaveOpen(false)}
        onOk={() => void save()}
        confirmLoading={busy}
        okButtonProps={{ disabled: !viewName.trim() }}
      >
        <Input
          aria-label="分析视图名称"
          placeholder="例如：塔里木乔木含水率"
          maxLength={120}
          value={viewName}
          onChange={(e) => setViewName(e.target.value)}
        />
        <p>保存资源编号与筛选条件。重开时重新核验访问权限。</p>
      </Modal>
    </div>
  );
}

export function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <section className="analysis-card analysis-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </section>
  );
}
