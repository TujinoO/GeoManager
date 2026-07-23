import {
  DashboardOutlined,
  DatabaseOutlined,
  FolderOpenOutlined,
  ImportOutlined,
  TrophyOutlined,
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
    user?.permissions.canViewDataResources ||
    user?.permissions.canChangeDataResources ||
    user?.permissions.canDeleteDataResources ||
    user?.permissions.canUploadData ||
    user?.permissions.canExportData
  ) {
    routes.push({
      path: "/resources/data/inventory",
      name: "存量数据",
      icon: <DatabaseOutlined />,
    });
  }
  const canManageWorkspaces =
    user?.permissions.canViewWorkspaces ||
    user?.permissions.canChangeWorkspaces ||
    user?.permissions.canDeleteWorkspaces;
  const canManageTopics =
    canManageWorkspaces ||
    user?.permissions.canViewMapCompositions ||
    user?.permissions.canChangeMapCompositions ||
    user?.permissions.canDeleteMapCompositions ||
    user?.permissions.canPublishMapCompositions ||
    user?.permissions.canViewResultArtifacts;
  if (canManageWorkspaces) {
    routes.push({
      path: "/resources/manage/projects",
      name: "工程管理",
      icon: <FolderOpenOutlined />,
    });
  }
  if (canManageTopics) {
    routes.push({
      path: "/resources/manage/topics",
      name: "成果管理",
      icon: <TrophyOutlined />,
    });
  }
  if (
    user?.permissions.canUploadData ||
    (user?.permissions.canViewResultArtifacts &&
      user.permissions.canImportResultArtifacts &&
      user.permissions.canPublishResultArtifacts)
  ) {
    routes.push({
      path: "/resources/data/import",
      name: "数据与成果导入",
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
    title: "数据与成果导入",
    subTitle: "分别导入可分析的数据资源，或直接发布已完成的成果文件",
  },
  "/resources/data/inventory": {
    title: "存量数据管理",
    subTitle: "查看已登记数据，并按权限管理状态、默认可视化、可见范围与导出",
  },
  "/resources/manage/projects": {
    title: "工程管理",
    subTitle: "维护工程信息、启用状态、可见范围与删除确认",
  },
  "/resources/manage/topics": {
    title: "成果管理",
    subTitle: "统一管理工作台专题图与导入成果的发布、预览、下载和删除",
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
