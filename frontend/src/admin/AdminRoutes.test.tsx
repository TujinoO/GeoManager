import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppContext } from "../contexts/AppContext";
import { RequireDataMaintain } from "../router";
import type { Bootstrap, User } from "../types";

vi.mock("@ant-design/charts", () => ({
  Column: () => <div data-testid="active-chart" />,
}));

import AdminAuthPage from "./AdminAuthPage";
import AdminDashboardPage from "./AdminDashboardPage";
import AdminDataImportPage from "./AdminDataImportPage";
import AdminDataInventoryPage from "./AdminDataInventoryPage";
import AdminLayout from "./AdminLayout";
import AdminOperationLogsPage from "./AdminOperationLogsPage";
import AdminProfilePage from "./AdminProfilePage";
import AdminSystemSettingsPage from "./AdminSystemSettingsPage";

const mockApi = vi.hoisted(() => ({
  logout: vi.fn(),
  adminProfile: vi.fn(),
  updateAdminProfile: vi.fn(),
  updateAdminProfilePermissions: vi.fn(),
  updateAdminProfilePassword: vi.fn(),
  adminOperationLogs: vi.fn(),
  adminUsers: vi.fn(),
  createAdminUser: vi.fn(),
  updateAdminUserGroups: vi.fn(),
  updateAdminUser: vi.fn(),
  resetAdminUserPassword: vi.fn(),
  deleteAdminUser: vi.fn(),
  adminGroups: vi.fn(),
  createAdminGroup: vi.fn(),
  updateAdminGroup: vi.fn(),
  deleteAdminGroup: vi.fn(),
  adminSettings: vi.fn(),
  updateAdminSettings: vi.fn(),
  importPreview: vi.fn(),
  importValidate: vi.fn(),
  importCommit: vi.fn(),
  adminDataResources: vi.fn(),
  updateAdminDataResource: vi.fn(),
  exportAdminDataResources: vi.fn(),
  adminDashboard: vi.fn(),
  adminDashboardServer: vi.fn(),
}));

vi.mock("../api/client", () => ({
  api: mockApi,
}));

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

const adminUser: User = {
  id: 1,
  username: "admin",
  displayName: "系统管理员",
  email: "admin@example.local",
  avatarUrl: "",
  department: "平台运维组",
  isStaff: false,
  isSuperuser: false,
  roles: ["系统管理员"],
  groupIds: [1],
  isActive: true,
  operationLogGroupIds: [],
  permissions: {
    canAccessAdmin: true,
    canManageFeaturePermissions: true,
    canCreateUser: true,
    canViewOperationLogs: true,
    canViewAllOperationLogs: true,
    canViewOwnOperationLogs: true,
    canViewGroupOperationLogs: true,
    canManageSystemSettings: true,
    canManageAuth: true,
    canViewDashboardResourceCard: true,
    canViewDashboardLayerCard: true,
    canViewDashboardRasterCard: true,
    canViewDashboardUserCard: true,
    canViewDashboardActiveUsersCard: true,
    canViewDashboardSystemCard: true,
    canBrowseData: true,
    canQueryData: true,
    canLoadVectorLayer: true,
    canLoadRasterLayer: true,
    canUseCustomSymbolization: true,
    canExportData: true,
    canMaintainData: true,
    canManageRasterData: true,
  },
};

