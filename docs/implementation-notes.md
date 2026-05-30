# 实现约束摘录

## 分层与目录

- 前端和后端必须分离：`frontend/` 只放 React/Vite 工程，`backend/` 只放 Django 工程。
- 程序代码、业务数据、科研数据分离存放。两类数据根目录只从 TOML 配置读取。
- 业务数据固定子目录：`database/`、`media/`、`uploads/`、`exports/`、`logs/`、`static/`。
- 科研数据固定子目录：`vector/`、`raster/original/`、`raster/preprocessed/`、`raster/metadata/source/`、`raster/metadata/preprocessed/`、`gene/`、`table/`。
- 当前本机业务数据根目录为 `/Users/gx/Documents/Source/huyang_system_data/appdata`，通过 TOML 的 `storage.app_data` 指定，不在程序中硬编码。
- 当前本机科研数据根目录为 `/Users/gx/Documents/Source/huyang_system_data/research_data`，通过 TOML 的 `storage.research_data_root` 指定，不在程序中硬编码。

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
- `profile.py` 是 `catalog.data_query` 访问栅格数据的唯一入口，打破了 `catalog.data_query ↔ raster.services` 的循环依赖。
- 权限检查集中在 `permissions.py`，视图层仅负责 HTTP 协议处理。
- 异步任务（`jobs.py`）通过线程池 + 全局字典管理，进度通过轮询接口返回。

## 首批后端边界

- 使用 Django 内置 auth、admin、session、permission；平台后台是登录后的功能入口，通过平台功能权限决定是否显示和访问。
- 自助注册默认由 TOML 的 `system.allow_registration` 开启；迁移会创建单例 `SystemSetting`，管理员可在后台关闭注册。全新生产环境不使用演示初始化脚本，首个注册用户自动成为系统管理员，后续注册用户为普通账号。
- 运行日志统一写入业务数据根目录的 `logs/`：Django 应用日志、Django 框架日志、安全日志、Gunicorn 访问/错误日志、Nginx 访问/错误日志都落在该目录。
- Docker 启动入口必须先创建固定业务/地理/非地理数据子目录，再执行 `python manage.py migrate --noinput` 和 `collectstatic`，确保空 appdata 首次启动可以直接注册首个管理员。
- SQLite 数据库放在业务数据根目录的 `database/` 下。
- 所有矢量数据统一从地理数据根目录下的 `vector/vector.gpkg` 读取；业务库中的矢量 `storage_path` 和图层 `source_path` 字段填写该 GeoPackage 内的图层名，后端读取并输出 GeoJSON。
- 栅格数据统一放在地理数据根目录的 `raster/` 总目录下：源文件放在 `raster/original/`，导入后预处理 COG 放在 `raster/preprocessed/`，两份 `gdalinfo -json` 元数据放在 `raster/metadata/source/` 和 `raster/metadata/preprocessed/`。
- 非地理数据统一放在非地理数据根目录下：基因数据放在 `gene/`，表格数据放在 `table/`。后端目录扫描会登记 `gene` 和 `table` 类型的 `DataResource`，不创建地图图层。
- 栅格导入预处理固定使用 `gdalwarp -t_srs EPSG:3857 -r nearest -co COMPRESS=DEFLATE -of COG "$in" "$out"`，导入记录保存源文件、预处理文件、两份 GDAL 元数据、导入时间、处理日志、错误信息、默认符号化规则、范围和关联数据资源/地图图层。
- 后端启动 `runserver` 或 WSGI/ASGI 进程时会异步扫描 `vector/vector.gpkg`、非地理数据 `gene/`、`table/` 和 `raster/original/` 下已有数据；矢量图层会登记为 `DataResource/MapLayer`，非地理文件登记为 `DataResource`，栅格源文件会完成预处理并登记目录。迁移、测试等管理命令不触发扫描。可用 `APP_DISABLE_CATALOG_STARTUP_SCAN=1` 或 `APP_DISABLE_RASTER_STARTUP_SCAN=1` 显式关闭。

