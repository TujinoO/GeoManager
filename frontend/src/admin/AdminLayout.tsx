import {
  AuditOutlined,
  DashboardOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { MenuDataItem } from "@ant-design/pro-components";
import { PageContainer, ProLayout } from "@ant-design/pro-components";
import { useMemo } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { useAppContext } from "../contexts/AppContext";
import type { User } from "../types";

const baseAdminRoutes: MenuDataItem[] = [
  {
    path: "/admin/dashboard",
    name: "运行概览",
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
      name: "角色权限",
    },
  ],
};

function adminRouteFor(user: User | null) {
  const routes = [...baseAdminRoutes];
  if (user?.permissions.canViewOperationLogs) {
    routes.push({
      path: "/admin/logs",
      name: "日志管理",
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
  if (user?.permissions.canManageAuth) {
    routes.push(authRoute);
  }
  return {
    path: "/admin",
    routes,
  };
}

const defaultPageMeta = {
  title: "运行概览",
  subTitle: "汇总平台用户活跃、账号与系统监控",
};

const pageMeta: Record<string, { title: string; subTitle: string }> = {
  "/admin/dashboard": defaultPageMeta,
  "/admin/profile": {
    title: "用户设置",
    subTitle: "维护个人信息并查看当前权限",
  },
  "/admin/logs": {
    title: "日志管理",
    subTitle: "查询操作记录并查看后台运行日志",
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
};

export default function AdminLayout() {
  const { user } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const meta = pageMeta[location.pathname] ?? defaultPageMeta;
  const adminRoute = useMemo(() => adminRouteFor(user), [user]);

  return (
    <div className="admin-workspace-shell">
      <WorkspaceHeader
        activeTab="admin"
        canBrowseData={Boolean(user?.permissions.canBrowseData)}
      />
      <ProLayout
        className="admin-pro-layout"
        title="生态保护管理"
        route={adminRoute}
        location={{ pathname: location.pathname }}
        layout="mix"
        headerRender={false}
        fixSiderbar
        contentWidth="Fluid"
        colorPrimary="#2f7d62"
        menuItemRender={(item: MenuDataItem, dom) =>
          item.path ? <Link to={item.path}>{dom}</Link> : dom
        }
        onMenuHeaderClick={() => navigate("/map")}
        token={{
          header: {
            heightLayoutHeader: 90,
          },
          sider: {
            colorMenuBackground: "#fbfdfb",
            colorTextMenu: "#31423d",
            colorTextMenuSelected: "#173f39",
            colorBgMenuItemSelected: "rgba(47, 125, 98, 0.1)",
          },
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
    </div>
  );
}
