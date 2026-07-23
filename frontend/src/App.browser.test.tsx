import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "vitest/browser";
import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { appTheme } from "./theme";
import type {
  Bootstrap,
  DataResourceProfile,
  ResourceListItem,
  ResourceQueryResult,
  User,
} from "./types";

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
      guestLogin: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      resources: vi.fn(),
      resourceProfile: vi.fn(),
      resourceVisualizationSummary: vi.fn(),
      queryResource: vi.fn(),
      workspaces: vi.fn(),
      scanCatalogSources: vi.fn(),
      scanRasterSources: vi.fn(),
      rasterJob: vi.fn(),
      adminOperationLogs: vi.fn(),
      adminSystemLogs: vi.fn(),
      adminDashboard: vi.fn(),
      adminDashboardServer: vi.fn(),
      dataSchemaSummary: vi.fn(),
    },
  };
});

vi.mock("./api/client", () => ({
  ApiError: MockApiError,
  api: mockApi,
  registerForbiddenHandler: vi.fn(),
  unregisterForbiddenHandler: vi.fn(),
}));

vi.mock("./components/MapCanvas", () => ({
  default: () => <div data-testid="map-canvas" />,
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

const basePermissions = {
  canAccessAdmin: true,
  canManageFeaturePermissions: false,
  canCreateUser: false,
  canViewOperationLogs: false,
  canViewAllOperationLogs: false,
  canViewOwnOperationLogs: false,
  canViewGroupOperationLogs: false,
  canViewSystemLogs: false,
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
  canViewWorkspaces: false,
  canCreateWorkspaces: false,
  canChangeWorkspaces: false,
  canDeleteWorkspaces: false,
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
  operationLogGroupIds: [],
  permissions: basePermissions,
};

const adminUser: User = {
  ...normalUser,
  id: 2,
  username: "admin",
  displayName: "系统管理员",
  isStaff: false,
  isSuperuser: false,
  roles: ["系统管理员"],
  permissions: {
    ...basePermissions,
    canManageFeaturePermissions: true,
    canCreateUser: true,
    canManageRasterData: true,
  },
};

const tarimVectorResource: ResourceListItem = {
  id: 21,
  name: "塔里木河胡杨样地监测点",
  code: "tarim-poplar-monitoring-2026",
  dataType: "vector",
  spatialClass: "spatial",
  domainType: "field_survey",
  category: {
    id: 101,
    type: "data_category",
    code: "thematic_population",
    name: "种群",
    parentId: 100,
    selectable: true,
  },
  categoryPath: [
    { id: 100, code: "thematic", name: "胡杨专题数据" },
    { id: 101, code: "thematic_population", name: "种群" },
  ],
  classificationStatus: "classified",
  availableViews: ["map", "table", "metadata"],
  defaultView: "map",
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

const nonGeoTableResource: ResourceListItem = {
  id: 22,
  name: "2024 塔里木盆地植物调查基础数据",
  code: "tarim-plant-metadata-2024",
  dataType: "table",
  spatialClass: "non_spatial",
  domainType: "field_survey",
  category: null,
  categoryPath: [],
  classificationStatus: "pending",
  availableViews: ["metadata"],
  defaultView: "metadata",
  source: "用户导入",
  provider: "",
  dataDate: null,
  spatialExtent: "",
  coordinateSystem: "",
  fileFormat: "SQLITE",
  description: "不含经纬度的调查元数据",
  qualityNote: "",
  status: "active",
  isQueryable: false,
  isRenderable: false,
  updatedAt: "2026-07-14T10:00:00+08:00",
  sizeBytes: 1024,
  itemCount: 8,
};

const tarimVectorProfile: DataResourceProfile = {
  resource: tarimVectorResource,
  fields: [
    {
      name: "sample_id",
      type: "str",
      nullable: false,
      sampleValues: ["TP-2026-001"],
      description: "样点编号",
    },
    {
      name: "dbh_cm",
      type: "float",
      nullable: false,
      sampleValues: [32.5],
      description: "胸径",
    },
  ],
  featureCount: 3,
  geometryType: "Point",
  bounds: [87.6, 43.7951, 87.6428, 43.81245],
};

const tarimQueryResult: ResourceQueryResult = {
  resourceId: 21,
  resourceName: "塔里木河胡杨样地监测点",
  totalCount: 3,
  returnedCount: 3,
  limit: 30000,
  fields: tarimVectorProfile.fields,
  geojson: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [87.6, 43.8] },
        properties: {
          sample_id: "TP-2026-001",
          health: "良好",
          dbh_cm: 32.5,
        },
      },
    ],
  },
  warnings: [],
};

