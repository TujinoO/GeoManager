import {
  EnvironmentOutlined,
  FilterOutlined,
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
  Progress,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  DataResourceProfile,
  ResourceFilters,
  ResourceListItem,
  User,
} from "../types";
import AttributeQueryForm, {
  type AttributeQuerySubmit,
} from "./AttributeQueryForm";
import {
  resourceCategoryName,
  resourceFormatLabel,
  resourceProvider,
  resourceSpatialExtent,
} from "../utils/resources";

export interface DataResourceLoadProgress {
  percent: number;
  message: string;
}

export type DataResourceLoadReporter = (
  progress: DataResourceLoadProgress,
) => void;

interface Props {
  resources: ResourceListItem[];
  profile: DataResourceProfile | null;
  selectedResourceId: ResourceListItem["id"] | null;
  loadingResources?: boolean;
  loadingProfile: boolean;
  querying: boolean;
  permissions: User["permissions"];
  categoryOptions?: Array<{ value: string; label: string }>;
  selectedCategoryCode?: string | null;
  searchKeyword?: string;
  onFilterResources: (filters: ResourceFilters) => void;
  onSelectResource: (resource: ResourceListItem) => void;
  onQuickLoadResource: (
    resource: ResourceListItem,
    reportProgress: DataResourceLoadReporter,
  ) => Promise<void> | void;
  onQueryAndLoad: AttributeQuerySubmit;
  onLoadRaster: (
    reportProgress: DataResourceLoadReporter,
  ) => Promise<void> | void;
}

const allDataFilterValue = "__all__";

