import {
  ApartmentOutlined,
  AppstoreOutlined,
  ArrowRightOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  DashboardOutlined,
  EyeOutlined,
  FileImageOutlined,
  FundProjectionScreenOutlined,
  GlobalOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Layout,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
  Tree,
  Typography,
} from "antd";
import type { DataNode } from "antd/es/tree";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import capfedLogoWhite from "../assets/capfed-logo-white.svg";
import homePoplarNightImage from "../assets/portal/home-poplar-night.png";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { useAppContext } from "../contexts/AppContext";
import type {
  DataSchemaCatalogNode,
  DataSchemaSummary,
  ResourceFilters,
  ResourceListItem,
} from "../types";
import {
  findTaxonomyNode,
  flattenTaxonomy,
  taxonomyTree,
} from "../utils/taxonomy";

type CatalogView = "cards" | "list";

const dataTypeLabels: Record<ResourceListItem["dataType"], string> = {
  vector: "矢量",
  raster: "栅格",
  gene: "基因/组学",
  table: "表格",
  document: "文档",
  image: "图片",
};

const portalQuickActions = [
  {
    key: "overview",
    title: "进入数据概览",
    description: "掌握资源规模、数据构成与服务状态",
    path: "/resources/dashboard",
    icon: <DashboardOutlined />,
    tone: "cyan",
  },
  {
    key: "map",
    title: "进入地理工作台",
    description: "加载多源图层，开展空间浏览与查询",
    path: "/map",
    icon: <GlobalOutlined />,
    tone: "green",
  },
  {
    key: "analysis",
    title: "进入数据分析",
    description: "面向表格与非空间数据开展统计分析",
    path: "/nongeo",
    icon: <BarChartOutlined />,
    tone: "blue",
  },
  {
    key: "results",
    title: "进入成果展示",
    description: "浏览专题图件、报告与科研共享成果",
    path: "/results",
    icon: <FundProjectionScreenOutlined />,
    tone: "gold",
  },
] as const;

const resourceViewLabels: Record<
  ResourceListItem["availableViews"][number],
  string
> = {
  map: "地图",
  table: "表格",
  gallery: "图片",
  metadata: "元数据",
};

