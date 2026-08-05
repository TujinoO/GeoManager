# 普通用户权限规范化记录（2026-08-05）

## 变更范围

- 目标环境：`http://101.42.12.157:8080`
- 目标角色：普通用户（生产组 ID 1）
- 受影响账号：2 个，仅属于普通用户组，均无个人直授或禁用权限
- 数据资源、成果、工程、用户账号和其他角色不做修改

## 规范基线

依据 `backend/apps/core/configuration/builtins.py` 中现行 `default_user_permissions`，普通用户只保留：

1. `core.browse_data`
2. `core.query_data`
3. `core.load_vector_layer`
4. `core.load_raster_layer`
5. `catalog.view_workspacescene`
6. `catalog.view_mapcomposition`
7. `catalog.view_resultartifact`

该基线对应平台认证授权页中的职责说明：浏览、查询和加载授权范围内的数据与共享成果。

## 变更前快照（可回滚）

生产普通用户组变更前共有 25 项权限：

```text
catalog.add_dataresource
catalog.add_workspacescene
catalog.change_dataresource
catalog.change_workspacescene
catalog.delete_dataresource
catalog.delete_workspacescene
catalog.export_dataresource
catalog.view_dataresource
catalog.view_mapcomposition
catalog.view_resultartifact
catalog.view_workspacescene
core.ai_interpretation
core.browse_data
core.custom_symbolization
core.load_raster_layer
core.load_vector_layer
core.query_data
core.view_dashboard_active_users_card
core.view_dashboard_layer_card
core.view_dashboard_raster_card
core.view_dashboard_resource_card
core.view_dashboard_system_card
core.view_dashboard_user_card
core.view_data_overview
raster.manage_raster_dataset
```

## 应移除的越权能力

- 数据新增、修改、删除和导出
- 工程新增、修改和删除
- 自定义符号化和 AI 解读
- 栅格数据管理
- 数据资源后台清单与运行概览卡片

## 执行与验证状态

- [x] 生产普通用户组已更新为 7 项规范基线；复查 `/api/groups/` 返回 HTTP 200，组 ID 1 仍稳定为上述 7 项权限
- [x] 普通用户 `/api/auth/me/` 返回 HTTP 200；后台、上传、数据删除、工程增删改、成果下载/发布、AI、自定义符号化和栅格管理能力均为 `false`
- [x] 普通用户顶部不再显示“后台管理”和“数据导入”；直接访问 `/admin/dashboard`、`/resources/data/inventory`、`/resources/data/import` 均回到 `/admin/profile`
- [x] 普通用户仍能查看原有 8 项授权数据；真实浏览器快速加载 `Tarim_worldview_1` 后，图层树中出现可见图层
- [x] 普通用户成果页仍显示 2 项已发布专题图；成果可见性未受权限收敛影响
- [x] 超级管理员、平台管理员、科研用户和游客完成重新登录与关键能力回归；其原有组配置和入口未受本次定向修改影响

## 修复结论

- 根因：本地代码内置基线正确，公网数据库中的“普通用户”组发生历史权限配置漂移。
- 修复方式：通过生产管理 API 仅更新组 ID 1 的权限集合，不修改账号、数据资源、成果、工程或其他角色。
- 回滚依据：如需回滚，可使用本记录“变更前快照”恢复原 25 项权限；本轮未执行回滚。
- 浏览器与接口验证：允许的业务请求均为 HTTP 200，未发现新的业务 4xx/5xx。控制台仅有公网 HTTP 环境下 `Cross-Origin-Opener-Policy` 被忽略的既有基础设施警告。
- 代码处理：未修改权限基线代码。现有初始化逻辑有意保留管理员自定义权限，若要把普通用户组改为不可定制的强制基线，应作为单独权限治理需求评审。
