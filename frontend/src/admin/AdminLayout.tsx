import {
  AuditOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  HomeOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { MenuDataItem } from "@ant-design/pro-components";
import { PageContainer, ProLayout } from "@ant-design/pro-components";
import { Button, Tag } from "antd";
import { useMemo } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";
import type { User } from "../types";

const baseAdminRoutes: MenuDataItem[] = [
  {
    path: "/admin/dashboard",
    name: "Dashboard",
    icon: <DashboardOutlined />,
  },
  {
    path: "/admin/profile",
    name: "用户设置",
    icon: <UserOutlined />,
  },
];

const authRoute: MenuDataItem = {
  path: "/admin/auth",
  name: "认证授权",
  icon: <TeamOutlined />,
  children: [
    {
      path: "/admin/auth/users",
      name: "用户管理",
    },
    {
      path: "/admin/auth/groups",
      name: "用户组权限",
    },
  ],
};

function adminRouteFor(user: User | null) {
  const routes = [...baseAdminRoutes];
  if (user?.permissions.canViewOperationLogs) {
    routes.push({
      path: "/admin/logs",
      name: "操作日志",
      icon: <AuditOutlined />,
    });
  }
  if (user?.permissions.canManageSystemSettings) {
    routes.push({
      path: "/admin/settings",
      name: "系统设置",
      icon: <SettingOutlined />,
    });
  }
  if (user?.permissions.canMaintainData) {
    routes.push({
      path: "/admin/data",
      name: "数据管理",
      icon: <DatabaseOutlined />,
      children: [
        {
          path: "/admin/data/inventory",
          name: "存量数据",
        },
        {
          path: "/admin/data/import",
          name: "数据导入",
        },
      ],
    });
  }
  if (user?.permissions.canManageAuth) {
    routes.push(authRoute);
  }
  return {
    path: "/admin",
    routes,
  };
}

const defaultPageMeta = {
  title: "Dashboard",
  subTitle: "汇总平台数据、系统监控与栅格数量",
};

const pageMeta: Record<string, { title: string; subTitle: string }> = {
  "/admin/dashboard": defaultPageMeta,
  "/admin/profile": {
    title: "用户设置",
    subTitle: "维护个人信息并查看当前权限",
  },
  "/admin/logs": {
    title: "操作日志",
    subTitle: "查询、筛选并导出关键操作记录",
  },
  "/admin/settings": {
    title: "系统设置",
    subTitle: "维护基础配置与平台运行参数",
  },
  "/admin/auth": {
    title: "认证授权",
    subTitle: "管理用户、角色和功能权限",
  },
  "/admin/auth/users": {
    title: "认证授权",
    subTitle: "管理用户、角色和功能权限",
  },
  "/admin/auth/groups": {
    title: "认证授权",
    subTitle: "管理用户、角色和功能权限",
  },
  "/admin/data/import": {
    title: "数据导入",
    subTitle: "按文件选择、导入配置、数据预览三个步骤完成入库",
  },
  "/admin/data/inventory": {
    title: "存量数据管理",
    subTitle: "管理已导入数据的状态、默认可视化、权限、删除与导出",
  },
};

export default function AdminLayout() {
  const { user, setUser } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const meta = pageMeta[location.pathname] ?? defaultPageMeta;
  const adminRoute = useMemo(() => adminRouteFor(user), [user]);

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // 退出接口异常时仍清空本地登录态。
    }
    setUser(null);
  }

  return (
    <ProLayout
      className="admin-pro-layout"
      title="生态保护管理"
      route={adminRoute}
      location={{ pathname: location.pathname }}
      layout="mix"
      fixSiderbar
      contentWidth="Fluid"
      colorPrimary="#2f7d62"
      menuItemRender={(item: MenuDataItem, dom) =>
        item.path ? <Link to={item.path}>{dom}</Link> : dom
      }
      onMenuHeaderClick={() => navigate("/")}
      token={{
        header: {
          colorBgHeader: "#173f39",
          colorHeaderTitle: "#ffffff",
          colorTextMenu: "rgba(255, 255, 255, 0.74)",
          colorTextMenuSelected: "#ffffff",
        },
        sider: {
          colorMenuBackground: "#fbfdfb",
          colorTextMenu: "#31423d",
          colorTextMenuSelected: "#173f39",
          colorBgMenuItemSelected: "rgba(47, 125, 98, 0.1)",
        },
      }}
      actionsRender={() => [
        <Button
          key="home"
          icon={<HomeOutlined />}
          onClick={() => navigate("/")}
        >
          业务入口
        </Button>,
        <Button key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
          退出
        </Button>,
      ]}
      avatarProps={{
        icon: <SafetyCertificateOutlined />,
        src: user?.avatarUrl || undefined,
        title: user?.displayName ?? "未登录",
        render: (_, dom) => (
          <div className="admin-avatar-block">
            {dom}
            {user?.roles.map((role) => (
              <Tag key={role} color="green">
                {role}
              </Tag>
            ))}
          </div>
        ),
      }}
      pageTitleRender={false}
    >
      <PageContainer
        title={meta.title}
        subTitle={meta.subTitle}
        className="admin-page-container"
      >
        <Outlet />
      </PageContainer>
    </ProLayout>
  );
}
