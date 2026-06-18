import {
  EnvironmentOutlined,
  FilterOutlined,
  PlusOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Empty,
  Input,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import type {
  AttributeFilter,
  DataResourceProfile,
  ResourceFilters,
  ResourceListItem,
  User,
} from "../types";
import {
  resourceCategory,
  resourceCategoryName,
  resourceFormatLabel,
  resourceProvider,
  resourceSpatialExtent,
} from "../utils/resources";

interface Props {
  resources: ResourceListItem[];
  profile: DataResourceProfile | null;
  selectedResourceId: ResourceListItem["id"] | null;
  loadingProfile: boolean;
  querying: boolean;
  permissions: User["permissions"];
  searchKeyword?: string;
  onFilterResources: (filters: ResourceFilters) => void;
  onSelectResource: (resource: ResourceListItem) => void;
  onQuickLoadResource: (resource: ResourceListItem) => void;
  onQueryAndLoad: (filters: AttributeFilter[]) => void;
  onLoadRaster: () => void;
}

const operatorOptions = [
  { label: "包含", value: "contains" },
  { label: "等于", value: "eq" },
  { label: "不等于", value: "ne" },
  { label: "大于", value: "gt" },
  { label: "大于等于", value: "gte" },
  { label: "小于", value: "lt" },
  { label: "小于等于", value: "lte" },
  { label: "介于", value: "between" },
];

export default function DataPanel({
  resources,
  profile,
  selectedResourceId,
  loadingProfile,
  querying,
  permissions,
  searchKeyword,
  onFilterResources,
  onSelectResource,
  onQuickLoadResource,
  onQueryAndLoad,
  onLoadRaster,
}: Props) {
  const [resourceFilters, setResourceFilters] = useState<ResourceFilters>({});
  const [attributeFilters, setAttributeFilters] = useState<AttributeFilter[]>(
    [],
  );
  const [field, setField] = useState<string>();
  const [operator, setOperator] =
    useState<AttributeFilter["operator"]>("contains");
  const [value, setValue] = useState("");
  const [valueTo, setValueTo] = useState("");

  const categoryOptions = useMemo(() => {
    const categories = new Map<string, string>();
    resources.forEach((resource) => {
      const category = resourceCategory(resource);
      if (category) {
        categories.set(category.code, category.name);
      }
    });
    return Array.from(categories, ([code, name]) => ({
      value: code,
      label: name,
    }));
  }, [resources]);

  const fieldOptions = (profile?.fields ?? []).map((item) => ({
    value: item.name,
    label: `${item.name} (${item.type})`,
  }));
  const selectedIsRaster = profile?.resource.dataType === "raster";
  const canQueryAndLoadVector =
    permissions.canQueryData && permissions.canLoadVectorLayer;

  useEffect(() => {
    const nextQuery = searchKeyword?.trim() || undefined;
    setResourceFilters((current) =>
      current.q === nextQuery ? current : { ...current, q: nextQuery },
    );
  }, [searchKeyword]);

  function updateResourceFilter(
    key: keyof ResourceFilters,
    nextValue?: string,
  ) {
    setResourceFilters((current) => ({ ...current, [key]: nextValue }));
  }

  function addAttributeFilter() {
    if (!field || !value.trim()) {
      return;
    }
    setAttributeFilters((current) => [
      ...current,
      {
        id: `${Date.now()}-${field}`,
        field,
        operator,
        value: value.trim(),
        valueTo: operator === "between" ? valueTo.trim() : undefined,
      },
    ]);
    setValue("");
    setValueTo("");
  }

  function removeAttributeFilter(id: string) {
    setAttributeFilters((current) => current.filter((item) => item.id !== id));
  }

  return (
    <section className="panel-section data-panel">
      <div className="subsection-title">
        <SearchOutlined style={{ fontSize: 15 }} />
        <Typography.Text strong>元数据筛选</Typography.Text>
      </div>
      <Space orientation="vertical" className="full-width compact-stack">
        <Input
          prefix={<SearchOutlined style={{ fontSize: 15 }} />}
          placeholder="数据名称或编号"
          value={resourceFilters.q}
          onChange={(event) => updateResourceFilter("q", event.target.value)}
          allowClear
        />
        <div className="data-filter-row">
          <Select
            placeholder="数据分类"
            value={resourceFilters.category}
            allowClear
            options={categoryOptions}
            onChange={(nextValue) =>
              updateResourceFilter("category", nextValue)
            }
          />
          <Select
            placeholder="数据类型"
            value={resourceFilters.dataType}
            allowClear
            options={[
              { value: "vector", label: "矢量空间数据" },
              { value: "raster", label: "栅格空间数据" },
              { value: "table", label: "表格属性数据" },
              { value: "document", label: "文档资料" },
              { value: "image", label: "图片资料" },
            ]}
            onChange={(nextValue) =>
              updateResourceFilter("dataType", nextValue)
            }
          />
        </div>
        <Input
          placeholder="数据来源"
          value={resourceFilters.source}
          onChange={(event) =>
            updateResourceFilter("source", event.target.value)
          }
          allowClear
        />
        <DatePicker.RangePicker
          className="full-width"
          onChange={(_, dates) =>
            setResourceFilters((current) => ({
              ...current,
              dateFrom: dates[0] || undefined,
              dateTo: dates[1] || undefined,
            }))
          }
        />
        <Button
          type="primary"
          icon={<FilterOutlined style={{ fontSize: 15 }} />}
          onClick={() => onFilterResources(resourceFilters)}
        >
          筛选数据
        </Button>
      </Space>

      <div className="subsection-title">
        <UnorderedListOutlined style={{ fontSize: 15 }} />
        <Typography.Text strong>数据资源</Typography.Text>
      </div>
      {resources.length > 0 ? (
        <ul className="resource-list" aria-label="数据资源">
          {resources.map((resource) => (
            <li
              key={resource.id}
              className={
                resource.id === selectedResourceId
                  ? "resource-row resource-row-active"
                  : "resource-row"
              }
            >
              <div className="resource-row-content">
                <Typography.Text strong className="resource-row-title">
                  {resource.name}
                  {!resource.isQueryable && !resource.isRenderable && (
                    <Tag>仅元数据</Tag>
                  )}
                  {resource.isRenderable && <Tag color="blue">栅格</Tag>}
                </Typography.Text>
                <Typography.Text type="secondary" className="resource-row-meta">
                  {resourceCategoryName(resource) ?? "未分类"} ·{" "}
                  {resourceFormatLabel(resource)}
                </Typography.Text>
              </div>
              <Button
                size="small"
                type={
                  resource.id === selectedResourceId ? "primary" : "default"
                }
                disabled={!resource.isQueryable && !resource.isRenderable}
                onClick={() => onSelectResource(resource)}
              >
                选择
              </Button>
              <Button
                size="small"
                type="primary"
                ghost
                className="resource-quick-load-button"
                disabled={!resource.isQueryable && !resource.isRenderable}
                onClick={() => onQuickLoadResource(resource)}
              >
                快速加载
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无数据资源"
        />
      )}

      {profile && (
        <>
          <div className="subsection-title">
            <EnvironmentOutlined style={{ fontSize: 15 }} />
            <Typography.Text strong>字段与元信息</Typography.Text>
          </div>
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="数据来源">
              {profile.resource.source || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="提供单位">
              {resourceProvider(profile.resource) || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="空间范围">
              {resourceSpatialExtent(profile.resource) || "-"}
            </Descriptions.Item>
            <Descriptions.Item label={selectedIsRaster ? "波段数" : "要素数"}>
              {selectedIsRaster
                ? (profile.raster?.bandCount ?? "-")
                : (profile.featureCount ?? "-")}
            </Descriptions.Item>
            <Descriptions.Item
              label={selectedIsRaster ? "栅格大小" : "几何类型"}
            >
              {selectedIsRaster
                ? profile.raster?.metadata.size?.join(" x ") || "-"
                : profile.geometryType || "-"}
            </Descriptions.Item>
          </Descriptions>
          {loadingProfile ? (
            <Alert
              className="inline-alert"
              type="info"
              showIcon
              title="正在读取字段信息"
            />
          ) : (
            <ul className="field-list" aria-label="字段列表">
              {profile.fields.map((item) => (
                <li className="field-row" key={item.name}>
                  <Typography.Text>{item.name}</Typography.Text>
                  <Typography.Text type="secondary">
                    {item.type}
                  </Typography.Text>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {!selectedIsRaster && (
        <>
          <div className="subsection-title">
            <PlusOutlined style={{ fontSize: 15 }} />
            <Typography.Text strong>属性查询</Typography.Text>
          </div>
          <Space orientation="vertical" className="full-width compact-stack">
            <div className="attribute-filter-row">
              <Select
                placeholder="选择字段"
                value={field}
                options={fieldOptions}
                onChange={setField}
                disabled={!profile}
              />
              <Select
                value={operator}
                options={operatorOptions}
                onChange={setOperator}
              />
            </div>
            <Input
              placeholder="字段值"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            {operator === "between" && (
              <Input
                placeholder="结束值"
                value={valueTo}
                onChange={(event) => setValueTo(event.target.value)}
              />
            )}
            <div className="attribute-action-row">
              <Button
                icon={<PlusOutlined style={{ fontSize: 15 }} />}
                disabled={!field || !value.trim()}
                onClick={addAttributeFilter}
              >
                添加属性条件
              </Button>
              {canQueryAndLoadVector && (
                <Button
                  type="primary"
                  loading={querying}
                  disabled={!profile}
                  onClick={() => onQueryAndLoad(attributeFilters)}
                >
                  查询并加载
                </Button>
              )}
            </div>
          </Space>
          <Space wrap className="filter-tags">
            {attributeFilters.map((item) => (
              <Tag
                key={item.id}
                closable
                onClose={() => removeAttributeFilter(item.id)}
              >
                {item.field} {operatorLabel(item.operator)} {item.value}
                {item.valueTo ? ` - ${item.valueTo}` : ""}
              </Tag>
            ))}
          </Space>
        </>
      )}

      {selectedIsRaster && permissions.canLoadRasterLayer && (
        <div className="query-footer">
          <Button
            type="primary"
            disabled={!profile?.raster}
            onClick={onLoadRaster}
          >
            加载栅格
          </Button>
        </div>
      )}
    </section>
  );
}

function operatorLabel(operator: AttributeFilter["operator"]) {
  return (
    operatorOptions.find((item) => item.value === operator)?.label ?? operator
  );
}
