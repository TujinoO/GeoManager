import {
  DashboardOutlined,
  DatabaseOutlined,
  ImportOutlined,
} from "@ant-design/icons";
import type { MenuDataItem } from "@ant-design/pro-components";
import { PageContainer, ProLayout } from "@ant-design/pro-components";
import { useMemo } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { useAppContext } from "../contexts/AppContext";
import type { User } from "../types";

const baseResourceRoutes: MenuDataItem[] = [
  {
    path: "/resources/dashboard",
    name: "数据概览",
    icon: <DashboardOutlined />,
  },
];

function resourceRouteFor(user: User | null) {
  const routes = [...baseResourceRoutes];
  if (
    user?.permissions.canMaintainData ||
    user?.permissions.canUploadData ||
    user?.permissions.canExportData
  ) {
    routes.push({
      path: "/resources/data/inventory",
      name: "存量数据",
      icon: <DatabaseOutlined />,
    });
  }
  if (user?.permissions.canUploadData || user?.permissions.canMaintainData) {
    routes.push({
      path: "/resources/data/import",
      name: "数据导入",
      icon: <ImportOutlined />,
    });
  }
  return {
    path: "/resources",
    routes,
  };
}

const defaultPageMeta = {
  title: "数据概览",
  subTitle: "汇总数据资源、图层、栅格和数据体量",
};

const pageMeta: Record<string, { title: string; subTitle: string }> = {
  "/resources/dashboard": defaultPageMeta,
  "/resources/data/import": {
    title: "数据导入",
    subTitle: "按文件选择、导入配置、数据预览三个步骤完成入库",
  },
  "/resources/data/inventory": {
    title: "存量数据管理",
    subTitle: "查看已登记数据，并按权限管理状态、默认可视化、可见范围与导出",
  },
};

export default function ResourceLayout() {
  const { user } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const meta = pageMeta[location.pathname] ?? defaultPageMeta;
  const resourceRoute = useMemo(() => resourceRouteFor(user), [user]);

  return (
    <div className="admin-workspace-shell resource-workspace-shell">
      <WorkspaceHeader
        activeTab="resources"
        canBrowseData={Boolean(user?.permissions.canBrowseData)}
      />
      <ProLayout
        className="admin-pro-layout"
        title="数据管理"
        route={resourceRoute}
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
