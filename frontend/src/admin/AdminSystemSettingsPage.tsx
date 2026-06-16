import type { ProDescriptionsItemProps } from "@ant-design/pro-components";
import { ProCard, ProDescriptions } from "@ant-design/pro-components";
import { App, Skeleton } from "antd";
import type { Key } from "react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AdminSettings, AdminSettingsUpdate } from "../types";

interface BasicSettingValues {
  systemName: string;
  allowRegistration: boolean;
  defaultCenterLon: number;
  defaultCenterLat: number;
  defaultZoom: number;
  defaultBasemap: string;
  mapboxAccessToken: string;
  uploadMaxMb: number;
  queryResultLimit: number;
  symbolizerTimeoutSeconds: number;
}

type BasicSettingDescriptionItem = BasicSettingValues;

const basemapValueEnum = {
  osm: { text: "OpenStreetMap" },
  satellite: { text: "卫星影像" },
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
      title: "上传上限 MB",
      dataIndex: "uploadMaxMb",
      valueType: "digit",
      span: 2,
      fieldProps: {
        min: 1,
        max: 2048,
      },
    },
    {
      title: "查询结果上限",
      dataIndex: "queryResultLimit",
      valueType: "digit",
      span: 2,
      fieldProps: {
        min: 100,
        max: 30000,
      },
    },
    {
      title: "栅格超时秒数",
      dataIndex: "symbolizerTimeoutSeconds",
      valueType: "digit",
      span: 2,
      fieldProps: {
        min: 10,
        max: 600,
      },
    },
  ];

export default function AdminSystemSettingsPage() {
  const { message } = App.useApp();
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

  async function handleSave(values: BasicSettingValues) {
    const payload: AdminSettingsUpdate = {
      systemName: values.systemName,
      allowRegistration: values.allowRegistration,
      map: {
        defaultCenter: [values.defaultCenterLon, values.defaultCenterLat],
        defaultZoom: values.defaultZoom,
        defaultBasemap: values.defaultBasemap,
        mapboxAccessToken: values.mapboxAccessToken,
      },
      limits: {
        uploadMaxMb: values.uploadMaxMb,
        queryResultLimit: values.queryResultLimit,
      },
      raster: {
        symbolizerTimeoutSeconds: values.symbolizerTimeoutSeconds,
      },
    };
    const updated = await api.updateAdminSettings(payload);
    setSettings(updated);
    message.success("系统设置已写入运行配置");
    return true;
  }

  async function handleDescriptionSave(
    _key: Key | Key[],
    values: BasicSettingDescriptionItem,
  ) {
    await handleSave(values);
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
    uploadMaxMb: settings.limits.uploadMaxMb,
    queryResultLimit: settings.limits.queryResultLimit,
    symbolizerTimeoutSeconds: settings.raster.symbolizerTimeoutSeconds,
  };
}