const tarimVisualizationSummary = {
  resource: tarimVectorResource,
  domainType: "field_survey",
  generatedAt: "2026-06-18T12:00:00+08:00",
  source: "backend_aggregate",
  profile: {
    featureCount: 3,
    fieldCount: tarimVectorProfile.fields.length,
    geometryType: "Point",
    bounds: tarimVectorProfile.bounds,
  },
  categoryStats: [],
  numericStats: [],
  spatialSummary: {
    featureCount: 3,
    validGeometryCount: 3,
    nullGeometryCount: 0,
    coordinateCoverageRatio: 1,
    bounds: tarimVectorProfile.bounds,
    geometryTypes: [],
    centroid: [87.6214, 43.803775],
  },
  qualityIssues: [],
  recommendedCharts: [],
  recommendedSymbolizations: [],
  monitorPreview: {
    title: "资源质量监测",
    status: "ready",
    items: [],
  },
};

function renderApp(initialEntry: string) {
  return render(
    <ConfigProvider locale={zhCN} theme={appTheme}>
      <AntApp>
        <MemoryRouter initialEntries={[initialEntry]}>
          <App />
        </MemoryRouter>
      </AntApp>
    </ConfigProvider>,
  );
}

async function clickFirstResourceSelectButton() {
  let selectResourceButton: HTMLButtonElement | null = null;
  await waitFor(() => {
    selectResourceButton = document.querySelector<HTMLButtonElement>(
      ".resource-row button:not(.resource-quick-load-button)",
    );
    expect(selectResourceButton).not.toBeNull();
  });
  fireEvent.click(selectResourceButton!);
}

