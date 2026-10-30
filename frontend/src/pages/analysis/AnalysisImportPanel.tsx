import {
  Alert,
  App,
  Button,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from "antd";
import { fieldLabel } from "./presentation";
import { useEffect, useState } from "react";
import { AnalysisApiError, analysisApi } from "../../api/analysis";
import type {
  AnalysisTemplateCatalog,
  AnalysisImportResult,
} from "../../api/generated/types.gen";

export default function AnalysisImportPanel({
  canImport,
  onImported,
  onOpen,
  onDirtyChange,
}: {
  canImport: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onImported: (resourceId: number, genome?: boolean) => void;
  onOpen: (resourceId: number, kind: string) => void;
}) {
  const { message } = App.useApp();
  const [catalog, setCatalog] = useState<AnalysisTemplateCatalog>();
  const [kind, setKind] = useState("traits");
  const [name, setName] = useState("");
  const [provenance, setProvenance] = useState<string>("observed");
  const [source, setSource] = useState("");
  const [vcfAssembly, setVcfAssembly] = useState("");
  const [file, setFile] = useState<File>();
  const [result, setResult] = useState<AnalysisImportResult>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [genomeSource, setGenomeSource] = useState("");
  const [genomeName, setGenomeName] = useState("");
  const [genomeProvenance, setGenomeProvenance] = useState<string>("observed");
  const [sex, setSex] = useState("unknown");
  const [genomeFiles, setGenomeFiles] = useState<Record<string, File>>({});
  const [genomeError, setGenomeError] = useState("");
  useEffect(() => {
    let ignore = false;
    analysisApi
      .templates()
      .then((r) => {
        if (!ignore) setCatalog(r);
      })
      .catch((e: unknown) => {
        if (!ignore) setError(e instanceof Error ? e.message : "模板读取失败");
      });
    return () => {
      ignore = true;
    };
  }, []);
  useEffect(() => {
    onDirtyChange?.(
      Boolean((file && !result?.resourceId) || Object.keys(genomeFiles).length),
    );
  }, [file, result?.resourceId, genomeFiles, onDirtyChange]);
  const selected = catalog?.items.find((t) => t.kind === kind);
  async function importTable(validateOnly: boolean) {
    if (!file || !name.trim() || !provenance) {
      void message.warning("请填写名称、选择文件并明确数据来源");
      return;
    }
    setBusy(true);
    setResult(undefined);
    setError("");
    const body = new FormData();
    body.set("file", file);
    body.set("kind", kind);
    body.set("source", source);
    body.set("assembly", vcfAssembly);
    body.set("name", name.trim());
    body.set("provenance", provenance);
    body.set("validateOnly", String(validateOnly));
    try {
      const response = await analysisApi.importTable(body);
      setResult(response);
      if (response.resourceId) {
        void message.success(`已导入${response.rowCount}条记录`);
        onImported(response.resourceId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
      if (
        e instanceof AnalysisApiError &&
        typeof e.data === "object" &&
        e.data !== null &&
        "issues" in e.data
      )
        setResult(e.data as AnalysisImportResult);
    } finally {
      setBusy(false);
    }
  }
  async function importGenome() {
    if (
      !genomeFiles.genome ||
      !genomeFiles.gff ||
      !code.trim() ||
      !genomeName.trim() ||
      !genomeProvenance
    ) {
      void message.warning("请填写组装编号、名称、来源及genome/GFF文件");
      return;
    }
    if (
      Object.values(genomeFiles).reduce((s, f) => s + f.size, 0) >
      512 * 1024 * 1024
    ) {
      setGenomeError("配套文件合计不得超过512MiB；请保留页面等待索引完成");
      return;
    }
    setBusy(true);
    setGenomeError("");
    const body = new FormData();
    body.set("name", genomeName.trim());
    body.set("code", code.trim());
    body.set("sex", sex);
    body.set("sourceUrl", genomeSource);
    body.set("provenance", genomeProvenance);
    Object.entries(genomeFiles).forEach(([r, f]) => body.set(r, f));
    try {
      const response = await analysisApi.importGenome(body);
      void message.success("配套校验和索引完成，已登记到资源目录");
      setGenomeFiles({});
      onImported(response.assembly.resourceId, true);
      onOpen(response.assembly.resourceId, "genome");
    } catch (e) {
      setGenomeError(e instanceof Error ? e.message : "基因组接入失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="analysis-import">
      <Alert
        type="info"
        showIcon
        title="按数据类型准备文件"
        description="表格请使用标准字段，基因组请按角色配套选择FASTA、GFF和蛋白序列。模板、文件格式与字段说明统一在此维护。"
      />
      <Tabs
        items={[
          {
            key: "table",
            label: "专业表格导入",
            children: (
              <>
                <div className="analysis-toolbar">
                  <Select
                    aria-label="模板类型"
                    value={kind}
                    onChange={(value) => {
                      setKind(value);
                      setFile(undefined);
                      setResult(undefined);
                      setError("");
                    }}
                    options={catalog?.items
                      .filter((t) => t.kind !== "genome")
                      .map((t) => ({ label: t.name, value: t.kind }))}
                  />
                  <Space wrap>
                    <Button
                      href={`/api/analysis/templates/${kind}/file/?format=csv`}
                    >
                      空模板CSV
                    </Button>
                    <Button
                      href={`/api/analysis/templates/${kind}/file/?format=xlsx`}
                    >
                      空模板Excel
                    </Button>
                    <Button href="/downloads/analysis-reference-data.zip">
                      下载参考数据包
                    </Button>
                  </Space>
                </div>
                <div className="analysis-chart-grid">
                  <section className="analysis-card">
                    <h3>字段与数据约束</h3>
                    {selected ? (
                      <>
                        <p>
                          统计对象：{selected.unit}；联合唯一键：
                          {selected.uniqueKey.join(" + ")}
                        </p>
                        <Table
                          size="small"
                          rowKey="name"
                          pagination={false}
                          scroll={{ x: 520 }}
                          dataSource={selected.columns}
                          columns={[
                            {
                              title: "字段",
                              dataIndex: "name",
                              width: 165,
                              render: (name: string) =>
                                `${fieldLabel(name)}（${name}）`,
                            },
                            {
                              title: "要求",
                              render: (_, r) => (
                                <Tag color={r.required ? "cyan" : "default"}>
                                  {r.required ? "必填" : "可空"} ·{" "}
                                  {r.numeric ? "数值" : "文本"}
                                </Tag>
                              ),
                              width: 130,
                            },
                            { title: "说明", dataIndex: "description" },
                          ]}
                        />
                      </>
                    ) : (
                      <Empty description="正在加载模板" />
                    )}
                  </section>
                  <section className="analysis-card">
                    <h3>校验并导入平台</h3>
                    <Form layout="vertical">
                      <Form.Item label="数据名称" required>
                        <Input
                          aria-label="导入数据名称"
                          value={name}
                          maxLength={160}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="例如：2026年塔里木样方性状"
                        />
                      </Form.Item>
                      <Form.Item label="资料类型" required>
                        <Select
                          aria-label="表格数据来源"
                          value={provenance}
                          placeholder="请明确选择"
                          onChange={setProvenance}
                          options={[
                            {
                              value: "observed",
                              label: "观测、实验或公开资料",
                            },
                            {
                              value: "synthetic",
                              label: "模拟资料",
                            },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item label="来源说明">
                        <Input
                          aria-label="数据来源说明"
                          value={source}
                          maxLength={160}
                          onChange={(e) => setSource(e.target.value)}
                          placeholder="提供单位、数据库或原始记录"
                        />
                      </Form.Item>
                      {kind === "variants" && (
                        <Form.Item label="VCF参考组装">
                          <Input
                            aria-label="VCF参考组装"
                            value={vcfAssembly}
                            onChange={(e) => setVcfAssembly(e.target.value)}
                            placeholder="导入VCF时必填，例如GWHBHNV00000000"
                          />
                        </Form.Item>
                      )}
                      <Form.Item
                        label="数据文件（CSV、TSV、Excel或VCF）"
                        required
                      >
                        <Input
                          key={kind}
                          aria-label="表格数据文件"
                          type="file"
                          accept={
                            kind === "variants"
                              ? ".csv,.tsv,.txt,.xlsx,.vcf,.vcf.gz"
                              : ".csv,.tsv,.txt,.xlsx"
                          }
                          onChange={(e) => {
                            setFile(e.target.files?.[0]);
                            setResult(undefined);
                          }}
                        />
                      </Form.Item>
                      <Space wrap>
                        <Button
                          disabled={!canImport}
                          loading={busy}
                          onClick={() => void importTable(true)}
                        >
                          仅校验
                        </Button>
                        <Button
                          type="primary"
                          disabled={!canImport}
                          loading={busy}
                          onClick={() => void importTable(false)}
                        >
                          校验并导入
                        </Button>
                      </Space>
                    </Form>
                    {!canImport && (
                      <Alert
                        type="warning"
                        title="当前账号没有新增数据资源权限，可下载模板并联系数据管理员"
                      />
                    )}
                    {error && <Alert type="error" title={error} />}
                    {result && (
                      <Alert
                        type={result.valid ? "success" : "error"}
                        title={`${result.valid ? "校验通过" : "校验未通过"} · ${result.rowCount}条记录`}
                        description={
                          <div>
                            {[...result.issues, ...result.warnings].map(
                              (issue) => (
                                <p key={issue}>{issue}</p>
                              ),
                            )}
                            {result.resourceId && (
                              <Button
                                onClick={() =>
                                  onOpen(result.resourceId as number, kind)
                                }
                              >
                                打开此数据分析
                              </Button>
                            )}
                          </div>
                        }
                      />
                    )}
                  </section>
                </div>
              </>
            ),
          },
          {
            key: "genome",
            label: "基因组配套接入",
            children: (
              <>
                <div className="analysis-toolbar">
                  <Button href="/downloads/analysis-reference-data.zip">
                    下载参考基因组与表格
                  </Button>
                  <span>
                    支持FASTA/FA/FNA、GFF/GFF3、FAA及gzip；完整基因组索引需要数分钟，请等待完成。
                  </span>
                </div>
                <div className="analysis-chart-grid">
                  <section className="analysis-card">
                    <h3>组装与来源</h3>
                    <Form layout="vertical">
                      <Form.Item label="唯一组装编号" required>
                        <Input
                          aria-label="组装编号"
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          maxLength={100}
                          placeholder="例如 GWHBHNV00000000；新版本使用新编号"
                        />
                      </Form.Item>
                      <Form.Item label="组装名称" required>
                        <Input
                          aria-label="组装名称"
                          value={genomeName}
                          onChange={(e) => setGenomeName(e.target.value)}
                          maxLength={160}
                        />
                      </Form.Item>
                      <Form.Item label="原始资料来源">
                        <Input
                          aria-label="基因组资料来源"
                          value={genomeSource}
                          maxLength={2000}
                          onChange={(e) => setGenomeSource(e.target.value)}
                          placeholder="数据库地址或提供单位"
                        />
                      </Form.Item>
                      <Form.Item label="性别标签">
                        <Select
                          aria-label="组装性别"
                          value={sex}
                          onChange={setSex}
                          options={[
                            { value: "female", label: "雌株" },
                            { value: "male", label: "雄株" },
                            { value: "unknown", label: "未确认" },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item label="来源" required>
                        <Select
                          aria-label="基因组数据来源"
                          value={genomeProvenance}
                          placeholder="请明确选择"
                          onChange={setGenomeProvenance}
                          options={[
                            { value: "observed", label: "真实公开 / 实验数据" },
                            { value: "synthetic", label: "模拟资料" },
                          ]}
                        />
                      </Form.Item>
                    </Form>
                    <Alert
                      type="info"
                      title="文件配套说明"
                      description="序列与注释应来自同一版本。可以导入完整组装，或名称中明确标注范围的局部序列；配套文件合计不超过512MiB，提交后请等待校验完成。"
                    />
                  </section>
                  <section className="analysis-card">
                    <h3>文件角色与配套校验</h3>
                    <Form layout="vertical">
                      {[
                        ["genome", "基因组DNA FASTA（必填）"],
                        ["gff", "结构注释GFF/GFF3（必填）"],
                        ["protein", "蛋白FAA"],
                        ["rna", "转录本RNA FASTA"],
                        ["cds", "编码序列CDS FASTA"],
                      ].map(([role = "", label]) => (
                        <Form.Item label={label} key={role}>
                          <Input
                            aria-label={`${role}文件`}
                            type="file"
                            accept=".fa,.fna,.fasta,.faa,.gff,.gff3,.gz"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              setGenomeFiles((prev) => {
                                const next = { ...prev };
                                if (f) next[role] = f;
                                else delete next[role];
                                return next;
                              });
                            }}
                          />
                        </Form.Item>
                      ))}
                      <Button
                        type="primary"
                        disabled={!canImport}
                        loading={busy}
                        onClick={() => void importGenome()}
                      >
                        校验配套并建立索引
                      </Button>
                    </Form>
                    {genomeError && <Alert type="error" title={genomeError} />}
                  </section>
                </div>
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
