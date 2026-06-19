# 实现约束摘录

## 分层与目录

- 前端和后端必须分离：`frontend/` 只放 React/Vite 工程，`backend/` 只放 Django 工程。
- 程序代码、业务数据、科研数据分离存放。两类数据根目录只从 TOML 配置读取。
- 业务数据固定子目录：`database/`、`media/`、`uploads/`、`exports/`、`logs/`、`static/`。
- 科研数据固定子目录：`vector/`、`raster/original/`、`raster/preprocessed/`、`raster/metadata/source/`、`raster/metadata/preprocessed/`、`gene/`、`table/`。
- 业务数据根目录通过 TOML 的 `storage.app_data` 指定，不在程序中硬编码。
- 科研数据根目录通过 TOML 的 `storage.research_data_root` 指定，不在程序中硬编码。

## 后端模块结构

```
backend/apps/
├── core/           # 配置加载、认证、存储路径工具
│   ├── config.py       # TOML → ProjectConfig dataclass，纯函数
│   ├── storage.py      # 安全路径拼接，防路径遍历
│   ├── auth_views.py   # 登录/登出/当前用户（基于 Django auth）
│   └── views.py        # bootstrap 端点
├── catalog/        # 数据目录、资源、图层、查询
│   ├── models.py       # DataResource, MapLayer, DataCatalog, Achievement, DictionaryItem
│   ├── serializers.py  # 模型 → JSON
│   ├── permissions.py  # access_groups 基于 Django Group 的访问控制
│   ├── data_query.py   # 矢量 GeoPackage 查询（GeoPandas + Shapely）
│   └── views.py        # 目录、资源、图层、成果、搜索 HTTP API
├── raster/         # 栅格数据全生命周期
│   ├── models.py       # RasterDataset
│   ├── permissions.py  # can_manage_raster_data
│   ├── views.py        # 栅格 HTTP API（导入/渲染/瓦片）
│   └── services/       # 核心业务逻辑（拆分后的包）
│       ├── __init__.py         # 公共 API 重新导出，外部调用方零修改
│       ├── exceptions.py       # RasterRenderError, RasterImportError, RasterJobError
│       ├── constants.py        # 扩展名、色板、瓦片常量
│       ├── progress.py         # 进度文本解析
│       ├── geo_utils.py        # 坐标/边界/瓦片计算
│       ├── color_mapping.py    # numpy → RGBA 色彩映射
│       ├── rules_engine.py     # 符号化规则归一化与校验
│       ├── gdal_ops.py         # GDAL CLI 封装（gdalinfo, gdalwarp）
│       ├── catalog_sync.py     # DataResource/MapLayer upsert
│       ├── serializers.py      # RasterDataset 序列化、元数据压缩
│       ├── profile.py          # 栅格资源 profile 查询（供 catalog.data_query 调用）
│       ├── importer.py         # 文件导入、预处理、扫描、数据集查找
│       ├── renderer.py         # XYZ 瓦片渲染、瓦片样式注册
│       └── jobs.py             # 异步任务系统（线程池、进度轮询）
└── audit/          # 操作日志
    ├── models.py       # OperationLog
    └── service.py      # log_operation 工具函数
```

### 后端架构原则

- `services/__init__.py` 重新导出所有公共符号，保持 `from apps.raster.services import xxx` 兼容。
- `services/` 内部模块按职责拆分：纯函数模块（`rules_engine`、`color_mapping`、`geo_utils`、`progress`）无外部依赖，可独立单元测试。
- `profile.py` 是 `catalog.data_query` 访问栅格数据的唯一入口，避免了 `catalog.data_query ↔ raster.services` 的循环依赖。
- 权限检查集中在 `permissions.py`，视图层仅负责 HTTP 协议处理。
- 异步任务（`jobs.py`）通过线程池 + 全局字典管理，进度通过轮询接口返回。

## 首批后端边界

