import {
  cloneDefaultGroupSymbolization,
  cloneDefaultRasterSymbolization,
  cloneDefaultVectorSymbolization,
  rasterSymbolizationFromRules,
} from "../symbolization";
import type {
  DataResource,
  DataResourceProfile,
  LoadedLayerGroup,
  LoadedRasterLayer,
  LoadedVectorLayer,
  ResourceListItem,
  ResourceQueryResult,
} from "../types";
import {
  resourceCategoryName,
  resourceFormatLabel,
  resourceProvider,
  resourceSpatialExtent,
} from "./resources";

export function createVectorLayerGroup(
  resource: ResourceListItem,
  profile: DataResourceProfile,
  queryResult: ResourceQueryResult,
): LoadedLayerGroup {
  const now = new Date();
  const groupId = `query-${resource.id}-${now.getTime()}`;
  const summary = `${queryResult.returnedCount}/${queryResult.totalCount} 条 · ${profile.geometryType || "空间数据"}`;
  const metadata = {
    数据名称: resource.name,
    数据编号: resource.code,
    数据类型: resource.dataType,
    数据分类: resourceCategoryName(resource),
    数据来源: resource.source,
    提供单位: resourceProvider(resource),
    空间范围: resourceSpatialExtent(resource),
    坐标系统: resource.coordinateSystem,
    文件格式: resourceFormatLabel(resource),
    返回条数: queryResult.returnedCount,
    命中条数: queryResult.totalCount,
    加载时间: now.toLocaleString("zh-CN", { hour12: false }),
  };
  return {
    id: groupId,
    name: `${resource.name} 查询组`,
    sourceResource: resource,
    visible: true,
    summary,
    createdAt: now.toISOString(),
    metadata,
    symbolization: cloneDefaultGroupSymbolization(),
    children: [
      {
        id: `${groupId}-vector`,
        name: resource.name,
        layerType: "vector",
        sourceResource: resource,
        geojson: queryResult.geojson,
        geometryType: profile.geometryType,
        visible: true,
        summary,
        metadata: {
          ...metadata,
          图层类型: "矢量",
          几何类型: profile.geometryType,
        },
        symbolization: cloneDefaultVectorSymbolization(),
        fields: queryResult.fields,
      } satisfies LoadedVectorLayer,
    ],
  };
}

export function createRasterLayerGroup(
  resource: DataResource,
  profile: DataResourceProfile,
): LoadedLayerGroup | null {
  if (!profile.raster) return null;
  const raster = profile.raster;
  const now = new Date();
  const groupId = `raster-${raster.id}-${now.getTime()}`;
  const layerId = `${groupId}-xyz`;
  const symbolization = raster.defaultRules
    ? rasterSymbolizationFromRules(raster.defaultRules)
    : cloneDefaultRasterSymbolization();
  const summary = `${raster.bandCount} 波段 · ${raster.metadata.size.join(" x ") || "栅格"}`;
  const metadata = {
    数据名称: resource.name,
    数据编号: resource.code,
    数据类型: "栅格",
    文件格式: resource.fileFormat,
    源文件: raster.sourcePath,
    预处理文件: raster.processedPath,
    坐标系统: resource.coordinateSystem,
    波段数: raster.bandCount,
    加载时间: now.toLocaleString("zh-CN", { hour12: false }),
  };
  return {
    id: groupId,
    name: `${resource.name} 栅格组`,
    sourceResource: resource,
    visible: true,
    summary,
    createdAt: now.toISOString(),
    metadata,
    symbolization: cloneDefaultGroupSymbolization(),
    children: [
      {
        id: layerId,
        name: resource.name,
        layerType: "raster",
        sourceResource: resource,
        rasterDatasetId: raster.id,
        rasterLayerId: raster.mapLayerId,
        rasterMetadata: raster.metadata,
        imageCoordinates: raster.imageCoordinates,
        geometryType: "Raster",
        visible: true,
        summary: "等待后台符号化",
        metadata: { ...metadata, 图层类型: "栅格", 加载方式: "XYZ 瓦片" },
        symbolization,
        fields: [],
        renderStatus: "queued",
        renderProgress: 0,
        renderMessages: [],
      } satisfies LoadedRasterLayer,
    ],
  };
}
