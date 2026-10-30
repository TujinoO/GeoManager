import {
  Alert,
  Button,
  ConfigProvider,
  Empty,
  Input,
  Layout,
  Select,
  Dropdown,
  theme,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  BarChartOutlined,
  ExperimentOutlined,
  BranchesOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  FolderOpenOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import { api } from "../api/client";
import { analysisApi } from "../api/analysis";
import type {
  AnalysisQuery,
  AnalysisSavedView,
  GenomeAssemblyItem,
} from "../api/generated/types.gen";
import type { ResourceListItem } from "../types";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { useAppContext } from "../contexts/AppContext";
import { analysisResourceUrl } from "../utils/resources";
import TableAnalysisPanel from "./analysis/TableAnalysisPanel";
import GenomeAnalysisPanel, {
  GenomeComparison,
} from "./analysis/GenomeAnalysisPanel";
import AnalysisReportEditor from "./analysis/AnalysisReportEditor";
import {
  analysisTypes,
  genomeViews,
  resourceTitle,
} from "./analysis/presentation";
import "./analysis/analysis.css";

const icons = [
  <BarChartOutlined />,
  <DatabaseOutlined />,
  <ExperimentOutlined />,
  <BranchesOutlined />,
];
export default function AnalysisPage() {
  const { user } = useAppContext();
  const permissions = user?.permissions;
  const navigateTo = useNavigate();
  const [params, setParams] = useSearchParams();
  const [resources, setResources] = useState<ResourceListItem[]>([]);
  const [assemblies, setAssemblies] = useState<GenomeAssemblyItem[]>([]);
  const [saved, setSaved] = useState<AnalysisSavedView[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [ecologyKind, setEcologyKind] = useState("all");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resourceId, setResourceId] = useState<number>();
  const [assemblyId, setAssemblyId] = useState<number>();
  const [initialQuery, setInitialQuery] = useState<AnalysisQuery>();
  const [version, setVersion] = useState(0);
  const requested = resources.find(
    (r) =>
      r.id === Number(params.get("resourceId")) ||
      (params.get("resourceQ") && r.name === params.get("resourceQ")),
  );
  const rawView =
    params.get("view") ??
    params.get("domainType") ??
    (requested
      ? new URLSearchParams(analysisResourceUrl(requested).split("?")[1]).get(
          "view",
        )
      : null) ??
    "ecology";
  const view = ["browser", "comparison", "omics"].includes(rawView)
    ? "genome"
    : analysisTypes.some((p) => p.id === rawView)
      ? rawView
      : rawView === "germplasm"
        ? "samples"
        : "ecology";
  const candidateSection =
    params.get("section") ??
    (rawView === "browser" || rawView === "comparison"
      ? rawView
      : requested?.analysisKind && ["sequence"].includes(requested.analysisKind)
        ? requested.analysisKind
        : "overview");
  const section = genomeViews.some((v) => v.value === candidateSection)
    ? candidateSection
    : "overview";
  const assemblyMode =
    view === "genome" &&
    ["overview", "browser", "comparison"].includes(section);
  const current = analysisTypes.find((p) => p.id === view)!;
  const loadViews = useCallback(() => {
    if (permissions?.canQueryData)
      void analysisApi
        .views()
        .then((r) => setSaved(r.items))
        .catch(() => setSaved([]));
  }, [permissions?.canQueryData]);
  useEffect(loadViews, [loadViews]);
  useEffect(() => {
    if (!permissions?.canBrowseData) return;
    let ignore = false;
    setBusy(true);
    setError("");
    Promise.all([
      api.resources({ spatialClass: "non_spatial" }),
      analysisApi.assemblies(),
    ])
      .then(([r, a]) => {
        if (!ignore) {
          setResources(r.items);
          setAssemblies(a.items);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (!ignore) setError(e instanceof Error ? e.message : "资源加载失败");
      })
      .finally(() => {
        if (!ignore) setBusy(false);
      });
    return () => {
      ignore = true;
    };
  }, [permissions?.canBrowseData, refresh]);
  const visibleTables = useMemo(
    () =>
      resources
        .filter((r) => {
          if (r.dataType !== "table") return false;
          const kind = r.analysisKind;
          const match =
            view === "samples"
              ? kind === "samples" || (!kind && r.domainType === "germplasm")
              : view === "molecular"
                ? kind === "molecular" ||
                  (!kind && r.domainType === "molecular")
                : view === "genome"
                  ? kind === section
                  : [
                      "traits",
                      "individual",
                      "population",
                      "community",
                    ].includes(kind ?? "") ||
                    (!kind &&
                      !["genome", "molecular", "germplasm"].includes(
                        r.domainType ?? "",
                      ));
          return (
            match &&
            (view !== "ecology" ||
              ecologyKind === "all" ||
              r.analysisKind === ecologyKind ||
              (!r.analysisKind && r.domainType === ecologyKind)) &&
            (!keyword ||
              `${r.name} ${r.code} ${r.source}`
                .toLowerCase()
                .includes(keyword.toLowerCase()))
          );
        })
        .sort(
          (a, b) =>
            Number(Boolean(b.analysisKind)) - Number(Boolean(a.analysisKind)),
        ),
    [resources, view, section, keyword, ecologyKind],
  );
  useEffect(() => {
    const wanted = visibleTables.find((r) => r.id === requested?.id);
    if (wanted) setResourceId(wanted.id);
    else if (!visibleTables.some((r) => r.id === resourceId)) {
      setResourceId(visibleTables[0]?.id);
      setInitialQuery(undefined);
    }
  }, [visibleTables, requested, resourceId]);
  useEffect(() => {
    const wanted = assemblies.find((a) => a.resourceId === requested?.id);
    if (wanted) setAssemblyId(wanted.id);
    else if (!assemblies.some((a) => a.id === assemblyId))
      setAssemblyId(assemblies[0]?.id);
  }, [assemblies, requested, assemblyId]);
  function go(next: string, id?: number, tab?: string) {
    const q = new URLSearchParams({ view: next });
    if (id) q.set("resourceId", String(id));
    if (tab) q.set("section", tab);
    setParams(q);
    setResourceId(id);
    setKeyword("");
    setMobileOpen(false);
    setInitialQuery(undefined);
    setVersion((v) => v + 1);
  }
  function select(id: number) {
    go(view, id, view === "genome" ? section : undefined);
  }
  function openSaved(item: AnalysisSavedView) {
    const r = resources.find((r) => r.id === item.resourceId);
    if (!r) return;
    setParams(new URLSearchParams(analysisResourceUrl(r).split("?")[1]));
    setResourceId(r.id);
    setInitialQuery(item.query);
    setVersion((v) => v + 1);
    setMobileOpen(false);
  }
  const selected = resources.find((r) => r.id === resourceId);
  const selectedAssembly = assemblies.find((a) => a.id === assemblyId);
  const filteredAssemblies = assemblies.filter(
    (a) =>
      !keyword ||
      `${a.name} ${a.code}`.toLowerCase().includes(keyword.toLowerCase()),
  );
  if (rawView === "templates")
    return <Navigate to="/resources/data/import?target=analysis" replace />;
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#128d81",
          colorBgContainer: "#ffffff",
          colorBgElevated: "#ffffff",
          colorBorder: "#b7dcd2",
          colorText: "#315953",
          borderRadius: 8,
        },
      }}
    >
      <Layout className="workspace analysis-workspace">
        <AnalysisReportEditor
          open={Boolean(params.get("reportId"))}
          initialReportId={
            params.get("reportId") ? Number(params.get("reportId")) : undefined
          }
          onClose={() => {
            const next = new URLSearchParams(params);
            next.delete("reportId");
            setParams(next);
          }}
        />
        <WorkspaceHeader
          activeTab="nongeo"
          canBrowseData={Boolean(permissions?.canBrowseData)}
          resources={resources}
        />
        <div className="analysis-shell">
          <aside className="analysis-sidebar">
            <div className="analysis-sidebar-brand">
              <h2>数据分析</h2>
              <Button
                className="analysis-mobile-menu-toggle"
                size="small"
                aria-label={mobileOpen ? "收起分析导航" : "展开分析导航"}
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen((v) => !v)}
              >
                页面与资源
              </Button>
            </div>
            <div
              className={`analysis-sidebar-content ${mobileOpen ? "is-open" : ""}`}
            >
              <section className="analysis-type-section">
                <h3>
                  <BranchesOutlined /> 数据类型
                </h3>
                <nav aria-label="数据分析页面">
                  {analysisTypes.map((p, i) => (
                    <button
                      key={p.id}
                      className={`analysis-nav-item ${view === p.id ? "is-active" : ""}`}
                      onClick={() => go(p.id)}
                    >
                      {icons[i]}
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.detail}</small>
                      </span>
                    </button>
                  ))}
                </nav>
              </section>
              <section className="analysis-sidebar-section analysis-resource-section">
                <h3>
                  <FolderOpenOutlined /> 数据资源{" "}
                  <span>
                    {assemblyMode
                      ? filteredAssemblies.length
                      : visibleTables.length}
                  </span>
                </h3>
                <Input.Search
                  aria-label="筛选资源目录"
                  placeholder="名称、编号或来源"
                  value={keyword}
                  allowClear
                  onChange={(e) => setKeyword(e.target.value)}
                />
                {view === "ecology" && (
                  <Select
                    className="analysis-wide analysis-resource-kind"
                    aria-label="生态观测类型"
                    value={ecologyKind}
                    onChange={setEcologyKind}
                    options={[
                      { value: "all", label: "全部生态观测" },
                      { value: "individual", label: "个体调查" },
                      { value: "population", label: "种群调查" },
                      { value: "community", label: "群落观测" },
                      { value: "traits", label: "物种功能性状" },
                    ]}
                  />
                )}
                {view === "genome" && (
                  <Select
                    className="analysis-wide analysis-resource-kind"
                    aria-label="基因数据类型"
                    value={section}
                    options={genomeViews}
                    onChange={(s) => go("genome", undefined, s)}
                  />
                )}
                <div className="analysis-resource-list">
                  {assemblyMode
                    ? filteredAssemblies.map((a) => (
                        <button
                          key={a.id}
                          className={`analysis-resource ${assemblyId === a.id ? "is-selected" : ""}`}
                          onClick={() => {
                            setAssemblyId(a.id);
                            select(a.resourceId);
                          }}
                        >
                          <strong>{resourceTitle(a.name)}</strong>
                          <small>{a.code}</small>
                        </button>
                      ))
                    : visibleTables.map((r) => (
                        <button
                          key={r.id}
                          className={`analysis-resource ${resourceId === r.id ? "is-selected" : ""}`}
                          onClick={() => select(r.id)}
                        >
                          <strong>{resourceTitle(r.name)}</strong>
                          <small>{r.itemCount.toLocaleString()} 条记录</small>
                        </button>
                      ))}
                  {!busy &&
                    (assemblyMode
                      ? !filteredAssemblies.length
                      : !visibleTables.length) && (
                      <p>暂无匹配数据，请调整筛选或从统一导入入口接入。</p>
                    )}
                </div>
              </section>
            </div>
          </aside>
          <main
            className="analysis-main"
            aria-label="数据分析工作台内容"
            tabIndex={-1}
          >
            <header className="analysis-page-heading">
              <div>
                <h1>{current.name}</h1>
                <p>{current.detail}</p>
              </div>
              <div className="analysis-heading-actions">
                <Dropdown
                  trigger={["click"]}
                  disabled={!saved.length}
                  menu={{
                    items: saved.map((v) => ({
                      key: String(v.id),
                      label: v.name,
                      onClick: () => openSaved(v),
                    })),
                  }}
                >
                  <Button icon={<FilterOutlined />}>已保存的分析</Button>
                </Dropdown>
                <Button
                  icon={<ReloadOutlined />}
                  loading={busy}
                  onClick={() => setRefresh((v) => v + 1)}
                >
                  刷新资源
                </Button>
                <Button
                  onClick={() =>
                    navigateTo("/about/docs?article=nongeo-analysis")
                  }
                >
                  使用说明
                </Button>
              </div>
            </header>
            {view === "genome" && (
              <nav
                className="analysis-genome-sections"
                aria-label="基因组分析内容"
              >
                {genomeViews.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={section === item.value ? "is-active" : ""}
                    aria-current={section === item.value ? "page" : undefined}
                    onClick={() => go("genome", undefined, item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            )}
            {error && (
              <Alert
                type="error"
                showIcon
                title="资源目录加载失败"
                description={error}
              />
            )}
            {!permissions?.canBrowseData ? (
              <Alert type="warning" title="当前账号没有浏览数据权限" />
            ) : params.get("resourceId") &&
              loaded &&
              !busy &&
              !error &&
              !requested ? (
              <Alert
                type="warning"
                title="指定的数据资源不存在或当前账号无权访问"
                description="请从左侧资源目录选择可访问的数据。"
              />
            ) : !permissions.canQueryData ? (
              <Alert type="warning" title="当前账号没有数据查询权限" />
            ) : assemblyMode &&
              requested &&
              !assemblies.some((a) => a.resourceId === requested.id) ? (
              <Alert
                type="warning"
                title="该资源尚未建立参考基因组索引"
                description="请从统一导入入口接入配套序列与注释，或选择左侧已建立索引的组装。"
              />
            ) : view === "genome" && section === "comparison" ? (
              <GenomeComparison
                assemblies={assemblies}
                canExport={Boolean(permissions.canExportData)}
              />
            ) : assemblyMode ? (
              assemblyId ? (
                <>
                  <section className="analysis-selection">
                    <strong>{selectedAssembly?.name}</strong>
                    <span>{selectedAssembly?.code}</span>
                  </section>
                  <GenomeAnalysisPanel
                    key={`${assemblyId}:${section}`}
                    assemblyId={assemblyId}
                    mode={section === "browser" ? "browser" : "genome"}
                    canExport={Boolean(permissions.canExportData)}
                  />
                </>
              ) : (
                <Empty
                  description={
                    busy
                      ? "正在读取资源目录"
                      : "暂无已建立索引的组装，请从统一数据导入入口接入"
                  }
                />
              )
            ) : resourceId ? (
              <>
                <section className="analysis-selection">
                  <strong>
                    {selected ? resourceTitle(selected.name) : ""}
                  </strong>
                </section>
                <TableAnalysisPanel
                  key={`${resourceId}:${version}`}
                  resourceId={resourceId}
                  initialQuery={initialQuery}
                  canExport={Boolean(permissions.canExportData)}
                  onSaved={loadViews}
                />
              </>
            ) : (
              <Empty
                description={
                  busy
                    ? "正在读取资源目录"
                    : "暂无匹配数据，请从统一数据导入入口接入"
                }
              />
            )}
          </main>
        </div>
      </Layout>
    </ConfigProvider>
  );
}
import "./analysis/analysis-refinement.css";
