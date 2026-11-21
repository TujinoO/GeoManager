import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Alert,
  App,
  Button,
  Checkbox,
  Empty,
  Input,
  Modal,
  Space,
  Spin,
  Tag,
} from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { analysisApi } from "../../api/analysis";
import { api } from "../../api/client";
import type {
  AnalysisReportDocument,
  ResultArtifact,
} from "../../api/generated/types.gen";
import { useAppContext } from "../../contexts/AppContext";
import { captureReportFigures, renderReportPages } from "./report-render";

const autoPreviewDelayMs = 450;

type ReportPreview = { document: AnalysisReportDocument; pages: Blob[] };
type ReportRenderJob = {
  document: AnalysisReportDocument;
  pages: Promise<Blob[]>;
};

export default function AnalysisReportEditor({
  open,
  onClose,
  resourceId,
  initialReportId,
  title = "数据分析报告",
  paragraphs = [],
  source = "",
  scope,
  charts,
}: {
  open: boolean;
  onClose: () => void;
  resourceId?: number;
  initialReportId?: number;
  title?: string;
  paragraphs?: string[];
  source?: string;
  scope?: () => HTMLElement | null;
  charts?: ReactNode;
}) {
  const { message } = App.useApp();
  const { user } = useAppContext();
  const captureRef = useRef<HTMLDivElement>(null);
  const renderJob = useRef<ReportRenderJob>(undefined);
  const savedId = useRef<number | undefined>(initialReportId);
  const paragraphIds = useRef<string[]>([]);
  const nextParagraphId = () =>
    crypto.getRandomValues(new Uint32Array(3)).join("-");
  const [doc, setDoc] = useState<AnalysisReportDocument>();
  const [artifact, setArtifact] = useState<ResultArtifact>();
  const [sourceId, setSourceId] = useState(resourceId);
  const [preview, setPreview] = useState<ReportPreview>();
  const [refreshRequest, setRefreshRequest] = useState<{
    document: AnalysisReportDocument;
  }>();
  const [previewError, setPreviewError] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canSave = Boolean(
    user?.permissions.canImportResultArtifacts &&
    user.permissions.canExportData &&
    user.permissions.canViewResultArtifacts,
  );
  const previewIsCurrent = Boolean(doc && preview?.document === doc);
  const previewPages = preview?.pages;
  useEffect(() => {
    const next = open
      ? (previewPages ?? []).map((p) => URL.createObjectURL(p))
      : [];
    setUrls(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
  }, [open, previewPages]);

  useEffect(() => {
    setBusy(open);
    setError("");
    setDoc(undefined);
    setArtifact(undefined);
    setPreview(undefined);
    setPreviewError("");
    setRefreshRequest(undefined);
    if (!open) return;
    let ignore = false;
    async function initialize() {
      if (initialReportId) {
        const report = await analysisApi.report(initialReportId);
        if (!report.reportDocument)
          throw new Error("该成果没有可编辑的报告内容");
        if (!ignore) {
          savedId.current = report.id;
          paragraphIds.current =
            report.reportDocument.paragraphs.map(nextParagraphId);
          setArtifact(report);
          setSourceId(report.sourceResourceId ?? undefined);
          setDoc(report.reportDocument);
        }
      } else {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
        );
        if (ignore) return;
        const figures = await captureReportFigures(
          charts ? captureRef.current : (scope?.() ?? null),
        );
        if (!ignore) {
          savedId.current = undefined;
          paragraphIds.current = paragraphs.map(nextParagraphId);
          setSourceId(resourceId);
          const initial = {
            title: `${title}分析报告`.slice(0, 160),
            source,
            paragraphs,
            figures,
          };
          setDoc(initial);
        }
      }
    }
    void initialize()
      .catch((e) => {
        if (!ignore) setError(e instanceof Error ? e.message : "报告读取失败");
      })
      .finally(() => {
        if (!ignore) setBusy(false);
      });
    return () => {
      ignore = true;
    };
  }, [open, initialReportId, resourceId]);
  const renderDocument = useCallback((document: AnalysisReportDocument) => {
    const active = renderJob.current;
    if (active?.document === document) return active.pages;
    const pages = (async () => {
      // Serialize full-resolution renders; each may allocate several A4 canvases.
      if (active) await active.pages.catch(() => {});
      return renderReportPages(document);
    })().finally(() => {
      if (renderJob.current?.pages === pages) renderJob.current = undefined;
    });
    renderJob.current = { document, pages };
    return pages;
  }, []);

  useEffect(() => {
    if (!open || !doc || busy || previewIsCurrent) return;
    let ignore = false;
    const timer = window.setTimeout(
      async () => {
        const active = renderJob.current;
        if (active && active.document !== doc) {
          await active.pages.catch(() => {});
        }
        // A newer edit, save or close may have superseded this preview.
        if (ignore) return;
        try {
          const pages = await renderDocument(doc);
          if (!ignore) setPreview({ document: doc, pages });
        } catch (e) {
          if (!ignore)
            setPreviewError(e instanceof Error ? e.message : "预览生成失败");
        }
      },
      refreshRequest?.document === doc ? 0 : autoPreviewDelayMs,
    );
    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [busy, doc, open, previewIsCurrent, refreshRequest, renderDocument]);

  function update(next: AnalysisReportDocument) {
    setDoc(next);
    setPreviewError("");
    setRefreshRequest(undefined);
    setArtifact(undefined);
  }
  async function save() {
    if (!doc || !sourceId) return;
    setBusy(true);
    setError("");
    setPreviewError("");
    try {
      const output =
        preview?.document === doc ? preview.pages : await renderDocument(doc);
      if (preview?.document !== doc)
        setPreview({ document: doc, pages: output });
      const body = new FormData();
      body.set("resourceId", String(sourceId));
      body.set("document", JSON.stringify(doc));
      output.forEach((page, i) =>
        body.append("pages", page, `page-${i + 1}.png`),
      );
      const saved = await analysisApi.saveReport(body, savedId.current);
      savedId.current = saved.id;
      setArtifact(saved);
      message.success("PDF草稿已保存，可提交审核后发布");
    } catch (e) {
      setError(e instanceof Error ? e.message : "报告保存失败");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!artifact) return;
    setBusy(true);
    try {
      const result = await api.updateResultArtifact(artifact.id, {
        action: "submit_review",
      });
      if ("status" in result) setArtifact(result);
      message.success("已提交审核，审核发布后将进入成果展示");
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setBusy(false);
    }
  }
  const frozen =
    artifact?.status === "published" || artifact?.status === "in_review";
  function moveFigure(index: number, direction: number) {
    if (!doc) return;
    const figures = [...doc.figures];
    const next = index + direction;
    if (next < 0 || next >= figures.length) return;
    const first = figures[index],
      second = figures[next];
    if (!first || !second) return;
    figures[index] = second;
    figures[next] = first;
    update({ ...doc, figures });
  }
  return (
    <Modal
      open={open}
      onCancel={() => {
        if (!busy) onClose();
      }}
      title="生成数据分析报告"
      width={1440}
      style={{ maxWidth: "calc(100vw - 32px)", top: 24 }}
      className="analysis-report-modal"
      mask={{ closable: !busy }}
      destroyOnHidden
      footer={
        <Space wrap>
          <span>PDF草稿经审核发布后成为成果</span>
          <Button onClick={onClose} disabled={busy}>
            关闭
          </Button>
          <Button
            aria-label="更新预览"
            onClick={() => {
              if (!doc) return;
              setPreviewError("");
              setRefreshRequest({ document: doc });
            }}
            disabled={!doc || busy || previewIsCurrent}
          >
            更新预览
          </Button>
          {artifact?.canDownload && (
            <Button href={artifact.downloadUrl} target="_blank">
              下载PDF
            </Button>
          )}
          <Button
            aria-label="保存PDF草稿"
            type="primary"
            onClick={() => void save()}
            loading={busy}
            disabled={busy || !doc || !canSave || frozen || !sourceId}
          >
            保存PDF草稿
          </Button>
          {artifact?.canSubmitReview && (
            <Button
              type="primary"
              onClick={() => void submit()}
              disabled={busy}
            >
              提交审核
            </Button>
          )}
        </Space>
      }
    >
      {error && (
        <Alert
          type="error"
          title={error}
          showIcon
          style={{ marginBottom: 12 }}
        />
      )}
      {!canSave && (
        <Alert
          type="info"
          title="可编辑和预览；保存报告需要数据导出与成果导入权限"
        />
      )}
      {artifact && (
        <Space style={{ marginBottom: 12 }}>
          <Tag color={artifact.status === "in_review" ? "gold" : "green"}>
            {artifact.status === "in_review"
              ? "待审核"
              : artifact.status === "published"
                ? "已发布"
                : "草稿已保存"}
          </Tag>
          <span>{artifact.name}</span>
        </Space>
      )}
      {artifact?.reviewNote && (
        <Alert
          type="warning"
          title="修改意见"
          description={artifact.reviewNote}
          style={{ marginBottom: 12 }}
        />
      )}
      <Spin spinning={busy}>
        <div className="analysis-report-editor-grid">
          <section className="analysis-report-controls">
            {!doc ? (
              <Empty description="正在准备图表和分析" />
            ) : (
              <fieldset disabled={busy || frozen}>
                <label>
                  报告标题
                  <Input
                    value={doc.title}
                    maxLength={160}
                    onChange={(e) => update({ ...doc, title: e.target.value })}
                  />
                </label>
                <label>
                  数据来源与分析范围
                  <Input.TextArea
                    rows={3}
                    value={doc.source}
                    maxLength={4000}
                    onChange={(e) => update({ ...doc, source: e.target.value })}
                  />
                </label>
                <h3>文字分析</h3>
                {doc.paragraphs.map((p, i) => (
                  <div
                    className="analysis-report-paragraph"
                    key={paragraphIds.current[i]}
                  >
                    <Input.TextArea
                      aria-label={`分析段落${i + 1}`}
                      value={p}
                      rows={3}
                      maxLength={4000}
                      onChange={(e) =>
                        update({
                          ...doc,
                          paragraphs: doc.paragraphs.map((old, j) =>
                            i === j ? e.target.value : old,
                          ),
                        })
                      }
                    />
                    <Button
                      aria-label={`删除分析段落${i + 1}`}
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        paragraphIds.current.splice(i, 1);
                        update({
                          ...doc,
                          paragraphs: doc.paragraphs.filter((_, j) => i !== j),
                        });
                      }}
                    />
                  </div>
                ))}
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => {
                    paragraphIds.current.push(nextParagraphId());
                    update({ ...doc, paragraphs: [...doc.paragraphs, ""] });
                  }}
                  disabled={doc.paragraphs.length >= 40}
                >
                  增加分析段落
                </Button>
                <h3>选择图表与编辑图注</h3>
                {doc.figures.map((figure, i) => (
                  <article
                    className="analysis-report-figure-choice"
                    key={figure.id}
                  >
                    <Space wrap>
                      <Checkbox
                        checked={figure.included}
                        onChange={(e) =>
                          update({
                            ...doc,
                            figures: doc.figures.map((f) =>
                              f.id === figure.id
                                ? { ...f, included: e.target.checked }
                                : f,
                            ),
                          })
                        }
                      >
                        纳入报告
                      </Checkbox>
                      <Button
                        aria-label={`上移${figure.title}`}
                        icon={<ArrowUpOutlined />}
                        disabled={!i}
                        onClick={() => moveFigure(i, -1)}
                      />
                      <Button
                        aria-label={`下移${figure.title}`}
                        icon={<ArrowDownOutlined />}
                        disabled={i === doc.figures.length - 1}
                        onClick={() => moveFigure(i, 1)}
                      />
                    </Space>
                    <img src={figure.imageData} alt={figure.title} />
                    <Input
                      aria-label={`图表标题${i + 1}`}
                      value={figure.title}
                      maxLength={200}
                      onChange={(e) =>
                        update({
                          ...doc,
                          figures: doc.figures.map((f) =>
                            f.id === figure.id
                              ? { ...f, title: e.target.value }
                              : f,
                          ),
                        })
                      }
                    />
                    <Input.TextArea
                      aria-label={`图表说明${i + 1}`}
                      value={figure.caption}
                      rows={2}
                      maxLength={4000}
                      onChange={(e) =>
                        update({
                          ...doc,
                          figures: doc.figures.map((f) =>
                            f.id === figure.id
                              ? { ...f, caption: e.target.value }
                              : f,
                          ),
                        })
                      }
                    />
                  </article>
                ))}
              </fieldset>
            )}
          </section>
          <section className="analysis-report-preview" aria-label="报告预览">
            {doc && (
              <p className="analysis-report-preview-status" role="status">
                {previewError
                  ? urls.length
                    ? `预览更新失败，当前显示上一次的预览：${previewError}`
                    : `预览生成失败：${previewError}`
                  : previewIsCurrent
                    ? "修改后自动预览"
                    : "正在自动更新预览…"}
              </p>
            )}
            {urls.length ? (
              urls.map((url, i) => (
                <img key={url} src={url} alt={`报告第${i + 1}页`} />
              ))
            ) : (
              <Empty
                description={
                  previewError || (!doc && error)
                    ? "暂无可用预览"
                    : "正在准备报告页面"
                }
              />
            )}
          </section>
        </div>
      </Spin>
      {open && charts && (
        <div
          className="analysis-report-capture"
          ref={captureRef}
          aria-hidden="true"
        >
          {charts}
        </div>
      )}
    </Modal>
  );
}
