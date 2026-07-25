import {
  AppstoreOutlined,
  BarChartOutlined,
  CalendarOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FileOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  GlobalOutlined,
  PieChartOutlined,
  PictureOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Drawer,
  Empty,
  Image,
  Input,
  Layout,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
} from "antd";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../api/client";
import resultsPoplarReflectionImage from "../assets/portal/results-poplar-reflection.png";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { useAppContext } from "../contexts/AppContext";
import type { MapComposition, ResultArtifact } from "../types";
import { downloadBlob } from "../utils/download";

type ResultSource = "all" | "mapping" | "analysis" | "imported";
type ResultView = "cards" | "list";
type PublishedResult =
  | { key: string; kind: "mapping"; item: MapComposition }
  | { key: string; kind: "artifact"; item: ResultArtifact };

type SourceOverview = {
  key: Exclude<ResultSource, "all">;
  label: string;
  shortLabel: string;
  count: number;
  percentage: number;
  color: string;
};

type TrendOverview = {
  key: string;
  label: string;
  count: number;
};

type ResultsOverviewData = {
  total: number;
  thisMonth: number;
  downloadable: number;
  downloadRate: number;
  formatCount: number;
  latestPublishedAt?: string;
  sources: SourceOverview[];
  trend: TrendOverview[];
};

const sourceOverviewMeta: Array<Omit<SourceOverview, "count" | "percentage">> =
  [
    {
      key: "mapping",
      label: "专题图件",
      shortLabel: "图件",
      color: "#287b63",
    },
    {
      key: "analysis",
      label: "平台分析成果",
      shortLabel: "分析",
      color: "#4f86c6",
    },
    {
      key: "imported",
      label: "直接导入成果",
      shortLabel: "导入",
      color: "#d99a3d",
    },
  ];

const sourceOptions: Array<{ value: ResultSource; label: string }> = [
  { value: "all", label: "全部成果" },
  { value: "mapping", label: "专题图件" },
  { value: "analysis", label: "分析成果" },
  { value: "imported", label: "导入成果" },
];

const formatOptions = [
  { value: "png", label: "PNG 图片" },
  { value: "jpg", label: "JPG 图片" },
  { value: "jpeg", label: "JPEG 图片" },
  { value: "pdf", label: "PDF 文档" },
  { value: "csv", label: "CSV 表格" },
  { value: "xlsx", label: "XLSX 表格" },
];

