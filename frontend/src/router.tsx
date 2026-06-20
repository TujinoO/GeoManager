import { Navigate, Outlet } from "react-router-dom";
import { useAppContext } from "./contexts/AppContext";

/** 需要登录才能访问的路由守卫 */
export function RequireAuth() {
  const { user } = useAppContext();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

/** 需要数据维护权限才能访问的后台数据管理路由 */
export function RequireDataMaintain() {
  const { user } = useAppContext();
  if (
    !user?.permissions.canChangeDataResources &&
    !user?.permissions.canDeleteDataResources
  ) {
    return <Navigate to="/admin/profile" replace />;
  }
  return <Outlet />;
}

/** 需要存量数据查看、上传或维护权限才能访问资源清单路由 */
export function RequireDataInventory() {
  const { user } = useAppContext();
  if (
    !user?.permissions.canViewDataResources &&
    !user?.permissions.canChangeDataResources &&
    !user?.permissions.canDeleteDataResources &&
    !user?.permissions.canUploadData &&
    !user?.permissions.canExportData
  ) {
    return <Navigate to="/admin/profile" replace />;
  }
  return <Outlet />;
}

/** 需要数据上传或数据维护权限才能访问的后台导入路由 */
export function RequireDataUpload() {
  const { user } = useAppContext();
  if (!user?.permissions.canUploadData) {
    return <Navigate to="/admin/profile" replace />;
  }
  return <Outlet />;
}

/** 需要查看操作日志权限才能访问的路由 */
export function RequireViewOperationLogs() {
  const { user } = useAppContext();
  if (!user?.permissions.canViewOperationLogs) {
    return <Navigate to="/admin/profile" replace />;
  }
  return <Outlet />;
}

/** 需要修改系统设置权限才能访问的路由 */
export function RequireManageSystemSettings() {
  const { user } = useAppContext();
  if (!user?.permissions.canManageSystemSettings) {
    return <Navigate to="/admin/profile" replace />;
  }
  return <Outlet />;
}

/** 需要修改认证授权权限才能访问的路由 */
export function RequireManageAuth() {
  const { user } = useAppContext();
  if (!user?.permissions.canManageAuth) {
    return <Navigate to="/admin/profile" replace />;
  }
  return <Outlet />;
}

/** 已登录用户访问登录页时重定向到首页 */
export function RedirectIfAuth() {
  const { user } = useAppContext();
  if (user) {
    return <Navigate to="/map" replace />;
  }
  return <Outlet />;
}
