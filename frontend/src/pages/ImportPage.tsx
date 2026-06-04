import {
  Alert,
  App as AntApp,
  Button,
  Descriptions,
  Form,
  Input,
  Layout,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import {
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  LogOut,
  UploadCloud,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";
import type {
  ImportCommitPayload,
  ImportCommitResult,
  ImportPreview,
} from "../types";

interface ImportFormValues {
  name: string;
  tableName: string;
  importMode: "geographic" | "table";
  longitudeColumn?: string;
  latitudeColumn?: string;
  missingCoordinatePolicy: "cancel" | "ignore" | "force";
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
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportCommitResult | null>(null);

  const columnOptions = useMemo(
    () =>
      preview?.columns.map((column) => ({ label: column, value: column })) ??
      [],
    [preview],
  );

  const previewColumns = useMemo(
    () =>
      preview?.columns.slice(0, 10).map((column) => ({
        title: column,
        dataIndex: column,
        key: column,
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

  async function handlePreview() {
    if (!file) {
      message.warning("请先选择 Excel 或 CSV 文件");
      return;
    }
    setPreviewing(true);
    setResult(null);
    try {
      const data = await api.importPreview(file);
      setPreview(data);
      setFieldMetadata(
        Object.fromEntries(data.columns.map((column) => [column, ""])),
      );
      form.setFieldsValue({
        name: data.suggestedName,
        tableName: data.suggestedTableName,
        importMode: data.detected.isGeographic ? "geographic" : "table",
        longitudeColumn: data.detected.longitudeColumn ?? undefined,
        latitudeColumn: data.detected.latitudeColumn ?? undefined,
        missingCoordinatePolicy: "cancel",
        overwrite: false,
      });
      message.success("预检完成");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "预检失败");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport() {
    if (!file || !preview) {
      message.warning("请先完成文件预检");
      return;
    }
    try {
      const values = await form.validateFields();
      const payload: ImportCommitPayload = {
        ...values,
        overwrite: Boolean(values.overwrite),
        fieldMetadata,
      };
      setImporting(true);
      const imported = await api.importCommit(file, payload);
      setResult(imported);
      message.success("导入完成");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导入失败");
    } finally {
      setImporting(false);
    }
  }

  const stats = preview?.detected.coordinateStats;

  if (!user) {
    return null;
  }

  return (
    <Layout className="import-workspace">
      <Layout.Header className="portal-header">
        <div className="header-left">
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate("/")}>
            返回入口
          </Button>
          <div className="brand-block">
            <FileSpreadsheet size={22} />
            <Typography.Title level={4}>
              {bootstrap.systemName} / 数据导入
            </Typography.Title>
          </div>
        </div>
        <div className="header-account-actions">
          <Button className="user-button">{user.displayName}</Button>
          <Button icon={<LogOut size={16} />} onClick={handleLogout}>
            退出
          </Button>
        </div>
      </Layout.Header>
      <main className="import-stage">
        <section className="import-main">
          <div className="import-upload-panel">
            <Upload.Dragger
              accept=".csv,.xls,.xlsx"
              beforeUpload={(selectedFile) => {
                setFile(selectedFile);
                setPreview(null);
                setResult(null);
                return false;
              }}
              maxCount={1}
              onRemove={() => {
                setFile(null);
                setPreview(null);
                setResult(null);
              }}
            >
              <UploadCloud size={34} />
              <Typography.Title level={4}>
                选择 Excel 或 CSV 文件
              </Typography.Title>
              <Typography.Text type="secondary">
                Excel 只读取第一张表；所有字段按文本读取。
              </Typography.Text>
            </Upload.Dragger>
            <Button
              type="primary"
              icon={<FileSpreadsheet size={16} />}
              loading={previewing}
              onClick={handlePreview}
            >
              预检文件
            </Button>
          </div>

          {preview && (
            <Form form={form} layout="vertical" className="import-config-form">
              <Alert
                type="info"
                showIcon
                title="导入限制"
                description={preview.limitations.join("；")}
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
                  name="tableName"
                  label="入库表名"
                  rules={[
                    { required: true, message: "请输入入库表名" },
                    {
                      pattern: /^[A-Za-z_][A-Za-z0-9_]{0,62}$/,
                      message:
                        "仅支持英文字母、数字和下划线，且必须以字母或下划线开头",
                    },
                  ]}
                >
                  <Input placeholder="例如：survey_points_2026" />
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
                  label="同名覆盖"
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
                      <Form.Item
                        name="missingCoordinatePolicy"
                        label="空坐标处理"
                        rules={[{ required: true }]}
                      >
                        <Radio.Group
                          options={[
                            { label: "取消导入", value: "cancel" },
                            { label: "忽略空坐标行", value: "ignore" },
                            { label: "强行导入", value: "force" },
                          ]}
                        />
                      </Form.Item>
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
                  }))}
                  columns={[
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
                <Table
                  size="small"
                  rowKey="previewRowKey"
                  pagination={false}
                  scroll={{ x: true }}
                  dataSource={previewRows}
                  columns={previewColumns}
                />
              </section>

              <Space className="import-actions">
                <Button
                  type="primary"
                  icon={<CheckCircle2 size={16} />}
                  loading={importing}
                  onClick={handleImport}
                >
                  提交导入
                </Button>
                {result && (
                  <Tag color="green">
                    已导入 {result.importedRows} 行
                    {result.skippedRows
                      ? `，忽略 ${result.skippedRows} 行`
                      : ""}
                  </Tag>
                )}
              </Space>
            </Form>
          )}
        </section>
      </main>
    </Layout>
  );
}
