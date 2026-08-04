import type { ProDescriptionsItemProps } from "@ant-design/pro-components";
import { ProCard, ProDescriptions } from "@ant-design/pro-components";
import { App, Skeleton } from "antd";
import type { Key } from "react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";
import { applyPlatformDocumentTitle } from "../config/platformBrand";
import type { AdminSettings, AdminSettingsUpdate } from "../types";

interface BasicSettingValues {
  systemName: string;
  allowRegistration: boolean;
  defaultCenterLon: number;
  defaultCenterLat: number;
  defaultZoom: number;
  defaultBasemap: string;
  mapboxAccessToken: string;
  tiandituAccessToken: string;
  uploadMaxMb: number;
  queryResultLimit: number;
  maxRasterSidePixels: number;
  symbolizerTimeoutSeconds: number;
}

type BasicSettingDescriptionItem = BasicSettingValues;

export const ADMIN_SETTING_RANGES = {
  uploadMaxMb: { min: 1, max: 1024 },
  queryResultLimit: { min: 100, max: 10_000 },
  maxRasterSidePixels: { min: 1, max: 12_000 },
  symbolizerTimeoutSeconds: { min: 10, max: 600 },
} as const;

function integerRangeRule(min: number, max: number, label: string) {
  return {
    type: "number" as const,
    min,
    max,
    message: `${label}必须是 ${min} 到 ${max} 之间的整数`,
  };
}

const basemapValueEnum = {
  satellite: { text: "Mapbox 卫星实景图" },
  "mapbox-streets": { text: "Mapbox 街道图" },
  "tianditu-vector": { text: "天地图矢量注记图" },
};

const settingDescriptionColumns: ProDescriptionsItemProps<BasicSettingDescriptionItem>[] =
  [
    {
      title: "系统名称",
      dataIndex: "systemName",
      span: 3,
      formItemProps: {
        rules: [{ required: true, message: "请输入系统名称" }],
      },
    },
    {
      title: "开放注册",
      dataIndex: "allowRegistration",
      valueType: "switch",
      span: 3,
    },
    {
      title: "默认经度",
      dataIndex: "defaultCenterLon",
      valueType: "digit",
      span: 3,
      fieldProps: {
        min: -180,
        max: 180,
      },
    },
    {
      title: "默认纬度",
      dataIndex: "defaultCenterLat",
      valueType: "digit",
      span: 3,
      fieldProps: {
        min: -90,
        max: 90,
      },
    },
    {
      title: "默认缩放",
      dataIndex: "defaultZoom",
      valueType: "digit",
      span: 3,
      fieldProps: {
        min: 1,
        max: 22,
      },
    },
    {
      title: "默认底图",
      dataIndex: "defaultBasemap",
      valueType: "select",
      valueEnum: basemapValueEnum,
      span: 3,
    },
    {
      title: "Mapbox Token",
      dataIndex: "mapboxAccessToken",
      span: 6,
      copyable: true,
      render: (dom) => <span className="admin-token-text">{dom}</span>,
    },
    {
      title: "天地图浏览器 Key",
      dataIndex: "tiandituAccessToken",
      span: 6,
      copyable: true,
      tooltip:
        "仅填写天地图控制台签发的浏览器端 Key；控制台需同时放行本地 localhost/127.0.0.1 和生产域名，否则会返回 403 域名不匹配",
      render: (dom) => <span className="admin-token-text">{dom}</span>,
    },
    {
      title: "上传上限 MB",
      dataIndex: "uploadMaxMb",
      valueType: "digit",
      span: 2,
      fieldProps: {
        ...ADMIN_SETTING_RANGES.uploadMaxMb,
        precision: 0,
      },
      formItemProps: {
        rules: [
          integerRangeRule(
            ADMIN_SETTING_RANGES.uploadMaxMb.min,
            ADMIN_SETTING_RANGES.uploadMaxMb.max,
            "上传上限",
          ),
        ],
      },
      tooltip:
        "栅格与独立成果文件最高可设置为 1024 MB；矢量和表格受更低的内存安全限制，专题出图 PNG 固定为 128 MB，不随本项变化。应用服务器请求体上限为 1152 MiB。",
    },
    {
      title: "查询结果上限",
      dataIndex: "queryResultLimit",
      valueType: "digit",
      span: 2,
      fieldProps: {
        ...ADMIN_SETTING_RANGES.queryResultLimit,
        precision: 0,
      },
      formItemProps: {
        rules: [integerRangeRule(100, 10_000, "查询结果上限")],
      },
    },
    {
      title: "栅格单边像素上限",
      dataIndex: "maxRasterSidePixels",
      valueType: "digit",
      span: 2,
      fieldProps: {
        ...ADMIN_SETTING_RANGES.maxRasterSidePixels,
        precision: 0,
      },
      formItemProps: {
        rules: [integerRangeRule(1, 12_000, "栅格单边像素上限")],
      },
    },
    {
      title: "栅格超时秒数",
      dataIndex: "symbolizerTimeoutSeconds",
      valueType: "digit",
      span: 2,
      fieldProps: {
        ...ADMIN_SETTING_RANGES.symbolizerTimeoutSeconds,
        precision: 0,
      },
      formItemProps: {
        rules: [integerRangeRule(10, 600, "栅格超时秒数")],
      },
    },
  ];

