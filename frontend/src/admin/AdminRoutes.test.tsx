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
import { RequireAdmin } from "../router";
import type { Bootstrap, User } from "../types";
import AdminAuthPage from "./AdminAuthPage";
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
  adminGroups: vi.fn(),
  createAdminGroup: vi.fn(),
  updateAdminGroup: vi.fn(),
  deleteAdminGroup: vi.fn(),
  adminSettings: vi.fn(),
  updateAdminSettings: vi.fn(),
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
  permissions: {
    canAccessAdmin: true,
    canManageFeaturePermissions: true,
    canCreateUser: true,
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
  { id: "core.access_admin", label: "进入后台管理", group: "系统管理" },
  {
    id: "core.manage_feature_permissions",
    label: "配置功能权限",
    group: "系统管理",
  },
  { id: "core.create_user", label: "新建用户", group: "系统管理" },
  { id: "core.browse_data", label: "浏览数据目录", group: "数据功能" },
  { id: "core.query_data", label: "查询数据", group: "数据功能" },
  {
    id: "catalog.export_dataresource",
    label: "导出数据资源",
    group: "数据管理",
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
  lockedPermissions: ["core.access_admin"],
};

const adminApiUser = {
  ...adminUser,
  groupIds: [adminGroup.id],
  isActive: true,
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
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<AdminProfilePage />} />
              <Route path="logs" element={<AdminOperationLogsPage />} />
              <Route path="settings" element={<AdminSystemSettingsPage />} />
              <Route path="auth" element={<AdminAuthPage />} />
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
    mockApi.adminOperationLogs.mockResolvedValue({ items: [], total: 0 });
    mockApi.adminGroups.mockResolvedValue({
      items: [adminGroup],
      availablePermissions,
    });
    mockApi.adminSettings.mockResolvedValue(adminSettings);
    mockApi.updateAdminSettings.mockResolvedValue(adminSettings);
  });

  it("redirects /admin to user settings", async () => {
    renderAdminRoute("/admin");

    expect(await screen.findByText("个人信息")).toBeInTheDocument();
    expect(screen.getByText("修改密码")).toBeInTheDocument();
    expect(screen.getByText("我的权限")).toBeInTheDocument();
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
    renderWithProviders(<AdminAuthPage />);

    expect(await screen.findByText("用户列表")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /admin/ }));

    await waitFor(() => {
      expect(screen.getByText("用户详情")).toBeInTheDocument();
    });
    const drawer = screen.getByRole("dialog", { name: "用户详情" });
    expect(within(drawer).getByText("平台运维组")).toBeInTheDocument();
  }, 15000);
});
