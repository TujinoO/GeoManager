import {
  DeleteOutlined,
  DownloadOutlined,
  FilterOutlined,
  ReloadOutlined,
  SaveOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { ProCard, StatisticCard } from "@ant-design/pro-components";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TablePaginationConfig } from "antd/es/table/interface";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { AdminDataResourceList } from "../types";

export const ownerAccessScopeId = "__owner__";

export type AccessScopeId = number | typeof ownerAccessScopeId;

export type AccessGroup =
  AdminDataResourceList["availableAccessGroups"][number];

export type ManagedFormValues = {
  accessGroupIds: AccessScopeId[];
} & Record<string, unknown>;

export interface ManagedItemBase {
  id: number;
  status: string;
  accessGroups: AccessGroup[];
  canManageAccess: boolean;
  updatedAt: string;
}

export interface FilterField {
  name: string;
  label: string;
  kind: "input" | "select" | "date";
  options?: { value: string; label: string }[];
}

export interface ManagedStat {
  title: string;
  value: number;
  prefix?: ReactNode;
}

export interface ManagedCollectionTableRenderArgs<
  TItem extends ManagedItemBase,
> {
  items: TItem[];
  loading: boolean;
  tableColumns: ColumnsType<TItem>;
  pagination: TablePaginationConfig;
}

interface ManagedCollectionPageProps<TItem extends ManagedItemBase> {
  className?: string;
  items: TItem[];
  total: number;
  accessGroups: AccessGroup[];
  loading: boolean;
  filters: Record<string, unknown>;
  filterFields: FilterField[];
  columns: ColumnsType<TItem>;
  stats: ManagedStat[];
  rowName: (item: TItem) => string;
  drawerTitle: string;
  deleteTitle: string;
  deleteDescription: ReactNode;
  ownerScopeLabel: string;
  canMaintain: boolean;
  canDelete?: boolean;
  canExport?: boolean;
  exportFormats?: string[];
  detailItems: (item: TItem) => { label: string; value: ReactNode }[];
  formInitialValues: (item: TItem) => ManagedFormValues;
  renderFormItems: (item: TItem, canMaintain: boolean) => ReactNode;
  renderTable?: (args: ManagedCollectionTableRenderArgs<TItem>) => ReactNode;
  onFilterChange: (filters: Record<string, unknown>) => void;
  onPageChange: (current: number, pageSize: number) => void;
  onSave: (item: TItem, values: ManagedFormValues) => Promise<TItem | void>;
  onDelete: (item: TItem, confirmationName: string) => Promise<void>;
  onExport?: (format: string) => Promise<void>;
}

