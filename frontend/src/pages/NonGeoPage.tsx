import {
  AppstoreOutlined,
  BarChartOutlined,
  BranchesOutlined,
  DatabaseOutlined,
  DotChartOutlined,
  ExperimentOutlined,
  FieldTimeOutlined,
  FileSearchOutlined,
  LineChartOutlined,
  NumberOutlined,
  ProfileOutlined,
  RadarChartOutlined,
  ReloadOutlined,
  SearchOutlined,
  TableOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Badge,
  Button,
  Empty,
  Input,
  Layout,
  Progress,
  Segmented,
  Select,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { TableProps } from "antd";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { platformBrand } from "../config/platformBrand";
import { useAppContext } from "../contexts/AppContext";
import type {
  DataDomainType,
  DataResource,
  DataSchemaSummary,
  ResourceListItem,
} from "../types";
import {
  isNonGeographicResource,
  resourceCategoryName,
  resourceFormatLabel,
  resourceProvider,
} from "../utils/resources";
import { taxonomyLeafOptions } from "../utils/taxonomy";

type ResourceTypeFilter = "all" | "table" | "gene";
type LeftPanelKey = "data" | "views" | "workspace" | "topics";
type NonGeoDomainType = Extract<DataDomainType, "molecular" | "genome">;
type NonGeoScalar = string | number | boolean | null;
type NonGeoFieldRole =
  | "identifier"
  | "category"
  | "measure"
  | "date"
  | "text"
  | "coordinate"
  | "unknown";
type NonGeoTableRow = Record<string, NonGeoScalar>;
type NonGeoFieldProfile = {
  name: string;
  type: string;
  label: string;
  description: string;
  unit: string;
  role: NonGeoFieldRole;
  nullable: boolean;
  nonNullCount: number;
  nullCount: number;
  completeness: number;
  uniqueCount: number;
  sampleValues: NonGeoScalar[];
  min?: number | null;
  max?: number | null;
  mean?: number | null;
};
type NonGeoTableQueryResult = {
  resourceId: number;
  resourceName: string;
  totalCount: number;
  returnedCount: number;
  limit: number;
  offset: number;
  fields: Array<{
    name: string;
    type: string;
    nullable: boolean;
    sampleValues: NonGeoScalar[];
    description: string;
  }>;
  rows: NonGeoTableRow[];
};
type NonGeoAnalytics = {
  resource: ResourceListItem;
  summary: {
    rowCount: number;
    fieldCount: number;
    numericFieldCount: number;
    textFieldCount: number;
    categoricalFieldCount: number;
    completeness: number;
    updatedAt: string;
    suggestedView:
      | "species"
      | "community"
      | "traits"
      | "environment"
      | "generic";
  };
  fields: NonGeoFieldProfile[];
  categoricalDistributions: Array<{
    field: string;
    label: string;
    total: number;
    items: Array<{ value: NonGeoScalar; count: number; ratio: number }>;
  }>;
  numericDistributions: Array<{
    field: string;
    label: string;
    min: number;
    max: number;
    mean: number;
    median: number;
    q1: number;
    q3: number;
    bins: Array<{
      label: string;
      min: number;
      max: number;
      count: number;
      ratio: number;
    }>;
  }>;
  correlation: { fields: string[]; values: number[][] } | null;
  tablePreview: NonGeoTableQueryResult;
  insights: string[];
};
type CategoricalDistribution =
  NonGeoAnalytics["categoricalDistributions"][number];
type NumericDistribution = NonGeoAnalytics["numericDistributions"][number];
type FieldProfile = NonGeoAnalytics["fields"][number];
type TableRow = NonGeoTableQueryResult["rows"][number];

const nonGeoTypeOptions = [
  { label: "全部", value: "all" },
  { label: "生态表", value: "table" },
  { label: "遗传", value: "gene" },
];

const nonGeoDomainTypes = new Set<DataDomainType>(["molecular", "genome"]);

const leftPanelOptions: Array<{
  key: LeftPanelKey;
  label: string;
  icon: ReactNode;
}> = [
  { key: "data", label: "数据资源", icon: <DatabaseOutlined /> },
  { key: "views", label: "分析视图", icon: <AppstoreOutlined /> },
  { key: "workspace", label: "工作区", icon: <ProfileOutlined /> },
  { key: "topics", label: "专题分析", icon: <ExperimentOutlined /> },
];

const analysisViewOptions = [
  {
    key: "overview",
    title: "总览视图",
    description: "记录总量、字段结构、完整率与核心分布",
    icon: <BarChartOutlined />,
  },
  {
    key: "species",
    title: "组成分布",
    description: "物种、生活型、样地类型等分类结构",
    icon: <BranchesOutlined />,
  },
  {
    key: "traits",
    title: "性状关系",
    description: "功能性状、指标相关性与二维关系",
    icon: <RadarChartOutlined />,
  },
  {
    key: "table",
    title: "明细表格",
    description: "字段预览、属性查询与表格核查",
    icon: <TableOutlined />,
  },
];

const topicPresets = [
  {
    key: "species",
    title: "群落多样性专题",
    description: "物种组成、生活型结构与群落分类对比",
  },
  {
    key: "traits",
    title: "功能性状专题",
    description: "性状分布、指标关系与生态功能差异",
  },
  {
    key: "overview",
    title: "数据质量专题",
    description: "字段完整率、记录规模与基础质量概览",
  },
  {
    key: "table",
    title: "原始记录专题",
    description: "表格明细、字段说明与属性查询结果",
  },
];

const analyticsPalette = [
  "#28e0c2",
  "#39c8ff",
  "#f3b54a",
  "#8f7cf8",
  "#5ee07a",
  "#ff6f91",
  "#77e4ff",
  "#d7f45d",
];

const roleLabels: Record<FieldProfile["role"], string> = {
  identifier: "标识",
  category: "分类",
  measure: "指标",
  date: "时间",
  text: "文本",
  coordinate: "坐标",
  unknown: "未知",
};

const demoUpdatedAt = "2026-06-20T00:00:00+08:00";

const demoResources: DataResource[] = [
  {
    id: 9001,
    name: "胡杨样地群落监测示例表",
    code: "demo-populus-community-table",
    dataType: "table",
    spatialClass: "non_spatial",
    domainType: "community",
    category: null,
    categoryPath: [],
    classificationStatus: "pending",
    availableViews: ["metadata"],
    defaultView: "metadata",
    source: "前端演示数据",
    provider: "中亚胡杨林生态系统保护项目组",
    dataDate: "2026-06-20",
    spatialExtent: "塔里木河中游示例样地",
    coordinateSystem: "",
    fileFormat: "DEMO",
    description: "用于展示非地理数据工作台的本地示例数据，后端合同尚未确定。",
    qualityNote: "演示数据不参与后端查询、导出或权限校验。",
    sizeBytes: 0,
    itemCount: 8,
    status: "active",
    isQueryable: false,
    isRenderable: false,
    updatedAt: demoUpdatedAt,
  },
  {
    id: 9002,
    name: "胡杨遗传标记示例集",
    code: "demo-populus-gene-table",
    dataType: "gene",
    spatialClass: "non_spatial",
    domainType: "molecular",
    category: null,
    categoryPath: [],
    classificationStatus: "pending",
    availableViews: ["metadata"],
    defaultView: "metadata",
    source: "前端演示数据",
    provider: "中亚胡杨林生态系统保护项目组",
    dataDate: "2026-06-20",
    spatialExtent: "中亚胡杨分布区",
    coordinateSystem: "",
    fileFormat: "DEMO",
    description: "用于展示基因非地理数据入口的本地示例资源。",
    qualityNote: "演示数据不代表真实测序结果。",
    sizeBytes: 0,
    itemCount: 6,
    status: "active",
    isQueryable: false,
    isRenderable: false,
    updatedAt: demoUpdatedAt,
  },
];

const demoPrimaryResource = demoResources[0]!;

const demoTableRows: TableRow[] = [
  {
    样地编号: "TLM-01",
    生活型: "乔木",
    物种: "胡杨",
    重要值: 42.6,
    盖度: 68,
    土壤含水率: 14.2,
  },
  {
    样地编号: "TLM-02",
    生活型: "灌木",
    物种: "柽柳",
    重要值: 31.4,
    盖度: 45,
    土壤含水率: 10.8,
  },
  {
    样地编号: "TLM-03",
    生活型: "草本",
    物种: "芦苇",
    重要值: 18.9,
    盖度: 37,
    土壤含水率: 18.1,
  },
  {
    样地编号: "TLM-04",
    生活型: "乔木",
    物种: "胡杨",
    重要值: 39.8,
    盖度: 61,
    土壤含水率: 12.7,
  },
  {
    样地编号: "TLM-05",
    生活型: "灌木",
    物种: "盐穗木",
    重要值: 22.3,
    盖度: 28,
    土壤含水率: 9.5,
  },
  {
    样地编号: "TLM-06",
    生活型: "乔木",
    物种: "胡杨",
    重要值: 45.1,
    盖度: 72,
    土壤含水率: 15.4,
  },
  {
    样地编号: "TLM-07",
    生活型: "草本",
    物种: "骆驼刺",
    重要值: 16.2,
    盖度: 24,
    土壤含水率: 8.9,
  },
  {
    样地编号: "TLM-08",
    生活型: "灌木",
    物种: "柽柳",
    重要值: 27.7,
    盖度: 33,
    土壤含水率: 11.6,
  },
];

const demoFields: NonGeoAnalytics["fields"] = [
  {
    name: "样地编号",
    type: "string",
    label: "样地编号",
    description: "样地调查记录编号",
    unit: "",
    role: "identifier",
    nullable: false,
    nonNullCount: 8,
    nullCount: 0,
    completeness: 1,
    uniqueCount: 8,
    sampleValues: ["TLM-01", "TLM-02", "TLM-03"],
  },
  {
    name: "生活型",
    type: "string",
    label: "生活型",
    description: "植物生活型分类",
    unit: "",
    role: "category",
    nullable: false,
    nonNullCount: 8,
    nullCount: 0,
    completeness: 1,
    uniqueCount: 3,
    sampleValues: ["乔木", "灌木", "草本"],
  },
  {
    name: "物种",
    type: "string",
    label: "物种",
    description: "优势或伴生植物名称",
    unit: "",
    role: "category",
    nullable: false,
    nonNullCount: 8,
    nullCount: 0,
    completeness: 1,
    uniqueCount: 5,
    sampleValues: ["胡杨", "柽柳", "芦苇"],
  },
  {
    name: "重要值",
    type: "float",
    label: "重要值",
    description: "群落优势度综合指标",
    unit: "",
    role: "measure",
    nullable: false,
    nonNullCount: 8,
    nullCount: 0,
    completeness: 1,
    uniqueCount: 8,
    sampleValues: [42.6, 31.4, 18.9],
    min: 16.2,
    max: 45.1,
    mean: 30.5,
  },
  {
    name: "盖度",
    type: "float",
    label: "盖度",
    description: "样地植被盖度",
    unit: "%",
    role: "measure",
    nullable: false,
    nonNullCount: 8,
    nullCount: 0,
    completeness: 1,
    uniqueCount: 8,
    sampleValues: [68, 45, 37],
    min: 24,
    max: 72,
    mean: 46,
  },
  {
    name: "土壤含水率",
    type: "float",
    label: "土壤含水率",
    description: "表层土壤含水率",
    unit: "%",
    role: "measure",
    nullable: false,
    nonNullCount: 8,
    nullCount: 0,
    completeness: 1,
    uniqueCount: 8,
    sampleValues: [14.2, 10.8, 18.1],
    min: 8.9,
    max: 18.1,
    mean: 12.65,
  },
];

const demoTablePreview: NonGeoTableQueryResult = {
  resourceId: 9001,
  resourceName: "胡杨样地群落监测示例表",
  totalCount: demoTableRows.length,
  returnedCount: demoTableRows.length,
  limit: 80,
  offset: 0,
  fields: demoFields.map((field) => ({
    name: field.name,
    type: field.type,
    nullable: field.nullable,
    sampleValues: field.sampleValues,
    description: field.description,
  })),
  rows: demoTableRows,
};

const demoAnalytics: NonGeoAnalytics = {
  resource: demoPrimaryResource,
  summary: {
    rowCount: demoTableRows.length,
    fieldCount: demoFields.length,
    numericFieldCount: 3,
    textFieldCount: 0,
    categoricalFieldCount: 2,
    completeness: 1,
    updatedAt: demoUpdatedAt,
    suggestedView: "species",
  },
  fields: demoFields,
  categoricalDistributions: [
    {
      field: "生活型",
      label: "生活型",
      total: 8,
      items: [
        { value: "乔木", count: 3, ratio: 0.375 },
        { value: "灌木", count: 3, ratio: 0.375 },
        { value: "草本", count: 2, ratio: 0.25 },
      ],
    },
    {
      field: "物种",
      label: "物种",
      total: 8,
      items: [
        { value: "胡杨", count: 3, ratio: 0.375 },
        { value: "柽柳", count: 2, ratio: 0.25 },
        { value: "芦苇", count: 1, ratio: 0.125 },
        { value: "盐穗木", count: 1, ratio: 0.125 },
        { value: "骆驼刺", count: 1, ratio: 0.125 },
      ],
    },
  ],
  numericDistributions: [
    {
      field: "重要值",
      label: "重要值",
      min: 16.2,
      max: 45.1,
      mean: 30.5,
      median: 29.55,
      q1: 21.45,
      q3: 40.5,
      bins: [
        { label: "16.2-23.4", min: 16.2, max: 23.4, count: 3, ratio: 0.375 },
        { label: "23.4-30.6", min: 23.4, max: 30.6, count: 1, ratio: 0.125 },
        { label: "30.6-37.9", min: 30.6, max: 37.9, count: 1, ratio: 0.125 },
        { label: "37.9-45.1", min: 37.9, max: 45.1, count: 3, ratio: 0.375 },
      ],
    },
    {
      field: "盖度",
      label: "盖度",
      min: 24,
      max: 72,
      mean: 46,
      median: 41,
      q1: 31.75,
      q3: 62.75,
      bins: [
        { label: "24-36", min: 24, max: 36, count: 3, ratio: 0.375 },
        { label: "36-48", min: 36, max: 48, count: 2, ratio: 0.25 },
        { label: "48-60", min: 48, max: 60, count: 0, ratio: 0 },
        { label: "60-72", min: 60, max: 72, count: 3, ratio: 0.375 },
      ],
    },
  ],
  correlation: {
    fields: ["重要值", "盖度", "土壤含水率"],
    values: [
      [1, 0.94, 0.58],
      [0.94, 1, 0.63],
      [0.58, 0.63, 1],
    ],
  },
  tablePreview: demoTablePreview,
  insights: [
    "示例表包含 8 条样地记录和 6 个字段。",
    "胡杨样地在重要值和盖度上占优，适合展示组成分布和性状关系视图。",
    "当前展示为资源级分析预览，可用于核对数据组成、性状分布与明细结构。",
  ],
};

export default function NonGeoPage() {
  const { user } = useAppContext();
  const { message } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const permissions = user?.permissions;
  const canBrowseData = Boolean(permissions?.canBrowseData);
  const canQueryData = Boolean(permissions?.canQueryData);
  const [resources, setResources] = useState<ResourceListItem[]>([]);
  const [dataSchema, setDataSchema] = useState<DataSchemaSummary | null>(null);
  const [resourceKeyword, setResourceKeyword] = useState("");
  const [resourceType, setResourceType] = useState<ResourceTypeFilter>("all");
  const [activeLeftPanel, setActiveLeftPanel] = useState<LeftPanelKey>("data");
  const [activeResourceId, setActiveResourceId] = useState<number | null>(null);
  const [loadingResources, setLoadingResources] = useState(false);
  const [analytics, setAnalytics] = useState<NonGeoAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [tableResult, setTableResult] = useState<NonGeoTableQueryResult | null>(
    null,
  );
  const [queryingTable, setQueryingTable] = useState(false);
  const [analysisTab, setAnalysisTab] = useState("overview");
  const [selectedMetricField, setSelectedMetricField] = useState<
    string | undefined
  >();
  const selectedDomainType = useMemo<NonGeoDomainType | null>(() => {
    const value = searchParams.get("domainType");
    return nonGeoDomainTypes.has(value as DataDomainType)
      ? (value as NonGeoDomainType)
      : null;
  }, [searchParams]);
  const selectedCategoryCode = searchParams.get("categoryCode") || undefined;
  const categoryOptions = useMemo(
    () => taxonomyLeafOptions(dataSchema),
    [dataSchema],
  );

  const selectedResource = useMemo(
    () =>
      resources.find((resource) => resource.id === activeResourceId) ?? null,
    [activeResourceId, resources],
  );

  const filteredResources = useMemo(() => {
    const keyword = resourceKeyword.trim().toLowerCase();
    return resources.filter((resource) => {
      if (resourceType !== "all" && resource.dataType !== resourceType) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      const haystack = [
        resource.name,
        resource.code,
        resource.source,
        resource.provider,
        resource.description,
        resourceCategoryName(resource) ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [resourceKeyword, resourceType, resources]);

  const tableData = tableResult ?? analytics?.tablePreview ?? null;
  const primaryCategory = analytics?.categoricalDistributions[0] ?? null;
  const secondaryCategory = analytics?.categoricalDistributions[1] ?? null;
  const lifeFormDistribution =
    analytics?.categoricalDistributions.find((item) =>
      item.field.includes("生活型"),
    ) ??
    analytics?.categoricalDistributions[2] ??
    null;
  const numericDistributions = analytics?.numericDistributions ?? [];
  const primaryNumeric =
    numericDistributions.find((item) => item.field === selectedMetricField) ??
    numericDistributions[0] ??
    null;
  const secondaryNumeric =
    numericDistributions.find((item) => item.field !== primaryNumeric?.field) ??
    numericDistributions[1] ??
    null;
  const measureFields =
    analytics?.fields.filter((field) => field.role === "measure") ?? [];
  const categoryFields =
    analytics?.fields.filter((field) => field.role === "category") ?? [];

  const loadResources = useCallback(async () => {
    if (!canBrowseData) {
      setResources([]);
      setActiveResourceId(null);
      return;
    }
    setLoadingResources(true);
    try {
      const response = await api.resources({
        spatialClass: "non_spatial",
        ...(selectedDomainType ? { domainType: selectedDomainType } : {}),
        ...(selectedCategoryCode ? { categoryCode: selectedCategoryCode } : {}),
      });
      const items = response.items.filter(isNonGeographicResource);
      setResources(items);
      setActiveResourceId((current) =>
        current !== null && items.some((resource) => resource.id === current)
          ? current
          : (items[0]?.id ?? null),
      );
    } catch (error) {
      setResources([]);
      setActiveResourceId(null);
      message.error(
        error instanceof Error ? error.message : "非地理数据资源加载失败",
      );
    } finally {
      setLoadingResources(false);
    }
  }, [canBrowseData, message, selectedCategoryCode, selectedDomainType]);

  useEffect(() => {
    if (!canBrowseData) return;
    let ignore = false;
    api
      .dataSchemaSummary()
      .then((result) => {
        if (!ignore) setDataSchema(result);
      })
      .catch(() => {
        if (!ignore) setDataSchema(null);
      });
    return () => {
      ignore = true;
    };
  }, [canBrowseData]);

  const loadAnalytics = useCallback(
    async (resourceId: number) => {
      setLoadingAnalytics(true);
      setAnalyticsError("");
      setTableResult(null);
      const resource = resources.find((item) => item.id === resourceId);
      if (resource) {
        setAnalytics({
          ...demoAnalytics,
          resource,
          tablePreview: {
            ...demoTablePreview,
            resourceId: resource.id,
            resourceName: resource.name,
          },
        });
        setAnalyticsError("");
      } else {
        setAnalytics(null);
        setAnalyticsError("未找到非地理数据资源");
      }
      setLoadingAnalytics(false);
    },
    [resources],
  );

  const queryTable = useCallback(async () => {
    if (!activeResourceId) {
      return;
    }
    if (!canQueryData) {
      message.warning("当前角色无数据查询权限");
      return;
    }
    setQueryingTable(true);
    const resourceName =
      selectedResource?.name ?? demoTablePreview.resourceName;
    const rows = primaryNumeric
      ? [...demoTableRows].sort(
          (left, right) =>
            Number(right[primaryNumeric.field] ?? 0) -
            Number(left[primaryNumeric.field] ?? 0),
        )
      : demoTableRows;
    setTableResult({
      ...demoTablePreview,
      resourceId: activeResourceId,
      resourceName,
      rows,
      returnedCount: rows.length,
      totalCount: rows.length,
    });
    setAnalysisTab("table");
    setQueryingTable(false);
  }, [
    activeResourceId,
    canQueryData,
    message,
    primaryNumeric,
    selectedResource,
  ]);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  useEffect(() => {
    if (!selectedDomainType) {
      return;
    }
    setResourceType("gene");
    setActiveLeftPanel("data");
  }, [selectedDomainType]);

  useEffect(() => {
    if (activeResourceId !== null) {
      void loadAnalytics(activeResourceId);
    }
  }, [activeResourceId, loadAnalytics]);

  const tableColumns = useMemo<TableProps<TableRow>["columns"]>(() => {
    const fields = tableData?.fields.slice(0, 8) ?? [];
    return fields.map((field) => ({
      title: (
        <span className="nongeo-table-heading">
          <span>{field.name}</span>
          {field.description && <small>{field.description}</small>}
        </span>
      ),
      dataIndex: field.name,
      key: field.name,
      ellipsis: true,
      render: (value: TableRow[string]) => valueLabel(value),
    }));
  }, [tableData]);

  const tabs = useMemo(
    () => [
      {
        key: "overview",
        label: (
          <span>
            <BarChartOutlined /> 总览
          </span>
        ),
        children: (
          <OverviewContent
            analytics={analytics}
            primaryCategory={primaryCategory}
            secondaryCategory={secondaryCategory}
            primaryNumeric={primaryNumeric}
            lifeFormDistribution={lifeFormDistribution}
          />
        ),
      },
      {
        key: "species",
        label: (
          <span>
            <BranchesOutlined /> 组成
          </span>
        ),
        children: (
          <CompositionContent
            analytics={analytics}
            selected={primaryCategory}
          />
        ),
      },
      {
        key: "traits",
        label: (
          <span>
            <RadarChartOutlined /> 性状
          </span>
        ),
        children: (
          <TraitsContent
            analytics={analytics}
            tableData={tableData}
            numeric={secondaryNumeric}
          />
        ),
      },
      {
        key: "table",
        label: (
          <span>
            <TableOutlined /> 明细
          </span>
        ),
        children: (
          <TableContent
            data={tableData}
            columns={tableColumns}
            querying={queryingTable}
            onQuery={queryTable}
          />
        ),
      },
    ],
    [
      analytics,
      lifeFormDistribution,
      primaryCategory,
      primaryNumeric,
      queryTable,
      queryingTable,
      secondaryCategory,
      secondaryNumeric,
      tableColumns,
      tableData,
    ],
  );

  const activeView =
    analysisViewOptions.find((item) => item.key === analysisTab) ??
    analysisViewOptions[0]!;
  const dataTypeLabel =
    resourceType === "table"
      ? "生态表格"
      : resourceType === "gene"
        ? "遗传数据"
        : "全部资源";

  const leftPanelContent = (
    <>
      {activeLeftPanel === "data" && (
        <>
          <PanelTitle
            icon={<DatabaseOutlined />}
            title="数据资源"
            extra={
              <Button
                size="small"
                type="text"
                aria-label="刷新非地理数据资源"
                icon={<ReloadOutlined />}
                loading={loadingResources}
                onClick={() => void loadResources()}
              />
            }
          />
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索生态表格、遗传数据、来源"
            allowClear
            value={resourceKeyword}
            onChange={(event) => setResourceKeyword(event.target.value)}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="按权威业务分类筛选"
            value={selectedCategoryCode}
            options={categoryOptions}
            onChange={(categoryCode) => {
              const next = new URLSearchParams(searchParams);
              if (categoryCode) next.set("categoryCode", categoryCode);
              else next.delete("categoryCode");
              setSearchParams(next, { replace: true });
            }}
          />
          <Segmented
            block
            options={nonGeoTypeOptions}
            value={resourceType}
            onChange={(value) => setResourceType(value as ResourceTypeFilter)}
          />
          <div className="nongeo-resource-count">
            <span>{filteredResources.length} 个资源</span>
            <Tag color="cyan">{dataTypeLabel}</Tag>
          </div>
          <div className="nongeo-resource-list">
            {loadingResources ? (
              <Skeleton active paragraph={{ rows: 7 }} title={false} />
            ) : filteredResources.length > 0 ? (
              filteredResources.map((resource) => (
                <ResourceRow
                  key={resourceKey(resource)}
                  resource={resource}
                  active={resource.id === activeResourceId}
                  onSelect={() => setActiveResourceId(resource.id)}
                />
              ))
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无非地理数据资源"
              />
            )}
          </div>
        </>
      )}

      {activeLeftPanel === "views" && (
        <>
          <PanelTitle icon={<AppstoreOutlined />} title="分析视图" />
          <div className="nongeo-view-list">
            {analysisViewOptions.map((view) => (
              <button
                key={view.key}
                type="button"
                className={
                  analysisTab === view.key
                    ? "nongeo-view-row nongeo-view-row-active"
                    : "nongeo-view-row"
                }
                onClick={() => setAnalysisTab(view.key)}
              >
                <span className="nongeo-view-icon">{view.icon}</span>
                <span>
                  <strong>{view.title}</strong>
                  <small>{view.description}</small>
                </span>
              </button>
            ))}
          </div>
          <section className="nongeo-current-card">
            <Typography.Text strong>当前画布</Typography.Text>
            <span>{activeView.title}</span>
            <small>{selectedResource?.name ?? "未选择数据资源"}</small>
          </section>
        </>
      )}

      {activeLeftPanel === "workspace" && (
        <>
          <PanelTitle icon={<ProfileOutlined />} title="工作区" />
          <section className="nongeo-current-card nongeo-workspace-card">
            <Typography.Text strong>
              {selectedResource?.name ?? "未选择数据资源"}
            </Typography.Text>
            <div className="nongeo-state-list">
              <span>
                <small>当前视图</small>
                <strong>{activeView.title}</strong>
              </span>
              <span>
                <small>记录量</small>
                <strong>
                  {analytics ? formatCompact(analytics.summary.rowCount) : "-"}
                </strong>
              </span>
              <span>
                <small>字段数</small>
                <strong>{analytics?.summary.fieldCount ?? "-"}</strong>
              </span>
              <span>
                <small>完整率</small>
                <strong>
                  {analytics
                    ? formatPercent(analytics.summary.completeness)
                    : "-"}
                </strong>
              </span>
            </div>
          </section>
          <section className="nongeo-mini-section">
            <PanelTitle icon={<TagsOutlined />} title="分析资产" />
            <div className="nongeo-chip-grid">
              <span className="nongeo-chip">资源快照</span>
              <span className="nongeo-chip">视图组合</span>
              <span className="nongeo-chip">字段口径</span>
              <span className="nongeo-chip">质量概览</span>
            </div>
          </section>
        </>
      )}

      {activeLeftPanel === "topics" && (
        <>
          <PanelTitle icon={<ExperimentOutlined />} title="专题分析" />
          <div className="nongeo-topic-list">
            {topicPresets.map((topic) => (
              <button
                key={topic.title}
                type="button"
                className={
                  analysisTab === topic.key
                    ? "nongeo-topic-row nongeo-topic-row-active"
                    : "nongeo-topic-row"
                }
                onClick={() => setAnalysisTab(topic.key)}
              >
                <strong>{topic.title}</strong>
                <small>{topic.description}</small>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );

  return (
    <Layout className="workspace">
      <WorkspaceHeader
        activeTab="nongeo"
        canBrowseData={canBrowseData}
        dataSchema={dataSchema}
      />
      <div className="workspace-body workspace-body-nongeo">
        <main className="nongeo-stage" aria-label="非地理数据分析工作台">
          <aside className="nongeo-panel nongeo-resource-panel">
            <div className="nongeo-workbench-tabs" role="tablist">
              {leftPanelOptions.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={activeLeftPanel === item.key}
                  className={
                    activeLeftPanel === item.key
                      ? "nongeo-workbench-tab nongeo-workbench-tab-active"
                      : "nongeo-workbench-tab"
                  }
                  onClick={() => setActiveLeftPanel(item.key)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="nongeo-left-content">{leftPanelContent}</div>
          </aside>

          <section className="nongeo-panel nongeo-analysis-panel">
            <div className="nongeo-analysis-head">
              <div>
                <Typography.Text className="nongeo-kicker">
                  {platformBrand.shortName} 非地理生态数据分析
                </Typography.Text>
                <Typography.Title level={2}>
                  {analytics?.resource.name ??
                    selectedResource?.name ??
                    "请选择非地理数据资源"}
                </Typography.Title>
              </div>
              <Space className="nongeo-analysis-tools">
                <div className="nongeo-metric-selector">
                  <span className="nongeo-metric-selector-icon">
                    <NumberOutlined />
                  </span>
                  <span className="nongeo-metric-selector-label">核心指标</span>
                  <Select
                    className="nongeo-field-select"
                    placeholder="指标字段"
                    value={primaryNumeric?.field}
                    popupMatchSelectWidth={false}
                    options={numericDistributions.map((field) => ({
                      value: field.field,
                      label: field.label || field.field,
                    }))}
                    onChange={setSelectedMetricField}
                  />
                </div>
                <Button
                  icon={<FileSearchOutlined />}
                  loading={queryingTable}
                  onClick={() => void queryTable()}
                >
                  查询明细
                </Button>
              </Space>
            </div>

            {!canBrowseData ? (
              <PermissionEmpty />
            ) : loadingAnalytics ? (
              <div className="nongeo-loading">
                <Skeleton active paragraph={{ rows: 12 }} />
              </div>
            ) : analyticsError ? (
              <Alert
                type="warning"
                showIcon
                title="非地理分析接口暂不可用"
                description={analyticsError}
              />
            ) : analytics ? (
              <Tabs
                className="nongeo-tabs"
                activeKey={analysisTab}
                onChange={setAnalysisTab}
                items={tabs}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="请选择左侧非地理数据资源"
              />
            )}
          </section>

          <aside className="nongeo-panel nongeo-insight-panel">
            <PanelTitle icon={<ProfileOutlined />} title="字段与洞察" />
            {analytics ? (
              <>
                <section className="nongeo-resource-profile">
                  <Typography.Text strong>
                    {analytics.resource.name}
                  </Typography.Text>
                  <Typography.Paragraph ellipsis={{ rows: 3 }}>
                    {"description" in analytics.resource &&
                    analytics.resource.description
                      ? analytics.resource.description
                      : "暂无资源描述"}
                  </Typography.Paragraph>
                  <div className="nongeo-profile-tags">
                    <Tag color="cyan">
                      {resourceFormatLabel(analytics.resource)}
                    </Tag>
                    <Tag>
                      {resourceCategoryName(analytics.resource) ?? "未分类"}
                    </Tag>
                    <Tag>
                      {resourceProvider(analytics.resource) || "未记录单位"}
                    </Tag>
                  </div>
                </section>
                <MetricRing value={analytics.summary.completeness} />
                <section className="nongeo-mini-section">
                  <PanelTitle icon={<TagsOutlined />} title="字段角色" />
                  <div className="nongeo-role-grid">
                    <RoleCounter label="指标" value={measureFields.length} />
                    <RoleCounter label="分类" value={categoryFields.length} />
                    <RoleCounter
                      label="文本"
                      value={analytics.summary.textFieldCount}
                    />
                  </div>
                </section>
                <section className="nongeo-mini-section">
                  <PanelTitle icon={<ExperimentOutlined />} title="数据洞察" />
                  <div className="nongeo-insight-list">
                    {analytics.insights.map((insight) => (
                      <div key={insight} className="nongeo-insight-item">
                        <span />
                        <Typography.Text>{insight}</Typography.Text>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="nongeo-mini-section">
                  <PanelTitle icon={<FieldTimeOutlined />} title="字段完整率" />
                  <FieldCompleteness fields={analytics.fields} />
                </section>
              </>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="选择数据后查看字段画像"
              />
            )}
          </aside>
        </main>
      </div>
    </Layout>
  );
}

function OverviewContent({
  analytics,
  primaryCategory,
  secondaryCategory,
  primaryNumeric,
  lifeFormDistribution,
}: {
  analytics: NonGeoAnalytics | null;
  primaryCategory: CategoricalDistribution | null;
  secondaryCategory: CategoricalDistribution | null;
  primaryNumeric: NumericDistribution | null;
  lifeFormDistribution: CategoricalDistribution | null;
}) {
  if (!analytics) {
    return null;
  }
  return (
    <div className="nongeo-tab-grid">
      <div className="nongeo-metric-grid">
        <MetricCard
          icon={<DatabaseOutlined />}
          label="记录总量"
          value={formatCompact(analytics.summary.rowCount)}
          detail={`${analytics.summary.fieldCount} 个字段`}
        />
        <MetricCard
          icon={<NumberOutlined />}
          label="数值指标"
          value={analytics.summary.numericFieldCount}
          detail="可用于趋势和相关分析"
        />
        <MetricCard
          icon={<TagsOutlined />}
          label="分类维度"
          value={analytics.summary.categoricalFieldCount}
          detail="可用于构成和排行"
        />
        <MetricCard
          icon={<AppstoreOutlined />}
          label="完整率"
          value={formatPercent(analytics.summary.completeness)}
          detail="全表非空单元格占比"
        />
      </div>
      <div className="nongeo-chart-grid nongeo-chart-grid-2">
        <ChartBox
          title={primaryCategory?.label ?? "分类分布"}
          icon={<BarChartOutlined />}
        >
          {primaryCategory ? (
            <HorizontalBarChart data={primaryCategory} />
          ) : (
            <ChartEmpty />
          )}
        </ChartBox>
        <ChartBox
          title={lifeFormDistribution?.label ?? "构成分析"}
          icon={<DotChartOutlined />}
        >
          {lifeFormDistribution ? (
            <DonutChart data={lifeFormDistribution} />
          ) : (
            <ChartEmpty />
          )}
        </ChartBox>
        <ChartBox
          title={primaryNumeric?.label ?? "数值分布"}
          icon={<LineChartOutlined />}
        >
          {primaryNumeric ? (
            <HistogramChart data={primaryNumeric} />
          ) : (
            <ChartEmpty />
          )}
        </ChartBox>
        <ChartBox
          title={secondaryCategory?.label ?? "分类排行"}
          icon={<BranchesOutlined />}
        >
          {secondaryCategory ? (
            <RankingList data={secondaryCategory} />
          ) : (
            <ChartEmpty />
          )}
        </ChartBox>
      </div>
    </div>
  );
}

function CompositionContent({
  analytics,
  selected,
}: {
  analytics: NonGeoAnalytics | null;
  selected: CategoricalDistribution | null;
}) {
  if (!analytics) {
    return null;
  }
  return (
    <div className="nongeo-chart-grid nongeo-chart-grid-3">
      {analytics.categoricalDistributions.slice(0, 6).map((distribution) => (
        <ChartBox
          key={distribution.field}
          title={distribution.label}
          icon={<BarChartOutlined />}
        >
          <HorizontalBarChart data={distribution} compact />
        </ChartBox>
      ))}
      {selected && (
        <ChartBox title="结构占比" icon={<DotChartOutlined />}>
          <DonutChart data={selected} />
        </ChartBox>
      )}
    </div>
  );
}

function TraitsContent({
  analytics,
  tableData,
  numeric,
}: {
  analytics: NonGeoAnalytics | null;
  tableData: NonGeoTableQueryResult | null;
  numeric: NumericDistribution | null;
}) {
  if (!analytics) {
    return null;
  }
  return (
    <div className="nongeo-chart-grid nongeo-chart-grid-2">
      <ChartBox title="性状二维关系" icon={<DotChartOutlined />}>
        <ScatterChart tableData={tableData} />
      </ChartBox>
      <ChartBox title="生态指标相关性" icon={<RadarChartOutlined />}>
        {analytics.correlation ? (
          <CorrelationHeatmap data={analytics.correlation} />
        ) : (
          <ChartEmpty />
        )}
      </ChartBox>
      <ChartBox
        title={numeric?.label ?? "指标箱线概览"}
        icon={<LineChartOutlined />}
      >
        {numeric ? <BoxSummary data={numeric} /> : <ChartEmpty />}
      </ChartBox>
      <ChartBox title="重点字段画像" icon={<ProfileOutlined />}>
        <FieldSummary fields={analytics.fields} />
      </ChartBox>
    </div>
  );
}

function TableContent({
  data,
  columns,
  querying,
  onQuery,
}: {
  data: NonGeoTableQueryResult | null;
  columns: TableProps<TableRow>["columns"];
  querying: boolean;
  onQuery: () => void;
}) {
  return (
    <div className="nongeo-table-panel">
      <div className="nongeo-table-toolbar">
        <Typography.Text>
          {data
            ? `展示 ${data.returnedCount} / ${data.totalCount} 条记录`
            : "暂无表格预览"}
        </Typography.Text>
        <Button icon={<ReloadOutlined />} loading={querying} onClick={onQuery}>
          刷新明细
        </Button>
      </div>
      <Table<TableRow>
        size="small"
        className="nongeo-data-table"
        columns={columns}
        dataSource={data?.rows ?? []}
        rowKey={stableRowKey}
        pagination={{ pageSize: 8, showSizeChanger: false }}
        scroll={{ x: 920 }}
      />
    </div>
  );
}

function ResourceRow({
  resource,
  active,
  onSelect,
}: {
  resource: ResourceListItem;
  active: boolean;
  onSelect: () => void;
}) {
  const typeLabel = nonGeoResourceTypeLabel(resource.dataType);
  const count = resource.itemCount;
  return (
    <button
      type="button"
      className={
        active
          ? "nongeo-resource-row nongeo-resource-row-active"
          : "nongeo-resource-row"
      }
      onClick={onSelect}
    >
      <span className="nongeo-resource-row-top">
        <Typography.Text strong>{resource.name}</Typography.Text>
        <Badge color={active ? "#28e0c2" : "#6c8790"} text={typeLabel} />
      </span>
      <span className="nongeo-resource-row-meta">
        {resourceCategoryName(resource) ?? "未分类"} ·{" "}
        {resourceFormatLabel(resource)}
      </span>
      <span className="nongeo-resource-row-foot">
        <span>{formatCompact(count ?? 0)} 条</span>
        <span>{resource.source || "未记录来源"}</span>
      </span>
    </button>
  );
}

function nonGeoResourceTypeLabel(dataType: ResourceListItem["dataType"]) {
  switch (dataType) {
    case "table":
      return "表格";
    case "gene":
      return "遗传";
    case "document":
      return "文档";
    case "image":
      return "图片";
    default:
      return dataType;
  }
}

function PanelTitle({
  icon,
  title,
  extra,
}: {
  icon: ReactNode;
  title: string;
  extra?: ReactNode;
}) {
  return (
    <div className="nongeo-panel-title">
      <span>
        {icon}
        <Typography.Text strong>{title}</Typography.Text>
      </span>
      {extra}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <section className="nongeo-metric-card">
      <span className="nongeo-metric-icon">{icon}</span>
      <div>
        <Typography.Text>{label}</Typography.Text>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </section>
  );
}

function ChartBox({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="nongeo-chart-box">
      <div className="nongeo-chart-title">
        <span>
          {icon}
          <Typography.Text strong>{title}</Typography.Text>
        </span>
      </div>
      {children}
    </section>
  );
}

function HorizontalBarChart({
  data,
  compact = false,
}: {
  data: CategoricalDistribution;
  compact?: boolean;
}) {
  const max = Math.max(...data.items.map((item) => item.count), 1);
  return (
    <div
      className={compact ? "nongeo-bars nongeo-bars-compact" : "nongeo-bars"}
    >
      {data.items.slice(0, compact ? 6 : 8).map((item) => (
        <div
          key={`${data.field}-${valueLabel(item.value)}`}
          className="nongeo-bar-row"
        >
          <span>{valueLabel(item.value)}</span>
          <div>
            <i style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <em>{formatCompact(item.count)}</em>
        </div>
      ))}
    </div>
  );
}

function RankingList({ data }: { data: CategoricalDistribution }) {
  return (
    <div className="nongeo-ranking-list">
      {data.items.slice(0, 6).map((item) => (
        <div key={`${data.field}-${valueLabel(item.value)}`}>
          <span>{valueLabel(item.value)}</span>
          <Progress
            percent={Math.round(item.ratio * 100)}
            showInfo={false}
            strokeColor="#16b8a9"
            railColor="rgba(32,91,84,0.12)"
          />
          <em>{formatPercent(item.ratio)}</em>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data }: { data: CategoricalDistribution }) {
  const total = Math.max(data.total, 1);
  let cursor = 0;
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="nongeo-donut-wrap">
      <svg viewBox="0 0 120 120" aria-label={data.label}>
        <circle cx="60" cy="60" r={radius} className="nongeo-donut-track" />
        {data.items.slice(0, 6).map((item, itemIndex) => {
          const length = Math.max(item.count / total, 0.008) * circumference;
          const offset = -cursor * circumference;
          cursor += item.count / total;
          return (
            <circle
              key={`${data.field}-${valueLabel(item.value)}`}
              cx="60"
              cy="60"
              r={radius}
              className="nongeo-donut-segment"
              style={{
                stroke: analyticsPalette[itemIndex % analyticsPalette.length],
                strokeDasharray: `${length} ${circumference - length}`,
                strokeDashoffset: offset,
              }}
            />
          );
        })}
        <text x="60" y="56" textAnchor="middle">
          {formatCompact(total)}
        </text>
        <text x="60" y="73" textAnchor="middle" className="nongeo-donut-sub">
          records
        </text>
      </svg>
      <div className="nongeo-donut-legend">
        {data.items.slice(0, 6).map((item, itemIndex) => (
          <span key={`${data.field}-legend-${valueLabel(item.value)}`}>
            <i
              style={{
                background:
                  analyticsPalette[itemIndex % analyticsPalette.length],
              }}
            />
            {valueLabel(item.value)}
          </span>
        ))}
      </div>
    </div>
  );
}

function HistogramChart({ data }: { data: NumericDistribution }) {
  const max = Math.max(...data.bins.map((bin) => bin.count), 1);
  return (
    <div className="nongeo-histogram">
      <div className="nongeo-histogram-bars">
        {data.bins.map((bin, binIndex) => (
          <span
            key={`${data.field}-${bin.label}`}
            style={{
              height: `${Math.max((bin.count / max) * 100, 6)}%`,
              background: analyticsPalette[binIndex % analyticsPalette.length],
            }}
            title={`${bin.label}: ${bin.count}`}
          />
        ))}
      </div>
      <div className="nongeo-histogram-axis">
        <span>{formatNumber(data.min)}</span>
        <span>{formatNumber(data.mean)}</span>
        <span>{formatNumber(data.max)}</span>
      </div>
    </div>
  );
}

function BoxSummary({ data }: { data: NumericDistribution }) {
  const range = data.max - data.min || 1;
  const q1 = ((data.q1 - data.min) / range) * 100;
  const q3 = ((data.q3 - data.min) / range) * 100;
  const median = ((data.median - data.min) / range) * 100;
  return (
    <div className="nongeo-box-summary">
      <div className="nongeo-box-line">
        <span style={{ left: `${q1}%`, width: `${Math.max(q3 - q1, 2)}%` }} />
        <i style={{ left: `${median}%` }} />
      </div>
      <div className="nongeo-box-values">
        <span>min {formatNumber(data.min)}</span>
        <span>mean {formatNumber(data.mean)}</span>
        <span>max {formatNumber(data.max)}</span>
      </div>
    </div>
  );
}

function CorrelationHeatmap({
  data,
}: {
  data: NonGeoAnalytics["correlation"];
}) {
  if (!data) {
    return <ChartEmpty />;
  }
  return (
    <div
      className="nongeo-correlation"
      style={{
        gridTemplateColumns: `repeat(${data.fields.length}, minmax(24px, 1fr))`,
      }}
    >
      {data.fields.flatMap((rowField, rowIndex) =>
        data.fields.map((columnField, columnIndex) => {
          const value = data.values[rowIndex]?.[columnIndex] ?? 0;
          return (
            <span
              key={`${rowField}-${columnField}`}
              title={`${rowField} × ${columnField}: ${value.toFixed(2)}`}
              style={{ background: correlationColor(value) }}
            >
              {value.toFixed(1)}
            </span>
          );
        }),
      )}
    </div>
  );
}

function ScatterChart({
  tableData,
}: {
  tableData: NonGeoTableQueryResult | null;
}) {
  const numericFields =
    tableData?.fields
      .filter((field) => /int|float|number|double/i.test(field.type))
      .slice(0, 2) ?? [];
  if (!tableData || numericFields.length < 2) {
    return <ChartEmpty />;
  }
  const xField = numericFields[0];
  const yField = numericFields[1];
  if (!xField || !yField) {
    return <ChartEmpty />;
  }
  const points = tableData.rows
    .map((row) => ({
      key: stableRowKey(row),
      x: toNumber(row[xField.name]),
      y: toNumber(row[yField.name]),
      label: valueLabel(row["种"] ?? row["名称"] ?? row[xField.name]),
    }))
    .filter(
      (point): point is { key: string; x: number; y: number; label: string } =>
        point.x !== null && point.y !== null,
    );
  if (points.length === 0) {
    return <ChartEmpty />;
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  return (
    <div className="nongeo-scatter-wrap">
      <svg viewBox="0 0 320 190" aria-label="性状散点图">
        <rect x="24" y="16" width="272" height="138" rx="8" />
        {points.map((point, pointIndex) => (
          <circle
            key={point.key}
            cx={24 + ((point.x - minX) / rangeX) * 272}
            cy={154 - ((point.y - minY) / rangeY) * 138}
            r={7}
            style={{
              fill: analyticsPalette[pointIndex % analyticsPalette.length],
            }}
          >
            <title>{point.label}</title>
          </circle>
        ))}
        <text x="24" y="178">
          {xField.name}
        </text>
        <text x="24" y="12">
          {yField.name}
        </text>
      </svg>
    </div>
  );
}

function FieldSummary({ fields }: { fields: FieldProfile[] }) {
  return (
    <div className="nongeo-field-summary">
      {fields.slice(0, 8).map((field) => (
        <div key={field.name}>
          <span>
            <strong>{field.label || field.name}</strong>
            <small>{roleLabels[field.role]}</small>
          </span>
          <em>{formatPercent(field.completeness)}</em>
        </div>
      ))}
    </div>
  );
}

function FieldCompleteness({ fields }: { fields: FieldProfile[] }) {
  return (
    <div className="nongeo-field-completeness">
      {fields.slice(0, 8).map((field) => (
        <div key={field.name}>
          <span>{field.label || field.name}</span>
          <Progress
            percent={Math.round(field.completeness * 100)}
            size="small"
            showInfo={false}
            strokeColor="#16b8a9"
            railColor="rgba(32,91,84,0.12)"
          />
        </div>
      ))}
    </div>
  );
}

function MetricRing({ value }: { value: number }) {
  return (
    <section className="nongeo-ring-card">
      <Progress
        type="circle"
        percent={Math.round(value * 100)}
        size={92}
        strokeColor="#16b8a9"
        railColor="rgba(32,91,84,0.12)"
      />
      <div>
        <Typography.Text strong>数据完整率</Typography.Text>
        <small>用于判断字段缺失对统计图表的影响</small>
      </div>
    </section>
  );
}

function RoleCounter({ label, value }: { label: string; value: number }) {
  return (
    <div className="nongeo-role-counter">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ChartEmpty() {
  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="暂无可视化数据"
      className="nongeo-chart-empty"
    />
  );
}

function PermissionEmpty() {
  return (
    <Alert
      type="warning"
      showIcon
      title="当前用户暂无数据浏览权限"
      description="请联系管理员授予 core.browse_data 后再访问非地理数据分析工作台。"
    />
  );
}

function resourceKey(resource: ResourceListItem) {
  return `${resource.dataType}-${String(resource.id)}-${resource.name}`;
}

function stableRowKey(row: TableRow) {
  const preferred =
    row.id ?? row.ID ?? row["采集号"] ?? row["种"] ?? row["Sample"];
  if (preferred !== undefined && preferred !== null) {
    return String(preferred);
  }
  return Object.entries(row)
    .slice(0, 4)
    .map(([key, value]) => `${key}:${valueLabel(value)}`)
    .join("|");
}

function valueLabel(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "未记录";
  }
  if (typeof value === "number") {
    return formatNumber(value);
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  return value;
}

function toNumber(value: string | number | boolean | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: Math.abs(value) < 10 ? 2 : 1,
  }).format(value);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function correlationColor(value: number) {
  const normalized = Math.max(-1, Math.min(1, value));
  if (normalized >= 0) {
    const alpha = 0.18 + normalized * 0.72;
    return `rgba(40, 224, 194, ${alpha})`;
  }
  return `rgba(255, 111, 145, ${0.18 + Math.abs(normalized) * 0.72})`;
}
