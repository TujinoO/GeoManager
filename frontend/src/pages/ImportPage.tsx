import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  FileExcelOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App as AntApp,
  Button,
  Checkbox,
  Descriptions,
  Form,
  Input,
  Layout,
  Modal,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";
import type {
  ImportCommitPayload,
  ImportCommitResult,
  ImportCoordinateStats,
  ImportPreview,
  ImportValidatePayload,
  ImportValidationIssue,
} from "../types";

interface ImportFormValues {
  name: string;
  importMode: "geographic" | "table";
  longitudeColumn?: string;
  latitudeColumn?: string;
  overwrite: boolean;
}

export default function ImportPage() {
  const { bootstrap, user, setUser } = useAppContext();
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<ImportFormValues>();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fieldMetadata, setFieldMetadata] = useState<Record<string, string>>(
    {},
  );
  const [includedColumns, setIncludedColumns] = useState<string[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [validationIssues, setValidationIssues] = useState<
    ImportValidationIssue[]
  >([]);
  const [validationStats, setValidationStats] =
    useState<ImportCoordinateStats | null>(null);
  const [validating, setValidating] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [ignoreCoordinateUncertainty, setIgnoreCoordinateUncertainty] =
    useState(false);

  const columnOptions = useMemo(
    () =>
      preview?.columns.map((column) => ({ label: column, value: column })) ??
      [],
    [preview],
  );

  const previewColumns = useMemo(
    () =>
      preview?.columns.map((column) => ({
        title: column,
        dataIndex: column,
        key: column,
        width: 180,
        ellipsis: true,
      })) ?? [],
    [preview],
  );

  const previewRows = useMemo(
    () =>
      preview?.rows.map((row) => ({
        ...row,
        previewRowKey: preview.columns
          .map((column) => row[column] ?? "")
          .join("\u001f"),
      })) ?? [],
    [preview],
  );

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // 退出接口异常，本地会话已清空
    }
    setUser(null);
  }

  async function handlePreview(selectedFile?: File) {
    const targetFile = selectedFile ?? file;
    if (!targetFile) {
      message.warning("请先选择 Excel 或 CSV 文件");
      return;
    }
    setPreviewing(true);
    setResult(null);
    try {
      const data = await api.importPreview(targetFile);
      setPreview(data);
      setFieldMetadata(
        Object.fromEntries(data.columns.map((column) => [column, ""])),
      );
      setIncludedColumns(data.columns);
      form.setFieldsValue({
        name: data.suggestedName,
        importMode: data.detected.isGeographic ? "geographic" : "table",
        longitudeColumn: data.detected.longitudeColumn ?? undefined,
        latitudeColumn: data.detected.latitudeColumn ?? undefined,
        overwrite: false,
      });
      setValidationIssues([]);
      setValidationStats(null);
      setHasValidated(false);
      setIgnoreCoordinateUncertainty(false);
      message.success("预检完成");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "预检失败");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport() {
    await submitImport(ignoreCoordinateUncertainty);
  }

  async function handleValidate() {
    if (!file || !preview) {
      message.warning("请先完成文件预检");
      return;
    }
    try {
      const values = await form.validateFields([
        "importMode",
        "longitudeColumn",
        "latitudeColumn",
      ]);
      const payload: ImportValidatePayload = {
        importMode: values.importMode,
        longitudeColumn: values.longitudeColumn,
        latitudeColumn: values.latitudeColumn,
      };
      setValidating(true);
      const validated = await api.importValidate(file, payload);
      setValidationStats(validated.coordinateStats);
      setValidationIssues(validated.validationIssues);
      setIgnoreCoordinateUncertainty(false);
      setHasValidated(true);
      if (validated.validationIssues.length) {
        setIssuesOpen(true);
      } else {
        message.success("数据校验通过");
      }
    } catch (error) {
      const issues = importIssuesFromError(error);
      if (issues.length) {
        setValidationIssues(issues);
        setIssuesOpen(true);
      } else {
        message.error(error instanceof Error ? error.message : "数据校验失败");
      }
    } finally {
      setValidating(false);
    }
  }

  async function submitImport(ignoreUncertainty: boolean) {
    if (!file || !preview) {
      message.warning("请先完成文件预检");
      return;
    }
    try {
      if (form.getFieldValue("importMode") === "geographic" && !hasValidated) {
        message.warning("请先进行数据校验");
        return;
      }
      if (shouldBlockImport(validationIssues, ignoreUncertainty)) {
        setIssuesOpen(true);
        return;
      }
      const values = await form.validateFields();
      const selectedMetadata = Object.fromEntries(
        includedColumns.map((column) => [column, fieldMetadata[column] ?? ""]),
      );
      const payload: ImportCommitPayload = {
        ...values,
        tableName: preview.suggestedTableName,
        ignoreCoordinateUncertainty: ignoreUncertainty,
        overwrite: Boolean(values.overwrite),
        includedColumns,
        fieldMetadata: selectedMetadata,
      };
      setImporting(true);
      const imported = await api.importCommit(file, payload);
      setResult(imported);
      setValidationIssues(imported.validationIssues);
      message.success("导入完成");
    } catch (error) {
      const issues = importIssuesFromError(error);
      if (issues.length) {
        setValidationIssues(issues);
        setIssuesOpen(true);
      } else {
        message.error(error instanceof Error ? error.message : "导入失败");
      }
    } finally {
      setImporting(false);
    }
  }

  const stats = validationStats;
  const hasBlockingIssues = validationIssues.some((issue) => issue.blocking);
  const hasIgnorableUncertainty = validationIssues.some(
    (issue) => issue.code === "coordinate_uncertainty",
  );

  if (!user) {
    return null;
  }

  return (
    <Layout className="import-workspace">
      <Layout.Header className="portal-header">
        <div className="header-left">
          <Button
            icon={<ArrowLeftOutlined style={{ fontSize: 16 }} />}
            onClick={() => navigate("/")}
          >
            返回入口
          </Button>
          <div className="brand-block">
            <FileExcelOutlined style={{ fontSize: 22 }} />
            <Typography.Title level={4}>
              {bootstrap.systemName} / 数据导入
            </Typography.Title>
          </div>
        </div>
        <div className="header-account-actions">
          <Button className="user-button">{user.displayName}</Button>
          <Button
            icon={<LogoutOutlined style={{ fontSize: 16 }} />}
            onClick={handleLogout}
          >
            退出
          </Button>
        </div>
      </Layout.Header>
      <main className="import-stage">
        <section className="import-main">
          <div className="import-upload-panel">
            <Upload.Dragger
              accept=".csv,.xls,.xlsx"
              disabled={previewing}
              beforeUpload={(selectedFile) => {
                setFile(selectedFile);
                setPreview(null);
                setResult(null);
                setIncludedColumns([]);
                setValidationIssues([]);
                setValidationStats(null);
                setHasValidated(false);
                setIgnoreCoordinateUncertainty(false);
                void handlePreview(selectedFile);
                return false;
              }}
              maxCount={1}
              showUploadList={false}
              onRemove={() => {
                setFile(null);
                setPreview(null);
                setResult(null);
                setIncludedColumns([]);
                setValidationIssues([]);
                setValidationStats(null);
                setHasValidated(false);
                setIgnoreCoordinateUncertainty(false);
              }}
            >
              <CloudUploadOutlined style={{ fontSize: 34 }} />
              <Typography.Title level={4}>
                选择 Excel 或 CSV 文件
              </Typography.Title>
              <Typography.Text type="secondary">
                Excel 只读取第一张表；所有字段按文本读取。
              </Typography.Text>
              <div className="import-selected-file">
                {previewing ? (
                  <Tag color="processing">正在预检文件...</Tag>
                ) : file ? (
                  <Tag color="green">{file.name}</Tag>
                ) : (
                  <Tag>尚未选择文件</Tag>
                )}
              </div>
            </Upload.Dragger>
          </div>

          {preview && (
            <Form
              form={form}
              layout="vertical"
              className="import-config-form"
              onValuesChange={(changed) => {
                if (
                  "importMode" in changed ||
                  "longitudeColumn" in changed ||
                  "latitudeColumn" in changed
                ) {
                  setValidationIssues([]);
                  setValidationStats(null);
                  setHasValidated(false);
                  setIgnoreCoordinateUncertainty(false);
                }
              }}
            >
              <Alert
                type="info"
                showIcon
                title="导入限制"
                description={
                  <ul className="import-limit-list">
                    {preview.limitations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                }
              />
              <div className="import-config-grid">
                <Form.Item
                  name="name"
                  label="数据名称"
                  rules={[{ required: true, message: "请输入数据名称" }]}
                >
                  <Input placeholder="例如：样地调查点位" />
                </Form.Item>
                <Form.Item
                  name="importMode"
                  label="导入类型"
                  rules={[{ required: true }]}
                >
                  <Radio.Group
                    optionType="button"
                    options={[
                      { label: "地理数据", value: "geographic" },
                      { label: "非地理数据", value: "table" },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="overwrite"
                  label="同名数据覆盖"
                  valuePropName="checked"
                >
                  <Switch checkedChildren="覆盖" unCheckedChildren="拒绝" />
                </Form.Item>
              </div>

              <Form.Item
                noStyle
                shouldUpdate={(prev, current) =>
                  prev.importMode !== current.importMode
                }
              >
                {({ getFieldValue }) =>
                  getFieldValue("importMode") === "geographic" ? (
                    <div className="import-coordinate-grid">
                      <Form.Item
                        name="longitudeColumn"
                        label="经度列"
                        rules={[{ required: true, message: "请选择经度列" }]}
                      >
                        <Select
                          options={columnOptions}
                          placeholder="选择经度列"
                          showSearch
                        />
                      </Form.Item>
                      <Form.Item
                        name="latitudeColumn"
                        label="纬度列"
                        rules={[{ required: true, message: "请选择纬度列" }]}
                      >
                        <Select
                          options={columnOptions}
                          placeholder="选择纬度列"
                          showSearch
                        />
                      </Form.Item>
                      <Space className="import-validation-actions">
                        <Button
                          icon={
                            <CheckCircleOutlined style={{ fontSize: 16 }} />
                          }
                          loading={validating}
                          onClick={handleValidate}
                        >
                          数据校验
                        </Button>
                        {hasValidated && validationIssues.length === 0 && (
                          <Tag color="green">校验通过</Tag>
                        )}
                        {hasValidated && validationIssues.length > 0 && (
                          <Tag color={hasBlockingIssues ? "red" : "gold"}>
                            {hasBlockingIssues
                              ? "存在阻断问题"
                              : "存在可忽略问题"}
                          </Tag>
                        )}
                      </Space>
                    </div>
                  ) : null
                }
              </Form.Item>

              {stats && (
                <Descriptions
                  size="small"
                  bordered
                  column={4}
                  className="import-stats"
                >
                  <Descriptions.Item label="总行数">
                    {stats.totalRows}
                  </Descriptions.Item>
                  <Descriptions.Item label="有效坐标">
                    {stats.validRows}
                  </Descriptions.Item>
                  <Descriptions.Item label="空或非法坐标">
                    {stats.missingRows}
                  </Descriptions.Item>
                  <Descriptions.Item label="量化误差范围">
                    {stats.quantizationErrorMeters.min ?? "-"} -{" "}
                    {stats.quantizationErrorMeters.max ?? "-"} 米
                  </Descriptions.Item>
                </Descriptions>
              )}

              {!preview.detected.isGeographic && (
                <Alert
                  type="warning"
                  showIcon
                  title="未自动识别经纬度列"
                  description="可以手动选择经度列和纬度列后按地理数据导入，也可以保留为非地理数据导入。"
                />
              )}

              <section className="import-section">
                <Typography.Title level={5}>字段元数据</Typography.Title>
                <Table
                  size="small"
                  rowKey="column"
                  pagination={false}
                  dataSource={preview.columns.map((column) => ({
                    column,
                    description: fieldMetadata[column] ?? "",
                    included: includedColumns.includes(column),
                  }))}
                  columns={[
                    {
                      title: "上传",
                      dataIndex: "included",
                      width: 88,
                      render: (_, record) => (
                        <Checkbox
                          checked={includedColumns.includes(record.column)}
                          onChange={(event) => {
                            setIncludedColumns((current) =>
                              event.target.checked
                                ? [...current, record.column]
                                : current.filter(
                                    (column) => column !== record.column,
                                  ),
                            );
                          }}
                        />
                      ),
                    },
                    { title: "字段", dataIndex: "column", width: 220 },
                    {
                      title: "描述",
                      dataIndex: "description",
                      render: (_, record) => (
                        <Input.TextArea
                          autoSize={{ minRows: 1, maxRows: 4 }}
                          placeholder="中文名称、单位、计算方式、数据来源等，可留空"
                          value={fieldMetadata[record.column] ?? ""}
                          onChange={(event) =>
                            setFieldMetadata((current) => ({
                              ...current,
                              [record.column]: event.target.value,
                            }))
                          }
                        />
                      ),
                    },
                  ]}
                />
              </section>

              <section className="import-section">
                <Typography.Title level={5}>数据预览</Typography.Title>
                <div className="import-preview-scroll">
                  <Table
                    size="small"
                    rowKey="previewRowKey"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                    dataSource={previewRows}
                    columns={previewColumns}
                  />
                </div>
              </section>

              <Space className="import-actions">
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined style={{ fontSize: 16 }} />}
                  loading={importing}
                  onClick={handleImport}
                >
                  提交导入
                </Button>
                {result && (
                  <Tag color="green">
                    已导入 {result.resourceName} · {result.importedRows} 行
                  </Tag>
                )}
              </Space>
            </Form>
          )}
        </section>
      </main>
      <Modal
        title="上传数据校验结果"
        open={issuesOpen}
        onCancel={() => setIssuesOpen(false)}
        cancelButtonProps={{ style: { display: "none" } }}
        okText={
          hasBlockingIssues
            ? ""
            : hasIgnorableUncertainty
              ? "忽略并继续导入"
              : ""
        }
        confirmLoading={importing}
        okButtonProps={{
          style:
            hasBlockingIssues || !hasIgnorableUncertainty
              ? { display: "none" }
              : undefined,
          disabled: hasIgnorableUncertainty && !ignoreCoordinateUncertainty,
        }}
        onOk={() => {
          if (hasBlockingIssues || !hasIgnorableUncertainty) {
            setIssuesOpen(false);
            return;
          }
          setIgnoreCoordinateUncertainty(true);
          setIssuesOpen(false);
          void submitImport(true);
        }}
      >
        <Alert
          type={hasBlockingIssues ? "error" : "warning"}
          showIcon
          title={
            hasBlockingIssues
              ? "检测到阻止上传的问题"
              : "检测到可确认忽略的问题"
          }
          description={
            hasBlockingIssues
              ? "请修正以下问题后重新预检或提交。"
              : "坐标不确定性差距可能影响空间分析精度，确认后可继续导入。"
          }
        />
        <Table
          className="import-issue-table"
          size="small"
          rowKey={(record) => `${record.code}-${record.message}`}
          pagination={false}
          dataSource={validationIssues}
          columns={[
            {
              title: "问题项",
              dataIndex: "message",
              render: (value, record) => (
                <Space orientation="vertical" size={2}>
                  <Typography.Text>{value}</Typography.Text>
                  <Space size={4} align="center">
                    <Tag color={record.blocking ? "red" : "gold"}>
                      {record.blocking ? "必须修正" : "可忽略"}
                    </Tag>
                    {record.code === "coordinate_uncertainty" && (
                      <Tooltip title="系统会根据经纬度小数位数估算坐标量化误差；该项表示最大误差与最小误差的比值过大，可能说明同一批数据的坐标精度不一致。">
                        <Button
                          type="text"
                          size="small"
                          icon={
                            <QuestionCircleOutlined style={{ fontSize: 14 }} />
                          }
                          aria-label="坐标不确定性差距说明"
                        />
                      </Tooltip>
                    )}
                  </Space>
                </Space>
              ),
            },
          ]}
        />
        {hasIgnorableUncertainty && !hasBlockingIssues && (
          <Checkbox
            checked={ignoreCoordinateUncertainty}
            onChange={(event) =>
              setIgnoreCoordinateUncertainty(event.target.checked)
            }
          >
            我已了解坐标不确定性差距，并继续导入
          </Checkbox>
        )}
      </Modal>
    </Layout>
  );
}

function shouldBlockImport(
  issues: ImportValidationIssue[],
  ignoreCoordinateUncertainty: boolean,
) {
  return issues.some(
    (issue) =>
      issue.blocking ||
      (issue.code === "coordinate_uncertainty" && !ignoreCoordinateUncertainty),
  );
}

function importIssuesFromError(error: unknown): ImportValidationIssue[] {
  if (!(error instanceof ApiError)) {
    return [];
  }
  const data = error.data as { issues?: ImportValidationIssue[] } | null;
  return Array.isArray(data?.issues) ? data.issues : [];
}
