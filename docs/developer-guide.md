# 开发者指南（Developer Guide）

> 中亚胡杨林生态系统保护数据共享平台  
> 版本：v0.1.0

---

## 目录

1. [快速开始](#1-快速开始)
2. [认证与会话管理](#2-认证与会话管理)
3. [数据浏览与目录](#3-数据浏览与目录)
4. [数据导入](#4-数据导入)
5. [数据查询](#5-数据查询)
6. [数据导出](#6-数据导出)
7. [地图图层](#7-地图图层)
8. [栅格数据管理](#8-栅格数据管理)
9. [异步任务管理](#9-异步任务管理)
10. [搜索](#10-搜索)
11. [后台管理](#11-后台管理)
12. [最佳实践](#12-最佳实践)
13. [常见问题（FAQ）](#13-常见问题faq)
14. [版本控制与变更历史](#14-版本控制与变更历史)

---

## 1. 快速开始

### 功能简介

中亚胡杨林生态系统保护数据共享平台是一个用于管理和共享生态研究数据的综合系统。平台支持矢量数据、栅格数据、表格数据等多种数据类型的导入、查询、可视化和导出。

### 技术架构

| 层级 | 技术栈 |
|------|--------|
| 前端 | React + Vite + Ant Design + Mapbox GL JS |
| 后端 | Python + Django + GeoPandas + GDAL + Rasterio |
| 数据存储 | SQLite（业务数据）、GeoPackage（矢量数据）、原始栅格文件 |

### 核心概念

**数据资源（DataResource）**：平台中的基本数据单元，代表一个独立的数据集，如"胡杨林分布图"或"DEM高程数据"。

**数据目录（DataCatalog）**：用于组织数据资源的分类树结构，支持多级目录。

**地图图层（MapLayer）**：数据资源在地图上的可视化表现形式，分为矢量图层和栅格图层。

**栅格数据集（RasterDataset）**：经过预处理的栅格文件，支持瓦片服务和符号化渲染。

### 首次接入流程

```
1. 获取系统配置
   ↓
2. 用户注册/登录
   ↓
3. 浏览数据目录
   ↓
4. 查询/导出数据
```

### SDK 示例

**JavaScript / TypeScript（Hey API）**

前端项目使用 `@hey-api/openapi-ts` 生成 `frontend/src/api/generated/` 下的类型、SDK 和 fetch client。业务代码优先使用 `frontend/src/api/client.ts` 导出的 `api` 对象；新增 API 方法时应通过 Hey API 生成的 SDK 函数调用 OpenAPI 中定义的路径。

```typescript
import { getBootstrap } from "../frontend/src/api/generated";
import { client } from "../frontend/src/api/generated/client.gen";

client.setConfig({ baseUrl: "http://localhost:8000", credentials: "include" });

// 获取系统配置
const { data: config, error } = await getBootstrap();

if (error) {
  throw new Error(error.detail);
}

console.log("系统名称:", config.systemName);
console.log("是否开放注册:", config.allowRegistration);
```

OpenAPI 规范更新后，在前端目录运行：

```bash
pnpm run generate:api
pnpm run check:api
pnpm run api:docs
```

`api:docs` 和 `api:bundle` 的输出属于前端生成物，保存在 `frontend/generated/`，不作为人工维护文档编辑。

### API 契约规范

`docs/openapi.yaml` 是唯一权威 API 契约，使用 OpenAPI 3.1.0。新增、删除或修改接口时，先更新契约，再同步后端实现、前端类型、mock 示例和文档说明。

强制规则：

- `operationId` 使用唯一 camelCase 名称。
- 公共接口显式声明 `security: []`，登录后接口声明 `sessionAuth`。
- 所有参数、请求体、响应 schema 和错误响应都必须有清晰 `description`。
- 错误响应统一使用 `ErrorResponse`，至少包含 `detail` 字段。
- API 未认证返回 JSON `401 {"detail":"请先登录"}`，CSRF 失败返回 JSON `403 {"detail":"CSRF 验证失败"}`，不得返回登录页 HTML 或 Django HTML 错误页。
- OpenAPI 3.1 可空字段使用 JSON Schema 语义，例如 `type: [integer, "null"]`，不使用 `nullable: true`。
- Prism 示例维护在 `mock/prism/examples/*.json`，生成的 `mock/prism/openapi.prism.json` 不手写维护。

修改 API 后运行：

```bash
cd frontend
pnpm run generate:api
pnpm run check:api
pnpm run api:changes:check
pnpm run api:docs
pnpm run api:lint
```

### Prism Mock Server

前端可在没有真实后端的情况下使用 Prism mock server：

```bash
cd frontend
pnpm run mock:build
pnpm run mock:api
pnpm run dev:mock
```

也可以一条命令同时启动 Prism 和 Vite：

```bash
cd frontend
pnpm run dev:with-mock
```

`dev:mock` 会通过 `.env.mock` 将 Vite `/api` 代理到 `http://127.0.0.1:4010`。Mock 响应样例位于 `mock/prism/examples/`，由 `pnpm run mock:build` 注入到 `mock/prism/openapi.prism.json`。

### 登录页公开概览接口

新版登录页包含平台品牌、能力标签、数据统计卡片、服务状态点阵和版本信息。为避免前端硬编码统计口径，后端需要提供公共概览接口：

```typescript
const { data: overview, error } = await client.GET("/api/login/overview/");

if (error) {
  throw new Error(error.detail);
}

console.log(overview.platform.chineseName);
console.log(overview.metrics.map((item) => item.displayValue));
```

`GET /api/login/overview/` 无需认证，专门服务登录页公开展示内容；它不同于 `/api/admin/dashboard/`，后者需要登录和后台权限，不能直接用于未登录的首页。该接口不得返回敏感路径、用户信息、权限组明细、内部服务器资源或未公开数据清单。

登录页字段和前端展示关系：

| 前端区域 | OpenAPI 字段 | 后端实现口径 |
| --- | --- | --- |
| 中文名称、英文名称、CAPFED、版本型号 | `platform` | 来自系统设置或后端常量，需与软件发布版本保持一致 |
| 主标题上方标签、一句话概述、能力标签 | `hero` | 后端返回可配置文案，前端只负责排版展示 |
| 四个统计卡片 | `metrics` | 当前需要 `dataResources`、`thematicLayers`、`monitoringSites`、`coveredBasins` 四项，返回原始 `value` 和格式化 `displayValue` |
| 平台服务状态 | `serviceStatus.services` | 返回资源目录、图层服务、权限认证三个公开状态，不暴露内部错误堆栈 |
| 点阵图例与数量 | `serviceStatus.nodeSummary` | 返回 `normal`、`warning`、`risk` 数量和图例，前端据此渲染状态点阵 |
| 底部统计说明 | `footer.statisticsNotice` | 说明统计口径是否已接入后端概览接口 |

推荐后端将该接口结果短时间缓存，例如 60 秒到 5 分钟；数据资源、图层和监测站点数量不要求实时到秒级，但应与后台 Dashboard 或数据管理统计口径保持一致。

**Python**

```python
import requests

session = requests.Session()
base_url = "http://localhost:8000/api"

# 获取系统配置
config = session.get(f"{base_url}/bootstrap/").json()
print(f"系统名称: {config['systemName']}")
print(f"是否开放注册: {config['allowRegistration']}")
```

---

## 2. 认证与会话管理

### 功能简介

平台采用 Django 内建的 Session 认证机制，基于 Cookie 维持会话。所有需要身份验证的操作都依赖于有效的会话。

### 使用场景

- 用户首次访问系统需要注册账号
- 已有账号的用户登录系统
- 前端应用检查用户登录状态
- 用户退出系统

### 前置条件

- 系统已正常运行
- 首次迁移后系统会自动创建用户名为 `admin` 的完整功能账号和 `超级管理员` 角色；该账号是普通用户，完整功能来自角色权限。未设置 `HUYANG_SUPERADMIN_PASSWORD` 时，随机初始密码写入业务数据目录；服务器启动时会向控制台打印账号用户名和初始/配置密码，可通过 `docker logs` 查看。
- 注册功能已开放（可通过 `/api/bootstrap/` 接口查询 `allowRegistration` 字段）

### 集成流程

```
获取 CSRF Token
   ↓
用户登录/游客登录/注册
   ↓
获取用户信息
   ↓
后续请求携带凭证
```

### 实现步骤

#### Step 1: 获取 CSRF Token

在执行任何写操作（POST）之前，必须先获取 CSRF Token。系统会设置 `csrftoken` Cookie，后续请求需从 Cookie 中读取此值并通过 `X-CSRFToken` 请求头传递。

```javascript
// JavaScript
await fetch("/api/auth/csrf/", { credentials: "include" });
```

```python
# Python
session.get(f"{base_url}/auth/csrf/")
```

如果未携带有效 CSRF Token，后端返回 JSON `403`：

```json
{"detail": "CSRF 验证失败"}
```

受保护 API 未登录时返回 JSON `401`：

```json
{"detail": "请先登录"}
```

API 不应返回登录页 HTML 或 Django HTML 错误页，前后端和 mock server 都按 `ErrorResponse.detail` 处理错误。

#### Step 2: 用户登录

使用用户名和密码进行登录。登录成功后，系统会建立会话并返回用户信息。

```javascript
// JavaScript
const response = await fetch("/api/auth/login/", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": getCookie("csrftoken"),
  },
  body: JSON.stringify({
    username: "researcher1",
    password: "your_password",
    remember: true, // true: 持久会话; false: 关闭浏览器即失效
  }),
});
const { user } = await response.json();
```

```python
# Python
response = session.post(f"{base_url}/auth/login/", json={
    "username": "researcher1",
    "password": "your_password",
    "remember": True,
})
user = response.json()["user"]
```

#### Step 3: 游客登录

无需输入账号密码，可使用系统维护的专用游客账号建立会话。游客账号用户名固定为 `guest`，显示名为“游客”，不可使用密码登录；账号只归属 `游客` 角色。游客角色默认不具备任何功能权限。管理员可在认证授权中调整游客角色权限，但游客系统账号不能被删除、停用、重置密码、改角色或单独授予直授权限，`游客` 内置角色也不能删除或重命名。

```javascript
// JavaScript
const response = await fetch("/api/auth/guest-login/", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": getCookie("csrftoken"),
  },
});
const { user } = await response.json();
```

```python
# Python
response = session.post(f"{base_url}/auth/guest-login/")
user = response.json()["user"]
```

#### Step 4: 用户注册

如果系统开放了注册功能，新用户可以通过注册接口创建普通账号。完整功能账号由首次初始化流程自动创建，并自动归属 `超级管理员` 角色。

```javascript
// JavaScript
const response = await fetch("/api/auth/register/", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": getCookie("csrftoken"),
  },
  body: JSON.stringify({
    username: "researcher1",
    email: "researcher1@example.com",
    password: "SecurePass123!",
    passwordConfirm: "SecurePass123!",
  }),
});
```

```python
# Python
response = session.post(f"{base_url}/auth/register/", json={
    "username": "researcher1",
    "email": "researcher1@example.com",
    "password": "SecurePass123!",
    "passwordConfirm": "SecurePass123!",
})
```

#### Step 5: 检查登录状态

前端应用可以通过此接口检查当前用户的登录状态和权限信息。

```javascript
// JavaScript
const response = await fetch("/api/auth/me/", { credentials: "include" });
const data = await response.json();

if (data.authenticated) {
  console.log("当前用户:", data.user.displayName);
  console.log("用户权限:", data.user.permissions);
} else {
  // 未登录，跳转到登录页
}
```

```python
# Python
response = session.get(f"{base_url}/auth/me/")
data = response.json()

if data["authenticated"]:
    print(f"当前用户: {data['user']['displayName']}")
else:
    print("未登录")
```

### 权限系统

平台采用两层权限模型：

**功能权限**：控制用户可以执行的操作类型，如浏览数据、查询数据、加载图层等。

**数据访问权限**：控制用户可以访问的具体数据资源，通过角色进行管理；后端实现仍使用 Django Group。

| 权限标识 | 权限分组 | 功能说明 |
|----------|----------|----------|
| `core.view_operation_logs` | 后台权限 | 查看操作日志 |
| `core.view_system_logs` | 后台权限 | 查看系统日志 |
| `core.manage_system_settings` | 后台权限 | 修改系统设置 |
| `core.manage_data_backup` | 后台权限 | 管理数据备份；默认仅超级管理员角色具备 |
| `core.view_all_operation_logs` | 日志权限 | 查看所有用户日志 |
| `core.view_own_operation_logs` | 日志权限 | 只能查看自己的日志 |
| `core.view_group_operation_logs` | 日志权限 | 查看已配置角色成员的日志 |
| `core.view_dashboard_resource_card` | 概览权限 | 查看概览数据资源卡片 |
| `core.view_dashboard_layer_card` | 概览权限 | 查看概览图层数卡片 |
| `core.view_dashboard_raster_card` | 概览权限 | 查看概览栅格数量卡片 |
| `core.view_dashboard_user_card` | 概览权限 | 查看概览用户数量卡片 |
| `core.view_dashboard_active_users_card` | 概览权限 | 查看概览活跃用户卡片 |
| `core.view_dashboard_system_card` | 概览权限 | 查看概览系统信息 |
| `core.view_data_overview` | 概览权限 | 查看数据概览中的“我可见”范围、兼容旧版全局统计和上传用户统计；“我上传”概览无需此权限 |
| `core.browse_data` | 数据权限 | 浏览数据目录和资源 |
| `core.query_data` | 数据权限 | 执行数据查询 |
| `core.load_vector_layer` | 数据权限 | 加载矢量图层 |
| `core.load_raster_layer` | 数据权限 | 加载栅格图层 |
| `core.custom_symbolization` | 数据权限 | 自定义符号化规则 |
| `core.ai_interpretation` | 数据权限 | 使用 AI 智能解译 |
| `catalog.export_dataresource` | 数据权限 | 导出数据资源 |
| `catalog.add_dataresource` | 数据权限 | 新增数据资源和提交导入 |
| `catalog.view_dataresource` | 数据权限 | 查看存量数据资源清单 |
| `catalog.change_dataresource` | 数据权限 | 编辑数据资源、启停状态、默认可视化和访问范围 |
| `catalog.delete_dataresource` | 数据权限 | 删除数据资源 |
| `catalog.add_workspacescene` | 数据权限 | 新增工程或专题 |
| `catalog.view_workspacescene` | 数据权限 | 查看工程或专题 |
| `catalog.change_workspacescene` | 数据权限 | 编辑工程或专题 |
| `catalog.delete_workspacescene` | 数据权限 | 删除工程或专题 |
| `raster.manage_raster_dataset` | 数据权限 | 管理栅格数据集 |
| `core.manage_feature_permissions` | 人员权限 | 配置角色和功能权限 |
| `core.create_user` | 人员权限 | 在后台新建用户账号 |
| `core.manage_auth` | 人员权限 | 修改认证授权 |

初始化会自动创建 `超级管理员`、`普通用户` 和 `游客` 三个内置角色。`超级管理员` 默认拥有全部平台功能权限；`普通用户` 默认拥有全部科研数据相关权限，包括浏览、查询、导入、导出、存量数据维护、工程/专题增删查改、矢量/栅格加载、自定义符号化和栅格数据管理，不默认具备认证授权、系统设置或全量日志管理权限；`游客` 默认不具备任何功能权限。管理员新建用户时必须指定至少一个角色，自助注册用户默认加入 `普通用户` 角色。

用户最终生效的功能权限由角色权限和单用户直授权限合并得到，再扣除用户主动关闭的权限。后台用户列表返回 `groupPermissions` 表示角色继承权限，`directPermissions` 表示单独授予该用户的功能权限，`disabledPermissions` 表示单独关闭权限，`effectivePermissions` 表示最终生效权限；具备 `core.manage_auth` 和 `core.manage_feature_permissions` 的管理员可通过 `POST /api/users/{userId}/permissions/` 写入其他用户的 `directPermissions`、`disabledPermissions` 和 `operationLogGroupIds`。关闭继承权限时不修改角色本身，只写入该用户的单独关闭列表。当前登录用户不能在认证授权页修改自己的权限，应在用户设置中调整主动关闭权限。

### 最佳实践

- **CSRF Token 管理**：建议在应用初始化时获取一次 CSRF Token，后续请求自动从 Cookie 中读取。
- **会话持久化**：对于长期使用的应用，设置 `remember: true` 以保持会话。
- **权限检查**：在执行操作前，先检查用户是否具备相应权限，避免不必要的 API 调用。
- **错误处理**：妥善处理 401（未认证）和 403（权限不足）响应，引导用户进行相应操作。

### FAQ

**Q: 为什么收到 401 错误？**

A: 401 表示未认证。可能原因：
- 未登录或会话已过期
- Cookie 未正确携带（确保设置了 `credentials: "include"`）

**Q: 为什么收到 403 错误？**

A: 403 表示权限不足。可能原因：
- 用户不具备该功能权限
- 数据资源设置了访问限制，用户不在允许的角色中

**Q: 如何处理会话过期？**

A: 当收到 401 响应时，应引导用户重新登录。可以在前端全局拦截 401 响应并跳转到登录页。

**Q: 注册时提示"当前系统未开放自助注册"怎么办？**

A: 系统管理员可以在后台配置中关闭注册功能。如需注册，请联系管理员。

### API Reference

详见 API Reference（OpenAPI）。

---

## 3. 数据浏览与目录

### 功能简介

数据目录功能用于组织和浏览平台中的所有数据资源。支持树形目录结构，便于用户按分类查找所需数据。

### 使用场景

- 构建数据目录树导航
- 浏览特定分类下的数据资源
- 按条件筛选数据资源
- 获取数据资源的详细元数据

### 前置条件

- 用户已登录
- 用户具备 `core.browse_data` 权限

### 集成流程

```
获取数据目录树
   ↓
浏览/筛选数据资源
   ↓
获取资源详情（可选）
```

### 实现步骤

#### Step 1: 获取数据目录树

获取所有已激活的数据目录及其关联的数据资源，用于构建前端导航树。

```javascript
// JavaScript
const response = await fetch("/api/catalog/directories/", {
  credentials: "include",
});
const { items } = await response.json();

// items 为目录数组，每个目录包含 resources 字段
items.forEach((dir) => {
  console.log(`目录: ${dir.name}`);
  dir.resources.forEach((res) => {
    console.log(`  - ${res.name} (${res.dataType})`);
  });
});
```

```python
# Python
response = session.get(f"{base_url}/catalog/directories/")
directories = response.json()["items"]

for dir in directories:
    print(f"目录: {dir['name']}")
    for res in dir["resources"]:
        print(f"  - {res['name']} ({res['dataType']})")
```

#### Step 1.1: 获取平台数据分类架构

`GET /api/data-schema/summary/` 返回甲方确认后的平台业务数据分类、数据库分层、核心实体和前端目录树建议。该接口只读，不创建或修改业务数据；需要登录态和 `core.browse_data` 权限。当前分类包括地理数据中的种质数据、个体数据、群落数据、种群数据、野外调查数据、遥感影像数据，以及非地理数据中的分子数据和基因组数据。基因组数据不再放入地理数据目录；如需空间联动，应通过生物样品、采集地、个体或种群关联回地理对象。

```javascript
// JavaScript
const response = await fetch("/api/data-schema/summary/", {
  credentials: "include",
});
const schema = await response.json();

console.log(schema.domains.map((domain) => domain.name));
console.log(schema.catalogTree);
```

该接口用于前端展示“平台到底管理哪些数据”和“这些数据对应哪些核心表”，不替代实际数据资源列表。实际文件、表格、图层仍通过 `DataResource`、`MapLayer`、`RasterDataset` 等既有资源接口管理；标准业务实体通过新增的 `standards`、`ecology`、`omics` 后端模型承接。

#### Step 2: 筛选数据资源

支持按数据类型、分类、来源、提供者、日期范围等条件筛选数据资源。

```javascript
// JavaScript
const params = new URLSearchParams({
  dataType: "vector",      // 数据类型: vector / raster / gene / table / document / image
  domainType: "field_survey", // 业务数据类型: germplasm / individual / community / population / field_survey / remote_sensing / molecular / genome
  category: "vegetation",  // 分类代码
  q: "胡杨",              // 名称模糊搜索
});

const response = await fetch(`/api/catalog/resources/?${params}`, {
  credentials: "include",
});
const { items } = await response.json();

// items 只包含业务库登记的 DataResource，id 为 number
```

```python
# Python
response = session.get(f"{base_url}/catalog/resources/", params={
    "dataType": "vector",
    "domainType": "field_survey",
    "category": "vegetation",
    "q": "胡杨",
})
resources = response.json()["items"]
```

`domainType` 来自 `GET /api/data-schema/summary/` 的 `catalogTree[].children[].domainType`，用于平台顶部“地理数据 / 非地理数据”下拉菜单和左侧数据资源面板同步筛选。无效编码返回 `400 {"detail":"无效的数据业务类型"}`；权限、对象可见性和空数据行为仍与普通资源列表一致。

#### Step 2.1: 查询种质资源清单

`GET /api/germplasm/accessions/` 返回标准化种质资源清单，当前用于承接 DNA 样品清单中的样品编号、采集地点、性别、经纬度、海拔、资源类型和核心资源标记。接口支持 `q`、`taxon`、`site`、`isCore`、`current`、`pageSize` 查询参数；需要登录态和 `core.browse_data` 权限。无数据时返回 `{ items: [], total: 0, current, pageSize }`。

```javascript
// JavaScript
const params = new URLSearchParams({
  q: "GA1",
  taxon: "胡杨",
  site: "阿克苏",
  isCore: "true",
  current: "1",
  pageSize: "20",
});
const response = await fetch(`/api/germplasm/accessions/?${params}`, {
  credentials: "include",
});
const page = await response.json();

page.items.forEach((item) => {
  console.log(item.accessionCode, item.sampleCode, item.sourceSite?.name);
});
```

种质资源通过 `GermplasmAccession` 关联 `BiologicalSample`、`Taxon`、`Site` 和来源 `DataResource`。如果来源资源设置了访问角色，接口会沿用现有数据资源可见性规则；来源资源为空的记录视为尚未完成资源归档，但仍可作为待治理业务记录返回。

#### Step 3: 获取资源详情

获取指定数据资源的完整元数据，包括字段信息、空间范围等。

```javascript
// JavaScript
const resource = items[0];
const response = await fetch(`/api/catalog/resources/${resource.id}/profile/`, {
  credentials: "include",
});
const profile = await response.json();

console.log("资源名称:", profile.resource.name);
console.log("要素数量:", profile.featureCount);
console.log("几何类型:", profile.geometryType);
console.log("空间范围:", profile.bounds);
console.log("字段列表:", profile.fields);
```

```python
# Python
resource_id = 1
response = session.get(f"{base_url}/catalog/resources/{resource_id}/profile/")
profile = response.json()

print(f"资源名称: {profile['resource']['name']}")
print(f"要素数量: {profile['featureCount']}")
print(f"几何类型: {profile['geometryType']}")
print(f"空间范围: {profile['bounds']}")
print(f"字段列表: {profile['fields']}")
```

### 最佳实践

- **缓存目录数据**：数据目录结构变化不频繁，建议在前端缓存，减少重复请求。
- **分页处理**：资源列表可能较多，建议配合分页参数使用。
- **字段元数据**：获取资源详情后，可以展示字段说明和样本值，帮助用户理解数据结构。

### FAQ

**Q: 如何判断一个资源是矢量还是栅格？**

A: 资源的 `dataType` 字段标识数据类型：`vector` 为矢量，`raster` 为栅格。

**Q: 资源的 `isQueryable` 和 `isRenderable` 字段是什么意思？**

A: `isQueryable` 表示该资源支持属性和空间查询（通常是有存储路径的矢量数据）；`isRenderable` 表示该资源支持地图渲染（通常是有存储路径的栅格数据）。

### API Reference

详见 API Reference（OpenAPI）。

---

## 4. 数据导入

### 功能简介

数据导入功能支持将 Excel/CSV 文件中的数据导入到平台中。系统会自动识别地理数据（含经纬度）和非地理数据，并分别存储到不同的数据存储中。

### 使用场景

- 导入野外调查采集的样地数据
- 批量导入研究数据表格
- 更新已有数据集

### 前置条件

- 用户已登录
- 用户具备 `catalog.add_dataresource` 权限
- 准备好要导入的 Excel 或 CSV 文件

### 集成流程

```
上传文件预检
   ↓
数据校验
   ↓
提交导入
```

### 实现步骤

#### Step 1: 上传文件预检

上传文件后，系统会自动解析第一张表，识别字段并推测经纬度列。此步骤不写入数据，仅返回文件结构信息。

```javascript
// JavaScript
const formData = new FormData();
formData.append("file", fileInput.files[0]);

const response = await fetch("/api/catalog/import/preview/", {
  method: "POST",
  credentials: "include",
  headers: { "X-CSRFToken": getCookie("csrftoken") },
  body: formData,
});
const preview = await response.json();

console.log("字段列表:", preview.columns);
console.log("数据行数:", preview.rowCount);
console.log("是否地理数据:", preview.detected.isGeographic);
console.log("推测的经度列:", preview.detected.longitudeColumn);
console.log("推测的纬度列:", preview.detected.latitudeColumn);
```

```python
# Python
with open("survey_data.xlsx", "rb") as f:
    response = session.post(
        f"{base_url}/catalog/import/preview/",
        files={"file": f},
    )
preview = response.json()

print(f"字段列表: {preview['columns']}")
print(f"数据行数: {preview['rowCount']}")
print(f"是否地理数据: {preview['detected']['isGeographic']}")
```

#### Step 2: 数据校验

根据用户选择的导入类型和经纬度列进行数据校验。此步骤不写入数据，仅返回校验结果。

```javascript
// JavaScript
const formData = new FormData();
formData.append("file", fileInput.files[0]);
formData.append("payload", JSON.stringify({
  name: "样地调查点",
  importMode: "geographic",      // "geographic" 或 "table"
  tableName: preview.suggestedTableName,
  longitudeColumn: "longitude",  // 地理数据必填
  latitudeColumn: "latitude",    // 地理数据必填
}));

const response = await fetch("/api/catalog/import/validate/", {
  method: "POST",
  credentials: "include",
  headers: { "X-CSRFToken": getCookie("csrftoken") },
  body: formData,
});
const validation = await response.json();

if (validation.validationIssues.length > 0) {
  console.warn("校验问题:", validation.validationIssues);
}
console.log("坐标统计:", validation.coordinateStats);
```

```python
# Python
import json

with open("survey_data.xlsx", "rb") as f:
    response = session.post(
        f"{base_url}/catalog/import/validate/",
        files={"file": f},
        data={"payload": json.dumps({
            "importMode": "geographic",
            "name": "样地调查点",
            "tableName": preview["suggestedTableName"],
            "longitudeColumn": "longitude",
            "latitudeColumn": "latitude",
        })},
    )
validation = response.json()
```

#### Step 3: 提交导入

校验通过后，提交正式导入请求。系统会将数据写入相应的存储位置，并创建新的 `DataResource` 记录。

```javascript
// JavaScript
const formData = new FormData();
formData.append("file", fileInput.files[0]);
formData.append("payload", JSON.stringify({
  name: "样地调查点",
  tableName: preview.suggestedTableName,  // 后台存储标识建议值；后端冲突时会自动改写为唯一值
  importMode: "geographic",
  longitudeColumn: "longitude",
  latitudeColumn: "latitude",
  duplicateConfirmed: false,             // 前端显示名已存在时，用户是否已在校验阶段确认继续导入
  includedColumns: ["species", "height", "longitude", "latitude"],  // 可选，省略则导入全部
  fieldMetadata: {
    species: "中文名称：物种；数据来源：野外调查",
    height: "中文名称：株高；单位：m",
  },
  accessGroupIds: [3],               // 额外可见角色；上传者本人和超级管理员始终可见
}));

const response = await fetch("/api/catalog/import/commit/", {
  method: "POST",
  credentials: "include",
  headers: { "X-CSRFToken": getCookie("csrftoken") },
  body: formData,
});
const result = await response.json();

console.log("导入行数:", result.importedRows);
console.log("资源名称:", result.resourceName);
if (result.mode === "geographic") {
  console.log("资源ID:", result.resourceId);
  console.log("GeoPackage 图层名:", result.layerName);
  console.log("空间范围:", result.bounds);
} else {
  console.log("资源ID:", result.resourceId);
  console.log("表名:", result.tableName);
}
```

```python
# Python
import json

with open("survey_data.xlsx", "rb") as f:
    response = session.post(
        f"{base_url}/catalog/import/commit/",
        files={"file": f},
        data={"payload": json.dumps({
            "name": "样地调查点",
            "tableName": preview["suggestedTableName"],
            "importMode": "geographic",
            "longitudeColumn": "longitude",
            "latitudeColumn": "latitude",
            "duplicateConfirmed": False,
            "fieldMetadata": {
                "species": "中文名称：物种；数据来源：野外调查",
                "height": "中文名称：株高；单位：m",
            },
        })},
    )
result = response.json()
print(f"导入行数: {result['importedRows']}")
print(f"资源名称: {result['resourceName']}")
if result["mode"] == "geographic":
    print(f"资源ID: {result['resourceId']}")
    print(f"GeoPackage 图层名: {result['layerName']}")
else:
    print(f"资源ID: {result['resourceId']}")
```

### 数据导入模式

**地理数据（Geographic）**：包含经纬度坐标的数据，系统会将其写入统一 GeoPackage 矢量文件，并创建新的 `DataResource`。提交响应返回 `mode: "geographic"`、`resourceId`、`resourceName`、`layerName`、`tableName`、`bounds`、`coordinateStats` 和 `validationIssues`。资源列表会显示 `resourceName` 对应的用户填写数据名称，`tableName/layerName` 是后端生成的唯一存储标识。

**非地理数据（Table）**：不包含坐标信息的纯表格数据，系统会将其写入 SQLite 数据库，并创建新的 `DataResource`。提交响应返回 `mode: "table"`、`resourceId`、`resourceName`、`tableName`，且 `layerId` 和 `coordinateStats` 为 `null`。

后台存储标识每次预检都会生成不同建议值；提交时若后端发现该标识已被占用，会自动改写为唯一 GeoPackage 图层名或 SQLite 表名。重复目标检测按前端显示的数据名称执行：预检使用 `suggestedName`，校验和提交使用 payload 中的 `name`。`duplicateTarget.targetType` 固定为 `data_resource_name`。提交时若同名数据已存在且 `duplicateConfirmed=false`，后端会以 `400` 和 `duplicate_target` 问题阻止导入；用户在数据校验阶段确认重复名称并传入 `duplicateConfirmed=true` 后，后端允许继续导入并创建新的数据资源记录和唯一后台存储标识，旧数据资源不会被覆盖。

### 字段元数据规范

建议为每个字段提供以下元数据信息：

- 中文名称
- 单位（如有）
- 计算方式（如有）
- 数据来源

格式示例：`"中文名称：株高；单位：m；数据来源：野外调查"`

### 最佳实践

- **预检先行**：在正式导入前，务必先调用预检接口了解文件结构。
- **后台存储标识规范**：`tableName` 仅支持英文字母、数字和下划线，且以字母或下划线开头。前端应优先使用预检返回的 `suggestedTableName`，不要用显示名手写生成。
- **字段选择**：使用 `includedColumns` 参数只导入需要的字段，减少数据冗余。
- **元数据完善**：为字段提供详细的元数据说明，便于其他用户理解数据含义。

### FAQ

**Q: 导入时提示"经纬度不是小数格式"怎么办？**

A: 确保经纬度列使用十进制小数格式，如 `87.600`、`43.800`，而非度分秒格式。

**Q: 如何处理坐标不确定性警告？**

A: 当坐标不确定性最大/最小差距超过 200 倍时会触发警告。可以在导入请求中设置 `ignoreCoordinateUncertainty: true` 来忽略此警告。

**Q: 同名数据已存在怎么办？**

A: 在数据校验阶段确认重复名称后，提交时设置 `duplicateConfirmed: true` 继续导入同名显示数据。后台存储标识会保持唯一，已有数据不会被覆盖。

**Q: Excel 文件有多个工作表怎么办？**

A: 系统只读取 Excel 文件的第一张工作表。如需导入其他工作表，请将其移至第一张或单独保存为新文件。

### API Reference

详见 API Reference（OpenAPI）。

---

## 5. 数据查询

### 功能简介

数据查询功能支持对矢量数据资源执行属性和空间联合查询，返回 GeoJSON 格式的查询结果，可直接用于地图可视化。

### 使用场景

- 按属性条件筛选矢量数据
- 按空间范围查询数据
- 组合属性和空间条件进行复杂查询
- 获取查询结果用于地图展示或数据分析

### 前置条件

- 用户已登录
- 用户具备 `core.query_data` 和 `core.load_vector_layer` 权限
- 目标数据资源为矢量类型且 `isQueryable` 为 `true`

### 集成流程

```
确定查询目标
   ↓
构建查询条件
   ↓
执行查询
   ↓
处理结果
```

### 实现步骤

#### Step 1: 构建查询条件

查询条件包含属性过滤器和空间过滤器两部分。

```javascript
// JavaScript
const queryBody = {
  // 属性过滤条件（可选）
  attributeFilters: [
    {
      field: "species",           // 字段名
      operator: "eq",             // 操作符: eq/ne/gt/gte/lt/lte/contains/between
      value: "Populus euphratica",
    },
    {
      field: "area_ha",
      operator: "between",        // between 操作符需要 value 和 valueTo
      value: "10",
      valueTo: "100",
    },
  ],
  // 空间过滤条件（可选）
  spatialFilter: {
    mode: "rectangle",            // rectangle/circle/ellipse/polygon
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [87.5, 41.5],
          [88.0, 41.5],
          [88.0, 42.0],
          [87.5, 42.0],
          [87.5, 41.5],
        ],
      ],
    },
  },
  limit: 1000, // 返回记录上限，默认取系统配置
};
```

#### Step 2: 执行查询

```javascript
// JavaScript
const resource = selectedResource;
const queryUrl =
const response = await fetch(`/api/catalog/resources/${resource.id}/query/`, {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": getCookie("csrftoken"),
  },
  body: JSON.stringify(queryBody),
});
const result = await response.json();

console.log("总记录数:", result.totalCount);
console.log("返回记录数:", result.returnedCount);
console.log("GeoJSON:", result.geojson);
```

```python
# Python
resource_id = 1
response = session.post(
    f"{base_url}/catalog/resources/{resource_id}/query/",
    json={
        "attributeFilters": [
            {"field": "species", "operator": "eq", "value": "Populus euphratica"},
        ],
        "spatialFilter": None,
        "limit": 1000,
    },
)
result = response.json()

print(f"总记录数: {result['totalCount']}")
print(f"返回记录数: {result['returnedCount']}")
print(f"GeoJSON: {result['geojson']}")
```

业务库资源使用 `/api/catalog/resources/{resourceId}/query/`，`QueryResponse.resourceId` 固定为数值型资源 ID。

#### Step 3: 处理查询结果

查询结果为标准的 GeoJSON FeatureCollection 格式，可直接用于 Mapbox GL JS 等地图库。

```javascript
// JavaScript - 在地图上展示查询结果
map.addSource("query-result", {
  type: "geojson",
  data: result.geojson,
});

map.addLayer({
  id: "query-result-layer",
  type: "fill",
  source: "query-result",
  paint: {
    "fill-color": "#228B22",
    "fill-opacity": 0.5,
  },
});
```

### 属性过滤操作符

| 操作符 | 说明 | 示例 |
|--------|------|------|
| `eq` | 等于 | `value: "胡杨"` |
| `ne` | 不等于 | `value: "灌木"` |
| `gt` | 大于 | `value: "100"` |
| `gte` | 大于等于 | `value: "100"` |
| `lt` | 小于 | `value: "50"` |
| `lte` | 小于等于 | `value: "50"` |
| `contains` | 包含 | `value: "杨"` |
| `between` | 范围 | `value: "10", valueTo: "100"` |

### 空间过滤模式

| 模式 | 说明 | 几何类型 |
|------|------|----------|
| `rectangle` | 矩形范围 | Polygon |
| `circle` | 圆形范围 | Point + radius |
| `ellipse` | 椭圆范围 | Point + axes |
| `polygon` | 多边形范围 | Polygon |

### 非地理表格查询与分析

`/nongeo` 前端工作台当前仅保留演示界面和本地示例数据，非地理分析后端合同尚未确定。不要实现或调用 `/api/catalog/resources/{id}/nongeo-analytics/`、`/api/catalog/resources/{id}/table-query/` 等临时接口；等字段画像、统计口径、分页/过滤规则和性能边界明确后，再由前端合同代理更新 `docs/openapi.yaml`、mock 示例和生成类型。

### 最佳实践

- **限制查询范围**：使用 `limit` 参数控制返回记录数，避免一次性加载过多数据。
- **组合条件**：结合属性和空间过滤，精确定位所需数据。
- **处理警告**：检查响应中的 `warnings` 字段，了解是否有数据被忽略。
- **字段验证**：查询前可通过资源详情接口确认字段名称和类型。

### FAQ

**Q: 查询返回的数据不完整怎么办？**

A: 检查响应中的 `returnedCount` 和 `totalCount`。如果 `returnedCount < totalCount`，说明达到了查询上限，可以增大 `limit` 参数或缩小查询范围。

**Q: 为什么查询结果中没有某些数据？**

A: 后端会自动忽略无几何、经度越界（-180到180之外）、纬度越界（-90到90之外）的数据。检查响应中的 `warnings` 字段了解详情。

**Q: 如何查询非矢量数据？**

A: 矢量查询接口返回 GeoJSON，仅支持空间或矢量属性查询。非地理表格/基因分析接口设计尚未确定，当前 `/nongeo` 只展示前端 demo，不提供后端查询合同。

### API Reference

详见 API Reference（OpenAPI）。

---

## 6. 数据导出

### 功能简介

数据导出功能支持将平台中的数据资源导出为标准 GIS 格式，矢量图层可选择 GeoJSON 或 Shapefile，栅格图层导出为 GeoTIFF，最终打包为 ZIP 文件下载。导出接口会读取完整导出请求体，不受 Django `DATA_UPLOAD_MAX_MEMORY_SIZE` 上传内存限制影响。

### 使用场景

- 导出查询结果用于本地分析
- 导出数据供其他 GIS 软件使用
- 批量导出多个图层数据
- 导出带有坐标系转换的数据

### 前置条件

- 用户已登录
- 用户具备 `catalog.export_dataresource` 权限

### 集成流程

```
选择导出数据
   ↓
配置导出参数
   ↓
执行导出（同步或异步）
   ↓
下载文件
```

### 实现步骤

#### Step 1: 同步导出

适用于小规模数据导出，直接返回 ZIP 文件。

```javascript
// JavaScript
const exportBody = {
  epsg: 4326,           // 目标坐标系，默认 4326
  reproject: true,      // 是否重投影
  clip: false,          // 是否裁剪
  format: "shapefile",  // 矢量导出格式：shapefile 或 geojson
  items: [
    {
      layerType: "vector",
      name: "胡杨林分布",
      resourceId: 1,
      geojson: null,    // 可传入查询结果进行筛选导出
    },
    {
      layerType: "raster",
      name: "DEM高程",
      resourceId: 5,
      datasetId: 1,
    },
  ],
};

const response = await fetch("/api/catalog/export/", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": getCookie("csrftoken"),
  },
  body: JSON.stringify(exportBody),
});

// 处理文件下载
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "export.zip";
a.click();
```

```python
# Python
response = session.post(
    f"{base_url}/catalog/export/",
    json={
        "epsg": 4326,
        "reproject": True,
        "clip": False,
        "format": "geojson",
        "items": [
            {
                "layerType": "vector",
                "name": "胡杨林分布",
                "resourceId": 1,
            },
        ],
    },
)

# 保存文件
with open("export.zip", "wb") as f:
    f.write(response.content)
```

#### Step 2: 异步导出

适用于大规模数据导出，提交任务后轮询状态。

```javascript
// JavaScript
const response = await fetch("/api/catalog/export/async/", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": getCookie("csrftoken"),
  },
  body: JSON.stringify(exportBody),
});
const job = await response.json();

// 轮询任务状态
const pollInterval = setInterval(async () => {
  const statusRes = await fetch(`/api/raster/jobs/${job.id}/`, {
    credentials: "include",
  });
  const status = await statusRes.json();

  if (status.status === "ready") {
    clearInterval(pollInterval);
    // 下载文件
    const downloadUrl = status.result.downloadUrl;
    window.open(downloadUrl);
  } else if (status.status === "failed") {
    clearInterval(pollInterval);
    console.error("导出失败:", status.error);
  }
}, 1000);
```

```python
# Python
import time

response = session.post(f"{base_url}/catalog/export/async/", json=export_body)
job = response.json()

# 轮询任务状态
while True:
    status = session.get(f"{base_url}/raster/jobs/{job['id']}/").json()
    if status["status"] == "ready":
        download_url = status["result"]["downloadUrl"]
        # 下载文件
        file_response = session.get(f"{base_url}{download_url}")
        with open("export.zip", "wb") as f:
            f.write(file_response.content)
        break
    elif status["status"] == "failed":
        print(f"导出失败: {status['error']}")
        break
    time.sleep(1)
```

### 最佳实践

- **选择合适的导出方式**：小数据量使用同步导出，大数据量使用异步导出。
- **坐标系转换**：导出时指定目标 EPSG 代码，系统会自动进行坐标系转换。
- **筛选导出**：结合查询结果，只导出需要的数据子集。
- **异步轮询**：异步导出时，建议设置合理的轮询间隔（如 1 秒），避免过于频繁的请求。

### FAQ

**Q: 同步导出和异步导出有什么区别？**

A: 同步导出直接返回文件，适用于小数据量；异步导出返回任务 ID，通过轮询获取结果，适用于大数据量。

**Q: 导出的文件格式是什么？**

A: 矢量数据可导出为 Shapefile 或 GeoJSON，栅格数据导出为 GeoTIFF，均打包为 ZIP 文件。

**Q: 如何导出查询结果？**

A: 在导出请求的 `items` 中传入查询返回的 `geojson` 数据，系统会只导出这些数据。

### API Reference

详见 API Reference（OpenAPI）。

---

## 7. 地图图层

### 功能简介

地图图层功能用于管理和获取平台中的地图图层信息，支持矢量图层和栅格图层。图层是数据资源在地图上的可视化表现形式。

`GET /api/layers/` 只返回当前用户可见的启用图层。图层自身可见且关联数据资源也对当前用户可见时才会返回；如果关联数据资源被角色访问范围隐藏，即使图层自身未设置访问角色也不会出现在列表中。目录接口 `/api/catalog/directories/` 返回目录下资源时同样会按当前用户的数据资源可见范围裁剪。

### 使用场景

- 构建地图图层列表
- 加载矢量图层要素到地图
- 管理图层的显示状态和样式

### 前置条件

- 用户已登录
- 用户具备 `core.browse_data` 权限（浏览图层列表）
- 用户具备 `core.load_vector_layer` 权限（加载矢量要素）

### 集成流程

```
获取图层列表
   ↓
加载图层数据
   ↓
渲染到地图
```

### 实现步骤

#### Step 1: 获取图层列表

```javascript
// JavaScript
const response = await fetch("/api/layers/", { credentials: "include" });
const { items } = await response.json();

items.forEach((layer) => {
  console.log(`图层: ${layer.name}`);
  console.log(`  类型: ${layer.layerType}`);
  if ("defaultVisible" in layer) {
    console.log(`  默认可见: ${layer.defaultVisible}`);
    console.log(`  默认透明度: ${layer.defaultOpacity}%`);
  } else {
    console.log(`  要素数: ${layer.featureCount}`);
    console.log(`  几何类型: ${layer.geometryType}`);
  }
});
```

```python
# Python
response = session.get(f"{base_url}/layers/")
layers = response.json()["items"]

for layer in layers:
    print(f"图层: {layer['name']}")
    print(f"  类型: {layer['layerType']}")
    if "defaultVisible" in layer:
        print(f"  默认可见: {layer['defaultVisible']}")
    else:
        print(f"  要素数: {layer['featureCount']}")
```

#### Step 2: 加载矢量图层要素

```javascript
// JavaScript
const layerName = "survey_points_2026";
const response = await fetch(
  `/api/layers/${encodeURIComponent(layerName)}/features/?limit=10000`,
  {
    credentials: "include",
  },
);
const geojson = await response.json();

// 添加到地图
map.addSource(`layer-${layerName}`, {
  type: "geojson",
  data: geojson,
});

map.addLayer({
  id: `layer-${layerName}`,
  type: "fill",
  source: `layer-${layerName}`,
  paint: {
    "fill-color": "#228B22",
    "fill-opacity": 0.6,
  },
});
```

### 图层类型

**矢量图层（Vector）**：来自业务库 `MapLayer`，关联正式 `DataResource`，属性查询和空间查询通过 `/api/catalog/resources/{resourceId}/...` 完成。

**栅格图层（Raster）**：来自业务库 `MapLayer`，包含栅格数据，通过瓦片服务进行渲染。

### 符号化配置

图层的符号化配置存储在 `symbolization` 字段中，包含：

- `fillColor`：填充颜色
- `fillOpacity`：填充透明度
- `strokeColor`：边框颜色
- `strokeWidth`：边框宽度
- `cluster.enabled`：点图层是否启用 Mapbox source 聚合，默认 `false`
- `cluster.maxZoom`：聚合生效的最大瓦片缩放级别，默认 `12`
- `cluster.radius`：聚合半径，默认 `50`

### 最佳实践

- **按需加载**：只加载用户可见范围内的图层，减少数据传输量。
- **透明度控制**：通过图层透明度配置，实现多图层叠加显示。
- **错误处理**：加载图层时注意处理权限不足（403）和图层不存在（404）的情况。
- **工作台保存边界**：图层树、排序、显隐和符号化的实时保存只写入浏览器本地 IndexedDB，防止刷新或切换界面后清空；服务器端仅在用户显式“保存为工程”或“保存为专题”时写入。

### 工程和专题快照

工程和专题是当前用户私有的服务器端轻量工作台快照，用于显式保存当前图层组、顺序、查询条件、空间范围、资源引用、可视化方案、栅格渲染引用元数据和地图视图。服务器端快照不能保存原始 GeoJSON 要素集合、属性表行或查询结果数据本体；矢量图层恢复时应按保存的资源引用和查询条件重新查询。

关键接口：

- `GET /api/catalog/workspaces/?kind=project|topic`：列出当前用户保存的工程或专题，需要 `catalog.view_workspacescene`；不传 `kind` 返回两类快照。
- `POST /api/catalog/workspaces/`：创建工程或专题，需要 `catalog.add_workspacescene`，提交 `kind`、`name`、`description` 和 `snapshot`。
- `GET /api/catalog/workspaces/{id}/`：读取当前用户拥有的单个工程或专题，需要 `catalog.view_workspacescene`。
- `POST /api/catalog/workspaces/{id}/`：更新工程/专题字段需要 `catalog.change_workspacescene`；提交 `{"action":"delete"}` 删除需要 `catalog.delete_workspacescene`。

`snapshot` 是前端工作台轻量 JSON 对象。后端做所有权、JSON 对象、请求体大小和嵌入原始数据检查；出现 `geojson` 或 `FeatureCollection.features` 等原始要素集合时返回 400，超大请求体返回 413。当前批次不包含共享、发布或角色访问控制。

### FAQ

**Q: 矢量图层和栅格图层有什么区别？**

A: 矢量图层包含离散的几何要素（点、线、面），支持属性查询；栅格图层包含连续的像素数据，通过瓦片服务渲染。

**Q: 如何判断图层是否可查询？**

A: 检查图层关联的数据资源的 `isQueryable` 字段。

### API Reference

详见 API Reference（OpenAPI）。

---

## 8. 栅格数据管理

### 功能简介

栅格数据管理功能用于导入、处理和渲染栅格数据（如 DEM、遥感影像等）。系统会自动将栅格文件预处理为 COG（Cloud Optimized GeoTIFF）格式，并提供瓦片服务。

### 使用场景

- 导入新的栅格数据文件
- 扫描未处理的栅格文件
- 渲染栅格数据为地图瓦片
- 自定义栅格符号化规则

### 前置条件

- 用户已登录
- 用户具备 `raster.manage_raster_dataset` 或 `catalog.change_dataresource` 权限
- 栅格文件可通过后台页面上传，或已放置在研究数据目录中供脚本按路径导入

### 集成流程

```
导入/扫描栅格文件
   ↓
等待预处理完成
   ↓
注册渲染样式
   ↓
加载瓦片到地图
```

### 实现步骤

#### Step 1: 导入栅格文件

支持两种导入方式。后台管理页面使用 `multipart/form-data` 上传本地文件；服务端保存到科研数据根目录 `raster/original/uploaded/` 后立即提交异步预处理任务。运维脚本也可以继续传入研究数据目录中已有栅格文件的 `sourcePath`。两种方式都通过 `/api/raster/jobs/{job_id}/` 轮询 `progressPercent`、`messages` 和最终状态。

`name` 始终是前端显示的数据名称，应写入 `RasterDataset.name`、`DataResource.name` 和 `MapLayer.name`。后端为避免文件冲突将浏览器上传源文件保存为 `uploaded/<uuid><suffix>`，该文件名只属于 `source_relative_path`、`processed_relative_path`、`code` 等后台存储标识，不包含原始文件名，也不得展示给用户；如果 `name` 为空，浏览器上传栅格默认回退到原始上传文件名。

栅格上传必须在前后端同时校验限制。前端使用系统启动配置 `limits.uploadMaxMb` 检查文件大小，并使用 `limits.maxRasterSidePixels` 和 `geotiff.js` 读取本地栅格首图像尺寸；文件大小超过配置上限、宽或高超过配置的单边像素上限、或无法读取尺寸时，不提交上传。后端仍是最终校验边界：上传文件大小超过 `application.limits.upload_max_mb`、源栅格宽或高超过 `application.limits.max_raster_side_pixels`、或无法读取栅格尺寸时，返回 `400 {"detail":"..."}`，不会创建异步任务；按 `sourcePath` 导入和目录扫描同样复用像素尺寸限制。

```javascript
// JavaScript - 浏览器上传本地栅格文件
const formData = new FormData();
formData.append("file", fileInput.files[0]);
formData.append("name", "2026 胡杨林遥感影像");

const response = await fetch("/api/raster/import/", {
  method: "POST",
  credentials: "include",
  headers: {
    "X-CSRFToken": getCookie("csrftoken"),
  },
  body: formData,
});
const job = await response.json();
console.log("任务ID:", job.id);
```

```javascript
// JavaScript - 导入研究数据目录中已有文件
const response = await fetch("/api/raster/import/", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": getCookie("csrftoken"),
  },
  body: JSON.stringify({
    sourcePath: "raw/new_dem.tif",  // 相对于研究数据根目录的路径
    name: "新 DEM 数据",
    async: true,                    // 推荐使用异步模式
  }),
});
const job = await response.json();
console.log("任务ID:", job.id);
```

```python
# Python - 导入研究数据目录中已有文件
response = session.post(f"{base_url}/raster/import/", json={
    "sourcePath": "raw/new_dem.tif",
    "name": "新 DEM 数据",
    "async": True,
})
job = response.json()
print(f"任务ID: {job['id']}")
```

#### Step 2: 扫描栅格源目录

扫描研究数据目录中的未处理栅格文件，自动创建数据集。

```javascript
// JavaScript
const response = await fetch("/api/raster/scan/", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": getCookie("csrftoken"),
  },
  body: JSON.stringify({}),
});
const job = await response.json();
```

```python
# Python
response = session.post(f"{base_url}/raster/scan/", json={})
job = response.json()
```

#### Step 3: 注册渲染样式

为栅格图层注册瓦片样式，获取 XYZ 瓦片 URL。

```javascript
// JavaScript - 使用默认样式
const response = await fetch("/api/raster/render/", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": getCookie("csrftoken"),
  },
  body: JSON.stringify({
    layerId: 3,
    rulesMode: "default",
  }),
});
const renderResult = await response.json();

// 使用瓦片 URL
const tileUrl = renderResult.tileUrl;
// 例如: /api/raster/tiles/1/a1b2c3d4/{z}/{x}/{y}.png
```

```python
# Python
response = session.post(f"{base_url}/raster/render/", json={
    "layerId": 3,
    "rulesMode": "default",
})
render_result = response.json()
tile_url = render_result["tileUrl"]
```

#### Step 4: 在地图上加载瓦片

```javascript
// JavaScript
map.addSource("raster-tiles", {
  type: "raster",
  tiles: [`${baseUrl}${renderResult.tileUrl}`],
  tileSize: 256,
  bounds: renderResult.bounds4326,
});

map.addLayer({
  id: "raster-layer",
  type: "raster",
  source: "raster-tiles",
  paint: {
    "raster-opacity": 0.8,
  },
});
```

前端加载 XYZ 栅格源时必须传入 `renderResult.bounds4326` 作为 Mapbox source 的 `bounds`，避免在影像范围外反复请求瓦片。后端也会对不在栅格空间范围内的瓦片请求返回 `204 No Content`；样式哈希过期或不存在仍返回 `404`。

### 自定义符号化

对于需要自定义渲染规则的场景，可以使用唯一值分类符号化。

```javascript
// JavaScript - 获取唯一值列表
const uniqueValuesRes = await fetch("/api/raster/unique-values/", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": getCookie("csrftoken"),
  },
  body: JSON.stringify({
    datasetId: 1,
    band: 1,
  }),
});
const { items } = await uniqueValuesRes.json();

// items 包含每个唯一值的默认颜色和标签
// 可以在此基础上自定义颜色
```

### 渲染模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `grayscale` | 灰度渲染 | 连续数据（如 DEM） |
| `unique` | 唯一值分类 | 分类数据（如土地利用） |

### 最佳实践

- **异步处理**：栅格导入和渲染建议使用异步模式，避免请求超时。
- **COG 格式**：系统会自动转换为 COG 格式，优化瓦片加载性能。
- **样式缓存**：相同样式规则会生成相同的 `styleHash`，可以复用瓦片 URL。
- **进度监控**：异步任务可以通过轮询接口获取进度信息，及时反馈给用户。

### FAQ

**Q: 栅格文件支持哪些格式？**

A: 系统支持 GDAL 能够读取的常见栅格格式，如 GeoTIFF、IMG 等。建议使用 GeoTIFF 格式以获得最佳兼容性。

**Q: 渲染状态显示 "failed" 怎么办？**

A: 检查任务的 `error` 字段了解失败原因。常见原因包括文件损坏、坐标系信息缺失等。

**Q: 如何更新栅格的渲染样式？**

A: 重新调用渲染接口并传入新的规则，系统会生成新的 `styleHash` 和瓦片 URL。

### API Reference

详见 API Reference（OpenAPI）。

---

## 9. 异步任务管理

### 功能简介

异步任务管理功能用于监控和管理平台中的长时间运行操作，如栅格导入、扫描、渲染和导出等。

### 使用场景

- 监控异步任务执行进度
- 获取任务执行结果
- 处理任务失败情况

### 前置条件

- 用户已登录
- 已提交异步任务（栅格导入、扫描、渲染或导出）

### 集成流程

```
提交异步任务
   ↓
获取任务 ID
   ↓
轮询任务状态
   ↓
处理任务结果
```

### 实现步骤

#### Step 1: 提交异步任务

异步任务通过相应功能的接口提交，返回统一的任务对象。

```javascript
// JavaScript - 示例：提交栅格渲染任务
const response = await fetch("/api/raster/render/async/", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": getCookie("csrftoken"),
  },
  body: JSON.stringify({
    layerId: 3,
    rulesMode: "default",
  }),
});
const job = await response.json();
console.log("任务ID:", job.id);
console.log("任务类型:", job.kind);
console.log("初始状态:", job.status);
```

#### Step 2: 轮询任务状态

```javascript
// JavaScript
async function pollJobStatus(jobId, onComplete, onError) {
  const pollInterval = setInterval(async () => {
    const response = await fetch(`/api/raster/jobs/${jobId}/`, {
      credentials: "include",
    });
    const status = await response.json();

    // 更新进度
    console.log(`进度: ${status.progressPercent}%`);
    console.log("消息:", status.messages);

    if (status.status === "ready") {
      clearInterval(pollInterval);
      onComplete(status.result);
    } else if (status.status === "failed") {
      clearInterval(pollInterval);
      onError(status.error);
    }
  }, 1000); // 每秒轮询一次

  return pollInterval;
}

// 使用示例
pollJobStatus(
  job.id,
  (result) => {
    console.log("任务完成:", result);
  },
  (error) => {
    console.error("任务失败:", error);
  }
);
```

```python
# Python
import time

def poll_job_status(job_id, timeout=300):
    start_time = time.time()
    while time.time() - start_time < timeout:
        response = session.get(f"{base_url}/raster/jobs/{job_id}/")
        status = response.json()

        print(f"进度: {status['progressPercent']}%")
        print(f"消息: {status['messages']}")

        if status["status"] == "ready":
            return status["result"]
        elif status["status"] == "failed":
            raise Exception(f"任务失败: {status['error']}")

        time.sleep(1)

    raise Exception("任务超时")

# 使用示例
try:
    result = poll_job_status(job["id"])
    print(f"任务完成: {result}")
except Exception as e:
    print(f"错误: {e}")
```

### 任务状态

| 状态 | 说明 |
|------|------|
| `queued` | 排队中 |
| `running` | 执行中 |
| `ready` | 已完成 |
| `failed` | 已失败 |

### 任务类型

| 类型 | 说明 | 结果格式 |
|------|------|----------|
| `import` | 栅格导入 | `RasterDataset` 对象 |
| `scan` | 栅格扫描 | `{ items: RasterDataset[], count: int }` |
| `render` | 栅格渲染 | `RasterRenderResult` 对象 |
| `export` | 数据导出 | `{ filename: string, downloadUrl: string }` |

### 最佳实践

- **合理轮询**：建议轮询间隔为 1-2 秒，避免过于频繁的请求。
- **超时处理**：设置合理的超时时间，避免无限等待。
- **进度展示**：利用 `progressPercent` 和 `messages` 字段为用户提供进度反馈。
- **错误处理**：妥善处理任务失败情况，展示错误信息并提供重试选项。

### FAQ

**Q: 任务长时间停留在 "queued" 状态怎么办？**

A: 可能是系统繁忙，请耐心等待。如果持续较长时间，可以联系管理员检查系统状态。

**Q: 任务失败后如何重试？**

A: 重新提交相同的任务请求即可。

**Q: 任务 ID 会过期吗？**

A: 任务记录会保留一段时间，建议在任务完成后及时获取结果。

### API Reference

详见 API Reference（OpenAPI）。

---

## 10. 搜索

### 功能简介

搜索功能支持全局搜索数据资源。

### 使用场景

- 快速查找数据资源

### 前置条件

- 用户已登录
- 用户具备 `core.browse_data` 权限

### 实现步骤

#### 全局搜索

```javascript
// JavaScript
const query = "胡杨";
const response = await fetch(`/api/search/?q=${encodeURIComponent(query)}`, {
  credentials: "include",
});
const { resources } = await response.json();

console.log("找到数据资源:", resources.length, "个");
// resources 只包含正式登记的数据资源
```

```python
# Python
query = "胡杨"
response = session.get(f"{base_url}/search/", params={"q": query})
result = response.json()

print(f"找到数据资源: {len(result['resources'])} 个")
```

### 最佳实践

- **搜索建议**：在用户输入时提供搜索建议，提升用户体验。
- **结果展示**：展示业务数据资源的名称、类型、来源和更新时间，便于用户快速定位。
- **空结果处理**：搜索关键词为空时返回空结果，前端应妥善处理。

### FAQ

**Q: 搜索支持哪些字段？**

A: 搜索会匹配数据资源的名称、描述、来源等字段。

**Q: 搜索结果如何排序？**

A: 搜索结果按相关性排序，与关键词匹配度越高的结果越靠前。

### API Reference

详见 API Reference（OpenAPI）。

---

## 11. 后台管理

### 功能简介

后台管理位于 `/admin/`，前端基于 Ant Design Pro 组件实现，提供用户设置、日志管理、系统设置、认证授权和数据管理能力。

### 使用场景

- 管理用户账号和权限
- 配置系统参数
- 管理数据资源和目录
- 查看日志管理

### 前置条件

- 用户已登录

### 管理功能

| 功能模块 | 说明 |
|----------|------|
| 用户设置 | 用户可维护用户名、头像、邮箱、部门等个人信息，查看已授予权限，并主动关闭或重新开启已授予权限 |
| Dashboard | 后台通过 `/api/admin/dashboard/?period=day\|week\|month` 查询数据资源、图层、栅格、用户数量和指定周期活跃用户；通过 `/api/admin/dashboard/server/` 查询 Windows、Linux、macOS 的 CPU、内存、硬盘监控快照。所有登录用户都可进入 Dashboard，数据统计卡片由 `core.view_dashboard_*_card` 权限独立控制，服务器信息整段由 `core.view_dashboard_system_card` 控制；未授权内容不会出现在接口响应和页面中，前端每 5 秒刷新服务器信息 |
| 日志管理 | 后台通过 `/api/admin/operation-logs/` 查询真实审计日志，支持筛选、分页和 CSV 导出；所有登录用户始终可查看自己的操作日志，更大日志范围由所有用户、指定角色日志范围权限控制；具备 `core.view_system_logs` 的用户可通过 `/api/admin/system-logs/` 查看业务数据根目录 `logs/` 下的后台运行日志文件尾部内容。操作日志只记录用户主动行为，目录扫描、启动扫描、后台数据发现和任务内部进度进入系统日志或任务日志 |
| 系统设置 | 新版后台只展示用户可配置的 application 设置，并将修改直接写入启动时传入的源 TOML 配置文件 |
| 认证授权 | 后台提供用户创建、启用停用、删除、重置密码、角色分配、角色增删和功能权限配置；非超级管理员主体不会在用户、角色、日志角色等认证授权接口中看到超级管理员账号或角色；管理员创建用户不受自助注册开关影响 |
| 数据管理 / 存量数据 | 后台通过 `/api/admin/data/resources/` 分页查询当前用户可见或本人上传的已登记数据资源，支持快速检索、高级筛选、内容组别、启用/禁用、默认可视化方案保存、访问角色配置、删除确认以及 CSV/Excel 清单导出；超级管理员可查看和维护全部资源；可手动配置的访问角色列表不会返回超级管理员角色，后端仍强制保留该访问范围；上传者可进入并修改自己上传数据的可见范围 |
| 数据管理 / 数据导入 | 后台提供数据导入，按文件选择、导入配置、数据可见范围、数据校验、数据预览和字段元数据维护完成入库；入口由 `catalog.add_dataresource` 控制 |
| 数据管理 / 工程专题 | 后台通过 `/api/admin/workspaces/` 分页查询工程和专题，支持快速检索、工程/专题筛选、启用/禁用、基础信息修改、访问角色配置和删除确认；入口由 `catalog.view_workspacescene`、`catalog.change_workspacescene` 或 `catalog.delete_workspacescene` 控制 |

### 存量数据管理

存量数据管理入口为 `/admin/data/inventory`。具备 `catalog.view_dataresource`、`catalog.change_dataresource`、`catalog.delete_dataresource` 或 `catalog.export_dataresource` 的用户可以查看当前用户可见或本人上传且符合筛选条件的存量数据；超级管理员角色可查看全部存量数据；仅具备 `catalog.add_dataresource` 的上传者可以进入该页查看自己上传的数据并修改其可见范围。列表接口返回启用和禁用资源，并包含 `sizeBytes`、`itemCount`、结构化 `uploader`、持久化内容组别 `inventoryGroups`、资源所属组别 `inventoryGroupId` 和当前用户是否可修改可见范围的 `canManageAccess`；可手动配置的访问角色列表不会返回超级管理员角色，后台仍强制保留该访问范围；常规业务目录 `/api/catalog/resources/` 仍只返回启用且用户可访问的数据资源，因此禁用资源会从业务查询、加载和搜索流程中隐藏，但保留在系统中。

关键接口：

- `GET /api/admin/data/resources/`：按关键词、数据类型、状态、来源、提供单位和日期范围筛选当前用户可见或本人上传的存量数据，返回当前主体可见的数据访问角色、上传用户、数据大小、条目数、`inventoryGroups`、资源 `inventoryGroupId` 和 `canManageAccess`。超级管理员可查看全部资源；仅具备 `catalog.add_dataresource` 时只返回当前用户上传的数据资源。若资源维护人是当前主体不可见的超级管理员用户，`maintainer` 返回空字符串且 `uploader` 返回 `null`。
- `POST /api/admin/data/resource-groups/`：新建存量数据内容组别，需要 `catalog.change_dataresource`。组别只用于管理表格分组，不影响访问权限。
- `POST /api/admin/data/resource-groups/{groupId}/`：通过 `action=update` 改名或 `action=delete` 删除组别，需要 `catalog.change_dataresource`。删除组别时，后端将组内资源的 `inventoryGroupId` 置为 `null`，这些数据回到默认分组，数据本身不会被删除。
- `POST /api/admin/data/resources/{id}/`：通过 `action` 执行 `setStatus`、`saveVisualization`、`updateAccess`、`updateInventoryGroup`、`update` 或 `delete`。目标数据必须对当前用户可见或由当前用户上传；不可见数据按不存在处理；超级管理员不受对象可见范围限制。上传者本人或具备 `catalog.change_dataresource` 的用户可执行 `updateAccess`；启停、内容组别、默认可视化和普通编辑需要 `catalog.change_dataresource`；删除需要 `catalog.delete_dataresource` 并提交与数据名称完全一致的 `confirmationName`。
- `GET /api/admin/data/resources/export/?format=csv|xlsx`：按当前筛选条件导出当前用户可见或本人上传的存量数据清单，需要 `catalog.export_dataresource`；超级管理员可导出全部资源。

数据可见范围：

- 用户导入数据时，上传者本人强制可见，超级管理员角色强制可见。
- `accessGroupIds` 表示额外可见角色；后端会自动补齐超级管理员角色。访问角色列表不返回超级管理员角色，所有用户都不能选择或取消后台强制可见规则。
- 选择游客角色表示无需账号即可通过游客会话浏览和查询该数据，前端必须给出醒目提示。

默认可视化方案保存在 `DataResource.default_visualization`。空间资源存在或创建关联 `MapLayer` 时，会同步默认图层名称、默认显隐、默认透明度、矢量符号化和栅格规则。对栅格数据只保存规则和图层配置，栅格符号化仍由后端渲染流程完成，不在前端执行。

敏感操作审计：

- 启用/禁用、内容组别新增/改名/删除、资源组别移动、默认可视化保存、访问权限配置、删除和导出都会写入 `OperationLog`，模块为“数据管理”。
- 删除用户导入的矢量/表格资源时，接口会清理对应 GeoPackage 图层或 SQLite 表；栅格等可能复用的原始文件只删除资源登记和关联图层，避免误删共享研究数据。

### 工程专题管理

工程专题管理入口位于 `/resources/manage/projects` 和 `/resources/manage/topics`。页面复用同一前端管理组件，提供列表筛选、状态控制、信息编辑、访问范围配置和删除确认。工程专题使用 `active/inactive` 控制是否进入普通工作台检索和加载入口。

关键接口：

- `GET /api/admin/workspaces/`：按关键词、类型、状态和分页参数查询工程专题，返回 `accessGroups`、`owner` 和 `canManageAccess`。
- `POST /api/admin/workspaces/{workspaceId}/`：通过 `action` 执行 `setStatus`、`updateAccess`、`update` 或 `delete`。拥有者本人或具备 `catalog.change_workspacescene` 的用户可执行 `updateAccess`；启停和信息修改需要 `catalog.change_workspacescene`，删除需要 `catalog.delete_workspacescene`。删除必须提交与工程专题名称完全一致的 `confirmationName`。

工程专题访问范围与存量数据一致：超级管理员角色由后端强制可见，选择游客角色表示无需账号即可通过游客会话访问。普通业务搜索和工作台加载接口必须继续按对象访问范围过滤，前端菜单和按钮控制只作为可用性提示，不能替代后端权限校验。

工程和专题的启停、信息修改、访问范围配置和删除都应写入 `OperationLog`，模块可使用“工程管理”“专题管理”或统一“数据管理”，动作和说明使用中文。

### 访问方式

通过浏览器访问 `/admin/` 进入管理后台。

### 配置文件生命周期

后端启动和管理命令通过 `--config /path/to/app.toml` 参数接收 TOML 配置，并将该文件作为唯一持久化配置来源。后台设置页面直接修改源配置文件。`django_secret_key` 由后端自动生成并写入业务数据目录的 `database/.secret_key`。

内置账号和内置角色不是部署运行参数，集中维护在 `backend/apps/core/configuration/builtins.py`。如需调整 `超级管理员`、`普通用户`、`游客`、`guest`、初始管理员环境变量名或默认功能权限集合，应修改该文件并补充权限初始化测试；业务视图和前端页面不得重复硬编码这些名称。

### 权限与密码管理

- 超级管理员角色由系统维护，默认拥有全部平台功能权限；角色不可删除或重命名，初始化的 `admin` 用户也不能从该角色移除。`GET /api/groups/` 的 `lockedPermissions` 返回该角色必须保留的关键功能权限。
- 普通用户角色由系统初始化维护，默认授予全部科研数据相关权限；默认权限只在首次创建时应用，后续权限允许在后台调整，角色不能删除或重命名。
- 游客角色由系统初始化维护，默认不授予任何功能权限；默认权限只在首次创建时应用，后续权限允许在后台调整，角色不能删除或重命名。专用游客账号 `guest` 由系统维护，只能通过 `POST /api/auth/guest-login/` 建立会话，不能被删除、停用、重置密码、改角色或单独授予直授权限。
- 后台认证授权入口由 `core.manage_auth` 控制；“新建用户”还需要 `core.create_user`，创建角色和配置角色/单用户功能权限还需要 `core.manage_feature_permissions`。仅具备认证授权但不具备新建用户权限的账号不能调用 `POST /api/users/` 创建用户；调用 `POST /api/users/` 创建用户时 `groupIds` 必填且至少包含一个非超级管理员角色。启用/停用用户通过 `POST /api/users/{userId}/` 写入 `isActive`，删除用户通过同一接口提交 `action=delete` 完成；角色成员通过 `POST /api/users/{userId}/groups/` 更新，但当前登录用户、游客用户和超级管理员用户的角色不能在认证授权页修改；单用户功能权限和指定日志角色通过 `POST /api/users/{userId}/permissions/` 写入 `directPermissions`、`disabledPermissions`、`operationLogGroupIds`，但当前登录用户不能在认证授权页修改自己的权限；角色通过 `POST /api/groups/{groupId}/` 更新或提交 `action=delete` 删除；当前登录用户、游客用户和初始化管理员不能被停用或删除。重置密码通过 `POST /api/users/{userId}/password/reset/` 生成随机密码，密码规则与后台创建用户一致，`generatedPassword` 仅在响应中返回一次，当前登录用户和游客用户不能重置密码。
- Dashboard 对所有登录用户开放；数据资源、图层数、栅格数量、用户信息和活跃用户卡片分别由 `core.view_dashboard_*_card` 权限独立控制，服务器信息整段由 `core.view_dashboard_system_card` 控制，接口只返回已授权内容。数据概览拆分为 `ownUploads` 与 `visibleResources` 两个分组：`ownUploads` 仅统计当前用户上传的数据，登录用户无需额外功能权限即可查看；`visibleResources` 按数据可见范围和上传者本人规则裁剪后统计当前用户可见的数据，仅具备 `core.view_data_overview` 权限时返回。每个分组都包含资源总数、启用资源数、总大小、总条目数和按数据类型聚合。兼容旧版的系统总量字段也仅随 `core.view_data_overview` 返回。超级管理员在具备该权限时额外获得按上传用户聚合的资源数、大小和条目数。用户信息卡返回系统用户总数、启用账号数、停用账号数和角色数量。活跃用户定义为统计周期内存在成功登录日志（`module=auth`、`action=login`、`status=success`）的去重用户，周期支持日、周、月。
- 系统设置由 `core.manage_system_settings` 控制。`GET /api/admin/operation-logs/` 对所有登录用户开放，并始终返回当前用户自己的操作日志；`core.view_all_operation_logs` 可查看非超级管理员主体产生的所有用户日志，`core.view_group_operation_logs` 可查看当前用户 `operationLogGroupIds` 配置的可见角色成员日志。非超级管理员主体不会看到超级管理员用户产生的日志，也不能将超级管理员角色配置为日志角色。`userId` 和 `operator` 筛选只在已授权范围内生效，不能扩大可见范围。操作日志只记录登录退出、账号权限维护、数据/工程/专题的增删查改、导入导出、渲染配置和系统配置等用户主动行为；目录扫描、启动扫描、后台数据发现和任务内部进度不写入 `OperationLog`。数据资源、工程/专题相关日志必须写入结构化目标字段：数据资源使用 `targetType=data_resource` 和 `DataResource.id/code/name`，工程/专题使用 `targetType=workspace_scene` 和 `WorkspaceScene.id/kind/name`；删除后仍保留删除前的目标 ID 和名称。日志接口支持 `targetType` 与 `targetId` 精确筛选，`keyword` 也会匹配目标类型、编码和名称。`GET /api/admin/system-logs/?file=application.log&lines=500` 读取业务数据根目录 `logs/` 下的后台日志文件列表和指定文件尾部内容，由 `core.view_system_logs` 控制，只允许按文件名访问 `.log` 与轮转 `.log.N` 文件，不返回服务器绝对路径。
- 当前用户可通过 `POST /api/admin/profile/password/` 修改密码，通过 `POST /api/admin/profile/permissions/` 更新主动关闭的已授予权限。修改密码接口会校验当前密码、新密码至少 6 位和确认密码，并将成功或失败写入操作日志。头像通过 `POST /api/admin/profile/avatar/` 上传 JPG/PNG 文件并压缩入库，用户资料中的 `avatarUrl` 指向 `GET /api/users/{userId}/avatar/` 返回的图片资源。

### 最佳实践

- **权限最小化**：只授予用户必要的权限，避免权限滥用。
- **定期审计**：定期查看操作日志，监控系统使用情况。
- **数据备份**：定期备份数据库和重要数据文件。

### FAQ

**Q: 如何创建新的管理员账号？**

A: 使用初始化生成的 `admin` 登录后，可在新版后台“认证授权 / 用户管理”创建账号并分配具备对应管理功能权限的角色。`admin` 是普通用户，完整功能来自 `超级管理员` 角色权限。

**Q: 如何配置用户的数据访问权限？**

A: 在角色管理中，设置角色的 "Data access groups" 关联，然后将用户添加到相应角色。

### API Reference

后台接口详见 OpenAPI 中“管理后台”标签。

---

## 12. 最佳实践

### 认证与安全

- **CSRF 保护**：所有写操作必须携带 CSRF Token，从 Cookie 中读取 `csrftoken` 值。
- **会话管理**：使用 `remember` 参数控制会话持久性，敏感操作建议使用非持久会话。
- **权限检查**：在执行操作前检查用户权限，避免不必要的 API 调用。
- **错误处理**：妥善处理 401（未认证）和 403（权限不足）响应。

### 前端 API 契约

- **先改 OpenAPI**：新增或修改接口时，先更新 `docs/openapi.yaml`，再实现后端和前端调用。
- **使用 Hey API SDK**：前端业务代码通过 `frontend/src/api/client.ts` 暴露的 `api` 方法访问后端，不直接手写 `fetch("/api/...")`。
- **同步类型**：OpenAPI 变更后运行 `cd frontend && pnpm run generate:api`，提交前运行 `pnpm run check:api`。
- **查阅文档**：运行 `pnpm run api:docs` 生成 Redoc HTML 文档，运行 `pnpm run api:bundle` 生成单文件 OpenAPI bundle。

### 数据导入

- **预检先行**：在正式导入前，务必先调用预检接口了解文件结构。
- **数据校验**：在导入前调用校验接口，确保数据质量。
- **表名规范**：使用有意义的表名，仅包含英文字母、数字和下划线。
- **字段元数据**：为字段提供完整的元数据说明。

### 数据查询

- **限制查询范围**：使用 `limit` 参数控制返回记录数，避免一次性加载过多数据。
- **组合条件**：结合属性和空间过滤，精确定位所需数据。
- **结果缓存**：对于频繁查询的相同条件，考虑缓存查询结果。

### 数据导出

- **选择合适的导出方式**：小数据量使用同步导出，大数据量使用异步导出。
- **坐标系转换**：导出时指定目标坐标系，确保数据与其他系统兼容。
- **筛选导出**：只导出需要的数据子集，减少文件大小。

### 栅格数据

- **异步处理**：栅格导入和渲染建议使用异步模式，避免请求超时。
- **进度监控**：为异步任务提供进度反馈，提升用户体验。
- **样式缓存**：复用相同的渲染样式，减少重复计算。

### 异步任务

- **合理轮询**：轮询间隔建议 1-2 秒，避免过于频繁的请求。
- **超时处理**：设置合理的超时时间，避免无限等待。
- **错误重试**：任务失败后提供重试机制，但避免无限重试。

### 性能优化

- **减少请求次数**：合并相关请求，使用批量操作。
- **数据分页**：大数据量使用分页加载，避免一次性加载全部数据。
- **缓存策略**：对不常变化的数据进行缓存，减少服务器压力。
- **按需加载**：只加载用户当前需要的数据，延迟加载其他数据。

---

## 13. 常见问题（FAQ）

### 认证相关

**Q: 为什么收到 401 错误？**

A: 401 表示未认证。可能原因：
- 未登录或会话已过期
- Cookie 未正确携带（确保设置了 `credentials: "include"`）
- CSRF Token 未正确传递

**Q: 为什么收到 403 错误？**

A: 403 表示权限不足。可能原因：
- 用户不具备该功能权限
- 数据资源设置了访问限制，用户不在允许的角色中

**Q: 如何处理会话过期？**

A: 当收到 401 响应时，应引导用户重新登录。可以在前端全局拦截 401 响应并跳转到登录页。

**Q: 为什么收到 429 错误？**

A: 429 表示请求过于频繁。请降低请求频率，或联系管理员调整限流配置。

### 数据导入相关

**Q: 导入时提示"经纬度不是小数格式"怎么办？**

A: 确保经纬度列使用十进制小数格式，如 `87.600`、`43.800`，而非度分秒格式。

**Q: 如何处理坐标不确定性警告？**

A: 当坐标不确定性最大/最小差距超过 200 倍时会触发警告。可以在导入请求中设置 `ignoreCoordinateUncertainty: true` 来忽略此警告。

**Q: 同名数据已存在怎么办？**

A: 在数据校验阶段确认重复名称后，提交时设置 `duplicateConfirmed: true` 继续导入同名显示数据。后台存储标识由后端保持唯一，已有数据不会被覆盖。

### 数据查询相关

**Q: 查询返回的数据不完整怎么办？**

A: 检查响应中的 `returnedCount` 和 `totalCount`。如果 `returnedCount < totalCount`，说明达到了查询上限，可以增大 `limit` 参数或缩小查询范围。

**Q: 为什么查询结果中没有某些数据？**

A: 后端会自动忽略无几何、经度越界（-180到180之外）、纬度越界（-90到90之外）的数据。检查响应中的 `warnings` 字段了解详情。

### 数据导出相关

**Q: 同步导出和异步导出有什么区别？**

A: 同步导出直接返回文件，适用于小数据量；异步导出返回任务 ID，通过轮询获取结果，适用于大数据量。

**Q: 导出的文件格式是什么？**

A: 矢量数据可导出为 Shapefile 或 GeoJSON，栅格数据导出为 GeoTIFF，均打包为 ZIP 文件。

### 栅格数据相关

**Q: 栅格文件支持哪些格式？**

A: 系统支持 GDAL 能够读取的常见栅格格式，如 GeoTIFF、IMG 等。建议使用 GeoTIFF 格式以获得最佳兼容性。

**Q: 渲染状态显示 "failed" 怎么办？**

A: 检查任务的 `error` 字段了解失败原因。常见原因包括文件损坏、坐标系信息缺失等。

### 异步任务相关

**Q: 任务长时间停留在 "queued" 状态怎么办？**

A: 可能是系统繁忙，请耐心等待。如果持续较长时间，可以联系管理员检查系统状态。

**Q: 任务失败后如何重试？**

A: 重新提交相同的任务请求即可。

---

## 14. 版本控制与变更历史

### 版本策略

- 遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)（语义化版本）
- 格式：`MAJOR.MINOR.PATCH`
  - **MAJOR**：破坏性 API 或部署基线变更
  - **MINOR**：新增当前版本功能
  - **PATCH**：当前版本缺陷修复

### 变更历史

#### v0.1.0（2026-05-28）

初始版本，包含以下功能模块：

- **认证**：登录、注册、登出、当前用户查询、CSRF
- **数据目录**：目录树、资源列表、资源详情、矢量查询、数据导出（同步/异步）
- **图层**：已登记图层列表
- **搜索**：全局搜索
- **栅格**：数据集列表、导入、扫描、渲染（同步/异步）、唯一值分类、XYZ 瓦片服务
- **异步任务**：统一任务状态查询
- **后台管理**：用户设置、日志管理、系统设置、认证授权、数据导入

### 版本策略

- 当前部署只承诺 `docs/openapi.yaml` 描述的最新 API 合同。
- 旧端点、旧权限和旧数据结构不作为运行兼容目标；重新部署应使用空业务数据库执行迁移。
- 接入方升级时应先重新生成 OpenAPI 客户端类型，并按当前合同调整调用代码。

---

> 本文档由 API 文档重构生成，面向开发者提供接入指导。详细的接口参数和响应格式请参考 API Reference（OpenAPI）。