export default function DataCatalogPage() {
  const { message } = App.useApp();
  const { user } = useAppContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [schema, setSchema] = useState<DataSchemaSummary | null>(null);
  const [resources, setResources] = useState<ResourceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CatalogView>("cards");
  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");
  const [dataType, setDataType] = useState<ResourceFilters["dataType"]>();
  const [classificationStatus, setClassificationStatus] =
    useState<ResourceFilters["classificationStatus"]>();
  const [detailResource, setDetailResource] = useState<ResourceListItem | null>(
    null,
  );
  const canBrowseData = Boolean(user?.permissions.canBrowseData);
  const categoryCode = searchParams.get("categoryCode") ?? "";
  const tree = useMemo(() => taxonomyTree(schema), [schema]);
  const selectedNode = useMemo(
    () => findTaxonomyNode(tree, categoryCode),
    [categoryCode, tree],
  );
  const catalogLeafCount = useMemo(
    () => flattenTaxonomy(tree).filter((node) => node.selectable).length,
    [tree],
  );

  const loadResources = useCallback(
    async (filters: ResourceFilters) => {
      if (!canBrowseData) {
        setResources([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await api.resources(filters);
        setResources(response.items);
      } catch (error) {
        message.error(
          error instanceof Error ? error.message : "数据目录加载失败",
        );
      } finally {
        setLoading(false);
      }
    },
    [canBrowseData, message],
  );

  useEffect(() => {
    if (!canBrowseData) return;
    let ignore = false;
    api
      .dataSchemaSummary()
      .then((result) => {
        if (!ignore) setSchema(result);
      })
      .catch(() => {
        if (!ignore) setSchema(null);
      });
    return () => {
      ignore = true;
    };
  }, [canBrowseData]);

  useEffect(() => {
    void loadResources({
      ...(categoryCode ? { categoryCode } : {}),
      ...(searchParams.get("q")
        ? { q: searchParams.get("q") ?? undefined }
        : {}),
      ...(dataType ? { dataType } : {}),
      ...(classificationStatus ? { classificationStatus } : {}),
    });
  }, [
    categoryCode,
    classificationStatus,
    dataType,
    loadResources,
    searchParams,
  ]);

  function applySearch() {
    const next = new URLSearchParams(searchParams);
    if (keyword.trim()) next.set("q", keyword.trim());
    else next.delete("q");
    setSearchParams(next);
  }

  function selectCategory(code: string | null) {
    const next = new URLSearchParams(searchParams);
    if (code) next.set("categoryCode", code);
    else next.delete("categoryCode");
    setSearchParams(next);
  }

  function openResource(resource: ResourceListItem) {
    if (resource.availableViews.includes("map")) {
      const next = new URLSearchParams();
      if (resource.category?.code)
        next.set("categoryCode", resource.category.code);
      next.set("resourceQ", resource.name);
      navigate(`/map?${next.toString()}`);
      return;
    }
    if (
      resource.availableViews.includes("table") ||
      resource.availableViews.includes("gallery")
    ) {
      navigate(`/nongeo?resourceQ=${encodeURIComponent(resource.name)}`);
      return;
    }
    setDetailResource(resource);
  }

  return (
    <Layout className="data-catalog-shell">
      <WorkspaceHeader
        activeTab="home"
        canBrowseData={canBrowseData}
        resources={resources}
        dataSchema={schema}
      />
      <main className="data-catalog-page">
        <section
          className="data-catalog-hero"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(4, 18, 31, 0.96) 0%, rgba(6, 27, 39, 0.84) 40%, rgba(7, 21, 32, 0.28) 68%, rgba(4, 15, 25, 0.76) 100%), url(${homePoplarNightImage})`,
          }}
        >
          <div className="data-catalog-hero-copy">
            <div className="data-catalog-platform-brand">
              <span className="data-catalog-platform-logo">
                <img
                  src={capfedLogoWhite}
                  alt="全球胡杨林生态系统保护数据共享平台 Logo"
                  width={54}
                  height={54}
                />
              </span>
              <span className="data-catalog-platform-name">
                <strong>全球胡杨林生态系统保护数据共享平台</strong>
                <span>
                  Global Poplar Forest Ecosystem Protection Data Sharing
                  Platform
                </span>
              </span>
            </div>
            <div className="data-catalog-hero-eyebrow">
              <span className="data-catalog-hero-context">
                <GlobalOutlined />
                <span>中亚胡杨生态数据门户</span>
              </span>
              <span className="data-catalog-hero-mission">
                服务生态保护 · 科学研究 · 数据共享
              </span>
            </div>
            <Typography.Title level={1}>胡杨生态数据资源目录</Typography.Title>
            <Typography.Paragraph>
              汇聚遥感影像、空间矢量、实地调查、长期监测与科研成果，构建覆盖胡杨生态保护全链条的一站式数据资源目录。
            </Typography.Paragraph>
          </div>
          <div className="data-catalog-stats" aria-label="平台数据概览">
            <div className="data-catalog-stat-card">
              <Statistic
                title={
                  <span>
                    <DatabaseOutlined /> 收录资源
                  </span>
                }
                value={resources.length}
                suffix="项"
              />
              <span>多源数据统一组织</span>
            </div>
            <div className="data-catalog-stat-card">
              <Statistic
                title={
                  <span>
                    <ApartmentOutlined /> 业务大类
                  </span>
                }
                value={tree.length}
                suffix="类"
              />
              <span>覆盖核心生态主题</span>
            </div>
            <div className="data-catalog-stat-card">
              <Statistic
                title={
                  <span>
                    <AppstoreOutlined /> 专题目录
                  </span>
                }
                value={catalogLeafCount}
                suffix="个"
              />
              <span>细分数据组织维度</span>
            </div>
            <div className="data-catalog-stat-card">
              <Statistic
                title={
                  <span>
                    <FileImageOutlined /> 数据形态
                  </span>
                }
                value={Object.keys(dataTypeLabels).length}
                suffix="种"
              />
              <span>矢量、栅格及表格等</span>
            </div>
          </div>
        </section>

        <section
          className="data-catalog-feature-launchpad"
          aria-labelledby="data-catalog-feature-title"
        >
          <div className="data-catalog-feature-heading">
            <div>
              <span>PLATFORM SERVICES</span>
              <Typography.Title level={2} id="data-catalog-feature-title">
                核心功能快捷入口
              </Typography.Title>
            </div>
            <Typography.Paragraph>
              从资源全景到空间应用、数据分析与成果共享，一键进入平台核心业务场景。
            </Typography.Paragraph>
          </div>
          <div className="data-catalog-feature-grid">
            {portalQuickActions.map((action, index) => (
              <Button
                key={action.key}
                type="text"
                className="data-catalog-feature-button"
                data-tone={action.tone}
                style={
                  {
                    "--data-catalog-action-order": index,
                  } as CSSProperties
                }
                onClick={() => navigate(action.path)}
              >
                <span className="data-catalog-feature-glow" aria-hidden />
                <span className="data-catalog-feature-icon">{action.icon}</span>
                <span className="data-catalog-feature-copy">
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </span>
                <span className="data-catalog-feature-arrow" aria-hidden>
                  <ArrowRightOutlined />
                </span>
              </Button>
            ))}
          </div>
        </section>

        {!canBrowseData && (
          <Alert type="warning" showIcon title="当前账号没有数据资源浏览权限" />
        )}

        <section className="data-catalog-toolbar">
          <Input.Search
            allowClear
            value={keyword}
            prefix={<SearchOutlined />}
            placeholder="搜索数据名称"
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={applySearch}
          />
          <Select
            allowClear
            placeholder="物理数据类型"
            value={dataType}
            options={Object.entries(dataTypeLabels).map(([value, label]) => ({
              value,
              label,
            }))}
            onChange={setDataType}
          />
          <Select
            allowClear
            placeholder="归类状态"
            value={classificationStatus}
            options={[
              { value: "classified", label: "已分类" },
              { value: "pending", label: "待归类" },
            ]}
            onChange={setClassificationStatus}
          />
          <Segmented<CatalogView>
            value={view}
            onChange={setView}
            options={[
              { value: "cards", label: "卡片", icon: <AppstoreOutlined /> },
              { value: "list", label: "列表", icon: <DatabaseOutlined /> },
            ]}
          />
        </section>

        <div className="data-catalog-body">
          <aside className="data-catalog-taxonomy">
            <div className="data-catalog-section-title">
              <Typography.Text strong>业务分类体系</Typography.Text>
              <Button
                type="link"
                size="small"
                onClick={() => selectCategory(null)}
              >
                全部
              </Button>
            </div>
            <Tree
              blockNode
              defaultExpandAll
              selectedKeys={categoryCode ? [categoryCode] : []}
              treeData={taxonomyTreeData(tree)}
              onSelect={(keys) => selectCategory(String(keys[0] ?? "") || null)}
            />
            {selectedNode && (
              <Alert
                className="data-catalog-boundary"
                type="info"
                showIcon
                title={selectedNode.path.join(" / ")}
                description={selectedNode.description}
              />
            )}
          </aside>

          <section className="data-catalog-results">
            <Spin spinning={loading}>
              {resources.length ? (
                <div
                  className={
                    view === "cards"
                      ? "data-resource-grid"
                      : "data-resource-list"
                  }
                >
                  {resources.map((resource) => (
                    <ResourceCard
                      key={resource.id}
                      resource={resource}
                      compact={view === "list"}
                      onOpen={() => openResource(resource)}
                      onDetail={() => setDetailResource(resource)}
                    />
                  ))}
                </div>
              ) : (
                <Empty description="当前分类和筛选条件下暂无资源" />
              )}
            </Spin>
          </section>
        </div>
      </main>

      <Drawer
        title={detailResource?.name ?? "资源详情"}
        size="large"
        open={Boolean(detailResource)}
        onClose={() => setDetailResource(null)}
      >
        {detailResource && <ResourceDetails resource={detailResource} />}
      </Drawer>
    </Layout>
  );
}

function ResourceCard({
  resource,
  compact,
  onOpen,
  onDetail,
}: {
  resource: ResourceListItem;
  compact: boolean;
  onOpen: () => void;
  onDetail: () => void;
}) {
  const primaryAction = resource.availableViews.includes("map")
    ? "进入地图"
    : resource.availableViews.includes("table")
      ? "查看表格"
      : resource.availableViews.includes("gallery")
        ? "查看图片"
        : "查看元数据";
  return (
    <Card
      className={`data-resource-card${compact ? " data-resource-card-compact" : ""}`}
    >
      <Space orientation="vertical" size={10} className="full-width">
        <Space wrap>
          <Tag>{dataTypeLabels[resource.dataType]}</Tag>
          <Tag
            color={
              resource.classificationStatus === "classified"
                ? "green"
                : "orange"
            }
          >
            {resource.classificationStatus === "classified"
              ? "已分类"
              : "待归类"}
          </Tag>
        </Space>
        <Typography.Title level={4}>{resource.name}</Typography.Title>
        <Typography.Text
          className="data-resource-card-category"
          type="secondary"
        >
          {resource.categoryPath.length
            ? resource.categoryPath.map((item) => item.name).join(" / ")
            : "尚未挂接权威业务分类"}
        </Typography.Text>
        <Typography.Paragraph
          className="data-resource-card-description"
          ellipsis={{ rows: 2 }}
        >
          {catalogResourceSummary(resource)}
        </Typography.Paragraph>
        <Space className="data-resource-card-actions" wrap>
          <Button type="primary" onClick={onOpen}>
            {primaryAction}
          </Button>
          <Button icon={<EyeOutlined />} onClick={onDetail}>
            详情
          </Button>
        </Space>
      </Space>
    </Card>
  );
}

function ResourceDetails({ resource }: { resource: ResourceListItem }) {
  return (
    <Descriptions bordered size="small" column={1}>
      <Descriptions.Item label="业务分类">
        {resource.categoryPath.map((item) => item.name).join(" / ") || "待归类"}
      </Descriptions.Item>
      <Descriptions.Item label="物理类型">
        {dataTypeLabels[resource.dataType]}
      </Descriptions.Item>
      <Descriptions.Item label="可用视图">
        <Space wrap>
          {resource.availableViews.map((view) => (
            <Tag key={view}>{resourceViewLabels[view]}</Tag>
          ))}
        </Space>
      </Descriptions.Item>
      <Descriptions.Item label="来源">
        {resource.source || "未记录"}
      </Descriptions.Item>
      <Descriptions.Item label="提供单位">
        {resource.provider || "未记录"}
      </Descriptions.Item>
      <Descriptions.Item label="坐标系">
        {resource.coordinateSystem || "不适用"}
      </Descriptions.Item>
      <Descriptions.Item label="空间范围">
        {resource.spatialExtent || "不适用"}
      </Descriptions.Item>
      <Descriptions.Item label="说明">
        {catalogResourceSummary(resource, "未记录")}
      </Descriptions.Item>
    </Descriptions>
  );
}

function catalogResourceSummary(
  resource: ResourceListItem,
  fallback = "暂无资源说明",
) {
  const summary = (resource.description || resource.source).trim();
  if (!summary) return fallback;
  if (/^由 Excel\/CSV 导入的地理表[：:]\s*import_data_/i.test(summary)) {
    return "由 Excel/CSV 导入的地理表数据。";
  }
  if (/^由 Excel\/CSV 导入的非地理表[：:]\s*import_data_/i.test(summary)) {
    return "由 Excel/CSV 导入的非地理表数据。";
  }
  if (/^自动扫描统一.*GeoPackage 图层[：:]/i.test(summary)) {
    return "由平台自动扫描登记的 GeoPackage 矢量图层。";
  }
  return summary;
}

function taxonomyTreeData(nodes: DataSchemaCatalogNode[]): DataNode[] {
  return nodes.map((node) => ({
    key: node.categoryCode,
    title: (
      <Space size={6}>
        {node.code === "distribution" ? (
          <FileImageOutlined />
        ) : (
          <ApartmentOutlined />
        )}
        <span>{node.name}</span>
      </Space>
    ),
    children: taxonomyTreeData(node.children),
  }));
}
