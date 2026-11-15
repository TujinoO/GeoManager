import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { AppContext } from "../contexts/AppContext";
import { appTheme } from "../theme";
import type { Bootstrap, MapComposition, ResultArtifact, User } from "../types";
import ResultsPage from "./ResultsPage";
import "antd/dist/reset.css";
import "../styles.css";
import {
  notifyWorkspaceInventoryChanged,
  workspaceInventoryChangedEvent,
} from "../workspace/workspaceSync";

const mockApi = vi.hoisted(() => ({
  resources: vi.fn(),
  workspaces: vi.fn(),
  mapCompositions: vi.fn(),
  resultArtifacts: vi.fn(),
  resultReviewSummary: vi.fn(),
  downloadMapCompositionVersion: vi.fn(),
  downloadResultArtifact: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../api/client", () => ({
  api: mockApi,
}));

const bootstrap: Bootstrap = {
  systemName: "全球胡杨林生态系统保护数据共享平台",
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
    maxRasterSidePixels: 10000,
  },
};

const viewer: User = {
  id: 8,
  username: "topic-viewer",
  displayName: "专题成果查看用户",
  email: "topic-viewer@example.local",
  avatarUrl: "",
  department: "生态监测组",
  isStaff: false,
  isSuperuser: false,
  roles: ["专题成果访问组"],
  groupIds: [18],
  isActive: true,
  operationLogGroupIds: [],
  permissions: {
    canAccessAdmin: true,
    canManageFeaturePermissions: false,
    canCreateUser: false,
    canViewOperationLogs: false,
    canViewAllOperationLogs: false,
    canViewOwnOperationLogs: false,
    canViewGroupOperationLogs: false,
    canViewSystemLogs: false,
    canManageSystemSettings: false,
    canManageDataBackup: false,
    canManageAuth: false,
    canViewDashboardResourceCard: false,
    canViewDashboardLayerCard: false,
    canViewDashboardRasterCard: false,
    canViewDashboardUserCard: false,
    canViewDashboardActiveUsersCard: false,
    canViewDashboardSystemCard: false,
    canViewDataOverview: false,
    canBrowseData: true,
    canQueryData: false,
    canUploadData: false,
    canViewDataResources: true,
    canCreateDataResources: false,
    canChangeDataResources: false,
    canDeleteDataResources: false,
    canLoadVectorLayer: false,
    canLoadRasterLayer: false,
    canUseCustomSymbolization: false,
    canUseAiInterpretation: false,
    canExportData: false,
    canViewWorkspaces: false,
    canCreateWorkspaces: false,
    canChangeWorkspaces: false,
    canDeleteWorkspaces: false,
    canViewMapCompositions: true,
    canCreateMapCompositions: false,
    canChangeMapCompositions: false,
    canDeleteMapCompositions: false,
    canExportMapCompositions: true,
    canPublishMapCompositions: false,
    canRestoreMapCompositions: false,
    canViewResultArtifacts: true,
    canImportResultArtifacts: false,
    canDownloadResultArtifacts: true,
    canPublishResultArtifacts: false,
    canDeleteResultArtifacts: false,
    canManageRasterData: false,
  },
};

const publishedVersion = {
  id: 103,
  compositionId: 27,
  versionNumber: 3,
  format: "pdf" as const,
  dpi: 300,
  widthPx: 3200,
  heightPx: 2400,
  note: "正式发布版",
  snapshotSchemaVersion: 2,
  snapshotChecksum: "a".repeat(64),
  previewUrl:
    new URL("../assets/login-ecosystem-bg.jpg", import.meta.url).href +
    "?variant=preview",
  downloadUrl:
    "/api/catalog/map-compositions/27/versions/3/file/?variant=artifact",
  createdAt: "2026-07-22T10:30:00+08:00",
};

