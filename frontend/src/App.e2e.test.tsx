import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { Bootstrap, User } from "./types";

const { MockApiError, mockApi } = vi.hoisted(() => {
  class MockApiError extends Error {
    status: number;
    data: unknown;

    constructor(message: string, status: number, data?: unknown) {
      super(message);
      this.status = status;
      this.data = data;
    }
  }

  return {
    MockApiError,
    mockApi: {
      bootstrap: vi.fn(),
      csrf: vi.fn(),
      me: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    },
  };
});

vi.mock("./api/client", () => ({
  ApiError: MockApiError,
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

const basePermissions = {
  canAccessAdmin: false,
  canManageFeaturePermissions: false,
  canBrowseData: true,
  canQueryData: true,
  canLoadVectorLayer: true,
  canLoadRasterLayer: true,
  canUseCustomSymbolization: false,
  canExportData: false,
  canMaintainData: false,
  canManageRasterData: false,
};

const normalUser: User = {
  id: 1,
  username: "researcher",
  displayName: "科研用户",
  email: "researcher@example.local",
  avatarUrl: "",
  department: "生态监测组",
  isStaff: false,
  isSuperuser: false,
  roles: ["科研用户"],
  permissions: basePermissions,
};

const adminUser: User = {
  ...normalUser,
  id: 2,
  username: "admin",
  displayName: "系统管理员",
  isStaff: true,
  isSuperuser: true,
  roles: ["系统管理员"],
  permissions: {
    ...basePermissions,
    canAccessAdmin: true,
    canManageFeaturePermissions: true,
    canMaintainData: true,
    canManageRasterData: true,
  },
};

function renderApp(initialEntry: string) {
  return render(
    <ConfigProvider locale={zhCN}>
      <AntApp>
        <MemoryRouter initialEntries={[initialEntry]}>
          <App />
        </MemoryRouter>
      </AntApp>
    </ConfigProvider>,
  );
}

describe("application critical flows", () => {
  beforeEach(() => {
    for (const fn of Object.values(mockApi)) {
      fn.mockReset();
    }
    mockApi.bootstrap.mockResolvedValue(bootstrap);
    mockApi.csrf.mockResolvedValue({ detail: "csrf cookie set" });
    mockApi.me.mockRejectedValue(new MockApiError("未登录", 401));
    mockApi.login.mockResolvedValue({ user: normalUser });
    mockApi.register.mockResolvedValue({
      user: normalUser,
      detail: "用户注册成功",
    });
    mockApi.logout.mockResolvedValue({ detail: "已退出" });
  });

  it("redirects unauthenticated users to login and enters the portal after login", async () => {
    renderApp("/");

    expect(
      await screen.findByRole("heading", { name: "用户登录" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("请输入账号"), {
      target: { value: "researcher" },
    });
    fireEvent.change(screen.getByPlaceholderText("请输入密码"), {
      target: { value: "pass12345" },
    });
    fireEvent.click(screen.getByRole("button", { name: /登录/ }));

    await waitFor(() => {
      expect(mockApi.login).toHaveBeenCalledWith(
        "researcher",
        "pass12345",
        true,
      );
    });
    expect(await screen.findByText("地理可视化")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /管理后台/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps non-admin users out of the admin route", async () => {
    mockApi.me.mockResolvedValue({ authenticated: true, user: normalUser });

    renderApp("/admin");

    expect(await screen.findByText("地理可视化")).toBeInTheDocument();
    expect(screen.queryByText("个人信息")).not.toBeInTheDocument();
  });

  it("shows data import and admin entries only for privileged users", async () => {
    mockApi.me.mockResolvedValue({ authenticated: true, user: adminUser });

    renderApp("/");

    expect(await screen.findByText("地理可视化")).toBeInTheDocument();
    expect(screen.getByText("数据导入")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /管理后台/ }),
    ).toBeInTheDocument();
  });
});