- 使用 Django 内置 auth、session、permission；平台后台是登录后的功能入口，所有登录用户可进入，后台内部菜单、页面和操作通过平台功能权限决定是否显示和访问。
- 管理后台使用前端 `/admin/` SPA 路由承载。
- 自助注册默认由 TOML 的 `system.allow_registration` 开启；迁移会创建单例 `SystemSetting`，管理员可在后台关闭注册。首个注册用户自动成为系统管理员，后续注册用户为普通账号。
- 本地前后端分离开发时，Vite dev server 代理 `/api` 到 Django；`[runtime].debug = true` 且未显式设置 `csrf_trusted_origins` 时，后端默认信任本地开发服务器地址，确保首次注册和登录的 CSRF Origin 校验通过。
- 运行日志统一写入业务数据根目录的 `logs/`：Django 应用日志、Django 框架日志和安全日志都落在该目录；容器运行时的 Waitress 进程日志由容器标准输出收集。
- Docker 镜像使用 `backend/pixi.lock` 安装 Pixi 后端运行环境，使用 pnpm 构建 `frontend/dist`，由 Django/WhiteNoise 在 WSGI 进程内提供前端静态资源和 SPA fallback；宿主机如需公网访问，可在容器端口前自行配置反向代理。
- Docker 启动入口必须先创建固定业务/地理/非地理数据子目录，再执行 `python manage.py migrate --noinput` 和 `collectstatic`，确保空 appdata 首次启动可以直接注册首个管理员。
- SQLite 数据库放在业务数据根目录的 `database/` 下。
- 所有矢量数据统一从地理数据根目录下的 `vector/vector.gpkg` 读取；业务库中的矢量 `storage_path` 和图层 `source_path` 字段填写该 GeoPackage 内的图层名，后端读取并输出 GeoJSON。
- Excel/CSV 导入分为预检与提交两步。预检只读取第一张表、按文本读取全部字段、自动推测常见经纬度列并计算坐标量化误差范围；提交时由用户选择地理/非地理导入、经纬度列、字段元数据和空坐标处理策略。
- 导入的地理表统一写入 `vector/vector.gpkg` 的点图层，并创建或更新对应 `DataResource`，`DataResource.name` 保存用户填写的数据名称，`storage_path` 保存 GeoPackage 图层名。资源列表优先展示业务库中的数据名称，已登记图层不会再以原始表名重复暴露为临时矢量资源。
- 导入的地理表字段级描述写入 GeoPackage `gpkg_data_columns`，记录键为 `table_name + column_name + description`。强行导入空坐标时允许 GeoPackage 保留空几何记录，但图层要素接口和查询 GeoJSON 输出会过滤空几何，避免前端地图渲染异常。
- 导入的非地理表统一写入 `table/data.sqlite`，业务表之外维护 `data_columns(table_name, column_name, description)` 作为 SQLite 侧字段元数据实现。非地理导入只登记 `DataResource`，不创建 `MapLayer`，资源 `storage_path` 记录 SQLite 内的表名。
- 坐标量化误差按经纬度文本小数位数估算：每个坐标分量取最后一位小数半个单位作为最大角度误差，纬度方向按 111320 m/deg 换算，经度方向乘以 `cos(latitude)`，再合成平面最大可能误差；该值只表示坐标记录精度引入的位置不确定性，不包含测量设备误差。
- 栅格数据统一放在地理数据根目录的 `raster/` 总目录下：源文件放在 `raster/original/`，导入后预处理 COG 放在 `raster/preprocessed/`，两份 `gdalinfo -json` 元数据放在 `raster/metadata/source/` 和 `raster/metadata/preprocessed/`。
- 非地理数据统一放在非地理数据根目录下：基因数据放在 `gene/`，表格数据放在 `table/`。后端目录扫描会登记 `gene` 和 `table` 类型的 `DataResource`，不创建地图图层。
- 栅格导入预处理固定使用 `gdalwarp` 将源文件转换为 EPSG:3857 的 COG 格式，导入记录保存源文件、预处理文件、两份 GDAL 元数据、导入时间、处理日志、错误信息、默认符号化规则、范围和关联数据资源/地图图层。
- 后端启动 `runserver` 或 WSGI/ASGI 进程时会异步扫描 `vector/vector.gpkg`、非地理数据 `gene/`、`table/` 和 `raster/original/` 下已有数据；矢量图层会登记为 `DataResource/MapLayer`，非地理文件登记为 `DataResource`，栅格源文件会完成预处理并登记目录。迁移、测试等管理命令不触发扫描。可在 TOML 的 `[runtime]` 段设置 `disable_catalog_startup_scan` 或 `disable_raster_startup_scan` 关闭启动扫描。

## 统一功能权限

- 平台功能权限统一基于 Django `Permission + Group`，不引入独立角色表。用户通过所属用户组获得功能权限。
- `apps.core.permissions.FEATURE_PERMISSIONS` 是统一注册表；后台用户组配置页只同步注册表内权限，保留用户组已有其他模型权限。
- 功能权限元数据按 `后台权限`、`数据权限`、`人员权限` 三类返回，前端认证授权页按该分组展示和维护。
- 迁移后初始化会先按注册表统一创建或更新 Django `Permission` 记录，再同步 `超级管理员` 用户组并补齐全部功能权限，同时创建 `普通用户` 用户组并授予浏览数据、查询数据、上传数据、加载矢量图层、加载栅格图层权限；历史 `游客` 用户组会自动改名为 `普通用户`。
- 管理员新建普通用户和修改普通用户组归属时必须保留至少一个用户组；自助注册用户默认加入 `普通用户` 用户组。
- 数据资源和图层的 `access_groups` 继续控制“能看见哪些对象”；功能权限控制“能对可见对象做什么”。
- 首批平台功能权限包括：功能权限配置、数据浏览、数据查询、矢量加载、栅格加载、自定义符号化等后台内部功能权限。
- 现有导出、数据维护、栅格数据集管理权限也纳入同一用户组配置入口；`core.upload_data` 独立控制后台导入，`catalog.maintain_dataresource` 控制存量数据启停、默认可视化、访问范围配置和删除确认，并兼容允许导入。
- `core.view_data_overview` 独立控制 Dashboard 总数据情况卡片；卡片包含资源总数、启用资源数、数据大小、条目数和类型聚合，超级管理员额外看到按 `DataResource.maintainer` 聚合的上传用户统计。
- 前后端无权限提示统一为 `当前用户组“xxxx”无权限`；无用户组时显示 `未分组`。
- `core.load_raster_layer` 控制按默认规则加载栅格和访问 XYZ；`core.custom_symbolization` 只控制用户打开符号化编辑器并提交自定义规则。
- 栅格渲染 API 使用 `rulesMode` 区分默认/自定义：默认加载不传 `rules` 或传 `rulesMode: "default"`；自定义符号化传 `rulesMode: "custom"` 和 `rules`。
- 游客访问使用专用系统账号 `guest` 和独立 `游客` 用户组实现，不再复用 `普通用户` 组。`普通用户` 继续用于自助注册和后台创建的常规账号，默认保留上传权限；`游客` 默认只授予浏览、查询、矢量加载和栅格加载权限。`guest` 账号密码不可用，只能通过 `/api/auth/guest-login/` 建立会话，并在后台管理中禁止删除、停用、重置密码、改组或单独授予直授权限。

## 前端模块结构

