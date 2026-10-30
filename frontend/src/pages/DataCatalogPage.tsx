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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import capfedLogoWhite from "../assets/capfed-logo-white.svg";
import homePoplarNightImage from "../assets/portal/home-poplar-night.png";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { platformBrand } from "../config/platformBrand";
import { useAppContext } from "../contexts/AppContext";
import { currentLocale } from "../i18n";
import { analysisResourceUrl } from "../utils/resources";
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

export default function DataCatalogPage() {
  const { message } = App.useApp();
  const { t } = useTranslation();
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
  const resourceRequestSequenceRef = useRef(0);
  const canBrowseData = Boolean(user?.permissions.canBrowseData);
  const dataTypeLabels = useMemo<Record<ResourceListItem["dataType"], string>>(
    () => ({
      vector: t("common.vector"),
      raster: t("common.raster"),
      gene: t("catalog.geneOmics"),
      table: t("common.table"),
      document: t("common.document"),
      image: t("common.image"),
    }),
    [t],
  );
  const portalQuickActions = useMemo(
    () => [
      {
        key: "overview",
        title: t("catalog.overviewAction"),
        description: t("catalog.overviewActionDescription"),
        path: "/resources/dashboard",
        icon: <DashboardOutlined />,
        tone: "cyan",
      },
      {
        key: "map",
        title: t("catalog.mapAction"),
        description: t("catalog.mapActionDescription"),
        path: "/map",
        icon: <GlobalOutlined />,
        tone: "green",
      },
      {
        key: "analysis",
        title: t("catalog.analysisAction"),
        description: t("catalog.analysisActionDescription"),
        path: "/nongeo",
        icon: <BarChartOutlined />,
        tone: "blue",
      },
      {
        key: "results",
        title: t("catalog.resultsAction"),
        description: t("catalog.resultsActionDescription"),
        path: "/results",
        icon: <FundProjectionScreenOutlined />,
        tone: "gold",
      },
    ],
    [t],
  );
  const visiblePortalQuickActions = useMemo(
    () =>
      user?.username === "guest"
        ? portalQuickActions.map((action) =>
            action.key === "overview"
              ? {
                  ...action,
                  title: t("catalog.publicAction"),
                  description: t("catalog.publicActionDescription"),
                  path: "#public-data-catalog",
                }
              : action,
          )
        : portalQuickActions,
    [portalQuickActions, t, user?.username],
  );
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
      const requestSequence = ++resourceRequestSequenceRef.current;
      if (!canBrowseData) {
        setResources([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await api.resources(filters);
        if (requestSequence === resourceRequestSequenceRef.current) {
          setResources(response.items);
        }
      } catch (error) {
        if (requestSequence === resourceRequestSequenceRef.current) {
          message.error(
            error instanceof Error ? error.message : t("catalog.loadFailed"),
          );
        }
      } finally {
        if (requestSequence === resourceRequestSequenceRef.current) {
          setLoading(false);
        }
      }
    },
    [canBrowseData, message, t],
  );

  function openQuickAction(path: string) {
    if (path === "#public-data-catalog") {
      document
        .getElementById("public-data-catalog")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    navigate(path);
  }

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
      navigate(analysisResourceUrl(resource));
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
                  alt={`${
                    currentLocale() === "en-US"
                      ? platformBrand.englishName
                      : platformBrand.chineseName
                  } Logo`}
                  width={54}
                  height={54}
                />
              </span>
              <span className="data-catalog-platform-name">
                <strong>
                  {currentLocale() === "en-US"
                    ? platformBrand.englishName
                    : platformBrand.chineseName}
                </strong>
                <span>
                  {currentLocale() === "en-US"
                    ? platformBrand.shortName
                    : platformBrand.englishName}
                </span>
              </span>
            </div>
            <div className="data-catalog-hero-eyebrow">
              <span className="data-catalog-hero-context">
                <GlobalOutlined />
                <span>{t("catalog.context")}</span>
              </span>
              <span className="data-catalog-hero-mission">
                {t("catalog.mission")}
              </span>
            </div>
            <Typography.Title level={1}>{t("catalog.title")}</Typography.Title>
            <Typography.Paragraph>{t("catalog.summary")}</Typography.Paragraph>
          </div>
          <div
            className="data-catalog-stats"
            aria-label={t("catalog.overview")}
          >
            <div className="data-catalog-stat-card">
              <Statistic
                title={
                  <span>
                    <DatabaseOutlined /> {t("catalog.visibleResources")}
                  </span>
                }
                value={resources.length}
                suffix={t("catalog.resourcesSuffix")}
              />
              <span>{t("catalog.unifiedOrganization")}</span>
            </div>
            <div className="data-catalog-stat-card">
              <Statistic
                title={
                  <span>
                    <ApartmentOutlined /> {t("catalog.businessDomains")}
                  </span>
                }
                value={tree.length}
                suffix={t("catalog.categoriesSuffix")}
              />
              <span>{t("catalog.ecologyThemes")}</span>
            </div>
            <div className="data-catalog-stat-card">
              <Statistic
                title={
                  <span>
                    <AppstoreOutlined /> {t("catalog.thematicCatalogs")}
                  </span>
                }
                value={catalogLeafCount}
                suffix={t("catalog.catalogsSuffix")}
              />
              <span>{t("catalog.organizationDimensions")}</span>
            </div>
            <div className="data-catalog-stat-card">
              <Statistic
                title={
                  <span>
                    <FileImageOutlined /> {t("catalog.dataForms")}
                  </span>
                }
                value={Object.keys(dataTypeLabels).length}
                suffix={t("catalog.formsSuffix")}
              />
              <span>{t("catalog.formsSummary")}</span>
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
                {t("catalog.quickTitle")}
              </Typography.Title>
            </div>
            <Typography.Paragraph>
              {t("catalog.quickSummary")}
            </Typography.Paragraph>
          </div>
          <div className="data-catalog-feature-grid">
            {visiblePortalQuickActions.map((action, index) => (
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
                onClick={() => openQuickAction(action.path)}
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
          <Alert
            type="warning"
            showIcon
            title={t("catalog.noBrowsePermission")}
          />
        )}

        <section id="public-data-catalog" className="data-catalog-toolbar">
          <Input.Search
            allowClear
            value={keyword}
            prefix={<SearchOutlined />}
            placeholder={t("catalog.searchPlaceholder")}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={applySearch}
          />
          <Select
            allowClear
            placeholder={t("catalog.physicalType")}
            value={dataType}
            options={Object.entries(dataTypeLabels).map(([value, label]) => ({
              value,
              label,
            }))}
            onChange={setDataType}
          />
          <Select
            allowClear
            placeholder={t("catalog.classificationStatus")}
            value={classificationStatus}
            options={[
              { value: "classified", label: t("catalog.classified") },
              { value: "pending", label: t("catalog.pending") },
            ]}
            onChange={setClassificationStatus}
          />
          <Segmented<CatalogView>
            value={view}
            onChange={setView}
            options={[
              {
                value: "cards",
                label: t("catalog.cards"),
                icon: <AppstoreOutlined />,
              },
              {
                value: "list",
                label: t("catalog.list"),
                icon: <DatabaseOutlined />,
              },
            ]}
          />
        </section>

        <div className="data-catalog-body">
          <aside className="data-catalog-taxonomy">
            <div className="data-catalog-section-title">
              <Typography.Text strong>{t("catalog.taxonomy")}</Typography.Text>
              <Button
                type="link"
                size="small"
                onClick={() => selectCategory(null)}
              >
                {t("common.all")}
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
                      dataTypeLabel={dataTypeLabels[resource.dataType]}
                      t={t}
                    />
                  ))}
                </div>
              ) : (
                <Empty description={t("catalog.empty")} />
              )}
            </Spin>
          </section>
        </div>
      </main>

      <Drawer
        title={detailResource?.name ?? t("catalog.resourceDetails")}
        size="large"
        open={Boolean(detailResource)}
        onClose={() => setDetailResource(null)}
      >
        {detailResource && (
          <ResourceDetails
            resource={detailResource}
            dataTypeLabel={dataTypeLabels[detailResource.dataType]}
            t={t}
          />
        )}
      </Drawer>
    </Layout>
  );
}