export default function DataPanel({
  resources,
  profile,
  selectedResourceId,
  loadingResources = false,
  loadingProfile,
  querying,
  permissions,
  categoryOptions = [],
  selectedCategoryCode,
  searchKeyword,
  onFilterResources,
  onSelectResource,
  onQuickLoadResource,
  onQueryAndLoad,
  onLoadRaster,
}: Props) {
  const { t } = useTranslation();
  const [resourceFilters, setResourceFilters] = useState<ResourceFilters>({});
  const [resourceLoadProgress, setResourceLoadProgress] = useState(
    () => new Map<ResourceListItem["id"], DataResourceLoadProgress>(),
  );

  const categoryFilterOptions = useMemo(
    () => [
      { value: allDataFilterValue, label: t("map.allCategories") },
      ...categoryOptions,
    ],
    [categoryOptions, t],
  );
  const selectedIsRaster = profile?.resource.dataType === "raster";
  const canQueryAndLoadVector =
    permissions.canQueryData && permissions.canLoadVectorLayer;
  const selectedProfile =
    profile?.resource.id === selectedResourceId ? profile : null;

  useEffect(() => {
    const nextQuery = searchKeyword?.trim() || undefined;
    setResourceFilters((current) =>
      current.q === nextQuery
        ? current
        : withResourceFilterValue(current, "q", nextQuery),
    );
  }, [searchKeyword]);

  useEffect(() => {
    const nextCategoryCode = selectedCategoryCode ?? undefined;
    setResourceFilters((current) =>
      current.categoryCode === nextCategoryCode
        ? current
        : withResourceFilterValue(current, "categoryCode", nextCategoryCode),
    );
  }, [selectedCategoryCode]);

  function updateResourceFilter(
    key: keyof ResourceFilters,
    nextValue?: string,
  ) {
    setResourceFilters((current) =>
      withResourceFilterValue(current, key, nextValue),
    );
  }

  function updateAndFilterResources(
    key: keyof ResourceFilters,
    nextValue?: string,
  ) {
    const nextFilters = withResourceFilterValue(
      resourceFilters,
      key,
      nextValue,
    );
    setResourceFilters(nextFilters);
    onFilterResources(cleanResourceFilters(nextFilters));
  }

  function resourcePrimaryCategoryName(resource: ResourceListItem) {
    return (
      resource.categoryPath?.map((item) => item.name).join(" / ") ||
      resourceCategoryName(resource)
    );
  }

  function reportResourceLoad(
    resourceId: ResourceListItem["id"],
    progress: DataResourceLoadProgress,
  ) {
    setResourceLoadProgress((current) => {
      const next = new Map(current);
      next.set(resourceId, {
        percent: Math.min(100, Math.max(0, progress.percent)),
        message: progress.message,
      });
      return next;
    });
  }

  async function runResourceLoad(
    resource: ResourceListItem,
    loader: (reportProgress: DataResourceLoadReporter) => Promise<void> | void,
  ) {
    reportResourceLoad(resource.id, {
      percent: 5,
      message: t("map.loadingResourceInfo"),
    });
    try {
      await loader((progress) => reportResourceLoad(resource.id, progress));
    } finally {
      setResourceLoadProgress((current) => {
        const next = new Map(current);
        next.delete(resource.id);
        return next;
      });
    }
  }

  async function quickLoadResource(resource: ResourceListItem) {
    await runResourceLoad(resource, (reportProgress) =>
      onQuickLoadResource(resource, reportProgress),
    );
  }

  async function loadSelectedRaster() {
    const resource = resources.find((item) => item.id === selectedResourceId);
    if (!resource) return;
    await runResourceLoad(resource, onLoadRaster);
  }

  return (
    <section className="panel-section data-panel">
      <div className="subsection-title">
        <SearchOutlined style={{ fontSize: 15 }} />
        <Typography.Text strong>{t("map.metadataFilter")}</Typography.Text>
      </div>
      <Space orientation="vertical" className="full-width compact-stack">
        <Input
          prefix={<SearchOutlined style={{ fontSize: 15 }} />}
          placeholder={t("map.resourceSearchPlaceholder")}
          value={resourceFilters.q}
          onChange={(event) => updateResourceFilter("q", event.target.value)}
          allowClear
        />
        <div className="data-filter-row">
          <Select
            placeholder={t("map.dataCategory")}
            value={resourceFilters.categoryCode ?? allDataFilterValue}
            allowClear
            options={categoryFilterOptions}
            onChange={(nextValue) => {
              updateAndFilterResources(
                "categoryCode",
                nextValue === allDataFilterValue ? undefined : nextValue,
              );
            }}
          />
          <Select
            placeholder={t("map.dataType")}
            value={resourceFilters.dataType}
            allowClear
            options={[
              { value: "vector", label: t("map.vectorData") },
              { value: "raster", label: t("map.rasterData") },
              { value: "table", label: t("map.tabularData") },
              { value: "document", label: t("map.documentData") },
              { value: "image", label: t("map.imageData") },
            ]}
            onChange={(nextValue) =>
              updateResourceFilter("dataType", nextValue)
            }
          />
        </div>
        <Input
          placeholder={t("map.dataSource")}
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
          onClick={() =>
            onFilterResources(cleanResourceFilters(resourceFilters))
          }
        >
          {t("map.filterData")}
        </Button>
      </Space>

      <div className="subsection-title">
        <UnorderedListOutlined style={{ fontSize: 15 }} />
        <Typography.Text strong>{t("map.dataResources")}</Typography.Text>
      </div>
      {resources.length > 0 ? (
        <ul className="resource-list" aria-label={t("map.dataResources")}>
          {resources.map((resource) => {
            const loadProgress = resourceLoadProgress.get(resource.id);
            return (
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
                      <Tag>{t("common.metadataOnly")}</Tag>
                    )}
                    {resource.isRenderable && (
                      <Tag color="blue">{t("common.raster")}</Tag>
                    )}
                  </Typography.Text>
                  <Typography.Text
                    type="secondary"
                    className="resource-row-meta"
                  >
                    {resourcePrimaryCategoryName(resource) ??
                      t("common.uncategorized")}{" "}
                    · {resourceFormatLabel(resource)}
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
                  {t("common.select")}
                </Button>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  className="resource-quick-load-button"
                  disabled={
                    resource.dataType === "raster"
                      ? !resource.isRenderable ||
                        !permissions.canLoadRasterLayer
                      : !resource.isQueryable || !canQueryAndLoadVector
                  }
                  loading={Boolean(loadProgress)}
                  onClick={() => void quickLoadResource(resource)}
                >
                  {t("map.quickLoad")}
                </Button>
                {loadProgress && (
                  <DataResourceLoadFeedback
                    resource={resource}
                    progress={loadProgress}
                  />
                )}
              </li>
            );
          })}
        </ul>
      ) : loadingResources ? (
        <div className="data-panel-loading" role="status">
          <Spin size="small" />
          <Typography.Text type="secondary">
            {t("map.syncingCatalog")}
          </Typography.Text>
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("map.noResources")}
        />
      )}

      {canQueryAndLoadVector &&
        !loadingProfile &&
        selectedProfile?.resource.dataType === "vector" &&
        selectedProfile.resource.isQueryable &&
        selectedProfile.fields.length > 0 && (
          <AttributeQueryForm
            key={selectedProfile.resource.id}
            fields={selectedProfile.fields}
            querying={querying}
            onSubmit={onQueryAndLoad}
          />
        )}

      {profile && (
        <>
          <div className="subsection-title">
            <EnvironmentOutlined style={{ fontSize: 15 }} />
            <Typography.Text strong>
              {t("map.fieldsAndMetadata")}
            </Typography.Text>
          </div>
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label={t("map.dataSource")}>
              {profile.resource.source || "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("map.provider")}>
              {resourceProvider(profile.resource) || "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("map.spatialExtent")}>
              {resourceSpatialExtent(profile.resource) || "-"}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                selectedIsRaster ? t("map.bandCount") : t("map.featureCount")
              }
            >
              {selectedIsRaster
                ? (profile.raster?.bandCount ?? "-")
                : (profile.featureCount ?? "-")}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                selectedIsRaster ? t("map.rasterSize") : t("map.geometryType")
              }
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
              title={t("map.readingFields")}
            />
          ) : (
            <ul className="field-list" aria-label={t("map.fieldList")}>
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

      {selectedIsRaster && permissions.canLoadRasterLayer && (
        <div className="query-footer">
          <Button
            type="primary"
            disabled={!profile?.raster}
            loading={
              selectedResourceId !== null &&
              resourceLoadProgress.has(selectedResourceId)
            }
            onClick={() => void loadSelectedRaster()}
          >
            {t("map.loadRaster")}
          </Button>
        </div>
      )}
    </section>
  );
}

