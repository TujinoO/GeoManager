# Ant Design Pro 管理后台实现说明

## 范围

管理后台通过前端 `/admin/` 路由承载，使用 `@ant-design/pro-components` 的 `ProLayout`、`PageContainer`、`ProTable`、`ProForm` 和 `ProCard` 实现。数据维护类功能作为后台模块承载。

## 路由

- `/admin/`：管理后台入口，默认跳转到 `/admin/profile`。
- `/admin/profile`：用户设置，维护个人信息、修改密码并查看/开关已授予权限。
- `/admin/logs`：操作日志，基于真实审计日志接口提供查询、筛选和 CSV 导出。
- `/admin/settings`：系统设置，只展示用户可配置的 application 设置，保存到 appdata 运行 TOML 配置副本。
- `/admin/auth`：认证授权，提供用户创建、用户列表、用户组分配、用户组增删和功能权限配置。
- `/admin/data/import`：数据管理 / 数据导入，使用三步表单完成文件选择、导入配置校验、数据预览和字段元数据维护。

## 权限

前端路由使用登录态做后台入口保护，所有登录用户都可进入 `/admin/`。后台管理只通过前端 `/admin/` SPA 承载。

各功能模块的权限要求：
- 操作日志路由要求 `user.permissions.canViewOperationLogs`
- 系统设置路由要求 `user.permissions.canManageSystemSettings`
- 认证授权路由要求 `user.permissions.canManageAuth`
- 数据导入路由要求 `user.permissions.canMaintainData`

后台菜单根据用户权限动态显示对应功能模块。门户页以"管理后台"卡片作为统一后台入口，跳转到 `/admin`。

用户可在“用户设置”中主动关闭或重新开启已经授予的权限；未授予权限不能被写入用户偏好。管理员通过“认证授权”配置每个用户所属用户组，用户组权限复用 Django `Group`/`Permission`。

用户设置和系统设置默认以只读信息展示，用户点击卡片右上角的小编辑按钮后才进入编辑态。后台创建用户不受自助注册开关影响，但必须具备 `core.create_user` 权限；用户组权限配置必须具备 `core.manage_feature_permissions` 权限。

超级管理员用户组由系统初始化和后端 API 共同保护，不能删除，初始化的 `admin` 用户也不能从该组移除。

## 数据导入

后台数据导入复用 `/api/catalog/import/preview/`、`/api/catalog/import/validate/` 和 `/api/catalog/import/commit/` 接口，不改变后端 API 协议。

导入流程分三步：

1. 选择 Excel 或 CSV 文件，文件选择后立即调用预检接口，填充建议数据名称、建议表名、字段列表和自动识别的经纬度列。
2. 配置数据名称、导入类型、同名覆盖策略和经纬度列。用户点击“数据校验并继续”后调用校验接口；地理数据必须选择有效经纬度列，阻断问题会留在当前步骤，可忽略的坐标精度问题需要用户确认后进入预览步骤。
3. 查看数据预览并维护字段元数据，可选择参与上传的字段；提交后调用导入提交接口，成功后显示导入资源名称和行数。

## 配置

应用只使用 TOML 配置文件。后端通过 `--config /path/to/app.toml` 参数接收源配置；迁移时复制到业务数据目录的运行配置副本，后台设置只修改该副本。`django_secret_key` 自动生成到业务数据目录，不在配置文件或前端页面中展示。
