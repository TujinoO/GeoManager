import {
  CloudUploadOutlined,
  DatabaseOutlined,
  HddOutlined,
} from "@ant-design/icons";
import { ProCard } from "@ant-design/pro-components";
import { Alert, Button, Descriptions, Select, Space, Switch, Tag } from "antd";

const cloudTargetOptions = [
  { label: "云端对象存储", value: "object-storage" },
  { label: "异地备份仓库", value: "remote-archive" },
];

const backupSections = [
  {
    key: "research",
    title: "科研数据备份",
    icon: <HddOutlined />,
    scope: "vector、raster、gene、table",
    source: "科研数据根目录",
    schedule: "每日 02:00",
  },
  {
    key: "platform",
    title: "平台数据备份",
    icon: <DatabaseOutlined />,
    scope: "SQLite 数据库、上传附件、系统配置、运行日志",
    source: "业务数据根目录",
    schedule: "每日 03:00",
  },
];

export default function AdminDataBackupPage() {
  return (
    <div className="admin-page-stack admin-backup-page">
      <Alert
        type="warning"
        showIcon
        title="数据备份功能暂未实现"
        description="当前页面仅保留后台入口和配置界面占位，暂不执行云端备份任务。"
      />

      <div className="backup-card-grid">
        {backupSections.map((section) => (
          <ProCard
            key={section.key}
            className="admin-section-card backup-plan-card"
            title={
              <Space size={8}>
                {section.icon}
                <span>{section.title}</span>
              </Space>
            }
            extra={<Tag color="default">暂未实现</Tag>}
          >
            <Descriptions
              size="small"
              column={1}
              items={[
                { key: "source", label: "数据来源", children: section.source },
                { key: "scope", label: "备份范围", children: section.scope },
                {
                  key: "schedule",
                  label: "计划时间",
                  children: section.schedule,
                },
              ]}
            />

            <div className="backup-control-row">
              <span>启用自动备份</span>
              <Switch disabled checkedChildren="开" unCheckedChildren="关" />
            </div>

            <div className="backup-control-row">
              <span>云端目标</span>
              <Select
                disabled
                value="object-storage"
                options={cloudTargetOptions}
                className="backup-target-select"
              />
            </div>

            <Button
              block
              disabled
              icon={<CloudUploadOutlined />}
              className="backup-action-button"
            >
              立即备份到云端
            </Button>
          </ProCard>
        ))}
      </div>
    </div>
  );
}
