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
} from "antd";
import { useEffect, useMemo, useState } from "react";
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

const resultTypeOptions: Array<{
  value: ResultArtifactType;
  label: string;
}> = [
  { value: "map", label: "地图" },
  { value: "chart", label: "图表" },
  { value: "report", label: "报告" },
  { value: "table", label: "表格" },
  { value: "image", label: "图片" },
  { value: "other", label: "其他" },
];

export default function ResultImportWorkflow({
  categoryOptions,
  accessGroups,
  uploadMaxMb,
  onDirtyChange,
}: ResultImportWorkflowProps) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<ResultImportFormValues>();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<ResultArtifact | null>(null);
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
    if (!["png", "jpg", "jpeg", "pdf", "csv", "xlsx"].includes(extension)) {
      message.error("成果文件仅支持 PNG、JPG、PDF、CSV 或 XLSX");
      return false;
    }
    if (selected.size > uploadMaxMb * 1024 * 1024) {
      message.error(`成果文件不能超过 ${uploadMaxMb} MB`);
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
      message.warning("请先选择成果文件");
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
      };
      setSubmitting(true);
      const result = await api.createResultArtifact(file, payload);
      setCreated(result);
      message.success("成果已导入并发布");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "成果导入失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <ProCard className="admin-section-card result-import-success-card">
        <Result
          status="success"
          title="成果已导入并发布"
          subTitle={`${created.name} 已作为${sourceTypeLabel(created.sourceType)}正式发布，具备访问角色和成果查看权限的用户可在成果展示页查看。`}
          extra={[
            <Button
              type="primary"
              key="results"
              onClick={() => navigate("/results")}
            >
              前往成果展示
            </Button>,
            <Button key="again" onClick={reset}>
              继续导入成果
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
          <Tag color="green">成果文件登记</Tag>
          <Typography.Title level={3}>导入并加载发布为成果</Typography.Title>
          <Typography.Paragraph type="secondary">
            适用于平台分析产物或外部制作完成的地图、图表、报告和表格，不进入数据资源存储与分析流程。
          </Typography.Paragraph>
        </div>
        <FileImageOutlined />
      </div>

      <Alert
        showIcon
        type="info"
        title="成果登记不会修改已有数据导入能力"
        description="导入成果必须直接发布，不再产生无法流转的导入草稿。操作账号需同时具备成果查看、导入和发布权限；历史草稿可在成果管理中发布或删除。"
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
          accept=".png,.jpg,.jpeg,.pdf,.csv,.xlsx"
          beforeUpload={selectFile}
          maxCount={1}
          showUploadList={false}
        >
          <CloudUploadOutlined style={{ fontSize: 34 }} />
          <Typography.Title level={4}>选择或拖拽成果文件</Typography.Title>
          <Typography.Text type="secondary">
            支持 PNG、JPG、PDF、CSV、XLSX，单个文件不超过 {uploadMaxMb} MB
          </Typography.Text>
          <div className="import-selected-file">
            {file ? (
              <Tag color="green">{file.name}</Tag>
            ) : (
              <Tag>尚未选择文件</Tag>
            )}
          </div>
        </Upload.Dragger>

        <div className="result-import-grid">
          <Form.Item
            name="name"
            label="成果名称"
            rules={[
              { required: true, whitespace: true, message: "请输入成果名称" },
              { max: 160, message: "成果名称不能超过 160 个字符" },
            ]}
          >
            <Input placeholder="例如：2025 年塔里木河胡杨分布变化分析" />
          </Form.Item>
          <Form.Item name="provider" label="提供单位">
            <Input placeholder="例如：塔里木大学" maxLength={200} />
          </Form.Item>
          <Form.Item
            name="sourceType"
            label="成果来源"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "direct_import", label: "直接导入成果" },
                { value: "analysis", label: "平台分析成果" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="resultType"
            label="成果类型"
            rules={[{ required: true }]}
          >
            <Select options={resultTypeOptions} />
          </Form.Item>
          <Form.Item
            name="categoryCode"
            label="权威业务分类"
            rules={[{ required: true, message: "请选择权威业务分类" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择四大类下的具体叶节点"
              options={categoryOptions}
            />
          </Form.Item>
          <Form.Item
            name="accessGroupIds"
            label="发布可访问角色"
            rules={[
              {
                required: true,
                type: "array",
                min: 1,
                message: "请至少选择一个成果访问角色",
              },
            ]}
          >
            <Select
              mode="multiple"
              placeholder="选择成果发布范围"
              options={accessGroups.map((group) => ({
                value: group.id,
                label: group.name,
              }))}
            />
          </Form.Item>
        </div>

        <Form.Item name="description" label="成果摘要与适用范围">
          <Input.TextArea
            rows={4}
            maxLength={4000}
            showCount
            placeholder="说明成果内容、数据时段、空间范围、分析方法或使用限制"
          />
        </Form.Item>

        <Alert
          showIcon
          type="success"
          title="导入完成后直接发布"
          description="成果将立即进入成果展示页，实际可见范围由所选角色和成果查看权限共同决定。"
        />

        {hasGuestAudience && (
          <Alert
            showIcon
            type="warning"
            title="当前发布范围包含游客"
            description="登录为游客的访问者将能够在线查看该成果；是否允许下载仍由独立的成果下载权限控制。"
          />
        )}

        <Space className="import-actions result-import-actions" wrap>
          <Button onClick={reset} disabled={!file}>
            重新选择
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={submitting}
            onClick={() => void submit()}
          >
            导入并发布成果
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

function sourceTypeLabel(sourceType: ResultArtifactSourceType) {
  return sourceType === "analysis" ? "平台分析成果" : "直接导入成果";
}
