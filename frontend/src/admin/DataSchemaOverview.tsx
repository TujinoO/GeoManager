import {
  ApartmentOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
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
  Tag,
  Typography,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { DataSchemaSummary } from "../types";

type CatalogNode = DataSchemaSummary["catalogTree"][number];

const catalogGroupMeta: Record<
  string,
  { sequence: string; shortName: string; tone: string }
> = {
  base_geo: {
    sequence: "01",
    shortName: "空间底座",
    tone: "blue",
  },
  habitat: {
    sequence: "02",
    shortName: "环境本底",
    tone: "green",
  },
  distribution: {
    sequence: "03",
    shortName: "分布证据",
    tone: "cyan",
  },
  thematic: {
    sequence: "04",
    shortName: "专题研究",
    tone: "purple",
  },
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
    if (!canBrowseData) return;
    setLoading(true);
    setError("");
    try {
      setSchema(await api.dataSchemaSummary());
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

  const catalogGroups = schema?.catalogTree ?? [];
  const selectableCategories = useMemo(
    () => collectSelectableCategories(catalogGroups),
    [catalogGroups],
  );

  if (!canBrowseData) {
    return (
      <ProCard className="admin-section-card">
        <Alert type="info" showIcon title="当前账号暂无平台数据体系浏览权限" />
      </ProCard>
    );
  }

  return (
    <ProCard
      className="admin-section-card data-schema-card"
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
        <Alert
          type="error"
          showIcon
          title={error}
          style={{ marginBottom: 16 }}
        />
      )}
      <Spin spinning={loading}>
        {schema ? (
          <div className="data-schema-content">
            <section
              className="data-schema-hero"
              aria-labelledby="schema-title"
            >
              <div className="data-schema-hero-copy">
                <Tag color="success">平台数据分类</Tag>
                <Typography.Title id="schema-title" level={3}>
                  平台数据分为四个大类和十五个小类
                </Typography.Title>
                <Typography.Paragraph>
                  四个大类概括平台数据覆盖的主要领域，十五个小类进一步说明数据的具体内容。每项数据归入一个小类；暂时无法确定分类的数据统一显示在“未分组（其他）”中。
                </Typography.Paragraph>
              </div>
              <div className="data-schema-kpis" aria-label="分类体系关键指标">
                <SchemaKpi
                  value={catalogGroups.length}
                  unit="类"
                  label="数据大类"
                />
                <SchemaKpi
                  value={selectableCategories.length}
                  unit="类"
                  label="数据小类"
                />
                <SchemaKpi value={1} unit="组" label="未分组数据" warning />
              </div>
            </section>

            <section
              className="data-schema-section"
              aria-labelledby="schema-blueprint-title"
            >
              <SectionHeading
                id="schema-blueprint-title"
                icon={<ApartmentOutlined />}
                title="如何查看和使用数据分类"
                description="按照“大类—小类—数据资源”的顺序，快速了解平台有什么数据"
              />
              <div className="data-schema-blueprint">
                <BlueprintStep
                  sequence="01"
                  title="先看四个大类"
                  description="了解基础地理、生境、空间分布和专题研究四个主要数据领域"
                />
                <BlueprintStep
                  sequence="02"
                  title="再看十五个小类"
                  description="根据行政区划、水、土壤、个体、群落、遥感等主题定位数据"
                />
                <BlueprintStep
                  sequence="03"
                  title="展开查看数据"
                  description="在下方分类分组中查看数据数量、规模、状态和具体资源"
                />
                <BlueprintStep
                  sequence="04"
                  title="关注未分组数据"
                  description="尚未明确归属的数据仍可查看，并会在分类确认后归入相应小类"
                />
              </div>
            </section>

            <section
              className="data-schema-section"
              aria-labelledby="schema-taxonomy-title"
            >
              <SectionHeading
                id="schema-taxonomy-title"
                icon={<DatabaseOutlined />}
                title="平台数据分类一览"
                description="每个大类下列出具体小类及其包含的数据内容"
              />
              <div className="data-schema-category-grid">
                {catalogGroups.map((group, index) => (
                  <CatalogGroup key={group.code} group={group} index={index} />
                ))}
              </div>
            </section>

            <UnclassifiedDataNote />
          </div>
        ) : (
          <Empty description="暂无平台数据体系信息" />
        )}
      </Spin>
    </ProCard>
  );
}

function SchemaKpi({
  value,
  unit,
  label,
  warning = false,
}: {
  value: number;
  unit: string;
  label: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`data-schema-kpi${warning ? " data-schema-kpi--warning" : ""}`}
    >
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
      <span>{label}</span>
    </div>
  );
}

function SectionHeading({
  id,
  icon,
  title,
  description,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="data-schema-section-heading">
      <span className="data-schema-section-icon">{icon}</span>
      <div>
        <Typography.Title id={id} level={4}>
          {title}
        </Typography.Title>
        <Typography.Text type="secondary">{description}</Typography.Text>
      </div>
    </div>
  );
}

function BlueprintStep({
  sequence,
  title,
  description,
}: {
  sequence: string;
  title: string;
  description: string;
}) {
  return (
    <article className="data-schema-blueprint-step">
      <span>{sequence}</span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </article>
  );
}

function CatalogGroup({ group, index }: { group: CatalogNode; index: number }) {
  const categories = collectSelectableCategories([group]);
  const meta = catalogGroupMeta[group.code] ?? {
    sequence: String(index + 1).padStart(2, "0"),
    shortName: "业务分类",
    tone: "default",
  };

  return (
    <article
      className={`data-schema-category data-schema-category--${meta.tone}`}
    >
      <header>
        <span className="data-schema-category-sequence">{meta.sequence}</span>
        <div>
          <Typography.Title level={5}>{group.name}</Typography.Title>
          <Typography.Text>{meta.shortName}</Typography.Text>
        </div>
        <Tag>{categories.length} 个小类</Tag>
      </header>
      <Typography.Paragraph className="data-schema-category-description">
        {group.description}
      </Typography.Paragraph>
      <div className="data-schema-leaf-list">
        {categories.map((category, categoryIndex) => (
          <div className="data-schema-leaf" key={category.categoryCode}>
            <span>{String(categoryIndex + 1).padStart(2, "0")}</span>
            <div>
              <strong>{category.name}</strong>
              <small>{category.description}</small>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function UnclassifiedDataNote() {
  return (
    <section className="data-schema-other" aria-labelledby="schema-other-title">
      <div className="data-schema-other-heading">
        <span className="data-schema-other-icon">
          <FileSearchOutlined />
        </span>
        <div>
          <Space size={8} wrap>
            <Typography.Title id="schema-other-title" level={4}>
              未分组（其他）数据
            </Typography.Title>
            <Tag color="warning">等待补充分类</Tag>
          </Space>
          <Typography.Text type="secondary">
            这里集中显示暂时无法确定所属小类的数据。它不是第五个大类，也不会影响用户查看数据内容。
          </Typography.Text>
        </div>
      </div>
      <div className="data-schema-governance-flow" aria-label="未分组数据说明">
        <span>分类暂未明确</span>
        <i>→</i>
        <span>仍可正常查看</span>
        <i>→</i>
        <span>确认后归入对应小类</span>
      </div>
    </section>
  );
}

function collectSelectableCategories(nodes: CatalogNode[]): CatalogNode[] {
  return nodes.flatMap((node) => [
    ...(node.selectable ? [node] : []),
    ...collectSelectableCategories(node.children),
  ]);
}
