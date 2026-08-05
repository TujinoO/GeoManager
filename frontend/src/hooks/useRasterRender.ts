import { App } from "antd";
import type { Map as MapboxMap } from "mapbox-gl";
import { useCallback, useEffect, useRef } from "react";
import { api } from "../api/client";
import type { RasterSymbolization } from "../symbolization";
import { rasterSymbolizationFromRules } from "../symbolization";
import type { LoadedRasterLayer, RasterRenderResult } from "../types";
import {
  isAbortError,
  RasterRenderTaskRegistry,
  type RasterRenderTask,
  waitForAbortableDelay,
} from "../utils/rasterRenderTasks";

export function useRasterRender(
  updateLayer: (
    groupId: string,
    layerId: string,
    updater: (layer: LoadedRasterLayer) => LoadedRasterLayer,
  ) => void,
) {
  const { message } = App.useApp();
  const mapInstanceRef = useRef<MapboxMap | null>(null);
  const taskRegistryRef = useRef<RasterRenderTaskRegistry | null>(null);
  if (taskRegistryRef.current === null) {
    taskRegistryRef.current = new RasterRenderTaskRegistry();
  }

  const cancelAllRasterTasks = useCallback(() => {
    taskRegistryRef.current?.cancelAll();
  }, []);

  const setMapInstance = useCallback(
    (map: MapboxMap | null) => {
      mapInstanceRef.current = map;
      if (!map) {
        cancelAllRasterTasks();
      }
    },
    [cancelAllRasterTasks],
  );

  useEffect(() => cancelAllRasterTasks, [cancelAllRasterTasks]);

  const applyResult = useCallback(
    (groupId: string, layerId: string, result: RasterRenderResult) => {
      updateLayer(groupId, layerId, (current) => {
        return {
          ...current,
          tileUrl: result.tileUrl,
          tileMinZoom: result.minZoom,
          tileMaxZoom: result.maxZoom,
          tileSampling: result.tileSampling,
          imageCoordinates: result.imageCoordinates,
          summary: "XYZ 瓦片已就绪",
          renderStatus: "ready",
          renderProgress: 100,
          symbolization: {
            ...rasterSymbolizationFromRules(result.rules),
            opacity: current.symbolization.opacity,
          },
          metadata: {
            ...current.metadata,
            加载方式: "XYZ 瓦片",
            样式哈希: result.styleHash,
          },
        };
      });
    },
    [updateLayer],
  );

  const pollJob = useCallback(
    async (
      jobId: string,
      groupId: string,
      layerId: string,
      task: RasterRenderTask,
      completionMessage: string | null,
    ) => {
      const registry = taskRegistryRef.current;
      if (!registry) return;
      while (registry.isCurrent(task) && !task.controller.signal.aborted) {
        await waitForAbortableDelay(900, task.controller.signal);
        if (!registry.isCurrent(task)) return;
        try {
          const job = await api.rasterJob(jobId, {
            signal: task.controller.signal,
          });
          if (!registry.isCurrent(task) || task.controller.signal.aborted) {
            return;
          }
          updateLayer(groupId, layerId, (current) => ({
            ...current,
            renderStatus: job.status,
            renderProgress: job.progressPercent,
            renderMessages: job.messages,
          }));
          if (job.status === "ready" && job.result) {
            applyResult(groupId, layerId, job.result as RasterRenderResult);
            if (completionMessage) {
              message.success(completionMessage);
            }
            return;
          }
          if (job.status === "failed") {
            updateLayer(groupId, layerId, (current) => ({
              ...current,
              summary: "符号化失败",
              renderStatus: "failed",
              renderMessages:
                job.messages.length > 0 ? job.messages : [job.error],
            }));
            message.error(job.error || "栅格符号化失败");
            return;
          }
        } catch (error) {
          if (task.controller.signal.aborted || isAbortError(error)) {
            throw error;
          }
          updateLayer(groupId, layerId, (current) => ({
            ...current,
            summary: "进度查询失败",
            renderStatus: "failed",
            renderMessages: [
              error instanceof Error ? error.message : "进度查询失败",
            ],
          }));
          return;
        }
      }
    },
    [message, updateLayer, applyResult],
  );

  const startRasterRender = useCallback(
    async (
      groupId: string,
      layerId: string,
      symbolization: RasterSymbolization,
      layer: LoadedRasterLayer,
      rulesMode: "default" | "custom" = "custom",
    ) => {
      const registry = taskRegistryRef.current;
      if (!registry) return;
      const task = registry.start(`${groupId}:${layerId}`);
      const isUniqueValueRender =
        rulesMode === "custom" && symbolization.mode === "unique";
      const completionMessage = isUniqueValueRender
        ? `${layer.name}唯一值颜色渲染完成，地图已自动更新`
        : null;
      updateLayer(groupId, layerId, (current) => ({
        ...current,
        summary: "后台符号化中",
        renderStatus: "running",
        renderProgress: 5,
        renderMessages: ["提交符号化任务"],
        tileUrl: current.tileUrl,
      }));
      if (isUniqueValueRender) {
        message.info(
          `${layer.name}唯一值颜色正在后台生成；期间地图保留当前样式，完成后会自动更新`,
          4,
        );
      }

      try {
        const job = await api.renderRasterAsync(
          {
            datasetId: layer.rasterDatasetId,
            layerId: layer.rasterLayerId,
            rules:
              rulesMode === "custom"
                ? (symbolization as unknown as Record<string, unknown>)
                : undefined,
            rulesMode,
          },
          { signal: task.controller.signal },
        );
        if (!registry.isCurrent(task) || task.controller.signal.aborted) {
          return;
        }
        updateLayer(groupId, layerId, (current) => ({
          ...current,
          renderJobId: job.id,
          renderProgress: job.progressPercent,
          renderMessages: job.messages,
        }));
        await pollJob(job.id, groupId, layerId, task, completionMessage);
      } catch (error) {
        if (task.timedOut && registry.isCurrent(task)) {
          updateLayer(groupId, layerId, (current) => ({
            ...current,
            summary: "栅格符号化超时",
            renderStatus: "failed",
            renderMessages: ["栅格符号化等待超时，请稍后重试"],
          }));
          message.error("栅格符号化等待超时，请稍后重试");
          return;
        }
        if (
          task.controller.signal.aborted ||
          isAbortError(error) ||
          !registry.isCurrent(task)
        ) {
          return;
        }
        updateLayer(groupId, layerId, (current) => ({
          ...current,
          summary: "符号化失败",
          renderStatus: "failed",
          renderMessages: [
            error instanceof Error ? error.message : "符号化失败",
          ],
        }));
        message.error(error instanceof Error ? error.message : "符号化失败");
      } finally {
        registry.finish(task);
      }
    },
    [message, updateLayer, pollJob],
  );

  return { startRasterRender, setMapInstance };
}