## 统一功能权限

- 平台功能权限统一基于 Django `Permission + Group`，不引入独立角色表。用户通过所属用户组获得功能权限。
- `apps.core.permissions.FEATURE_PERMISSIONS` 是统一注册表；后台用户组配置页只同步注册表内权限，保留用户组已有其他模型权限。
- 数据资源和图层的 `access_groups` 继续控制“能看见哪些对象”；功能权限控制“能对可见对象做什么”。
- 首批平台功能权限包括：后台入口、功能权限配置、数据浏览、数据查询、矢量加载、栅格加载、自定义符号化。
- 现有导出、数据维护、栅格数据集管理权限也纳入同一用户组配置入口。
- 前后端无权限提示统一为 `当前用户组“xxxx”无权限`；无用户组时显示 `未分组`。
- `core.load_raster_layer` 控制按默认规则加载栅格和访问 XYZ；`core.custom_symbolization` 只控制用户打开符号化编辑器并提交自定义规则。
- 栅格渲染 API 使用 `rulesMode` 区分默认/自定义：默认加载不传 `rules` 或传 `rulesMode: "default"`；自定义符号化传 `rulesMode: "custom"` 和 `rules`。

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
- 登录后进入可视化入口页，分为地理可视化和非地理可视化两个入口；地理可视化进入地图工作台，非地理可视化当前保留空白承载页。
- 后台入口始终作为工作台功能呈现；无权限时禁用并显示用户组无权限提示，入口指向 Django admin。
- 前端仅做矢量样式表达和 XYZ 瓦片叠加，不实现栅格符号化。
- Mapbox 公共 token 优先从环境变量 `MAPBOX_ACCESS_TOKEN` 读取，也可在 TOML 的 `map.mapbox_access_token` 中配置；经后端 bootstrap 下发，前端不硬编码默认 token。
- Mapbox 底图标注语言使用 `zh-Hans`，并在样式加载后优先读取中文名称字段。

## 数据管理与图层管理

- 数据管理负责浏览、按元数据筛选、读取字段与元信息、配置空间查询和属性查询。
- 数据管理不作为地图左侧常驻面板展示；在工作台顶栏通过"数据管理"按钮弹出。
- 图层管理只管理已经加载到地图上的查询结果，不直接承担数据检索职责。
- 数据加载流程固定为：工作台打开后自动扫描数据目录并刷新资源列表 -> 自动加载已有可查询/可渲染资源到地图；用户也可筛选或选择数据资源 -> 后端返回字段与元信息 -> 执行空间/属性查询 -> 将查询结果加载为临时图层。
- 空间查询由前端在地图上绘制矩形、圆、椭圆或多边形，作为 GeoJSON geometry 传给后端。
- 元数据查询作用于资源列表，当前支持名称、数据类型、分类、来源、提供单位和日期范围。
- 属性查询基于后端读取到的字段列表构建过滤条件，后端在 GeoPackage 读取结果上执行过滤。
- 后端资源能力边界：只有带 `storage_path` 的矢量 GeoPackage 资源可查询；元数据资源只可浏览和筛选。

## 当前图层树约定

- 每次"查询数据 -> 加载到图层"都会生成一个独立图层组，用于保留本次查询的时间、条件结果和元数据上下文。
- 矢量数据查询结果来自统一 GeoJSON 数据源，正常情况下每个图层组下只有一个矢量子图层。
- 栅格数据在前端状态模型中作为图层组下的栅格子图层加载，子图层持有 `tileUrl`、Mapbox 图片角点、透明度、元数据和符号化配置；栅格符号化仍由后端完成。
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

