import { useEffect, useRef, useState } from "react";
import { Button, Spin } from "antd";
import type { PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import "./pdf-preview.css";

export default function PdfThumbnail({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [preview, setPreview] = useState<{ src: string; image: string }>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!container.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let disposed = false;
    let loading: PDFDocumentLoadingTask | undefined;
    let rendering: RenderTask | undefined;
    setError(false);
    setPreview(undefined);
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (disposed) return;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        loading = pdfjs.getDocument({ url: src, withCredentials: true });
        const pdf = await loading.promise;
        if (disposed) return;
        const page = await pdf.getPage(1);
        if (disposed) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale: Math.min(480 / base.width, 1000 / base.height),
        });
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        rendering = page.render({ canvas, viewport });
        await rendering.promise;
        if (!disposed)
          setPreview({ src, image: canvas.toDataURL("image/jpeg", 0.75) });
      } catch {
        if (!disposed) setError(true);
      } finally {
        // Keep only the small thumbnail, release the PDF, worker and decoded images.
        void loading?.destroy().catch(() => {});
      }
    })();
    return () => {
      disposed = true;
      rendering?.cancel();
      void loading?.destroy().catch(() => {});
    };
  }, [visible, src, retry]);

  const image = preview?.src === src ? preview.image : undefined;
  return (
    <div className="pdf-thumbnail" ref={container} aria-busy={!image && !error}>
      {image ? (
        <>
          <img src={image} alt={title} decoding="async" />
          <span className="pdf-thumbnail-caption">PDF · 首页预览</span>
        </>
      ) : (
        <div className="pdf-thumbnail-status">
          {error ? (
            <>
              <span>首页预览暂不可用</span>
              <Button
                size="small"
                onClick={() => setRetry((value) => value + 1)}
              >
                重新预览
              </Button>
            </>
          ) : (
            <>
              {visible && <Spin size="small" />}
              <span>PDF 首页预览{visible ? "加载中" : ""}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
