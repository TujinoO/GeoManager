import type { components, operations } from "./api/schema";
import type {
  GroupSymbolization,
  RasterSymbolization,
  VectorSymbolization,
} from "./symbolization";

type Schemas = components["schemas"];

export type Bootstrap = Schemas["BootstrapResponse"];
export type BaseUser = Schemas["BaseUserInfo"];
export type User = Schemas["UserInfo"];
export type UserCreateRequest = Schemas["UserCreateRequest"];
export type UserCreateResponse = Schemas["UserCreateResponse"];
export type UserListResponse = Schemas["UserListResponse"];
export type UserGroupUpdateRequest = Schemas["UserGroupUpdateRequest"];
export type Group = Schemas["Group"];
export type GroupListResponse = Schemas["GroupListResponse"];
export type GroupCreateRequest = Schemas["GroupCreateRequest"];
export type GroupUpdateRequest = Schemas["GroupUpdateRequest"];
export type AdminProfile = Schemas["AdminProfileResponse"];
export type AdminProfileUpdate = Schemas["AdminProfileUpdateRequest"];
export type AdminProfilePermissionsUpdate =
  Schemas["AdminProfilePermissionsRequest"];
export type AdminProfilePasswordUpdate = Schemas["AdminProfilePasswordRequest"];
export type AdminPermissionItem = Schemas["AdminPermissionItem"];
export type AdminOperationLog = Schemas["AdminOperationLog"];
export type AdminOperationLogQuery = NonNullable<
  operations["listAdminOperationLogs"]["parameters"]["query"]
>;
export type AdminDashboard = Schemas["AdminDashboardResponse"];
export type AdminDashboardServer = Schemas["AdminDashboardServerResponse"];
export type AdminSettings = Schemas["AdminSettingsResponse"];
export type AdminSettingsUpdate = Schemas["AdminSettingsUpdateRequest"];
export type DataResource = Schemas["DataResource"];
export type ResourceListItem = Schemas["ResourceListItem"];
export type ResourceField = Schemas["FieldInfo"];
export type ImportCoordinateStats = Schemas["CoordinateStats"];
export type ImportValidationIssue = Schemas["ValidationIssue"];
export type ImportPreview = Schemas["ImportPreviewResponse"];
export type ImportValidateResult = Schemas["ImportValidateResponse"];
export type ImportCommitResult = Schemas["ImportCommitResponse"];
export type RasterBandMetadata = Schemas["RasterBandInfo"];
type RasterDatasetProfile = Schemas["RasterDataset"];
export type GeoJsonGeometry = Schemas["GeoJSONGeometry"];
export type GeoJsonValidationWarning = Schemas["ValidationWarning"];
export type ResourceQueryResult = Schemas["QueryResponse"];
export type ExportLayerItem = Schemas["ExportItem"];
export type ExportLayersPayload = Schemas["ExportRequest"];
export type DataCatalog = Schemas["Directory"];
export type MapLayerListItem = Schemas["LayerListResponse"]["items"][number];
export type RasterRenderResult = Schemas["RasterRenderResult"];
export type RasterUniqueValuesResult = Schemas["UniqueValuesResponse"];
export type RasterJob = Schemas["AsyncJobResponse"];
export type Achievement = Schemas["Achievement"];
export type SearchResult = Schemas["SearchResponse"];

export type DataResourceProfile = Schemas["ResourceProfileResponse"];

export interface ImportCommitPayload {
  name: string;
  tableName: string;
  importMode: "geographic" | "table";
  longitudeColumn?: string;
  latitudeColumn?: string;
  ignoreCoordinateUncertainty: boolean;
  overwrite: boolean;
  includedColumns: string[];
  fieldMetadata: Record<string, string>;
}

export interface ImportValidatePayload {
  importMode: "geographic" | "table";
  longitudeColumn?: string;
  latitudeColumn?: string;
}

export type AttributeFilter = Schemas["AttributeFilter"] & {
  id: string;
};

export type SpatialFilter = Schemas["SpatialFilter"] & {
  geometry: GeoJsonGeometry;
};

export type ResourceQueryPayload = Omit<
  Schemas["QueryRequest"],
  "attributeFilters" | "spatialFilter"
> & {
  attributeFilters: AttributeFilter[];
  spatialFilter: SpatialFilter | null;
};

export type GeoJsonFeatureCollection = Schemas["GeoJSONFeatureCollection"] & {
  warnings?: GeoJsonValidationWarning[];
};

export interface FeatureInfo {
  layerId: string;
  layerName: string;
  properties: Record<string, unknown>;
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
  visible: boolean;
  summary: string;
  createdAt: string;
  metadata: Record<string, string | number | boolean | null | undefined>;
  symbolization: GroupSymbolization;
  children: LoadedLayer[];
}

export type ResourceFilters = NonNullable<
  operations["getResources"]["parameters"]["query"]
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