- 栅格符号化规则支持四种模式：单波段灰度（可拉伸）、任意三波段 RGB 组合（可逐波段拉伸并可指定 A 透明度 mask）、单波段伪彩色、单波段唯一值渲染。
- 默认规则按波段数生成：1 波段使用灰度；2 波段使用 `[1, 2, 2]` 映射到 RGB；3 个及以上波段使用 `[1, 2, 3]` 映射到 RGB；默认都启用 min/max 拉伸和 nodata。若处理后 COG 的 `gdalinfo -json` 缺少统计值，默认规则回退使用源文件 `gdalinfo -json` 中的统计值。
- 唯一值不在导入或默认规则阶段预统计。用户在符号化面板选择整型波段后点击“分类”，后端通过 rasterio 按 block window 逐块读取，使用 `np.unique` 合并唯一值集合，不统计数量频次；浮点波段直接拒绝唯一值分类。当前单次分类最多返回 4096 个唯一值，超过说明该波段不适合唯一值渲染。
- RGB 模式支持 A 透明度来源：默认使用 `mask`，也可选择具体整型波段或关闭。XYZ 瓦片通过 Rasterio masked read 处理 nodata，若 A 选择具体波段则同步读取该波段作为 alpha。
- 栅格只支持 XYZ 加载。前端提交符号化规则后，后端按 `(预处理 COG + 规则)` 生成内存样式哈希，瓦片接口 `/api/raster/tiles/{datasetId}/{styleHash}/{z}/{x}/{y}.png` 使用 Rasterio windowed read 直接从 COG 读取 256x256 窗口并实时应用同一套规则。
- XYZ 返回 tile URL 模板、EPSG:3857 范围、WGS84 范围、样式哈希和实际规则。
- 导入和符号化均通过异步任务接口返回进度。`gdalwarp` 的命令行输出会写入任务消息，前端在图层树中显示进度条和最近消息。
- 栅格符号化面板支持复制完整 JSON 方案，内容包含 `opacity`、`mode`、`bands`、`alphaBand`、`nodata`、`stretch`、`palette` 和 `uniqueValues`。后台可在 `RasterDataset.default_rules` 或关联 `MapLayer.raster_rules` 中为不同数据配置默认方案；普通用户无自定义符号化权限时仍可按默认 XYZ 方案完整加载。

## 后端测试

- 测试命令：`HUYANG_DISABLE_RASTER_STARTUP_SCAN=1 python manage.py test -v2`
- 纯函数模块有独立的 `SimpleTestCase` 测试，不依赖数据库：
  - `test_progress.py` — 进度文本规范化、百分比解析
  - `test_rules_engine.py` — 波段极值、规则归一化、模式校验
  - `test_color_mapping.py` — hex→RGBA、色带、缩放、色彩映射
  - `test_geo_utils.py` — 坐标边界、瓦片计算、样式哈希、相交判断
- 集成测试覆盖 API 端点（bootstrap、layers、resource profile/query）和文件扫描逻辑。
- 测试 mock 目标路径使用模块实际路径（如 `apps.raster.services.importer.import_raster_file`），不使用 `__init__.py` 重导出路径。

## 前端测试

- 测试框架：vitest，测试命令：`pnpm test`
- 纯函数测试位于 `src/utils/*.test.ts`，不依赖 DOM 或 React：
  - `geometry.test.ts` — 几何计算、边界合并、坐标提取、格式化工具
  - `layerFactory.test.ts` — 矢量/栅格图层组构建
- 类型检查：`pnpm run typecheck`（`tsc --noEmit`）
- 生产构建：`pnpm run build`（typecheck + vite build）

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
    "version:patch": "npm version patch",
    "version:minor": "npm version minor",
    "version:major": "npm version major",
    "version:prerelease": "npm version prerelease"
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
# 激活 Python 环境
eval "$(mamba shell hook --shell zsh)" && mamba activate zyhy

# 更新补丁版本
python scripts/bump_version.py patch

# 更新次版本并创建 git 标签
python scripts/bump_version.py minor --tag

# 预览变更（不实际修改）
python scripts/bump_version.py patch --dry-run
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
