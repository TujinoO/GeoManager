import { api } from "../api/client";
import { rasterTileRendererVersion } from "../map/rasterLayerSync";
import { rasterSymbolizationFromRules } from "../symbolization";
import type {
  DataResource,
  DataResourceProfile,
  LoadedLayer,
  LoadedLayerGroup,
  LoadedRasterLayer,
  LoadedVectorLayer,
  RasterRenderResult,
  SavedWorkspaceLayer,
  WorkspaceSceneSnapshot,
} from "../types";
import type { RasterDataset } from "../api/generated/types.gen";
import { createVectorLayerGroup } from "../utils/layerFactory";
import type { AppNotification } from "./workspaceNotifications";
import { showGeojsonWarnings } from "./workspaceNotifications";
import { isLoadedVectorLayer } from "./workspaceSnapshot";

export interface WorkspaceRestoreProgress {
  percent: number;
  detail: string;
}

export interface WorkspaceRestoreIssue {
  layerName: string;
  resourceName: string;
  reason: string;
  action: "skipped" | "restored-with-warning";
}

export interface WorkspaceRestoreResult {
  groups: LoadedLayerGroup[];
  issues: WorkspaceRestoreIssue[];
}

interface RestoreWorkspaceGroupsOptions {
  savedGroups: WorkspaceSceneSnapshot["groups"];
  canQueryData: boolean;
  canLoadVectorLayer: boolean;
  canLoadRasterLayer: boolean;
  canUseCustomSymbolization?: boolean;
  queryResultLimit: number;
  notification: AppNotification;
  onProgress?: (state: WorkspaceRestoreProgress) => void;
}

