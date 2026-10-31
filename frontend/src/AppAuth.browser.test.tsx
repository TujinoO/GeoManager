import { App as AntApp } from "antd";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import type { Bootstrap, User } from "./types";

const mock = vi.hoisted(() => ({
  me: vi.fn(),
  bootstrap: vi.fn(),
  csrf: vi.fn(),
  forbidden: null as null | (() => Promise<void>),
}));
vi.mock("./api/client", () => ({
  api: mock,
  registerForbiddenHandler: (handler: () => Promise<void>) => {
    mock.forbidden = handler;
  },
  unregisterForbiddenHandler: () => {
    mock.forbidden = null;
  },
}));
vi.mock("./pages/HomePage", async () => {
  const { useAppContext } = await import("./contexts/AppContext");
  return {
    default: () => {
      const { user, setUser } = useAppContext();
      return (
        <div>
          <span data-testid="auth-user">{user?.username ?? "signed-out"}</span>
          <button onClick={() => setUser(null)}>local logout</button>
          <button
            onClick={() => setUser({ id: 2, username: "new-login" } as User)}
          >
            local login
          </button>
        </div>
      );
    },
  };
});
import App from "./App";
beforeEach(() => {
  vi.clearAllMocks();
  mock.csrf.mockResolvedValue({});
  mock.bootstrap.mockResolvedValue({
    systemName: "全球胡杨林生态系统保护数据共享平台",
    map: {},
    limits: {},
  } as Bootstrap);
  mock.me.mockResolvedValue({ user: { id: 1, username: "original" } });
});
function show() {
  render(
    <AntApp>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </AntApp>,
  );
}

it("ignores a stale authorization response after a local logout or a new login", async () => {
  show();
  await screen.findByText("original");
  let resolve!: (value: unknown) => void;
  mock.me.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const pending = mock.forbidden!();
  fireEvent.click(screen.getByRole("button", { name: "local logout" }));
  fireEvent.click(screen.getByRole("button", { name: "local login" }));
  await act(async () => {
    resolve({ user: { id: 1, username: "old-session" } });
    await pending;
  });
  expect(screen.getByTestId("auth-user")).toHaveTextContent("new-login");
});

it("synchronizes another tab's session change and keeps a valid user on network failure", async () => {
  show();
  await screen.findByText("original");
  mock.me.mockRejectedValueOnce(new Error("network unavailable"));
  await act(async () => {
    await mock.forbidden!();
  });
  expect(screen.getByTestId("auth-user")).toHaveTextContent("original");
  mock.me.mockResolvedValueOnce({ user: null });
  await act(async () => {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "geomanager:auth-change",
        newValue: "changed",
      }),
    );
  });
  await waitFor(() =>
    expect(screen.getByTestId("auth-user")).toHaveTextContent("signed-out"),
  );
});
