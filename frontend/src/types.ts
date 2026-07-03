import type {
  AdminDashboardResponse,
  AdminDashboardServerResponse,
  AdminBackupOverviewResponse,
  AdminBackupRunCreateRequest,
  AdminBackupRunListResponse,
  AdminBackupSettingsResponse,
  AdminBackupSettingsUpdateRequest,
  AdminBackupTargetTestRequest,
  AdminBackupTargetTestResponse,
  AdminDataResourceListResponse,
  AdminDataResourceGroupUpdateRequest,
  AdminDataResourceUpdateRequest,
  AdminProfilePasswordRequest,
  AdminProfilePermissionsRequest,
  AdminProfileResponse,
  AdminProfileUpdateRequest,
  AdminSettingsResponse,
  AdminSettingsUpdateRequest,
  AdminSystemLogResponse,
  AsyncJobResponse,
  BaseUserInfo,
  BootstrapResponse,
  CoordinateStats,
  DataDomainType,
  DataSchemaSummaryResponse,
  DataResource,
  Directory,
  ExportAdminDataResourcesData,
  ExportItem,
  ExportRequest,
  GermplasmAccessionListResponse,
  FieldInfo,
  AttributeFilter as GeneratedAttributeFilter,
  GeoJsonFeatureCollection as GeneratedGeoJsonFeatureCollection,
  SpatialFilter as GeneratedSpatialFilter,
  WorkspaceSceneSnapshot as GeneratedWorkspaceSceneSnapshot,
  GeoJsonGeometry,
  ImportCommitResponse,
  ImportPreviewResponse,
  ImportValidateResponse,
  LayerListResponse,
  ListAdminBackupRunsData,
  ListAdminDataResourcesData,
  ListGermplasmAccessionsData,
  ListAdminOperationLogsData,
  ListAdminSystemLogsData,
  ListAdminWorkspacesData,
  QueryRequest,
  QueryResponse,
  RasterBandInfo,
  RasterDataset,
  RasterRenderResult,
  ResourceListItem,
  ResourceProfileResponse,
  SearchResponse,
  UniqueValuesResponse,
  UserInfo,
  ValidationIssue,
  ValidationWarning,
  AdminWorkspaceSceneListResponse,
  AdminWorkspaceSceneUpdateRequest,
  WorkspaceScene,
} from "./api/generated";

export type {
  AdminDataResource,
  AdminDataResourceGroup,
  AdminOperationLog,
  AdminPermissionItem,
  AdminBackupRun,
  BackupPlanType,
  BackupRunStatus,
  BackupTargetType,
  AdminSystemLogFile,
  AdminWorkspaceScene,
  AdminWorkspaceSceneListResponse,
  AdminWorkspaceSceneUpdateRequest,
  DataDomainDefinition,
  DataResource,
  DataDomainType,
  DataSchemaCatalogNode,
  GeoJsonGeometry,
  Group,
  GroupCreateRequest,
  GroupListResponse,
  GroupUpdateRequest,
  ImportDuplicateTarget,
  RasterRenderResult,
  ResourceListItem,
  UserCreateRequest,
  UserCreateResponse,
  UserGroupUpdateRequest,
  UserListResponse,
  UserPasswordResetResponse,
  UserPermissionUpdateRequest,
  UserUpdateRequest,
  WorkspaceScene,
  WorkspaceSceneCreateRequest,
  WorkspaceSceneUpdateRequest,
} from "./api/generated";

import type {
  GroupSymbolization,
  RasterSymbolization,
  VectorSymbolization,
} from "./symbolization";

export type Bootstrap = BootstrapResponse;
export type BaseUser = BaseUserInfo;
export type User = UserInfo;
export type AdminProfile = AdminProfileResponse;
export type AdminProfileUpdate = AdminProfileUpdateRequest;
export type AdminProfilePermissionsUpdate = AdminProfilePermissionsRequest;
export type AdminProfilePasswordUpdate = AdminProfilePasswordRequest;
export type AdminOperationLogQuery = NonNullable<
  ListAdminOperationLogsData["query"]