```
frontend/src/
├── main.tsx                    # React 入口，Ant Design 中文 + 主题
├── App.tsx                     # 引导（bootstrap + auth），登录/工作台路由
├── types.ts                    # 全局类型定义；后端 DTO 从 OpenAPI 生成类型派生
├── symbolization.ts            # 符号化类型、默认值、规则解析
├── styles.css                  # 全局样式
├── api/
│   ├── client.ts               # Hey API SDK 门面、CSRF、统一错误处理
│   └── generated/              # @hey-api/openapi-ts 自动生成的类型、SDK 和 fetch client
├── pages/
│   ├── LoginPage.tsx            # 登录页
│   └── MapPage.tsx              # 地图工作台主页面（协调各组件）
├── components/
│   ├── MapCanvas.tsx            # Mapbox GL JS 地图组件
│   ├── DataPanel.tsx            # 数据管理面板
│   ├── LayerPanel.tsx           # 图层管理面板（从 LayerContext 消费状态）
│   ├── RightSidePanel.tsx       # 右侧导航式信息面板
│   ├── WorkspaceBottomPanel.tsx # 底部导航式绘制/元数据面板
│   ├── LayerDataTableModal.tsx  # 图层数据表弹窗
│   └── SymbolizationEditor.tsx  # 符号化编辑器
├── hooks/
│   ├── LayerContext.tsx          # 图层状态 Context，消除 props drilling
│   ├── useLayerGroups.ts        # 图层组 CRUD（12 个操作）
│   └── useRasterRender.ts       # 栅格渲染调度/轮询/结果应用
├── map/
│   ├── mapState.ts              # WeakMap<Map, MapInternalState> 状态管理
│   ├── styleHelpers.ts          # Mapbox 样式层增删改工具
│   ├── vectorLayerSync.ts       # 矢量图层同步 + 符号化映射
│   ├── rasterLayerSync.ts       # 栅格图层同步
│   ├── featureInteraction.ts    # 单击选中与 hover 高亮交互
│   └── spatialDraw.ts           # 空间绘制预览
└── utils/
    ├── geometry.ts              # 纯几何计算、边界合并、工具函数
    └── layerFactory.ts          # 矢量/栅格图层组构建工厂
```

### 前端架构原则

- **模块职责单一**：每个文件只承担一个独立职责，最大文件不超过 250 行。
- **纯函数与 React 分离**：`utils/` 和 `map/` 中的纯函数可独立测试，不依赖 React 生命周期。
- **WeakMap 替代属性挂载**：`mapState.ts` 用 `WeakMap<Map, MapInternalState>` 管理 Mapbox 实例的内部状态，避免在 map 对象上挂载自定义属性。
- **Context 消除 props drilling**：`LayerContext` 提供图层组全部操作，`LayerPanel` 零 props 通过 `useLayerContext()` 消费。
- **Discriminated union 类型安全**：`LoadedLayer = LoadedVectorLayer | LoadedRasterLayer`，通过 `layerType` 字段判别，编译期消除可选字段歧义。
- **OpenAPI 契约驱动类型**：`frontend/src/api/generated/` 由 `docs/openapi.yaml` 通过 `@hey-api/openapi-ts` 生成；`frontend/src/types.ts` 只保留前端运行态类型、少量 UI 扩展和对生成 DTO 的统一转出。
- **类型安全 API 请求**：`frontend/src/api/client.ts` 调用 Hey API 生成的 SDK 函数，并集中处理 CSRF、中文错误、Blob 下载文件名和业务资源分支；路径、路径参数、查询参数和 JSON 请求体必须来自 `docs/openapi.yaml`。
- **API 类型生成命令**：修改 `docs/openapi.yaml` 后运行 `pnpm run generate:api`，该命令先执行 Redocly lint 再生成 `src/api/generated/`；提交前运行 `pnpm run check:api` 确认 OpenAPI lint 通过且生成文件未漂移。
- **API 文档生成命令**：运行 `pnpm run api:docs` 生成 Redoc HTML 文档，运行 `pnpm run api:bundle` 生成单文件 OpenAPI bundle，便于查阅和外部工具导入。

## 首批前端边界

- 统一登录页不展示独立后台入口。
- 登录后默认进入 `/map` 地理数据工作台，不再展示独立的可视化入口页。保留现有 `/`、`/map`、`/nongeo`、`/resources` 和 `/admin` 路由路径，其中 `/` 仅兼容重定向到 `/map`。
- 地理数据界面、非地理可视化、数据管理和管理后台作为工作台顶栏入口呈现，并按当前路由显示选中态；`/nongeo` 复用同一工作台顶栏，仅切换主体内容区并隐藏地图、图层树、右侧属性面板和底部工具面板；数据管理 `/resources` 与后台 `/admin` 均使用后台式侧边菜单和内容区，但职责分离。
- 前端仅做矢量样式表达和 XYZ 瓦片叠加，不实现栅格符号化。
- Mapbox 公共 token 从 TOML 的 `[application.map].mapbox_access_token` 读取，经后端 bootstrap 下发，前端不硬编码默认 token。
- Mapbox 底图标注语言使用 `zh-Hans`，并在样式加载后优先读取中文名称字段。
- 前端初始化 Mapbox GL JS 时禁用 `EVENTS_URL` 和性能指标采集，避免浏览器插件拦截 `events.mapbox.com` 后产生控制台噪声；样式、瓦片和业务接口请求不受影响。
- 鼠标经纬度面板先用 Mapbox `map.isPointOnSurface(event.point)` 判断鼠标是否落在地球表面；不在地球表面时清空显示，在表面时使用 `event.lngLat.wrap()` 并限制到合法经纬度范围。不从屏幕像素、瓦片坐标或墨卡托坐标自行换算。

