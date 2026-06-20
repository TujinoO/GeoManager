import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppContext } from "../contexts/AppContext";
import { appTheme } from "../theme";
import type {
  Bootstrap,
  ResourceListItem,
  User,
  WorkspaceScene,
} from "../types";
import WorkspaceHeader from "./WorkspaceHeader";

const bootstrap: Bootstrap = {
  systemName: "中亚胡杨林生态系统保护数据共享平台",
  allowRegistration: false,
  map: {
    defaultCenter: [87.6, 41.7],
    defaultZoom: 6.5,
    defaultBasemap: "osm",
    mapboxAccessToken: "",
  },
  limits: {
    uploadMaxMb: 512,
    queryResultLimit: 30000,
  },
};

const permissions: User["permissions"] = {
  canAccessAdmin: true,
  canManageFeaturePermissions: false,
  canCreateUser: false,
  canViewOperationLogs: false,
  canViewAllOperationLogs: false,
  canViewOwnOperationLogs: false,
  canViewGroupOperationLogs: false,
  canManageSystemSettings: false,
  canManageAuth: false,
  canViewDashboardResourceCard: false,
  canViewDashboardLayerCard: false,
  canViewDashboardRasterCard: false,
  canViewDashboardUserCard: false,
  canViewDashboardActiveUsersCard: false,
  canViewDashboardSystemCard: false,
  canViewDataOverview: false,
  canBrowseData: true,
  canQueryData: true,
  canUploadData: false,
  canViewDataResources: false,
  canCreateDataResources: false,
  canChangeDataResources: false,
  canDeleteDataResources: false,
  canLoadVectorLayer: true,
  canLoadRasterLayer: true,
  canUseCustomSymbolization: false,
  canExportData: false,
  canMaintainData: false,
  canViewWorkspaces: false,
  canCreateWorkspaces: false,
  canChangeWorkspaces: false,
  canDeleteWorkspaces: false,
  canViewAchievements: false,
  canCreateAchievements: false,
  canChangeAchievements: false,
  canDeleteAchievements: false,
  canManageRasterData: false,
};

const user: User = {
  id: 7,
  username: "researcher",
  displayName: "科研用户",
  email: "researcher@example.local",
  avatarUrl: "",
  department: "生态监测组",
  isStaff: false,
  isSuperuser: false,
  roles: ["科研用户"],
  operationLogGroupIds: [],
  permissions,
};

const resource: ResourceListItem = {
  id: 21,
  name: "塔里木河胡杨样地监测点",
  code: "tarim-poplar-monitoring-2026",
  dataType: "vector",
  category: { code: "monitoring", name: "长期监测" },
  source: "2026 塔里木河野外调查",
  provider: "生态监测组",
  dataDate: "2026-06-01",
  spatialExtent: "87.600000,43.795100,87.642800,43.812450",
  coordinateSystem: "EPSG:4326",
  fileFormat: "GeoPackage",
  description: "塔里木河胡杨样地监测点位",
  qualityNote: "",
  status: "active",
  isQueryable: true,
  isRenderable: false,
  updatedAt: "2026-06-18T12:00:00+08:00",
  sizeBytes: 245760,
  itemCount: 3,
};

function scene(
  id: number,
  kind: WorkspaceScene["kind"],
  name: string,
): WorkspaceScene {
  return {
    id,
    kind,
    name,
    description: "",
    snapshot: { groups: [] },
    owner: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    },
    createdAt: "2026-06-18T12:00:00+08:00",
    updatedAt: "2026-06-18T12:00:00+08:00",
  };
}

function renderHeader(
  props: Partial<React.ComponentProps<typeof WorkspaceHeader>> = {},
  contextUser: User = user,
) {
  window.localStorage.setItem(
    `huyang-system.workspace-tour.v1.${contextUser.id}.${contextUser.username}`,
    "completed",
  );

  return render(
    <ConfigProvider locale={zhCN} theme={appTheme}>
      <AntApp>
        <AppContext.Provider
          value={{ bootstrap, user: contextUser, setUser: vi.fn() }}
        >
          <MemoryRouter>
            <WorkspaceHeader
              activeTab="map"
              canBrowseData
              resources={[resource]}
              workspaceScenes={[
                scene(1, "project", "塔里木河监测工程"),
                scene(2, "topic", "胡杨退化专题"),
              ]}
              {...props}
            />
            <CurrentPath />
          </MemoryRouter>
        </AppContext.Provider>
      </AntApp>
    </ConfigProvider>,
  );
}

function CurrentPath() {
  const location = useLocation();
  return <span data-testid="location-path">{location.pathname}</span>;
}

function sectionByTitle(title: string) {
  const section = screen.getByText(title).closest(".workspace-search-section");
  expect(section).not.toBeNull();
  return section as HTMLElement;
}

describe("WorkspaceHeader", () => {
  it("separates projects and topics and loads them only from the load button", async () => {
    const onLoadWorkspaceScene = vi.fn();
    const onQuickLoadResource = vi.fn();
    renderHeader({ onLoadWorkspaceScene, onQuickLoadResource });

    fireEvent.click(screen.getByPlaceholderText("搜索数据、工程、专题"));

    await waitFor(() => {
      expect(screen.getByText("塔里木河监测工程")).toBeInTheDocument();
    });

    const projectSection = sectionByTitle("工程");
    const topicSection = sectionByTitle("专题");
    expect(
      within(projectSection).getByText("塔里木河监测工程"),
    ).toBeInTheDocument();
    expect(
      within(projectSection).queryByText("胡杨退化专题"),
    ).not.toBeInTheDocument();
    expect(within(topicSection).getByText("胡杨退化专题")).toBeInTheDocument();
    expect(
      within(topicSection).queryByText("塔里木河监测工程"),
    ).not.toBeInTheDocument();

    fireEvent.click(within(projectSection).getByText("塔里木河监测工程"));
    fireEvent.click(within(topicSection).getByText("胡杨退化专题"));
    expect(onLoadWorkspaceScene).not.toHaveBeenCalled();
    expect(onQuickLoadResource).not.toHaveBeenCalled();

    fireEvent.click(
      within(projectSection).getByRole("button", { name: "加载" }),
    );
    expect(onLoadWorkspaceScene).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, kind: "project" }),
    );
  });

  it("does not show a standalone data import shortcut for upload-capable users", () => {
    const uploadUser: User = {
      ...user,
      permissions: {
        ...permissions,
        canUploadData: true,
      },
    };
    const { container } = renderHeader({}, uploadUser);

    expect(container.querySelector(".data-import-shortcut")).toBeNull();
    expect(screen.getByTestId("location-path")).toHaveTextContent("/");
  });
});