function DataResourceLoadFeedback({
  resource,
  progress,
}: {
  resource: ResourceListItem;
  progress: DataResourceLoadProgress;
}) {
  const { t } = useTranslation();
  const percent = Math.round(progress.percent);
  return (
    <div
      className="data-resource-load-feedback"
      role="status"
      aria-live="polite"
      aria-label={t("map.loadProgress", { name: resource.name })}
    >
      <div className="data-resource-load-heading">
        <span>
          <Spin size="small" />
          {t("map.loadingToGlobe")}
        </span>
        <b>{percent}%</b>
      </div>
      <Progress percent={percent} size="small" showInfo={false} />
      <small>{progress.message}</small>
    </div>
  );
}

function withResourceFilterValue(
  filters: ResourceFilters,
  key: keyof ResourceFilters,
  nextValue?: string,
): ResourceFilters {
  const next = { ...filters };
  const keyName = key as string;
  if (nextValue?.trim()) {
    (next as Record<string, unknown>)[keyName] = nextValue;
  } else {
    delete (next as Record<string, unknown>)[keyName];
  }
  return next;
}

function cleanResourceFilters(filters: ResourceFilters): ResourceFilters {
  const next = { ...filters };
  Object.entries(next).forEach(([key, value]) => {
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && !value.trim())
    ) {
      delete (next as Record<string, unknown>)[key];
    }
  });
  return next;
}