const availablePermissions = [
  {
    id: "core.manage_feature_permissions",
    label: "配置功能权限",
    group: "人员权限",
  },
  { id: "core.create_user", label: "新建用户", group: "人员权限" },
  { id: "core.view_operation_logs", label: "查看操作日志", group: "后台权限" },
  {
    id: "core.view_all_operation_logs",
    label: "查看所有用户日志",
    group: "日志权限",
  },
  {
    id: "core.view_own_operation_logs",
    label: "查看自己的日志",
    group: "日志权限",
  },
  {
    id: "core.view_group_operation_logs",
    label: "查看指定用户组日志",
    group: "日志权限",
  },
  {
    id: "core.manage_system_settings",
    label: "修改系统设置",
    group: "后台权限",
  },
  { id: "core.manage_auth", label: "修改认证授权", group: "人员权限" },
  {
    id: "core.view_dashboard_resource_card",
    label: "查看 Dashboard 数据资源卡片",
    group: "Dashboard 权限",
  },
  {
    id: "core.view_dashboard_layer_card",
    label: "查看 Dashboard 图层数卡片",
    group: "Dashboard 权限",
  },
  {
    id: "core.view_dashboard_raster_card",
    label: "查看 Dashboard 栅格数量卡片",
    group: "Dashboard 权限",
  },
  {
    id: "core.view_dashboard_user_card",
    label: "查看 Dashboard 用户数量卡片",
    group: "Dashboard 权限",
  },
  {
    id: "core.view_dashboard_active_users_card",
    label: "查看 Dashboard 活跃用户卡片",
    group: "Dashboard 权限",
  },
  {
    id: "core.view_dashboard_system_card",
    label: "查看 Dashboard 系统信息",
    group: "Dashboard 权限",
  },
  { id: "core.browse_data", label: "浏览数据目录", group: "数据权限" },
  { id: "core.query_data", label: "查询数据", group: "数据权限" },
  {
    id: "catalog.export_dataresource",
    label: "导出数据资源",
    group: "数据权限",
  },
];

const grantedPermissions = availablePermissions.map(
  (permission) => permission.id,
);

const adminGroup = {
  id: 1,
  name: "系统管理员",
  userCount: 1,
  permissions: grantedPermissions,
  isProtected: true,
  lockedPermissions: [],
};

const adminApiUser = {
  ...adminUser,
  groupIds: [adminGroup.id],
  isActive: true,
  directPermissions: [],
  effectivePermissions: grantedPermissions,
  operationLogGroupIds: [],
};

const adminSettings = {
  systemName: bootstrap.systemName,
  allowRegistration: bootstrap.allowRegistration,
  map: bootstrap.map,
  limits: bootstrap.limits,
  raster: {
    symbolizerTimeoutSeconds: 120,
  },
  editable: true,
};

function renderAdminRoute(initialEntry: string) {
  return render(
    <AdminTestProviders>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/" element={<div>业务入口</div>} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="profile" element={<AdminProfilePage />} />
            <Route path="logs" element={<AdminOperationLogsPage />} />
            <Route path="settings" element={<AdminSystemSettingsPage />} />
            <Route path="auth" element={<Navigate to="users" replace />} />
            <Route path="auth/users" element={<AdminAuthPage />} />
            <Route path="auth/groups" element={<AdminAuthPage />} />
            <Route element={<RequireDataMaintain />}>
              <Route
                path="data/inventory"
                element={<AdminDataInventoryPage />}
              />
              <Route path="data/import" element={<AdminDataImportPage />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </AdminTestProviders>,
  );
}

function renderWithProviders(children: React.ReactNode) {
  return render(<AdminTestProviders>{children}</AdminTestProviders>);
}

function AdminTestProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider locale={zhCN}>
      <AntApp>
        <AppContext.Provider
          value={{
            bootstrap,
            user: adminUser,
            setUser: vi.fn(),
          }}
        >
          {children}
        </AppContext.Provider>
      </AntApp>
    </ConfigProvider>
  );
}

