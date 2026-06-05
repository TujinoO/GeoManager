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
10. [搜索与成果](#10-搜索与成果)
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

**JavaScript**

```javascript
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000/api",
  withCredentials: true,
});

// 获取系统配置
const { data: config } = await api.get("/bootstrap/");
console.log("系统名称:", config.systemName);
console.log("是否开放注册:", config.allowRegistration);
```

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
- 注册功能已开放（可通过 `/api/bootstrap/` 接口查询 `allowRegistration` 字段）

### 集成流程

```
获取 CSRF Token
   ↓
用户登录/注册
   ↓
获取用户信息
   ↓
后续请求携带凭证
```

### 实现步骤

#### Step 1: 获取 CSRF Token

在执行任何写操作（POST/PUT/DELETE）之前，必须先获取 CSRF Token。系统会设置 `csrftoken` Cookie，后续请求需从 Cookie 中读取此值并通过 `X-CSRFToken` 请求头传递。

```javascript
// JavaScript
await fetch("/api/auth/csrf/", { credentials: "include" });
```

```python
# Python
session.get(f"{base_url}/auth/csrf/")
```

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

#### Step 3: 用户注册

如果系统开放了注册功能，新用户可以通过注册接口创建账号。首个注册的用户将自动成为系统管理员。

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

#### Step 4: 检查登录状态

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

**数据访问权限**：控制用户可以访问的具体数据资源，通过用户组进行管理。

| 权限标识 | 功能说明 |
|----------|----------|
| `core.browse_data` | 浏览数据目录和资源 |
| `core.query_data` | 执行数据查询 |
| `core.load_vector_layer` | 加载矢量图层 |
| `core.load_raster_layer` | 加载栅格图层 |
| `core.custom_symbolization` | 自定义符号化规则 |
| `catalog.export_dataresource` | 导出数据资源 |
| `catalog.maintain_dataresource` | 维护数据资源（导入等） |
| `raster.manage_raster_dataset` | 管理栅格数据集 |

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
- 数据资源设置了访问限制，用户不在允许的用户组中

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

#### Step 2: 筛选数据资源

支持按数据类型、分类、来源、提供者、日期范围等条件筛选数据资源。

```javascript
// JavaScript
const params = new URLSearchParams({
  dataType: "vector",      // 数据类型: vector / raster / gene / table / document / image
  category: "vegetation",  // 分类代码
  q: "胡杨",              // 名称模糊搜索
});

const response = await fetch(`/api/catalog/resources/?${params}`, {
  credentials: "include",
});
const { items } = await response.json();

// items 可能包含两类对象：
// 1. 业务库 DataResource，id 为 number
// 2. 统一 GeoPackage 临时矢量图层，id 为 string，使用 name 访问图层接口
```

```python
# Python
response = session.get(f"{base_url}/catalog/resources/", params={
    "dataType": "vector",
    "category": "vegetation",
    "q": "胡杨",
})
resources = response.json()["items"]
```

#### Step 3: 获取资源详情

获取指定数据资源或统一 GeoPackage 临时矢量图层的完整元数据，包括字段信息、空间范围等。

```javascript
// JavaScript
const resource = items[0];
const profileUrl =
  typeof resource.id === "number"
    ? `/api/catalog/resources/${resource.id}/profile/`
    : `/api/layers/${encodeURIComponent(resource.name)}/profile/`;
const response = await fetch(profileUrl, {
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

# 统一 GeoPackage 临时矢量图层使用图层名称访问
layer_name = "survey_points_2026"
layer_profile = session.get(f"{base_url}/layers/{layer_name}/profile/").json()

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
- 用户具备 `catalog.maintain_dataresource` 权限
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
  importMode: "geographic",      // "geographic" 或 "table"
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
            "longitudeColumn": "longitude",
            "latitudeColumn": "latitude",
        })},
    )
validation = response.json()
```

#### Step 3: 提交导入

校验通过后，提交正式导入请求。系统会将数据写入相应的存储位置，并创建或更新 `DataResource` 记录。

```javascript
// JavaScript
const formData = new FormData();
formData.append("file", fileInput.files[0]);
formData.append("payload", JSON.stringify({
  name: "样地调查点",
  tableName: "survey_points_2026",  // 仅支持英文字母、数字和下划线
  importMode: "geographic",
  longitudeColumn: "longitude",
  latitudeColumn: "latitude",
  overwrite: false,                  // 同名表是否覆盖
  includedColumns: ["species", "height", "longitude", "latitude"],  // 可选，省略则导入全部
  fieldMetadata: {
    species: "中文名称：物种；数据来源：野外调查",
    height: "中文名称：株高；单位：m",
  },
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
            "tableName": "survey_points_2026",
            "importMode": "geographic",
            "longitudeColumn": "longitude",
            "latitudeColumn": "latitude",
            "overwrite": False,
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

**地理数据（Geographic）**：包含经纬度坐标的数据，系统会将其写入统一 GeoPackage 矢量文件，并创建或更新对应的 `DataResource`。提交响应返回 `mode: "geographic"`、`resourceId`、`resourceName`、`layerName`、`tableName`、`bounds`、`coordinateStats` 和 `validationIssues`。资源列表会显示 `resourceName` 对应的用户填写数据名称，`tableName/layerName` 仅作为后端存储标识。

**非地理数据（Table）**：不包含坐标信息的纯表格数据，系统会将其写入 SQLite 数据库。提交响应返回 `mode: "table"`、`resourceId`、`resourceName`、`tableName`，且 `layerId` 和 `coordinateStats` 为 `null`。

### 字段元数据规范

建议为每个字段提供以下元数据信息：

- 中文名称
- 单位（如有）
- 计算方式（如有）
- 数据来源

格式示例：`"中文名称：株高；单位：m；数据来源：野外调查"`

### 最佳实践

- **预检先行**：在正式导入前，务必先调用预检接口了解文件结构。
- **表名规范**：`tableName` 仅支持英文字母、数字和下划线，且以字母或下划线开头。
- **字段选择**：使用 `includedColumns` 参数只导入需要的字段，减少数据冗余。
- **元数据完善**：为字段提供详细的元数据说明，便于其他用户理解数据含义。

### FAQ

**Q: 导入时提示"经纬度不是小数格式"怎么办？**

A: 确保经纬度列使用十进制小数格式，如 `87.600`、`43.800`，而非度分秒格式。

**Q: 如何处理坐标不确定性警告？**

A: 当坐标不确定性最大/最小差距超过 200 倍时会触发警告。可以在导入请求中设置 `ignoreCoordinateUncertainty: true` 来忽略此警告。

**Q: 同名表已存在怎么办？**

A: 设置 `overwrite: true` 覆盖已有数据，或使用不同的 `tableName`。

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
  typeof resource.id === "number"
    ? `/api/catalog/resources/${resource.id}/query/`
    : `/api/layers/${encodeURIComponent(resource.name)}/query/`;
const response = await fetch(queryUrl, {
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

业务库资源使用 `/api/catalog/resources/{resourceId}/query/`；统一 GeoPackage 临时矢量图层使用 `/api/layers/{layer_name}/query/`。两者请求体和响应体一致，`QueryResponse.resourceId` 在临时图层场景为字符串。

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

A: 查询接口仅支持矢量 GeoPackage 数据。对于表格数据，请通过其他接口获取。

### API Reference

详见 API Reference（OpenAPI）。

---

## 6. 数据导出

### 功能简介

数据导出功能支持将平台中的数据资源导出为标准的 GIS 格式（Shapefile 或 GeoTIFF），打包为 ZIP 文件下载。

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

A: 矢量数据导出为 Shapefile，栅格数据导出为 GeoTIFF，均打包为 ZIP 文件。

**Q: 如何导出查询结果？**

A: 在导出请求的 `items` 中传入查询返回的 `geojson` 数据，系统会只导出这些数据。

### API Reference

详见 API Reference（OpenAPI）。

---

## 7. 地图图层

### 功能简介

地图图层功能用于管理和获取平台中的地图图层信息，支持矢量图层和栅格图层。图层是数据资源在地图上的可视化表现形式。

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

```python
# Python
layer_name = "survey_points_2026"
response = session.get(f"{base_url}/layers/{layer_name}/features/", params={"limit": 10000})
geojson = response.json()
print(f"要素数量: {len(geojson['features'])}")
```

#### Step 3: 查询统一 GeoPackage 图层

统一 GeoPackage 中未登记为业务 `DataResource` 的临时矢量图层，通过图层名称读取 profile 和执行查询。

```javascript
// JavaScript
const layerName = "survey_points_2026";
const profileRes = await fetch(
  `/api/layers/${encodeURIComponent(layerName)}/profile/`,
  {
    credentials: "include",
  },
);
const profile = await profileRes.json();

const queryRes = await fetch(`/api/layers/${encodeURIComponent(layerName)}/query/`, {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": getCookie("csrftoken"),
  },
  body: JSON.stringify({
    attributeFilters: [],
    spatialFilter: null,
    limit: 1000,
  }),
});
const queryResult = await queryRes.json();
console.log("字段:", profile.fields);
console.log("返回记录数:", queryResult.returnedCount);
```

### 图层类型

**矢量图层（Vector）**：来自统一 GeoPackage 的临时图层，`id` 为字符串，使用 `name` 作为 `/api/layers/{layer_name}/...` 路径参数，支持属性查询和空间查询。

**栅格图层（Raster）**：来自业务库 `MapLayer`，包含栅格数据，通过瓦片服务进行渲染。

### 符号化配置

图层的符号化配置存储在 `symbolization` 字段中，包含：

- `fillColor`：填充颜色
- `fillOpacity`：填充透明度
- `strokeColor`：边框颜色
- `strokeWidth`：边框宽度

### 最佳实践

- **按需加载**：只加载用户可见范围内的图层，减少数据传输量。
- **透明度控制**：通过图层透明度配置，实现多图层叠加显示。
- **错误处理**：加载图层时注意处理权限不足（403）和图层不存在（404）的情况。

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
- 用户具备 `raster.manage_raster_dataset` 或 `catalog.maintain_dataresource` 权限
- 栅格文件已放置在研究数据目录中

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

指定研究数据目录中的栅格文件路径，系统会自动进行预处理。

```javascript
// JavaScript
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
# Python
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

