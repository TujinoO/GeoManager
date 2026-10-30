import { useEffect, useRef, useState, type ReactNode } from "react";
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
  const revision = useRef(0);
  const savedId = useRef<number | undefined>(initialReportId);
  const paragraphIds = useRef<string[]>([]);
  const nextParagraphId = () =>
    crypto.getRandomValues(new Uint32Array(3)).join("-");
  const [doc, setDoc] = useState<AnalysisReportDocument>();
  const [artifact, setArtifact] = useState<ResultArtifact>();
  const [sourceId, setSourceId] = useState(resourceId);
  const [pages, setPages] = useState<Blob[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canSave = Boolean(
    user?.permissions.canImportResultArtifacts &&
    user.permissions.canExportData &&
    user.permissions.canViewResultArtifacts,
  );
  useEffect(() => {
    const next = pages.map((p) => URL.createObjectURL(p));
    setUrls(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
  }, [pages]);
  useEffect(() => {
    if (!open) return;
    let ignore = false;
    setBusy(true);
    setError("");
    setDoc(undefined);
    setArtifact(undefined);
    setPages([]);
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
          setPages(await renderReportPages(report.reportDocument));
        }
      } else {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
        );
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
          setPages(await renderReportPages(initial));
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
  function update(next: AnalysisReportDocument) {
    revision.current++;
    setDoc(next);
    setPages([]);
    setArtifact(undefined);
  }
  async function preview() {
    if (!doc) return;
    const version = revision.current;
    setBusy(true);
    setError("");
    try {
      const result = await renderReportPages(doc);
      if (version === revision.current) setPages(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "预览生成失败");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!doc || !sourceId) return;
    setBusy(true);
    setError("");
    try {
      const output = pages.length ? pages : await renderReportPages(doc);
      setPages(output);
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
      onCancel={onClose}
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
            onClick={() => void preview()}
            loading={busy}
            disabled={!doc || busy}
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
            {urls.length ? (
              urls.map((url, i) => (
                <img key={url} src={url} alt={`报告第${i + 1}页`} />
              ))
            ) : (
              <Empty description="调整图表和文字后，点击“更新预览”查看正式版式" />
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