function ResourceCard({
  resource,
  compact,
  onOpen,
  onDetail,
  dataTypeLabel,
  t,
}: {
  resource: ResourceListItem;
  compact: boolean;
  onOpen: () => void;
  onDetail: () => void;
  dataTypeLabel: string;
  t: (key: string) => string;
}) {
  const primaryAction = resource.availableViews.includes("map")
    ? t("catalog.enterMap")
    : resource.availableViews.includes("table")
      ? t("catalog.viewTable")
      : resource.availableViews.includes("gallery")
        ? t("catalog.viewImage")
        : t("catalog.viewMetadata");
  return (
    <Card
      className={`data-resource-card${compact ? " data-resource-card-compact" : ""}`}
    >
      <Space orientation="vertical" size={10} className="full-width">
        <Space wrap>
          <Tag>{dataTypeLabel}</Tag>
          <Tag
            color={
              resource.classificationStatus === "classified"
                ? "green"
                : "orange"
            }
          >
            {resource.classificationStatus === "classified"
              ? t("catalog.classified")
              : t("catalog.pending")}
          </Tag>
        </Space>
        <Typography.Title level={4}>{resource.name}</Typography.Title>
        <Typography.Text
          className="data-resource-card-category"
          type="secondary"
        >
          {resource.categoryPath.length
            ? resource.categoryPath.map((item) => item.name).join(" / ")
            : t("catalog.noAuthoritativeCategory")}
        </Typography.Text>
        <Typography.Paragraph
          className="data-resource-card-description"
          ellipsis={{ rows: 2 }}
        >
          {catalogResourceSummary(resource, t("catalog.noDescription"), t)}
        </Typography.Paragraph>
        <Space className="data-resource-card-actions" wrap>
          <Button type="primary" onClick={onOpen}>
            {primaryAction}
          </Button>
          <Button icon={<EyeOutlined />} onClick={onDetail}>
            {t("common.details")}
          </Button>
        </Space>
      </Space>
    </Card>
  );
}

