import {
  CheckCircleOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { ProCard } from "@ant-design/pro-components";
import {
  Alert,
  App as AntApp,
  Button,
  Checkbox,
  Descriptions,
  Form,
  Input,
  Modal,
  Radio,
  Result,
  Select,
  Space,
  Steps,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { ApiError, api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";
import type {
  ImportCommitPayload,
  ImportCommitResult,
  ImportCoordinateStats,
  ImportDuplicateTarget,
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

type IssueAction = "continue" | "import";

export default function AdminDataImportPage() {
  const { message } = AntApp.useApp();
  const { user } = useAppContext();
  const [form] = Form.useForm<ImportFormValues>();
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fieldMetadata, setFieldMetadata] = useState<Record<string, string>>(
    {},
  );
  const [includedColumns, setIncludedColumns] = useState<string[]>([]);
  const [importConfig, setImportConfig] = useState<Partial<ImportFormValues>>(
    {},
  );
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [validationIssues, setValidationIssues] = useState<
    ImportValidationIssue[]
  >([]);
  const [duplicateTarget, setDuplicateTarget] =
    useState<ImportDuplicateTarget | null>(null);
  const [validationStats, setValidationStats] =
    useState<ImportCoordinateStats | null>(null);
  const [validating, setValidating] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [pendingIssueAction, setPendingIssueAction] =
    useState<IssueAction | null>(null);
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

  const stats = validationStats;
  const hasBlockingIssues = validationIssues.some((issue) => issue.blocking);
  const hasIgnorableUncertainty = validationIssues.some(
    (issue) => issue.code === "coordinate_uncertainty",
  );

  if (!user?.permissions.canMaintainData && !user?.permissions.canUploadData) {
    return <Navigate to="/admin/profile" replace />;
  }

  function resetImportState() {
    setFile(null);
    setPreview(null);
    setFieldMetadata({});
    setIncludedColumns([]);
    setValidationIssues([]);
    setDuplicateTarget(null);
    setValidationStats(null);
    setHasValidated(false);
    setIgnoreCoordinateUncertainty(false);
    setPendingIssueAction(null);
    setIssuesOpen(false);
    setResult(null);
    setImportConfig({});
    setCurrentStep(0);
    form.resetFields();
  }

  async function handlePreview(selectedFile: File) {
    setFile(selectedFile);
    setPreviewing(true);
    setResult(null);
    setValidationIssues([]);
    setValidationStats(null);
    setHasValidated(false);
    setIgnoreCoordinateUncertainty(false);
    try {
      const data = await api.importPreview(selectedFile);
      setPreview(data);
      setDuplicateTarget(data.duplicateTarget ?? null);
      setFieldMetadata(
        Object.fromEntries(data.columns.map((column) => [column, ""])),
      );
      setIncludedColumns(data.columns);
      const nextConfig: ImportFormValues = {
        name: data.suggestedName,
        importMode: data.detected.isGeographic ? "geographic" : "table",
        longitudeColumn: data.detected.longitudeColumn ?? undefined,
        latitudeColumn: data.detected.latitudeColumn ?? undefined,
        overwrite: false,
      };
      setImportConfig(nextConfig);
      form.setFieldsValue({
        ...nextConfig,
      });
      setCurrentStep(1);
      message.success("文件预检完成，请配置导入信息");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "预检失败");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleValidateAndContinue() {
    if (!file || !preview) {
      message.warning("请先选择并预检文件");
      return;
    }
    try {
      const values = await form.validateFields();
      setImportConfig((current) => ({ ...current, ...values }));
      const payload: ImportValidatePayload = {
        importMode: values.importMode,
        tableName: preview.suggestedTableName,
        longitudeColumn: values.longitudeColumn,
        latitudeColumn: values.latitudeColumn,
      };
      setValidating(true);
      const validated = await api.importValidate(file, payload);
      setValidationStats(validated.coordinateStats);
      setValidationIssues(validated.validationIssues);
      setDuplicateTarget(validated.duplicateTarget ?? null);
      setHasValidated(true);
      setIgnoreCoordinateUncertainty(false);
      if (validated.duplicateTarget && !values.overwrite) {
        message.warning(validated.duplicateTarget.message);
        return;
      }
      if (validated.validationIssues.length) {
        setPendingIssueAction("continue");
        setIssuesOpen(true);
        return;
      }
      message.success("数据校验通过");
      setCurrentStep(2);
    } catch (error) {
      const issues = importIssuesFromError(error);
      if (issues.length) {
        setValidationIssues(issues);
        setPendingIssueAction("continue");
        setIssuesOpen(true);
      } else {
        message.error(error instanceof Error ? error.message : "数据校验失败");
      }
    } finally {
      setValidating(false);
    }
  }

  async function handleImport() {
    await submitImport(ignoreCoordinateUncertainty);
  }

  async function submitImport(ignoreUncertainty: boolean) {
    if (!file || !preview) {
      message.warning("请先选择并预检文件");
      return;
    }
    try {
      if (!hasValidated) {
        message.warning("请先进行数据校验");
        setCurrentStep(1);
        return;
      }
      if (shouldBlockImport(validationIssues, ignoreUncertainty)) {
        setPendingIssueAction("import");
        setIssuesOpen(true);
        return;
      }
      const values = normalizeImportValues({
        ...importConfig,
        ...form.getFieldsValue(true),
      });
      if (!values.name) {
        message.warning("请输入数据名称");
        setCurrentStep(1);
        return;
      }
      if (!values.importMode) {
        message.warning("请选择导入类型");
        setCurrentStep(1);
        return;
      }
      if (duplicateTarget && !values.overwrite) {
        message.warning(duplicateTarget.message);
        setCurrentStep(1);
        return;
      }
      const selectedMetadata = Object.fromEntries(
        includedColumns.map((column) => [column, fieldMetadata[column] ?? ""]),
      );
      const payload: ImportCommitPayload = {
        name: values.name,
        importMode: values.importMode,
        longitudeColumn: values.longitudeColumn,
        latitudeColumn: values.latitudeColumn,
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
        setPendingIssueAction("import");
        setIssuesOpen(true);
      } else {
        message.error(error instanceof Error ? error.message : "导入失败");
      }
    } finally {
      setImporting(false);
    }
  }

  function handleIssueConfirm() {
    if (hasBlockingIssues || !hasIgnorableUncertainty) {
      setIssuesOpen(false);
      return;
    }
    setIgnoreCoordinateUncertainty(true);
    setIssuesOpen(false);
    if (pendingIssueAction === "continue") {
      setCurrentStep(2);
      return;
    }
    void submitImport(true);
  }

  return (
    <div className="admin-page-stack admin-import-page">
      <ProCard className="admin-section-card">
        <Steps
          current={currentStep}
          items={[
            { title: "选择文件", icon: <CloudUploadOutlined /> },
            { title: "导入配置", icon: <DatabaseOutlined /> },
            { title: "预览提交", icon: <CheckCircleOutlined /> },
          ]}
        />
      </ProCard>

      <ProCard className="admin-section-card">
        <Form
          form={form}
          layout="vertical"
          component={false}
          onValuesChange={(changed) => {
            setImportConfig((current) => ({ ...current, ...changed }));
            if (
              "importMode" in changed ||
              "longitudeColumn" in changed ||
              "latitudeColumn" in changed ||
              "overwrite" in changed
            ) {
              setValidationIssues([]);
              setValidationStats(null);
              setHasValidated(false);
              setIgnoreCoordinateUncertainty(false);
              if ("importMode" in changed) {
                setDuplicateTarget(null);
              }
            }
          }}
        >
          {currentStep === 0 && (
            <section className="import-step-pane">
              <Upload.Dragger
                accept=".csv,.xls,.xlsx"
                disabled={previewing}
                beforeUpload={(selectedFile) => {
                  void handlePreview(selectedFile);
                  return false;
                }}
                maxCount={1}
                showUploadList={false}
              >
                <CloudUploadOutlined style={{ fontSize: 34 }} />
                <Typography.Title level={4}>
                  选择 Excel 或 CSV 文件
                </Typography.Title>
                <Typography.Text type="secondary">
                  选择文件后自动预检，并进入导入配置步骤。
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
            </section>
          )}

          {currentStep === 1 && preview && (
            <div className="import-config-form">
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
                  rules={[{ required: true, message: "请选择导入类型" }]}
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

              {duplicateTarget && (
                <DuplicateTargetAlert
                  target={duplicateTarget}
                  overwrite={Boolean(importConfig.overwrite)}
                />
              )}

              <Space className="import-actions">
                <Button onClick={resetImportState}>重新选择文件</Button>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined style={{ fontSize: 16 }} />}
                  loading={validating}
                  onClick={handleValidateAndContinue}
                >
                  数据校验并继续
                </Button>
              </Space>
            </div>
          )}

          {currentStep === 2 && preview && (
            <section className="import-step-pane">
              {result ? (
                <Result
                  status="success"
                  title="数据导入完成"
                  subTitle={`已导入 ${result.resourceName}，共 ${result.importedRows} 行。`}
                  extra={[
                    <Button
                      key="again"
                      type="primary"
                      icon={<ReloadOutlined />}
                      onClick={resetImportState}
                    >
                      继续导入
                    </Button>,
                  ]}
                />
              ) : (
                <>
                  <section className="import-section">
                    <Typography.Title level={5}>数据预览</Typography.Title>
                    {duplicateTarget && (
                      <DuplicateTargetAlert
                        target={duplicateTarget}
                        overwrite={Boolean(importConfig.overwrite)}
                      />
                    )}
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
                          width: 64,
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
                        { title: "字段", dataIndex: "column", width: 150 },
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

                  <Space className="import-actions">
                    <Button onClick={() => setCurrentStep(1)}>上一步</Button>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined style={{ fontSize: 16 }} />}
                      loading={importing}
                      onClick={handleImport}
                    >
                      提交导入
                    </Button>
                  </Space>
                </>
              )}
            </section>
          )}
        </Form>
      </ProCard>

      <Modal
        title="上传数据校验结果"
        open={issuesOpen}
        onCancel={() => setIssuesOpen(false)}
        cancelButtonProps={{ style: { display: "none" } }}
        okText={
          hasBlockingIssues
            ? ""
            : hasIgnorableUncertainty
              ? pendingIssueAction === "continue"
                ? "忽略并进入预览"
                : "忽略并继续导入"
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
        onOk={handleIssueConfirm}
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
              : "坐标不确定性差距可能影响空间分析精度，确认后可继续。"
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
            我已了解坐标不确定性差距，并继续
          </Checkbox>
        )}
      </Modal>
    </div>
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

function DuplicateTargetAlert({
  target,
  overwrite,
}: {
  target: ImportDuplicateTarget;
  overwrite: boolean;
}) {
  return (
    <Alert
      type={overwrite ? "warning" : "error"}
      showIcon
      title={overwrite ? "检测到重复目标，将覆盖写入" : "检测到重复目标"}
      description={
        <Space orientation="vertical" size={4}>
          <Typography.Text>{target.message}</Typography.Text>
          <Typography.Text type="secondary">
            {target.targetType === "geopackage_layer"
              ? "GeoPackage 图层"
              : "SQLite 表"}
            ：{target.targetName}
          </Typography.Text>
        </Space>
      }
    />
  );
}

function normalizeImportValues(
  values: Partial<ImportFormValues>,
): Partial<ImportFormValues> {
  const name = values.name?.trim();
  const importMode = values.importMode;
  return {
    name,
    importMode,
    longitudeColumn: values.longitudeColumn || undefined,
    latitudeColumn: values.latitudeColumn || undefined,
    overwrite: Boolean(values.overwrite),
  };
}

function importIssuesFromError(error: unknown): ImportValidationIssue[] {
  if (!(error instanceof ApiError)) {
    return [];
  }
  const data = error.data as { issues?: ImportValidationIssue[] } | null;
  return Array.isArray(data?.issues) ? data.issues : [];
}