const publishedComposition: MapComposition = {
  id: 27,
  projectId: 9,
  projectName: "塔里木河胡杨监测工程",
  name: "塔里木河胡杨分布专题图",
  description: "由地理工作台制作并发布的胡杨分布专题成果。",
  status: "published",
  layout: {},
  owner: {
    id: 2,
    username: "map-composer",
    displayName: "专题制图员",
  },
  audienceGroups: [
    {
      id: 18,
      name: "专题成果访问组",
      isGuest: false,
      isSuperadmin: false,
    },
  ],
  currentVersion: publishedVersion,
  publishedVersion,
  versions: [publishedVersion],
  isOwner: false,
  canPreview: true,
  canDownload: true,
  canEditLayout: false,
  canPublish: false,
  canUnpublish: false,
  canRestoreProject: false,
  canLoadSourceProject: false,
  canDelete: false,
  publishedAt: "2026-07-23T09:00:00+08:00",
  publishedBy: {
    id: 2,
    username: "map-composer",
    displayName: "专题制图员",
  },
  createdAt: "2026-07-21T09:00:00+08:00",
  updatedAt: "2026-07-23T09:00:00+08:00",
};

function ManagementDestination() {
  const location = useLocation();
  return (
    <output aria-label="管理目标地址">
      {location.pathname + location.search}
    </output>
  );
}

function renderResultsPage(user = viewer) {
  const setBootstrap = vi.fn();
  const setUser = vi.fn();
  return render(
    <ConfigProvider locale={zhCN} theme={appTheme}>
      <AntApp>
        <AppContext.Provider value={{ bootstrap, user, setBootstrap, setUser }}>
          <MemoryRouter initialEntries={["/results"]}>
            <Routes>
              <Route path="/results" element={<ResultsPage />} />
              <Route
                path="/resources/manage/topics"
                element={<ManagementDestination />}
              />
            </Routes>
          </MemoryRouter>
        </AppContext.Provider>
      </AntApp>
    </ConfigProvider>,
  );
}