describe("application critical flows", () => {
  beforeEach(() => {
    window.localStorage.clear();
    for (const fn of Object.values(mockApi)) {
      fn.mockReset();
    }
    mockApi.bootstrap.mockResolvedValue(bootstrap);
    mockApi.csrf.mockResolvedValue({ detail: "csrf cookie set" });
    mockApi.me.mockRejectedValue(new MockApiError("未登录", 401));
    mockApi.login.mockResolvedValue({ user: normalUser });
    mockApi.guestLogin.mockResolvedValue({
      user: {
        ...normalUser,
        id: 99,
        username: "guest",
        displayName: "游客",
        roles: ["游客"],
      },
    });
    mockApi.adminDashboard.mockResolvedValue({
      generatedAt: "2026-01-01T00:00:00+08:00",
      cards: {},
    });
    mockApi.adminDashboardServer.mockResolvedValue({ cards: {} });
    mockApi.dataSchemaSummary.mockResolvedValue({
      taxonomyVersion: "2026.07",
      domains: [],
      layers: [],
      entities: [],
      catalogTree: [],
    });
    mockApi.register.mockResolvedValue({
      user: normalUser,
      detail: "用户注册成功",
      roleApplication: null,
    });
    mockApi.logout.mockResolvedValue({ detail: "已退出" });
    mockApi.resources.mockResolvedValue({ items: [] });
    mockApi.resourceProfile.mockResolvedValue(tarimVectorProfile);
    mockApi.resourceVisualizationSummary.mockResolvedValue(
      tarimVisualizationSummary,
    );
    mockApi.queryResource.mockResolvedValue(tarimQueryResult);
    mockApi.workspaces.mockResolvedValue({
      items: [],
      availableAccessGroups: [],
    });
    mockApi.scanCatalogSources.mockResolvedValue({ detail: "ok" });
    mockApi.scanRasterSources.mockResolvedValue({
      id: "scan-job",
      status: "ready",
    });
    mockApi.rasterJob.mockResolvedValue({
      id: "scan-job",
      status: "ready",
      progressPercent: 100,
      messages: [],
    });
    mockApi.adminOperationLogs.mockResolvedValue({
      items: [],
      total: 0,
    });
    mockApi.adminSystemLogs.mockResolvedValue({
      files: [],
      selectedFile: "",
      lines: 500,
      content: "",
      generatedAt: "2026-06-20T09:45:10+08:00",
    });
  });

  it("redirects unauthenticated users to login and enters the data catalog after login", async () => {
    renderApp("/");

    expect(
      await screen.findByRole("heading", { name: "用户登录" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "全球胡杨林生态系统保护数据共享平台",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Global Poplar Forest Ecosystem Protection Data Sharing Platform",
      ).length,
    ).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText("请输入账号"), {
      target: { value: "researcher" },
    });
    fireEvent.change(screen.getByPlaceholderText("请输入密码"), {
      target: { value: "pass12345" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /登录并进入数据平台$/ }),
    );

    await waitFor(() => {
      expect(mockApi.login).toHaveBeenCalledWith(
        "researcher",
        "pass12345",
        true,
      );
    });
    expect(
      await screen.findByRole(
        "heading",
        { name: "胡杨生态数据资源目录" },
        { timeout: 10000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^首页$/ })).toHaveClass(
      "workspace-switch-card-active",
    );
    expect(
      screen.getByRole("button", { name: /^地理工作台$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^数据分析$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /后台管理/ }),
    ).toBeInTheDocument();
  });

  it("submits required email and a separate research role application", async () => {
    mockApi.bootstrap.mockResolvedValue({
      ...bootstrap,
      allowRegistration: true,
    });
    mockApi.register.mockResolvedValue({
      user: normalUser,
      detail: "用户注册成功，科研用户权限申请已提交",
      roleApplication: {
        id: 1,
        userId: normalUser.id,
        requestedRole: "research",
        status: "pending",
        reason: "需要上传长期监测数据",
        reviewNote: "",
        createdAt: "2026-07-14T10:30:00+08:00",
        reviewedAt: null,
      },
    });

    renderApp("/");

    expect(
      await screen.findByRole("heading", { name: "用户登录" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /注册新账号/ }));
    expect(
      await screen.findByRole("heading", { name: "用户注册" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("首个注册用户自动成为系统管理员。"),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("请输入账号"), {
      target: { value: "research_applicant" },
    });
    fireEvent.change(screen.getByPlaceholderText("请输入邮箱"), {
      target: { value: "Applicant@Example.COM" },
    });
    await userEvent.click(screen.getByText("申请科研用户"));
    fireEvent.change(await screen.findByPlaceholderText("请输入真实姓名"), {
      target: { value: "张研究员" },
    });
    fireEvent.change(screen.getByPlaceholderText("请输入单位或部门"), {
      target: { value: "生态监测组" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(
        "请简要说明需要上传、导出或科研分析权限的用途",
      ),
      { target: { value: "需要上传长期监测数据" } },
    );
    const passwordFields = screen.getAllByPlaceholderText(
      /请输入密码|请再次输入密码/,
    );
    fireEvent.change(passwordFields[0], {
      target: { value: "StrongPass12345" },
    });
    fireEvent.change(passwordFields[1], {
      target: { value: "StrongPass12345" },
    });
    fireEvent.click(screen.getByRole("button", { name: /注册并进入/ }));

    await waitFor(() => {
      expect(mockApi.register).toHaveBeenCalledWith({
        username: "research_applicant",
        email: "Applicant@Example.COM",
        accountPurpose: "research",
        displayName: "张研究员",
        department: "生态监测组",
        applicationReason: "需要上传长期监测数据",
        password: "StrongPass12345",
        passwordConfirm: "StrongPass12345",
      });
    });
  });

  it("retries app startup while the backend is still becoming ready", async () => {
    mockApi.bootstrap
      .mockRejectedValueOnce(new MockApiError("后端服务尚未就绪", 503))
      .mockResolvedValue(bootstrap);

    renderApp("/");

    await waitFor(() => {
      expect(mockApi.bootstrap).toHaveBeenCalledTimes(1);
    });

    expect(
      await screen.findByRole("heading", { name: "用户登录" }),
    ).toBeInTheDocument();
    expect(mockApi.bootstrap).toHaveBeenCalledTimes(2);
    expect(mockApi.csrf).toHaveBeenCalledTimes(2);
  });

  it("allows visitors to enter the unified data catalog through guest login", async () => {
    renderApp("/");

    expect(
      await screen.findByRole("heading", { name: "用户登录" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /游客登录/ }));

    await waitFor(() => {
      expect(mockApi.guestLogin).toHaveBeenCalled();
    });
    expect(
      await screen.findByRole(
        "heading",
        { name: "胡杨生态数据资源目录" },
        { timeout: 10000 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /后台管理/ }),
    ).not.toBeInTheDocument();
  });

  it("opens core platform functions from the homepage launchpad", async () => {
    mockApi.me.mockResolvedValue({ authenticated: true, user: normalUser });

    renderApp("/data");

    expect(
      await screen.findByRole(
        "heading",
        { name: "核心功能快捷入口" },
        { timeout: 10000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("中亚胡杨生态数据门户")).toBeInTheDocument();
    expect(
      screen.getByText("服务生态保护 · 科学研究 · 数据共享"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/权威分类版本/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /进入数据概览/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /进入数据分析/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /进入成果展示/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /进入地理工作台/ }));

    expect(
      await screen.findByTestId("map-canvas", {}, { timeout: 10000 }),
    ).toBeInTheDocument();
  });

  it("runs a representative vector query flow from resource selection to layer loading", async () => {
    mockApi.me.mockResolvedValue({ authenticated: true, user: normalUser });
    mockApi.resources.mockResolvedValue({ items: [tarimVectorResource] });

    renderApp("/map");

    expect(
      await screen.findByText("塔里木河胡杨样地监测点", {}, { timeout: 10000 }),
    ).toBeInTheDocument();
    await clickFirstResourceSelectButton();

    await waitFor(() => {
      expect(mockApi.resourceProfile).toHaveBeenCalledWith(tarimVectorResource);
    });
    expect(await screen.findByText("sample_id")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查询并加载" }));

    await waitFor(() => {
      expect(mockApi.queryResource).toHaveBeenCalledWith(tarimVectorResource, {
        attributeFilters: [],
        spatialFilter: null,
        limit: 30000,
      });
    });
    fireEvent.click(screen.getByRole("tab", { name: /图层/ }));
    await waitFor(() => {
      const layerItems = screen.getAllByRole("treeitem");
      expect(
        layerItems.some((item) =>
          item.textContent?.includes("塔里木河胡杨样地监测点"),
        ),
      ).toBe(true);
    });
  });

  it("isolates non-geographic resources and refreshes the real resource list", async () => {
    window.localStorage.setItem(
      `huyang-system.workspace-tour.v1.${normalUser.id}.${normalUser.username}`,
      "completed",
    );
    mockApi.me.mockResolvedValue({ authenticated: true, user: normalUser });
    mockApi.resources.mockResolvedValue({
      items: [nonGeoTableResource, tarimVectorResource],
    });

    renderApp("/nongeo");

    expect(
      (
        await screen.findAllByText(
          nonGeoTableResource.name,
          {},
          { timeout: 10000 },
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(tarimVectorResource.name),
    ).not.toBeInTheDocument();
    expect(await screen.findByText("记录总量")).toBeInTheDocument();
    expect(screen.getByText("字段角色")).toBeInTheDocument();
    expect(
      screen.queryByText("非地理分析接口暂不可用"),
    ).not.toBeInTheDocument();
    expect(mockApi.resources).toHaveBeenCalledWith({
      spatialClass: "non_spatial",
    });

    const refreshedResource = {
      ...nonGeoTableResource,
      id: 23,
      name: "刷新后识别的非地理资源",
    };
    mockApi.resources.mockResolvedValueOnce({ items: [refreshedResource] });
    fireEvent.click(screen.getByRole("button", { name: "刷新非地理数据资源" }));

    expect(await screen.findByText(refreshedResource.name)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryAllByText(nonGeoTableResource.name)).toHaveLength(0);
    });
  });

  it("runs a long research user journey without privileged data exposure", async () => {
    const researchUser: User = {
      ...normalUser,
      id: 31,
      username: "secure_researcher",
      displayName: "安全科研用户",
      roles: ["科研用户"],
      permissions: {
        ...basePermissions,
        canViewOwnOperationLogs: true,
        canViewOperationLogs: false,
        canViewSystemLogs: false,
        canManageSystemSettings: false,
        canManageDataBackup: false,
        canManageAuth: false,
      },
    };
    window.localStorage.setItem(
      `huyang-system.workspace-tour.v1.${researchUser.id}.${researchUser.username}`,
      "completed",
    );
    mockApi.me.mockResolvedValue({ authenticated: true, user: researchUser });
    mockApi.resources.mockResolvedValue({ items: [tarimVectorResource] });
    mockApi.adminOperationLogs.mockResolvedValue({
      items: [
        {
          id: 42,
          occurredAt: "2026-06-20 10:30:00",
          operator: "安全科研用户",
          module: "数据查询",
          action: "查询数据资源",
          result: "success",
          targetType: "data_resource",
          targetId: tarimVectorResource.id,
          targetCode: tarimVectorResource.code,
          targetName: tarimVectorResource.name,
          ipAddress: "203.0.113.31",
          summary: "本人查询塔里木河样地数据",
        },
      ],
      total: 1,
    });

    renderApp("/map");

    expect(
      await screen.findByText("塔里木河胡杨样地监测点", {}, { timeout: 10000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText("超级管理员")).not.toBeInTheDocument();
    expect(screen.queryByText("superadmin")).not.toBeInTheDocument();
    await clickFirstResourceSelectButton();
    expect(await screen.findByText("sample_id")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查询并加载" }));

    await waitFor(() => {
      expect(mockApi.queryResource).toHaveBeenCalledWith(tarimVectorResource, {
        attributeFilters: [],
        spatialFilter: null,
        limit: 30000,
      });
    });
    fireEvent.click(screen.getByRole("tab", { name: /图层/ }));
    await waitFor(() => {
      const rangeSwitches = screen
        .getAllByRole("switch")
        .filter((item) => item.getAttribute("aria-label")?.includes("范围"));
      expect(rangeSwitches.length).toBeGreaterThan(0);
    });

    const adminButton = screen.getByRole("button", { name: /后台管理/ });
    fireEvent.mouseEnter(adminButton);
    const logMenuItem = await screen.findByRole("menuitem", {
      name: "日志管理",
    });
    expect(logMenuItem).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "用户管理" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "角色权限" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "系统设置" }),
    ).not.toBeInTheDocument();
    fireEvent.click(logMenuItem);

    expect(
      await screen.findByText("本人查询塔里木河样地数据"),
    ).toBeInTheDocument();
    expect(screen.queryByText("系统日志")).not.toBeInTheDocument();
    expect(screen.queryByText("超级管理员")).not.toBeInTheDocument();
    expect(screen.queryByText("superadmin")).not.toBeInTheDocument();
    expect(mockApi.adminSystemLogs).not.toHaveBeenCalled();
  }, 30000);

  it("keeps guest login from showing a spinner during account login", async () => {
    let resolveLogin: ((value: { user: User }) => void) | undefined;
    mockApi.login.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );

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

    const loginButton = screen.getByRole("button", {
      name: /登录并进入数据平台$/,
    });
    const guestButton = screen.getByRole("button", { name: /游客登录/ });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(mockApi.login).toHaveBeenCalled();
    });
    expect(guestButton).toBeDisabled();
    expect(guestButton).not.toHaveClass("ant-btn-loading");

    resolveLogin?.({ user: normalUser });
  });

  it("allows authenticated users to enter the admin route", async () => {
    mockApi.me.mockResolvedValue({ authenticated: true, user: adminUser });

    renderApp("/admin");

    expect(
      await screen.findByTestId("pro-layout", {}, { timeout: 10000 }),
    ).toBeInTheDocument();
  });

  it("shows compact workspace navigation for privileged users", async () => {
    mockApi.me.mockResolvedValue({ authenticated: true, user: adminUser });

    renderApp("/");

    expect(
      await screen.findByRole(
        "heading",
        { name: "胡杨生态数据资源目录" },
        { timeout: 10000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^首页$/ })).toHaveClass(
      "workspace-switch-card-active",
    );
    expect(
      screen.getByRole("button", { name: /^地理工作台$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^数据分析$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /后台管理/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /安全退出/ }),
    ).not.toBeInTheDocument();
  }, 30000);

  it("shows the workspace tour once for a first-time signed-in user", async () => {
    mockApi.me.mockResolvedValue({ authenticated: true, user: normalUser });

    const { unmount } = renderApp("/map");

    expect(
      await screen.findByText("🎉 欢迎 🎉", {}, { timeout: 10000 }),
    ).toBeInTheDocument();

    const closeButton =
      document.querySelector<HTMLButtonElement>(".ant-tour-close");
    expect(closeButton).not.toBeNull();
    fireEvent.click(closeButton!);

    await waitFor(() => {
      expect(screen.queryByText("🎉 欢迎 🎉")).not.toBeInTheDocument();
    });
    expect(
      window.localStorage.getItem(
        `huyang-system.workspace-tour.v1.${normalUser.id}.${normalUser.username}`,
      ),
    ).toBe("completed");

    unmount();
    renderApp("/map");

    await screen.findByRole(
      "button",
      { name: /^数据资源$/ },
      { timeout: 10000 },
    );
    expect(screen.queryByText("全局搜索")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "用户信息" }));
    fireEvent.click(await screen.findByRole("button", { name: /显示引导/ }));

    expect(
      await screen.findByText("🎉 欢迎 🎉", {}, { timeout: 10000 }),
    ).toBeInTheDocument();
  });
});
