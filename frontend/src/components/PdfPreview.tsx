import { useEffect, useRef, useState } from "react";
import { Alert, Button, Segmented, Space, Spin } from "antd";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import "./pdf-preview.css";

export default function PdfPreview({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState(600);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [quality, setQuality] = useState<"fast" | "clear">("fast");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let disposed = false;
    let loading:
      | ReturnType<
          (typeof import("pdfjs-dist/legacy/build/pdf.mjs"))["getDocument"]
        >
      | undefined;
    setDocument(undefined);
    setPage(1);
    setQuality("fast");
    setBusy(true);
    setError("");
    if (canvas.current) canvas.current.hidden = true;
    // The compatibility build includes the Map methods missing in Edge 142.
    void import("pdfjs-dist/legacy/build/pdf.mjs")
      .then(async (pdfjs) => {
        if (disposed) return;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        loading = pdfjs.getDocument({
          url: src,
          withCredentials: true,
        });
        const pdf = await loading.promise;
        if (!disposed) setDocument(pdf);
      })
      .catch(() => {
        if (!disposed) {
          setError("PDF预览读取失败，请重新打开或下载文件查看");
          setBusy(false);
        }
      });
    return () => {
      disposed = true;
      void loading?.destroy().catch(() => {});
    };
  }, [src, retry]);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(160, Math.floor(entry.contentRect.width)));
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!document || !canvas.current) return;
    let disposed = false;
    let rendering:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    setBusy(true);
    setError("");
    canvas.current.hidden = true;
    // Give each render its own canvas so cancelled/late work cannot overwrite
    // a newer page when the drawer resizes or the user changes pages quickly.
    const surface = window.document.createElement("canvas");
    void document
      .getPage(page)
      .then(async (pdfPage) => {
        if (disposed) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const ratio =
          quality === "fast" ? 1 : Math.min(2, window.devicePixelRatio || 1);
        const viewport = pdfPage.getViewport({
          scale:
            (Math.min(quality === "fast" ? 480 : 1400, width) / base.width) *
            ratio,
        });
        surface.width = Math.ceil(viewport.width);
        surface.height = Math.ceil(viewport.height);
        rendering = pdfPage.render({ canvas: surface, viewport });
        await rendering.promise;
        if (!disposed && canvas.current) {
          canvas.current.width = surface.width;
          canvas.current.height = surface.height;
          canvas.current.getContext("2d")!.drawImage(surface, 0, 0);
          canvas.current.hidden = false;
          setBusy(false);
        }
      })
      .catch((failure: unknown) => {
        if (
          !disposed &&
          !(
            failure instanceof Error &&
            failure.name === "RenderingCancelledException"
          )
        ) {
          setError("本页预览失败，可下载PDF查看");
          setBusy(false);
        }
      });
    return () => {
      disposed = true;
      rendering?.cancel();
    };
  }, [document, page, width, quality]);
  return (
    <section className="pdf-document-preview" aria-label={title}>
      <Space wrap className="pdf-document-toolbar">
        <Space>
          <Button
            disabled={!document || page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            上一页
          </Button>
          <span aria-live="polite">
            {document ? `第 ${page} / ${document.numPages} 页` : "正在读取PDF"}
          </span>
          <Button
            disabled={!document || page >= document.numPages}
            onClick={() => setPage((current) => current + 1)}
          >
            下一页
          </Button>
        </Space>
        <Segmented
          aria-label="PDF预览清晰度"
          value={quality}
          onChange={setQuality}
          options={[
            { label: "快速预览（低清）", value: "fast" },
            { label: "清晰预览", value: "clear" },
          ]}
        />
      </Space>
      {error && (
        <Alert
          type="error"
          title={error}
          showIcon
          action={
            <Button size="small" onClick={() => setRetry((value) => value + 1)}>
              重新加载
            </Button>
          }
        />
      )}
      <Spin spinning={busy}>
        <div className="pdf-document-sheet" ref={container} aria-busy={busy}>
          <canvas ref={canvas} role="img" aria-label={`${title} 第${page}页`} />
        </div>
      </Spin>
    </section>
  );
}
