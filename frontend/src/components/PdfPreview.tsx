import { useEffect, useRef, useState } from "react";
import { Alert, Button, Space, Spin } from "antd";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
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
  useEffect(() => {
    let disposed = false;
    let loading:
      | ReturnType<(typeof import("pdfjs-dist"))["getDocument"]>
      | undefined;
    setDocument(undefined);
    setPage(1);
    setBusy(true);
    setError("");
    void import("pdfjs-dist")
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
      void loading?.destroy();
    };
  }, [src]);
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
    const surface = canvas.current;
    void document
      .getPage(page)
      .then(async (pdfPage) => {
        if (disposed) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const viewport = pdfPage.getViewport({
          scale: (Math.min(1400, width) / base.width) * ratio,
        });
        surface.width = Math.ceil(viewport.width);
        surface.height = Math.ceil(viewport.height);
        rendering = pdfPage.render({ canvas: surface, viewport });
        await rendering.promise;
        if (!disposed) setBusy(false);
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
  }, [document, page, width]);
  return (
    <section className="pdf-document-preview" aria-label={title}>
      <Space wrap className="pdf-document-toolbar">
        <Button
          disabled={!document || page <= 1}
          onClick={() => setPage(page - 1)}
        >
          上一页
        </Button>
        <span aria-live="polite">
          {document ? `第 ${page} / ${document.numPages} 页` : "正在读取PDF"}
        </span>
        <Button
          disabled={!document || page >= document.numPages}
          onClick={() => setPage(page + 1)}
        >
          下一页
        </Button>
      </Space>
      {error && <Alert type="error" title={error} showIcon />}
      <Spin spinning={busy}>
        <div className="pdf-document-sheet" ref={container}>
          <canvas ref={canvas} role="img" aria-label={`${title} 第${page}页`} />
        </div>
      </Spin>
    </section>
  );
}
