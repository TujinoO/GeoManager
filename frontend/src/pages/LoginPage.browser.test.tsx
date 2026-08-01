import { act, fireEvent, render, screen } from "@testing-library/react";
import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppContext } from "../contexts/AppContext";
import { appTheme } from "../theme";
import type { Bootstrap } from "../types";
import LoginPage from "./LoginPage";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    loginOverview: vi.fn(),
    csrf: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    guestLogin: vi.fn(),
  },
}));

vi.mock("../api/client", () => ({ api: mockApi }));

const bootstrap: Bootstrap = {
  systemName: "全球胡杨林生态系统保护数据共享平台",
  allowRegistration: true,
  map: {
    defaultCenter: [87.6, 41.7],
    defaultZoom: 6.5,
    defaultBasemap: "osm",
    mapboxAccessToken: "",
  },
  limits: {
    uploadMaxMb: 512,
    queryResultLimit: 30000,
    maxRasterSidePixels: 10000,
  },
};

function renderLoginPage() {
  return render(
    <ConfigProvider locale={zhCN} theme={appTheme}>
      <AntApp>
        <AppContext.Provider
          value={{
            bootstrap,
            user: null,
            setBootstrap: vi.fn(),
            setUser: vi.fn(),
          }}
        >
          <LoginPage />
        </AppContext.Provider>
      </AntApp>
    </ConfigProvider>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.loginOverview.mockRejectedValue(new Error("offline"));
  });

  it("clears credentials and validation state when switching modes", async () => {
    renderLoginPage();

    fireEvent.change(screen.getByLabelText("账号"), {
      target: { value: "existing-user" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "do-not-retain" },
    });
    fireEvent.click(screen.getByRole("button", { name: /注册新账号/ }));

    expect(screen.getByLabelText("账号")).toHaveValue("");
    expect(screen.getByLabelText("密码")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("账号"), {
      target: { value: "new-user" },
    });
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "new@example.local" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "new-secret" },
    });
    fireEvent.change(screen.getByLabelText("确认密码"), {
      target: { value: "new-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "返回登录" }));

    expect(screen.getByLabelText("账号")).toHaveValue("");
    expect(screen.getByLabelText("密码")).toHaveValue("");
  });

  it("automatically advances through the login backgrounds", () => {
    vi.useFakeTimers();
    const { container, unmount } = renderLoginPage();
    const slides = container.querySelectorAll(".login-background-slide");

    expect(slides).toHaveLength(6);
    expect(slides[0]).toHaveAttribute("data-active", "true");

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    expect(slides[0]).toHaveAttribute("data-active", "false");
    expect(slides[1]).toHaveAttribute("data-active", "true");
    unmount();
    vi.useRealTimers();
  });
});
