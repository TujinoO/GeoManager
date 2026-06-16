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
  RequireDataMaintain,
  RequireDataUpload,
  RequireManageAuth,
  RequireManageSystemSettings,
  RequireViewOperationLogs,
} from "./router";
import type { Bootstrap, User } from "./types";

const AdminAuthPage = lazy(() => import("./admin/AdminAuthPage"));
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
const HomePage = lazy(() => import("./pages/HomePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const NonGeoPage = lazy(() => import("./pages/NonGeoPage"));

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
        const [bootstrapData] = await Promise.all([
          api.bootstrap(),
          api.csrf(),
        ]);
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
    <AppContext.Provider value={{ bootstrap, user, setUser }}>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
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
              path="/"
              element={
                <RouteTransition>
                  <HomePage />
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
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="profile" element={<AdminProfilePage />} />
              <Route element={<RequireViewOperationLogs />}>
                <Route path="logs" element={<AdminOperationLogsPage />} />
              </Route>
              <Route element={<RequireManageSystemSettings />}>
                <Route path="settings" element={<AdminSystemSettingsPage />} />
              </Route>
              <Route element={<RequireManageAuth />}>
                <Route path="auth" element={<Navigate to="users" replace />} />
                <Route path="auth/users" element={<AdminAuthPage />} />
                <Route path="auth/groups" element={<AdminAuthPage />} />
              </Route>
              <Route element={<RequireDataMaintain />}>
                <Route
                  path="data/inventory"
                  element={<AdminDataInventoryPage />}
                />
              </Route>
              <Route element={<RequireDataUpload />}>
                <Route path="data/import" element={<AdminDataImportPage />} />
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
