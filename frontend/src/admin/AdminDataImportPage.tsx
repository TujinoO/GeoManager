import {
  CheckCircleOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { ProCard } from "@ant-design/pro-components";
import {
  Alert,
  App as AntApp,
  Button,
  Checkbox,
  Descriptions,
  Form,
  Input,
  Modal,
  Progress,
  Radio,
  Result,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError, api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";
import type {
  AdminDataResourceAccessGroup,
  DataDomainType,
  DataSchemaSummary,
  ImportCommitPayload,
  ImportCommitResult,
  ImportCoordinateStats,
  ImportDuplicateTarget,
  ImportPreview,
  RasterImportCommitPayload,
  RasterImportPreview,
  RasterJob,
  ImportValidatePayload,
  ImportValidationIssue,
  VectorImportCommitResult,
} from "../types";
import {
  normalizeImportValues,
  type ImportAccessScopeId,
  type ImportFormValues,
} from "./importValues";
import VectorImportWorkflow from "./VectorImportWorkflow";
import ResultImportWorkflow from "./ResultImportWorkflow";
import { taxonomyLeafOptions } from "../utils/taxonomy";

type IssueAction = "continue" | "import";
type ImportTarget = "resource" | "result";
type ImportKind = "tabular" | "raster" | "vector" | "unsupported";
type ImportStorageMode = ImportFormValues["importMode"] | "raster";
type DomainDefinition = DataSchemaSummary["domains"][number];
type RasterDimensions = { width: number; height: number };
const selfAccessScopeId = "__self__";
const unfinishedImportWarning =
  "当前导入尚未完成，离开页面会丢失已选择的文件、配置和校验结果。";
type AccessScopeId = ImportAccessScopeId;

const spatialClassLabels: Record<string, string> = {
  spatial: "地理数据",
  non_spatial: "非地理数据",
  spatialized_table: "可空间化表格",
  derived_from_spatial: "空间对象关联",
};

const domainColors: Record<DataDomainType, string> = {
  germplasm: "green",
  genome: "geekblue",
  individual: "cyan",
  community: "lime",
  population: "gold",
  field_survey: "orange",
  remote_sensing: "blue",
  molecular: "purple",
  vector: "magenta",
  other: "default",
};

const resourceTypeLabels: Record<string, string> = {
  vector: "矢量",
  raster: "栅格",
  gene: "组学/基因",
  table: "表格",
  document: "文档",
  image: "影像/照片",
};

const fallbackDomainDefinitions: DomainDefinition[] = [
  {
    code: "germplasm",
    name: "种质数据",
    spatialClass: "spatialized_table",
    description:
      "胡杨、灰杨及伴生植物种质资源，重点管理采集来源、样品编号、核心资源标记和后续分子/基因组数据关联。",
    recommendedResourceTypes: ["vector", "gene", "table"],
    coreEntities: ["GermplasmAccession", "BiologicalSample", "Site", "Taxon"],
  },
  {
    code: "genome",
    name: "基因组数据",
    spatialClass: "non_spatial",
    description:
      "测序、组装、变异、注释等非地理组学成果；通过生物样品追溯采集地、个体或种群空间来源。",
    recommendedResourceTypes: ["gene", "table"],
    coreEntities: ["GenomeDataset", "GenomeSequenceFile", "BiologicalSample"],
  },
  {
    code: "individual",
    name: "个体数据",
    spatialClass: "spatial",
    description: "单株或单个植株个体的位置、性别、健康状态和观测指标。",
    recommendedResourceTypes: ["vector", "table"],
    coreEntities: [
      "IndividualOrganism",
      "TraitObservation",
      "BiologicalSample",
    ],
  },
  {
    code: "community",
    name: "群落数据",
    spatialClass: "spatialized_table",
    description: "样方、群落组成、多样性指标和功能性状等数据。",
    recommendedResourceTypes: ["vector", "table"],
    coreEntities: [
      "SamplePlot",
      "CommunitySurvey",
      "SpeciesComposition",
      "CommunityMetricValue",
    ],
  },
  {
    code: "population",
    name: "种群数据",
    spatialClass: "spatial",
    description: "某区域内某物种种群的空间范围、调查事件和种群指标。",
    recommendedResourceTypes: ["vector", "table"],
    coreEntities: ["PopulationUnit", "SamplePlot", "RasterSampleValue"],
  },
  {
    code: "field_survey",
    name: "野外调查数据",
    spatialClass: "spatialized_table",
    description: "调查任务、路线、样点、采集记录、野外照片和观察记录。",
    recommendedResourceTypes: ["vector", "table", "image"],
    coreEntities: [
      "SurveyEvent",
      "FieldObservation",
      "SurveyRoute",
      "SpecimenRecord",
    ],
  },
  {
    code: "remote_sensing",
    name: "遥感影像数据",
    spatialClass: "spatial",
    description:
      "原始遥感影像、无人机影像、NDVI/NPP、生物量、分类和变化检测产品。",
    recommendedResourceTypes: ["raster", "vector"],
    coreEntities: [
      "RasterDataset",
      "RemoteSensingProduct",
      "RasterSampleValue",
    ],
  },
  {
    code: "molecular",
    name: "分子数据",
    spatialClass: "non_spatial",
    description:
      "DNA/RNA 提取、PCR、分子标记、实验批次和实验结果文件；通过生物样品关联空间来源。",
    recommendedResourceTypes: ["gene", "table", "document"],
    coreEntities: [
      "MolecularSample",
      "MolecularAssay",
      "MolecularResult",
      "MolecularFile",
    ],
  },
  {
    code: "vector",
    name: "矢量数据",
    spatialClass: "spatial",
    description:
      "以点、线、面几何为主体的 Shapefile、GeoJSON、GeoPackage 等空间矢量资源，支持统一入库、查询、符号化和地图展示。",
    recommendedResourceTypes: ["vector"],
    coreEntities: ["DataResource", "VectorDataset", "MapLayer"],
  },
  {
    code: "other",
    name: "其他类型",
    spatialClass: "spatialized_table",
    description:
      "暂未归入专门专题的数据资源，可先按空间点表、普通表、文档或图片统一登记，后续再补充字段映射和标准化归类。",
    recommendedResourceTypes: ["vector", "table", "document", "image"],
    coreEntities: ["DataResource", "SourceDataset", "SourceSheet"],
  },
];

const domainFieldHints: Record<DataDomainType, string[]> = {
  germplasm: [
    "样品编号",
    "采集地点",
    "物种",
    "经度",
    "纬度",
    "海拔",
    "核心资源标记",
  ],
  genome: [
    "样品编号",
    "测序平台",
    "数据集类型",
    "文件角色",
    "参考组装",
    "质控状态",
  ],
  individual: [
    "个体编号",
    "物种",
    "性别",
    "经度",
    "纬度",
    "健康状态",
    "功能性状",
  ],
  community: [
    "样方编号",
    "群落类型",
    "物种组成",
    "盖度",
    "多样性指数",
    "调查时间",
  ],
  population: [
    "种群编号",
    "物种",
    "调查区域",
    "样方编号",
    "种群指标",
    "遥感采样值",
  ],
  field_survey: [
    "调查编号",
    "样点/路线",
    "采集日期",
    "调查人员",
    "经度",
    "纬度",
    "观测记录",
  ],
  remote_sensing: [
    "产品编号",
    "产品类型",
    "传感器",
    "时间范围",
    "空间分辨率",
    "坐标系",
  ],
  molecular: [
    "分子样品编号",
    "核酸类型",
    "实验类型",
    "批次编号",
    "位点/标记",
    "结果文件",
  ],
  vector: ["源图层", "几何类型", "坐标系", "空间范围", "属性字段", "几何质量"],
  other: [
    "资源编号",
    "来源文件",
    "工作表",
    "字段说明",
    "数据格式",
    "后续归类建议",
  ],
};

export default function AdminDataImportPage() {
  const { message } = AntApp.useApp();
  const { bootstrap, setBootstrap, user } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const allowNavigationRef = useRef(false);
  const currentPathRef = useRef("");
  const rasterPreviewRequestRef = useRef(0);
  const [form] = Form.useForm<ImportFormValues>();
  const canImportResources = Boolean(user?.permissions.canUploadData);
  const canImportResults = Boolean(
    user?.permissions.canViewResultArtifacts &&
    user.permissions.canImportResultArtifacts &&
    user.permissions.canPublishResultArtifacts,
  );
  const [importTarget, setImportTarget] = useState<ImportTarget>(() =>
    (new URLSearchParams(location.search).get("target") === "result" &&
      canImportResults) ||
    !canImportResources
      ? "result"
      : "resource",
  );
  const [resultImportDirty, setResultImportDirty] = useState(false);
  const [schema, setSchema] = useState<DataSchemaSummary | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [importKind, setImportKind] = useState<ImportKind | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fieldMetadata, setFieldMetadata] = useState<Record<string, string>>(
    {},
  );
  const [includedColumns, setIncludedColumns] = useState<string[]>([]);
  const [importConfig, setImportConfig] = useState<Partial<ImportFormValues>>(
    {},
  );
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [validationIssues, setValidationIssues] = useState<
    ImportValidationIssue[]
  >([]);
  const [duplicateTarget, setDuplicateTarget] =
    useState<ImportDuplicateTarget | null>(null);
  const [duplicateNameConfirmed, setDuplicateNameConfirmed] = useState(false);
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false);
  const [validationStats, setValidationStats] =
    useState<ImportCoordinateStats | null>(null);
  const [validating, setValidating] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [pendingIssueAction, setPendingIssueAction] =
    useState<IssueAction | null>(null);
  const [ignoreCoordinateUncertainty, setIgnoreCoordinateUncertainty] =
    useState(false);
  const [availableAccessGroups, setAvailableAccessGroups] = useState<
    ImportAccessGroup[]
  >([]);
  const [pendingNavigationPath, setPendingNavigationPath] = useState<
    string | null
  >(null);
  const [rasterFile, setRasterFile] = useState<File | null>(null);
  const [rasterFiles, setRasterFiles] = useState<File[]>([]);
  const [rasterPreview, setRasterPreview] =
    useState<RasterImportPreview | null>(null);
  const [rasterPreviewError, setRasterPreviewError] = useState<string | null>(
    null,
  );
  const [rasterName, setRasterName] = useState("");
  const [rasterDimensions, setRasterDimensions] =
    useState<RasterDimensions | null>(null);
  const [rasterInspecting, setRasterInspecting] = useState(false);
  const [rasterUploading, setRasterUploading] = useState(false);
  const [rasterUploadProgress, setRasterUploadProgress] = useState(0);
  const [completedRasterUploadProgress, setCompletedRasterUploadProgress] =
    useState(0);
  const [rasterJob, setRasterJob] = useState<RasterJob | null>(null);
  const [rasterKind, setRasterKind] =
    useState<RasterImportCommitPayload["rasterKind"]>("imagery");
  const [rasterResampling, setRasterResampling] =
    useState<RasterImportCommitPayload["resampling"]>("bilinear");
  const [rasterDefaultRules, setRasterDefaultRules] = useState<
    Record<string, unknown>
  >({});
  const [rasterAccessGroupIds, setRasterAccessGroupIds] = useState<number[]>(
    [],
  );
  const [rasterCategoryCode, setRasterCategoryCode] = useState(
    "thematic_landscape_rs",
  );
  const [vectorFile, setVectorFile] = useState<File | null>(null);
  const [vectorResult, setVectorResult] =
    useState<VectorImportCommitResult | null>(null);
  const [unsupportedFile, setUnsupportedFile] = useState<File | null>(null);
  const hasUnfinishedImport = Boolean(
    (file && !result) ||
    (rasterFile && !rasterJob) ||
    (rasterJob && isActiveRasterJob(rasterJob)) ||
    (vectorFile && !vectorResult),
  );
  const hasPendingImport = hasUnfinishedImport || resultImportDirty;

  const domainDefinitions = useMemo(
    () => (schema?.domains.length ? schema.domains : fallbackDomainDefinitions),
    [schema?.domains],
  );
  const categoryOptions = useMemo(() => taxonomyLeafOptions(schema), [schema]);
  const selectedDomainType =
    Form.useWatch("domainType", form) ?? importConfig.domainType;
  const selectedDomain = useMemo(
    () =>
      domainDefinitions.find((domain) => domain.code === selectedDomainType) ??
      domainDefinitions[0],
    [domainDefinitions, selectedDomainType],
  );
  const remoteSensingDomain = useMemo(
    () =>
      domainDefinitions.find((domain) => domain.code === "remote_sensing") ??
      fallbackDomainDefinitions.find(
        (domain) => domain.code === "remote_sensing",
      ),
    [domainDefinitions],
  );

  const columnOptions = useMemo(
    () =>
      preview?.columns.map((column) => ({ label: column, value: column })) ??
      [],
    [preview],
  );

  const previewColumns = useMemo(
    () =>
      preview?.columns.map((column) => ({
        title: column,
        dataIndex: column,
        key: column,
        width: 180,
        ellipsis: true,
      })) ?? [],
    [preview],
  );

  const previewRows = useMemo(
    () =>
      preview?.rows.map((row) => ({
        ...row,
        previewRowKey: preview.columns
          .map((column) => row[column] ?? "")
          .join("\u001f"),
      })) ?? [],
    [preview],
  );

  const stats = validationStats;
  const hasBlockingIssues = validationIssues.some((issue) => issue.blocking);
  const hasIgnorableUncertainty = validationIssues.some(
    (issue) => issue.code === "coordinate_uncertainty",
  );
  const selectedAccessGroupIds = Form.useWatch("accessGroupIds", form) ?? [];
  const selectedGroups = availableAccessGroups.filter((group) =>
    selectedAccessGroupIds.includes(group.id),
  );
  const hasGuestVisible = selectedGroups.some(isGuestGroup);
  const selectableAccessGroups = availableAccessGroups;
  const stepItems = useMemo(() => {
    if (importKind === "raster") {
      return [
        { title: "选择文件", icon: <CloudUploadOutlined /> },
        { title: "栅格配置", icon: <DatabaseOutlined /> },
        { title: "预处理进度", icon: <CheckCircleOutlined /> },
      ];
    }
    if (importKind === "unsupported") {
      return [
        { title: "选择文件", icon: <CloudUploadOutlined /> },
        { title: "类型识别", icon: <FileSearchOutlined /> },
      ];
    }
    if (importKind === "vector") {
      return [
        { title: "选择文件", icon: <CloudUploadOutlined /> },
        { title: "预检与入库", icon: <DatabaseOutlined /> },
      ];
    }
    return [
      { title: "选择文件", icon: <CloudUploadOutlined /> },
      { title: "导入配置", icon: <DatabaseOutlined /> },
      { title: "预览提交", icon: <CheckCircleOutlined /> },
    ];
  }, [importKind]);

  useEffect(() => {
    currentPathRef.current = `${location.pathname}${location.search}${location.hash}`;
  }, [location.hash, location.pathname, location.search]);

  useEffect(() => {
    if (!canImportResources && !canImportResults) {
      return;
    }
    let ignore = false;
    const request = canImportResources
      ? api
          .adminDataResources({ current: 1, pageSize: 1 })
          .then((result) => result.availableAccessGroups)
      : api.resultArtifacts().then((result) => result.availableAccessGroups);
    request
      .then((result) => {
        if (!ignore) {
          setAvailableAccessGroups(result);
        }
      })
      .catch(() => {
        if (!ignore) {
          setAvailableAccessGroups([]);
        }
      });
    return () => {
      ignore = true;
    };
  }, [canImportResources, canImportResults]);

  useEffect(() => {
    if (!user?.permissions.canUploadData || !user.permissions.canBrowseData) {
      setSchema(null);
      return;
    }
    let ignore = false;
    api
      .dataSchemaSummary()
      .then((result) => {
        if (!ignore) {
          setSchema(result);
        }
      })
      .catch(() => {
        if (!ignore) {
          setSchema(null);
        }
      });
    return () => {
      ignore = true;
    };
  }, [user?.permissions.canBrowseData, user?.permissions.canUploadData]);

  useEffect(() => {
    let ignore = false;
    api
      .bootstrap()
      .then((nextBootstrap) => {
        if (!ignore) {
          setBootstrap(nextBootstrap);
          document.title = nextBootstrap.systemName;
        }
      })
      .catch(() => {
        // 导入页可继续使用启动时配置；后端仍会按当前 TOML 做最终校验。
      });
    return () => {
      ignore = true;
    };
  }, [setBootstrap]);

  useEffect(() => {
    if (!hasPendingImport) {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = unfinishedImportWarning;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasPendingImport]);

  useEffect(() => {
    if (!hasPendingImport) {
      return;
    }
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    function shouldBlockUrl(url?: string | URL | null) {
      if (allowNavigationRef.current || url == null) {
        return false;
      }
      const nextUrl = new URL(String(url), window.location.href);
      if (nextUrl.origin !== window.location.origin) {
        return false;
      }
      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      const currentPath = currentPathRef.current;
      if (nextPath === currentPath) {
        return false;
      }
      setPendingNavigationPath(nextPath);
      return true;
    }

    window.history.pushState = function pushState(data, unused, url) {
      if (shouldBlockUrl(url)) {
        return;
      }
      return originalPushState.call(this, data, unused, url);
    };

    window.history.replaceState = function replaceState(data, unused, url) {
      if (shouldBlockUrl(url)) {
        return;
      }
      return originalReplaceState.call(this, data, unused, url);
    };

    const handlePopState = (event: PopStateEvent) => {
      if (allowNavigationRef.current) {
        return;
      }
      const nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const currentPath = currentPathRef.current;
      if (nextPath === currentPath) {
        return;
      }
      event.stopImmediatePropagation();
      setPendingNavigationPath(nextPath);
      originalPushState.call(
        window.history,
        window.history.state,
        "",
        currentPath,
      );
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }
      if (link.target && link.target !== "_self") {
        return;
      }
      const nextUrl = new URL(link.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) {
        return;
      }
      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      const currentPath = `${location.pathname}${location.search}${location.hash}`;
      if (nextPath === currentPath) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setPendingNavigationPath(nextPath);
    };
    window.addEventListener("popstate", handlePopState, { capture: true });
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", handlePopState, { capture: true });
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasPendingImport, location.hash, location.pathname, location.search]);

  useEffect(() => {
    if (!rasterJob || !isActiveRasterJob(rasterJob)) {
      return;
    }
    let cancelled = false;
    const timer = window.setInterval(() => {
      void api
        .rasterJob(rasterJob.id)
        .then((nextJob) => {
          if (!cancelled) {
            setRasterJob(nextJob);
          }
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          const text =
            error instanceof Error ? error.message : "栅格任务查询失败";
          setRasterJob((current) =>
            current?.id === rasterJob.id
              ? { ...current, status: "failed", error: text }
              : current,
          );
          message.error(text);
        });
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [message, rasterJob]);

  if (!canImportResources && !canImportResults) {
    return <Navigate to="/admin/profile" replace />;
  }

  function handleImportTargetChange(nextTarget: ImportTarget) {
    if (nextTarget === importTarget) return;
    if (hasPendingImport) {
      message.warning("请先完成当前导入或点击重新选择清空内容，再切换导入目标");
      return;
    }
    setImportTarget(nextTarget);
  }

  const importTargetSelector = (
    <ProCard className="admin-section-card import-target-card">
      <div className="import-target-heading">
        <div>
          <Typography.Title level={4}>选择导入目标</Typography.Title>
          <Typography.Text type="secondary">
            数据资源用于后续地图加载、查询和分析；成果文件用于集中展示已经完成的图件、报告、图表和表格。
          </Typography.Text>
        </div>
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          value={importTarget}
          onChange={(event) =>
            handleImportTargetChange(event.target.value as ImportTarget)
          }
          options={[
            ...(canImportResources
              ? [{ label: "导入为数据资源", value: "resource" as const }]
              : []),
            ...(canImportResults
              ? [{ label: "导入并发布成果", value: "result" as const }]
              : []),
          ]}
        />
      </div>
    </ProCard>
  );

  if (importTarget === "result") {
    return (
      <div className="admin-page-stack admin-import-page">
        {importTargetSelector}
        <ResultImportWorkflow
          categoryOptions={categoryOptions}
          accessGroups={availableAccessGroups}
          uploadMaxMb={bootstrap.limits.uploadMaxMb}
          onDirtyChange={setResultImportDirty}
        />
      </div>
    );
  }

  function resetImportState() {
    rasterPreviewRequestRef.current += 1;
    setImportKind(null);
    setFile(null);
    setPreview(null);
    setFieldMetadata({});
    setIncludedColumns([]);
    setValidationIssues([]);
    setDuplicateTarget(null);
    setDuplicateNameConfirmed(false);
    setDuplicateConfirmOpen(false);
    setValidationStats(null);
    setHasValidated(false);
    setIgnoreCoordinateUncertainty(false);
    setPendingIssueAction(null);
    setIssuesOpen(false);
    setResult(null);
    setImportConfig({});
    setRasterFile(null);
    setRasterFiles([]);
    setRasterPreview(null);
    setRasterPreviewError(null);
    setRasterName("");
    setRasterDimensions(null);
    setRasterInspecting(false);
    setRasterJob(null);
    setRasterUploading(false);
    setRasterUploadProgress(0);
    setCompletedRasterUploadProgress(0);
    setRasterKind("imagery");
    setRasterResampling("bilinear");
    setRasterDefaultRules({});
    setRasterAccessGroupIds([]);
    setRasterCategoryCode("thematic_landscape_rs");
    setVectorFile(null);
    setVectorResult(null);
    setUnsupportedFile(null);
    setCurrentStep(0);
    form.resetFields();
  }

  async function previewRasterFiles(
    selectedFiles: File[],
    primaryFileName?: string,
  ) {
    const requestId = rasterPreviewRequestRef.current + 1;
    rasterPreviewRequestRef.current = requestId;
    setRasterInspecting(true);
    setRasterPreview(null);
    setRasterPreviewError(null);
    try {
      const inspected = await api.previewRasterImport(
        selectedFiles,
        primaryFileName,
      );
      if (requestId !== rasterPreviewRequestRef.current) {
        return;
      }
      setRasterPreview(inspected);
      setRasterName((current) => current || inspected.suggestedName);
      setRasterDimensions({
        width: inspected.metadata.size[0] ?? 0,
        height: inspected.metadata.size[1] ?? 0,
      });
      setRasterKind(inspected.rasterKind);
      setRasterResampling(inspected.resampling);
      setRasterDefaultRules(inspected.defaultRules);
      message.success("栅格数据包预检完成，请确认导入与显示配置");
    } catch (error) {
      if (requestId !== rasterPreviewRequestRef.current) {
        return;
      }
      setRasterDimensions(null);
      const errorText =
        error instanceof Error ? error.message : "栅格数据包预检失败";
      setRasterPreviewError(errorText);
      message.error(errorText);
    } finally {
      if (requestId === rasterPreviewRequestRef.current) {
        setRasterInspecting(false);
      }
    }
  }

  async function handleFileSelected(selectedFile: File) {
    const kind = detectImportKind(selectedFile);
    resetImportState();
    if (kind === "raster") {
      setImportKind("raster");
      setRasterFile(selectedFile);
      setRasterFiles([selectedFile]);
      setRasterName(fileStem(selectedFile.name));
      setCurrentStep(1);
      void previewRasterFiles([selectedFile], selectedFile.name);
      return;
    }
    if (kind === "tabular") {
      setImportKind("tabular");
      void handlePreview(selectedFile);
      return;
    }
    if (kind === "vector") {
      setImportKind("vector");
      setVectorFile(selectedFile);
      setCurrentStep(1);
      message.success(
        "已识别为矢量数据，正在执行图层、编码、坐标系和几何质量预检",
      );
      return;
    }
    setImportKind("unsupported");
    setUnsupportedFile(selectedFile);
    setCurrentStep(1);
    message.warning("暂不支持该文件类型的自动导入");
  }

  async function handlePreview(selectedFile: File, sheetName?: string | null) {
    setFile(selectedFile);
    setPreviewing(true);
    setResult(null);
    setValidationIssues([]);
    setValidationStats(null);
    setHasValidated(false);
    setIgnoreCoordinateUncertainty(false);
    try {
      const data = await api.importPreview(selectedFile, sheetName);
      setPreview(data);
      setDuplicateTarget(data.duplicateTarget ?? null);
      setFieldMetadata(
        Object.fromEntries(data.columns.map((column) => [column, ""])),
      );
      setIncludedColumns(data.columns);
      const inferredDomainType = inferDomainTypeFromFile(
        selectedFile.name,
        data,
      );
      const nextConfig: ImportFormValues = {
        name: data.suggestedName,
        domainType: inferredDomainType,
        importMode: data.detected.isGeographic ? "geographic" : "table",
        longitudeColumn: data.detected.longitudeColumn ?? undefined,
        latitudeColumn: data.detected.latitudeColumn ?? undefined,
        accessGroupIds: [],
      };
      setImportConfig(nextConfig);
      form.setFieldsValue({
        ...nextConfig,
        accessGroupIds: withFixedAccessScopes(nextConfig.accessGroupIds),
      });
      setCurrentStep(1);
      message.success(
        data.activeSheetName
          ? `工作表 ${data.activeSheetName} 预检完成，请配置导入信息`
          : "文件预检完成，请配置导入信息",
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : "预检失败");
    } finally {
      setPreviewing(false);
    }
  }

  function handleSheetSelected(sheetName: string) {
    if (!file || preview?.activeSheetName === sheetName) {
      return;
    }
    void handlePreview(file, sheetName);
  }

  async function handleValidateAndContinue() {
    if (!file || !preview) {
      message.warning("请先选择并预检文件");
      return;
    }
    try {
      const values = await form.validateFields();
      setImportConfig((current) => ({ ...current, ...values }));
      const payload: ImportValidatePayload = {
        name: values.name,
        sheetName: preview.activeSheetName ?? undefined,
        importMode: values.importMode,
        tableName: preview.suggestedTableName,
        longitudeColumn: values.longitudeColumn,
        latitudeColumn: values.latitudeColumn,
      };
      setValidating(true);
      const validated = await api.importValidate(file, payload);
      setValidationStats(validated.coordinateStats);
      setValidationIssues(validated.validationIssues);
      setDuplicateTarget(validated.duplicateTarget ?? null);
      setDuplicateNameConfirmed(false);
      setHasValidated(true);
      setIgnoreCoordinateUncertainty(false);
      if (validated.duplicateTarget) {
        setDuplicateConfirmOpen(true);
        return;
      }
      if (validated.validationIssues.length) {
        setPendingIssueAction("continue");
        setIssuesOpen(true);
        return;
      }
      message.success("数据校验通过");
      setCurrentStep(2);
    } catch (error) {
      const issues = importIssuesFromError(error);
      if (issues.length) {
        setValidationIssues(issues);
        setPendingIssueAction("continue");
        setIssuesOpen(true);
      } else {
        message.error(error instanceof Error ? error.message : "数据校验失败");
      }
    } finally {
      setValidating(false);
    }
  }

  async function handleImport() {
    await submitImport(ignoreCoordinateUncertainty);
  }

  function addRasterCompanionFiles(selectedFiles: File[]) {
    const merged = new Map(
      rasterFiles.map((file) => [file.name.toLowerCase(), file] as const),
    );
    selectedFiles.forEach((file) => merged.set(file.name.toLowerCase(), file));
    const nextFiles = Array.from(merged.values());
    setRasterFiles(nextFiles);
    const primaryName = rasterPreview?.primaryFileName ?? rasterFile?.name;
    void previewRasterFiles(nextFiles, primaryName);
  }

  function updateRasterRgbBand(index: number, band: number) {
    const current = Array.isArray(rasterDefaultRules.bands)
      ? [...(rasterDefaultRules.bands as number[])]
      : [1, 2, 3];
    while (current.length < 3) current.push(current[current.length - 1] ?? 1);
    current[index] = band;
    setRasterDefaultRules((rules) => ({
      ...rules,
      mode: "rgb",
      bands: current.slice(0, 3),
    }));
  }

  async function handleRasterImport() {
    if (!rasterFile || rasterFiles.length === 0) {
      message.warning("请先选择栅格文件");
      return;
    }
    if (!rasterPreview) {
      message.warning("请先通过栅格数据包预检");
      return;
    }
    if (!rasterName.trim()) {
      message.warning("请输入栅格数据名称");
      return;
    }
    setRasterUploading(true);
    setRasterUploadProgress(0);
    setCompletedRasterUploadProgress(0);
    setRasterJob(null);
    try {
      const payload: RasterImportCommitPayload = {
        primaryFileName: rasterPreview.primaryFileName,
        name: rasterName.trim(),
        rasterKind,
        resampling: rasterResampling,
        defaultRules: rasterDefaultRules,
        accessGroupIds: rasterAccessGroupIds,
        categoryCode: rasterCategoryCode,
      };
      const job = await api.importRaster(rasterFiles, payload, (percent) => {
        setRasterUploadProgress(percent);
      });
      setCompletedRasterUploadProgress(100);
      setRasterJob(job);
      setCurrentStep(2);
      message.success("栅格导入任务已提交，后台正在预处理");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "栅格导入失败");
    } finally {
      setRasterUploading(false);
    }
  }

  function resetRasterImportState() {
    resetImportState();
  }

  async function submitImport(ignoreUncertainty: boolean) {
    if (!file || !preview) {
      message.warning("请先选择并预检文件");
      return;
    }
    try {
      if (!hasValidated) {
        message.warning("请先进行数据校验");
        setCurrentStep(1);
        return;
      }
      if (shouldBlockImport(validationIssues, ignoreUncertainty)) {
        setPendingIssueAction("import");
        setIssuesOpen(true);
        return;
      }
      const values = normalizeImportValues({
        ...importConfig,
        ...form.getFieldsValue(true),
      });
      if (!values.name) {
        message.warning("请输入数据名称");
        setCurrentStep(1);
        return;
      }
      if (!values.importMode) {
        message.warning("请选择入库方式");
        setCurrentStep(1);
        return;
      }
      if (!values.domainType) {
        message.warning("请选择业务数据类型");
        setCurrentStep(1);
        return;
      }
      if (!values.categoryCode) {
        message.warning("请选择权威业务分类");
        setCurrentStep(1);
        return;
      }
      if (duplicateTarget && !duplicateNameConfirmed) {
        message.warning("请先在数据校验阶段确认重复数据名称");
        setCurrentStep(1);
        return;
      }
      const selectedMetadata = Object.fromEntries(
        includedColumns.map((column) => [column, fieldMetadata[column] ?? ""]),
      );
      const payload: ImportCommitPayload = {
        name: values.name,
        domainType: values.domainType,
        categoryCode: values.categoryCode,
        sheetName: preview.activeSheetName ?? undefined,
        importMode: values.importMode,
        longitudeColumn: values.longitudeColumn,
        latitudeColumn: values.latitudeColumn,
        tableName: preview.suggestedTableName,
        ignoreCoordinateUncertainty: ignoreUncertainty,
        duplicateConfirmed: Boolean(duplicateTarget && duplicateNameConfirmed),
        includedColumns,
        fieldMetadata: selectedMetadata,
        accessGroupIds: realAccessGroupIds(values.accessGroupIds),
      };
      setImporting(true);
      const imported = await api.importCommit(file, payload);
      setResult(imported);
      setValidationIssues(imported.validationIssues);
      message.success("导入完成");
    } catch (error) {
      const issues = importIssuesFromError(error);
      if (issues.length) {
        setValidationIssues(issues);
        setPendingIssueAction("import");
        setIssuesOpen(true);
      } else {
        message.error(error instanceof Error ? error.message : "导入失败");
      }
    } finally {
      setImporting(false);
    }
  }

  function handleIssueConfirm() {
    if (hasBlockingIssues || !hasIgnorableUncertainty) {
      setIssuesOpen(false);
      return;
    }
    setIgnoreCoordinateUncertainty(true);
    setIssuesOpen(false);
    if (pendingIssueAction === "continue") {
      setCurrentStep(2);
      return;
    }
    void submitImport(true);
  }

  return (
    <div className="admin-page-stack admin-import-page">
      {importTargetSelector}
      <ProCard className="admin-section-card">
        <Steps current={currentStep} items={stepItems} />
      </ProCard>

      <ProCard className="admin-section-card">
        <Form
          form={form}
          layout="vertical"
          component={false}
          onValuesChange={(changed) => {
            setImportConfig((current) => ({ ...current, ...changed }));
            if (
              "importMode" in changed ||
              "name" in changed ||
              "longitudeColumn" in changed ||
              "latitudeColumn" in changed
            ) {
              setValidationIssues([]);
              setValidationStats(null);
              setHasValidated(false);
              setIgnoreCoordinateUncertainty(false);
              setDuplicateNameConfirmed(false);
              if ("importMode" in changed || "name" in changed) {
                setDuplicateTarget(null);
              }
            }
          }}
        >
          {currentStep === 0 && (
            <section className="import-step-pane">
              <Upload.Dragger
                disabled={previewing || rasterInspecting}
                beforeUpload={(selectedFile) => {
                  void handleFileSelected(selectedFile);
                  return false;
                }}
                maxCount={1}
                showUploadList={false}
              >
                <CloudUploadOutlined style={{ fontSize: 34 }} />
                <Typography.Title level={4}>
                  选择或拖拽数据文件
                </Typography.Title>
                <Typography.Text type="secondary">
                  支持 CSV、Excel、矢量文件，以及 GeoTIFF/COG、IMG、VRT、 ENVI
                  DAT/BSQ/BIL/BIP + HDR
                  栅格数据包；系统会根据文件类型自动进入后续流程。
                </Typography.Text>
                <div className="import-selected-file">
                  {previewing ? (
                    <Tag color="processing">正在预检文件...</Tag>
                  ) : rasterInspecting ? (
                    <Tag color="processing">正在读取栅格尺寸...</Tag>
                  ) : file ? (
                    <Tag color="green">{file.name}</Tag>
                  ) : (
                    <Tag>尚未选择文件</Tag>
                  )}
                </div>
              </Upload.Dragger>
            </section>
          )}

          {currentStep === 1 && importKind === "tabular" && preview && (
            <div className="import-config-form">
              <Space className="import-actions import-actions-top">
                <Button onClick={resetImportState}>重新选择文件</Button>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined style={{ fontSize: 16 }} />}
                  loading={validating}
                  onClick={handleValidateAndContinue}
                >
                  数据校验并继续
                </Button>
              </Space>

              <section className="import-section import-recognition-panel">
                <Typography.Title level={5}>文件识别结果</Typography.Title>
                <Descriptions
                  size="small"
                  bordered
                  column={4}
                  className="import-stats"
                >
                  <Descriptions.Item label="文件名">
                    {file?.name ?? "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="总行数">
                    {preview.rowCount}
                  </Descriptions.Item>
                  {preview.activeSheetName && (
                    <Descriptions.Item label="当前工作表">
                      {preview.activeSheetName}
                    </Descriptions.Item>
                  )}
                  <Descriptions.Item label="字段数">
                    {preview.columns.length}
                  </Descriptions.Item>
                  <Descriptions.Item label="自动识别">
                    {preview.detected.isGeographic
                      ? "地理数据（经纬度表格）"
                      : "非地理数据（普通表格）"}
                  </Descriptions.Item>
                  <Descriptions.Item label="建议存储标识" span={2}>
                    {preview.suggestedTableName}
                  </Descriptions.Item>
                  <Descriptions.Item label="识别坐标列" span={2}>
                    {preview.detected.longitudeColumn &&
                    preview.detected.latitudeColumn
                      ? `${preview.detected.longitudeColumn} / ${preview.detected.latitudeColumn}`
                      : "未识别"}
                  </Descriptions.Item>
                </Descriptions>
                {(preview.sheets?.length ?? 0) > 1 && (
                  <section className="import-section import-sheet-section">
                    <Typography.Title level={5}>
                      工作表拆分结果
                    </Typography.Title>
                    <Alert
                      type="info"
                      showIcon
                      title={`已识别 ${preview.sheets?.length ?? 0} 张工作表`}
                      description="每张工作表会按独立表格预检、校验和导入；请选择当前要导入的工作表，平台会重新推断字段、坐标列和建议入库名称。"
                    />
                    <Table
                      size="small"
                      rowKey="name"
                      pagination={false}
                      dataSource={preview.sheets ?? []}
                      columns={[
                        {
                          title: "工作表",
                          dataIndex: "name",
                          ellipsis: true,
                        },
                        {
                          title: "行数",
                          dataIndex: "rowCount",
                          width: 96,
                        },
                        {
                          title: "字段",
                          dataIndex: "columnCount",
                          width: 96,
                        },
                        {
                          title: "识别类型",
                          dataIndex: "isGeographic",
                          width: 140,
                          render: (_, record) =>
                            record.isGeographic ? (
                              <Tag color="cyan">经纬度表格</Tag>
                            ) : (
                              <Tag>普通表格</Tag>
                            ),
                        },
                        {
                          title: "坐标列",
                          width: 180,
                          render: (_, record) =>
                            record.longitudeColumn && record.latitudeColumn
                              ? `${record.longitudeColumn} / ${record.latitudeColumn}`
                              : "-",
                        },
                        {
                          title: "操作",
                          width: 120,
                          render: (_, record) =>
                            record.name === preview.activeSheetName ? (
                              <Tag color="green">当前导入</Tag>
                            ) : (
                              <Button
                                size="small"
                                loading={previewing}
                                onClick={() => handleSheetSelected(record.name)}
                              >
                                切换
                              </Button>
                            ),
                        },
                      ]}
                    />
                  </section>
                )}
                {preview.limitations.length > 0 && (
                  <Alert
                    type="info"
                    showIcon
                    title="本次导入边界"
                    description={
                      <ul className="import-limit-list">
                        {preview.limitations.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    }
                  />
                )}
              </section>

              <section className="import-section">
                <Typography.Title level={5}>数据名称</Typography.Title>
                <div className="import-config-grid import-name-grid">
                  <Form.Item
                    name="name"
                    label="存量数据中显示的资源名称"
                    rules={[{ required: true, message: "请输入数据名称" }]}
                  >
                    <Input placeholder="例如：2024 塔里木胡杨 DNA 样品清单" />
                  </Form.Item>
                </div>
              </section>

              <section className="import-section">
                <Typography.Title level={5}>权威业务分类</Typography.Title>
                <Typography.Text type="secondary">
                  资源必须挂接到甲方四大类体系的叶节点；地理/非地理仅作为存储和展示能力。
                </Typography.Text>
                <Form.Item
                  name="categoryCode"
                  rules={[{ required: true, message: "请选择权威业务分类" }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="选择四大类下的具体叶节点"
                    options={categoryOptions}
                  />
                </Form.Item>
              </section>

              <section className="import-section">
                <Typography.Title level={5}>兼容业务标签</Typography.Title>
                <Typography.Text type="secondary">
                  保留既有业务标签用于兼容当前可视化模板和标准实体映射，不再作为一级导航。
                </Typography.Text>
                <Form.Item
                  name="domainType"
                  rules={[{ required: true, message: "请选择业务数据类型" }]}
                >
                  <Radio.Group className="import-domain-grid">
                    {domainDefinitions.map((domain) => (
                      <Radio
                        key={domain.code}
                        value={domain.code}
                        className="import-domain-card"
                      >
                        <Space orientation="vertical" size={4}>
                          <Space size={6} wrap>
                            <Typography.Text strong>
                              {domain.name}
                            </Typography.Text>
                            <Tag color={domainColors[domain.code]}>
                              {spatialClassLabels[domain.spatialClass] ??
                                domain.spatialClass}
                            </Tag>
                          </Space>
                          <Typography.Text type="secondary">
                            {domain.description}
                          </Typography.Text>
                        </Space>
                      </Radio>
                    ))}
                  </Radio.Group>
                </Form.Item>
                {selectedDomain && <DomainDetail domain={selectedDomain} />}
              </section>

              <section className="import-section">
                <Typography.Title level={5}>入库方式</Typography.Title>
                <Typography.Text type="secondary">
                  入库方式决定本次文件先写成地图点图层还是普通属性表；业务类型决定后续应映射到哪些标准实体。
                </Typography.Text>
                <Form.Item
                  name="importMode"
                  rules={[{ required: true, message: "请选择入库方式" }]}
                >
                  <Radio.Group className="import-mode-grid">
                    <Radio value="geographic" className="import-mode-card">
                      <span className="import-mode-title">
                        空间点表（有经纬度列）
                      </span>
                      <span className="import-mode-desc">
                        适合样点、样方、采集地、个体位置等数据，会生成可上图的点图层。
                      </span>
                    </Radio>
                    <Radio value="table" className="import-mode-card">
                      <span className="import-mode-title">
                        普通属性表（无坐标）
                      </span>
                      <span className="import-mode-desc">
                        适合实验记录、统计指标、文件清单等数据，先作为表格资源管理。
                      </span>
                    </Radio>
                  </Radio.Group>
                </Form.Item>
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, current) =>
                    prev.importMode !== current.importMode ||
                    prev.domainType !== current.domainType
                  }
                >
                  {({ getFieldValue }) => {
                    const mode = getFieldValue("importMode") as
                      | ImportFormValues["importMode"]
                      | undefined;
                    const domainType = getFieldValue("domainType") as
                      | DataDomainType
                      | undefined;
                    const domain =
                      domainDefinitions.find(
                        (item) => item.code === domainType,
                      ) ?? selectedDomain;
                    return <ImportStorageSummary mode={mode} domain={domain} />;
                  }}
                </Form.Item>
              </section>

              <section className="import-section">
                <Typography.Title level={5}>数据可见权限</Typography.Title>
                <Space
                  orientation="vertical"
                  size={10}
                  style={{ width: "100%" }}
                >
                  <Form.Item name="accessGroupIds" label="指定角色可见">
                    <Select
                      mode="multiple"
                      placeholder="选择需要共享的数据角色"
                      onChange={(nextValue) =>
                        form.setFieldValue(
                          "accessGroupIds",
                          withFixedAccessScopes(nextValue),
                        )
                      }
                      options={[
                        {
                          value: selfAccessScopeId,
                          label: "我自己可见",
                          disabled: true,
                        },
                        ...selectableAccessGroups.map((group) => ({
                          value: group.id,
                          label: group.name,
                        })),
                      ]}
                    />
                  </Form.Item>
                  {hasGuestVisible && (
                    <Alert
                      type="warning"
                      showIcon
                      title="游客可见后，无需登录账号即可浏览和查询该数据。"
                    />
                  )}
                </Space>
              </section>

              <Form.Item
                noStyle
                shouldUpdate={(prev, current) =>
                  prev.importMode !== current.importMode
                }
              >
                {({ getFieldValue }) =>
                  getFieldValue("importMode") === "geographic" ? (
                    <div className="import-coordinate-grid">
                      <Form.Item
                        name="longitudeColumn"
                        label="经度列"
                        rules={[{ required: true, message: "请选择经度列" }]}
                      >
                        <Select
                          options={columnOptions}
                          placeholder="选择经度列"
                          showSearch
                        />
                      </Form.Item>
                      <Form.Item
                        name="latitudeColumn"
                        label="纬度列"
                        rules={[{ required: true, message: "请选择纬度列" }]}
                      >
                        <Select
                          options={columnOptions}
                          placeholder="选择纬度列"
                          showSearch
                        />
                      </Form.Item>
                      <Space className="import-validation-actions">
                        {hasValidated && validationIssues.length === 0 && (
                          <Tag color="green">校验通过</Tag>
                        )}
                        {hasValidated && validationIssues.length > 0 && (
                          <Tag color={hasBlockingIssues ? "red" : "gold"}>
                            {hasBlockingIssues
                              ? "存在阻断问题"
                              : "存在可忽略问题"}
                          </Tag>
                        )}
                      </Space>
                    </div>
                  ) : null
                }
              </Form.Item>

              {stats && (
                <Descriptions
                  size="small"
                  bordered
                  column={4}
                  className="import-stats"
                >
                  <Descriptions.Item label="总行数">
                    {stats.totalRows}
                  </Descriptions.Item>
                  <Descriptions.Item label="有效坐标">
                    {stats.validRows}
                  </Descriptions.Item>
                  <Descriptions.Item label="空或非法坐标">
                    {stats.missingRows}
                  </Descriptions.Item>
                  <Descriptions.Item label="量化误差范围">
                    {stats.quantizationErrorMeters.min ?? "-"} -{" "}
                    {stats.quantizationErrorMeters.max ?? "-"} 米
                  </Descriptions.Item>
                </Descriptions>
              )}

              {!preview.detected.isGeographic && (
                <Alert
                  type="info"
                  showIcon
                  title="已自动归类为非地理数据"
                  description="当前工作表未识别到可用的经纬度列，系统已默认按普通属性表入库；提交后只会显示在非地理数据资源列表中。若文件实际使用非标准坐标列名，可手动切换为空间点表并明确选择经度列和纬度列。"
                />
              )}

              {duplicateTarget && (
                <DuplicateTargetAlert
                  target={duplicateTarget}
                  confirmed={duplicateNameConfirmed}
                />
              )}
            </div>
          )}

          {currentStep === 1 && importKind === "raster" && rasterFile && (
            <div className="import-config-form">
              <Space className="import-actions import-actions-top">
                <Button onClick={resetRasterImportState}>重新选择文件</Button>
                <Button
                  type="primary"
                  icon={<CloudUploadOutlined style={{ fontSize: 16 }} />}
                  loading={rasterUploading}
                  disabled={!rasterPreview || rasterInspecting}
                  onClick={handleRasterImport}
                >
                  上传并预处理
                </Button>
              </Space>

              <Alert
                type="info"
                showIcon
                title={
                  rasterInspecting
                    ? "正在预检栅格数据包"
                    : rasterPreview
                      ? "栅格数据包预检通过"
                      : rasterPreviewError
                        ? "栅格预检未通过"
                        : "尚未完成栅格预检"
                }
                description={
                  rasterInspecting
                    ? "正在使用 GDAL 读取文件格式、坐标系、尺寸和波段信息，请稍候。"
                    : rasterPreviewError
                      ? rasterPreviewError
                      : rasterFileNeedsCompanions(rasterFile.name)
                        ? "该文件类型需要配套文件：DAT/BSQ/BIL/BIP 需同名 HDR；VRT 需同时上传全部引用文件。"
                        : `单个 GeoTIFF/COG 或 IMG 可直接导入，无需辅助文件。后端会使用 GDAL 校验文件大小不超过 ${bootstrap.limits.uploadMaxMb} MB、单边长度不超过 ${bootstrap.limits.maxRasterSidePixels} 像素。`
                }
              />

              <section className="import-section">
                <Typography.Title level={5}>栅格数据包</Typography.Title>
                <Space size={[6, 6]} wrap>
                  {rasterFiles.map((file) => (
                    <Tag key={`${file.name}-${file.size}`}>{file.name}</Tag>
                  ))}
                </Space>
                <div style={{ marginTop: 12 }}>
                  <Upload
                    multiple
                    showUploadList={false}
                    beforeUpload={(selectedFile, selectedBatch) => {
                      if (selectedFile === selectedBatch[0]) {
                        addRasterCompanionFiles(selectedBatch);
                      }
                      return false;
                    }}
                  >
                    <Button
                      icon={<CloudUploadOutlined />}
                      loading={rasterInspecting}
                    >
                      补充 HDR、VRT 引用或可选辅助文件
                    </Button>
                  </Upload>
                </div>
                {rasterPreview?.warnings.map((warning) => (
                  <Alert
                    key={warning}
                    type="warning"
                    showIcon
                    title={warning}
                    style={{ marginTop: 10 }}
                  />
                ))}
              </section>

              <section className="import-section">
                <Typography.Title level={5}>
                  业务数据类型与入库去向
                </Typography.Title>
                {remoteSensingDomain && (
                  <DomainDetail domain={remoteSensingDomain} />
                )}
                <ImportStorageSummary
                  mode="raster"
                  domain={remoteSensingDomain}
                />
                <Alert
                  type="info"
                  showIcon
                  title="栅格数据导入后可在存量数据中继续管理"
                  description="当前流程会先完成文件登记、预处理和地图图层创建；可见权限、默认样式和后续遥感产品标准化关系可在存量数据和后续业务治理模块中维护。"
                />
              </section>

              <section className="import-section">
                <Typography.Title level={5}>权威业务分类</Typography.Title>
                <Select
                  showSearch
                  optionFilterProp="label"
                  value={rasterCategoryCode}
                  options={categoryOptions}
                  onChange={setRasterCategoryCode}
                  style={{ width: "100%" }}
                />
                <Alert
                  type="info"
                  showIcon
                  title="遥感影像默认归入“胡杨专题数据 / 景观与遥感”"
                  description="若该栅格本质上是 LUCC、气候或土壤专题，请在提交前改选对应叶节点。"
                  style={{ marginTop: 10 }}
                />
              </section>

              <Descriptions
                size="small"
                bordered
                column={2}
                className="import-stats"
              >
                <Descriptions.Item label="文件名">
                  {rasterFile.name}
                </Descriptions.Item>
                <Descriptions.Item label="文件类型">
                  {rasterPreview?.sourceFormat ??
                    rasterFileExtensionLabel(rasterFile.name)}
                </Descriptions.Item>
                <Descriptions.Item label="像素尺寸">
                  {rasterDimensions
                    ? `${rasterDimensions.width} x ${rasterDimensions.height}`
                    : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="大小上限">
                  {bootstrap.limits.uploadMaxMb} MB
                </Descriptions.Item>
                <Descriptions.Item label="坐标系">
                  {rasterPreview?.metadata.coordinateSystem || "未识别"}
                </Descriptions.Item>
                <Descriptions.Item label="波段数">
                  {rasterPreview?.metadata.bands.length ?? "-"}
                </Descriptions.Item>
              </Descriptions>

              <section className="import-section">
                <Typography.Title level={5}>栅格数据名称</Typography.Title>
                <Input
                  aria-label="栅格数据名称"
                  value={rasterName}
                  onChange={(event) => setRasterName(event.target.value)}
                  placeholder="栅格数据名称，默认取文件名"
                  disabled={rasterUploading}
                />
              </section>

              <section className="import-section">
                <Typography.Title level={5}>预处理与默认显示</Typography.Title>
                <div className="import-config-grid">
                  <div>
                    <Typography.Text>栅格类型</Typography.Text>
                    <Select
                      value={rasterKind}
                      style={{ width: "100%", marginTop: 6 }}
                      options={[
                        { value: "imagery", label: "多波段遥感影像" },
                        { value: "continuous", label: "连续型指标/高程" },
                        { value: "categorical", label: "分类栅格" },
                      ]}
                      onChange={(value) => {
                        setRasterKind(value);
                        setRasterResampling(
                          value === "categorical" ? "nearest" : "bilinear",
                        );
                      }}
                    />
                  </div>
                  <div>
                    <Typography.Text>重采样方式</Typography.Text>
                    <Select
                      value={rasterResampling}
                      style={{ width: "100%", marginTop: 6 }}
                      options={[
                        { value: "nearest", label: "最近邻（分类数据）" },
                        { value: "bilinear", label: "双线性（连续影像）" },
                        { value: "cubic", label: "三次卷积（高质量影像）" },
                      ]}
                      onChange={setRasterResampling}
                    />
                  </div>
                </div>

                {(rasterPreview?.metadata.bands.length ?? 0) >= 3 && (
                  <div style={{ marginTop: 14 }}>
                    <Space wrap>
                      <Typography.Text>RGB 波段：</Typography.Text>
                      {[0, 1, 2].map((index) => (
                        <Select
                          key={index}
                          aria-label={`RGB 波段 ${index + 1}`}
                          value={
                            (
                              rasterDefaultRules.bands as number[] | undefined
                            )?.[index] ?? index + 1
                          }
                          style={{ width: 110 }}
                          options={(rasterPreview?.metadata.bands ?? []).map(
                            (band) => ({
                              value: band.band,
                              label: `Band ${band.band}`,
                            }),
                          )}
                          onChange={(band) => updateRasterRgbBand(index, band)}
                        />
                      ))}
                      {(rasterPreview?.metadata.bands.length ?? 0) >= 8 && (
                        <Button
                          onClick={() =>
                            setRasterDefaultRules((rules) => ({
                              ...rules,
                              mode: "rgb",
                              bands: [5, 3, 2],
                            }))
                          }
                        >
                          WorldView 8 波段自然色
                        </Button>
                      )}
                    </Space>
                  </div>
                )}
              </section>

              <section className="import-section">
                <Typography.Title level={5}>数据可见权限</Typography.Title>
                <Select
                  mode="multiple"
                  value={rasterAccessGroupIds}
                  placeholder="选择额外可访问角色；上传者本人始终可见"
                  style={{ width: "100%" }}
                  options={availableAccessGroups.map((group) => ({
                    value: group.id,
                    label: group.name,
                  }))}
                  onChange={setRasterAccessGroupIds}
                />
              </section>

              {rasterUploading && (
                <section className="import-section raster-upload-progress">
                  <Space>
                    <Tag color="processing">正在上传</Tag>
                    <Typography.Text type="secondary">
                      已上传 {rasterUploadProgress}%
                    </Typography.Text>
                  </Space>
                  <Progress
                    percent={rasterUploadProgress}
                    status="active"
                    showInfo
                  />
                </section>
              )}
            </div>
          )}

          {currentStep === 1 && importKind === "vector" && vectorFile && (
            <VectorImportWorkflow
              key={`${vectorFile.name}-${vectorFile.lastModified}`}
              file={vectorFile}
              domainDefinitions={domainDefinitions}
              categoryOptions={categoryOptions}
              availableAccessGroups={availableAccessGroups}
              onReset={resetImportState}
              onCompleted={setVectorResult}
            />
          )}

          {currentStep === 1 && importKind === "unsupported" && (
            <section className="import-step-pane">
              <Result
                status="warning"
                title="暂不支持自动导入该文件类型"
                subTitle={
                  unsupportedFile
                    ? `${unsupportedFile.name} 未匹配到当前可用的表格、栅格或矢量导入流程。`
                    : "未匹配到当前可用的导入流程。"
                }
                extra={[
                  <Button
                    key="again"
                    type="primary"
                    icon={<ReloadOutlined />}
                    onClick={resetImportState}
                  >
                    重新选择文件
                  </Button>,
                ]}
              />
            </section>
          )}

          {currentStep === 2 && importKind === "tabular" && preview && (
            <section className="import-step-pane">
              {result ? (
                <Result
                  status="success"
                  title="数据导入完成"
                  subTitle={`已导入 ${result.resourceName}，共 ${result.importedRows} 行。`}
                  extra={[
                    <Button
                      key="view"
                      onClick={() =>
                        navigate(result.mode === "table" ? "/nongeo" : "/map")
                      }
                    >
                      {result.mode === "table"
                        ? "查看非地理数据"
                        : "查看地理数据"}
                    </Button>,
                    <Button
                      key="again"
                      type="primary"
                      icon={<ReloadOutlined />}
                      onClick={resetImportState}
                    >
                      继续导入
                    </Button>,
                  ]}
                />
              ) : (
                <>
                  <Space className="import-actions import-actions-top">
                    <Button onClick={() => setCurrentStep(1)}>上一步</Button>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined style={{ fontSize: 16 }} />}
                      loading={importing}
                      onClick={handleImport}
                    >
                      提交导入
                    </Button>
                  </Space>

                  <section className="import-section">
                    <Typography.Title level={5}>数据预览</Typography.Title>
                    {duplicateTarget && (
                      <DuplicateTargetAlert
                        target={duplicateTarget}
                        confirmed={duplicateNameConfirmed}
                      />
                    )}
                    <div className="import-preview-scroll">
                      <Table
                        size="small"
                        rowKey="previewRowKey"
                        pagination={false}
                        scroll={{ x: "max-content" }}
                        dataSource={previewRows}
                        columns={previewColumns}
                      />
                    </div>
                  </section>

                  <section className="import-section">
                    <Typography.Title level={5}>字段元数据</Typography.Title>
                    {selectedDomain && (
                      <Alert
                        type="info"
                        showIcon
                        title={`${selectedDomain.name}字段整理建议`}
                        description={
                          <Space size={[4, 4]} wrap>
                            {domainFieldHints[selectedDomain.code].map(
                              (field) => (
                                <Tag key={field}>{field}</Tag>
                              ),
                            )}
                          </Space>
                        }
                      />
                    )}
                    <Table
                      size="small"
                      rowKey="column"
                      pagination={false}
                      dataSource={preview.columns.map((column) => ({
                        column,
                        description: fieldMetadata[column] ?? "",
                        included: includedColumns.includes(column),
                      }))}
                      columns={[
                        {
                          title: "上传",
                          dataIndex: "included",
                          width: 64,
                          render: (_, record) => (
                            <Checkbox
                              checked={includedColumns.includes(record.column)}
                              onChange={(event) => {
                                setIncludedColumns((current) =>
                                  event.target.checked
                                    ? [...current, record.column]
                                    : current.filter(
                                        (column) => column !== record.column,
                                      ),
                                );
                              }}
                            />
                          ),
                        },
                        { title: "字段", dataIndex: "column", width: 150 },
                        {
                          title: "描述",
                          dataIndex: "description",
                          render: (_, record) => (
                            <Input.TextArea
                              autoSize={{ minRows: 1, maxRows: 4 }}
                              placeholder="中文名称、单位、计算方式、数据来源等，可留空"
                              value={fieldMetadata[record.column] ?? ""}
                              onChange={(event) =>
                                setFieldMetadata((current) => ({
                                  ...current,
                                  [record.column]: event.target.value,
                                }))
                              }
                            />
                          ),
                        },
                      ]}
                    />
                  </section>
                </>
              )}
            </section>
          )}

          {currentStep === 2 && importKind === "raster" && (
            <section className="import-step-pane">
              {rasterJob ? (
                <section className="raster-import-progress">
                  <Space>
                    <Tag color={rasterJobTagColor(rasterJob)}>
                      {rasterJobStatusText(rasterJob)}
                    </Tag>
                    <Typography.Text type="secondary">
                      任务 ID：{rasterJob.id}
                    </Typography.Text>
                  </Space>
                  <section className="import-section raster-upload-progress">
                    <Typography.Text strong>上传进度</Typography.Text>
                    <Progress
                      percent={completedRasterUploadProgress}
                      status="success"
                    />
                  </section>
                  <section className="import-section raster-gdal-progress">
                    <Typography.Text strong>GDAL 预处理进度</Typography.Text>
                    <Progress
                      percent={rasterJob.progressPercent}
                      status={rasterJobProgressStatus(rasterJob)}
                    />
                  </section>
                  {rasterJob.status === "ready" && (
                    <Alert
                      type="success"
                      showIcon
                      title="栅格预处理完成"
                      description="数据资源和地图图层已在后台登记，可在存量数据或地图数据目录中查看。"
                    />
                  )}
                  {rasterJob.status === "failed" && (
                    <Alert
                      type="error"
                      showIcon
                      title="栅格预处理失败"
                      description={rasterJob.error || "后台任务执行失败"}
                    />
                  )}
                  {rasterJob.messages.length > 0 && (
                    <pre className="raster-import-log">
                      {rasterJob.messages.slice(-12).join("\n")}
                    </pre>
                  )}
                  {!isActiveRasterJob(rasterJob) && (
                    <Space className="import-actions import-actions-top">
                      <Button
                        type="primary"
                        icon={<ReloadOutlined />}
                        onClick={resetImportState}
                      >
                        继续导入
                      </Button>
                    </Space>
                  )}
                </section>
              ) : (
                <Result
                  status="info"
                  title="尚未提交栅格预处理任务"
                  extra={[
                    <Button key="back" onClick={() => setCurrentStep(1)}>
                      返回配置
                    </Button>,
                  ]}
                />
              )}
            </section>
          )}
        </Form>
      </ProCard>

      <Modal
        title="上传数据校验结果"
        open={issuesOpen}
        onCancel={() => setIssuesOpen(false)}
        cancelButtonProps={{ style: { display: "none" } }}
        okText={
          hasBlockingIssues
            ? ""
            : hasIgnorableUncertainty
              ? pendingIssueAction === "continue"
                ? "忽略并进入预览"
                : "忽略并继续导入"
              : ""
        }
        confirmLoading={importing}
        okButtonProps={{
          style:
            hasBlockingIssues || !hasIgnorableUncertainty
              ? { display: "none" }
              : undefined,
          disabled: hasIgnorableUncertainty && !ignoreCoordinateUncertainty,
        }}
        onOk={handleIssueConfirm}
      >
        <Alert
          type={hasBlockingIssues ? "error" : "warning"}
          showIcon
          title={
            hasBlockingIssues
              ? "检测到阻止上传的问题"
              : "检测到可确认忽略的问题"
          }
          description={
            hasBlockingIssues
              ? "请修正以下问题后重新预检或提交。"
              : "坐标不确定性差距可能影响空间分析精度，确认后可继续。"
          }
        />
        <Table
          className="import-issue-table"
          size="small"
          rowKey={(record) => `${record.code}-${record.message}`}
          pagination={false}
          dataSource={validationIssues}
          columns={[
            {
              title: "问题项",
              dataIndex: "message",
              render: (value, record) => (
                <Space orientation="vertical" size={2}>
                  <Typography.Text>{value}</Typography.Text>
                  <Space size={4} align="center">
                    <Tag color={record.blocking ? "red" : "gold"}>
                      {record.blocking ? "必须修正" : "可忽略"}
                    </Tag>
                    {record.code === "coordinate_uncertainty" && (
                      <Tooltip title="系统会根据经纬度小数位数估算坐标量化误差；该项表示最大误差与最小误差的比值过大，可能说明同一批数据的坐标精度不一致。">
                        <Button
                          type="text"
                          size="small"
                          icon={
                            <QuestionCircleOutlined style={{ fontSize: 14 }} />
                          }
                          aria-label="坐标不确定性差距说明"
                        />
                      </Tooltip>
                    )}
                  </Space>
                </Space>
              ),
            },
          ]}
        />
        {hasIgnorableUncertainty && !hasBlockingIssues && (
          <Checkbox
            checked={ignoreCoordinateUncertainty}
            onChange={(event) =>
              setIgnoreCoordinateUncertainty(event.target.checked)
            }
          >
            我已了解坐标不确定性差距，并继续
          </Checkbox>
        )}
      </Modal>
      <Modal
        title="确认重复数据名称"
        open={duplicateConfirmOpen}
        okText="确认继续导入"
        cancelText="返回修改"
        onCancel={() => setDuplicateConfirmOpen(false)}
        onOk={() => {
          setDuplicateNameConfirmed(true);
          setDuplicateConfirmOpen(false);
          if (validationIssues.length) {
            setPendingIssueAction("continue");
            setIssuesOpen(true);
            return;
          }
          message.success("已确认重复数据名称，后端将新建数据记录");
          setCurrentStep(2);
        }}
      >
        {duplicateTarget && (
          <Alert
            type="warning"
            showIcon
            title="数据名重复"
            description={
              <Space orientation="vertical" size={4}>
                <Typography.Text>{duplicateTarget.message}</Typography.Text>
                <Typography.Text type="secondary">
                  继续导入会创建新的数据记录，不会覆盖已有数据。
                </Typography.Text>
              </Space>
            }
          />
        )}
      </Modal>
      <Modal
        title="离开数据导入页面？"
        open={pendingNavigationPath !== null}
        okText="确认离开"
        cancelText="继续导入"
        okType="danger"
        onOk={() => {
          const nextPath = pendingNavigationPath;
          setPendingNavigationPath(null);
          if (nextPath) {
            allowNavigationRef.current = true;
            navigate(nextPath);
          }
        }}
        onCancel={() => setPendingNavigationPath(null)}
      >
        <Alert
          type="warning"
          showIcon
          title="当前导入尚未完成"
          description={unfinishedImportWarning}
        />
      </Modal>
    </div>
  );
}

function DomainDetail({ domain }: { domain: DomainDefinition }) {
  return (
    <div className="import-domain-detail">
      <div>
        <Typography.Text strong>推荐资源形态</Typography.Text>
        <Space size={[4, 4]} wrap>
          {domain.recommendedResourceTypes.map((type) => (
            <Tag key={type}>{resourceTypeLabels[type] ?? type}</Tag>
          ))}
        </Space>
      </div>
      <div>
        <Typography.Text strong>后续标准化实体</Typography.Text>
        <Typography.Text type="secondary">
          {domain.coreEntities.join("、")}
        </Typography.Text>
      </div>
    </div>
  );
}

function ImportStorageSummary({
  mode,
  domain,
}: {
  mode?: ImportStorageMode;
  domain?: DomainDefinition;
}) {
  const steps = storageSteps(mode, domain);
  return (
    <div className="import-storage-summary">
      {steps.map((step) => (
        <article key={step.title} className="import-storage-item">
          <Tag color={step.color}>{step.label}</Tag>
          <Typography.Text strong>{step.title}</Typography.Text>
          <Typography.Text type="secondary">{step.description}</Typography.Text>
        </article>
      ))}
    </div>
  );
}

function storageSteps(mode?: ImportStorageMode, domain?: DomainDefinition) {
  const standardTargets = domain?.coreEntities.length
    ? domain.coreEntities.join("、")
    : "待选择业务类型后确定";
  if (mode === "raster") {
    return [
      {
        label: "资源登记",
        title: "DataResource.raster",
        description:
          "在存量数据中生成栅格资源记录，保留上传者、大小、状态和后续权限维护入口。",
        color: "blue",
      },
      {
        label: "物理存储",
        title: "RasterDataset + COG",
        description:
          "后台预处理为可切片渲染的栅格文件，并创建可上图的地图图层。",
        color: "geekblue",
      },
      {
        label: "标准化去向",
        title: standardTargets,
        description:
          "后续可登记为遥感产品，并与样方、种群、群落或地点采样值关联。",
        color: "green",
      },
    ];
  }

  if (mode === "geographic") {
    return [
      {
        label: "资源登记",
        title: "DataResource.vector",
        description:
          "在存量数据中生成矢量资源记录，可维护权限、状态和默认可视化方案。",
        color: "blue",
      },
      {
        label: "空间存储",
        title: "GeoPackage 点图层",
        description:
          "经纬度列会生成点几何，进入地图数据目录并支持查询、过滤和上图分析。",
        color: "cyan",
      },
      {
        label: "标准化去向",
        title: standardTargets,
        description:
          "后续通过字段映射把原始列关联到样点、样方、个体、种质或样品等实体。",
        color: "green",
      },
    ];
  }
  if (mode === "table") {
    return [
      {
        label: "资源登记",
        title: "DataResource.table",
        description: "在存量数据中生成表格资源记录，保留原始字段和行数信息。",
        color: "blue",
      },
      {
        label: "表格存储",
        title: "table/data.sqlite",
        description:
          "作为普通属性表保存，可按字段检索、导出和继续补充字段元数据。",
        color: "purple",
      },
      {
        label: "标准化去向",
        title: standardTargets,
        description:
          "后续依靠样品编号、地点、样方编号或实验批次等字段与标准实体建立关联。",
        color: "green",
      },
    ];
  }
  return [
    {
      label: "待选择",
      title: "请选择入库方式",
      description:
        "选择后系统会显示本次数据首先写入的资源类型、物理存储和后续标准化目标。",
      color: "default",
    },
  ];
}

function shouldBlockImport(
  issues: ImportValidationIssue[],
  ignoreCoordinateUncertainty: boolean,
) {
  return issues.some(
    (issue) =>
      issue.blocking ||
      (issue.code === "coordinate_uncertainty" && !ignoreCoordinateUncertainty),
  );
}

function isActiveRasterJob(job: RasterJob) {
  return job.status === "queued" || job.status === "running";
}

function rasterJobStatusText(job: RasterJob) {
  switch (job.status) {
    case "queued":
      return "等待处理";
    case "running":
      return "正在预处理";
    case "ready":
      return "处理完成";
    case "failed":
      return "处理失败";
    default:
      return job.status;
  }
}

function rasterJobTagColor(job: RasterJob) {
  if (job.status === "ready") {
    return "green";
  }
  if (job.status === "failed") {
    return "red";
  }
  return "processing";
}

function rasterJobProgressStatus(job: RasterJob) {
  if (job.status === "ready") {
    return "success";
  }
  if (job.status === "failed") {
    return "exception";
  }
  return "active";
}

function fileStem(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function inferDomainTypeFromFile(
  fileName: string,
  preview?: ImportPreview,
): DataDomainType {
  if (/\.(tif|tiff|img|vrt|dat|bsq|bil|bip)$/i.test(fileName)) {
    return "remote_sensing";
  }
  const text = `${fileName} ${preview?.columns.join(" ") ?? ""}`.toLowerCase();
  const rules: Array<{ type: DataDomainType; keywords: string[] }> = [
    {
      type: "remote_sensing",
      keywords: [
        "遥感",
        "影像",
        "ndvi",
        "npp",
        "landsat",
        "sentinel",
        "无人机",
      ],
    },
    {
      type: "genome",
      keywords: [
        "基因组",
        "genome",
        "sequencing",
        "sequence",
        "snp",
        "vcf",
        "assembly",
      ],
    },
    {
      type: "molecular",
      keywords: ["分子", "pcr", "ssr", "rna", "marker", "引物", "实验"],
    },
    {
      type: "germplasm",
      keywords: ["种质", "dna样品", "dna", "样品清单", "核心资源", "保存材料"],
    },
    {
      type: "community",
      keywords: ["群落", "样方", "多样性", "盖度", "重要值", "功能性状"],
    },
    {
      type: "population",
      keywords: ["种群", "population", "群体", "分布区"],
    },
    {
      type: "individual",
      keywords: ["个体", "单株", "植株", "性别", "胸径", "树高"],
    },
    {
      type: "field_survey",
      keywords: ["野外", "调查", "样点", "路线", "采集", "观测"],
    },
  ];
  const matched = rules.find((rule) =>
    rule.keywords.some((keyword) => text.includes(keyword.toLowerCase())),
  );
  if (matched) {
    return matched.type;
  }
  return "other";
}

function fileExtension(name: string) {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : "";
}

function detectImportKind(file: File): ImportKind {
  const extension = fileExtension(file.name);
  if ([".csv", ".xls", ".xlsx"].includes(extension)) {
    return "tabular";
  }
  if (
    [".tif", ".tiff", ".img", ".vrt", ".dat", ".bsq", ".bil", ".bip"].includes(
      extension,
    )
  ) {
    return "raster";
  }
  if (
    [".geojson", ".json", ".gpkg", ".kml", ".kmz", ".shp", ".zip"].includes(
      extension,
    )
  ) {
    return "vector";
  }
  return "unsupported";
}

function rasterFileExtensionLabel(name: string) {
  const extension = fileExtension(name);
  switch (extension) {
    case ".tif":
    case ".tiff":
      return "GeoTIFF";
    case ".img":
      return "IMG";
    case ".vrt":
      return "VRT";
    case ".dat":
    case ".bsq":
    case ".bil":
    case ".bip":
      return "ENVI 栅格";
    default:
      return extension || "未知";
  }
}

function rasterFileNeedsCompanions(name: string) {
  return /\.(dat|bsq|bil|bip|vrt)$/i.test(name);
}

function DuplicateTargetAlert({
  target,
  confirmed,
}: {
  target: ImportDuplicateTarget;
  confirmed: boolean;
}) {
  return (
    <Alert
      type="warning"
      showIcon
      title={confirmed ? "已确认重复数据名称" : "数据名重复"}
      description={
        <Space orientation="vertical" size={4}>
          <Typography.Text>{target.message}</Typography.Text>
          <Typography.Text type="secondary">
            {confirmed
              ? "继续导入会新建数据记录，不会覆盖已有数据。"
              : `数据名称：${target.targetName}`}
          </Typography.Text>
        </Space>
      }
    />
  );
}

function withFixedAccessScopes(values: AccessScopeId[] = []): AccessScopeId[] {
  const optionalValues = values.filter((value) => value !== selfAccessScopeId);
  return [selfAccessScopeId, ...optionalValues];
}

function realAccessGroupIds(values: AccessScopeId[] = []): number[] {
  return values.filter((value): value is number => typeof value === "number");
}

function importIssuesFromError(error: unknown): ImportValidationIssue[] {
  if (!(error instanceof ApiError)) {
    return [];
  }
  const data = error.data as { issues?: ImportValidationIssue[] } | null;
  return Array.isArray(data?.issues) ? data.issues : [];
}

type ImportAccessGroup = AdminDataResourceAccessGroup;

function isGuestGroup(group: ImportAccessGroup) {
  return group.isGuest === true || group.name === "游客";
}