>;
export type AdminSystemLog = AdminSystemLogResponse;
export type AdminSystemLogQuery = NonNullable<ListAdminSystemLogsData["query"]>;
export type AdminBackupOverview = AdminBackupOverviewResponse;
export type AdminBackupSettings = AdminBackupSettingsResponse;
export type AdminBackupSettingsUpdate = AdminBackupSettingsUpdateRequest;
export type AdminBackupTargetTestPayload = AdminBackupTargetTestRequest;
export type AdminBackupTargetTestResult = AdminBackupTargetTestResponse;
export type AdminBackupRunCreate = AdminBackupRunCreateRequest;
export type AdminBackupRunList = AdminBackupRunListResponse;
export type AdminBackupRunFilters = NonNullable<
  ListAdminBackupRunsData["query"]
>;
export type AdminDashboard = AdminDashboardResponse;
export type AdminDashboardServer = AdminDashboardServerResponse;
export type AdminSettings = AdminSettingsResponse;
export type AdminSettingsUpdate = AdminSettingsUpdateRequest;
export type AdminDataResourceList = AdminDataResourceListResponse;
export type AdminDataResourceUpdate = AdminDataResourceUpdateRequest;
export type AdminDataResourceGroupUpdate = AdminDataResourceGroupUpdateRequest;
export type AdminDataResourceFilters = NonNullable<
  ListAdminDataResourcesData["query"]
>;
export type AdminDataResourceExportFilters = NonNullable<
  ExportAdminDataResourcesData["query"]
>;
export type DataSchemaSummary = DataSchemaSummaryResponse;
export type GermplasmAccessionList = GermplasmAccessionListResponse;
export type GermplasmAccessionItem =
  GermplasmAccessionListResponse["items"][number];
export type GermplasmAccessionFilters = NonNullable<
  ListGermplasmAccessionsData["query"]
>;
export type AdminWorkspaceList = AdminWorkspaceSceneListResponse;
export type AdminWorkspaceUpdate = AdminWorkspaceSceneUpdateRequest;
export type AdminWorkspaceFilters = NonNullable<
  ListAdminWorkspacesData["query"]
>;
export type ResourceField = FieldInfo;
export type ImportCoordinateStats = CoordinateStats;
export type ImportValidationIssue = ValidationIssue;
export interface ImportWorkbookSheet {
  name: string;
  rowCount: number;
  columnCount: number;
  isGeographic: boolean;
  longitudeColumn?: string | null;
  latitudeColumn?: string | null;
  suggestedName?: string;
}

export type ImportPreview = ImportPreviewResponse & {
  activeSheetName?: string | null;
  sheets?: ImportWorkbookSheet[];
};
export type ImportValidateResult = ImportValidateResponse;
export type ImportCommitResult = ImportCommitResponse;
export type RasterBandMetadata = RasterBandInfo;
type RasterDatasetProfile = RasterDataset;
export type GeoJsonValidationWarning = ValidationWarning;
export type ResourceQueryResult = QueryResponse;
export type ExportLayerItem = ExportItem;
export type ExportLayersPayload = ExportRequest;
export type DataCatalog = Directory;
export type MapLayerListItem = LayerListResponse["items"][number];
export type RasterUniqueValuesResult = UniqueValuesResponse;
export type RasterJob = AsyncJobResponse;
export type SearchResult = SearchResponse;
export type WorkspaceSceneKind = WorkspaceScene["kind"];
export type SavedWorkspaceLayer = {
  id: string;
  name: string;
  layerType: LoadedLayer["layerType"];
  sourceResource: ResourceListItem;
  geometryType: string;
  visible: boolean;
  summary: string;
  metadata: Record<string, string | number | boolean | null | undefined>;
  symbolization: LoadedLayer["symbolization"];
  fields: ResourceField[];
  query?: {
    attributeFilters: AttributeFilter[];
    spatialFilter: SpatialFilter | null;
  };
  tileUrl?: string;
  imageCoordinates?: RasterRenderResult["imageCoordinates"];
  rasterDatasetId?: number;
  rasterLayerId?: number | null;
  rasterMetadata?: RasterDatasetProfile["metadata"];
  renderStatus?: string;
  renderProgress?: number;
  renderMessages?: string[];
};
export type SavedWorkspaceLayerGroup = Omit<LoadedLayerGroup, "children"> & {
  children: SavedWorkspaceLayer[];
};
export type WorkspaceSceneSnapshot = GeneratedWorkspaceSceneSnapshot & {
  version?: number;
  groups?: SavedWorkspaceLayerGroup[] | LoadedLayerGroup[];
  selectedLayerId?: string | null;
  mapView?: MapViewState | null;
  savedAt?: string;
};

