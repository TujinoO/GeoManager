import {
  CheckCircleOutlined,
  CloudUploadOutlined,
  FileImageOutlined,
} from "@ant-design/icons";
import { ProCard } from "@ant-design/pro-components";
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  Result,
  Select,
  Space,
  Tag,
  Typography,
  Upload,
  Radio,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type {
  AdminDataResourceAccessGroup,
  ResultArtifact,
  ResultArtifactCreatePayload,
  ResultArtifactSourceType,
  ResultArtifactType,
} from "../types";

type CategoryOption = { value: string; label: string };

interface ResultImportFormValues {
  name: string;
  description?: string;
  sourceType: ResultArtifactSourceType;
  resultType: ResultArtifactType;
  categoryCode: string;
  provider?: string;
  accessGroupIds: number[];
}

interface ResultImportWorkflowProps {
  categoryOptions: CategoryOption[];
  accessGroups: AdminDataResourceAccessGroup[];
  uploadMaxMb: number;
  onDirtyChange?: (dirty: boolean) => void;
}

export default function ResultImportWorkflow({
  categoryOptions,
  accessGroups,
  uploadMaxMb,
  onDirtyChange,
}: ResultImportWorkflowProps) {
  const { message } = App.useApp();
  const { i18n } = useTranslation();
  const english =
    i18n.resolvedLanguage?.toLowerCase().startsWith("en") ?? false;
  const l = (zh: string, en: string) => (english ? en : zh);
  const resultTypeOptions: Array<{ value: ResultArtifactType; label: string }> =
    [
      { value: "map", label: l("地图", "Map") },
      { value: "chart", label: l("图表", "Chart") },
      { value: "report", label: l("报告", "Report") },
      { value: "table", label: l("表格", "Table") },
      { value: "image", label: l("图片", "Image") },
      { value: "other", label: l("其他", "Other") },
    ];
  const navigate = useNavigate();
  const [form] = Form.useForm<ResultImportFormValues>();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<ResultArtifact | null>(null);
  const [nongeoReport, setNongeoReport] = useState(false);
  const selectedGroupIds = Form.useWatch("accessGroupIds", form) ?? [];
  const hasGuestAudience = useMemo(
    () =>
      accessGroups.some(
        (group) => group.isGuest && selectedGroupIds.includes(group.id),
      ),
    [accessGroups, selectedGroupIds],
  );

  useEffect(() => {
    onDirtyChange?.(Boolean(file && !created));
    return () => onDirtyChange?.(false);
  }, [created, file, onDirtyChange]);

  function selectFile(selected: File) {
    const extension = extensionOf(selected.name);
    if (nongeoReport && extension !== "pdf") {
      message.error("非地理分析报告请选择PDF文件");
      return false;
    }
    if (!["png", "jpg", "jpeg", "pdf", "csv", "xlsx"].includes(extension)) {
      message.error(
        l(
          "成果文件仅支持 PNG、JPG、PDF、CSV 或 XLSX",
          "Result files must be PNG, JPG, PDF, CSV, or XLSX",
        ),
      );
      return false;
    }
    if (selected.size > uploadMaxMb * 1024 * 1024) {
      message.error(
        l(
          `成果文件不能超过 ${uploadMaxMb} MB`,
          `Result files must not exceed ${uploadMaxMb} MB`,
        ),
      );
      return false;
    }
    const inferredType = inferResultType(extension);
    setCreated(null);
    setFile(selected);
    form.setFieldsValue({
      name: fileStem(selected.name),
      resultType: inferredType,
    });
    return false;
  }

  function reset() {
    setFile(null);
    setCreated(null);
    form.resetFields();
  }

  async function submit() {
    if (!file) {
      message.warning(l("请先选择成果文件", "Select a result file first"));
      return;
    }
    try {
      const values = await form.validateFields();
      const payload: ResultArtifactCreatePayload = {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        sourceType: values.sourceType,
        resultType: values.resultType,
        categoryCode: values.categoryCode,
        provider: values.provider?.trim() || undefined,
        accessGroupIds: values.accessGroupIds ?? [],
        ...(nongeoReport
          ? { reportKind: "nongeo" as const, publish: false }
          : {}),
      };
      setSubmitting(true);
      const result = await api.createResultArtifact(file, payload);
      setCreated(result);
      message.success(
        nongeoReport
          ? "报告草稿已导入"
          : l("成果已导入并发布", "Result imported and published"),
      );
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : l("成果导入失败", "Failed to import result"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <ProCard className="admin-section-card result-import-success-card">
        <Result
          status="success"
          title={
            nongeoReport
              ? created.status === "in_review"
                ? "报告已提交审核"
                : "报告草稿已导入"
              : l("成果已导入并发布", "Result imported and published")
          }
          subTitle={
            nongeoReport
              ? "草稿可预览与下载；审核发布后才进入成果展示。"
              : l(
                  `${created.name} 已作为${sourceTypeLabel(created.sourceType, false)}正式发布，具备访问角色和成果查看权限的用户可在成果展示页查看。`,
                  `${created.name} has been published as ${sourceTypeLabel(created.sourceType, true)}. Users in an allowed role with result-view permission can now find it in Results.`,
                )
          }
          extra={[
            ...(nongeoReport && created.status === "draft"
              ? [
                  <Button
                    key="review"
                    type="primary"
                    loading={submitting}
                    onClick={async () => {
                      setSubmitting(true);
                      try {
                        const result = await api.updateResultArtifact(
                          created.id,
                          { action: "submit_review" },
                        );
                        if ("status" in result) setCreated(result);
                        message.success("已提交审核");
                      } catch (error) {
                        message.error(
                          error instanceof Error ? error.message : "提交失败",
                        );
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  >
                    提交审核
                  </Button>,
                ]
              : []),
            ...(nongeoReport
              ? [
                  <Button
                    key="preview"
                    href={created.previewUrl}
                    target="_blank"
                  >
                    预览PDF
                  </Button>,
                ]
              : []),
            <Button
              type="primary"
              key="results"
              onClick={() => navigate("/results")}
            >
              {l("前往成果展示", "Open Results")}
            </Button>,
            <Button key="again" onClick={reset}>
              {l("继续导入成果", "Import another result")}
            </Button>,
          ]}
        />
      </ProCard>
    );
  }

  return (
    <ProCard className="admin-section-card result-import-card">
      <div className="result-import-heading">
        <div>
          <Tag color="green">
            {l("成果文件登记", "Result file registration")}
          </Tag>
          <Typography.Title level={3}>
            {l("导入成果", "Import results")}
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            {l(
              "适用于平台分析产物或外部制作完成的地图、图表、报告和表格，不进入数据资源存储与分析流程。",
              "Use this for platform analysis outputs or completed external maps, charts, reports, and tables. These files do not enter the data-resource storage and analysis workflow.",
            )}
          </Typography.Paragraph>
        </div>
        <FileImageOutlined />
      </div>

      <Alert
        showIcon
        type="info"
        title={l(
          "选择成果类型并确认发布流程",
          "Result registration does not change data-import capabilities",
        )}
        description={
          nongeoReport
            ? "PDF先保存为草稿，再提交审核；审核发布后在成果展示中可见。"
            : l(
                "图件等成果沿用直接发布流程；操作账号需具备成果查看、导入和发布权限。非地理分析报告请切换下方选项。",
                "Imported results are published immediately instead of creating non-actionable drafts. The account needs result view, import, and publish permissions; historical drafts can be published or deleted in Result Management.",
              )
        }
      />
      <Radio.Group
        style={{ margin: "20px 0" }}
        optionType="button"
        buttonStyle="solid"
        value={nongeoReport}
        onChange={(event) => {
          setNongeoReport(event.target.value);
          setFile(null);
          form.setFieldsValue({
            resultType: event.target.value ? "report" : "other",
          });
        }}
        options={[
          { value: false, label: "图件等成果" },
          { value: true, label: "非地理分析报告（PDF）" },
        ]}
      />

      <Form<ResultImportFormValues>
        form={form}
        layout="vertical"
        initialValues={{
          sourceType: "direct_import",
          resultType: "other",
          accessGroupIds: [],
        }}
        className="result-import-form"
      >
        <Upload.Dragger
          accept={nongeoReport ? ".pdf" : ".png,.jpg,.jpeg,.pdf,.csv,.xlsx"}
          beforeUpload={selectFile}
          maxCount={1}
          showUploadList={false}
        >
          <CloudUploadOutlined style={{ fontSize: 34 }} />
          <Typography.Title level={4}>
            {l("选择或拖拽成果文件", "Select or drop a result file")}
          </Typography.Title>
          <Typography.Text type="secondary">
            {l(
              `支持 PNG、JPG、PDF、CSV、XLSX，单个文件不超过 ${uploadMaxMb} MB`,
              `PNG, JPG, PDF, CSV, and XLSX are supported. Maximum file size: ${uploadMaxMb} MB.`,
            )}
          </Typography.Text>
          <div className="import-selected-file">
            {file ? (
              <Tag color="green">{file.name}</Tag>
            ) : (
              <Tag>{l("尚未选择文件", "No file selected")}</Tag>
            )}
          </div>
        </Upload.Dragger>

        <div className="result-import-grid">
          <Form.Item
            name="name"
            label={l("成果名称", "Result name")}
            rules={[
              {
                required: true,
                whitespace: true,
                message: l("请输入成果名称", "Enter a result name"),
              },
              {
                max: 160,
                message: l(
                  "成果名称不能超过 160 个字符",
                  "Result name must not exceed 160 characters",
                ),
              },
            ]}
          >
            <Input
              placeholder={l(
                "例如：2025 年塔里木河胡杨分布变化分析",
                "Example: 2025 Tarim River poplar distribution change analysis",
              )}
            />
          </Form.Item>
          <Form.Item name="provider" label={l("提供单位", "Provider")}>
            <Input
              placeholder={l("例如：塔里木大学", "Example: Tarim University")}
              maxLength={200}
            />
          </Form.Item>
          <Form.Item
            name="sourceType"
            label={l("成果来源", "Result source")}
            rules={[{ required: true }]}
          >
            <Select
              options={[
                {
                  value: "direct_import",
                  label: l("直接导入成果", "Direct import"),
                },
                {
                  value: "analysis",
                  label: l("平台分析成果", "Platform analysis"),
                },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="resultType"
            label={l("成果类型", "Result type")}
            rules={[{ required: true }]}
          >
            <Select
              options={
                nongeoReport
                  ? [{ value: "report", label: "非地理分析报告" }]
                  : resultTypeOptions
              }
            />
          </Form.Item>
          <Form.Item
            name="categoryCode"
            label={l("权威业务分类", "Authoritative category")}
            rules={[
              {
                required: true,
                message: l(
                  "请选择权威业务分类",
                  "Select an authoritative category",
                ),
              },
            ]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={l(
                "选择四大类下的具体叶节点",
                "Select a leaf category under one of the four domains",
              )}
              options={categoryOptions}
            />
          </Form.Item>
          <Form.Item
            name="accessGroupIds"
            label={l("发布可访问角色", "Roles allowed to access")}
            rules={[
              {
                required: !nongeoReport,
                type: "array",
                min: nongeoReport ? 0 : 1,
                message: l(
                  "请至少选择一个成果访问角色",
                  "Select at least one role",
                ),
              },
            ]}
          >
            <Select
              mode="multiple"
              placeholder={l(
                "选择成果发布范围",
                "Select the publication audience",
              )}
              options={accessGroups.map((group) => ({
                value: group.id,
                label: group.name,
              }))}
            />
          </Form.Item>
        </div>

        <Form.Item
          name="description"
          label={l("成果摘要与适用范围", "Summary and intended use")}
        >
          <Input.TextArea
            rows={4}
            maxLength={4000}
            showCount
            placeholder={l(
              "说明成果内容、数据时段、空间范围、分析方法或使用限制",
              "Describe the content, time period, spatial scope, analysis method, or use restrictions",
            )}
          />
        </Form.Item>

        <Alert
          showIcon
          type="success"
          title={
            nongeoReport
              ? "导入后保存为草稿"
              : l("导入完成后直接发布", "Published immediately after import")
          }
          description={
            nongeoReport
              ? "访问范围由审核发布时确定，当前不会公开展示。"
              : l(
                  "成果将立即进入成果展示页，实际可见范围由所选角色和成果查看权限共同决定。",
                  "The result appears in Results immediately. Its actual audience is determined by both the selected roles and result-view permission.",
                )
          }
        />

        {hasGuestAudience && (
          <Alert
            showIcon
            type="warning"
            title={l(
              "当前发布范围包含游客",
              "The publication audience includes guests",
            )}
            description={l(
              "登录为游客的访问者将能够在线查看该成果；是否允许下载仍由独立的成果下载权限控制。",
              "Guest users will be able to view this result online. Download access remains controlled by the separate result-download permission.",
            )}
          />
        )}

        <Space className="import-actions result-import-actions" wrap>
          <Button onClick={reset} disabled={!file}>
            {l("重新选择", "Choose another file")}
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={submitting}
            onClick={() => void submit()}
          >
            {nongeoReport
              ? "导入报告草稿"
              : l("导入并发布成果", "Import and publish")}
          </Button>
        </Space>
      </Form>
    </ProCard>
  );
}

function extensionOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function fileStem(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function inferResultType(extension: string): ResultArtifactType {
  if (["png", "jpg", "jpeg"].includes(extension)) return "image";
  if (extension === "pdf") return "report";
  if (["csv", "xlsx"].includes(extension)) return "table";
  return "other";
}

function sourceTypeLabel(
  sourceType: ResultArtifactSourceType,
  english: boolean,
) {
  if (sourceType === "analysis")
    return english ? "a platform analysis result" : "平台分析成果";
  return english ? "a directly imported result" : "直接导入成果";
}
