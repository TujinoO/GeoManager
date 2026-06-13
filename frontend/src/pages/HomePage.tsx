import {
  DatabaseOutlined,
  EnvironmentOutlined,
  ExperimentOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { Button, Card, Layout, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";

export default function HomePage() {
  const { bootstrap, user, setUser } = useAppContext();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // 退出接口异常，本地会话已清空
    }
    setUser(null);
  }

  return (
    <Layout className="visualization-home">
      <Layout.Header className="portal-header">
        <div className="brand-block">
          <DatabaseOutlined style={{ fontSize: 22 }} />
          <Typography.Title level={4}>{bootstrap.systemName}</Typography.Title>
        </div>
        <div className="header-account-actions">
          <div className="role-tags">
            {user.roles.map((role) => (
              <Tag key={role} color="green">
                {role}
              </Tag>
            ))}
          </div>
          <Button
            icon={<SafetyCertificateOutlined style={{ fontSize: 16 }} />}
            className="user-button"
          >
            {user.displayName}
          </Button>
          <Button
            icon={<LogoutOutlined style={{ fontSize: 16 }} />}
            onClick={handleLogout}
          >
            退出
          </Button>
        </div>
      </Layout.Header>
      <main className="portal-body">
        <section className="visualization-choice-grid">
          <Card
            hoverable
            className="visualization-choice-card geo-choice-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/map")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                navigate("/map");
              }
            }}
          >
            <div className="choice-card-icon">
              <EnvironmentOutlined style={{ fontSize: 36 }} />
            </div>
            <Typography.Title level={2}>地理可视化</Typography.Title>
            <div className="choice-card-tags">
              <Tag color="green">矢量</Tag>
              <Tag color="cyan">栅格</Tag>
            </div>
          </Card>
          <Card
            hoverable
            className="visualization-choice-card nongeo-choice-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/nongeo")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                navigate("/nongeo");
              }
            }}
          >
            <div className="choice-card-icon">
              <ExperimentOutlined style={{ fontSize: 36 }} />
              <TableOutlined style={{ fontSize: 30 }} />
            </div>
            <Typography.Title level={2}>非地理可视化</Typography.Title>
            <div className="choice-card-tags">
              <Tag color="purple">基因</Tag>
              <Tag color="gold">表格</Tag>
            </div>
          </Card>
          <Card
            hoverable
            className="visualization-choice-card import-choice-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/admin")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                navigate("/admin");
              }
            }}
          >
            <div className="choice-card-icon">
              <SettingOutlined style={{ fontSize: 36 }} />
              <SafetyCertificateOutlined style={{ fontSize: 30 }} />
            </div>
            <Typography.Title level={2}>管理后台</Typography.Title>
            <div className="choice-card-tags">
              <Tag color="blue">用户设置</Tag>
              <Tag color="green">数据管理</Tag>
              <Tag color="gold">系统配置</Tag>
            </div>
          </Card>
        </section>
      </main>
    </Layout>
  );
}
