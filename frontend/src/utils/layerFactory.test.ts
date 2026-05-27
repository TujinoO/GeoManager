import { describe, it, expect } from 'vitest';
import { createVectorLayerGroup, createRasterLayerGroup } from './layerFactory';
import type { DataResource, DataResourceProfile, ResourceQueryResult } from '../types';

function makeResource(overrides: Partial<DataResource> = {}): DataResource {
  return {
    id: 1,
    name: '测试资源',
    code: 'test-resource',
    dataType: 'vector',
    category: null,
    source: '测试来源',
    provider: '测试单位',
    dataDate: null,
    spatialExtent: '80,40,85,45',
    coordinateSystem: 'EPSG:4326',
    fileFormat: 'GPKG',
    description: '',
    qualityNote: '',
    status: 'active',
    isQueryable: true,
    isRenderable: true,
    updatedAt: '2025-01-01',
    ...overrides,
  };
}

function makeProfile(overrides: Partial<DataResourceProfile> = {}): DataResourceProfile {
  return {
    resource: makeResource(),
    fields: [{ name: 'name', type: 'string', nullable: false, sampleValues: ['A'] }],
    featureCount: 10,
    geometryType: 'Point',
    bounds: [80, 40, 85, 45],
    ...overrides,
  };
}

function makeQueryResult(overrides: Partial<ResourceQueryResult> = {}): ResourceQueryResult {
  return {
    resourceId: 1,
    resourceName: '测试资源',
    totalCount: 10,
    returnedCount: 5,
    limit: 100,
    fields: [{ name: 'name', type: 'string', nullable: false, sampleValues: ['A'] }],
    geojson: { type: 'FeatureCollection', features: [] },
    ...overrides,
  };
}

describe('createVectorLayerGroup', () => {
  it('creates a group with one vector child', () => {
    const group = createVectorLayerGroup(makeResource(), makeProfile(), makeQueryResult());
    expect(group.children).toHaveLength(1);
    expect(group.children[0].layerType).toBe('vector');
    expect(group.children[0].visible).toBe(true);
    expect(group.visible).toBe(true);
  });

  it('includes resource name in group name', () => {
    const group = createVectorLayerGroup(makeResource({ name: '胡杨数据' }), makeProfile(), makeQueryResult());
    expect(group.name).toContain('胡杨数据');
  });

  it('uses default vector symbolization', () => {
    const group = createVectorLayerGroup(makeResource(), makeProfile(), makeQueryResult());
    const child = group.children[0];
    expect(child.layerType).toBe('vector');
    if (child.layerType === 'vector') {
      expect(child.symbolization.pointMode).toBeDefined();
      expect(child.symbolization.opacity).toBeDefined();
    }
  });

  it('stores query result count in summary', () => {
    const group = createVectorLayerGroup(makeResource(), makeProfile(), makeQueryResult({ returnedCount: 3, totalCount: 100 }));
    expect(group.summary).toContain('3/100');
  });
});

describe('createRasterLayerGroup', () => {
  it('returns null when no raster profile', () => {
    expect(createRasterLayerGroup(makeResource(), makeProfile({ raster: null }))).toBeNull();
  });

  it('creates a group with one raster child', () => {
    const rasterProfile = {
      id: 1,
      name: 'test',
      code: 'test',
      status: 'ready',
      sourcePath: 'raster/test.tif',
      processedPath: 'raster/test.cog.tif',
      sourceMetadataPath: '',
      processedMetadataPath: '',
      dataResourceId: 1,
      mapLayerId: 1,
      bandCount: 3,
      bounds3857: [100, 40, 110, 50],
      bounds4326: [80, 40, 85, 45],
      imageCoordinates: [[80, 45], [85, 45], [85, 40], [80, 40]] as Array<[number, number]>,
      defaultRules: {},
      sourceFileSize: 1000,
      processedFileSize: 800,
      progressLog: '',
      errorMessage: '',
      importedAt: '2025-01-01',
      processedAt: '2025-01-01',
      metadata: { size: [100, 100], driver: 'GTiff', coordinateSystem: 3857, bands: [] },
    };
    const group = createRasterLayerGroup(makeResource({ dataType: 'raster' }), makeProfile({ raster: rasterProfile }));
    expect(group).not.toBeNull();
    expect(group!.children).toHaveLength(1);
    expect(group!.children[0].layerType).toBe('raster');
  });
});
