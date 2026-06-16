import {
  ApartmentOutlined,
  BookOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  LogoutOutlined,
  QrcodeOutlined,
  SearchOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  App,
  Avatar,
  Button,
  Input,
  Popover,
  QRCode,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import type { ReactNode } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import capfedLogo from "../assets/capfed-logo.png";
import { api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";

export type WorkspaceTab = "map" | "nongeo" | "admin";
type SearchScope = "geo" | "nongeo";

const platformChineseName = "中亚胡杨林生态系统保护数据共享平台";

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
  const [searchScope, setSearchScope] = useState<SearchScope>("geo");
  const [searchText, setSearchText] = useState("");

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

  function handleSearch(value: string) {
    const keyword = value.trim();
    const scopeLabel = searchScope === "geo" ? "地理数据" : "非地理数据";
    if (searchScope === "geo") {
      navigate("/map");
      onDataPanelOpenChange?.(Boolean(dataPanel));
    } else {
      navigate("/nongeo");
    }
    if (keyword) {
      message.info(`已进入${scopeLabel}检索入口：${keyword}`);
    } else {
      message.info(`已切换到${scopeLabel}检索入口`);
    }
  }

  function handleResourceCenter() {
    if (!canBrowseData) {
      message.warning("当前账号暂无数据资源浏览权限");
      return;
    }
    navigate("/map");
    onDataPanelOpenChange?.(Boolean(dataPanel));
  }

  const dataButton = (
    <button
      type="button"
      className={tabClass(false)}
      onClick={dataPanel ? undefined : handleResourceCenter}
    >
      <FolderOpenOutlined aria-hidden="true" style={{ fontSize: 16 }} />
      <span>资源中心</span>
    </button>
  );

  const wechatContent = (
    <div className="wechat-popover-content">
      <QRCode
        value="https://example.local/capfed-wechat"
        size={136}
        bordered={false}
        color="#173f39"
      />
      <strong>中亚胡杨林数据平台</strong>
      <span>微信公众号二维码示意</span>
    </div>
  );

  const aboutContent = (
    <div className="about-popover-content">
      <strong>{bootstrap.systemName}</strong>
      <span>面向胡杨林生态系统保护的数据共享、目录检索与三维地理可视化平台。</span>
    </div>
  );

  const userContent = (
    <div className="user-popover-content">
      <div className="user-popover-head">
        <Avatar
          size={42}
          src={user?.avatarUrl || undefined}
          icon={<UserOutlined />}
        />
        <span>
          <strong>{user?.displayName || user?.username || "当前用户"}</strong>
          <small>{user?.username}</small>
        </span>
      </div>
      <div className="user-popover-meta">
        {user?.department && <span>部门：{user.department}</span>}
        {user?.email && <span>邮箱：{user.email}</span>}
      </div>
      <Space wrap className="user-popover-roles">
        {userRoles.map((role) => (
          <Tag key={role} color="green">
            {role}
          </Tag>
        ))}
      </Space>
      <div className="user-popover-actions">
        <Button size="small" onClick={() => navigate("/admin/profile")}>
          个人信息
        </Button>
        <Button size="small" icon={<LogoutOutlined />} onClick={handleLogout}>
          安全退出
        </Button>
      </div>
    </div>
  );

  return (
    <header className="workspace-header">
      <div className="brand-block">
        <span className="brand-logo-frame">
          <img src={capfedLogo} alt={`${bootstrap.systemName} Logo`} />
        </span>
        <div className="brand-copy">
          <strong>CAPFED</strong>
          <Typography.Title level={4}>{platformChineseName}</Typography.Title>
        </div>
      </div>

      <Space.Compact className="workspace-global-search">
        <Select<SearchScope>
          className="workspace-search-select"
          value={searchScope}
          options={[
            { value: "geo", label: "地理数据" },
            { value: "nongeo", label: "非地理数据" },
          ]}
          onChange={setSearchScope}
          popupMatchSelectWidth={132}
        />
        <Input.Search
          className="workspace-global-input"
          allowClear
          enterButton={
            <Button type="primary" icon={<SearchOutlined />}>
              搜索
            </Button>
          }
          value={searchText}
          placeholder="请输入数据、图层、站点或成果关键词"
          onChange={(event) => setSearchText(event.target.value)}
          onSearch={handleSearch}
        />
      </Space.Compact>

      <div className="header-primary-actions" aria-label="主导航">
        <button
          type="button"
          className={tabClass(false)}
          onClick={() => navigate("/map")}
        >
          <HomeOutlined aria-hidden="true" style={{ fontSize: 16 }} />
          <span>首页</span>
        </button>
        <button
          type="button"
          className={tabClass(activeTab === "map")}
          onClick={() => navigate("/map")}
        >
          <ApartmentOutlined aria-hidden="true" style={{ fontSize: 16 }} />
          <span>地理数据</span>
        </button>
        <button
          type="button"
          className={tabClass(activeTab === "nongeo")}
          onClick={() => navigate("/nongeo")}
        >
          <BookOutlined aria-hidden="true" style={{ fontSize: 16 }} />
          <span>非地理数据</span>
        </button>
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
            className={tabClass(false)}
            onClick={() => message.info("成果目录页面正在接入")}
          >
            <BookOutlined aria-hidden="true" style={{ fontSize: 16 }} />
            <span>成果目录</span>
          </button>
          <button
            type="button"
            className={tabClass(activeTab === "admin")}
            onClick={() => navigate("/admin")}
          >
            <SettingOutlined aria-hidden="true" style={{ fontSize: 16 }} />
            <span>后台管理</span>
          </button>
          <Popover
            trigger="click"
            placement="bottom"
            content={aboutContent}
            overlayClassName="workspace-info-popover"
          >
            <button type="button" className={tabClass(false)}>
              <InfoCircleOutlined aria-hidden="true" style={{ fontSize: 16 }} />
              <span>关于我们</span>
            </button>
          </Popover>
      </div>

      <div className="header-account-actions">
        <Popover
          trigger="click"
          placement="bottomRight"
          content={wechatContent}
          overlayClassName="workspace-info-popover"
        >
          <Button className="wechat-button" icon={<QrcodeOutlined />}>
            公众号
          </Button>
        </Popover>
        <span className="role-tags">
          {userRoles.slice(0, 1).map((role) => (
            <Tag key={role} color="green">
              {role}
            </Tag>
          ))}
        </span>
        <Popover
          trigger="click"
          placement="bottomRight"
          content={userContent}
          overlayClassName="workspace-info-popover"
        >
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
        </Popover>
        <Button icon={<LogoutOutlined />} onClick={handleLogout}>
          安全退出
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
