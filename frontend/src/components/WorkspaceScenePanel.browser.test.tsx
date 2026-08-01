import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceScene } from "../types";
import "../styles.css";
import WorkspaceScenePanel from "./WorkspaceScenePanel";

const { deleteWorkspaceMock, updateWorkspaceMock } = vi.hoisted(() => ({
  deleteWorkspaceMock: vi.fn(),
  updateWorkspaceMock: vi.fn(),
}));

vi.mock("../api/client", () => ({
  api: {
    deleteWorkspace: deleteWorkspaceMock,
    updateWorkspace: updateWorkspaceMock,
  },
}));

const accessGroups = [
  { id: 2, name: "科研用户", isGuest: false, isSuperadmin: false },
];

function scene(
  id: number,
  name: string,
  overrides: Partial<WorkspaceScene> = {},
): WorkspaceScene {
  return {
    id,
    kind: "topic",
    name,
    description: `${name}说明`,
    snapshot: { groups: [] },
    owner: {
      id,
      username: `owner-${id}`,
      displayName: `用户${id}`,
    },
    accessGroups: [],
    isOwner: true,
    canEdit: true,
    canDelete: true,
    canManageAccess: true,
    createdAt: "2026-07-14T10:00:00+08:00",
    updatedAt: "2026-07-14T10:00:00+08:00",
    ...overrides,
  };
}

function renderPanel(
  props: Partial<React.ComponentProps<typeof WorkspaceScenePanel>> = {},
) {
  const ownScene = scene(1, "我的专题", { accessGroups });
  const sharedScene = scene(2, "共享专题", {
    owner: { id: 20, username: "uploader", displayName: "上传用户" },
    isOwner: false,
    canEdit: false,
    canDelete: false,
    canManageAccess: false,
  });
  const onLoad = vi.fn();
  const result = render(
    <ConfigProvider locale={zhCN}>
      <AntApp>
        <WorkspaceScenePanel
          kind="topic"
          items={[ownScene, sharedScene]}
          accessGroups={accessGroups}
          onLoad={onLoad}
          onRefresh={vi.fn()}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
          {...props}
        />
      </AntApp>
    </ConfigProvider>,
  );
  return { ...result, ownScene, sharedScene, onLoad };
}

describe("WorkspaceScenePanel", () => {
  beforeEach(() => {
    deleteWorkspaceMock.mockReset();
    updateWorkspaceMock.mockReset();
  });

  it("loads shared scenes but keeps owner-only edit and delete controls hidden", async () => {
    const { sharedScene, onLoad } = renderPanel();
    const sharedRow = screen
      .getByText("共享专题")
      .closest(".topic-scenario-row");
    expect(sharedRow).not.toBeNull();
    expect(
      within(sharedRow as HTMLElement).getByText("共享"),
    ).toBeInTheDocument();
    expect(
      within(sharedRow as HTMLElement).queryByRole("button", {
        name: "编辑共享专题",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(sharedRow as HTMLElement).queryByRole("button", {
        name: "删除共享专题",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(sharedRow as HTMLElement).getByText("仅所属用户可见"),
    ).toBeInTheDocument();
    expect(screen.queryByText("超级管理员")).not.toBeInTheDocument();

    fireEvent.click(
      within(sharedRow as HTMLElement).getByRole("button", {
        name: /加\s*载/,
      }),
    );

    await waitFor(() => expect(onLoad).toHaveBeenCalledWith(sharedScene));
  });

  it("searches visible scenes and saves owner access scopes", async () => {
    const updatedScene = scene(1, "更新后的专题", { accessGroups });
    updateWorkspaceMock.mockResolvedValue(updatedScene);
    const onUpdate = vi.fn();
    renderPanel({ onUpdate });

    fireEvent.change(
      screen.getByPlaceholderText("搜索专题、所属用户或共享角色"),
      { target: { value: "上传用户" } },
    );
    expect(screen.getByText("共享专题")).toBeInTheDocument();
    expect(screen.queryByText("我的专题")).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText("搜索专题、所属用户或共享角色"),
      { target: { value: "" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "编辑我的专题" }));
    expect(
      screen.getByText(
        "所属用户本人始终可见；平台会自动保留必要的系统访问范围。",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("超级管理员")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("专题名称"), {
      target: { value: "更新后的专题" },
    });
    fireEvent.click(screen.getByRole("button", { name: /保\s*存/ }));

    await waitFor(() =>
      expect(updateWorkspaceMock).toHaveBeenCalledWith(1, {
        name: "更新后的专题",
        description: "我的专题说明",
        accessGroupIds: [2],
      }),
    );
    expect(onUpdate).toHaveBeenCalledWith(updatedScene);
  });

  it("keeps project details and actions readable in a narrow workbench panel", () => {
    const longProject = scene(9, "塔里木河流域极长名称胡杨生态监测与保护工程", {
      kind: "project",
    });
    const view = renderPanel({
      kind: "project",
      items: [longProject],
      onCreateComposition: vi.fn(),
    });
    view.container.style.width = "390px";
    const row = screen
      .getByText(longProject.name)
      .closest(".topic-scenario-row") as HTMLElement;
    const main = row.querySelector(".topic-scenario-main") as HTMLElement;
    const actions = within(row)
      .getByRole("button", { name: /加\s*载/ })
      .closest(".ant-space") as HTMLElement;

    expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth + 1);
    expect(actions.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      main.getBoundingClientRect().bottom,
    );
    expect(
      screen.getByText(longProject.name).getBoundingClientRect().width,
    ).toBeGreaterThan(120);
  });
});