export default function ManagedCollectionPage<TItem extends ManagedItemBase>({
  className,
  items,
  total,
  accessGroups,
  loading,
  filters,
  filterFields,
  columns,
  stats,
  rowName,
  drawerTitle,
  deleteTitle,
  deleteDescription,
  ownerScopeLabel,
  canMaintain,
  canDelete = canMaintain,
  canExport = false,
  exportFormats = [],
  detailItems,
  formInitialValues,
  renderFormItems,
  renderTable,
  onFilterChange,
  onPageChange,
  onSave,
  onDelete,
  onExport,
}: ManagedCollectionPageProps<TItem>) {
  const [filterForm] = Form.useForm();
  const [editForm] = Form.useForm<ManagedFormValues>();
  const [selectedItem, setSelectedItem] = useState<TItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TItem | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const drawerAccessGroupIds = Form.useWatch("accessGroupIds", editForm) ?? [];

  const tableColumns = useMemo<ColumnsType<TItem>>(
    () => [
      ...columns,
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
                aria-label={`配置${rowName(record)}`}
                icon={<SettingOutlined />}
                onClick={() => openDrawer(record)}
                disabled={!canMaintain && !record.canManageAccess}
              />
            </Tooltip>
            <Tooltip title={canDelete ? "删除" : "当前用户无删除权限"}>
              <Button
                aria-label={`删除${rowName(record)}`}
                danger
                icon={<DeleteOutlined />}
                disabled={!canDelete}
                onClick={() => setDeleteTarget(record)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [canDelete, canMaintain, columns, rowName],
  );

  const tablePagination: TablePaginationConfig = {
    current: Number(filters.current ?? 1),
    pageSize: Number(filters.pageSize ?? 10),
    total,
    showSizeChanger: true,
    showTotal: (nextTotal) => `共 ${nextTotal} 条`,
    onChange: onPageChange,
  };

  function submitFilters(values: Record<string, unknown>) {
    onFilterChange({
      ...compactFilters(values),
      current: 1,
      pageSize: filters.pageSize,
    });
  }

  function resetFilters() {
    filterForm.resetFields();
    onFilterChange({ current: 1, pageSize: filters.pageSize });
  }

  function openDrawer(item: TItem) {
    setSelectedItem(item);
    editForm.setFieldsValue(formInitialValues(item));
    setDrawerOpen(true);
  }

  async function saveSelected() {
    if (!selectedItem) {
      return;
    }
    try {
      const values = await editForm.validateFields();
      setSaving(true);
      const updated = await onSave(selectedItem, values);
      if (updated) {
        setSelectedItem(updated);
      }
      setDrawerOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    try {
      await onDelete(deleteTarget, deleteText);
      setDeleteTarget(null);
      setDeleteText("");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={`admin-page-stack admin-inventory-page ${className ?? ""}`}>
      <ProCard className="admin-section-card">
        <Form form={filterForm} layout="vertical" onFinish={submitFilters}>
          <div className="inventory-toolbar">
            <Form.Item name="q" className="inventory-search-item">
              <Input
                allowClear
                placeholder="按名称、来源或所属用户快速检索"
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
              {exportFormats.map((format) => (
                <Button
                  key={format}
                  icon={<DownloadOutlined />}
                  disabled={!canExport}
                  onClick={() => onExport?.(format)}
                >
                  {format.toUpperCase()}
                </Button>
              ))}
            </Space>
          </div>
          <div className="inventory-filter-grid">
            {filterFields.map((field) => (
              <Form.Item key={field.name} name={field.name} label={field.label}>
                {field.kind === "select" ? (
                  <Select allowClear options={field.options ?? []} />
                ) : (
                  <Input
                    allowClear
                    type={field.kind === "date" ? "date" : undefined}
                  />
                )}
              </Form.Item>
            ))}
          </div>
        </Form>
      </ProCard>

      <StatisticCard.Group className="inventory-stat-group">
        {stats.map((stat) => (
          <StatisticCard
            key={stat.title}
            statistic={{
              title: stat.title,
              value: stat.value,
              prefix: stat.prefix,
            }}
          />
        ))}
      </StatisticCard.Group>

      <ProCard className="admin-section-card inventory-table-card">
        <div className="inventory-table-scroll">
          {renderTable ? (
            renderTable({
              items,
              loading,
              tableColumns,
              pagination: tablePagination,
            })
          ) : (
            <Table<TItem>
              rowKey="id"
              loading={loading}
              columns={tableColumns}
              dataSource={items}
              scroll={{ x: 1280 }}
              pagination={tablePagination}
            />
          )}
        </div>
      </ProCard>

      <Drawer
        size={560}
        title={drawerTitle}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!canMaintain && !selectedItem?.canManageAccess}
            onClick={saveSelected}
          >
            保存
          </Button>
        }
      >
        {selectedItem && (
          <Space orientation="vertical" size={18} className="drawer-stack">
            <Descriptions column={1} size="small" bordered>
              {detailItems(selectedItem).map((item) => (
                <Descriptions.Item key={item.label} label={item.label}>
                  {item.value}
                </Descriptions.Item>
              ))}
            </Descriptions>
            <Form
              form={editForm}
              layout="vertical"
              className="inventory-drawer-form"
            >
              <Typography.Title level={5}>访问权限</Typography.Title>
              <Form.Item name="accessGroupIds" label="允许访问的角色">
                <Select
                  mode="multiple"
                  disabled={!canMaintain && !selectedItem.canManageAccess}
                  placeholder="选择需要共享的角色"
                  onChange={(nextValue) =>
                    editForm.setFieldValue(
                      "accessGroupIds",
                      withFixedAccessScopes(nextValue),
                    )
                  }
                  options={[
                    {
                      value: ownerAccessScopeId,
                      label: ownerScopeLabel,
                      disabled: true,
                    },
                    ...accessGroups.map((group) => ({
                      value: group.id,
                      label: group.name,
                    })),
                  ]}
                />
              </Form.Item>
              {hasGuestAccess(drawerAccessGroupIds, accessGroups) && (
                <Alert
                  type="warning"
                  showIcon
                  title="游客可见后，无需登录账号即可浏览和查询该对象。"
                />
              )}
              {renderFormItems(selectedItem, canMaintain)}
            </Form>
          </Space>
        )}
      </Drawer>

      <Modal
        title={deleteTitle}
        open={Boolean(deleteTarget)}
        confirmLoading={deleting}
        okText="确认删除"
        okButtonProps={{
          danger: true,
          disabled: deleteText !== (deleteTarget ? rowName(deleteTarget) : ""),
        }}
        onOk={confirmDelete}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteText("");
        }}
      >
        <Typography.Paragraph>{deleteDescription}</Typography.Paragraph>
        <Typography.Text strong>
          {deleteTarget ? rowName(deleteTarget) : ""}
        </Typography.Text>
        <Input
          value={deleteText}
          onChange={(event) => setDeleteText(event.target.value)}
          placeholder="输入完整名称"
          style={{ marginTop: 12 }}
        />
      </Modal>
    </div>
  );
}

export function withFixedAccessScopes(
  values: AccessScopeId[] = [],
): AccessScopeId[] {
  const optionalValues = values.filter((value) => value !== ownerAccessScopeId);
  return [ownerAccessScopeId, ...optionalValues];
}

export function realAccessGroupIds(values: AccessScopeId[] = []): number[] {
  return values.filter((value): value is number => typeof value === "number");
}

function isGuestGroup(group: AccessGroup) {
  return group.isGuest === true || group.name === "游客";
}

function hasGuestAccess(groupIds: AccessScopeId[], groups: AccessGroup[]) {
  const selected = new Set(realAccessGroupIds(groupIds));
  return groups.some((group) => selected.has(group.id) && isGuestGroup(group));
}

function compactFilters(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  );
}
