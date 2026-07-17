import { App, Button, Modal, Space, Spin, Typography } from "antd";
import type { Map as MapboxMap } from "mapbox-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client";
import { compositionLegendItems } from "../../map-composition/legend";
import {
  constrainCompositionLayout,
  normalizeCompositionLayout,
  pagePixelSize,
  type MapBounds,
  type MapCompositionLayout,
} from "../../map-composition/layout";
import {
  compositionIssues,
  renderCompositionPng,
} from "../../map-composition/render";
import type {
  LoadedLayerGroup,
  MapComposition,
  WorkspaceSceneSnapshot,
} from "../../types";
import { downloadBlob } from "../../utils/download";
import CompositionSettings from "./CompositionSettings";
import CompositionOutputPanel from "./CompositionOutputPanel";

interface Props {
  open: boolean;
  composition: MapComposition | null;
  map: MapboxMap | null;
  groups: LoadedLayerGroup[];
  workspaceSnapshot: WorkspaceSceneSnapshot;
  fallbackBounds: MapBounds;
  sourceText: string;
  accessToken?: string;
  canExport: boolean;
  onClose: () => void;
  onSaved: (composition: MapComposition) => void;
}

export default function MapCompositionEditor({
  open,
  composition,
  map,
  groups,
  workspaceSnapshot,
  fallbackBounds,
  sourceText,
  accessToken,
  canExport,
  onClose,
  onSaved,
}: Props) {
  const { message } = App.useApp();
  const [layout, setLayout] = useState<MapCompositionLayout>(() =>
    normalizeCompositionLayout({}, "专题图", fallbackBounds, sourceText),
  );
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState<"png" | "jpg" | "pdf">("pdf");
  const [versionNote, setVersionNote] = useState("");
  const initializedCompositionId = useRef<number | null>(null);
  const previewSequence = useRef(0);
  const previewUrlRef = useRef("");
  const previewAbortController = useRef<AbortController | null>(null);
  const legendItems = useMemo(() => compositionLegendItems(groups), [groups]);
  const issues = useMemo(
    () => compositionIssues(layout, legendItems),
    [layout, legendItems],
  );
  const hasErrors = issues.some((issue) => issue.level === "error");
  const pixels = pagePixelSize(layout);

  useEffect(() => {
    if (!composition) {
      initializedCompositionId.current = null;
      return;
    }
    if (initializedCompositionId.current === composition.id) return;
    initializedCompositionId.current = composition.id;
    previewAbortController.current?.abort();
    previewAbortController.current = null;
    previewSequence.current += 1;
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
    setLayout(
      normalizeCompositionLayout(
        composition.layout,
        composition.name,
        fallbackBounds,
        sourceText,
      ),
    );
    setVersionNote("");
  }, [composition, fallbackBounds, sourceText]);

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(
    () => () => {
      previewAbortController.current?.abort();
      previewAbortController.current = null;
      previewSequence.current += 1;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const refreshPreview = useCallback(async () => {
    if (!map) {
      message.warning("地图尚未准备好");
      return;
    }
    const sequence = previewSequence.current + 1;
    previewSequence.current = sequence;
    previewAbortController.current?.abort();
    const controller = new AbortController();
    previewAbortController.current = controller;
    setPreviewing(true);
    try {
      const blob = await renderCompositionPng(
        map,
        layout,
        legendItems,
        accessToken,
        {
          outputDpi: 96,
          mapDpi: Math.min(layout.page.dpi, 300),
          signal: controller.signal,
        },
      );
      if (sequence !== previewSequence.current) return;
      const nextUrl = URL.createObjectURL(blob);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
    } catch (error) {
      if (sequence !== previewSequence.current) return;
      if (isAbortError(error)) return;
      message.error(error instanceof Error ? error.message : "专题图预览失败");
    } finally {
      if (previewAbortController.current === controller) {
        previewAbortController.current = null;
      }
      if (sequence === previewSequence.current) setPreviewing(false);
    }
  }, [accessToken, layout, legendItems, map, message]);

  useEffect(() => {
    previewAbortController.current?.abort();
    previewAbortController.current = null;
    previewSequence.current += 1;
    if (!open || !map || !composition) {
      setPreviewing(false);
      return;
    }
    const timer = window.setTimeout(() => void refreshPreview(), 420);
    return () => {
      window.clearTimeout(timer);
      previewAbortController.current?.abort();
      previewAbortController.current = null;
    };
  }, [composition, map, open, refreshPreview]);

  const updateLayout = useCallback((next: MapCompositionLayout) => {
    setLayout(constrainCompositionLayout(next));
  }, []);

  async function saveDraft() {
    if (!composition) return null;
    setSaving(true);
    try {
      const result = await api.updateMapComposition(composition.id, {
        action: "update",
        layout,
      });
      if ("id" in result) {
        onSaved(result);
        message.success("出图草稿已保存");
        return result;
      }
      return null;
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "出图草稿保存失败",
      );
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function generateVersion() {
    if (!composition || !map || hasErrors) {
      if (hasErrors) message.warning("请先处理出图检查中的错误");
      return;
    }
    previewAbortController.current?.abort();
    previewAbortController.current = null;
    previewSequence.current += 1;
    setPreviewing(false);
    setExporting(true);
    try {
      await api.updateMapComposition(composition.id, {
        action: "update",
        layout,
      });
      const master = await renderCompositionPng(
        map,
        layout,
        legendItems,
        accessToken,
      );
      const version = await api.createMapCompositionVersion(
        composition.id,
        master,
        {
          format,
          dpi: layout.page.dpi,
          widthPx: pixels.width,
          heightPx: pixels.height,
          note: versionNote.trim(),
          workspaceSnapshot,
        },
      );
      const result = await api.downloadMapCompositionVersion(
        composition.id,
        version.versionNumber,
      );
      downloadBlob(result.blob, result.filename);
      const refreshed = await api.mapComposition(composition.id);
      onSaved(refreshed);
      message.success(`专题成果 V${version.versionNumber} 已生成并下载`);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "专题成果生成失败",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal
      className="map-composition-editor-modal"
      title={composition ? `专题制图 · ${composition.name}` : "专题制图"}
      open={open}
      width="calc(100vw - 24px)"
      style={{ top: 12 }}
      footer={null}
      destroyOnHidden
      onCancel={onClose}
    >
      <div className="map-composition-editor">
        <aside className="map-composition-settings-pane">
          <CompositionSettings layout={layout} onChange={updateLayout} />
        </aside>
        <main className="map-composition-preview-pane">
          <div className="composition-preview-toolbar">
            <Typography.Text>
              {layout.page.preset} ·{" "}
              {layout.page.orientation === "landscape" ? "横向" : "纵向"} ·{" "}
              {pixels.width}×{pixels.height}px
            </Typography.Text>
            <Space>
              <Typography.Text type="secondary">
                {previewing ? "正在自动更新预览…" : "修改后自动预览"}
              </Typography.Text>
              <Button loading={saving} onClick={() => void saveDraft()}>
                保存草稿
              </Button>
              <Button
                type="primary"
                loading={previewing}
                onClick={() => void refreshPreview()}
              >
                立即刷新
              </Button>
            </Space>
          </div>
          <div className="composition-paper-stage">
            {previewing && !previewUrl ? (
              <Spin size="large" />
            ) : previewUrl ? (
              <div className="composition-preview-image-wrap">
                <img src={previewUrl} alt="专题图预览" />
                {previewing ? (
                  <Spin className="composition-preview-updating" />
                ) : null}
              </div>
            ) : (
              <div className="composition-preview-empty">
                正在生成标准版式预览…
              </div>
            )}
          </div>
        </main>
        <CompositionOutputPanel
          issues={issues}
          format={format}
          note={versionNote}
          canExport={canExport}
          exporting={exporting}
          disabled={hasErrors || !map}
          onFormatChange={setFormat}
          onNoteChange={setVersionNote}
          onGenerate={() => void generateVersion()}
        />
      </div>
    </Modal>
  );
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "AbortError";
}