export default function ResultsPage() {
  const { message } = App.useApp();
  const { user } = useAppContext();
  const [mapItems, setMapItems] = useState<MapComposition[]>([]);
  const [artifactItems, setArtifactItems] = useState<ResultArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [source, setSource] = useState<ResultSource>("all");
  const [format, setFormat] = useState<string>();
  const [view, setView] = useState<ResultView>("cards");
  const [detail, setDetail] = useState<PublishedResult | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const canViewMapping = Boolean(user?.permissions.canViewMapCompositions);
  const canViewArtifactResults = Boolean(
    user?.permissions.canViewResultArtifacts,
  );
  const canViewResults = canViewMapping || canViewArtifactResults;

  const loadResults = useCallback(async () => {
    setLoading(true);
    const [mappingResult, artifactResult] = await Promise.allSettled([
      canViewMapping
        ? api
            .mapCompositions({ status: "published" })
            .then((response) =>
              response.items.filter((item) => item.publishedVersion),
            )
        : Promise.resolve([]),
      canViewArtifactResults
        ? api
            .resultArtifacts()
            .then((response) =>
              response.items.filter((item) => item.status === "published"),
            )
        : Promise.resolve([]),
    ]);

    if (mappingResult.status === "fulfilled") {
      setMapItems(mappingResult.value);
    } else {
      setMapItems([]);
      message.error(errorMessage(mappingResult.reason, "专题图成果加载失败"));
    }
    if (artifactResult.status === "fulfilled") {
      setArtifactItems(artifactResult.value);
    } else {
      setArtifactItems([]);
      message.error(errorMessage(artifactResult.reason, "成果文件加载失败"));
    }
    setLoading(false);
  }, [canViewArtifactResults, canViewMapping, message]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  const publishedResults = useMemo<PublishedResult[]>(
    () => [
      ...mapItems.map((item) => ({
        key: `mapping-${item.id}`,
        kind: "mapping" as const,
        item,
      })),
      ...artifactItems.map((item) => ({
        key: `artifact-${item.id}`,
        kind: "artifact" as const,
        item,
      })),
    ],
    [artifactItems, mapItems],
  );

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase("zh-CN");
    return publishedResults.filter((result) => {
      const matchesSource = source === "all" || resultSource(result) === source;
      const matchesFormat = format ? resultFormat(result) === format : true;
      const matchesKeyword = normalizedKeyword
        ? resultSearchText(result)
            .toLocaleLowerCase("zh-CN")
            .includes(normalizedKeyword)
        : true;
      return matchesSource && matchesFormat && matchesKeyword;
    });
  }, [format, keyword, publishedResults, source]);

  const overview = useMemo(
    () => buildResultsOverview(publishedResults),
    [publishedResults],
  );

  async function downloadResult(result: PublishedResult) {
    if (!resultCanDownload(result)) return;
    setDownloadingKey(result.key);
    try {
      const response =
        result.kind === "mapping"
          ? await api.downloadMapCompositionVersion(
              result.item.id,
              result.item.publishedVersion!.versionNumber,
            )
          : await api.downloadResultArtifact(result.item.id);
      downloadBlob(response.blob, response.filename);
    } catch (error) {
      message.error(errorMessage(error, "成果下载失败"));
    } finally {
      setDownloadingKey((current) => (current === result.key ? null : current));
    }
  }

  return (
    <Layout className="portal-shell results-page-shell">
      <WorkspaceHeader
        activeTab="results"
        canBrowseData={Boolean(user?.permissions.canBrowseData)}
        mapCompositions={mapItems}
      />
      <main className="portal-content-page results-page">
        <section
          className="portal-hero results-page-hero"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(5, 31, 31, 0.94) 0%, rgba(8, 42, 38, 0.76) 42%, rgba(13, 38, 34, 0.4) 70%, rgba(5, 24, 27, 0.64) 100%), url(${resultsPoplarReflectionImage})`,
          }}
        >
          <div>
            <Tag color="green">平台成果中心</Tag>
            <Typography.Title level={1}>成果展示</Typography.Title>
            <Typography.Paragraph>
              统一汇聚平台生成的专题图件、数据分析成果和直接导入成果，仅展示已正式发布且当前账号具备访问权限的内容。
            </Typography.Paragraph>
          </div>
          <div className="results-page-stats">
            <Statistic
              title="已发布成果"
              value={publishedResults.length}
              suffix="项"
            />
            <Statistic
              title="可下载"
              value={publishedResults.filter(resultCanDownload).length}
              suffix="项"
            />
            <Statistic
              title="成果来源"
              value={new Set(publishedResults.map(resultSource)).size}
              suffix="类"
            />
          </div>
        </section>

        {!canViewResults && (
          <Alert
            showIcon
            type="warning"
            title="当前账号暂无成果查看权限"
            description="成果页面保留统一入口；获得专题图成果或成果文件查看权限后，将自动显示可访问的已发布成果。"
          />
        )}

        <ResultsOverview
          data={overview}
          loading={loading}
          selectedSource={source}
          onSourceChange={setSource}
        />

        <section className="results-page-toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索成果名称、分类、工程或提供单位"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Select<ResultSource>
            value={source}
            options={sourceOptions}
            onChange={setSource}
          />
          <Select
            allowClear
            placeholder="成果格式"
            value={format}
            options={formatOptions}
            onChange={setFormat}
          />
          <Segmented<ResultView>
            value={view}
            onChange={setView}
            options={[
              { value: "cards", label: "卡片", icon: <AppstoreOutlined /> },
              { value: "list", label: "列表", icon: <FileImageOutlined /> },
            ]}
          />
        </section>

        <Spin spinning={loading}>
          {filteredItems.length ? (
            <section
              className={`result-card-grid${
                view === "list" ? " result-card-grid-list" : ""
              }`}
            >
              {filteredItems.map((item) => (
                <ResultCard
                  item={item}
                  key={item.key}
                  downloading={downloadingKey === item.key}
                  onDetail={() => setDetail(item)}
                  onDownload={() => void downloadResult(item)}
                />
              ))}
            </section>
          ) : (
            <Empty
              className="results-page-empty"
              description={emptyDescription(source)}
            />
          )}
        </Spin>
      </main>

      <Drawer
        size="large"
        title={detail ? resultName(detail) : "成果详情"}
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
      >
        {detail && <ResultDetail item={detail} />}
      </Drawer>
    </Layout>
  );
}

function ResultsOverview({
  data,
  loading,
  selectedSource,
  onSourceChange,
}: {
  data: ResultsOverviewData;
  loading: boolean;
  selectedSource: ResultSource;
  onSourceChange: (source: ResultSource) => void;
}) {
  const trendMaximum = Math.max(...data.trend.map((item) => item.count), 1);
  const donutBackground = buildDonutBackground(data.sources, data.total);

  return (
    <section
      className="results-overview"
      aria-labelledby="results-overview-title"
    >
      <header className="results-overview-heading">
        <div>
          <Space size={8}>
            <PieChartOutlined />
            <Typography.Title id="results-overview-title" level={2}>
              成果数据概览
            </Typography.Title>
          </Space>
          <Typography.Paragraph>
            基于当前账号可访问的已发布成果实时汇总，点击来源可联动筛选下方成果目录。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Tag color="green">实时汇总</Tag>
          <Typography.Text type="secondary">
            {data.latestPublishedAt
              ? `最近发布 ${formatShortDate(data.latestPublishedAt)}`
              : "暂无发布记录"}
          </Typography.Text>
        </Space>
      </header>

      <Spin spinning={loading}>
        <div className="results-overview-metrics">
          <OverviewMetric
            icon={<DatabaseOutlined />}
            label="成果总量"
            value={data.total}
            suffix="项"
            note="当前可访问的正式成果"
          />
          <OverviewMetric
            icon={<CalendarOutlined />}
            label="本月新增"
            value={data.thisMonth}
            suffix="项"
            note="按成果发布时间统计"
          />
          <OverviewMetric
            icon={<DownloadOutlined />}
            label="开放下载"
            value={data.downloadable}
            suffix="项"
            note={`可下载率 ${data.downloadRate}%`}
          />
          <OverviewMetric
            icon={<FileOutlined />}
            label="文件格式"
            value={data.formatCount}
            suffix="种"
            note="覆盖图片、文档与表格"
          />
        </div>

        <div className="results-overview-charts">
          <article className="results-overview-chart results-source-chart">
            <div className="results-chart-title">
              <div>
                <Typography.Title level={3}>成果来源构成</Typography.Title>
                <Typography.Text type="secondary">
                  各类成果占当前成果总量的比例
                </Typography.Text>
              </div>
              {selectedSource !== "all" && (
                <Button type="link" onClick={() => onSourceChange("all")}>
                  查看全部
                </Button>
              )}
            </div>
            <div className="results-source-chart-body">
              <div
                className={`results-donut${data.total ? "" : " is-empty"}`}
                style={{ background: donutBackground }}
                role="img"
                aria-label={buildSourceSummary(data.sources, data.total)}
              >
                <div className="results-donut-center">
                  <strong>{data.total}</strong>
                  <span>成果总量</span>
                </div>
              </div>
              <div className="results-source-legend">
                {data.sources.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={
                      selectedSource === item.key ? "is-selected" : undefined
                    }
                    aria-pressed={selectedSource === item.key}
                    onClick={() =>
                      onSourceChange(
                        selectedSource === item.key ? "all" : item.key,
                      )
                    }
                  >
                    <span
                      className="results-source-dot"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>
                      <small>{item.label}</small>
                      <strong>{item.count} 项</strong>
                    </span>
                    <b>{item.percentage}%</b>
                  </button>
                ))}
              </div>
            </div>
          </article>

          <article className="results-overview-chart results-trend-chart">
            <div className="results-chart-title">
              <div>
                <Typography.Title level={3}>近 6 个月发布趋势</Typography.Title>
                <Typography.Text type="secondary">
                  观察成果持续沉淀与发布节奏
                </Typography.Text>
              </div>
              <BarChartOutlined />
            </div>
            <div
              className="results-trend-plot"
              role="img"
              aria-label={buildTrendSummary(data.trend)}
            >
              {data.trend.map((item) => (
                <div className="results-trend-column" key={item.key}>
                  <div className="results-trend-value">{item.count}</div>
                  <div className="results-trend-track">
                    <div
                      className={`results-trend-bar${item.count ? "" : " is-zero"}`}
                      style={{
                        height: item.count
                          ? `${Math.max((item.count / trendMaximum) * 100, 12)}%`
                          : "4px",
                      }}
                    />
                  </div>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            {!data.total && (
              <div className="results-trend-empty-note">
                成果发布后，月度变化将在此自动呈现
              </div>
            )}
          </article>
        </div>
      </Spin>
    </section>
  );
}

function OverviewMetric({
  icon,
  label,
  value,
  suffix,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  suffix: string;
  note: string;
}) {
  return (
    <article className="results-overview-metric">
      <span className="results-overview-metric-icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>
          {value.toLocaleString("zh-CN")}
          <em>{suffix}</em>
        </strong>
        <span>{note}</span>
      </div>
    </article>
  );
}

function buildResultsOverview(
  results: PublishedResult[],
  now = new Date(),
): ResultsOverviewData {
  const total = results.length;
  const downloadable = results.filter(resultCanDownload).length;
  const sourceCounts = new Map<Exclude<ResultSource, "all">, number>();
  const validPublicationDates = results
    .map((item) => resultPublishedAt(item))
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, date: new Date(value) }))
    .filter(({ date }) => !Number.isNaN(date.getTime()));

  for (const result of results) {
    const resultSourceKey = resultSource(result);
    sourceCounts.set(
      resultSourceKey,
      (sourceCounts.get(resultSourceKey) ?? 0) + 1,
    );
  }

  const sources = sourceOverviewMeta.map((item) => {
    const count = sourceCounts.get(item.key) ?? 0;
    return {
      ...item,
      count,
      percentage: total ? Math.round((count / total) * 100) : 0,
    };
  });

  const trend = Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(
      now.getFullYear(),
      now.getMonth() - (5 - index),
      1,
    );
    const key = monthKey(monthDate);
    return {
      key,
      label: `${monthDate.getMonth() + 1}月`,
      count: validPublicationDates.filter(({ date }) => monthKey(date) === key)
        .length,
    };
  });

  const latestPublication = validPublicationDates.reduce<
    { value: string; date: Date } | undefined
  >(
    (latest, current) =>
      !latest || current.date.getTime() > latest.date.getTime()
        ? current
        : latest,
    undefined,
  );

  return {
    total,
    thisMonth: validPublicationDates.filter(
      ({ date }) => monthKey(date) === monthKey(now),
    ).length,
    downloadable,
    downloadRate: total ? Math.round((downloadable / total) * 100) : 0,
    formatCount: new Set(
      results.map((item) => resultFormat(item).toLowerCase()),
    ).size,
    latestPublishedAt: latestPublication?.value,
    sources,
    trend,
  };
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildDonutBackground(sources: SourceOverview[], total: number) {
  if (!total) return "conic-gradient(#dfe9e4 0 100%)";
  let start = 0;
  const segments = sources.map((source) => {
    const end = start + (source.count / total) * 100;
    const segment = `${source.color} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  return `conic-gradient(${segments.join(", ")})`;
}