export type DataResourceProfile = ResourceProfileResponse;

export interface ImportCommitPayload {
  name: string;
  domainType: DataDomainType;
  sheetName?: string | null;
  tableName: string;
  importMode: "geographic" | "table";
  longitudeColumn?: string;
  latitudeColumn?: string;
  ignoreCoordinateUncertainty: boolean;
  duplicateConfirmed: boolean;
  includedColumns: string[];
  fieldMetadata: Record<string, string>;
  accessGroupIds: number[];
}

export interface ImportValidatePayload {
  name?: string;
  sheetName?: string | null;
  importMode: "geographic" | "table";
  tableName?: string;
  longitudeColumn?: string;
  latitudeColumn?: string;
}

export type AttributeFilter = GeneratedAttributeFilter & {
  id: string;
};

export type SpatialFilter = GeneratedSpatialFilter & {
  geometry: GeoJsonGeometry;
};

export type ResourceQueryPayload = Omit<
  QueryRequest,
  "attributeFilters" | "spatialFilter"
> & {
  attributeFilters: AttributeFilter[];
  spatialFilter: SpatialFilter | null;
};

export type GeoJsonFeatureCollection = GeneratedGeoJsonFeatureCollection & {
  warnings?: GeoJsonValidationWarning[];
};

export interface FeatureInfo {
  layerId: string;
  layerName: string;
  properties: Record<string, unknown>;
}

export interface MapViewState {
  center: [number, number];
  bounds: [number, number, number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface LoadedVectorLayer {
  id: string;
  name: string;
  layerType: "vector";
  sourceResource: ResourceListItem;
  geojson: GeoJsonFeatureCollection;
  geometryType: string;
  visible: boolean;
  summary: string;
  metadata: Record<string, string | number | boolean | null | undefined>;
  symbolization: VectorSymbolization;
  fields: ResourceField[];
  query?: {
    attributeFilters: AttributeFilter[];
    spatialFilter: SpatialFilter | null;
  };
}

export interface LoadedRasterLayer {
  id: string;
  name: string;
  layerType: "raster";
  sourceResource: DataResource;
  tileUrl?: string;
  imageCoordinates?: RasterRenderResult["imageCoordinates"];
  rasterDatasetId?: number;
  rasterLayerId?: number | null;
  rasterMetadata?: RasterDatasetProfile["metadata"];
  renderJobId?: string;
  renderStatus?: string;
  renderProgress?: number;
  renderMessages?: string[];
  geometryType: string;
  visible: boolean;
  summary: string;
  metadata: Record<string, string | number | boolean | null | undefined>;
  symbolization: RasterSymbolization;
  fields: ResourceField[];
}

export type LoadedLayer = LoadedVectorLayer | LoadedRasterLayer;

export interface LoadedLayerGroup {
  id: string;
  name: string;
  sourceResource: ResourceListItem;
  isManual?: boolean;
  visible: boolean;
  summary: string;
  createdAt: string;
  metadata: Record<string, string | number | boolean | null | undefined>;
  symbolization: GroupSymbolization;
  children: LoadedLayer[];
}

export type ResourceFilters = NonNullable<
  import("./api/generated").GetResourcesData["query"]
>;

export interface LoginFormValues {
  username: string;
  password: string;
  remember?: boolean;
}

export interface RegisterFormValues {
  username: string;
  email?: string;
  password: string;
  passwordConfirm: string;
}