## 管理后台实现约定

- 管理后台通过前端 `/admin/` SPA 路由承载，使用 `@ant-design/pro-components` 的 `ProLayout`、`PageContainer`、`ProTable`、`ProForm` 和 `ProCard`。
- `/admin/` 默认进入运行概览；后台运行概览保留用户信息、活跃用户和服务器信息。操作日志、系统设置、认证授权根据功能权限显示。数据概览中的数据资源、图层、栅格和数据体量相关部分归入数据管理 `/resources/`，数据导入和存量数据管理也归入数据管理，不再作为后台管理菜单项。
- 后台入口只要求登录态，具体页面、菜单和操作必须同时由前端权限展示和后端权限校验控制。
- 用户设置和系统设置默认只读，点击编辑后进入编辑态；后台创建用户不受自助注册开关影响，但必须具备 `core.create_user` 权限。
- 用户组权限配置复用 Django `Group`/`Permission`，必须具备 `core.manage_feature_permissions` 权限；超级管理员用户组不能删除，初始化的 `admin` 用户不能从该组移除。
- 数据导入复用 `/api/catalog/import/preview/`、`/api/catalog/import/validate/` 和 `/api/catalog/import/commit/`，流程为文件预检、导入配置校验、数据预览和字段元数据维护。
- 应用只使用 TOML 配置。后端通过 `--config /path/to/app.toml` 接收源配置，启动、迁移和后台设置都以该源配置文件作为读写目标。

## 数据管理与图层管理

- 数据管理负责浏览、按元数据筛选、读取字段与元信息、配置空间查询和属性查询。
- 地图工作台左侧保留数据面板，负责当前地图会话内的数据筛选、选择、快速加载和查询加载；顶栏“数据管理”进入 `/resources/` 面板，负责数据概览、存量数据管理和数据导入。
- 图层管理只管理已经加载到地图上的查询结果，不直接承担数据检索职责。
- 数据加载流程固定为：工作台打开后自动扫描数据目录并刷新资源列表 -> 自动加载已有可查询/可渲染资源到地图；用户也可筛选或选择数据资源 -> 后端返回字段与元信息 -> 执行空间/属性查询 -> 将查询结果加载为临时图层。
- 已保存工程/专题卡片仅展示名称和说明，必须通过“加载”按钮恢复工作台；创建、编辑名称/说明、覆盖快照和删除都要通过工作台操作日志记录。
- 空间查询由前端在地图上绘制矩形、圆、椭圆或多边形，作为 GeoJSON geometry 传给后端。
- 元数据查询作用于资源列表，当前支持名称、数据类型、分类、来源、提供单位和日期范围。
- 属性查询基于后端读取到的字段列表构建过滤条件，后端在 GeoPackage 读取结果上执行过滤。
- 后端资源能力边界：只有带 `storage_path` 的矢量 GeoPackage 资源可查询；元数据资源只可浏览和筛选。
- 数据管理 `/resources/data/inventory` 是存量数据管理入口，使用 `/api/admin/data/resources/` 查询启用和禁用资源；常规业务目录 `/api/catalog/resources/`、搜索和资源 profile/query 仍只处理 `status=active` 的数据资源。
- `DataResource.maintainer` 同时作为上传用户和维护人员的来源；后台数据资源接口暴露结构化 `uploader`。`DataResource.size_bytes` 和 `DataResource.item_count` 记录数据大小与条目数：Excel/CSV 导入使用上传文件大小和导入行数，栅格资源使用源文件与预处理文件大小，扫描到的非地理文件使用文件大小。
- Excel/CSV 导入预检和校验会按实际入库目标检测重复：地理数据检查 GeoPackage 图层名，非地理数据检查 SQLite 表名。`overwrite=false` 的提交必须由后端阻断，前端提示不能作为安全边界。
- `DataResource.default_visualization` 保存默认可视化方案 JSON；空间资源保存方案时会创建或更新关联 `MapLayer`，同步默认图层名称、默认显隐、默认透明度、矢量符号化和栅格规则。栅格色带和 PNG/XYZ 生成仍由后端栅格服务处理。
- 存量数据启停、默认可视化保存、访问用户组配置、删除和清单导出均写入 `OperationLog(module="数据管理")`。删除用户导入的矢量/表格资源时清理 GeoPackage 图层或 SQLite 表；栅格等可能复用的研究数据文件保留，仅删除资源登记和关联图层。
- 用户导入数据的可见范围由 `DataResource.access_groups` 和 `DataResource.maintainer` 共同控制：上传者本人强制可见，`超级管理员` 用户组强制写入访问组，用户选择的 `accessGroupIds` 表示额外可见用户组。选择 `游客` 用户组表示无需账号即可通过游客会话访问，前端上传和存量数据管理都必须提示。历史无上传者且无访问组的数据继续作为平台公共登记资源处理。
- 存量数据可见范围可由上传者本人或具备 `catalog.maintain_dataresource` 的用户修改；上传者只能执行 `updateAccess`，启停、默认可视化、删除仍需要维护数据资源权限。`GET /api/admin/data/resources/` 对上传用户开放时只返回其本人上传的数据。
- 操作日志中的模块、动作和说明统一使用中文。除认证、用户组、用户、系统配置和存量数据管理外，目录扫描、导入预览/校验/提交、数据查询、已加载图层导出、异步导出发起/下载、个人资料更新、个人权限开关更新、栅格渲染样式注册、栅格渲染任务发起、栅格唯一值统计、栅格导入和栅格扫描发起也写入 `OperationLog`。异步任务内部的执行进度仍保留在任务消息或 `RasterDataset.progress_log`，操作日志记录用户可归属的发起和下载动作。

## 当前图层树约定