describe("admin routes", () => {
  beforeEach(() => {
    mockApi.logout.mockResolvedValue({ detail: "已退出" });
    mockApi.adminProfile.mockResolvedValue({
      user: adminUser,
      avatarUrl: "",
      department: "平台运维组",
      grantedPermissions,
      disabledPermissions: [],
      effectivePermissions: grantedPermissions,
      availablePermissions,
    });
    mockApi.updateAdminProfilePermissions.mockImplementation((payload) =>
      Promise.resolve({
        user: adminUser,
        avatarUrl: "",
        department: "平台运维组",
        grantedPermissions,
        disabledPermissions: payload.disabledPermissions,
        effectivePermissions: grantedPermissions.filter(
          (permission) => !payload.disabledPermissions.includes(permission),
        ),
        availablePermissions,
      }),
    );
    mockApi.updateAdminProfilePassword.mockResolvedValue({
      detail: "密码已更新",
    });
    mockApi.adminUsers.mockResolvedValue({ items: [adminApiUser] });
    mockApi.updateAdminUser.mockImplementation((userId, payload) =>
      Promise.resolve({
        ...adminApiUser,
        id: userId,
        isActive: payload.isActive,
      }),
    );
    mockApi.resetAdminUserPassword.mockResolvedValue({
      ...adminApiUser,
      generatedPassword: "Abc123!@",
    });
    mockApi.deleteAdminUser.mockResolvedValue({ detail: "用户已删除" });
    mockApi.adminOperationLogs.mockResolvedValue({ items: [], total: 0 });
    mockApi.adminGroups.mockResolvedValue({
      items: [adminGroup],
      availablePermissions,
    });
    mockApi.adminSettings.mockResolvedValue(adminSettings);
    mockApi.updateAdminSettings.mockResolvedValue(adminSettings);
    mockApi.adminDashboard.mockResolvedValue({
      generatedAt: "2026-06-07T20:00:00+08:00",
      cards: {
        resources: { total: 2, active: 2 },
        layers: { total: 1, active: 1 },
        rasters: { resources: 1, datasets: 1, layers: 1 },
        users: {
          total: 2,
          active: 2,
          disabled: 0,
          groups: 3,
          vectorResources: 1,
          tableResources: 0,
        },
        activeUsers: {
          period: "day",
          rangeStart: "2026-06-07",
          rangeEnd: "2026-06-07",
          count: 1,
          loginCount: 2,
          series: Array.from({ length: 24 }, (_, hour) => ({
            key: String(hour),
            label: `${String(hour).padStart(2, "0")}:00`,
            count: hour === 9 ? 2 : 0,
          })),
          ranking: [
            {
              userId: 2,
              displayName: "活跃用户",
              username: "active-user",
              loginCount: 2,
            },
          ],
        },
      },
    });
    mockApi.adminDashboardServer.mockResolvedValue({
      generatedAt: "2026-06-07T20:00:00+08:00",
      hostname: "test-host",
      platform: "Darwin",
      cards: {
        cpu: {
          model: "Apple M",
          physicalCount: 8,
          logicalCount: 8,
          usagePercent: 32,
          loadAverage: [2.1, 1.8, 1.5],
        },
        memory: {
          model: "系统内存",
          slotCount: 1,
          totalBytes: 17179869184,
          usedBytes: 8589934592,
          availableBytes: 8589934592,
          usagePercent: 50,
        },
        disks: {
          count: 1,
          devices: [{ name: "disk0", model: "APPLE SSD", size: "512 GB" }],
          mount: "/Users/gx/Documents/Source/huyang_system",
          totalBytes: 512000000000,
          usedBytes: 256000000000,
          freeBytes: 256000000000,
          usagePercent: 50,
        },
      },
    });
    mockApi.importPreview.mockResolvedValue({
      suggestedName: "样地调查点位",
      suggestedTableName: "sample_points",
      columns: ["plot_id", "longitude", "latitude", "height"],
      rows: [
        {
          plot_id: "P001",
          longitude: "87.6",
          latitude: "41.7",
          height: "3.2",
        },
      ],
      limitations: ["Excel 只读取第一张表；所有字段按文本读取。"],
      detected: {
        isGeographic: true,
        longitudeColumn: "longitude",
        latitudeColumn: "latitude",
      },
    });
    mockApi.importValidate.mockResolvedValue({
      coordinateStats: {
        totalRows: 1,
        validRows: 1,
        missingRows: 0,
        quantizationErrorMeters: { min: 1.1, max: 1.1 },
      },
      validationIssues: [],
    });
    mockApi.importCommit.mockResolvedValue({
      resourceId: 1,
      resourceName: "样地调查点位",
      importedRows: 1,
      validationIssues: [],
    });
    mockApi.adminDataResources.mockResolvedValue({
      items: [
        {
          id: 1,
          name: "胡杨林样地点",
          code: "populus-plots",
          dataType: "vector",
          category: null,
          source: "用户导入",
          provider: "平台组",
          dataDate: "2026-06-01",
          spatialExtent: "87.600000,41.700000,87.800000,41.900000",
          coordinateSystem: "EPSG:4326",
          fileFormat: "GPKG",
          storagePath: "populus_plots",
          description: "样地点数据",
          qualityNote: "",
          defaultVisualization: {},
          status: "active",
          accessGroups: [{ id: 1, name: "系统管理员" }],
          maintainer: "系统管理员",
          createdAt: "2026-06-01T10:00:00+08:00",
          updatedAt: "2026-06-01T10:00:00+08:00",
          defaultLayer: null,
        },
      ],
      total: 1,
      availableAccessGroups: [{ id: 1, name: "系统管理员" }],
    });
    mockApi.updateAdminDataResource.mockImplementation((resourceId, payload) =>
      Promise.resolve({
        id: resourceId,
        name: "胡杨林样地点",
        code: "populus-plots",
        dataType: "vector",
        category: null,
        source: "用户导入",
        provider: "平台组",
        dataDate: "2026-06-01",
        spatialExtent: "87.600000,41.700000,87.800000,41.900000",
        coordinateSystem: "EPSG:4326",
        fileFormat: "GPKG",
        storagePath: "populus_plots",
        description: "样地点数据",
        qualityNote: "",
        defaultVisualization: payload.visualization ?? {},
        status: payload.status ?? "active",
        accessGroups: [{ id: 1, name: "系统管理员" }],
        maintainer: "系统管理员",
        createdAt: "2026-06-01T10:00:00+08:00",
        updatedAt: "2026-06-01T10:00:00+08:00",
        defaultLayer: null,
      }),
    );
    mockApi.exportAdminDataResources.mockResolvedValue({
      blob: new Blob(["数据名称\n胡杨林样地点"], { type: "text/csv" }),
      filename: "data-inventory.csv",
    });
  });

  it("redirects /admin to dashboard", async () => {
    renderAdminRoute("/admin");

    expect(await screen.findByText("图层数")).toBeInTheDocument();
    expect(screen.getAllByText("栅格数量").length).toBeGreaterThan(0);
    expect(screen.getByText("用户信息")).toBeInTheDocument();
    expect(screen.getByText("用户组数量")).toBeInTheDocument();
    expect(screen.getAllByText("活跃用户").length).toBeGreaterThan(0);
    expect(screen.getByText("服务器信息")).toBeInTheDocument();
  });

  it("submits the password change form from user settings", async () => {
    renderWithProviders(<AdminProfilePage />);

    expect(await screen.findByText("修改密码")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("当前密码"), {
      target: { value: "OldPass123" },
    });
    fireEvent.change(screen.getByLabelText("新密码"), {
      target: { value: "NewPass123" },
    });
    fireEvent.change(screen.getByLabelText("确认新密码"), {
      target: { value: "NewPass123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /更新密码/ }));

    await waitFor(() => {
      expect(mockApi.updateAdminProfilePassword).toHaveBeenCalledWith({
        currentPassword: "OldPass123",
        newPassword: "NewPass123",
        passwordConfirm: "NewPass123",
      });
    });
  });

  it("navigates from operation logs to system settings", async () => {
    renderAdminRoute("/admin/logs");

    const settingsLinks = await screen.findAllByRole("link", {
      name: /系统设置/,
    });
    fireEvent.click(settingsLinks[0] as HTMLElement);

    expect(await screen.findAllByText("基础配置")).not.toHaveLength(0);
    expect(screen.getAllByText(bootstrap.systemName).length).toBeGreaterThan(0);
  });

  it("opens the user detail drawer from auth management", async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/admin/auth/users"]}>
        <AdminAuthPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("用户列表")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /admin/ }));

    await waitFor(() => {
      expect(screen.getByText("用户详情")).toBeInTheDocument();
    });
    const drawer = screen.getByRole("dialog", { name: "用户详情" });
    expect(within(drawer).getByText("平台运维组")).toBeInTheDocument();
  }, 15000);

  it("puts current user first and disables protected auth actions", async () => {
    const superadminGroup = {
      ...adminGroup,
      id: 2,
      name: "超级管理员",
      userCount: 1,
    };
    const researcher = {
      ...adminApiUser,
      id: 2,
      username: "researcher",
      displayName: "科研用户",
      groupIds: [],
    };
    const superadminUser = {
      ...adminApiUser,
      id: 3,
      username: "root-admin",
      displayName: "超级管理员",
      groupIds: [superadminGroup.id],
    };
    mockApi.adminUsers.mockResolvedValue({
      items: [researcher, superadminUser, adminApiUser],
    });
    mockApi.adminGroups.mockResolvedValue({
      items: [adminGroup, superadminGroup],
      availablePermissions,
    });

    renderWithProviders(
      <MemoryRouter initialEntries={["/admin/auth/users"]}>
        <AdminAuthPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("用户列表")).toBeInTheDocument();
    const userLinks = document.querySelectorAll(".admin-user-link");
    expect(userLinks[0]).toHaveTextContent("admin");

    fireEvent.click(screen.getAllByRole("button", { name: /操作/ })[0]);
    const ownPermissionItem = await screen.findByRole("menuitem", {
      name: /更改权限/,
    });
    expect(ownPermissionItem).toHaveAttribute("aria-disabled", "true");
    expect(
      within(ownPermissionItem).getByTitle("请到用户设置中修改自己的权限"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /操作/ })[2]);
    const superadminGroupItems = await screen.findAllByRole("menuitem", {
      name: /更改用户组/,
    });
    const superadminGroupItem =
      superadminGroupItems[superadminGroupItems.length - 1];
    expect(superadminGroupItem).toHaveAttribute("aria-disabled", "true");
    expect(
      within(superadminGroupItem).getByTitle("不能修改超级管理员的用户组"),
    ).toBeInTheDocument();
  }, 15000);

  it("runs the admin data import step flow through preview and validation", async () => {
    renderAdminRoute("/admin/data/import");

    expect(
      await screen.findByText("选择 Excel 或 CSV 文件"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("数据管理").length).toBeGreaterThan(0);
    const input = document.querySelector(
      "input[type='file']",
    ) as HTMLInputElement;
    const file = new File(["plot_id,longitude,latitude\nP001,87.6,41.7"], {
      type: "text/csv",
    });

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("导入配置")).toBeInTheDocument();
    expect(screen.getByLabelText("数据名称")).toHaveValue("样地调查点位");
    fireEvent.click(screen.getByRole("button", { name: /数据校验并继续/ }));

    await waitFor(() => {
      expect(mockApi.importValidate).toHaveBeenCalledWith(file, {
        importMode: "geographic",
        longitudeColumn: "longitude",
        latitudeColumn: "latitude",
      });
    });
    const previewTitle = await screen.findByText("数据预览");
    const metadataTitle = screen.getByText("字段元数据");
    expect(previewTitle).toBeInTheDocument();
    expect(metadataTitle).toBeInTheDocument();
    expect(
      previewTitle.compareDocumentPosition(metadataTitle) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /提交导入/ }));

    await waitFor(() => {
      expect(mockApi.importCommit).toHaveBeenCalledWith(
        file,
        expect.objectContaining({
          name: "样地调查点位",
          importMode: "geographic",
          longitudeColumn: "longitude",
          latitudeColumn: "latitude",
          tableName: "sample_points",
        }),
      );
    });
  }, 15000);

  it("loads the inventory data management page", async () => {
    renderAdminRoute("/admin/data/inventory");

    expect(await screen.findByText("胡杨林样地点")).toBeInTheDocument();
    expect(screen.getByText("CSV")).toBeInTheDocument();
    expect(screen.getByText("本页启用")).toBeInTheDocument();
  });
});
