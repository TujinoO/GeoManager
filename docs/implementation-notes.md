# 实现约束摘录

## 分层与目录

- 前端和后端必须分离：`frontend/` 只放 React/Vite 工程，`backend/` 只放 Django 工程。
- 程序代码、业务数据、地理数据分离存放。业务数据根目录和地理数据根目录只从 TOML 配置读取。
- 业务数据固定子目录：`database/`、`media/`、`uploads/`、`exports/`、`logs/`、`static/`。
- 地理数据固定子目录：`vector/`、`raster/original/`、`raster/preprocessed/`、`raster/metadata/source/`、`raster/metadata/preprocessed/`、`raster/png/output/`、`raster/png/cache/`。
- 当前本机业务数据根目录为 `/Users/gx/Documents/Source/huyang_system_data/appdata`，通过 TOML 的 `storage.business_data_root` 指定，不在程序中硬编码。
- 当前本机地理数据根目录为 `/Users/gx/Documents/Source/huyang_system_data/geodata`，通过 TOML 的 `storage.geographic_data_root` 指定，不在程序中硬编码。

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
│   ├── models.py       # RasterDataset, RasterCacheRecord
│   ├── permissions.py  # can_manage_raster_data, can_manage_raster_cache
│   ├── views.py        # 栅格 HTTP API（导入/渲染/瓦片/缓存）
│   └── services/       # 核心业务逻辑（拆分后的包）
│       ├── __init__.py         # 公共 API 重新导出，外部调用方零修改
│       ├── exceptions.py       # RasterRenderError, RasterImportError, RasterJobError
│       ├── constants.py        # 扩展名、色板、瓦片常量
│       ├── progress.py         # 进度文本解析
│       ├── geo_utils.py        # 坐标/边界/瓦片计算
│       ├── color_mapping.py    # numpy → RGBA 色彩映射
│       ├── rules_engine.py     # 符号化规则归一化与校验
│       ├── gdal_ops.py         # GDAL CLI 封装（gdalinfo, gdalwarp, gdal_translate）
│       ├── catalog_sync.py     # DataResource/MapLayer upsert
│       ├── serializers.py      # RasterDataset 序列化、元数据压缩
│       ├── cache.py            # PNG 缓存清理（LRU/oldest/largest 策略）
│       ├── profile.py          # 栅格资源 profile 查询（供 catalog.data_query 调用）
│       ├── importer.py         # 文件导入、预处理、扫描、数据集查找
│       ├── renderer.py         # PNG/XYZ 渲染、瓦片样式注册
│       └── jobs.py             # 异步任务系统（线程池、进度轮询）
└── audit/          # 操作日志
    ├── models.py       # OperationLog
    └── service.py      # log_operation 工具函数