function ResourceDetails({
  resource,
  dataTypeLabel,
  t,
}: {
  resource: ResourceListItem;
  dataTypeLabel: string;
  t: (key: string) => string;
}) {
  return (
    <Descriptions bordered size="small" column={1}>
      <Descriptions.Item label={t("catalog.businessCategory")}>
        {resource.categoryPath.map((item) => item.name).join(" / ") ||
          t("catalog.pending")}
      </Descriptions.Item>
      <Descriptions.Item label={t("catalog.physicalType")}>
        {dataTypeLabel}
      </Descriptions.Item>
      <Descriptions.Item label={t("catalog.availableViews")}>
        <Space wrap>
          {resource.availableViews.map((view) => (
            <Tag key={view}>{resourceViewLabel(view, t)}</Tag>
          ))}
        </Space>
      </Descriptions.Item>
      <Descriptions.Item label={t("common.source")}>
        {resource.source || t("catalog.notRecorded")}
      </Descriptions.Item>
      <Descriptions.Item label={t("map.provider")}>
        {resource.provider || t("catalog.notRecorded")}
      </Descriptions.Item>
      <Descriptions.Item label={t("catalog.coordinateSystem")}>
        {resource.coordinateSystem || t("catalog.notApplicable")}
      </Descriptions.Item>
      <Descriptions.Item label={t("map.spatialExtent")}>
        {resource.spatialExtent || t("catalog.notApplicable")}
      </Descriptions.Item>
      <Descriptions.Item label={t("common.description")}>
        {catalogResourceSummary(resource, t("catalog.notRecorded"), t)}
      </Descriptions.Item>
    </Descriptions>
  );
}

function catalogResourceSummary(
  resource: ResourceListItem,
  fallback: string,
  t: (key: string) => string,
) {
  const summary = (resource.description || resource.source).trim();
  if (!summary) return fallback;
  if (/^由 Excel\/CSV 导入的地理表[：:]\s*import_data_/i.test(summary)) {
    return t("catalog.geographicImport");
  }
  if (/^由 Excel\/CSV 导入的非地理表[：:]\s*import_data_/i.test(summary)) {
    return t("catalog.nonGeographicImport");
  }
  if (/^自动扫描统一.*GeoPackage 图层[：:]/i.test(summary)) {
    return t("catalog.geopackageScan");
  }
  return summary;
}

function resourceViewLabel(
  view: ResourceListItem["availableViews"][number],
  t: (key: string) => string,
) {
  const labels = {
    map: t("catalog.mapView"),
    table: t("common.table"),
    gallery: t("catalog.galleryView"),
    metadata: t("catalog.metadataView"),
  };
  return labels[view];
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
