import { api } from "../api/client";
import type {
  DataResource,
  LoadedLayer,
  LoadedLayerGroup,
  LoadedRasterLayer,
  LoadedVectorLayer,
  WorkspaceSceneSnapshot,
} from "../types";
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
  queryResultLimit: number;
  notification: AppNotification;
  onProgress?: (state: WorkspaceRestoreProgress) => void;
}

export async function restoreWorkspaceGroups({
  savedGroups,
  canQueryData,
  canLoadVectorLayer,
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
      try {
        const profile = await api.resourceProfile(savedLayer.sourceResource);
        if (!profile.raster) {
          issues.push({
            layerName: savedLayer.name,
            resourceName: savedLayer.sourceResource.name,
            reason: "原始栅格数据未就绪或已不可用",
            action: "restored-with-warning",
          });
        } else if (
          savedLayer.rasterDatasetId &&
          profile.raster.id !== savedLayer.rasterDatasetId
        ) {
          issues.push({
            layerName: savedLayer.name,
            resourceName: savedLayer.sourceResource.name,
            reason: "原始栅格数据已变更，已使用快照中的瓦片引用恢复",
            action: "restored-with-warning",
          });
        }
      } catch (error) {
        issues.push({
          layerName: savedLayer.name,
          resourceName: savedLayer.sourceResource.name,
          reason:
            error instanceof Error ? error.message : "原始栅格数据无法校验",
          action: "restored-with-warning",
        });
      }
      restoredChildren.push({
        id: savedLayer.id,
        name: savedLayer.name,
        layerType: "raster",
        sourceResource: savedLayer.sourceResource as DataResource,
        tileUrl: savedLayer.tileUrl,
        imageCoordinates: savedLayer.imageCoordinates,
        rasterDatasetId: savedLayer.rasterDatasetId,
        rasterLayerId: savedLayer.rasterLayerId,
        rasterMetadata: savedLayer.rasterMetadata,
        renderStatus: savedLayer.renderStatus,
        renderProgress: savedLayer.renderProgress,
        renderMessages: savedLayer.renderMessages,
        geometryType: savedLayer.geometryType,
        visible: savedLayer.visible,
        summary: savedLayer.summary,
        metadata: savedLayer.metadata,
        symbolization:
          savedLayer.symbolization as LoadedRasterLayer["symbolization"],
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