```

### 后端架构原则

- `services/__init__.py` 重新导出所有公共符号，保持 `from apps.raster.services import xxx` 兼容。
- `services/` 内部模块按职责拆分：纯函数模块（`rules_engine`、`color_mapping`、`geo_utils`、`progress`）无外部依赖，可独立单元测试。
- `profile.py` 是 `catalog.data_query` 访问栅格数据的唯一入口，打破了 `catalog.data_query ↔ raster.services` 的循环依赖。
- 权限检查集中在 `permissions.py`，视图层仅负责 HTTP 协议处理。
- 异步任务（`jobs.py`）通过线程池 + 全局字典管理，进度通过轮询接口返回。

## 首批后端边界

- 使用 Django 内置 auth、admin、session、permission；平台后台是登录后的功能入口，通过 `is_staff` 和权限决定是否显示。
- SQLite 数据库放在业务数据根目录的 `database/` 下。
- 所有矢量数据统一从地理数据根目录下的 `vector/vector.gpkg` 读取；业务库中的矢量 `storage_path` 和图层 `source_path` 字段填写该 GeoPackage 内的图层名，后端读取并输出 GeoJSON。
- 栅格数据统一放在地理数据根目录的 `raster/` 总目录下：源文件放在 `raster/original/`，导入后预处理 COG 放在 `raster/preprocessed/`，两份 `gdalinfo -json` 元数据放在 `raster/metadata/source/` 和 `raster/metadata/preprocessed/`。
- 栅格导入预处理固定使用 `gdalwarp -t_srs EPSG:3857 -r nearest -co COMPRESS=DEFLATE -of COG "$in" "$out"`，导入记录保存源文件、预处理文件、两份 GDAL 元数据、导入时间、处理日志、错误信息、默认符号化规则、范围和关联数据资源/地图图层。
- 后端启动 `runserver` 或 WSGI/ASGI 进程时会异步扫描 `raster/original/` 下未完成预处理的栅格源文件；迁移、测试等管理命令不触发扫描。可用 `HUYANG_DISABLE_RASTER_STARTUP_SCAN=1` 显式关闭。
- PNG 缓存放在 `raster/png/cache/` 下，缓存 key 基于预处理 COG 文件、mtime、符号化规则和输出尺寸。

## 前端模块结构

```
frontend/src/
├── main.tsx                    # React 入口，Ant Design 中文 + 主题
├── App.tsx                     # 引导（bootstrap + auth），登录/工作台路由
├── types.ts                    # 全局类型定义
├── symbolization.ts            # 符号化类型、默认值、规则解析
├── styles.css                  # 全局样式
├── api/
│   └── client.ts               # fetch 封装、CSRF、API 端点
├── pages/
│   ├── LoginPage.tsx            # 登录页
│   └── WorkspacePage.tsx       # 工作台主页面（协调各组件）
├── components/
│   ├── MapCanvas.tsx            # Mapbox GL JS 地图组件
│   ├── DataPanel.tsx            # 数据管理面板
│   ├── LayerPanel.tsx           # 图层管理面板（从 LayerContext 消费状态）
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
│   ├── featureInteraction.ts    # hover/click/popup 交互
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

## 首批前端边界

- 统一登录页不展示独立后台入口。
- 登录后进入地图工作台，包含顶部栏、地图、数据管理面板和已加载图层面板。
- 后台入口只在用户具备后台权限时显示，入口指向 Django admin。
- 前端仅做矢量样式表达和 PNG 叠加，不实现栅格符号化。
- Mapbox 公共 token 从 TOML 的 `map.mapbox_access_token` 读取，经后端 bootstrap 下发；前端不硬编码默认 token。
- Mapbox 底图标注语言使用 `zh-Hans`，并在样式加载后优先读取中文名称字段。

## 数据管理与图层管理

- 数据管理负责浏览、按元数据筛选、读取字段与元信息、配置空间查询和属性查询。
- 数据管理不作为地图左侧常驻面板展示；在工作台顶栏通过"数据管理"按钮弹出。
- 图层管理只管理已经加载到地图上的查询结果，不直接承担数据检索职责。
- 数据加载流程固定为：筛选或选择数据资源 -> 后端返回字段与元信息 -> 执行空间/属性查询 -> 将查询结果加载为临时图层。
- 空间查询由前端在地图上绘制矩形、圆、椭圆或多边形，作为 GeoJSON geometry 传给后端。
- 元数据查询作用于资源列表，当前支持名称、数据类型、分类、来源、提供单位和日期范围。
- 属性查询基于后端读取到的字段列表构建过滤条件，后端在 GeoPackage 读取结果上执行过滤。
- 后端资源能力边界：只有带 `storage_path` 的矢量 GeoPackage 资源可查询；元数据资源只可浏览和筛选。

## 当前图层树约定

- 每次"查询数据 -> 加载到图层"都会生成一个独立图层组，用于保留本次查询的时间、条件结果和元数据上下文。
- 矢量数据查询结果来自统一 GeoJSON 数据源，正常情况下每个图层组下只有一个矢量子图层。
- 栅格数据在前端状态模型中作为图层组下的栅格子图层加载，子图层可持有 `pngUrl`、`tileUrl`、Mapbox 图片角点、透明度、元数据和符号化配置；栅格符号化仍由后端完成。
- 图层组和子图层均保留独立显隐、元数据按钮和符号化面板入口；透明度在符号化面板内配置。
- 元数据展示使用临时弹出小卡片，不占用地图常驻布局。

## 矢量图层符号化与交互

