import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { App as AntApp } from "antd";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import type { MapComposition, ResultArtifact } from "../types";
import AdminTopicCompositionManagementPage from "./AdminTopicCompositionManagementPage";
import "antd/dist/reset.css";
import "../styles.css";

const { api, context } = vi.hoisted(() => ({
  api: {
    mapCompositions: vi.fn(),
    resultArtifacts: vi.fn(),
    publishMapComposition: vi.fn(),
    unpublishMapComposition: vi.fn(),
    updateResultArtifact: vi.fn(),
    deleteMapComposition: vi.fn(),
    downloadMapCompositionVersion: vi.fn(),
    downloadResultArtifact: vi.fn(),
  },
  context: {
    user: {
      permissions: {
        canViewMapCompositions: true,
        canViewResultArtifacts: true,
      },
    },
  },
}));
vi.mock("../api/client", () => ({ api }));
vi.mock("../contexts/AppContext", () => ({ useAppContext: () => context }));
vi.mock("../components/PdfPreview", () => ({
  default: ({ title }: { title: string }) => (
    <div data-testid="pdf-preview">{title}</div>
  ),
}));
const owner = { id: 1, username: "reviewer", displayName: "成果管理员" };
const group = { id: 2, name: "科研用户", isGuest: false, isSuperadmin: false };
const version = {
  id: 101,
  compositionId: 1,
  versionNumber: 1,
  format: "png" as const,
  dpi: 240,
  widthPx: 1200,
  heightPx: 800,
  snapshotSchemaVersion: 1,
  snapshotChecksum: "hash",
  previewUrl: "/map-preview.png",
  downloadUrl: "/map.png",
  createdAt: "2026-11-10T10:00:00Z",
};
const composition: MapComposition = {
  id: 1,
  projectId: 7,
  projectName: "河岸监测工程",
  name: "胡杨专题图",
  description: "河岸分布专题",
  status: "completed",
  layout: {},
  owner,
  audienceGroups: [group],
  currentVersion: version,
  publishedVersion: null,
  versions: [version],
  isOwner: true,
  canPreview: true,
  canDownload: true,
  canEditLayout: true,
  canPublish: true,
  canUnpublish: false,
  canRestoreProject: true,
  canLoadSourceProject: true,
  canDelete: true,
  publishedAt: null,
  publishedBy: null,
  createdAt: "2026-11-10T10:00:00Z",
  updatedAt: "2026-11-10T10:00:00Z",
};
function artifact(overrides: Partial<ResultArtifact> = {}): ResultArtifact {
  return {
    id: 1,
    name: "外部导入成果",
    description: "外部成果",
    sourceType: "direct_import",
    resultType: "image",
    status: "published",
    category: {
      id: 1,
      type: "data_category",
      code: "distribution_vector",
      name: "分布矢量",
      parentId: null,
      selectable: true,
    },
    categoryPath: [],
    provider: "研究团队",
    fileName: "external.png",
    fileFormat: "png",
    sizeBytes: 1024,
    previewUrl: "/result-preview.png",
    downloadUrl: "/result.png",
    owner,
    accessGroups: [group],
    canPreview: true,
    canDownload: true,
    canPublish: true,
    canUnpublish: true,
    canDelete: true,
    publishedAt: "2026-11-12T10:00:00Z",
    publishedBy: owner,
    createdAt: "2026-11-12T10:00:00Z",
    updatedAt: "2026-11-12T10:00:00Z",
    ...overrides,
  };
}
const report = artifact({
  id: 2,
  name: "非地理分析报告",
  sourceType: "analysis",
  resultType: "report",
  fileName: "analysis.pdf",
  fileFormat: "pdf",
  requiresReview: true,
  status: "in_review",
  canUnpublish: false,
  updatedAt: "2026-11-13T10:00:00Z",
});
const draft = artifact({
  id: 3,
  name: "退回修改的报告",
  sourceType: "analysis",
  resultType: "report",
  fileName: "draft.pdf",
  fileFormat: "pdf",
  requiresReview: true,
  status: "draft",
  canPublish: false,
  canUnpublish: false,
  canEditReport: true,
  canSubmitReview: true,
  reviewNote: "补充样地和统计单位",
  sourceResourceId: 9,
});
let maps: MapComposition[];
let artifacts: ResultArtifact[];
function show(initialEntry = "/resources/manage/topics") {
  return render(
    <AntApp>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AdminTopicCompositionManagementPage />
      </MemoryRouter>
    </AntApp>,
  );
}
async function row(name: string) {
  const element = await screen.findByText(name, { selector: "strong" });
  return within(element.closest("tr")!);
}
async function select(label: string, option: string) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: label }));
  fireEvent.click(
    await screen.findByText(option, {
      selector: ".ant-select-item-option-content",
    }),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  context.user.permissions.canViewMapCompositions = true;
  context.user.permissions.canViewResultArtifacts = true;
  maps = [{ ...composition }];
  artifacts = [artifact(), { ...report }, { ...draft }];
  api.mapCompositions.mockImplementation(async () => ({
    items: maps,
    availableAudienceGroups: [group],
  }));
  api.resultArtifacts.mockImplementation(async () => ({
    items: artifacts,
    availableAccessGroups: [group],
  }));
  api.publishMapComposition.mockImplementation(async (id) => {
    maps = maps.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "published",
            publishedVersion: version,
            audienceGroups: [group],
            canUnpublish: true,
          }
        : item,
    );
    return maps.find((item) => item.id === id);
  });
  api.updateResultArtifact.mockImplementation(async (id, payload) => {
    const status =
      payload.action === "publish"
        ? "published"
        : payload.action === "submit_review"
          ? "in_review"
          : "draft";
    artifacts = artifacts.map((item) =>
      item.id === id
        ? {
            ...item,
            status,
            canSubmitReview: status === "draft",
            canEditReport: status === "draft",
            canPublish: status !== "draft",
            canUnpublish: status === "published",
            reviewNote: payload.reviewNote ?? item.reviewNote,
          }
        : item,
    );
    return artifacts.find((item) => item.id === id);
  });
  api.downloadResultArtifact.mockResolvedValue({
    blob: new Blob(["pdf"], { type: "application/pdf" }),
    filename: "report.pdf",
  });
  api.downloadMapCompositionVersion.mockResolvedValue({
    blob: new Blob(["png"], { type: "image/png" }),
    filename: "map.png",
  });
});
afterEach(async () => {
  await page.viewport(1600, 900);
});

