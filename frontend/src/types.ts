import type { GroupSymbolization, RasterSymbolization, VectorSymbolization } from './symbolization';

export interface Bootstrap {
  systemName: string;
  allowRegistration: boolean;
  map: {
    defaultCenter: [number, number];
    defaultZoom: number;
    defaultBasemap: string;
    mapboxAccessToken: string;
  };
  limits: {
    uploadMaxMb: number;
    queryResultLimit: number;
  };
}

export interface User {
  id: number;
  username: string;
  displayName: string;
  email: string;
  isStaff: boolean;
  isSuperuser: boolean;
  roles: string[];
  permissions: {
    canAccessAdmin: boolean;
    canExportData: boolean;
    canMaintainData: boolean;
    canManageRasterCache: boolean;
    canManageRasterData: boolean;
  };
}

export interface DictionaryItem {
  id: number;
  type: string;
  code: string;
  name: string;
}

export interface DataResource {
  id: number;
  name: string;
  code: string;
  dataType: 'vector' | 'raster' | 'table' | 'document' | 'image';
  category: DictionaryItem | null;
  source: string;
  provider: string;
  dataDate: string | null;
  spatialExtent: string;
  coordinateSystem: string;
  fileFormat: string;
  description: string;
  qualityNote: string;
  status: string;
  isQueryable: boolean;
  isRenderable: boolean;
  updatedAt: string;
}

export interface ResourceField {
  name: string;
  type: string;
  nullable: boolean;
  sampleValues: Array<string | number | boolean | null>;
}

export interface DataResourceProfile {
  resource: DataResource;
  fields: ResourceField[];
  featureCount: number | null;
  geometryType: string;
  bounds: number[];
  raster?: RasterDatasetProfile | null;
}

export interface RasterBandMetadata {
  band: number;
  type: string;
  description: string;
  colorInterpretation: string;
  min: number;
  max: number;
}

export interface RasterDatasetProfile {
  id: number;
  name: string;
  code: string;
  status: string;
  sourcePath: string;
  processedPath: string;
  sourceMetadataPath: string;
  processedMetadataPath: string;
  dataResourceId: number | null;
  mapLayerId: number | null;
  bandCount: number;
  bounds3857: number[];
  bounds4326: number[];
  imageCoordinates: Array<[number, number]>;
  defaultRules: Partial<RasterSymbolization>;
  sourceFileSize: number;
  processedFileSize: number;
  progressLog: string;
  errorMessage: string;
  importedAt: string | null;
  processedAt: string | null;
  metadata: {
    size: number[];
    driver: string;
    coordinateSystem: string | number;
    bands: RasterBandMetadata[];
  };
}

export interface AttributeFilter {
  id: string;
  field: string;
  operator: 'contains' | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';
  value: string;
  valueTo?: string;
}

export interface SpatialFilter {
  mode: 'rectangle' | 'circle' | 'ellipse' | 'polygon';
  geometry: GeoJsonGeometry;
}

export interface ResourceQueryPayload {
  attributeFilters: AttributeFilter[];
  spatialFilter: SpatialFilter | null;
  limit: number;
}

export interface GeoJsonGeometry {
  type: string;
  coordinates: unknown;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: Array<Record<string, unknown>>;
}

export interface ResourceQueryResult {
  resourceId: number;
  resourceName: string;
  totalCount: number;
  returnedCount: number;
  limit: number;
  fields: ResourceField[];
  geojson: GeoJsonFeatureCollection;
}

export interface LoadedVectorLayer {
  id: string;
  name: string;
  layerType: 'vector';
  sourceResource: DataResource;
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
  layerType: 'raster';
  sourceResource: DataResource;
  pngUrl?: string;
  tileUrl?: string;
  imageCoordinates?: Array<[number, number]>;
  rasterDatasetId?: number;
  rasterLayerId?: number | null;
  rasterMetadata?: RasterDatasetProfile['metadata'];
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
  sourceResource: DataResource;
  visible: boolean;
  summary: string;
  createdAt: string;
  metadata: Record<string, string | number | boolean | null | undefined>;
  symbolization: GroupSymbolization;
  children: LoadedLayer[];
}

export interface DataCatalog {
  id: number;
  name: string;
  code: string;
  parentId: number | null;
  description: string;
  sortOrder: number;
  resources: DataResource[];
}

export interface MapLayer {
  id: number;
  name: string;
  code: string;
  layerType: 'vector' | 'raster';
  geometryType: 'point' | 'line' | 'polygon' | 'mixed';
  category: DictionaryItem | null;
  dataResourceId: number | null;
  sortOrder: number;
  defaultVisible: boolean;
  defaultOpacity: number;
  symbolization: Record<string, string | number | boolean>;
  bounds: number[];
  legend: string;
  rasterRules: Record<string, string | number | boolean>;
  isActive: boolean;
  updatedAt: string;
}

export interface RasterRenderResult {
  delivery: 'image' | 'xyz';
  datasetId: number;
  layerId: number | null;
  cacheKey?: string;
  styleHash: string;
  pngUrl?: string;
  tileUrl?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  status: string;
  bounds3857: number[];
  bounds4326: number[];
  imageCoordinates: Array<[number, number]>;
  rules: Partial<RasterSymbolization>;
}

export interface RasterJob {
  id: string;
  kind: 'import' | 'scan' | 'render';
  status: 'queued' | 'running' | 'ready' | 'failed';
  progressPercent: number;
  messages: string[];
  result: RasterRenderResult | RasterDatasetProfile | { items: RasterDatasetProfile[]; count: number } | null;
  error: string;
  startedAt: number;
  finishedAt: number | null;
}

export interface Achievement {
  id: number;
  title: string;
  code: string;
  category: DictionaryItem | null;
  summary: string;
  source: string;
  relatedLayerId: number | null;
  displayOrder: number;
  status: string;
  updatedAt: string;
}

export interface SearchResult {
  resources: DataResource[];
  achievements: Achievement[];
}

export interface ResourceFilters {
  q?: string;
  dataType?: string;
  category?: string;
  source?: string;
  provider?: string;
  dateFrom?: string;
  dateTo?: string;
}