- 每次"查询数据 -> 加载到图层"都会生成一个独立图层组，用于保留本次查询的时间、条件结果和元数据上下文。
- 矢量数据查询结果来自统一 GeoJSON 数据源，正常情况下每个图层组下只有一个矢量子图层。
- 栅格数据在前端状态模型中作为图层组下的栅格子图层加载，子图层持有 `tileUrl`、Mapbox 图片角点、透明度、元数据和符号化配置；栅格符号化仍由后端完成。
- 图层组和子图层均保留独立显隐、定位、导出和符号化入口；透明度在符号化面板内配置。
- 子图层提供数据表按钮，点击后以弹窗展示整层属性表；元数据在底部导航面板中展示。
- 已加载图层组默认按当前用户写入浏览器 IndexedDB 的 `huyang-system-map-workspace/layer-groups`，保存完整前端运行态（包含矢量 GeoJSON 查询结果、栅格 tile URL、显隐、顺序、命名、符号化方案、栅格渲染元数据和当前本地工作台状态）。地图页刷新或切换界面后由 `useLayerGroups` 自动恢复；缓存失败只影响本地恢复，不改变后端数据和权限边界。服务器端工程/专题只在用户显式保存时写入 `WorkspaceScene`，并且只保存轻量引用快照：图层结构、资源引用、查询条件、空间范围、符号化和栅格 tile/渲染引用元数据，不保存矢量 GeoJSON 要素集合、属性表行或查询结果数据本体；恢复时按资源引用和查询条件重新查询。后端会拒绝包含 `geojson` 或 `FeatureCollection.features` 的快照以及超大请求体，不做实时 server autosave。
- 保存工程或专题时，前端保存弹窗支持新建保存项或覆盖当前用户已有的同类型保存项。新建调用 `createWorkspace`，覆盖调用 `updateWorkspace` 并只替换轻量快照，已有保存项名称和说明保持不变。

## 矢量图层符号化与交互

- 图层组和子图层均支持在图层树内直接改名；当前改名属于前端临时工作台状态，后续如需保存到业务库，应接入后端图层配置接口。
- 透明度在符号化面板中配置：图层组透明度与子图层透明度在渲染前相乘，作为 Mapbox paint opacity 的基础值。
- 点要素符号化按 Mapbox Style Specification 的 `circle` 和 `symbol` 图层拆分：`circle` 参数覆盖颜色、半径、描边、模糊、位移、pitch、sort key、emissive 等；`symbol` 参数覆盖 icon/text 的 layout 与 paint 配置。
- 线、面要素继续使用 Mapbox `line`、`fill` 图层表达，符号化面板同步暴露线色、线宽、线型、填充色、透明度、位移、sort key 等参数。
- 每个前端加载的 GeoJSON source 使用 `generateId`，所有矢量 style layer 注册统一交互：鼠标覆盖仅改变指针并高亮要素，单击要素后选中并在右侧导航面板的"要素属性"标签中展示该单条记录属性。
- 主界面侧栏参考 `docs/ui-redesign-mockups.html` 的 V2 布局：左侧统一为 `数据`、`图层`、`工程`、`专题` 四个切换页；右侧拆成上方平面缩略图窗口和下方生态数据窗口，下方包含 `概览`、`要素`、`监测` 三个切换页，其中 `要素` 继续承载地图单击要素属性；底部面板改为空间查询工作区，包含 `空间查询`、`结果`、`时间`、`图例` 标签，`空间查询` 内按左右区域组织范围绘制/导入导出与查询状态/图例占位。共享空间范围仍同时用于空间查询和导出裁切，当前选中图层范围开关继续将 `minLng,minLat,maxLng,maxLat` 范围绘制为地图覆盖层。
- 当前符号化模型位于 `frontend/src/symbolization.ts`，编辑界面位于 `frontend/src/components/SymbolizationEditor.tsx`，Mapbox 转换逻辑位于 `frontend/src/map/vectorLayerSync.ts`。

## 栅格符号化与加载方案

- 栅格符号化规则支持四种模式：单波段灰度（可拉伸）、任意三波段 RGB 组合（可逐波段拉伸并可指定 A 透明度 mask）、单波段伪彩色、单波段唯一值渲染。
- 默认规则按波段数生成：1 波段使用灰度；2 波段使用 `[1, 2, 2]` 映射到 RGB；3 个及以上波段使用 `[1, 2, 3]` 映射到 RGB；默认都启用 min/max 拉伸和 nodata。若处理后 COG 的 `gdalinfo -json` 缺少统计值，默认规则回退使用源文件 `gdalinfo -json` 中的统计值。
- 唯一值不在导入或默认规则阶段预统计。用户在符号化面板选择整型波段后点击“分类”，后端通过 rasterio 按 block window 逐块读取，使用 `np.unique` 合并唯一值集合，不统计数量频次；浮点波段直接拒绝唯一值分类。当前单次分类最多返回 4096 个唯一值，超过说明该波段不适合唯一值渲染。
- RGB 模式支持 A 透明度来源：默认使用 `mask`，也可选择具体整型波段或关闭。XYZ 瓦片通过 Rasterio masked read 处理 nodata，若 A 选择具体波段则同步读取该波段作为 alpha。
- 栅格只支持 XYZ 加载。前端提交符号化规则后，后端按 `(预处理 COG + 规则)` 生成内存样式哈希，瓦片接口 `/api/raster/tiles/{datasetId}/{styleHash}/{z}/{x}/{y}.png` 使用 Rasterio windowed read 直接从 COG 读取 256x256 窗口并实时应用同一套规则。
- XYZ 返回 tile URL 模板、EPSG:3857 范围、WGS84 范围、样式哈希和实际规则。
- 导入和符号化均通过异步任务接口返回进度。`gdalwarp` 的命令行输出会写入任务消息，前端在图层树中显示进度条和最近消息。
- 栅格符号化面板支持复制完整 JSON 方案，内容包含 `opacity`、`mode`、`bands`、`alphaBand`、`nodata`、`stretch`、`palette` 和 `uniqueValues`。后台可在 `RasterDataset.default_rules` 或关联 `MapLayer.raster_rules` 中为不同数据配置默认方案；普通用户无自定义符号化权限时仍可按默认 XYZ 方案完整加载。

