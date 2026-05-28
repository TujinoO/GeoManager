import { useCallback, useRef } from 'react';
import { App } from 'antd';
import { api } from '../api/client';
import { rasterSymbolizationFromRules } from '../symbolization';
import type { RasterSymbolization } from '../symbolization';
import type { LoadedRasterLayer, RasterRenderResult } from '../types';
import { delay } from '../utils/geometry';

export function useRasterRender(updateLayer: (groupId: string, layerId: string, updater: (layer: LoadedRasterLayer) => LoadedRasterLayer) => void) {
  const { message } = App.useApp();
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);

  const setMapInstance = useCallback((map: mapboxgl.Map | null) => {
    mapInstanceRef.current = map;
  }, []);

  const startRasterRender = useCallback(async (
    groupId: string,
    layerId: string,
    symbolization: RasterSymbolization,
    layer: LoadedRasterLayer,
    rulesMode: 'default' | 'custom' = 'custom',
  ) => {
    updateLayer(groupId, layerId, (current) => ({
      ...current,
      summary: '后台符号化中',
      renderStatus: 'running',
      renderProgress: 5,
      renderMessages: ['提交符号化任务'],
      tileUrl: current.tileUrl,
    }));

    try {
      const job = await api.renderRasterAsync({
        datasetId: layer.rasterDatasetId,
        layerId: layer.rasterLayerId,
        rules: rulesMode === 'custom' ? symbolization as unknown as Record<string, unknown> : undefined,
        rulesMode,
      });
      updateLayer(groupId, layerId, (current) => ({
        ...current,
        renderJobId: job.id,
        renderProgress: job.progressPercent,
        renderMessages: job.messages,
      }));
      void pollJob(job.id, groupId, layerId);
    } catch (error) {
      updateLayer(groupId, layerId, (current) => ({
        ...current,
        summary: '符号化失败',
        renderStatus: 'failed',
        renderMessages: [error instanceof Error ? error.message : '符号化失败'],
      }));
      message.error(error instanceof Error ? error.message : '符号化失败');
    }
  }, [message, updateLayer]);

  const pollJob = useCallback(async (jobId: string, groupId: string, layerId: string) => {
    for (;;) {
      await delay(900);
      try {
        const job = await api.rasterJob(jobId);
        updateLayer(groupId, layerId, (current) => ({
          ...current,
          renderStatus: job.status,
          renderProgress: job.progressPercent,
          renderMessages: job.messages,
        }));
        if (job.status === 'ready' && job.result) {
          applyResult(groupId, layerId, job.result as RasterRenderResult);
          return;
        }
        if (job.status === 'failed') {
          updateLayer(groupId, layerId, (current) => ({
            ...current,
            summary: '符号化失败',
            renderStatus: 'failed',
            renderMessages: job.messages.length > 0 ? job.messages : [job.error],
          }));
          message.error(job.error || '栅格符号化失败');
          return;
        }
      } catch (error) {
        updateLayer(groupId, layerId, (current) => ({
          ...current,
          summary: '进度查询失败',
          renderStatus: 'failed',
          renderMessages: [error instanceof Error ? error.message : '进度查询失败'],
        }));
        return;
      }
    }
  }, [message, updateLayer]);

  const applyResult = useCallback((groupId: string, layerId: string, result: RasterRenderResult) => {
    updateLayer(groupId, layerId, (current) => {
      return {
        ...current,
        tileUrl: result.tileUrl,
        imageCoordinates: result.imageCoordinates,
        summary: 'XYZ 瓦片已就绪',
        renderStatus: 'ready',
        renderProgress: 100,
        symbolization: {
          ...rasterSymbolizationFromRules(result.rules),
          opacity: current.symbolization.opacity,
        },
        metadata: {
          ...current.metadata,
          加载方式: 'XYZ 瓦片',
          样式哈希: result.styleHash,
        },
      };
    });
  }, [updateLayer]);

  return { startRasterRender, setMapInstance };
}
