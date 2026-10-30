import {
  Alert,
  App,
  Button,
  Descriptions,
  Form,
  Input,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import { CloudUploadOutlined, FileOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { AnalysisApiError, analysisApi } from "../../api/analysis";
import type {
  AnalysisTemplateCatalog,
  AnalysisImportResult,
} from "../../api/generated/types.gen";
import { fieldLabel } from "./presentation";

const roles = [
  {
    key: "genome",
    label: "基因组序列",
    format: "FASTA / FA / FNA",
    required: true,
  },
  { key: "gff", label: "基因结构注释", format: "GFF / GFF3", required: true },
  { key: "protein", label: "蛋白序列", format: "FAA / FASTA", required: false },
  { key: "rna", label: "转录本序列", format: "FASTA", required: false },
  { key: "cds", label: "编码序列", format: "FASTA", required: false },
];
const categories = [
  { value: "auto", label: "自动识别" },
  { value: "ecology", label: "生态观测数据" },
  { value: "samples", label: "种质数据" },
  { value: "molecular", label: "分子数据" },
  { value: "genome", label: "基因数据" },
];
const ecologyKinds = [
  { value: "ecology", label: "自动识别观测类型" },
  { value: "individual", label: "个体" },
  { value: "population", label: "种群" },
  { value: "community", label: "群落" },
  { value: "traits", label: "功能性状" },
];
const origins = [
  { value: "observed", label: "观测、实验或公开资料" },
  { value: "synthetic", label: "模拟资料" },
];

export default function AnalysisImportPanel({
  canImport,
  onImported,
  onOpen,
  onDirtyChange,
  onBusyChange,
}: {
  canImport: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  onImported: (resourceId: number, genome?: boolean) => void;
  onOpen: (resourceId: number, kind: string) => void;
}) {
  const { message } = App.useApp();
  const [catalog, setCatalog] = useState<AnalysisTemplateCatalog>();
  const [mode, setMode] = useState("auto");
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState("auto");
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [provenance, setProvenance] = useState("observed");
  const [sheet, setSheet] = useState("");
  const [file, setFile] = useState<File>();
  const [files, setFiles] = useState<File[]>([]);
  const [code, setCode] = useState("");
  const [sex, setSex] = useState("unknown");
  const [result, setResult] = useState<AnalysisImportResult>();
  const [imported, setImported] = useState<number>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const genome = mode === "genome";
  const hasFiles = genome ? files.length >= 2 : Boolean(file);
  useEffect(() => {
    let ignore = false;
    analysisApi
      .templates()
      .then((r) => {
        if (!ignore) setCatalog(r);
      })
      .catch((e) => {
        if (!ignore)
          setError(e instanceof Error ? e.message : "数据类型加载失败");
      });
    return () => {
      ignore = true;
    };
  }, []);
  useEffect(() => {
    onDirtyChange?.(!imported && Boolean(file || files.length));
  }, [file, files, imported, onDirtyChange]);
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  function invalidate() {
    setResult(undefined);
    setError("");
    setImported(undefined);
  }
  function reset() {
    setFile(undefined);
    setFiles([]);
    setKind("auto");
    setMode("auto");
    setSex("unknown");
    setProvenance("observed");
    setName("");
    setCode("");
    setSheet("");
    setSource("");
    setStep(0);
    invalidate();
  }
  function selectCategory(value: string) {
    setMode(value);
    setKind(value === "genome" ? "auto" : value);
    if (value === "genome") setStep(0);
    invalidate();
  }
  const categorySelect = (
    <Select
      aria-label="数据类型"
      disabled={busy}
      value={mode}
      options={categories}
      onChange={selectCategory}
    />
  );
  async function submit(validateOnly: boolean) {
    if (
      !canImport ||
      busy ||
      !hasFiles ||
      !name.trim() ||
      (genome && !code.trim())
    )
      return;
    if (!validateOnly && (!result?.valid || imported)) return;
    setBusy(true);
    setError("");
    const body = new FormData();
    body.set("name", name.trim());
    body.set("provenance", provenance);
    body.set("validateOnly", String(validateOnly));
    if (genome) {
      body.set("code", code.trim());
      body.set("sex", sex);
      body.set("sourceUrl", source);
      files.forEach((f) => body.append("files", f));
    } else {
      body.set("file", file!);
      body.set("kind", kind);
      body.set("source", source);
      body.set("sheetName", sheet.trim());
    }
    try {
      if (genome && !validateOnly) {
        const response = await analysisApi.importGenome(body);
        setImported(response.assembly.resourceId);
        onImported(response.assembly.resourceId, true);
        void message.success("基因组已入库");
      } else {
        const response = genome
          ? await analysisApi.validateGenome(body)
          : await analysisApi.importTable(body);
        setResult(response);
        if (response.resourceId) {
          setImported(response.resourceId);
          onImported(response.resourceId);
          void message.success("数据已入库");
        }
      }
    } catch (e) {
      setResult(undefined);
      setError(e instanceof Error ? e.message : "处理失败，请核对文件后重试");
      if (
        e instanceof AnalysisApiError &&
        typeof e.data === "object" &&
        e.data !== null &&
        "issues" in e.data
      ) {
        setResult(e.data as AnalysisImportResult);
        setError("");
      }
    } finally {
      setBusy(false);
    }
  }
  const resolvedKind = result?.resolvedKind ?? kind;
  const kindName = genome
    ? "参考基因组"
    : (catalog?.items.find((t) => t.kind === resolvedKind)?.name ??
      resolvedKind);
  const selectedFiles = genome ? files : file ? [file] : [];
  return (
    <div className="analysis-import nongeo-import-workflow">
      <Steps
        current={step}
        items={[
          { title: "选择数据" },
          { title: "核查校验" },
          { title: "确认入库" },
        ]}
      />
      {!canImport && (
        <Alert
          showIcon
          type="warning"
          title="当前账号没有导入权限，请联系数据管理员"
        />
      )}
      {step === 0 && (
        <section className="import-step-pane">
          <Form layout="vertical" className="nongeo-import-fields">
            <Form.Item label="数据类型">{categorySelect}</Form.Item>
          </Form>
          {!genome ? (
            <Upload.Dragger
              disabled={busy}
              maxCount={1}
              showUploadList={false}
              accept=".csv,.tsv,.txt,.xls,.xlsx,.csv.gz,.tsv.gz,.txt.gz"
              beforeUpload={(f) => {
                if (f.size > 16 * 1024 * 1024) {
                  setError("表格文件不能超过16MiB");
                  return false;
                }
                setFile(f);
                setSheet("");
                setName(
                  f.name
                    .replace(/\.(csv|tsv|txt|xls|xlsx)(\.gz)?$/i, "")
                    .slice(0, 160),
                );
                invalidate();
                return false;
              }}
            >
              <CloudUploadOutlined style={{ fontSize: 34 }} />
              <Typography.Title level={4}>选择或拖拽数据文件</Typography.Title>
              <Typography.Paragraph type="secondary">
                支持 CSV、TSV、TXT、XLS、XLSX，以及 CSV / TSV / TXT
                压缩文件；不超过16MiB。
              </Typography.Paragraph>
              <Tag color={file ? "green" : undefined}>
                {file?.name ?? "尚未选择文件"}
              </Tag>
            </Upload.Dragger>
          ) : (
            <>
              <Upload.Dragger
                disabled={busy}
                multiple
                showUploadList={false}
                accept=".fa,.fna,.fasta,.faa,.gff,.gff3,.gz"
                beforeUpload={(f, batch) => {
                  if (f !== batch[0]) return false;
                  if (
                    batch.length > 5 ||
                    batch.reduce((sum, item) => sum + item.size, 0) >
                      512 * 1024 * 1024
                  ) {
                    setError("每次最多选择5个配套文件，合计不能超过512MiB");
                    return false;
                  }
                  setFiles(batch);
                  const base = (batch.find((item) =>
                    /[._-]genome[._-]/i.test(item.name),
                  ) ?? batch[0])!.name
                    .replace(/\.(gz)$/i, "")
                    .replace(/\.(fasta|fa|fna|faa|gff3?)$/i, "")
                    .replace(/[._-](genome|protein|rna|cds)$/i, "");
                  setName(base.slice(0, 160));
                  setCode(/^[a-z0-9_.-]{1,100}$/i.test(base) ? base : "");
                  invalidate();
                  return false;
                }}
              >
                <CloudUploadOutlined style={{ fontSize: 34 }} />
                <Typography.Title level={4}>
                  一次选择或拖入整组基因文件
                </Typography.Title>
                <Typography.Paragraph type="secondary">
                  自动匹配基因组、GFF注释、蛋白、RNA与CDS。至少选择基因组和注释文件，支持gzip压缩，合计不超过512MiB。
                </Typography.Paragraph>
                <Typography.Text type="secondary">
                  请选择同一组装的原始文件；重新选择将替换当前整组。
                </Typography.Text>
              </Upload.Dragger>
              {files.length > 0 && (
                <div className="nongeo-genome-selection">
                  {files.map((f) => (
                    <div key={f.name} className="nongeo-import-fileline">
                      <FileOutlined />
                      <span>{f.name}</span>
                      <Button
                        type="text"
                        size="small"
                        disabled={busy}
                        onClick={() => {
                          setFiles((prev) => prev.filter((item) => item !== f));
                          invalidate();
                        }}
                      >
                        移除
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <Space wrap className="import-actions">
            <Button
              type="primary"
              disabled={!hasFiles || !canImport}
              onClick={() => {
                setError("");
                setStep(1);
              }}
            >
              下一步：核查校验
            </Button>
            <Button
              type="link"
              href="/about/docs?article=nongeo-import"
              target="_blank"
            >
              查看数据准备规范
            </Button>
          </Space>
        </section>
      )}
      {step === 1 && (
        <section className="import-step-pane">
          <div className="nongeo-import-fileline">
            <FileOutlined />
            <span>{selectedFiles.map((f) => f.name).join("、")}</span>
            <Button
              disabled={busy}
              onClick={() => {
                setStep(0);
                invalidate();
              }}
            >
              重新选择文件
            </Button>
          </div>
          <Form layout="vertical" className="nongeo-import-fields">
            <Form.Item label="数据类型">
              {genome ? <Input value="基因数据" disabled /> : categorySelect}
            </Form.Item>
            {mode === "ecology" && (
              <Form.Item label="观测类型">
                <Select
                  aria-label="观测类型"
                  disabled={busy}
                  value={kind}
                  options={ecologyKinds}
                  onChange={(value) => {
                    setKind(value);
                    invalidate();
                  }}
                />
              </Form.Item>
            )}
            <Form.Item label={genome ? "组装名称" : "数据名称"} required>
              <Input
                aria-label="导入数据名称"
                disabled={busy}
                value={name}
                maxLength={160}
                onChange={(e) => {
                  setName(e.target.value);
                  invalidate();
                }}
              />
            </Form.Item>
            {genome && (
              <Form.Item label="组装编号" required>
                <Input
                  aria-label="组装编号"
                  disabled={busy}
                  value={code}
                  maxLength={100}
                  placeholder="例如 FG_tarim_v1"
                  onChange={(e) => {
                    setCode(e.target.value);
                    invalidate();
                  }}
                />
              </Form.Item>
            )}
            <Form.Item label="资料来源" required>
              <Select
                aria-label="表格数据来源"
                disabled={busy}
                value={provenance}
                options={origins}
                onChange={(v) => {
                  setProvenance(v);
                  invalidate();
                }}
              />
            </Form.Item>
            <Form.Item label="来源说明">
              <Input
                aria-label="数据来源说明"
                disabled={busy}
                value={source}
                maxLength={genome ? 2000 : 160}
                placeholder="提供单位或数据库地址，可留空"
                onChange={(e) => {
                  setSource(e.target.value);
                  invalidate();
                }}
              />
            </Form.Item>
            {!genome && /\.xlsx?$/i.test(file?.name ?? "") && (
              <Form.Item label="工作表名称">
                <Input
                  aria-label="工作表名称"
                  disabled={busy}
                  value={sheet}
                  placeholder="留空读取第一张工作表"
                  onChange={(e) => {
                    setSheet(e.target.value);
                    invalidate();
                  }}
                />
              </Form.Item>
            )}
            {genome && (
              <Form.Item label="性别">
                <Select
                  aria-label="组装性别"
                  disabled={busy}
                  value={sex}
                  options={[
                    { value: "female", label: "雌株" },
                    { value: "male", label: "雄株" },
                    { value: "unknown", label: "未确认" },
                  ]}
                  onChange={(v) => {
                    setSex(v);
                    invalidate();
                  }}
                />
              </Form.Item>
            )}
          </Form>
          <Space wrap className="import-actions">
            <Button
              type="primary"
              loading={busy}
              disabled={!canImport || !name.trim() || (genome && !code.trim())}
              onClick={() => void submit(true)}
            >
              {genome ? "检查文件与配套关系" : "开始校验"}
            </Button>
            <Button
              disabled={busy || !result?.valid}
              onClick={() => setStep(2)}
            >
              下一步：确认入库
            </Button>
          </Space>
          {busy && genome && (
            <Typography.Paragraph type="secondary" role="status">
              正在解析序列、结构和配套编号，完整基因组可能需要数分钟，请保持页面打开。
            </Typography.Paragraph>
          )}
          {result && (
            <Alert
              showIcon
              type={result.valid ? "success" : "error"}
              title={`${result.valid ? "校验通过" : "校验未通过"} · ${result.rowCount}条${genome ? "基因" : "记录"}`}
              description={
                <>
                  {Array.from(
                    new Set([...result.issues, ...result.warnings]),
                  ).map((issue) => (
                    <p key={issue}>{issue}</p>
                  ))}
                </>
              }
            />
          )}
          {result?.resolvedKind && (
            <Typography.Paragraph>
              数据类型：<Tag color="green">{kindName}</Tag>
            </Typography.Paragraph>
          )}
          {result?.matchedFiles && (
            <Descriptions
              bordered
              column={1}
              title="文件匹配结果"
              items={result.matchedFiles.map((item) => ({
                key: item.role,
                label:
                  roles.find((role) => role.key === item.role)?.label ??
                  item.role,
                children: item.name,
              }))}
            />
          )}
          {result?.columns && result.rows && (
            <div className="nongeo-import-preview">
              <Typography.Title level={5}>
                数据预览 · 前{result.rows.length}条
              </Typography.Title>
              <Table
                size="small"
                pagination={false}
                scroll={{ x: "max-content" }}
                rowKey="_row"
                dataSource={result.rows.map((row, i) => ({
                  _row: String(i),
                  cells: row,
                }))}
                columns={result.columns.map((column, i) => ({
                  key: column,
                  title: fieldLabel(column),
                  render: (_, row) => row.cells[i] || "—",
                }))}
              />
            </div>
          )}
        </section>
      )}
      {step === 2 && (
        <section className="import-step-pane">
          <Descriptions
            bordered
            column={1}
            items={[
              { key: "name", label: "数据名称", children: name },
              { key: "kind", label: "数据类型", children: kindName },
              {
                key: "file",
                label: "数据文件",
                children: selectedFiles.map((f) => f.name).join("、"),
              },
              {
                key: "count",
                label: genome ? "基因数量" : "记录数量",
                children: result?.rowCount,
              },
              {
                key: "source",
                label: "资料来源",
                children: origins.find((o) => o.value === provenance)?.label,
              },
            ]}
          />
          {imported ? (
            <Alert
              showIcon
              type="success"
              title="入库完成"
              description={
                <Space wrap>
                  <Button
                    type="primary"
                    onClick={() =>
                      onOpen(imported, genome ? "genome" : resolvedKind)
                    }
                  >
                    打开数据分析
                  </Button>
                  <Button onClick={reset}>继续导入</Button>
                </Space>
              }
            />
          ) : (
            <Space wrap className="import-actions">
              <Button disabled={busy} onClick={() => setStep(1)}>
                返回核查
              </Button>
              <Button
                type="primary"
                loading={busy}
                disabled={!canImport || !result?.valid}
                onClick={() => void submit(false)}
              >
                确认入库
              </Button>
            </Space>
          )}
          {busy && genome && (
            <Typography.Paragraph role="status">
              正在建立基因组索引，请等待完成。
            </Typography.Paragraph>
          )}
        </section>
      )}
      {error && <Alert showIcon type="error" title={error} />}
    </div>
  );
}