## 后端测试

- 测试命令：`pixi run test`
- 纯函数模块位于 `backend/tests/unit/`，不依赖数据库：
  - `test_progress.py` — 进度文本规范化、百分比解析
  - `test_rules_engine.py` — 波段极值、规则归一化、模式校验
  - `test_color_mapping.py` — hex→RGBA、色带、缩放、色彩映射
  - `test_geo_utils.py` — 坐标边界、瓦片计算、样式哈希、相交判断
- 集成测试位于 `backend/tests/integration/`，覆盖 API 端点（bootstrap、layers、resource profile/query）和文件扫描逻辑。
- 测试 mock 目标路径使用模块实际路径（如 `apps.raster.services.importer.import_raster_file`），不使用 `__init__.py` 重导出路径。

## 前端测试

- 测试框架：vitest，测试命令：`pnpm test`
- 纯函数测试位于 `src/utils/*.test.ts`，不依赖 DOM 或 React：
  - `geometry.test.ts` — 几何计算、边界合并、坐标提取、格式化工具
  - `layerFactory.test.ts` — 矢量/栅格图层组构建
- 类型检查：`pnpm run typecheck`（`tsc --noEmit`）
- 代码检查与格式化：`pnpm run check` 使用 Oxlint + Oxfmt，`pnpm run fix` 自动应用 Oxlint 可修复项并写入 Oxfmt 格式化结果。
- API 契约检查：`pnpm run check:api`（Redocly lint + OpenAPI 类型漂移检查）
- 快速生产构建：`pnpm run build`（仅执行 Vite 生产打包）
- 发布/CI 构建验证：`pnpm run build:verify`（check:api + typecheck + vite build）

## Mock Server 与前后端分离开发

- Prism 作为本地 API mock server，前端脚本位于 `frontend/package.json`：
  - `pnpm run mock:build`：从 `docs/openapi.yaml` 生成 Prism 输入文件，并注入 `mock/prism/examples/*.json` 示例。
  - `pnpm run mock:api`：在 `127.0.0.1:4010` 启动 Prism。
  - `pnpm run dev:mock`：使用 `.env.mock` 将 Vite `/api` 代理到 Prism。
  - `pnpm run dev:with-mock`：同时启动 Prism 与 Vite。
- `docs/openapi.yaml` 仍是唯一权威 API 合同；`mock/prism/openapi.prism.json` 是派生产物，不手写维护。
- Mock 示例按业务域拆分在 `mock/prism/examples/`，优先从 `config/app.test.toml` 指向的数据目录抽取真实资源、图层和栅格元数据。
- API 错误响应统一为 JSON：未认证返回 `401 {"detail":"请先登录"}`，CSRF 失败返回 `403 {"detail":"CSRF 验证失败"}`。后端 API 不返回登录页 HTML 或 Django HTML 错误页。

## 前端构建优化记录

- 路由页面使用 `React.lazy` 按需加载，登录、入口、地图、非地理、导入和后台页面由 `App.tsx` 按路由按需导入。
- Vite 按 `React.lazy` 的导入关系拆分 chunk，并过滤首屏 HTML 对后台大包的预加载。
- Mapbox GL JS 和 `mapbox-gl` 样式均从前端 npm 依赖经 Vite 加载，不在 `index.html` 通过 CDN 注入，也不依赖全局 `mapboxgl`。
- `pnpm run build` 定位为快速打包命令；需要类型检查的发布或 CI 流程使用 `pnpm run build:verify`。

## 前端性能基准与优化记录

- 前端性能验收统一使用本地生产构建、Vite preview、Prism Mock API 和 Playwright Chromium 采集。命令为 `pnpm run build`、`pnpm run perf:mock -- --label <label>`、`pnpm run perf:compare -- before after`；结果写入被 git 忽略的 `frontend/perf-results/`。

## 后端性能优化记录

