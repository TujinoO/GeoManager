# 后台 Dashboard 实现记录

## 页面定位

后台 Dashboard 是 `/admin` 的默认首屏，参考 Ant Design Pro 的 Dashboard/Analysis 页面组织方式，并按本平台业务收敛为三行信息：

1. 统计数据：数据资源、图层、栅格、用户数量。
2. 活跃用户：支持日、周、月周期切换，展示成功登录去重用户数、登录次数、柱状图序列和用户排名。
3. 服务器信息：支持 Windows、Linux、macOS，展示 CPU、内存、硬盘型号、数量和使用情况。

## 数据来源

当前实现使用后台 Dashboard 聚合接口：

- `/api/admin/dashboard/?period=day|week|month`：返回数据数量和指定周期活跃用户统计。
- `/api/admin/dashboard/server/`：返回服务器监控快照，前端每 5 秒刷新。后端通过标准库和系统命令读取 Windows、Linux、macOS 的 CPU、内存、硬盘信息。

两个接口均需要 `core.access_admin`。活跃用户定义为统计周期内存在 `auth.login.success` 操作日志的去重用户。

## 前端入口

- 页面组件：`frontend/src/admin/AdminDashboardPage.tsx`
- 菜单配置：`frontend/src/admin/AdminLayout.tsx`
- 路由入口：`frontend/src/App.tsx`
- 样式：`frontend/src/styles.css`
