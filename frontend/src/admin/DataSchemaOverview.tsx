import {
  DatabaseOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { ProCard } from "@ant-design/pro-components";
import {
  Alert,
  App as AntApp,
  Button,
  Empty,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { DataSchemaSummary } from "../types";

type SchemaEntity = DataSchemaSummary["entities"][number];
type CatalogNode = DataSchemaSummary["catalogTree"][number];
type SchemaDomain = DataSchemaSummary["domains"][number];

const spatialClassLabels: Record<string, string> = {
  spatial: "地理数据",
  non_spatial: "非地理数据",
  spatialized_table: "可空间化表格",
  derived_from_spatial: "空间对象关联",
};

const domainColors: Record<string, string> = {
  germplasm: "green",
  genome: "geekblue",
  individual: "cyan",
  community: "lime",
  population: "gold",
  field_survey: "orange",
  remote_sensing: "blue",
  molecular: "purple",
};

const resourceTypeLabels: Record<string, string> = {
  vector: "矢量",
  raster: "栅格",
  gene: "组学/基因",
  table: "表格",
  document: "文档",
  image: "影像/照片",
};

const catalogGroupNames: Record<string, string> = {
  geo: "地理数据目录",
  nongeo: "非地理数据目录",
};

interface DataSchemaOverviewProps {
  canBrowseData: boolean;
}

export default function DataSchemaOverview({
  canBrowseData,
}: DataSchemaOverviewProps) {
  const { message } = AntApp.useApp();
  const [schema, setSchema] = useState<DataSchemaSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadSchema = useCallback(async () => {
    if (!canBrowseData) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const schemaResult = await api.dataSchemaSummary();
      setSchema(schemaResult);
    } catch (nextError) {
      const messageText =
        nextError instanceof Error ? nextError.message : "数据分类架构加载失败";
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [canBrowseData, message]);

  useEffect(() => {
    void loadSchema();
  }, [loadSchema]);

  const domainNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    schema?.domains.forEach((domain) => map.set(domain.code, domain.name));
    return map;
  }, [schema]);

  const catalogGroups = schema?.catalogTree ?? [];
  const geoDomainCodes = useMemo(
    () =>
      collectCatalogDomainCodes(
        catalogGroups.find((node) => node.code === "geo")?.children ?? [],
      ),
    [catalogGroups],
  );
  const nonGeoDomainCodes = useMemo(
    () =>
      collectCatalogDomainCodes(
        catalogGroups.find((node) => node.code === "nongeo")?.children ?? [],
      ),
    [catalogGroups],
  );
  const domainCatalogByCode = useMemo(() => {
    const map = new Map<string, string[]>();
    geoDomainCodes.forEach((code) => map.set(code, ["geo"]));
    nonGeoDomainCodes.forEach((code) => {
      map.set(code, [...(map.get(code) ?? []), "nongeo"]);
    });
    return map;
  }, [geoDomainCodes, nonGeoDomainCodes]);

  const domainColumns = useMemo<ColumnsType<SchemaDomain>>(
    () => [
      {
        title: "业务类型",
        key: "domain",
        width: 170,
        render: (_, record) => (
          <Space orientation="vertical" size={0}>
            <Typography.Text strong>{record.name}</Typography.Text>
            <Typography.Text type="secondary" className="admin-table-subtext">
              {record.code}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: "目录归属",
        key: "catalog",
        width: 170,
        render: (_, record) => (
          <Space size={[4, 4]} wrap>
            {(domainCatalogByCode.get(record.code) ?? []).map((code) => (
              <Tag key={code}>
                {code === "geo" ? "地理数据" : "非地理数据"}
              </Tag>
            ))}
          </Space>
        ),
      },
      {
        title: "空间属性",
        dataIndex: "spatialClass",
        key: "spatialClass",
        width: 130,
        render: (value: string) => (
          <Tag>{spatialClassLabels[value] ?? value}</Tag>
        ),
      },
      {
        title: "资源形态",
        dataIndex: "recommendedResourceTypes",
        key: "recommendedResourceTypes",
        width: 220,
        render: (values: string[]) => (
          <Space size={[4, 4]} wrap>
            {values.map((value) => (
              <Tag key={value}>{resourceTypeLabels[value] ?? value}</Tag>
            ))}
          </Space>
        ),
      },
      {
        title: "标准实体",
        dataIndex: "coreEntities",
        key: "coreEntities",
        width: 300,
        render: (values: string[]) => (
          <Space size={[4, 4]} wrap>
            {values.map((value) => (
              <Tag key={value}>{value}</Tag>
            ))}
          </Space>
        ),
      },
    ],
    [domainCatalogByCode],
  );

  const entityColumns = useMemo<ColumnsType<SchemaEntity>>(
    () => [
      {
        title: "标准实体/表",
        key: "entity",
        width: 230,
        render: (_, record) => (
          <Space orientation="vertical" size={0}>
            <Typography.Text strong>{record.label}</Typography.Text>
            <Typography.Text type="secondary" className="admin-table-subtext">
              {record.name}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: "关联业务类型",
        dataIndex: "domainTypes",
        key: "domainTypes",
        width: 260,
        render: (values: string[]) => (
          <Space size={[4, 4]} wrap>
            {values.map((value) => (
              <Tag key={value} color={domainColors[value]}>
                {domainNameByCode.get(value) ?? value}
              </Tag>
            ))}
          </Space>
        ),
      },
      {
        title: "关键字段",
        dataIndex: "keyFields",
        key: "keyFields",
        width: 360,
        render: (values: string[]) => (
          <Space size={[4, 4]} wrap>
            {values.map((value) => (
              <Tag key={value}>{value}</Tag>
            ))}
          </Space>
        ),
      },
    ],
    [domainNameByCode],
  );

  if (!canBrowseData) {
    return (
      <ProCard className="admin-section-card">
        <Alert
          type="info"
          showIcon
          message="当前账号暂无平台数据体系浏览权限"
        />
      </ProCard>
    );
  }

  return (
    <ProCard
      className="admin-section-card"
      title={
        <Space>
          <DatabaseOutlined />
          <span>数据体系概览</span>
        </Space>
      }
      extra={
        <Button
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => void loadSchema()}
        >
          刷新
        </Button>
      }
    >
      {error && (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
      )}
      <Spin spinning={loading}>
        {schema ? (
          <Space direction="vertical" size={14} style={{ width: "100%" }}>
            <div className="schema-overview-summary">
              <div className="schema-stat-tile">
                <Statistic
                  title="业务数据类型"
                  value={schema.domains.length}
                  suffix="类"
                />
              </div>
              <div className="schema-stat-tile">
                <Statistic
                  title="地理数据目录"
                  value={geoDomainCodes.length}
                  suffix="类"
                />
              </div>
              <div className="schema-stat-tile">
                <Statistic
                  title="非地理数据目录"
                  value={nonGeoDomainCodes.length}
                  suffix="类"
                />
              </div>
              <div className="schema-stat-tile">
                <Statistic
                  title="核心标准实体"
                  value={schema.entities.length}
                  suffix="张"
                />
              </div>
            </div>

            <div className="schema-catalog-split">
              {catalogGroups.map((group) => (
                <CatalogGroup key={group.code} group={group} />
              ))}
            </div>

            <section className="schema-overview-panel">
              <SectionHeading title="业务分类" />
              <Table<SchemaDomain>
                rowKey="code"
                size="small"
                columns={domainColumns}
                dataSource={schema.domains}
                pagination={false}
                scroll={{ x: 990 }}
              />
            </section>

            <section className="schema-overview-panel">
              <SectionHeading title="标准实体索引" />
              <Table<SchemaEntity>
                rowKey="name"
                size="small"
                columns={entityColumns}
                dataSource={schema.entities}
                pagination={{ pageSize: 6, hideOnSinglePage: true }}
                scroll={{ x: 850 }}
              />
            </section>
          </Space>
        ) : (
          <Empty description="暂无平台数据体系信息" />
        )}
      </Spin>
    </ProCard>
  );
}

function SectionHeading({
  title,
  extra,
}: {
  title: string;
  extra?: string;
}) {
  return (
    <Space align="center" className="schema-section-heading">
      <Space size={8}>
        <DatabaseOutlined />
        <Typography.Text strong>{title}</Typography.Text>
      </Space>
      {extra && (
        <Typography.Text type="secondary" className="admin-table-subtext">
          {extra}
        </Typography.Text>
      )}
    </Space>
  );
}

function CatalogGroup({ group }: { group: CatalogNode }) {
  return (
    <article className="schema-catalog-group">
      <Space align="center" className="schema-section-heading">
        <Space size={6} wrap>
          <Typography.Text strong>
            {catalogGroupNames[group.code] ?? group.name}
          </Typography.Text>
          {group.spatialClass && (
            <Tag>{spatialClassLabels[group.spatialClass] ?? group.spatialClass}</Tag>
          )}
        </Space>
        <Typography.Text type="secondary" className="admin-table-subtext">
          {collectCatalogDomainCodes(group.children).length} 类
        </Typography.Text>
      </Space>
      <Space size={[6, 6]} wrap>
        {group.children.map((child) => (
          <Tag key={child.code} color={domainColors[child.domainType ?? ""]}>
            {child.name}
          </Tag>
        ))}
      </Space>
    </article>
  );
}

function collectCatalogDomainCodes(nodes: CatalogNode[]) {
  const codes = new Set<string>();
  nodes.forEach((node) => {
    if (node.domainType) {
      codes.add(node.domainType);
    }
    collectCatalogDomainCodes(node.children).forEach((code) => codes.add(code));
  });
  return Array.from(codes);
}
