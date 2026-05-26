# 实现约束摘录

## 分层与目录

- 前端和后端必须分离：`frontend/` 只放 React/Vite 工程，`backend/` 只放 Django 工程。
- 程序代码、业务数据、地理数据分离存放。业务数据根目录和地理数据根目录只从 TOML 配置读取。
- 业务数据固定子目录：`database/`、`media/`、`uploads/`、`exports/`、`logs/`、`static/`。
- 地理数据固定子目录：`vector/`、`raster/`、`png/output/`、`png/cache/`。

## 首批后端边界

- 使用 Django 内置 auth、admin、session、permission；平台后台是登录后的功能入口，通过 `is_staff` 和权限决定是否显示。
- SQLite 数据库放在业务数据根目录的 `database/` 下。
- 矢量数据以 GeoPackage 文件形式放在地理数据根目录 `vector/` 下，后端读取并输出 GeoJSON。
- 栅格数据放在 `raster/` 下，后端调用统一 stdin/stdout 约定的 Python 脚本生成 PNG。
- PNG 缓存放在 `png/cache/` 下，缓存 key 基于栅格文件、mtime、符号化规则和输出尺寸。

## 首批前端边界

- 统一登录页不展示独立后台入口。
- 登录后进入地图工作台，包含顶部栏、地图、数据管理面板和已加载图层面板。
- 后台入口只在用户具备后台权限时显示，入口指向 Django admin。
- 前端仅做矢量样式表达和 PNG 叠加，不实现栅格符号化。
- Mapbox 公共 token 从 TOML 的 `map.mapbox_access_token` 读取，经后端 bootstrap 下发；前端不硬编码默认 token。
- Mapbox 底图标注语言使用 `zh-Hans`，并在样式加载后优先读取中文名称字段。

## 数据管理与图层管理

- 数据管理负责浏览、按元数据筛选、读取字段与元信息、配置空间查询和属性查询。
- 图层管理只管理已经加载到地图上的查询结果，不直接承担数据检索职责。
- 数据加载流程固定为：筛选或选择数据资源 -> 后端返回字段与元信息 -> 执行空间/属性查询 -> 将查询结果加载为临时图层。
- 空间查询由前端在地图上绘制矩形、圆、椭圆或多边形，作为 GeoJSON geometry 传给后端。
- 元数据查询作用于资源列表，当前支持名称、数据类型、分类、来源、提供单位和日期范围。
- 属性查询基于后端读取到的字段列表构建过滤条件，后端在 GeoPackage 读取结果上执行过滤。
- 后端资源能力边界：只有带 `storage_path` 的矢量 GeoPackage 资源可查询；元数据资源只可浏览和筛选。