- 矢量资源查询在存在空间过滤条件时，先解析查询几何并将 bbox 下推给 GeoPackage 读取；读取后仍保留 Shapely `intersects` 精确过滤。若无法可靠确认图层 CRS，则回退整层读取，避免误裁剪。
- 数据访问权限判断复用当前请求用户组 ID，并在对象已预取 `access_groups` 时直接使用预取缓存；栅格数据集列表改为数据库侧权限过滤，减少列表接口 N+1 查询。
- 栅格瓦片渲染复用注册阶段已归一化的符号化规则；透明空瓦片 PNG 进程内缓存，避免无相交瓦片重复分配和编码。
- 后续若要继续优化大数据性能，应优先用真实 30k+ GeoPackage 和大 COG 栅格采集接口级指标，重点观察矢量 profile 整层读取、GeoJSON 序列化、唯一值分类和实时 XYZ 瓦片读取耗时。
- 性能脚本覆盖 `/login`、`/map`、`/admin/dashboard`，记录加载时间、FCP、LCP、CLS、长任务数量和耗时、JS heap、资源传输体积与构建产物体积。外部地图瓦片在脚本中以透明 PNG mock 响应，避免公网波动影响本地对比。
- 本轮优化不修改 `docs/openapi.yaml`、后端接口、权限语义、数据路径或栅格渲染架构。API client 保留生成 SDK 类型约束，但把非首屏 SDK 和 fetch client 改为首次业务调用时动态加载；登录、bootstrap、当前用户等启动请求使用同一错误处理和 CSRF 逻辑的轻量 fetch 门面。
- 首屏和路由代码拆分结果：原 `MapPage` 路由 chunk 约 1.89 MB，优化后 `MapPage` 入口约 80 KB，Mapbox 相关代码延后到地图画布加载；原 `AdminDashboardPage` chunk 约 1.47 MB，优化后页面入口约 13 KB，Dashboard 活跃用户图表改为轻量 React/CSS 柱状图，不再为单个图表加载 2 MB 级图表库。
- 登录背景从 2.4 MB PNG 改为约 428 KB JPG，体积降低约 82%；登录页和工作台 Logo 改用约 4 KB SVG，并为图片提供稳定尺寸，避免加载 1024px PNG 和减少布局偏移风险。
- 地图鼠标经纬度显示通过 `requestAnimationFrame` 和 DOM ref 更新，窗口 resize 也按帧合并 `map.resize()` 与视图状态计算，避免高频事件触发 React 重渲染或连续 layout 计算；hover 高亮只在目标 feature 变化时更新 feature-state。
- 地图内部状态统一放在 `mapState` 的 WeakMap 中，包括 `sourceDataRefs`、`loadedSourceIds`、交互 handler 和交互上下文。地图图层同步跳过未变化 GeoJSON 的 `setData`，交互 handler 只注册一次并更新上下文，减少重复解绑绑定。
- 图层数据表弹窗只在打开时构建字段和轻量行索引，行数据不再复制完整 properties，单元格、排序和筛选按 feature index 懒读取原始 GeoJSON；列宽拖拽、图层树 dragover 和工作台头部尺寸测量均按帧合并状态更新，减少拖拽与导航测量造成的重排。
- 符号化编辑器、MapCanvas、后台图表等重型组件按交互或路由懒加载。IndexedDB 工作台缓存改为 debounce 写入、重复快照跳过、串行队列写入，并在页面卸载时 flush 最新快照；超过 8 MB 的图层快照不写入本地缓存并给出提示，避免主线程频繁结构化克隆大对象。
- `index.html` 提供 SVG favicon、主题色和 Mapbox `preconnect`；应用字体继续使用系统中文字体，不引入远程字体。前端构建产物继续使用 hash 命名，部署侧应对 `assets/*` 设置长期缓存、对 `index.html` 使用 no-cache 或短缓存。
- 当前 `perf:compare` 的 bundle 表按 hash 后文件名比较，适合定位构建产物变化，但重命名 chunk 会显示为旧文件移除和新文件新增；结论应优先结合路由入口 chunk、主要库 chunk 和页面指标判断。

## 前端依赖升级兼容记录

- 当前前端升级目标：React `19.2.7`、React DOM `19.2.7`、Ant Design `6.4.3`、`@ant-design/icons` `6.2.5`。
- React 19 检查项：未使用 `ReactDOM.render`、`findDOMNode`、字符串 ref、无参 `useRef()`、旧 `react-dom/test-utils` 或依赖 `ReactElement` 默认 `any` props 的写法；入口仍使用 `react-dom/client` 的 `createRoot`。
- Ant Design 6 适配项：`Alert message` 改为 `title`，`Tabs tabPosition` 改为 `tabPlacement`，`Space direction` 改为 `orientation`，`Popover styles.body` 改为 `styles.content`。
- CSS 风险项：项目仍存在少量基于 Ant Design 内部类名的布局微调（如 Tabs、Table、Descriptions、Switch），升级后需要通过页面走查持续确认 DOM 结构变化没有影响样式。

## 版本管理

### 实现概述

项目采用语义化版本（Semantic Versioning）进行版本管理，前后端版本号保持同步更新。

### 文件结构

```
huyang_system/
├── CHANGELOG.md                    # 项目变更日志
├── Makefile                        # 版本管理统一命令
├── frontend/
│   └── package.json                # 前端版本号及版本管理脚本
└── backend/
    ├── pyproject.toml              # 后端版本号
    └── scripts/
        └── bump_version.py         # 后端版本更新脚本
```

### 版本管理脚本

#### 前端（package.json）

```json
{
  "scripts": {
    "version:patch": "pnpm version patch",
    "version:minor": "pnpm version minor",
    "version:major": "pnpm version major"
  }
}
```

#### 后端（bump_version.py）

- 读取 `pyproject.toml` 中的版本号
- 根据参数（major/minor/patch）计算新版本号
- 更新 `pyproject.toml` 文件
- 可选：创建 git commit 和 tag

使用方式：
```bash
# 使用 Pixi 后端环境

# 更新补丁版本
pixi run python scripts/bump_version.py patch

# 更新次版本并创建 git 标签
pixi run python scripts/bump_version.py minor --tag

# 预览变更（不实际修改）
pixi run python scripts/bump_version.py patch --dry-run
```

### Makefile 命令

Makefile 提供了统一的版本管理接口，同时更新前端和后端版本：

- `make version-patch` - 同时更新前后端补丁版本
- `make version-minor` - 同时更新前后端次版本
- `make version-major` - 同时更新前后端主版本
- `make changelog` - 显示最近提交历史
- `make tag` - 创建 git 标签

### CHANGELOG.md 格式