describe("ResultsPage published map compositions", () => {
  afterEach(async () => {
    window.scrollTo(0, 0);
    await page.viewport(1600, 900);
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.resultReviewSummary.mockResolvedValue({
      pendingCount: 5,
      pendingMapCount: 2,
      pendingArtifactCount: 3,
    });
    mockApi.resources.mockResolvedValue({ items: [] });
    mockApi.workspaces.mockResolvedValue({ items: [] });
    mockApi.mapCompositions.mockResolvedValue({
      items: [publishedComposition],
      availableAudienceGroups: [],
    });
    mockApi.resultArtifacts.mockResolvedValue({
      items: [],
      availableAccessGroups: [],
    });
    mockApi.downloadMapCompositionVersion.mockResolvedValue({
      blob: new Blob(["published-map"], { type: "image/png" }),
      filename: "塔里木河胡杨分布专题图_V3.png",
    });
  });

  it("keeps the navigation visible while scrolling cards and lists at desktop and mobile widths", async () => {
    mockApi.mapCompositions.mockResolvedValue({
      items: Array.from({ length: 12 }, (_, index) => ({
        ...publishedComposition,
        id: 100 + index,
        name: `已发布成果${index + 1}`,
      })),
      availableAudienceGroups: [],
    });
    renderResultsPage();
    await screen.findByText("已发布成果12");
    const header = document.querySelector<HTMLElement>(
      ".results-page-shell > .workspace-header",
    )!;
    for (const size of [
      { width: 1600, height: 900 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
    ]) {
      await page.viewport(size.width, size.height);
      for (const view of ["卡片", "列表"]) {
        window.scrollTo(0, 0);
        fireEvent.click(screen.getByRole("radio", { name: new RegExp(view) }));
        await waitFor(() => {
          const rect = header.getBoundingClientRect();
          expect(
            document.querySelector(".results-page")!.getBoundingClientRect()
              .top,
          ).toBeGreaterThanOrEqual(rect.bottom);
        });
        const top = header.getBoundingClientRect().top;
        window.scrollTo(0, 900);
        await waitFor(() => {
          expect(window.scrollY).toBeGreaterThan(300);
          const rect = header.getBoundingClientRect();
          expect(rect.top).toBeCloseTo(top, 0);
          expect(rect.top).toBeGreaterThanOrEqual(0);
          expect(rect.bottom).toBeLessThan(size.height);
          expect(rect.right).toBeLessThanOrEqual(size.width);
          expect(
            document
              .elementFromPoint(rect.left + 10, rect.top + 10)
              ?.closest("header"),
          ).toBe(header);
        });
      }
    }
  });

  it("hides the management shortcut and makes no count request for a viewer", async () => {
    renderResultsPage();
    await screen.findByText(publishedComposition.name);
    expect(
      screen.queryByRole("button", { name: /成果管理与审核/ }),
    ).not.toBeInTheDocument();
    expect(mockApi.resultReviewSummary).not.toHaveBeenCalled();
  });

  it("shows a prominent count badge and opens pending management for an authorized reviewer at desktop and mobile widths", async () => {
    renderResultsPage({
      ...viewer,
      permissions: { ...viewer.permissions, canPublishResultArtifacts: true },
    });
    await screen.findByText("2 份专题图待发布 · 3 份成果待审核");
    expect(screen.getByTitle("待审核/发布 5 份")).toHaveTextContent("5");
    const button = screen.getByRole("button", { name: /成果管理与审核/ });
    for (const size of [
      { width: 1600, height: 900 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
    ]) {
      await page.viewport(size.width, size.height);
      window.scrollTo(0, 0);
      await waitFor(() => {
        const rect = button.getBoundingClientRect();
        const badge = document
          .querySelector(".results-review-badge .ant-badge-count")!
          .getBoundingClientRect();
        expect(rect.left).toBeGreaterThanOrEqual(0);
        expect(rect.right).toBeLessThanOrEqual(size.width);
        expect(rect.height).toBeGreaterThanOrEqual(44);
        expect(badge.top).toBeLessThan(rect.top + 4);
        expect(badge.right).toBeLessThanOrEqual(size.width);
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
          size.width,
        );
      });
    }
    await page.screenshot({
      path: "../../output/playwright/results-review-shortcut-mobile.png",
    });
    await page.viewport(1600, 900);
    await page.screenshot({
      path: "../../output/playwright/results-review-shortcut-desktop.png",
    });
    fireEvent.click(button);
    expect(await screen.findByLabelText("管理目标地址")).toHaveTextContent(
      "/resources/manage/topics?status=pending",
    );
  });

  it("refreshes the pending count after result changes and opens all management at zero", async () => {
    renderResultsPage({
      ...viewer,
      permissions: { ...viewer.permissions, canPublishMapCompositions: true },
    });
    await screen.findByTitle("待审核/发布 5 份");
    mockApi.resultReviewSummary.mockResolvedValue({
      pendingCount: 0,
      pendingMapCount: 0,
      pendingArtifactCount: 0,
    });
    notifyWorkspaceInventoryChanged("result");
    await screen.findByText("当前暂无待审核或待发布成果，可进入管理全部成果。");
    expect(screen.getByTitle("待审核/发布 0 份")).toHaveTextContent("0");
    fireEvent.click(screen.getByRole("button", { name: /成果管理与审核/ }));
    expect(await screen.findByLabelText("管理目标地址")).toHaveTextContent(
      "/resources/manage/topics",
    );
    expect(screen.getByLabelText("管理目标地址")).not.toHaveTextContent(
      "status=pending",
    );
  });

  it("shows an unknown count on failure and allows retry instead of reporting zero", async () => {
    mockApi.resultReviewSummary.mockRejectedValueOnce(new Error("offline"));
    renderResultsPage({
      ...viewer,
      permissions: { ...viewer.permissions, canPublishResultArtifacts: true },
    });
    await screen.findByText("待办数量暂不可用，仍可进入成果管理。");
    expect(screen.queryByTitle("待审核/发布 0 份")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /重新获取数量/ }));
    await screen.findByTitle("待审核/发布 5 份");
  });

  it("refreshes on focus and cross-tab result notifications, and removes its listeners on leaving", async () => {
    const view = renderResultsPage({
      ...viewer,
      permissions: { ...viewer.permissions, canPublishResultArtifacts: true },
    });
    await screen.findByTitle("待审核/发布 5 份");
    const initial = mockApi.resultReviewSummary.mock.calls.length;
    fireEvent(window, new Event("focus"));
    await waitFor(() =>
      expect(mockApi.resultReviewSummary.mock.calls.length).toBeGreaterThan(
        initial,
      ),
    );
    const focused = mockApi.resultReviewSummary.mock.calls.length;
    fireEvent(
      window,
      new StorageEvent("storage", {
        key: workspaceInventoryChangedEvent,
        newValue: JSON.stringify({ kind: "composition", at: Date.now() }),
      }),
    );
    await waitFor(() =>
      expect(mockApi.resultReviewSummary.mock.calls.length).toBeGreaterThan(
        focused,
      ),
    );
    view.unmount();
    const finalCalls = mockApi.resultReviewSummary.mock.calls.length;
    notifyWorkspaceInventoryChanged("result");
    fireEvent(window, new Event("focus"));
    expect(mockApi.resultReviewSummary.mock.calls.length).toBe(finalCalls);
  });

  it("loads lightweight image covers for PDFs and images in cards and lists, with no PDF fetch", async () => {
    const artifact: ResultArtifact = {
      id: 91,
      name: "非地理分析报告",
      description: "",
      sourceType: "analysis",
      resultType: "report",
      status: "published",
      category: {
        id: 1,
        code: "thematic_landscape_rs",
        name: "专题成果",
        type: "data_category",
        parentId: null,
        selectable: true,
      },
      categoryPath: [],
      provider: "测试单位",
      fileName: "report.pdf",
      fileFormat: "pdf",
      sizeBytes: 5000000,
      owner: publishedComposition.owner,
      accessGroups: publishedComposition.audienceGroups,
      canPreview: true,
      canDownload: true,
      canPublish: false,
      canUnpublish: false,
      canDelete: false,
      previewUrl: publishedVersion.previewUrl + "&report=91",
      downloadUrl: "/original-report.pdf",
      publishedAt: publishedComposition.publishedAt,
      publishedBy: publishedComposition.publishedBy,
      createdAt: publishedComposition.createdAt,
      updatedAt: publishedComposition.updatedAt,
    };
    mockApi.resultArtifacts.mockResolvedValue({
      items: [artifact],
      availableAccessGroups: [],
    });
    const fetch = vi.spyOn(window, "fetch");
    renderResultsPage();
    await screen.findByText(artifact.name);
    for (const view of ["卡片", "列表"]) {
      fireEvent.click(screen.getByRole("radio", { name: new RegExp(view) }));
      for (const name of [artifact.name, publishedComposition.name]) {
        const image = screen.getByAltText(
          `${name}成果预览`,
        ) as HTMLImageElement;
        image.scrollIntoView();
        await image.decode();
        expect(image.naturalWidth).toBeGreaterThan(0);
        expect(image.src).toContain("variant=thumbnail");
        expect(image).toHaveAttribute("loading", "lazy");
        expect(image).toHaveAttribute("decoding", "async");
        if (name === artifact.name)
          expect(getComputedStyle(image).objectFit).toBe("contain");
      }
    }
    expect(document.querySelector(".result-card-cover canvas")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });

  it("shows a format placeholder if a thumbnail fails without loading the original", async () => {
    renderResultsPage();
    const image = await screen.findByAltText("塔里木河胡杨分布专题图成果预览");
    fireEvent.error(image);
    expect(
      screen.queryByAltText("塔里木河胡杨分布专题图成果预览"),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector(".result-file-cover-placeholder"),
    ).toBeInTheDocument();
    expect(document.querySelector(".result-card-cover img")).toBeNull();
  });

  it("loads the published version from the workbench and exposes its preview and download", async () => {
    renderResultsPage();

    expect(
      await screen.findByText("塔里木河胡杨分布专题图"),
    ).toBeInTheDocument();
    expect(mockApi.mapCompositions).toHaveBeenCalledWith({
      status: "published",
    });
    expect(screen.getByText("V3")).toBeInTheDocument();
    expect(
      screen.getByText("来源工程：塔里木河胡杨监测工程"),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText("塔里木河胡杨分布专题图成果预览"),
    ).toHaveAttribute(
      "src",
      publishedVersion.previewUrl.replace(
        "variant=preview",
        "variant=thumbnail",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: /查看详情/ }));

    expect(
      screen.getAllByAltText("塔里木河胡杨分布专题图成果预览"),
    ).toHaveLength(2);
    expect(
      screen.queryByTitle("塔里木河胡杨分布专题图 PDF 预览"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /下载成果/ }));

    await waitFor(() =>
      expect(mockApi.downloadMapCompositionVersion).toHaveBeenCalledWith(
        publishedComposition.id,
        publishedVersion.versionNumber,
      ),
    );
  });
});
