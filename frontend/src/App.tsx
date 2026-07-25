import { App as AntApp, Spin } from "antd";
import type { ReactNode } from "react";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  api,
  registerForbiddenHandler,
  unregisterForbiddenHandler,
} from "./api/client";
import { AppContext } from "./contexts/AppContext";
import {
  RedirectIfAuth,
  RequireAuth,
  RequireDataInventory,
  RequireDataUpload,
  RequireManageAuth,
  RequireManageDataBackup,
  RequireManageSystemSettings,
  RequireViewOperationLogs,
  RequireWorkspaceInventory,
} from "./router";
import type { Bootstrap, User } from "./types";

const AdminAuthPage = lazy(() => import("./admin/AdminAuthPage"));
const AdminDataBackupPage = lazy(() => import("./admin/AdminDataBackupPage"));
const AdminDashboardPage = lazy(() => import("./admin/AdminDashboardPage"));
const AdminDataImportPage = lazy(() => import("./admin/AdminDataImportPage"));
const AdminDataInventoryPage = lazy(
  () => import("./admin/AdminDataInventoryPage"),
);
const AdminLayout = lazy(() => import("./admin/AdminLayout"));
const AdminOperationLogsPage = lazy(
  () => import("./admin/AdminOperationLogsPage"),
);
const AdminProfilePage = lazy(() => import("./admin/AdminProfilePage"));
const AdminSystemSettingsPage = lazy(
  () => import("./admin/AdminSystemSettingsPage"),
);
const AdminWorkspaceManagementPage = lazy(
  () => import("./admin/AdminWorkspaceManagementPage"),
);
const AdminTopicCompositionManagementPage = lazy(
  () => import("./admin/AdminTopicCompositionManagementPage"),
);
const AboutPage = lazy(() => import("./pages/AboutV2Page"));
const HomePage = lazy(() => import("./pages/HomePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const DataCatalogPage = lazy(() => import("./pages/DataCatalogPage"));
const KnowledgePage = lazy(() => import("./pages/KnowledgePage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const NonGeoPage = lazy(() => import("./pages/NonGeoPage"));
const ResultsPage = lazy(() => import("./pages/ResultsPage"));
const WarningPage = lazy(() => import("./pages/WarningPage"));
const ResourceLayout = lazy(() => import("./resource/ResourceLayout"));

/** 为路由页面添加淡入过渡效果的包装组件 */
function RouteTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div className="route-enter" key={location.pathname}>
      {children}
    </div>
  );
}

function RouteLoading() {
  return (
    <div className="boot-screen">
      <Spin size="large" />
    </div>
  );
}

const startupRetryDelaysMs = [300, 700, 1200, 2000];

export default function App() {
  const { message } = AntApp.useApp();
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const handleForbidden = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    registerForbiddenHandler(handleForbidden);
    return () => {
      unregisterForbiddenHandler();
    };
  }, [handleForbidden]);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      try {
        const bootstrapData = await retryTransientStartup(async () => {
          const [data] = await Promise.all([api.bootstrap(), api.csrf()]);
          return data;
        });
        let currentUser: User | null = null;
        try {
          const me = await api.me();
          currentUser = me.user;
        } catch (error) {
          if (!isApiStatus(error, 401)) {
            throw error;
          }
        }
        if (mounted) {
          setBootstrap(bootstrapData);
          setUser(currentUser);
          document.title = bootstrapData.systemName;
        }
      } catch (error) {
        message.error(
          error instanceof Error ? error.message : "系统初始化失败",
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    boot();
    return () => {
      mounted = false;
    };
  }, [message]);

  if (loading || !bootstrap) {
    return (
      <div className="boot-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ bootstrap, user, setBootstrap, setUser }}>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route
            path="/"
            element={
              <RouteTransition>
                <HomePage />
              </RouteTransition>
            }
          />

          {/* 已登录用户访问登录页时重定向到首页 */}
          <Route element={<RedirectIfAuth />}>
            <Route
              path="/login"
              element={
                <RouteTransition>
                  <LoginPage />
                </RouteTransition>
              }
            />
          </Route>

          {/* 需要登录才能访问的页面 */}
          <Route element={<RequireAuth />}>
            <Route
              path="/data"
              element={
                <RouteTransition>
                  <DataCatalogPage />
                </RouteTransition>
              }
            />
            <Route
              path="/map"
              element={
                <RouteTransition>
                  <MapPage />
                </RouteTransition>
              }
            />
            <Route
              path="/nongeo"
              element={
                <RouteTransition>
                  <NonGeoPage />
                </RouteTransition>
              }
            />
            <Route
              path="/results"
              element={
                <RouteTransition>
                  <ResultsPage />
                </RouteTransition>
              }
            />
            <Route
              path="/warning"
              element={
                <RouteTransition>
                  <WarningPage />
                </RouteTransition>
              }
            />
            <Route
              path="/knowledge"
              element={
                <RouteTransition>
                  <KnowledgePage />
                </RouteTransition>
              }
            />
            <Route
              path="/about"
              element={<Navigate to="/about/system" replace />}
            />
            <Route
              path="/about/knowledge"
              element={<Navigate to="/knowledge" replace />}
            />
            <Route
              path="/about/:section/:institutionId"
              element={
                <RouteTransition>
                  <AboutPage />
                </RouteTransition>
              }
            />
            <Route
              path="/about/:section"
              element={
                <RouteTransition>
                  <AboutPage />
                </RouteTransition>
              }
            />
            <Route path="/resources" element={<ResourceLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route
                path="dashboard"
                element={<AdminDashboardPage scope="data" />}
              />
              <Route element={<RequireDataInventory />}>
                <Route
                  path="data/inventory"
                  element={<AdminDataInventoryPage />}
                />
              </Route>
              <Route element={<RequireWorkspaceInventory />}>
                <Route
                  path="manage/projects"
                  element={<AdminWorkspaceManagementPage kind="project" />}
                />
                <Route
                  path="manage/topics"
                  element={<AdminTopicCompositionManagementPage />}
                />
              </Route>
              <Route element={<RequireDataUpload />}>
                <Route path="data/import" element={<AdminDataImportPage />} />
              </Route>
            </Route>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route
                path="dashboard"
                element={<AdminDashboardPage scope="operations" />}
              />
              <Route path="profile" element={<AdminProfilePage />} />
              <Route element={<RequireViewOperationLogs />}>
                <Route path="logs" element={<AdminOperationLogsPage />} />
              </Route>
              <Route element={<RequireManageSystemSettings />}>
                <Route path="settings" element={<AdminSystemSettingsPage />} />
              </Route>
              <Route element={<RequireManageDataBackup />}>
                <Route path="backup" element={<AdminDataBackupPage />} />
              </Route>
              <Route element={<RequireManageAuth />}>
                <Route path="auth" element={<Navigate to="users" replace />} />
                <Route path="auth/users" element={<AdminAuthPage />} />
                <Route path="auth/groups" element={<AdminAuthPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </AppContext.Provider>
  );
}

function isApiStatus(error: unknown, status: number) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === status
  );
}

async function retryTransientStartup<T>(request: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const delayMs of [0, ...startupRetryDelaysMs]) {
    if (delayMs > 0) {
      await delay(delayMs);
    }
    try {
      return await request();
    } catch (error) {
      lastError = error;
      if (!isTransientStartupError(error)) {
        throw error;
      }
    }
  }
  throw lastError;
}

function isTransientStartupError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status === 0 || error.status >= 500;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /ECONNREFUSED|Failed to fetch|NetworkError|network request/i.test(
    message,
  );
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