function buildSourceSummary(sources: SourceOverview[], total: number) {
  if (!total) return "成果来源构成：暂无已发布成果";
  return `成果来源构成：${sources
    .map((source) => `${source.label} ${source.count} 项`)
    .join("，")}`;
}

function buildTrendSummary(trend: TrendOverview[]) {
  return `近 6 个月发布趋势：${trend
    .map((item) => `${item.label} ${item.count} 项`)
    .join("，")}`;
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日期未知";
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function ResultCard({
  item,
  downloading,
  onDetail,
  onDownload,
}: {
  item: PublishedResult;
  downloading: boolean;
  onDetail: () => void;
  onDownload: () => void;
}) {
  return (
    <Card className="result-card" cover={<ResultCover item={item} />}>
      <Space orientation="vertical" size={10} className="full-width">
        <Space wrap>
          <Tag color={sourceTagColor(resultSource(item))}>
            {sourceLabel(item)}
          </Tag>
          <Tag>{resultFormat(item).toUpperCase()}</Tag>
          {item.kind === "mapping" && (
            <Tag>V{item.item.publishedVersion!.versionNumber}</Tag>
          )}
        </Space>
        <Typography.Title level={3}>{resultName(item)}</Typography.Title>
        <Typography.Text type="secondary">
          {resultProvider(item)}
        </Typography.Text>
        <Typography.Paragraph ellipsis={{ rows: 2 }}>
          {resultDescription(item) || "暂无成果说明"}
        </Typography.Paragraph>
        <Space wrap>
          <Button icon={<EyeOutlined />} onClick={onDetail}>
            查看详情
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            disabled={!resultCanDownload(item)}
            loading={downloading}
            onClick={onDownload}
          >
            下载成果
          </Button>
        </Space>
      </Space>
    </Card>
  );
}

function ResultCover({ item }: { item: PublishedResult }) {
  const previewUrl = resultPreviewUrl(item);
  const format = resultFormat(item);
  const imagePreview = ["png", "jpg", "jpeg"].includes(format);
  return (
    <div
      className={`result-card-cover${imagePreview ? "" : " result-card-cover-file"}`}
    >
      {previewUrl && imagePreview ? (
        <Image
          alt={`${resultName(item)}成果预览`}
          preview={false}
          src={previewUrl}
        />
      ) : (
        <div className="result-file-cover-placeholder">
          {resultFormatIcon(item)}
          <strong>{format.toUpperCase()}</strong>
          <span>{sourceLabel(item)}</span>
        </div>
      )}
      <Tag color="green">已发布</Tag>
    </div>
  );
}

function ResultDetail({ item }: { item: PublishedResult }) {
  const format = resultFormat(item);
  const previewUrl = resultPreviewUrl(item);
  const imagePreview = ["png", "jpg", "jpeg"].includes(format);
  return (
    <Space orientation="vertical" size={20} className="full-width">
      {previewUrl && imagePreview && (
        <Image alt={`${resultName(item)}成果预览`} src={previewUrl} />
      )}
      {previewUrl && format === "pdf" && (
        <iframe
          className="result-pdf-preview"
          src={previewUrl}
          title={`${resultName(item)} PDF 预览`}
        />
      )}
      {!imagePreview && format !== "pdf" && (
        <Alert
          showIcon
          type="info"
          title="该成果格式不支持在线预览"
          description="可在权限允许时下载原文件，并使用本地表格软件查看。"
        />
      )}
      <Typography.Paragraph>
        {resultDescription(item) || "暂无成果说明"}
      </Typography.Paragraph>
      <div className="result-detail-grid">
        <span>
          <small>成果来源</small>
          <strong>{sourceLabel(item)}</strong>
        </span>
        <span>
          <small>成果格式</small>
          <strong>{format.toUpperCase()}</strong>
        </span>
        <span>
          <small>提供/制作单位</small>
          <strong>{resultProvider(item)}</strong>
        </span>
        <span>
          <small>成果分类</small>
          <strong>{resultCategory(item)}</strong>
        </span>
        <span>
          <small>制作/登记人员</small>
          <strong>{resultOwner(item)}</strong>
        </span>
        <span>
          <small>发布时间</small>
          <strong>{formatDate(resultPublishedAt(item))}</strong>
        </span>
      </div>
    </Space>
  );
}

function resultSource(item: PublishedResult): Exclude<ResultSource, "all"> {
  if (item.kind === "mapping") return "mapping";
  return item.item.sourceType === "analysis" ? "analysis" : "imported";
}

function sourceLabel(item: PublishedResult) {
  const source = resultSource(item);
  if (source === "mapping") return "专题图件";
  if (source === "analysis") return "平台分析成果";
  return "直接导入成果";
}

function sourceTagColor(source: Exclude<ResultSource, "all">) {
  if (source === "mapping") return "green";
  if (source === "analysis") return "blue";
  return "gold";
}

function resultName(item: PublishedResult) {
  return item.item.name;
}

function resultDescription(item: PublishedResult) {
  return item.item.description;
}

function resultFormat(item: PublishedResult) {
  return item.kind === "mapping"
    ? item.item.publishedVersion!.format
    : item.item.fileFormat;
}

function resultProvider(item: PublishedResult) {
  return item.kind === "mapping"
    ? `来源工程：${item.item.projectName}`
    : `提供单位：${item.item.provider || "未填写"}`;
}

function resultCategory(item: PublishedResult) {
  return item.kind === "mapping"
    ? "专题制图成果"
    : item.item.categoryPath.map((category) => category.name).join(" / ");
}

function resultOwner(item: PublishedResult) {
  return item.item.owner.displayName || item.item.owner.username || "未记录";
}

function resultPublishedAt(item: PublishedResult) {
  return item.kind === "mapping"
    ? (item.item.publishedAt ?? item.item.publishedVersion!.createdAt)
    : (item.item.publishedAt ?? item.item.createdAt);
}

function resultPreviewUrl(item: PublishedResult) {
  return item.kind === "mapping"
    ? item.item.publishedVersion!.previewUrl
    : item.item.previewUrl;
}

function resultCanDownload(item: PublishedResult) {
  return item.item.canDownload;
}

function resultSearchText(item: PublishedResult) {
  return [
    resultName(item),
    resultDescription(item),
    resultProvider(item),
    resultCategory(item),
    resultOwner(item),
  ].join(" ");
}

function resultFormatIcon(item: PublishedResult) {
  const format = resultFormat(item);
  if (format === "pdf") return <FilePdfOutlined />;
  if (["csv", "xlsx"].includes(format)) return <FileExcelOutlined />;
  if (resultSource(item) === "analysis") return <BarChartOutlined />;
  if (resultSource(item) === "mapping") return <GlobalOutlined />;
  return <PictureOutlined />;
}

function emptyDescription(source: ResultSource) {
  if (source === "analysis") return "暂无已发布的数据分析成果";
  if (source === "imported") return "暂无已发布的直接导入成果";
  if (source === "mapping") return "暂无已发布的专题图件";
  return "当前筛选条件下暂无已发布成果";
}

function formatDate(value: string | null | undefined) {
  return value
    ? new Date(value).toLocaleString("zh-CN", { hour12: false })
    : "未记录";
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