export default function AdminSystemSettingsPage() {
  const { message } = App.useApp();
  const { bootstrap, setBootstrap } = useAppContext();
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadSettings() {
      try {
        const data = await api.adminSettings();
        if (!mounted) return;
        setSettings(data);
      } catch (error) {
        message.error(
          error instanceof Error ? error.message : "系统设置加载失败",
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    loadSettings();
    return () => {
      mounted = false;
    };
  }, [message]);

  async function handleSave(values: BasicSettingValues): Promise<boolean> {
    try {
      const payload: AdminSettingsUpdate = {
        systemName: values.systemName,
        allowRegistration: values.allowRegistration,
        map: {
          defaultCenter: [values.defaultCenterLon, values.defaultCenterLat],
          defaultZoom: values.defaultZoom,
          defaultBasemap: values.defaultBasemap,
          mapboxAccessToken: values.mapboxAccessToken,
          tiandituAccessToken: values.tiandituAccessToken,
        },
        limits: {
          uploadMaxMb: values.uploadMaxMb,
          queryResultLimit: values.queryResultLimit,
          maxRasterSidePixels: values.maxRasterSidePixels,
        },
        raster: {
          symbolizerTimeoutSeconds: values.symbolizerTimeoutSeconds,
        },
      };
      const updated = await api.updateAdminSettings(payload);
      setSettings(updated);
      setBootstrap({
        ...bootstrap,
        systemName: updated.systemName,
        allowRegistration: updated.allowRegistration,
        map: updated.map,
        limits: updated.limits,
      });
      applyPlatformDocumentTitle(updated.systemName);
      message.success("系统设置已写入运行配置");
      return true;
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "系统设置保存失败",
      );
      return false;
    }
  }

  async function handleDescriptionSave(
    _key: Key | Key[],
    values: BasicSettingDescriptionItem,
  ) {
    if (!settings) return false;
    return handleSave(mergeSettingValues(settings, values));
  }

  if (loading) {
    return (
      <ProCard className="admin-section-card">
        <Skeleton active paragraph={{ rows: 8 }} />
      </ProCard>
    );
  }

  const settingDescriptionData = settings
    ? valuesFromSettings(settings)
    : undefined;

  return (
    <div className="admin-page-stack">
      <ProCard title="基础配置" className="admin-section-card">
        <ProDescriptions<BasicSettingDescriptionItem>
          column={6}
          columns={settingDescriptionColumns}
          dataSource={settingDescriptionData}
          editable={
            settings?.editable
              ? {
                  onSave: handleDescriptionSave,
                }
              : undefined
          }
          emptyText="未配置"
        />
      </ProCard>
    </div>
  );
}

export function mergeSettingValues(
  settings: AdminSettings,
  changedValues: Partial<BasicSettingDescriptionItem>,
): BasicSettingValues {
  const definedValues = Object.fromEntries(
    Object.entries(changedValues).filter(([, value]) => value !== undefined),
  ) as Partial<BasicSettingValues>;
  return {
    ...valuesFromSettings(settings),
    ...definedValues,
  };
}

function valuesFromSettings(settings: AdminSettings): BasicSettingValues {
  const [defaultCenterLon = 80, defaultCenterLat = 41.5] =
    settings.map.defaultCenter;
  return {
    systemName: settings.systemName,
    allowRegistration: settings.allowRegistration,
    defaultCenterLon,
    defaultCenterLat,
    defaultZoom: settings.map.defaultZoom,
    defaultBasemap: settings.map.defaultBasemap,
    mapboxAccessToken: settings.map.mapboxAccessToken,
    tiandituAccessToken: settings.map.tiandituAccessToken ?? "",
    uploadMaxMb: settings.limits.uploadMaxMb,
    queryResultLimit: settings.limits.queryResultLimit,
    maxRasterSidePixels: settings.limits.maxRasterSidePixels,
    symbolizerTimeoutSeconds: settings.raster.symbolizerTimeoutSeconds,
  };
}
