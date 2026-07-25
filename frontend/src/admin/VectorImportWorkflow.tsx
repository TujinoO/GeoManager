import {
  CheckCircleOutlined,
  FileSearchOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App as AntApp,
  Button,
  Checkbox,
  Descriptions,
  Empty,
  Form,
  Input,
  Result,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../api/client";
import type {
  DataDomainType,
  DataSchemaSummary,
  ImportValidationIssue,
  VectorImportCommitResult,
  VectorImportPreview,
  VectorImportValidateResult,
} from "../types";

type DomainDefinition = DataSchemaSummary["domains"][number];

type AccessGroup = {
  id: number;
  name: string;
  isGuest?: boolean;
};

type VectorImportFormValues = {
  name: string;
  domainType: DataDomainType;
  categoryCode: string;
  sourceLayerName: string;
  tableName: string;
  encoding?: string;
  sourceCrs?: string;
  repairInvalidGeometries: boolean;
  skipInvalidGeometries: boolean;
  accessGroupIds: number[];
  duplicateConfirmed: boolean;
};

export default function VectorImportWorkflow({
  file,
  domainDefinitions,
  categoryOptions,
  availableAccessGroups,
  onReset,
  onCompleted,
}: {
  file: File;
  domainDefinitions: DomainDefinition[];
  categoryOptions: Array<{ value: string; label: string }>;
  availableAccessGroups: AccessGroup[];
  onReset: () => void;
  onCompleted: (result: VectorImportCommitResult) => void;
}) {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<VectorImportFormValues>();
  const [preview, setPreview] = useState<VectorImportPreview | null>(null);
  const [validation, setValidation] =
    useState<VectorImportValidateResult | null>(null);
  const [result, setResult] = useState<VectorImportCommitResult | null>(null);
  const [fieldMetadata, setFieldMetadata] = useState<Record<string, string>>(
    {},
  );
  const [previewing, setPreviewing] = useState(true);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const selectedLayerName = Form.useWatch("sourceLayerName", form);
  const selectedLayer = useMemo(
    () =>
      preview?.layers.find(
        (layer) => layer.sourceLayerName === selectedLayerName,
      ) ?? preview?.layers[0],
    [preview, selectedLayerName],
  );
  const blockingIssues =
    validation?.validationIssues.filter((issue) => issue.blocking) ?? [];

  useEffect(() => {
    let ignore = false;
    setPreviewing(true);
    api
      .previewVectorImport(file)
      .then((value) => {
        if (ignore) return;
        setPreview(value);
        const layer = value.layers[0];
        if (!layer) return;
        setFieldMetadata(
          Object.fromEntries(layer.fields.map((field) => [field.name, ""])),
        );
        form.setFieldsValue({
          name: layer.suggestedName,
          domainType: "vector",
          categoryCode: "base_geo_elements",
          sourceLayerName: layer.sourceLayerName,
          tableName: layer.suggestedTableName,
          encoding: layer.encoding ?? undefined,
          sourceCrs: undefined,
          repairInvalidGeometries: false,
          skipInvalidGeometries: false,
          accessGroupIds: [],
          duplicateConfirmed: false,
        });
      })
      .catch((error) => {
        if (!ignore) {
          setPreview(null);
          setValidation(null);
          form.setFields([
            {
              name: "sourceLayerName",
              errors: [error instanceof Error ? error.message : "矢量预检失败"],
            },
          ]);
          message.error(
            error instanceof Error ? error.message : "矢量预检失败",
          );
        }
      })
      .finally(() => {
        if (!ignore) setPreviewing(false);
      });
    return () => {
      ignore = true;
    };
  }, [file, form, message]);

  function handleLayerChange(sourceLayerName: string) {
    const layer = preview?.layers.find(
      (item) => item.sourceLayerName === sourceLayerName,
    );
    if (!layer) return;
    setValidation(null);
    setFieldMetadata(
      Object.fromEntries(layer.fields.map((field) => [field.name, ""])),
    );
    form.setFieldsValue({
      sourceLayerName,
      name: layer.suggestedName,
      tableName: layer.suggestedTableName,
      encoding: layer.encoding ?? undefined,
      sourceCrs: undefined,
      duplicateConfirmed: false,
    });
  }

  async function handleEncodingPreview() {
    const encoding = form.getFieldValue("encoding");
    setPreviewing(true);
    setValidation(null);
    try {
      const value = await api.previewVectorImport(file, encoding);
      setPreview(value);
      const preferred =
        value.layers.find(
          (layer) => layer.sourceLayerName === selectedLayerName,
        ) ?? value.layers[0];
      if (preferred) {
        setFieldMetadata(
          Object.fromEntries(preferred.fields.map((field) => [field.name, ""])),
        );
        form.setFieldsValue({
          sourceLayerName: preferred.sourceLayerName,
          name: preferred.suggestedName,
          tableName: preferred.suggestedTableName,
          encoding: preferred.encoding ?? encoding ?? undefined,
          sourceCrs: undefined,
          duplicateConfirmed: false,
        });
      }
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "按指定编码预检失败",
      );
    } finally {
      setPreviewing(false);
    }
  }

  async function handleValidate() {
    const values = await form.validateFields();
    setValidating(true);
    try {
      const value = await api.validateVectorImport(file, {
        name: values.name.trim(),
        sourceLayerName: values.sourceLayerName,
        tableName: values.tableName.trim(),
        encoding: values.encoding?.trim() || null,
        sourceCrs: values.sourceCrs?.trim() || null,
        repairInvalidGeometries: values.repairInvalidGeometries,
        skipInvalidGeometries: values.skipInvalidGeometries,
      });
      setValidation(value);
      form.setFieldValue("duplicateConfirmed", false);
      if (value.validationIssues.some((issue) => issue.blocking)) {
        message.warning("校验完成，仍存在阻断导入的问题");
      } else {
        message.success("矢量数据校验通过，可以提交导入");
      }
    } catch (error) {
      const issues = vectorIssuesFromError(error);
      if (issues.length && selectedLayer) {
        setValidation({
          layer: selectedLayer,
          validationIssues: issues,
          duplicateTarget: null,
        });
      }
      message.error(error instanceof Error ? error.message : "矢量校验失败");
    } finally {
      setValidating(false);
    }
  }

  async function handleCommit() {
    const values = await form.validateFields();
    if (!validation) {
      await handleValidate();
      return;
    }
    if (blockingIssues.length > 0) {
      return;
    }
    if (validation.duplicateTarget && !values.duplicateConfirmed) {
      form.setFields([
        {
          name: "duplicateConfirmed",
          errors: ["请确认创建同名数据资源"],
        },
      ]);
      return;
    }
    setImporting(true);
    try {
      const imported = await api.commitVectorImport(file, {
        name: values.name.trim(),
        domainType: values.domainType,
        categoryCode: values.categoryCode,
        sourceLayerName: values.sourceLayerName,
        tableName: values.tableName.trim(),
        encoding: values.encoding?.trim() || null,
        sourceCrs: values.sourceCrs?.trim() || null,
        repairInvalidGeometries: values.repairInvalidGeometries,
        skipInvalidGeometries: values.skipInvalidGeometries,
        duplicateConfirmed: values.duplicateConfirmed,
        accessGroupIds: values.accessGroupIds ?? [],
        fieldMetadata,
      });
      setResult(imported);
      onCompleted(imported);
      message.success("矢量数据导入完成");
    } catch (error) {
      const issues = vectorIssuesFromError(error);
      if (issues.length && selectedLayer) {
        setValidation({
          layer: selectedLayer,
          validationIssues: issues,
          duplicateTarget: validation?.duplicateTarget ?? null,
        });
      }
      message.error(error instanceof Error ? error.message : "矢量导入失败");
    } finally {
      setImporting(false);
    }
  }

  if (result) {
    return (
      <Result
        status="success"
        title="矢量数据导入完成"
        subTitle={`${result.resourceName} 已写入 GeoPackage，共导入 ${result.importedFeatures} 个要素，跳过 ${result.skippedFeatures} 个要素。`}
        extra={[
          <Button key="again" icon={<ReloadOutlined />} onClick={onReset}>
            继续导入
          </Button>,
          <Button key="map" type="primary" onClick={() => navigate("/map")}>
            进入地理数据界面
          </Button>,
        ]}
      />
    );
  }

  return (
    <div className="import-config-form">
      <Space className="import-actions import-actions-top">
        <Button onClick={onReset}>重新选择文件</Button>
        <Button
          icon={<FileSearchOutlined />}
          loading={validating}
          disabled={!preview || previewing}
          onClick={handleValidate}
        >
          校验矢量数据
        </Button>
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          loading={importing}
          disabled={!validation || blockingIssues.length > 0}
          onClick={handleCommit}
        >
          提交导入
        </Button>
      </Space>

      <Alert
        type="info"
        showIcon
        title="矢量文件将保留原始归档，并标准化写入统一 GeoPackage"
        description="Shapefile ZIP 会检查组件完整性和中文编码；所有可上图几何统一转换为 EPSG:4326，导入成功后自动创建数据资源和地图图层。"
      />

      {previewing && (
        <Alert type="info" showIcon title="正在解析矢量图层和几何质量…" />
      )}

      {preview && selectedLayer ? (
        <Form<VectorImportFormValues>
          form={form}
          layout="vertical"
          onValuesChange={(changed) => {
            if (!("duplicateConfirmed" in changed)) {
              setValidation(null);
            }
          }}
        >
          <section className="import-section">
            <Typography.Title level={5}>源文件与图层</Typography.Title>
            <Descriptions bordered size="small" column={3}>
              <Descriptions.Item label="文件名">
                {preview.sourceFileName}
              </Descriptions.Item>
              <Descriptions.Item label="源格式">
                {preview.sourceFormat}
              </Descriptions.Item>
              <Descriptions.Item label="图层数量">
                {preview.layers.length}
              </Descriptions.Item>
            </Descriptions>
            <Form.Item
              name="sourceLayerName"
              label="选择源图层"
              rules={[{ required: true, message: "请选择源图层" }]}
            >
              <Select
                options={preview.layers.map((layer) => ({
                  value: layer.sourceLayerName,
                  label: `${layer.sourceLayerName} · ${layer.geometryType} · ${layer.featureCount} 要素`,
                }))}
                onChange={handleLayerChange}
              />
            </Form.Item>
          </section>

          <section className="import-section">
            <Typography.Title level={5}>技术预检</Typography.Title>
            <Descriptions bordered size="small" column={4}>
              <Descriptions.Item label="几何类型">
                {selectedLayer.geometryType || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="要素数">
                {selectedLayer.featureCount}
              </Descriptions.Item>
              <Descriptions.Item label="顶点数">
                {selectedLayer.vertexCount}
              </Descriptions.Item>
              <Descriptions.Item label="坐标系">
                {selectedLayer.coordinateSystem ?? "未声明"}
              </Descriptions.Item>
              <Descriptions.Item label="有效几何">
                {selectedLayer.quality.validCount}
              </Descriptions.Item>
              <Descriptions.Item label="无效几何">
                {selectedLayer.quality.invalidCount}
              </Descriptions.Item>
              <Descriptions.Item label="空几何">
                {selectedLayer.quality.emptyCount}
              </Descriptions.Item>
              <Descriptions.Item label="null 几何">
                {selectedLayer.quality.nullCount}
              </Descriptions.Item>
            </Descriptions>
          </section>

          <section className="import-section">
            <Typography.Title level={5}>入库配置</Typography.Title>
            <div className="import-config-grid">
              <Form.Item
                name="name"
                label="数据资源名称"
                rules={[{ required: true, message: "请输入数据资源名称" }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="tableName"
                label="GeoPackage 图层标识"
                rules={[{ required: true, message: "请输入图层标识" }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="categoryCode"
                label="权威业务分类"
                rules={[{ required: true, message: "请选择权威业务分类" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={categoryOptions}
                />
              </Form.Item>
              <Form.Item
                name="domainType"
                label="兼容业务标签"
                rules={[{ required: true, message: "请选择业务数据类型" }]}
              >
                <Select
                  options={domainDefinitions.map((domain) => ({
                    value: domain.code,
                    label: domain.name,
                  }))}
                />
              </Form.Item>
              <Form.Item name="accessGroupIds" label="指定角色可见">
                <Select
                  mode="multiple"
                  options={availableAccessGroups.map((group) => ({
                    value: group.id,
                    label: group.name,
                  }))}
                />
              </Form.Item>
              <Form.Item name="encoding" label="Shapefile 属性编码">
                <Input placeholder="例如 GB18030；GeoJSON/GPKG 可留空" />
              </Form.Item>
              <Form.Item label="按当前编码重新预检">
                <Button loading={previewing} onClick={handleEncodingPreview}>
                  重新解析属性
                </Button>
              </Form.Item>
              <Form.Item
                name="sourceCrs"
                label="人工指定源坐标系"
                tooltip="仅在文件没有 .prj 或无法识别 CRS 时填写，例如 EPSG:4326"
              >
                <Input placeholder="例如 EPSG:4326" />
              </Form.Item>
            </div>
            <Space orientation="vertical">
              <Form.Item name="repairInvalidGeometries" valuePropName="checked">
                <Checkbox>尝试使用 make_valid 修复无效几何</Checkbox>
              </Form.Item>
              <Form.Item name="skipInvalidGeometries" valuePropName="checked">
                <Checkbox>跳过修复后仍无效、空或 null 的几何</Checkbox>
              </Form.Item>
            </Space>
          </section>

          <section className="import-section">
            <Typography.Title level={5}>字段说明与属性预览</Typography.Title>
            <Table
              size="small"
              pagination={false}
              rowKey="name"
              dataSource={selectedLayer.fields}
              columns={[
                { title: "字段", dataIndex: "name", key: "name" },
                { title: "类型", dataIndex: "type", key: "type" },
                {
                  title: "样例",
                  key: "samples",
                  render: (_, field) => field.sampleValues.join("、") || "-",
                },
                {
                  title: "中文说明",
                  key: "description",
                  render: (_, field) => (
                    <Input
                      value={fieldMetadata[field.name] ?? ""}
                      onChange={(event) =>
                        setFieldMetadata((current) => ({
                          ...current,
                          [field.name]: event.target.value,
                        }))
                      }
                    />
                  ),
                },
              ]}
            />
          </section>

          {validation && (
            <section className="import-section">
              <Typography.Title level={5}>校验结果</Typography.Title>
              {validation.validationIssues.length === 0 ? (
                <Alert type="success" showIcon title="矢量数据校验通过" />
              ) : (
                <Space orientation="vertical" style={{ width: "100%" }}>
                  {validation.validationIssues.map((issue) => (
                    <Alert
                      key={`${issue.code}-${issue.message}`}
                      type={issue.blocking ? "error" : "warning"}
                      showIcon
                      title={issue.message}
                      description={
                        <Tag color={issue.blocking ? "red" : "gold"}>
                          {issue.blocking ? "阻断导入" : "提示"}
                        </Tag>
                      }
                    />
                  ))}
                </Space>
              )}
              {validation.duplicateTarget && (
                <Alert
                  type="warning"
                  showIcon
                  title={validation.duplicateTarget.message}
                  description={
                    <Form.Item
                      name="duplicateConfirmed"
                      valuePropName="checked"
                      style={{ marginBottom: 0 }}
                    >
                      <Checkbox>确认新建同名资源，不覆盖已有数据</Checkbox>
                    </Form.Item>
                  }
                />
              )}
            </section>
          )}
        </Form>
      ) : previewing ? null : (
        <Empty description="未能解析矢量图层，请检查文件格式和 Shapefile 组件" />
      )}
    </div>
  );
}

export function vectorIssuesFromError(error: unknown): ImportValidationIssue[] {
  if (!(error instanceof ApiError)) return [];
  const data = error.data as { issues?: ImportValidationIssue[] } | null;
  return Array.isArray(data?.issues) ? data.issues : [];
}
