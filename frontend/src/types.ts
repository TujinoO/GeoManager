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

export interface LoadedLayer {
  id: string;
  name: string;
  sourceResource: DataResource;
  geojson: GeoJsonFeatureCollection;
  geometryType: string;
  visible: boolean;
  opacity: number;
  summary: string;
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