describe("unified result management", () => {
  it("shows maps, imports and reports in one table with distinct keys and newest first", async () => {
    show();
    await row(report.name);
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(1);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent(report.name);
    expect((await row(composition.name)).getByText("专题制图")).toBeVisible();
    expect((await row("外部导入成果")).getByText("直接导入")).toBeVisible();
    expect((await row(report.name)).getByText("平台分析")).toBeVisible();
    expect(document.querySelector('[data-row-key="mapping-1"]')).not.toBeNull();
    expect(
      document.querySelector('[data-row-key="artifact-1"]'),
    ).not.toBeNull();
    expect(screen.getByText("审核意见：补充样地和统计单位")).toBeVisible();
    await page.screenshot({
      path: "../../output/playwright/results-unified-mixed.png",
    });
  });

  it("combines source, review status and keyword filters across both result services", async () => {
    show();
    await row(report.name);
    await select("成果状态", "待审核");
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.queryByText(composition.name)).not.toBeInTheDocument();
    await select("成果来源", "直接导入");
    expect(screen.queryByText(report.name)).not.toBeInTheDocument();
    await select("成果状态", "全部状态");
    await row("外部导入成果");
    await select("成果来源", "全部来源");
    await select("成果状态", "未发布（含草稿）");
    await row(composition.name);
    await row(draft.name);
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.queryByText(report.name)).not.toBeInTheDocument();
    expect(screen.queryByText("外部导入成果")).not.toBeInTheDocument();
    await select("成果状态", "全部状态");
    fireEvent.change(screen.getByPlaceholderText(/按成果名称/), {
      target: { value: "河岸监测工程" },
    });
    await row(composition.name);
    expect(screen.queryByText("外部导入成果")).not.toBeInTheDocument();
  });

  it("routes preview and publication to the right service even when IDs overlap", async () => {
    show();
    fireEvent.click(
      (await row(report.name)).getByRole("button", { name: /预览/ }),
    );
    await screen.findByTestId("pdf-preview");
    expect(api.downloadResultArtifact).toHaveBeenCalledWith(2, "preview");
    fireEvent.click(
      screen.getByRole("dialog").querySelector(".ant-modal-close")!,
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    fireEvent.click(
      (await row(report.name)).getByRole("button", { name: "审核发布" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "确认发布" }));
    await waitFor(() =>
      expect(api.updateResultArtifact).toHaveBeenCalledWith(2, {
        action: "publish",
        accessGroupIds: [2],
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    fireEvent.click(
      (await row(composition.name)).getByRole("button", { name: "发布" }),
    );
    await waitFor(() => expect(screen.getByText("正式发布版本")).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "确认发布" }));
    await waitFor(() =>
      expect(api.publishMapComposition).toHaveBeenCalledWith(1, {
        versionNumber: 1,
        audienceGroupIds: [2],
      }),
    );
    expect((await row("外部导入成果")).getByText("已发布")).toBeVisible();
  });

  it("submits drafts and returns reviewed reports with feedback in the same list", async () => {
    show();
    fireEvent.click(
      (await row(draft.name)).getByRole("button", { name: "提交审核" }),
    );
    await waitFor(() =>
      expect(api.updateResultArtifact).toHaveBeenCalledWith(3, {
        action: "submit_review",
      }),
    );
    await waitFor(async () =>
      expect((await row(draft.name)).getByText("待审核")).toBeVisible(),
    );
    fireEvent.click(
      (await row(report.name)).getByRole("button", { name: "退回修改" }),
    );
    fireEvent.change(await screen.findByRole("textbox", { name: "退回意见" }), {
      target: { value: "请核对坐标系" },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "确认退回",
      }),
    );
    await waitFor(() =>
      expect(api.updateResultArtifact).toHaveBeenCalledWith(2, {
        action: "reject",
        reviewNote: "请核对坐标系",
      }),
    );
    expect(await screen.findByText("审核意见：请核对坐标系")).toBeVisible();
  });

  it("reviews externally imported PDFs through the same publication flow", async () => {
    artifacts = [{ ...report, sourceType: "direct_import" }];
    show();
    const item = await row(report.name);
    expect(item.getByText("直接导入")).toBeVisible();
    expect(item.getByText("待审核")).toBeVisible();
    fireEvent.click(item.getByRole("button", { name: "审核发布" }));
    fireEvent.click(await screen.findByRole("button", { name: "确认发布" }));
    await waitFor(() =>
      expect(api.updateResultArtifact).toHaveBeenCalledWith(2, {
        action: "publish",
        accessGroupIds: [2],
      }),
    );
    expect(api.publishMapComposition).not.toHaveBeenCalled();
  });

  it("unpublishes an imported result without touching a map with the same ID", async () => {
    show();
    fireEvent.click(
      (await row("外部导入成果")).getByRole("button", { name: "下架" }),
    );
    await waitFor(() =>
      expect(api.updateResultArtifact).toHaveBeenCalledWith(1, {
        action: "unpublish",
      }),
    );
    await waitFor(async () =>
      expect((await row("外部导入成果")).getByText("草稿")).toBeVisible(),
    );
    expect((await row(composition.name)).getByText("未发布")).toBeVisible();
    expect(api.unpublishMapComposition).not.toHaveBeenCalled();
  });

  it("keeps record-level restrictions and does not request inaccessible sources", async () => {
    context.user.permissions.canViewMapCompositions = false;
    artifacts = [
      artifact({
        canPublish: false,
        canDelete: false,
        canDownload: false,
        canUnpublish: false,
      }),
    ];
    show();
    const item = await row("外部导入成果");
    expect(api.mapCompositions).not.toHaveBeenCalled();
    expect(item.getByRole("button", { name: "更新范围" })).toBeDisabled();
    expect(item.getByRole("button", { name: "下载" })).toBeDisabled();
    expect(item.getByRole("button", { name: "删除" })).toBeDisabled();
    expect(
      item.queryByRole("button", { name: "下架" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the available source visible when another source fails", async () => {
    api.mapCompositions.mockRejectedValue(new Error("offline"));
    show();
    await row(report.name);
    await waitFor(() =>
      expect(screen.getByText("专题图成果加载失败")).toBeVisible(),
    );
    expect(screen.getAllByRole("row")).toHaveLength(4);
  });

  it("paginates the combined list and resets to page one after filtering", async () => {
    artifacts = Array.from({ length: 13 }, (_, index) =>
      artifact({ id: index + 10, name: `导入成果${index + 10}` }),
    );
    show();
    await row("导入成果10");
    expect(screen.getByText("共 14 条")).toBeVisible();
    fireEvent.click(screen.getByTitle("2"));
    await row(composition.name);
    await select("成果来源", "专题制图");
    expect(screen.getByText("共 1 条")).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });
});

it("opens the shared pending link with maps and submitted reports only, and lets reviewers show all results", async () => {
  maps.push({
    ...composition,
    id: 15,
    name: "不可发布的他人专题图",
    canPublish: false,
  });
  artifacts.push(
    artifact({
      id: 16,
      name: "不可处理的审核成果",
      status: "in_review",
      canPublish: false,
    }),
  );
  show("/resources/manage/topics?status=pending");
  await row("胡杨专题图");
  await row("非地理分析报告");
  expect(
    screen.getByRole("combobox", { name: "成果状态" }).closest(".ant-select"),
  ).toHaveTextContent("待审核/发布");
  for (const name of [
    "外部导入成果",
    "退回修改的报告",
    "不可发布的他人专题图",
    "不可处理的审核成果",
  ])
    expect(
      screen.queryByText(name, { selector: "strong" }),
    ).not.toBeInTheDocument();
  await select("成果状态", "全部状态");
  await row("外部导入成果");
  await row("退回修改的报告");
});
