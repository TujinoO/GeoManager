import {
  DatabaseOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { ProCard } from "@ant-design/pro-components";
import { Alert, App as AntApp, Button, Empty, Space, Spin } from "antd";
import { useCallback, useEffect, useId, useState } from "react";
import { api } from "../api/client";
import { localText, useEnglishLanguage } from "../i18n/useEnglishLanguage";
import type { DataSchemaSummary } from "../types";
import { flattenTaxonomy, taxonomyTree } from "../utils/taxonomy";

type CatalogNode = DataSchemaSummary["catalogTree"][number];

interface DataSchemaOverviewProps {
  canBrowseData: boolean;
}

export default function DataSchemaOverview({
  canBrowseData,
}: DataSchemaOverviewProps) {
  const { message } = AntApp.useApp();
  const english = useEnglishLanguage();
  const l = (zh: string, en: string) => localText(english, zh, en);
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
        nextError instanceof Error
          ? nextError.message
          : l("数据分类架构加载失败", "Failed to load the data taxonomy");
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [canBrowseData, english, message]);

  useEffect(() => {
    void loadSchema();
  }, [loadSchema]);

  const taxonomyId = useId();
  const catalogGroups = schema ? taxonomyTree(schema) : [];
  const categoryCount = collectSelectableCategories(catalogGroups).length;

  if (!canBrowseData) {
    return (
      <ProCard className="admin-section-card">
        <Alert
          type="info"
          showIcon
          title={l(
            "当前账号暂无平台数据体系浏览权限",
            "This account cannot browse the platform data taxonomy",
          )}
        />
      </ProCard>
    );
  }

  return (
    <ProCard
      className="admin-section-card data-schema-card"
      title={
        <Space>
          <DatabaseOutlined />
          <span>{l("数据体系概览", "Data taxonomy overview")}</span>
        </Space>
      }
      extra={
        <Button
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => void loadSchema()}
        >
          {l("刷新", "Refresh")}
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
          <section className="data-schema-content" aria-labelledby={taxonomyId}>
            <header className="data-schema-intro">
              <div>
                <h3 id={taxonomyId}>
                  {l("平台数据分类", "Platform data taxonomy")}
                </h3>
                <p>
                  {l(
                    "从大类定位主题，再在下方数据列表按小类查看资源。",
                    "Find a subject area here, then browse its categories in the resource list below.",
                  )}
                </p>
              </div>
              <div className="data-schema-counts">
                <span className="data-schema-count">
                  <strong>{catalogGroups.length}</strong>{" "}
                  {l("个大类", "domains")}
                </span>
                <span className="data-schema-count">
                  <strong>{categoryCount}</strong> {l("个小类", "categories")}
                </span>
              </div>
            </header>

            <div className="data-schema-groups">
              {catalogGroups.map((group, index) => (
                <CatalogGroup
                  key={group.code}
                  group={group}
                  sequence={String(index + 1).padStart(2, "0")}
                  english={english}
                />
              ))}
            </div>

            <UnclassifiedDataNote english={english} />
          </section>
        ) : (
          <Empty
            description={l(
              "暂无平台数据体系信息",
              "No platform taxonomy information",
            )}
          />
        )}
      </Spin>
    </ProCard>
  );
}

function CatalogGroup({
  group,
  sequence,
  english,
}: {
  group: CatalogNode;
  sequence: string;
  english: boolean;
}) {
  const titleId = useId();
  const categories = collectSelectableCategories([group]);

  return (
    <article className="data-schema-category" aria-labelledby={titleId}>
      <header className="data-schema-category-header">
        <span className="data-schema-sequence" aria-hidden="true">
          {sequence}
        </span>
        <div>
          <h4 id={titleId}>{group.name}</h4>
          <span className="data-schema-category-count">
            {categories.length} {localText(english, "个小类", "categories")}
          </span>
          <p>{group.description}</p>
        </div>
      </header>
      <ul className="data-schema-leaf-list" role="list">
        {categories.map((category) => (
          <li className="data-schema-leaf" key={category.categoryCode}>
            <strong>{category.name}</strong>
            <p>{category.description}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}

function UnclassifiedDataNote({ english }: { english: boolean }) {
  const titleId = useId();
  const l = (zh: string, en: string) => localText(english, zh, en);
  return (
    <aside className="data-schema-other" aria-labelledby={titleId}>
      <InfoCircleOutlined aria-hidden="true" />
      <div>
        <h4 id={titleId}>
          {l("未分组（其他）数据", "Unclassified (Other) data")}
        </h4>
        <p>
          {l(
            "暂未确定分类的数据仍可在下方列表查看，确认后归入对应小类。",
            "Data awaiting classification remains available in the list below and will be assigned to a category once confirmed.",
          )}
        </p>
      </div>
    </aside>
  );
}

function collectSelectableCategories(nodes: CatalogNode[]): CatalogNode[] {
  return flattenTaxonomy(nodes).filter((node) => node.selectable);
}