## 10. 搜索与成果

### 功能简介

搜索功能支持全局搜索数据资源和研究成果；成果功能用于展示胡杨林生态研究相关的学术成果和研究结论。

### 使用场景

- 快速查找数据资源
- 搜索相关研究成果
- 浏览研究成果列表

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
const { resources, achievements } = await response.json();

console.log("找到数据资源:", resources.length, "个");
console.log("找到研究成果:", achievements.length, "个");
// resources 同样可能包含业务 DataResource 和统一 GeoPackage 临时矢量图层
```

```python
# Python
query = "胡杨"
response = session.get(f"{base_url}/search/", params={"q": query})
result = response.json()

print(f"找到数据资源: {len(result['resources'])} 个")
print(f"找到研究成果: {len(result['achievements'])} 个")
```

#### 获取成果列表

```javascript
// JavaScript
const response = await fetch("/api/achievements/", { credentials: "include" });
const { items } = await response.json();

items.forEach((achievement) => {
  console.log(`标题: ${achievement.title}`);
  console.log(`来源: ${achievement.source}`);
  console.log(`摘要: ${achievement.summary}`);
});
```

```python
# Python
response = session.get(f"{base_url}/achievements/")
achievements = response.json()["items"]

for item in achievements:
    print(f"标题: {item['title']}")
    print(f"来源: {item['source']}")