export async function restoreWorkspaceGroups({
  savedGroups,
  canQueryData,
  canLoadVectorLayer,
  canLoadRasterLayer,
  canUseCustomSymbolization = false,
  queryResultLimit,
  notification,
  onProgress,
}: RestoreWorkspaceGroupsOptions): Promise<WorkspaceRestoreResult> {
  if (!Array.isArray(savedGroups)) {
    return { groups: [], issues: [] };
  }
  const totalLayers = savedGroups.reduce(
    (total, group) => total + (group.children?.length ?? 0),
    0,
  );
  let processedLayers = 0;
  const updateRestoreProgress = (detail: string) => {
    if (!onProgress) {
      return;
    }
    const layerProgress =
      totalLayers > 0 ? Math.round((processedLayers / totalLayers) * 70) : 70;
    onProgress({
      percent: Math.min(85, 10 + layerProgress),
      detail,
    });
  };
  const restored: LoadedLayerGroup[] = [];
  const issues: WorkspaceRestoreIssue[] = [];
  let datasetsRequest: Promise<{ items: RasterDataset[] }> | undefined;
  const datasets = () => (datasetsRequest ??= api.rasterDatasets());
  for (const savedGroup of savedGroups) {
    const restoredChildren: LoadedLayer[] = [];
    for (const savedLayer of savedGroup.children ?? []) {
      updateRestoreProgress(`正在恢复图层：${savedLayer.name}`);
      if (isLoadedVectorLayer(savedLayer)) {
        restoredChildren.push(savedLayer);
        processedLayers += 1;
        updateRestoreProgress(`已恢复图层：${savedLayer.name}`);
        continue;
      }
      if (savedLayer.layerType === "vector") {
        if (!savedLayer.query) {
          issues.push({
            layerName: savedLayer.name,
            resourceName: savedLayer.sourceResource.name,
            reason: "缺少原始查询条件",
            action: "skipped",
          });
          processedLayers += 1;
          updateRestoreProgress(`已跳过图层：${savedLayer.name}`);
          continue;
        }
        if (!canQueryData || !canLoadVectorLayer) {
          issues.push({
            layerName: savedLayer.name,
            resourceName: savedLayer.sourceResource.name,
            reason: "当前账号无权重新查询或加载原始矢量数据",
            action: "skipped",
          });
          processedLayers += 1;
          updateRestoreProgress(`已跳过图层：${savedLayer.name}`);
          continue;
        }
        try {
          const profile = await api.resourceProfile(savedLayer.sourceResource);
          const result = await api.queryResource(savedLayer.sourceResource, {
            attributeFilters: savedLayer.query.attributeFilters,
            spatialFilter: savedLayer.query.spatialFilter,
            limit: queryResultLimit,
          });
          showGeojsonWarnings(notification, result.warnings);
          const queryGroup = createVectorLayerGroup(
            savedLayer.sourceResource,
            profile,
            result,
            savedLayer.query,
          );
          const restoredVectorLayer = queryGroup.children[0];
          if (restoredVectorLayer?.layerType === "vector") {
            restoredChildren.push({
              ...restoredVectorLayer,
              id: savedLayer.id,
              name: savedLayer.name,
              visible: savedLayer.visible,
              summary: savedLayer.summary,
              metadata: savedLayer.metadata,
              symbolization:
                savedLayer.symbolization as LoadedVectorLayer["symbolization"],
              fields: savedLayer.fields,
            });
          }
        } catch (error) {
          issues.push({
            layerName: savedLayer.name,
            resourceName: savedLayer.sourceResource.name,
            reason:
              error instanceof Error ? error.message : "原始矢量数据不可用",
            action: "skipped",
          });
        }
        processedLayers += 1;
        updateRestoreProgress(`已处理图层：${savedLayer.name}`);
        continue;
      }
      if (!canLoadRasterLayer) {
        issues.push({
          layerName: savedLayer.name,
          resourceName: savedLayer.sourceResource.name,
          reason: "当前账号无权加载原始栅格数据，请联系管理员申请权限",
          action: "skipped",
        });
        processedLayers += 1;
        updateRestoreProgress(`已跳过图层：${savedLayer.name}`);
        continue;
      }
      let rasterKind = savedLayer.rasterKind;
      let sourceResource = savedLayer.sourceResource as DataResource;
      let currentRaster:
        | Awaited<ReturnType<typeof api.resourceProfile>>["raster"]
        | undefined;
      try {
        const profile = await rasterSnapshotProfile(savedLayer, datasets);
        sourceResource = profile.resource;
        currentRaster = profile.raster ?? undefined;
        rasterKind = profile.raster?.rasterKind ?? rasterKind;
        if (!profile.raster) {
          issues.push({
            layerName: savedLayer.name,
            resourceName: savedLayer.sourceResource.name,
            reason: "原始栅格数据未就绪或已不可用",
            action: "restored-with-warning",
          });
        }
      } catch (error) {
        if (isForbiddenError(error)) {
          issues.push({
            layerName: savedLayer.name,
            resourceName: savedLayer.sourceResource.name,
            reason: "当前账号无权访问原始栅格数据，请联系管理员申请权限",
            action: "skipped",
          });
          processedLayers += 1;
          updateRestoreProgress(`已跳过图层：${savedLayer.name}`);
          continue;
        }
        issues.push({
          layerName: savedLayer.name,
          resourceName: savedLayer.sourceResource.name,
          reason:
            error instanceof Error ? error.message : "原始栅格数据无法校验",
          action: "restored-with-warning",
        });
      }
      // A renderer query parameter cannot validate a content-addressed style
      // hash. Register the saved rules against the current file on every restore.
      const refreshRasterTiles = Boolean(currentRaster);
      let refreshedRender: RasterRenderResult | undefined;
      let refreshError = !currentRaster
        ? "无法校验原始栅格，已停止加载旧版瓦片"
        : undefined;
      if (currentRaster) {
        updateRestoreProgress(`正在准备栅格瓦片：${savedLayer.name}`);
        try {
          refreshedRender = await renderRasterSnapshot(
            currentRaster.id,
            currentRaster.mapLayerId,
            savedLayer.symbolization as LoadedRasterLayer["symbolization"],
            canUseCustomSymbolization,
          );
          if (!usesCurrentRasterRenderer(refreshedRender.tileUrl)) {
            throw new Error("栅格服务返回了旧版瓦片地址");
          }
        } catch (error) {
          refreshedRender = undefined;
          refreshError =
            error instanceof Error ? error.message : "栅格瓦片恢复失败";
          issues.push({
            layerName: savedLayer.name,
            resourceName: savedLayer.sourceResource.name,
            reason: refreshError,
            action: "restored-with-warning",
          });
        }
      }
      const savedSymbolization =
        savedLayer.symbolization as LoadedRasterLayer["symbolization"];
      const restoredSymbolization = refreshedRender
        ? {
            ...rasterSymbolizationFromRules(refreshedRender.rules),
            opacity: savedSymbolization.opacity,
          }
        : savedSymbolization;
      restoredChildren.push({
        id: savedLayer.id,
        name: savedLayer.name,
        layerType: "raster",
        sourceResource,
        tileUrl: refreshedRender?.tileUrl,
        tileMinZoom: refreshedRender?.minZoom ?? savedLayer.tileMinZoom,
        tileMaxZoom: refreshedRender?.maxZoom ?? savedLayer.tileMaxZoom,
        tileSampling:
          refreshedRender?.tileSampling ??
          savedLayer.tileSampling ??
          (rasterKind === "categorical" ? "nearest" : undefined),
        imageCoordinates:
          refreshedRender?.imageCoordinates ?? savedLayer.imageCoordinates,
        rasterDatasetId: refreshRasterTiles
          ? currentRaster?.id
          : savedLayer.rasterDatasetId,
        rasterLayerId: refreshRasterTiles
          ? currentRaster?.mapLayerId
          : savedLayer.rasterLayerId,
        rasterKind,
        rasterMetadata: currentRaster?.metadata ?? savedLayer.rasterMetadata,
        renderStatus: refreshedRender
          ? "ready"
          : refreshError
            ? "failed"
            : savedLayer.renderStatus,
        renderProgress: refreshedRender
          ? 100
          : refreshError
            ? 0
            : savedLayer.renderProgress,
        renderMessages: refreshedRender
          ? ["栅格瓦片已校验并就绪"]
          : refreshError
            ? [refreshError]
            : savedLayer.renderMessages,
        geometryType: savedLayer.geometryType,
        visible: savedLayer.visible,
        summary: refreshedRender
          ? "XYZ 瓦片已就绪"
          : refreshError
            ? "栅格瓦片恢复失败"
            : savedLayer.summary,
        metadata: refreshedRender
          ? {
              ...savedLayer.metadata,
              加载方式: "XYZ 瓦片",
              样式哈希: refreshedRender.styleHash,
            }
          : savedLayer.metadata,
        symbolization: restoredSymbolization,
        fields: savedLayer.fields,
      });
      processedLayers += 1;
      updateRestoreProgress(`已恢复图层：${savedLayer.name}`);
    }
    if (restoredChildren.length > 0 || savedGroup.isManual) {
      restored.push({ ...savedGroup, children: restoredChildren });
    }
  }
  return { groups: restored, issues };
}