采用 [Keep a Changelog](https://keepachangelog.com) 格式：

```markdown
## [Unreleased]

### Added
- 新增功能

### Changed
- 变更功能

### Fixed
- 修复问题

### Removed
- 移除功能

## [0.1.0] - YYYY-MM-DD

### Added
- 初始版本功能
```

### 发布流程

1. 更新 `CHANGELOG.md`，将 `[Unreleased]` 部分移至新版本
2. 运行 `make version-patch/minor/major` 更新版本号
3. 运行 `make tag` 创建 git 标签
4. 推送代码和标签：`git push && git push --tags`

### 当前版本

- 前端版本：`0.1.0`（frontend/package.json）
- 后端版本：`0.1.0`（backend/pyproject.toml）
- 最新标签：`v0.1.0`

---

## 数据表功能

### 选中机制

数据表使用 Ant Design Table 的 `rowSelection` 属性实现 checkbox 选择：

- 每行左侧有 checkbox
- 表头 checkbox 旁有下拉菜单，支持全选、反选、清空操作
- 选中后地图上对应的要素会高亮显示（通过 Mapbox GL 的 feature-state）
- 右侧面板显示第一个选中要素的属性信息

### 表头分组

使用 Ant Design Table 的表头分组功能展示字段说明：

- 第一行：显示字段名称
- 第二行：显示字段描述（从 GeoPackage `gpkg_data_columns` 表读取）
- 排序和筛选按钮只在第二行（描述行）显示
- 无描述的字段只显示一行

### 样式规范

- 所有数据单元格和表头单元格左对齐
- 内边距统一为 8px
- checkbox 列使用 Ant Design 默认样式，不使用 `ResizableHeaderCell`

---

## 字段元数据

### 存储方式

字段元数据存储在 GeoPackage 文件的 `gpkg_data_columns` 表中：

```sql
CREATE TABLE gpkg_data_columns (
    table_name TEXT NOT NULL,
    column_name TEXT NOT NULL,
    name TEXT,
    title TEXT,
    description TEXT,
    mime_type TEXT,
    constraint_name TEXT,
    CONSTRAINT pk_gpkg_data_columns PRIMARY KEY (table_name, column_name)
)
```

### 读取方式

后端 `read_field_metadata(path, table_name)` 函数从 GeoPackage 读取字段元数据，返回 `{column_name: description}` 字典。

`gpkg_data_columns` 表不存在时按无字段说明处理并返回空字典；如果表存在但结构异常、数据库文件异常或查询失败，后端不再吞掉异常，应转为明确的数据查询错误或在扫描入口记录异常。

### API 响应

`resource_profile` 和 `resource_query` 端点的 `fields` 数组包含 `description` 字段：

```json
{
  "fields": [
    {
      "name": "species",
      "type": "object",
      "nullable": false,
      "sampleValues": ["Populus euphratica"],
      "description": "树种名称"
    }
  ]
}
```

---

## 地图视角缩略图

- 右侧“当前视角平面缩略图”不使用静态 SVG 占位。`MapCanvas` 从 Mapbox 当前中心点、范围、缩放、旋转和俯仰读取 `MapViewState`，传给右侧栏渲染。
- 平面缩略图使用独立的不可交互 Mapbox GL 2D 地图承载 OSM 数据的矢量底图，不再手动计算和拼接瓦片；缩略图固定使用 OSM，不跟随系统 Mapbox 卫星底图切换。
- 缩略图 OSM 矢量底图按平台统一的 `zh-Hans` 语言模式加载；Mapbox GL 初始化和样式加载后都应用同一个中文底图语言函数，优先使用数据源内已有中文名称字段，缺失时显示数据源本地名称。
- 缩略图地图使用 Web Mercator 投影，中心与主 3D 地球当前中心同步，缩放使用主图缩放小 3 级；初始中心和缩放必须来自主图 `MapViewState`，不使用硬编码默认视角。
- 缩略图不再显示中心点、中心经纬度或缩放等级。当前主地图视口范围通过缩略图内的红色 GeoJSON 线框表示；缩略图不承载栅格符号化，栅格渲染仍由后端瓦片/PNG 服务负责。

## 工作台检索与地图工具

- 地图工具栏的“复位”按钮统一定义为定位到项目范围，使用项目范围边界 `[50, 35]` 至 `[100, 48]` 执行 `fitBounds`；原独立“定位到项目范围”按钮移除。
- 鼠标经纬度状态显示并入地图工具栏左侧，不再作为单独悬浮状态块。
- 顶部全局搜索不再提供独立搜索按钮。输入框聚焦后立即展开搜索面板，按“数据、工程/专题、成果”展示当前可用内容，分类标签放在面板底部；数据条目提供快速加载入口。
- 登录前界面和后台 Dashboard 卡片使用 Ant Design `BorderBeam` 组件，颜色采用 Ocean 渐变停靠点 `#1677ff 0%`、`#36cfc9 52%`、`#95de64 100%`。

## 代码结构与内置配置

- 项目结构维护说明见 `docs/project-structure.md`；移动前端或后端模块时必须同步更新该文档。
- 后端内置账号和内置用户组配置集中在 `backend/apps/core/configuration/builtins.py`，包括 `超级管理员`、`普通用户`、`游客`、`guest`、初始管理员环境变量名、初始密码文件名和默认权限集合。
- 业务逻辑不得直接散落维护内置账号/用户组字符串；需要判断内置组或内置账号时，通过 `apps.core.initialization` 暴露的 helper 和常量引用配置。
- `超级管理员`、`普通用户`、`游客` 都属于系统内置受保护用户组，不能删除或重命名。`超级管理员` 权限由系统强制补齐；`普通用户` 和 `游客` 的默认权限只在用户组首次创建时应用，后续后台调整应被保留。
- 前端认证授权页不得通过中文用户组名推断保护规则，应消费后端返回的 `isProtected` 与 `lockedPermissions`。
