import { useCallback, useRef } from 'react';
import { App } from 'antd';
import { api } from '../api/client';
import { rasterSymbolizationFromRules } from '../symbolization';
import type { RasterSymbolization } from '../symbolization';
import type { LoadedRasterLayer, RasterRenderResult } from '../types';
import { delay, formatBytes } from '../utils/geometry';

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
  ) => {
    const canvas = mapInstanceRef.current?.getCanvas();
    const width = Math.min(2400, Math.max(512, Math.round((canvas?.clientWidth ?? 1400) * window.devicePixelRatio)));
    const height = Math.min(1800, Math.max(512, Math.round((canvas?.clientHeight ?? 900) * window.devicePixelRatio)));

    updateLayer(groupId, layerId, (current) => ({
      ...current,
      summary: '后台符号化中',
      renderStatus: 'running',
      renderProgress: 5,
      renderMessages: ['提交符号化任务'],
      pngUrl: symbolization.loadMode === 'image' ? current.pngUrl : undefined,
      tileUrl: symbolization.loadMode === 'xyz' ? current.tileUrl : undefined,
    }));

    try {
      const job = await api.renderRasterAsync({
        datasetId: layer.rasterDatasetId,
        layerId: layer.rasterLayerId,
        width,
        height,
        rules: symbolization as unknown as Record<string, unknown>,
        delivery: symbolization.loadMode,
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
      const currentRasterSymbolization = current.symbolization as RasterSymbolization;
      return {
        ...current,
        pngUrl: result.delivery === 'image' ? result.pngUrl : undefined,
        tileUrl: result.delivery === 'xyz' ? result.tileUrl : undefined,
        imageCoordinates: result.imageCoordinates,
        summary: result.delivery === 'xyz' ? 'XYZ 瓦片已就绪' : `PNG 已生成 · ${formatBytes(result.fileSize ?? 0)}`,
        renderStatus: 'ready',
        renderProgress: 100,
        symbolization: {
          ...rasterSymbolizationFromRules(result.rules),
          opacity: currentRasterSymbolization.opacity,
          loadMode: currentRasterSymbolization.loadMode,
        },
        metadata: {
          ...current.metadata,
          加载方式: result.delivery === 'xyz' ? 'XYZ 瓦片' : '整图 PNG',
          缓存标识: result.cacheKey,
          样式哈希: result.styleHash,
        },
      };
    });
  }, [updateLayer]);

  return { startRasterRender, setMapInstance };
}
