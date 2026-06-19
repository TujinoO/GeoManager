import {
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  FilterOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  SettingOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { ProCard, StatisticCard } from "@ant-design/pro-components";
import {
  Alert,
  App as AntApp,
  Button,
  Checkbox,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";
import type {
  AdminDataResource,
  AdminDataResourceFilters,
  AdminDataResourceList,
} from "../types";
import { downloadBlob } from "../utils/download";

type InventoryFormValues = {
  q?: string;
  dataType?: AdminDataResourceFilters["dataType"];
  status?: AdminDataResourceFilters["status"];
  source?: string;
  provider?: string;
  dateFrom?: string;
  dateTo?: string;
};

type VisualizationFormValues = {
  layerName: string;
  defaultVisible: boolean;
  defaultOpacity: number;
  pointColor?: string;
  symbolizationJson?: string;
  rasterRulesJson?: string;
  accessGroupIds: number[];
};

const dataTypeLabels: Record<AdminDataResource["dataType"], string> = {
  vector: "矢量",
  raster: "栅格",
  gene: "基因",
  table: "表格",
  document: "文档",
  image: "图片",
};

const statusLabels = {
  active: { text: "启用", color: "green" },
  inactive: { text: "禁用", color: "default" },
} as const;

const initialList: AdminDataResourceList = {
  items: [],
  total: 0,
  availableAccessGroups: [],
};

export default function AdminDataInventoryPage() {
  const { message } = AntApp.useApp();
  const { user } = useAppContext();
  const [filterForm] = Form.useForm<InventoryFormValues>();
  const [visualizationForm] = Form.useForm<VisualizationFormValues>();
  const [filters, setFilters] = useState<AdminDataResourceFilters>({
    current: 1,
    pageSize: 10,
  });
  const [data, setData] = useState<AdminDataResourceList>(initialList);
  const [loading, setLoading] = useState(false);
  const [selectedResource, setSelectedResource] =
    useState<AdminDataResource | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminDataResource | null>(
    null,
  );
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canMaintain = Boolean(user?.permissions.canMaintainData);
  const canUpload = Boolean(user?.permissions.canUploadData);
  const canExport = Boolean(user?.permissions.canExportData);
  const canOpenInventory = canMaintain || canUpload || canExport;
  const drawerAccessGroupIds =
    Form.useWatch("accessGroupIds", visualizationForm) ?? [];

  const metrics = useMemo(() => {
    const active = data.items.filter((item) => item.status === "active").length;
    const inactive = data.items.filter(
      (item) => item.status === "inactive",
    ).length;
    const restricted = data.items.filter(
      (item) => item.accessGroups.length > 0,
    ).length;
    return { active, inactive, restricted };
  }, [data.items]);

  const loadResources = useCallback(
    async (nextFilters: AdminDataResourceFilters) => {
      setLoading(true);
      try {
        const result = await api.adminDataResources(nextFilters);
        setData(result);
      } catch (error) {
        message.error(
          error instanceof Error ? error.message : "存量数据加载失败",
        );
      } finally {
        setLoading(false);
      }
    },
    [message],
  );

  useEffect(() => {
    if (canOpenInventory) {
      void loadResources(filters);
    }
  }, [canOpenInventory, filters, loadResources]);

  if (!canOpenInventory) {
    return <Navigate to="/admin/profile" replace />;
  }

  function submitFilters(values: InventoryFormValues) {
    setFilters({
      ...compactFilters(values),
      current: 1,
      pageSize: filters.pageSize,
    });
  }

  function resetFilters() {
    filterForm.resetFields();
    setFilters({ current: 1, pageSize: filters.pageSize });
  }

  function openResourceDrawer(resource: AdminDataResource) {
    setSelectedResource(resource);
    const visualization = resource.defaultVisualization;
    const layer = resource.defaultLayer;
    const symbolization: Record<string, unknown> =
      typeof visualization.symbolization === "object" &&
      visualization.symbolization !== null
        ? (visualization.symbolization as Record<string, unknown>)
        : (layer?.symbolization ?? {});
    const rasterRules: Record<string, unknown> =
      typeof visualization.rasterRules === "object" &&
      visualization.rasterRules !== null
        ? (visualization.rasterRules as Record<string, unknown>)
        : (layer?.rasterRules ?? {});
    visualizationForm.setFieldsValue({
      layerName:
        textValue(visualization.layerName) || layer?.name || resource.name,
      defaultVisible: Boolean(
        visualization.defaultVisible ?? layer?.defaultVisible ?? false,
      ),
      defaultOpacity: Number(
        visualization.defaultOpacity ?? layer?.defaultOpacity ?? 85,
      ),
      pointColor: textValue(symbolization.pointColor) || "#2f7d62",
      symbolizationJson: JSON.stringify(symbolization, null, 2),
      rasterRulesJson: JSON.stringify(rasterRules, null, 2),
      accessGroupIds: resource.accessGroups
        .filter((group) => !isSuperadminGroup(group))
        .map((group) => group.id),
    });
    setDrawerOpen(true);
  }

  async function saveResourceSettings() {
    if (!selectedResource) {
      return;
    }
    try {
      if (!canMaintain) {
        const values = visualizationForm.getFieldsValue(true);
        if (!selectedResource.canManageAccess) {
          message.warning("当前用户不能修改该数据的可见范围");
          return;
        }
        setSaving(true);
        const updated = await api.updateAdminDataResource(selectedResource.id, {
          action: "updateAccess",
          accessGroupIds: values.accessGroupIds,
        });
        if ("id" in updated) {
          replaceResource(updated);
          setSelectedResource(updated);
        }
        message.success("数据可见范围已保存");
        setDrawerOpen(false);
        return;
      }
      const values = await visualizationForm.validateFields();
      const symbolization = parseJsonObject(
        values.symbolizationJson,
        "矢量符号",
      );
      if (selectedResource.dataType === "vector") {
        symbolization.pointColor = values.pointColor;
      }
      const rasterRules = parseJsonObject(values.rasterRulesJson, "栅格规则");
      setSaving(true);
      const updated = await api.updateAdminDataResource(selectedResource.id, {
        action: "update",
        accessGroupIds: values.accessGroupIds,
        visualization: {
          layerName: values.layerName,
          defaultVisible: values.defaultVisible,
          defaultOpacity: values.defaultOpacity,
          symbolization,
          rasterRules,
        },
      });
      if ("id" in updated) {
        replaceResource(updated);
        setSelectedResource(updated);
      }
      message.success("数据权限与默认可视化方案已保存");
      setDrawerOpen(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(resource: AdminDataResource, checked: boolean) {
    const nextStatus = checked ? "active" : "inactive";
    try {
      const updated = await api.updateAdminDataResource(resource.id, {
        action: "setStatus",
        status: nextStatus,
      });
      if ("id" in updated) {
        replaceResource(updated);
      }
      message.success(`已${checked ? "启用" : "禁用"} ${resource.name}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "状态更新失败");
    }
  }

  async function exportInventory(format: "csv" | "xlsx") {
    if (!canExport) {
      message.warning("当前用户无数据导出权限");
      return;
    }
    try {
      const { blob, filename } = await api.exportAdminDataResources({
        ...exportFilters(filters),
        format,
      });
      downloadBlob(blob, filename);
      message.success(`已导出 ${format.toUpperCase()} 清单`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导出失败");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    try {
      await api.updateAdminDataResource(deleteTarget.id, {
        action: "delete",
        confirmationName: deleteText,
      });
      setData((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== deleteTarget.id),
        total: Math.max(current.total - 1, 0),
      }));
      message.success("数据资源已删除");
      setDeleteTarget(null);
      setDeleteText("");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  function replaceResource(resource: AdminDataResource) {
    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === resource.id ? resource : item,
      ),
    }));
  }

  const columns: ColumnsType<AdminDataResource> = [
    {
      title: "数据资源",
      dataIndex: "name",
      key: "name",
      width: 260,
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Button type="link" onClick={() => openResourceDrawer(record)}>
            {record.name}
          </Button>
          <Typography.Text type="secondary" className="admin-table-subtext">
            {record.code}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "类型",
      dataIndex: "dataType",
      key: "dataType",
      width: 92,
      render: (value: AdminDataResource["dataType"]) => (
        <Tag>{dataTypeLabels[value]}</Tag>
      ),
    },
    {
      title: "数据规模",
      key: "dataSize",
      width: 150,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <span>{formatBytes(record.sizeBytes ?? 0)}</span>
          <Typography.Text type="secondary" className="admin-table-subtext">
            {record.itemCount ?? 0} 条
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 112,
      render: (_, record) => (
        <Space>
          <Switch
            size="small"
            checked={record.status === "active"}
            checkedChildren="启用"
            unCheckedChildren="禁用"
            disabled={!canMaintain}
            onChange={(checked) => toggleStatus(record, checked)}
          />
        </Space>
      ),
    },
    {
      title: "来源/单位",
      key: "source",
      width: 190,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <span>{record.source || "未记录"}</span>
          <Typography.Text type="secondary" className="admin-table-subtext">
            {record.provider || "未记录提供单位"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "上传用户",
      key: "uploader",
      width: 150,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <span>
            {record.uploader?.displayName || record.maintainer || "未记录"}
          </span>
          {record.uploader?.username && (
            <Typography.Text type="secondary" className="admin-table-subtext">
              {record.uploader.username}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: "数据日期",
      dataIndex: "dataDate",
      key: "dataDate",
      width: 120,
      render: (value: string | null) => value || "-",
    },
    {
      title: "访问范围",
      key: "accessGroups",
      width: 180,
      render: (_, record) =>
        record.accessGroups.length ? (
          <Space size={[4, 4]} wrap>
            {record.accessGroups.map((group) => (
              <Tag key={group.id} color="blue">
                {group.name}
              </Tag>
            ))}
          </Space>
        ) : (
          <Tag>全部可见</Tag>
        ),
    },
    {
      title: "可视化方案",
      key: "visualization",
      width: 160,
      render: (_, record) => (
        <Tag color={record.defaultLayer ? "green" : "default"}>
          {record.defaultLayer ? "已配置" : "未配置"}
        </Tag>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 190,
      render: (value: string) => new Date(value).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "actions",
      width: 164,
      render: (_, record) => (
        <Space>
          <Tooltip title="配置">
            <Button
              icon={<SettingOutlined />}
              onClick={() => openResourceDrawer(record)}
              disabled={!canMaintain && !record.canManageAccess}
            />
          </Tooltip>
          <Tooltip title={canMaintain ? "删除" : "当前用户无删除权限"}>
            <Button
              danger
              icon={<DeleteOutlined />}
              disabled={!canMaintain}
              onClick={() => setDeleteTarget(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="admin-page-stack admin-inventory-page">
      <ProCard className="admin-section-card">
        <Form
          form={filterForm}
          layout="vertical"
          initialValues={{ q: "" }}
          onFinish={submitFilters}
        >
          <div className="inventory-toolbar">
            <Form.Item name="q" className="inventory-search-item">
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="按名称、编号、来源、提供单位快速检索"
                onPressEnter={() => filterForm.submit()}
              />
            </Form.Item>
            <Space wrap>
              <Button
                type="primary"
                icon={<FilterOutlined />}
                onClick={() => filterForm.submit()}
              >
                筛选
              </Button>
              <Button icon={<ReloadOutlined />} onClick={resetFilters}>
                重置
              </Button>
              <Button
                icon={<DownloadOutlined />}
                disabled={!canExport}
                onClick={() => exportInventory("csv")}
              >
                CSV
              </Button>
              <Button
                icon={<DownloadOutlined />}
                disabled={!canExport}
                onClick={() => exportInventory("xlsx")}
              >
                Excel
              </Button>
            </Space>
          </div>
          <div className="inventory-filter-grid">
            <Form.Item name="dataType" label="数据类型">
              <Select
                allowClear
                options={Object.entries(dataTypeLabels).map(
                  ([value, label]) => ({ value, label }),
                )}
              />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select
                allowClear
                options={[
                  { value: "active", label: "启用" },
                  { value: "inactive", label: "禁用" },
                ]}
              />
            </Form.Item>
            <Form.Item name="source" label="数据来源">
              <Input allowClear />
            </Form.Item>
            <Form.Item name="provider" label="提供单位">
              <Input allowClear />
            </Form.Item>
            <Form.Item name="dateFrom" label="起始日期">
              <Input type="date" />
            </Form.Item>
            <Form.Item name="dateTo" label="截止日期">
              <Input type="date" />
            </Form.Item>
          </div>
        </Form>
      </ProCard>

      <StatisticCard.Group className="inventory-stat-group">
        <StatisticCard
          statistic={{ title: "当前结果", value: data.total, suffix: "项" }}
        />
        <StatisticCard
          statistic={{
            title: "本页启用",
            value: metrics.active,
            prefix: <EyeOutlined />,
          }}
        />
        <StatisticCard
          statistic={{
            title: "本页禁用",
            value: metrics.inactive,
            prefix: <StopOutlined />,
          }}
        />
        <StatisticCard
          statistic={{ title: "本页受限访问", value: metrics.restricted }}
        />
      </StatisticCard.Group>

      <ProCard className="admin-section-card inventory-table-card">
        <div className="inventory-table-scroll">
          <Table<AdminDataResource>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={data.items}
            scroll={{ x: 1280 }}
            pagination={{
              current: Number(filters.current ?? 1),
              pageSize: Number(filters.pageSize ?? 10),
              total: data.total,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (current, pageSize) => {
                setFilters((currentFilters) => ({
                  ...currentFilters,
                  current,
                  pageSize,
                }));
              },
            }}
          />
        </div>
      </ProCard>

      <Drawer
        size={560}
        title={canMaintain ? "存量数据配置" : "数据可见范围"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!canMaintain && !selectedResource?.canManageAccess}
            onClick={saveResourceSettings}
          >
            保存
          </Button>
        }
      >
        {selectedResource && (
          <Space orientation="vertical" size={18} className="drawer-stack">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="数据名称">
                {selectedResource.name}
              </Descriptions.Item>
              <Descriptions.Item label="类型">
                {dataTypeLabels[selectedResource.dataType]}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusLabels[selectedResource.status].color}>
                  {statusLabels[selectedResource.status].text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="上传用户">
                {selectedResource.uploader?.displayName ||
                  selectedResource.maintainer ||
                  "未记录"}
              </Descriptions.Item>
              <Descriptions.Item label="数据大小">
                {formatBytes(selectedResource.sizeBytes ?? 0)}
              </Descriptions.Item>
              <Descriptions.Item label="数据条目数">
                {selectedResource.itemCount ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label="存储位置">
                {selectedResource.storagePath || "-"}
              </Descriptions.Item>
            </Descriptions>

            <Form
              form={visualizationForm}
              layout="vertical"
              className="inventory-drawer-form"
            >
              <Typography.Title level={5}>数据访问权限</Typography.Title>
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                <Checkbox checked disabled>
                  上传者本人可见
                </Checkbox>
                <Checkbox checked disabled>
                  超级管理员可见
                </Checkbox>
                {selectedResource &&
                  hasGuestAccess(
                    drawerAccessGroupIds,
                    data.availableAccessGroups,
                  ) && (
                    <Alert
                      type="warning"
                      showIcon
                      message="游客可见后，无需登录账号即可浏览和查询该数据。"
                    />
                  )}
              </Space>
              <Form.Item name="accessGroupIds" label="允许访问的用户组">
                <Select
                  mode="multiple"
                  allowClear
                  disabled={!canMaintain && !selectedResource.canManageAccess}
                  placeholder="选择需要共享的数据用户组"
                  options={data.availableAccessGroups
                    .filter((group) => !isSuperadminGroup(group))
                    .map((group) => ({
                      value: group.id,
                      label: group.name,
                    }))}
                />
              </Form.Item>

              <Typography.Title level={5}>默认可视化方案</Typography.Title>
              <Form.Item
                name="layerName"
                label="默认图层名称"
                rules={[{ required: true, message: "请输入默认图层名称" }]}
              >
                <Input disabled={!canMaintain} />
              </Form.Item>
              <div className="inventory-filter-grid two-columns">
                <Form.Item
                  name="defaultVisible"
                  label="默认显示"
                  valuePropName="checked"
                >
                  <Switch
                    checkedChildren="显示"
                    unCheckedChildren="隐藏"
                    disabled={!canMaintain}
                  />
                </Form.Item>
                <Form.Item
                  name="defaultOpacity"
                  label="默认透明度"
                  rules={[{ required: true, message: "请输入默认透明度" }]}
                >
                  <InputNumber
                    min={0}
                    max={100}
                    addonAfter="%"
                    disabled={!canMaintain}
                  />
                </Form.Item>
              </div>
              {selectedResource.dataType === "vector" && (
                <Form.Item name="pointColor" label="点位/主色">
                  <Input type="color" disabled={!canMaintain} />
                </Form.Item>
              )}
              <Form.Item name="symbolizationJson" label="矢量符号 JSON">
                <Input.TextArea
                  rows={6}
                  spellCheck={false}
                  disabled={!canMaintain}
                />
              </Form.Item>
              <Form.Item name="rasterRulesJson" label="栅格规则 JSON">
                <Input.TextArea
                  rows={6}
                  spellCheck={false}
                  disabled={!canMaintain}
                />
              </Form.Item>
            </Form>
          </Space>
        )}
      </Drawer>

      <Modal
        title="删除存量数据"
        open={Boolean(deleteTarget)}
        confirmLoading={deleting}
        okText="确认删除"
        okButtonProps={{
          danger: true,
          disabled: deleteText !== deleteTarget?.name,
        }}
        onOk={confirmDelete}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteText("");
        }}
      >
        <Typography.Paragraph>
          删除会移除数据资源登记和关联图层；用户导入的表或矢量图层会同步清理。请输入数据名称确认。
        </Typography.Paragraph>
        <Typography.Text strong>{deleteTarget?.name}</Typography.Text>
        <Input
          value={deleteText}
          onChange={(event) => setDeleteText(event.target.value)}
          placeholder="输入完整数据名称"
          style={{ marginTop: 12 }}
        />
      </Modal>
    </div>
  );
}

function compactFilters(values: InventoryFormValues): AdminDataResourceFilters {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  ) as AdminDataResourceFilters;
}

function exportFilters(filters: AdminDataResourceFilters) {
  const { current, pageSize, ...rest } = filters;
  void current;
  void pageSize;
  return rest;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseJsonObject(value: string | undefined, label: string) {
  if (!value?.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error(`${label}必须是 JSON 对象`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${label}格式错误：${error.message}`);
    }
    throw new Error(`${label}格式错误`);
  }
}

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let current = value;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  return `${current.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

type AccessGroup = AdminDataResourceList["availableAccessGroups"][number];

function isGuestGroup(group: AccessGroup) {
  return group.isGuest === true || group.name === "游客";
}

function isSuperadminGroup(group: AccessGroup) {
  return group.isSuperadmin === true || group.name === "超级管理员";
}

function hasGuestAccess(groupIds: number[], groups: AccessGroup[]) {
  const selected = new Set(groupIds);
  return groups.some((group) => selected.has(group.id) && isGuestGroup(group));
}