async function rasterSnapshotProfile(
  savedLayer: SavedWorkspaceLayer,
  datasets: () => Promise<{ items: RasterDataset[] }>,
): Promise<DataResourceProfile> {
  try {
    return await api.resourceProfile(savedLayer.sourceResource);
  } catch (error) {
    if (!hasErrorStatus(error, 404) || !savedLayer.rasterDatasetId) throw error;
    const { items } = await datasets();
    const original = items.find(
      (item) => item.id === savedLayer.rasterDatasetId,
    );
    if (
      !original ||
      original.dataResourceId !== null ||
      !/^[a-f0-9]{64}$/i.test(original.sourceChecksumSha256)
    )
      throw error;
    const matches = items.filter(
      (item) =>
        item.dataResourceId !== null &&
        item.status === "ready" &&
        item.sourceChecksumSha256 === original.sourceChecksumSha256 &&
        item.rasterKind === original.rasterKind &&
        JSON.stringify(item.bounds4326) === JSON.stringify(original.bounds4326),
    );
    if (matches.length !== 1) throw error;
    const replacement = matches[0];
    if (!replacement || replacement.dataResourceId === null) throw error;
    const profile = await api.resourceProfile({
      ...savedLayer.sourceResource,
      id: replacement.dataResourceId,
    });
    if (
      !profile.raster ||
      profile.raster.id !== replacement.id ||
      profile.raster.sourceChecksumSha256 !== original.sourceChecksumSha256
    )
      throw error;
    return profile;
  }
}

async function renderRasterSnapshot(
  datasetId: number,
  layerId: number | null,
  symbolization: LoadedRasterLayer["symbolization"],
  canUseCustomSymbolization: boolean,
): Promise<RasterRenderResult> {
  const rules = symbolization as unknown as Record<string, unknown>;
  let job = await api.renderRasterAsync({
    datasetId,
    layerId,
    rules: canUseCustomSymbolization ? rules : undefined,
    rulesMode: canUseCustomSymbolization ? "custom" : "default",
  });
  const deadline = Date.now() + 120_000;
  while (job.status === "queued" || job.status === "running") {
    if (Date.now() >= deadline) {
      throw new Error("栅格瓦片恢复等待超时");
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, 900));
    job = await api.rasterJob(job.id);
  }
  if (
    job.status === "ready" &&
    job.result &&
    typeof job.result === "object" &&
    "tileUrl" in job.result
  ) {
    return job.result as RasterRenderResult;
  }
  throw new Error(job.error || "栅格瓦片恢复失败");
}

function usesCurrentRasterRenderer(tileUrl: string | undefined) {
  if (!tileUrl) {
    return false;
  }
  return new RegExp(`(?:[?&])rv=${rasterTileRendererVersion}(?:[&#]|$)`).test(
    tileUrl,
  );
}

function isForbiddenError(error: unknown) {
  return hasErrorStatus(error, 403);
}

function hasErrorStatus(error: unknown, status: number) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === status
  );
}
