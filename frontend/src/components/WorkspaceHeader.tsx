import {
  ApartmentOutlined,
  DatabaseOutlined,
  EnvironmentOutlined,
  ExperimentOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { App, Avatar, Button, Popover, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";

export type WorkspaceTab = "map" | "nongeo" | "admin";

interface WorkspaceHeaderProps {
  activeTab: WorkspaceTab;
  canBrowseData: boolean;
  dataPanel?: ReactNode;
  dataPanelOpen?: boolean;
  onDataPanelOpenChange?: (open: boolean) => void;
}

export default function WorkspaceHeader({
  activeTab,
  canBrowseData,
  dataPanel,
  dataPanelOpen,
  onDataPanelOpenChange,
}: WorkspaceHeaderProps) {
  const { bootstrap, user, setUser } = useAppContext();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const userRoles = user?.roles ?? [];

  async function handleLogout() {
    try {
      await api.logout();
    } catch (error) {
      message.warning(
        error instanceof Error ? error.message : "退出接口异常，本地会话已清空",
      );
    } finally {
      setUser(null);
    }
  }

  const dataButton = (
    <Button
      icon={<ApartmentOutlined style={{ fontSize: 16 }} />}
      onClick={dataPanel ? undefined : () => navigate("/map")}
    >
      数据管理
    </Button>
  );

  return (
    <header className="workspace-header">
      <div className="header-left">
        <div className="brand-block">
          <DatabaseOutlined style={{ fontSize: 22 }} />
          <div>
            <Typography.Title level={4}>
              {bootstrap.systemName}
            </Typography.Title>
          </div>
        </div>
        <div className="header-primary-actions">
          {canBrowseData &&
            (dataPanel ? (
              <Popover
                trigger="click"
                placement="bottomLeft"
                open={dataPanelOpen}
                onOpenChange={onDataPanelOpenChange}
                classNames={{ root: "data-popover" }}
                styles={{
                  content: {
                    width: "min(440px, calc(100vw - 32px))",
                    maxHeight: "calc(100vh - 110px)",
                    padding: 0,
                    overflow: "auto",
                    background: "rgba(248, 250, 247, 0.92)",
                    border: "1px solid rgba(255, 255, 255, 0.34)",
                    borderRadius: 8,
                    boxShadow:
                      "0 22px 62px rgba(8, 28, 24, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.38)",
                    backdropFilter: "blur(24px) saturate(1.28)",
                  },
                }}
                content={dataPanel}
              >
                {dataButton}
              </Popover>
            ) : (
              dataButton
            ))}
          <button
            type="button"
            className={tabClass(activeTab === "map")}
            onClick={() => navigate("/map")}
          >
            <EnvironmentOutlined style={{ fontSize: 16 }} />
            <span>地理数据界面</span>
          </button>
          <button
            type="button"
            className={tabClass(activeTab === "nongeo")}
            onClick={() => navigate("/nongeo")}
          >
            <ExperimentOutlined style={{ fontSize: 16 }} />
            <span>非地理可视化</span>
          </button>
          <button
            type="button"
            className={tabClass(activeTab === "admin")}
            onClick={() => navigate("/admin")}
          >
            <SettingOutlined style={{ fontSize: 16 }} />
            <span>管理后台</span>
          </button>
        </div>
      </div>
      <div className="header-account-actions">
        <div className="role-tags">
          {userRoles.map((role) => (
            <Tag key={role} color="green">
              {role}
            </Tag>
          ))}
        </div>
        <Button className="user-button">
          <span className="user-button-content">
            <Avatar
              size={24}
              src={user?.avatarUrl || undefined}
              icon={<UserOutlined />}
            />
            <span className="user-button-name">
              {user?.displayName || user?.username || ""}
            </span>
          </span>
        </Button>
        <Button
          icon={<LogoutOutlined style={{ fontSize: 16 }} />}
          onClick={handleLogout}
        >
          退出
        </Button>
      </div>
    </header>
  );
}

function tabClass(active: boolean) {
  return active
    ? "workspace-switch-card workspace-switch-card-active"
    : "workspace-switch-card";
}