```

### 最佳实践

- **搜索建议**：在用户输入时提供搜索建议，提升用户体验。
- **结果展示**：区分展示数据资源和研究成果，便于用户快速定位。
- **空结果处理**：搜索关键词为空时返回空结果，前端应妥善处理。

### FAQ

**Q: 搜索支持哪些字段？**

A: 搜索会匹配数据资源的名称、描述、来源等字段，以及研究成果的标题、摘要、来源等字段。

**Q: 搜索结果如何排序？**

A: 搜索结果按相关性排序，与关键词匹配度越高的结果越靠前。

### API Reference

详见 API Reference（OpenAPI）。

---

## 11. 后台管理

### 功能简介

后台管理功能通过 Django Admin 提供完整的系统管理界面，包括用户管理、权限配置、数据管理等。

### 使用场景

- 管理用户账号和权限
- 配置系统参数
- 管理数据资源和目录
- 查看操作日志

### 前置条件

- 用户已登录
- 用户具备 `core.access_admin` 权限（通常为系统管理员）

### 管理功能

| 功能模块 | 说明 |
|----------|------|
| 用户管理 | 创建、编辑、删除用户账号 |
| 用户组管理 | 管理用户组和功能权限分配 |
| 系统设置 | 配置系统全局参数 |
| 数据字典 | 管理分类、类型等字典数据 |
| 数据资源 | 管理数据资源元数据 |
| 数据目录 | 管理目录树结构 |
| 地图图层 | 管理图层配置和符号化 |
| 研究成果 | 管理研究成果信息 |
| 栅格数据集 | 管理栅格数据集状态 |
| 操作日志 | 查看系统操作记录（只读） |

### 访问方式

通过浏览器访问 `/admin/` 路径，使用具备管理员权限的账号登录。

### 最佳实践

- **权限最小化**：只授予用户必要的权限，避免权限滥用。
- **定期审计**：定期查看操作日志，监控系统使用情况。
- **数据备份**：定期备份数据库和重要数据文件。

### FAQ

**Q: 如何创建新的管理员账号？**

A: 在 Django Admin 的用户管理中，勾选 "Staff status" 和 "Superuser status" 选项。

**Q: 如何配置用户的数据访问权限？**

A: 在用户组管理中，设置用户组的 "Data access groups" 关联，然后将用户添加到相应用户组。

### API Reference

详见 Django Admin 文档。

---

## 12. 最佳实践

### 认证与安全

- **CSRF 保护**：所有写操作必须携带 CSRF Token，从 Cookie 中读取 `csrftoken` 值。
- **会话管理**：使用 `remember` 参数控制会话持久性，敏感操作建议使用非持久会话。
- **权限检查**：在执行操作前检查用户权限，避免不必要的 API 调用。
- **错误处理**：妥善处理 401（未认证）和 403（权限不足）响应。

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
- 数据资源设置了访问限制，用户不在允许的用户组中

**Q: 如何处理会话过期？**

A: 当收到 401 响应时，应引导用户重新登录。可以在前端全局拦截 401 响应并跳转到登录页。

**Q: 为什么收到 429 错误？**

A: 429 表示请求过于频繁。请降低请求频率，或联系管理员调整限流配置。

### 数据导入相关

**Q: 导入时提示"经纬度不是小数格式"怎么办？**

A: 确保经纬度列使用十进制小数格式，如 `87.600`、`43.800`，而非度分秒格式。

**Q: 如何处理坐标不确定性警告？**

A: 当坐标不确定性最大/最小差距超过 200 倍时会触发警告。可以在导入请求中设置 `ignoreCoordinateUncertainty: true` 来忽略此警告。

**Q: 同名表已存在怎么办？**

A: 设置 `overwrite: true` 覆盖已有数据，或使用不同的 `tableName`。

### 数据查询相关

**Q: 查询返回的数据不完整怎么办？**

A: 检查响应中的 `returnedCount` 和 `totalCount`。如果 `returnedCount < totalCount`，说明达到了查询上限，可以增大 `limit` 参数或缩小查询范围。

**Q: 为什么查询结果中没有某些数据？**

A: 后端会自动忽略无几何、经度越界（-180到180之外）、纬度越界（-90到90之外）的数据。检查响应中的 `warnings` 字段了解详情。

### 数据导出相关

**Q: 同步导出和异步导出有什么区别？**

A: 同步导出直接返回文件，适用于小数据量；异步导出返回任务 ID，通过轮询获取结果，适用于大数据量。

**Q: 导出的文件格式是什么？**

A: 矢量数据导出为 Shapefile，栅格数据导出为 GeoTIFF，均打包为 ZIP 文件。

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
  - **MAJOR**：不兼容的 API 变更
  - **MINOR**：新增向后兼容的功能
  - **PATCH**：向后兼容的缺陷修复

### 变更历史

#### v0.1.0（2026-05-28）

初始版本，包含以下功能模块：

- **认证**：登录、注册、登出、当前用户查询、CSRF
- **数据目录**：目录树、资源列表、资源详情、矢量查询、数据导出（同步/异步）
- **图层**：图层列表、GeoJSON 要素获取
- **研究成果**：成果列表
- **搜索**：全局搜索
- **栅格**：数据集列表、导入、扫描、渲染（同步/异步）、唯一值分类、XYZ 瓦片服务
- **异步任务**：统一任务状态查询
- **后台管理**：Django Admin 全模型 CRUD

### 向后兼容承诺

- PATCH 版本更新不会改变现有端点的行为或响应格式
- MINOR 版本更新可能新增端点或可选字段，但不会破坏现有接口
- MAJOR 版本更新可能移除或修改现有端点，需查阅具体变更说明

---

> 本文档由 API 文档重构生成，面向开发者提供接入指导。详细的接口参数和响应格式请参考 API Reference（OpenAPI）。
