import { Card, Space, Tag, Typography } from "antd";
import { useAppContext } from "../contexts/AppContext";
import { currentLocale } from "../i18n";

export default function AccountCapabilities() {
  const { user } = useAppContext();
  if (!user) return null;
  const en = currentLocale() === "en-US";
  const p = user.permissions;
  const capabilities = [
    [en ? "Browse data" : "数据浏览", p.canBrowseData],
    [en ? "Query data" : "数据查询", p.canQueryData],
    [en ? "Vector layers" : "矢量可视化", p.canLoadVectorLayer],
    [en ? "Raster layers" : "栅格可视化", p.canLoadRasterLayer],
    [en ? "Import" : "数据导入", p.canUploadData],
    [en ? "Export" : "数据导出", p.canExportData],
    [en ? "Save projects" : "工程保存", p.canCreateWorkspaces],
    [en ? "Map composition" : "专题制图", p.canCreateMapCompositions],
    [en ? "Publish maps" : "专题发布", p.canPublishMapCompositions],
    [en ? "Content management" : "科普与动态维护", p.canManageAuth],
  ] as const;
  return (
    <Card title={en ? "Account capabilities" : "当前账号可用功能"} size="small">
      <Space wrap>
        {capabilities.map(([label, enabled]) => (
          <Tag key={label} color={enabled ? "green" : undefined}>
            {label} ·{" "}
            {enabled
              ? en
                ? "Enabled"
                : "已开通"
              : en
                ? "Not granted"
                : "未授权"}
          </Tag>
        ))}
      </Space>
      <Typography.Paragraph
        type="secondary"
        style={{ marginTop: 12, marginBottom: 0 }}
      >
        {en
          ? "Data access also depends on each resource's visible roles. Contact an administrator to request access."
          : "具体数据还受资源可见角色限制；需要更多权限时请联系管理员。"}
      </Typography.Paragraph>
    </Card>
  );
}
