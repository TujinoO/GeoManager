import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Empty,
  Input,
  List,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  Crosshair,
  Database,
  Filter,
  ListFilter,
  MapPinned,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { DrawMode } from "../map/spatialDraw";
import type {
  AttributeFilter,
  DataResource,
  DataResourceProfile,
  ResourceFilters,
  ResourceQueryResult,
  SpatialFilter,
  User,
} from "../types";

interface Props {
  resources: DataResource[];
  profile: DataResourceProfile | null;
  selectedResourceId: number | null;
  spatialFilter: SpatialFilter | null;
  drawMode: DrawMode | null;
  queryResult: ResourceQueryResult | null;
  loadingProfile: boolean;
  querying: boolean;
  permissions: User["permissions"];
  onFilterResources: (filters: ResourceFilters) => void;
  onSelectResource: (resource: DataResource) => void;
  onDrawModeChange: (mode: DrawMode | null) => void;
  onClearSpatialFilter: () => void;
  onQuery: (filters: AttributeFilter[]) => void;
  onLoadResult: () => void;
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
  spatialFilter,
  drawMode,
  queryResult,
  loadingProfile,
  querying,
  permissions,
  onFilterResources,
  onSelectResource,
  onDrawModeChange,
  onClearSpatialFilter,
  onQuery,
  onLoadResult,
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
      if (resource.category) {
        categories.set(resource.category.code, resource.category.name);
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
      <div className="panel-title">
        <Database size={18} />
        <Typography.Title level={5}>数据管理</Typography.Title>
      </div>

      <div className="subsection-title">
        <Search size={15} />
        <Typography.Text strong>元数据筛选</Typography.Text>
      </div>
      <Space direction="vertical" className="full-width compact-stack">
        <Input
          prefix={<Search size={15} />}
          placeholder="数据名称或编号"
          value={resourceFilters.q}
          onChange={(event) => updateResourceFilter("q", event.target.value)}
          allowClear
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
          onChange={(nextValue) => updateResourceFilter("dataType", nextValue)}
        />
        <Select
          placeholder="数据分类"
          value={resourceFilters.category}
          allowClear
          options={categoryOptions}
          onChange={(nextValue) => updateResourceFilter("category", nextValue)}
        />
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
          icon={<Filter size={15} />}
          onClick={() => onFilterResources(resourceFilters)}
        >
          筛选数据
        </Button>
      </Space>

      <div className="subsection-title">
        <ListFilter size={15} />
        <Typography.Text strong>数据资源</Typography.Text>
      </div>
      <List
        className="resource-list"
        dataSource={resources}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无数据资源"
            />
          ),
        }}
        renderItem={(resource) => (
          <List.Item
            className={
              resource.id === selectedResourceId
                ? "resource-row resource-row-active"
                : "resource-row"
            }
            actions={[
              <Button
                key="select"
                size="small"
                type={
                  resource.id === selectedResourceId ? "primary" : "default"
                }
                disabled={!resource.isQueryable && !resource.isRenderable}
                onClick={() => onSelectResource(resource)}
              >
                选择
              </Button>,
            ]}
          >
            <List.Item.Meta
              title={
                <span>
                  {resource.name}
                  {!resource.isQueryable && !resource.isRenderable && (
                    <Tag>仅元数据</Tag>
                  )}
                  {resource.isRenderable && <Tag color="blue">栅格</Tag>}
                </span>
              }
              description={`${resource.category?.name ?? "未分类"} · ${resource.fileFormat || resource.dataType}`}
            />
          </List.Item>
        )}
      />

      {profile && (
        <>
          <div className="subsection-title">
            <MapPinned size={15} />
            <Typography.Text strong>字段与元信息</Typography.Text>
          </div>
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="数据来源">
              {profile.resource.source || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="提供单位">
              {profile.resource.provider || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="空间范围">
              {profile.resource.spatialExtent || "-"}
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
              message="正在读取字段信息"
            />
          ) : (
            <List
              size="small"
              className="field-list"
              dataSource={profile.fields}
              renderItem={(item) => (
                <List.Item>
                  <Typography.Text>{item.name}</Typography.Text>
                  <Typography.Text type="secondary">
                    {item.type}
                  </Typography.Text>
                </List.Item>
              )}
            />
          )}
        </>
      )}

      {!selectedIsRaster && (
        <>
          <div className="subsection-title">
            <Crosshair size={15} />
            <Typography.Text strong>空间查询</Typography.Text>
          </div>
          <Segmented
            block
            value={drawMode ?? "none"}
            options={[
              { label: "无", value: "none" },
              { label: "矩形", value: "rectangle" },
              { label: "圆", value: "circle" },
              { label: "椭圆", value: "ellipse" },
              { label: "多边形", value: "polygon" },
            ]}
            onChange={(nextValue) =>
              onDrawModeChange(
                nextValue === "none" ? null : (nextValue as DrawMode),
              )
            }
          />
          <div className="spatial-status">
            {spatialFilter ? (
              <>
                <Tag color="green">
                  已绘制{spatialModeName(spatialFilter.mode)}
                </Tag>
                <Button
                  size="small"
                  icon={<X size={13} />}
                  onClick={onClearSpatialFilter}
                >
                  清除
                </Button>
              </>
            ) : (
              <Typography.Text type="secondary">
                选择图形后在地图上绘制查询范围
              </Typography.Text>
            )}
          </div>

          <div className="subsection-title">
            <Plus size={15} />
            <Typography.Text strong>属性查询</Typography.Text>
          </div>
          <Space direction="vertical" className="full-width compact-stack">
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
            <Button
              icon={<Plus size={15} />}
              disabled={!field || !value.trim()}
              onClick={addAttributeFilter}
            >
              添加属性条件
            </Button>
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

      <div className="query-footer">
        {selectedIsRaster ? (
          permissions.canLoadRasterLayer && (
            <Button
              type="primary"
              disabled={!profile?.raster}
              onClick={onLoadRaster}
            >
              加载栅格
            </Button>
          )
        ) : (
          <>
            {canQueryAndLoadVector && (
              <Button
                type="primary"
                loading={querying}
                disabled={!profile}
                onClick={() => onQuery(attributeFilters)}
              >
                查询数据
              </Button>
            )}
            {permissions.canLoadVectorLayer && (
              <Button
                disabled={!queryResult || queryResult.returnedCount === 0}
                onClick={onLoadResult}
              >
                加载到图层
              </Button>
            )}
          </>
        )}
      </div>
      {queryResult && (
        <Alert
          className="inline-alert"
          type="success"
          showIcon
          message={`查询命中 ${queryResult.totalCount} 条，返回 ${queryResult.returnedCount} 条`}
        />
      )}
    </section>
  );
}

function operatorLabel(operator: AttributeFilter["operator"]) {
  return (
    operatorOptions.find((item) => item.value === operator)?.label ?? operator
  );
}

function spatialModeName(mode: SpatialFilter["mode"]) {
  const names = {
    rectangle: "矩形",
    circle: "圆",
    ellipse: "椭圆",
    polygon: "多边形",
  };
  return names[mode];
}