- 图层组和子图层均支持在图层树内直接改名；当前改名属于前端临时工作台状态，后续如需保存到业务库，应接入后端图层配置接口。
- 透明度不再作为图层树独立滑块展示，而是放入符号化面板：图层组透明度与子图层透明度在渲染前相乘，作为 Mapbox paint opacity 的基础值。
- 点要素符号化按 Mapbox Style Specification 的 `circle` 和 `symbol` 图层拆分：`circle` 参数覆盖颜色、半径、描边、模糊、位移、pitch、sort key、emissive 等；`symbol` 参数覆盖 icon/text 的 layout 与 paint 配置。
- 线、面要素继续使用 Mapbox `line`、`fill` 图层表达，符号化面板同步暴露线色、线宽、线型、填充色、透明度、位移、sort key 等参数。
- 每个前端加载的 GeoJSON source 使用 `generateId`，所有矢量 style layer 注册统一点击/悬停交互。悬停改变鼠标指针并高亮要素，点击后通过 Mapbox Popup 展示该要素 properties。
- 当前符号化模型位于 `frontend/src/symbolization.ts`，编辑界面位于 `frontend/src/components/SymbolizationEditor.tsx`，Mapbox 转换逻辑位于 `frontend/src/map/vectorLayerSync.ts`。

## 栅格符号化与加载方案

- 栅格符号化规则支持四种模式：单波段灰度（可拉伸）、任意三波段 RGB 组合（可逐波段拉伸）、单波段伪彩色、单波段唯一值渲染。
- 默认规则按波段数生成：1 波段使用灰度；2 波段使用 `[1, 2, 2]` 映射到 RGB；3 个及以上波段使用 `[1, 2, 3]` 映射到 RGB；默认都启用 min/max 拉伸。若处理后 COG 的 `gdalinfo -json` 缺少统计值，默认规则回退使用源文件 `gdalinfo -json` 中的统计值。
- 整图加载时，后端使用 `gdal_translate` 选择波段、按规则拉伸到 Byte 并输出 PNG；伪彩色和唯一值模式先由 `gdal_translate` 生成归一化临时 PNG，再在后端应用色带或唯一值色表，最终 PNG 仍写入缓存目录。
- XYZ 加载时，前端先提交符号化规则，后端按 `(预处理 COG + 规则)` 生成内存样式哈希，瓦片接口 `/api/raster/tiles/{datasetId}/{styleHash}/{z}/{x}/{y}.png` 使用 Rasterio windowed read 直接从 COG 读取 256x256 窗口并实时应用同一套规则。
- 整图 PNG 返回 `pngUrl` 和 Mapbox image source 所需的四角经纬度；XYZ 返回 tile URL 模板。两种方式都返回 EPSG:3857 范围、WGS84 范围、样式哈希和实际规则。
- 导入和符号化均通过异步任务接口返回进度。`gdalwarp`/`gdal_translate` 的命令行输出会写入任务消息，前端在图层树中显示进度条和最近消息。

## 后端测试

- 测试命令：`HUYANG_DISABLE_RASTER_STARTUP_SCAN=1 python manage.py test -v2`
- 纯函数模块有独立的 `SimpleTestCase` 测试，不依赖数据库：
  - `test_progress.py` — 进度文本规范化、百分比解析
  - `test_rules_engine.py` — 波段极值、规则归一化、模式校验
  - `test_color_mapping.py` — hex→RGBA、色带、缩放、色彩映射
  - `test_geo_utils.py` — 坐标边界、瓦片计算、缓存键、相交判断
- 集成测试覆盖 API 端点（bootstrap、layers、resource profile/query）和文件扫描逻辑。
- 测试 mock 目标路径使用模块实际路径（如 `apps.raster.services.importer.import_raster_file`），不使用 `__init__.py` 重导出路径。

## 前端测试

- 测试框架：vitest，测试命令：`pnpm test`
- 纯函数测试位于 `src/utils/*.test.ts`，不依赖 DOM 或 React：
  - `geometry.test.ts` — 几何计算、边界合并、坐标提取、格式化工具
  - `layerFactory.test.ts` — 矢量/栅格图层组构建
- 类型检查：`pnpm run typecheck`（`tsc --noEmit`）
- 生产构建：`pnpm run build`（typecheck + vite build）
