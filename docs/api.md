# API 文档

> 中亚胡杨林生态系统保护数据共享平台 — 后端接口参考  
> 基准路径：`/api/`  
> 当前版本：v0.1.0

---

## 目录

1. [概述](#1-概述)
2. [认证与授权](#2-认证与授权)
3. [请求与响应格式](#3-请求与响应格式)
4. [错误处理](#4-错误处理)
5. [公共接口](#5-公共接口)
6. [认证接口](#6-认证接口)
7. [数据目录接口](#7-数据目录接口)
8. [图层接口](#8-图层接口)
9. [成果接口](#9-成果接口)
10. [搜索接口](#10-搜索接口)
11. [栅格数据接口](#11-栅格数据接口)
12. [异步任务接口](#12-异步任务接口)
13. [后台管理](#13-后台管理)
14. [使用示例](#14-使用示例)
15. [版本控制与变更历史](#15-版本控制与变更历史)

---

## 1. 概述

本平台采用 **Django** 构建后端 API，前端通过 **React + Vite** 消费接口。API 遵循以下设计原则：

- 使用 Django 内建 Session 认证机制，基于 Cookie 维持会话。
- 所有非 GET 请求需携带 CSRF Token（通过 `X-CSRFToken` 请求头传递）。
- 权限分为**功能权限**（Feature Permissions）和**数据访问权限**（Access Groups）两层。
- 栅格渲染采用异步任务 + XYZ 瓦片服务模式。
- 数据管理（增删改）通过 Django Admin (`/admin/`) 完成，API 仅提供读取接口。

### 技术栈

| 层       | 技术                                               |
| -------- | -------------------------------------------------- |
| 前端     | React + Vite + Ant Design + Mapbox GL JS           |
| 后端     | Python + Django + GeoPandas + GDAL + Rasterio      |
| 数据存储 | SQLite（业务）、GeoPackage `.gpkg`（矢量）、原始栅格文件 |

---

## 2. 认证与授权

### 2.1 会话认证

平台使用 Django 内建的 Session 认证。认证流程如下：

```
1. GET  /api/auth/csrf/          → 获取 csrftoken Cookie
2. POST /api/auth/login/         → 登录，建立 Session
3. 后续请求携带 Session Cookie + X-CSRFToken 头
```

- Session Cookie 名称：`sessionid`
- CSRF Cookie 名称：`csrftoken`
- Cookie 策略：`SameSite=Lax`
- 前端所有 `fetch` 请求需设置 `credentials: "include"`

### 2.2 CSRF 保护

所有 `POST` / `PUT` / `DELETE` 请求必须在 `X-CSRFToken` 请求头中携带 CSRF Token。Token 从浏览器 Cookie `csrftoken` 中读取。

### 2.3 功能权限

系统定义了以下 10 项功能权限，通过 Django 的权限系统分配给用户组：

| 权限标识                           | 名称         | 分组     |
| ---------------------------------- | ------------ | -------- |
| `core.access_admin`                | 进入后台管理 | 系统管理 |
| `core.manage_feature_permissions`  | 配置功能权限 | 系统管理 |
| `core.browse_data`                 | 浏览数据     | 数据功能 |
| `core.query_data`                  | 查询数据     | 数据功能 |
| `core.load_vector_layer`           | 加载矢量图层 | 图层功能 |
| `core.load_raster_layer`           | 加载栅格图层 | 图层功能 |
| `core.custom_symbolization`        | 自定义符号化 | 图层功能 |
| `catalog.export_dataresource`      | 导出数据资源 | 数据管理 |
| `catalog.maintain_dataresource`    | 维护数据资源 | 数据管理 |
| `raster.manage_raster_dataset`     | 管理栅格数据集 | 栅格管理 |

超管用户（`is_superuser`）自动拥有全部权限。

### 2.4 数据访问权限

`DataResource`、`DataCatalog`、`MapLayer`、`Achievement` 均有 `access_groups` 多对多字段：

- 若 `access_groups` 为空 → 所有已认证用户均可访问
- 若 `access_groups` 非空 → 仅所属用户组的成员可访问

---

## 3. 请求与响应格式

### 3.1 请求

- **Content-Type**：`application/json`
- **认证**：Cookie（`sessionid` + `csrftoken`）
- **CSRF**：`X-CSRFToken: <csrftoken 值>`

### 3.2 响应

所有 JSON 响应均使用 `application/json` Content-Type。文件下载接口使用对应的 MIME 类型。

### 3.3 通用数据类型

| 类型     | 说明                         |
| -------- | ---------------------------- |
| `int`    | 整数                         |
| `float`  | 浮点数                       |
| `string` | 字符串                       |
| `bool`   | 布尔值                       |
| `null`   | 空值                         |
| `array`  | 数组                         |
| `object` | JSON 对象                    |
| `ISO 8601` | 日期时间字符串，如 `"2026-05-28T12:00:00+08:00"` |

---

## 4. 错误处理

### 4.1 错误响应格式

所有错误响应均返回 JSON 对象，包含 `detail` 字段描述错误原因：

```json
{
  "detail": "错误描述信息"
}
```

### 4.2 HTTP 状态码

| 状态码 | 含义               | 典型场景                     |
| ------ | ------------------ | ---------------------------- |
| 200    | 成功               | 正常 GET/POST 响应           |
| 201    | 已创建             | 同步导入栅格成功             |
| 202    | 已接受（异步）     | 异步任务已提交               |
| 400    | 请求错误           | 参数校验失败、业务逻辑错误   |
| 401    | 未认证             | 未登录或 Session 过期        |
| 403    | 权限不足           | 缺少功能权限或数据访问权限   |
| 404    | 资源不存在         | ID 不存在、文件缺失          |
| 405    | 方法不允许         | HTTP 方法与端点不匹配        |
| 409    | 冲突               | 异步任务未完成时尝试下载     |
| 500    | 服务器内部错误     | 未捕获异常                   |

### 4.3 常见错误场景

| 场景                     | 状态码 | 响应示例                                           |
| ------------------------ | ------ | -------------------------------------------------- |
| 未登录访问受保护接口     | 401    | `{"detail": "认证凭据未提供"}`                     |
| 功能权限不足             | 403    | `{"detail": "当前用户组"xxx"无权限"}`               |
| 数据资源无权访问         | 403    | `{"detail": "无权访问该数据资源"}`                 |
| 请求体非有效 JSON        | 400    | `{"detail": "请求体不是有效 JSON"}`                |
| 注册未开放               | 403    | `{"detail": "当前系统未开放自助注册"}`             |
| 账号或密码错误           | 400    | `{"detail": "账号或密码错误"}`                     |

---

## 5. 公共接口

以下接口无需认证即可访问。

### 5.1 获取系统启动配置

获取前端应用初始化所需的全局配置信息。

```
GET /api/bootstrap/
```

**认证**：无需

**响应** `200 OK`：

```json
{
  "systemName": "中亚胡杨林生态系统保护数据共享平台",
  "allowRegistration": true,
  "map": {
    "defaultCenter": [87.6, 41.7],
    "defaultZoom": 6.5,
    "defaultBasemap": "mapbox://styles/mapbox/satellite-streets-v12",
    "mapboxAccessToken": "pk.xxx..."
  },
  "limits": {
    "uploadMaxMb": 500,
    "queryResultLimit": 30000
  }
}
```

### 5.2 健康检查

```
GET /api/health/
```

**认证**：无需

**响应** `200 OK`：

```json
{
  "status": "ok",
  "configLoaded": true,
  "appSubdirs": ["vector", "raster", "export", "..."],
  "researchSubdirs": ["raw", "processed", "..."]
}
```

---

## 6. 认证接口

### 6.1 获取 CSRF Cookie

设置 `csrftoken` Cookie，后续所有非 GET 请求需读取此 Cookie 值并通过 `X-CSRFToken` 头传递。

```
GET /api/auth/csrf/
```

**认证**：无需

**响应** `200 OK`：

```json
{
  "detail": "csrf cookie set"
}
```

### 6.2 用户登录

```
POST /api/auth/login/
```

**认证**：无需

**请求体**：

```json
{
  "username": "admin",
  "password": "your_password",
  "remember": true
}
```

| 字段       | 类型     | 必填 | 说明                                      |
| ---------- | -------- | ---- | ----------------------------------------- |
| `username` | `string` | 是   | 用户名                                    |
| `password` | `string` | 是   | 密码                                      |
| `remember` | `bool`   | 否   | 是否记住登录。`true` 持久会话，`false` 关闭浏览器即失效 |

**响应** `200 OK`：

```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "displayName": "管理员",
    "email": "admin@example.com",
    "isStaff": true,
    "isSuperuser": true,
    "roles": ["系统管理员"],
    "permissions": {
      "canAccessAdmin": true,
      "canManageFeaturePermissions": true,
      "canBrowseData": true,
      "canQueryData": true,
      "canLoadVectorLayer": true,
      "canLoadRasterLayer": true,
      "canUseCustomSymbolization": true,
      "canExportData": true,
      "canMaintainData": true,
      "canManageRasterData": true
    }
  }
}
```

**错误响应**：

| 状态码 | 原因               | 示例                                          |
| ------ | ------------------ | --------------------------------------------- |
| 400    | JSON 格式错误      | `{"detail": "请求体不是有效 JSON"}`            |
| 400    | 账号或密码错误     | `{"detail": "账号或密码错误"}`                 |

### 6.3 用户注册

```
POST /api/auth/register/
```

**认证**：无需（受系统配置 `allowRegistration` 控制）

**请求体**：

```json
{
  "username": "researcher1",
  "email": "researcher1@example.com",
  "password": "SecurePass123!",
  "passwordConfirm": "SecurePass123!"
}
```

| 字段             | 类型     | 必填 | 说明               |
| ---------------- | -------- | ---- | ------------------ |
| `username`       | `string` | 是   | 用户名（唯一）     |
| `email`          | `string` | 否   | 邮箱               |
| `password`       | `string` | 是   | 密码               |
| `passwordConfirm`| `string` | 是   | 确认密码           |

**响应** `200 OK`：

```json
{
  "user": {
    "id": 2,
    "username": "researcher1",
    "displayName": "researcher1",
    "email": "researcher1@example.com",
    "isStaff": false,
    "isSuperuser": false,
    "roles": [],
    "permissions": { "..." }
  },
  "detail": "用户注册成功"
}
```

> **注意**：首个注册的用户将自动成为系统管理员（`is_staff=true, is_superuser=true`），此时 `detail` 为 `"首个注册用户已创建为系统管理员"`。

**错误响应**：

| 状态码 | 原因                   | 示例                                          |
| ------ | ---------------------- | --------------------------------------------- |
| 403    | 注册未开放             | `{"detail": "当前系统未开放自助注册"}`         |
| 400    | 用户名为空             | `{"detail": "请输入账号"}`                     |
| 400    | 密码不一致             | `{"detail": "两次输入的密码不一致"}`           |
| 400    | 密码强度不足           | `{"detail": "密码太短"}`                       |
| 400    | 用户名已存在           | `{"detail": "账号已存在"}`                     |

### 6.4 用户登出

```
POST /api/auth/logout/
```

**认证**：需要（`@login_required`）

**请求体**：

```json
{}
```

**响应** `200 OK`：

```json
{
  "detail": "已退出"
}
```

### 6.5 获取当前用户信息

```
GET /api/auth/me/
```

**认证**：无需（未登录返回 401）

**响应** `200 OK`（已认证）：

```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "username": "admin",
    "displayName": "管理员",
    "email": "admin@example.com",
    "isStaff": true,
    "isSuperuser": true,
    "roles": ["系统管理员"],
    "permissions": { "..." }
  }
}
```

**响应** `401 Unauthorized`（未认证）：

```json
{
  "authenticated": false
}
```

---

## 7. 数据目录接口

### 7.1 获取数据目录树

返回所有已激活的数据目录及其关联的数据资源。

```
GET /api/catalog/directories/
```

**认证**：需要，权限 `core.browse_data`

**响应** `200 OK`：

```json
{
  "items": [
    {
      "id": 1,
      "name": "植被数据",
      "code": "vegetation",
      "parentId": null,
      "description": "胡杨林植被相关数据",
      "sortOrder": 1,
      "resources": [
        {
          "id": 1,
          "name": "胡杨林分布图",
          "code": "poplar_distribution",
          "dataType": "vector",
          "category": { "id": 1, "type": "data_category", "code": "vegetation", "name": "植被" },
          "source": "遥感解译",
          "provider": "中科院生态所",
          "dataDate": "2025-06-01",
          "spatialExtent": "塔里木河流域",
          "coordinateSystem": "WGS84",
          "fileFormat": "GeoPackage",
          "description": "2025年胡杨林空间分布矢量数据",
          "qualityNote": "",
          "status": "active",
          "isQueryable": true,
          "isRenderable": false,
          "updatedAt": "2026-05-28T10:00:00+08:00"
        }
      ]
    }
  ]
}
```

### 7.2 获取数据资源列表

支持多条件筛选的数据资源分页列表。

```
GET /api/catalog/resources/
```

**认证**：需要，权限 `core.browse_data`

**查询参数**：

| 参数       | 类型     | 必填 | 说明                                      |
| ---------- | -------- | ---- | ----------------------------------------- |
| `q`        | `string` | 否   | 按名称模糊搜索                            |
| `dataType` | `string` | 否   | 数据类型筛选：`vector` / `raster` / `gene` / `table` / `document` / `image` |
| `category` | `string` | 否   | 分类代码精确匹配                          |
| `source`   | `string` | 否   | 数据来源模糊匹配                          |
| `provider` | `string` | 否   | 提供者模糊匹配                            |
| `dateFrom` | `string` | 否   | 数据日期起始（`YYYY-MM-DD`）              |
| `dateTo`   | `string` | 否   | 数据日期截止（`YYYY-MM-DD`）              |

**请求示例**：

```
GET /api/catalog/resources/?dataType=vector&category=vegetation&q=胡杨
```

**响应** `200 OK`：

```json
{
  "items": [
    {
      "id": 1,
      "name": "胡杨林分布图",
      "code": "poplar_distribution",
      "dataType": "vector",
      "category": { "id": 1, "type": "data_category", "code": "vegetation", "name": "植被" },
      "source": "遥感解译",
      "provider": "中科院生态所",
      "dataDate": "2025-06-01",
      "spatialExtent": "塔里木河流域",
      "coordinateSystem": "WGS84",
      "fileFormat": "GeoPackage",
      "description": "2025年胡杨林空间分布矢量数据",
      "qualityNote": "",
      "status": "active",
      "isQueryable": true,
      "isRenderable": false,
      "updatedAt": "2026-05-28T10:00:00+08:00"
    }
  ]
}
```

### 7.3 扫描数据源

触发一次数据目录源扫描，发现并同步新的数据资源。

```
POST /api/catalog/scan/
```

**认证**：需要，权限 `core.browse_data`

**请求体**：

```json
{}
```

**响应** `200 OK`：

```json
{
  "items": [ "..." ],
  "count": 5
}
```

### 7.4 获取数据资源详情

获取指定数据资源的元数据、字段信息及空间范围。

```
GET /api/catalog/resources/{id}/profile/
```

**认证**：需要，权限 `core.browse_data`

**路径参数**：

| 参数 | 类型  | 说明       |
| ---- | ----- | ---------- |
| `id` | `int` | 资源 ID    |

**响应** `200 OK`：

```json
{
  "resource": { "..." },
  "fields": [
    {
      "name": "species",
      "type": "object",
      "nullable": false,
      "sampleValues": ["Populus euphratica", "Tamarix ramosissima"]
    },
    {
      "name": "area_ha",
      "type": "float64",
      "nullable": true,
      "sampleValues": [125.5, 89.3, 42.1]
    }
  ],
  "featureCount": 1520,
  "geometryType": "Polygon",
  "bounds": [87.12, 41.25, 88.95, 42.10],
  "raster": null
}
```

**栅格资源响应**（`dataType` 为 `raster` 时）：

```json
{
  "resource": { "..." },
  "fields": [],
  "featureCount": null,
  "geometryType": "Raster",
  "bounds": [87.12, 41.25, 88.95, 42.10],
  "raster": {
    "id": 1,
    "name": "DEM 高程数据",
    "code": "dem_elevation",
    "status": "ready",
    "sourcePath": "raw/dem.tif",
    "processedPath": "processed/dem_cog.tif",
    "sourceMetadataPath": "raw/dem.json",
    "processedMetadataPath": "processed/dem_cog.json",
    "dataResourceId": 5,
    "mapLayerId": 3,
    "bandCount": 1,
    "bounds3857": [9700000, 5020000, 9850000, 5120000],
    "bounds4326": [87.12, 41.25, 88.95, 42.10],
    "imageCoordinates": [[87.12, 42.10], [88.95, 42.10], [88.95, 41.25], [87.12, 41.25]],
    "defaultRules": {
      "mode": "grayscale",
      "band": 1
    },
    "sourceFileSize": 104857600,
    "processedFileSize": 52428800,
    "progressLog": "导入完成",
    "errorMessage": "",
    "importedAt": "2026-05-28T10:00:00+08:00",
    "processedAt": "2026-05-28T10:05:00+08:00",
    "metadata": {
      "size": [5120, 5120],
      "driver": "GTiff",
      "coordinateSystem": "32644",
      "bands": [
        {
          "band": 1,
          "type": "Float32",
          "description": "Band 1",
          "colorInterpretation": "Gray",
          "min": 1200.0,
          "max": 4500.0,
          "isInteger": false
        }
      ]
    }
  }
}
```

**错误响应**：

| 状态码 | 原因           | 示例                               |
| ------ | -------------- | ---------------------------------- |
| 404    | 资源不存在     | `{"detail": "未找到..."}`          |
| 403    | 无权访问       | `{"detail": "无权访问该数据资源"}` |

### 7.5 查询矢量数据

对矢量数据资源执行属性 + 空间联合查询，返回 GeoJSON FeatureCollection。

```
POST /api/catalog/resources/{id}/query/
```

**认证**：需要，权限 `core.query_data` + `core.load_vector_layer`

**路径参数**：

| 参数 | 类型  | 说明       |
| ---- | ----- | ---------- |
| `id` | `int` | 资源 ID    |

**请求体**：

```json
{
  "attributeFilters": [
    {
      "field": "species",
      "operator": "eq",
      "value": "Populus euphratica"
    },
    {
      "field": "area_ha",
      "operator": "between",
      "value": "10",
      "valueTo": "100"
    }
  ],
  "spatialFilter": {
    "mode": "rectangle",
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[87.5, 41.5], [88.0, 41.5], [88.0, 42.0], [87.5, 42.0], [87.5, 41.5]]]
    }
  },
  "limit": 1000
}
```

**请求体字段说明**：

| 字段                | 类型       | 必填 | 说明                                        |
| ------------------- | ---------- | ---- | ------------------------------------------- |
| `attributeFilters`  | `array`    | 否   | 属性过滤条件数组                            |
| `attributeFilters[].field` | `string` | 是 | 字段名（必须存在于数据中）                 |
| `attributeFilters[].operator` | `string` | 是 | 操作符：`contains` / `eq` / `ne` / `gt` / `gte` / `lt` / `lte` / `between` |
| `attributeFilters[].value` | `string` | 是 | 比较值                                      |
| `attributeFilters[].valueTo` | `string` | 条件 | `between` 操作符时必填，范围上界            |
| `spatialFilter`     | `object\|null` | 否 | 空间过滤条件                                |
| `spatialFilter.mode` | `string` | 否   | 空间模式：`rectangle` / `circle` / `ellipse` / `polygon` |
| `spatialFilter.geometry` | `object` | 是 | GeoJSON Geometry 对象                      |
| `limit`             | `int`      | 否   | 返回记录上限，默认取系统配置 `queryResultLimit` |

**响应** `200 OK`：

```json
{
  "resourceId": 1,
  "resourceName": "胡杨林分布图",
  "totalCount": 350,
  "returnedCount": 350,
  "limit": 30000,
  "fields": [
    {
      "name": "species",
      "type": "object",
      "nullable": false,
      "sampleValues": ["Populus euphratica"]
    }
  ],
  "geojson": {
    "type": "FeatureCollection",
    "features": [
      {
        "id": "1",
        "type": "Feature",
        "geometry": { "type": "Polygon", "coordinates": [[["..."]]] },
        "properties": {
          "species": "Populus euphratica",
          "area_ha": 45.2
        }
      }
    ]
  }
}
```

**错误响应**：

| 状态码 | 原因                 | 示例                                         |
| ------ | -------------------- | -------------------------------------------- |
| 400    | 非矢量资源           | `{"detail": "当前只支持矢量 GeoPackage 查询"}` |
| 400    | 字段不存在           | `{"detail": "属性字段不存在：xxx"}`           |
| 400    | 不支持的操作符       | `{"detail": "不支持的属性操作符：xxx"}`       |
| 403    | 权限不足             | `{"detail": "当前用户组"xxx"无权限"}`         |

### 7.6 同步导出图层

将指定图层数据导出为 ZIP 文件（含 Shapefile 或 GeoTIFF）。

```
POST /api/catalog/export/
```

**认证**：需要，权限 `catalog.export_dataresource`

**请求体**：

```json
{
  "epsg": 4326,
  "reproject": true,
  "clip": false,
  "clipGeometry": null,
  "items": [
    {
      "layerType": "vector",
      "name": "胡杨林分布",
      "resourceId": 1,
      "geojson": { "type": "FeatureCollection", "features": ["..."] }
    },
    {
      "layerType": "raster",
      "name": "DEM高程",
      "resourceId": 5,
      "datasetId": 1,
      "sourceCrs": "32644"
    }
  ]
}
```

**请求体字段说明**：

| 字段           | 类型                  | 必填 | 说明                                      |
| -------------- | --------------------- | ---- | ----------------------------------------- |
| `epsg`         | `int\|null`           | 否   | 目标坐标系 EPSG 代码，默认 4326          |
| `reproject`    | `bool`                | 否   | 是否重投影，默认 `true`                   |
| `clip`         | `bool`                | 否   | 是否裁剪，默认 `false`                    |
| `clipGeometry` | `GeoJSON Geometry\|null` | 条件 | `clip=true` 时的裁剪几何                  |
| `items`        | `array`               | 是   | 导出图层列表                              |
| `items[].layerType` | `"vector"\|"raster"` | 是 | 图层类型                                  |
| `items[].name` | `string`              | 是   | 导出文件名                                |
| `items[].resourceId` | `int`            | 是   | 数据资源 ID                               |
| `items[].geojson` | `GeoJSON\|null`     | 否   | 矢量图层的过滤后数据                      |
| `items[].datasetId` | `int\|null`       | 否   | 栅格数据集 ID                             |
| `items[].sourceCrs` | `string\|int\|null` | 否 | 源坐标系                                  |

**响应** `200 OK`：二进制 ZIP 文件

- Content-Type: `application/zip`
- Content-Disposition: `attachment; filename="layers-export-20260528120000.zip"`

**错误响应**：

| 状态码 | 原因           | 示例                               |
| ------ | -------------- | ---------------------------------- |
| 400    | EPSG 无效      | `{"detail": "不支持的 EPSG: 9999"}` |
| 403    | 权限不足       | `{"detail": "当前用户组"xxx"无权限"}` |

### 7.7 异步导出图层

与同步导出参数相同，但以异步任务方式执行，返回任务 ID。

```
POST /api/catalog/export/async/
```

**认证**：需要，权限 `catalog.export_dataresource`

**请求体**：同 [7.6 同步导出图层](#76-同步导出图层)

**响应** `202 Accepted`：

```json
{
  "id": "a1b2c3d4e5f6...",
  "kind": "export",
  "status": "queued",
  "progressPercent": 0,
  "messages": [],
  "result": null,
  "error": "",
  "startedAt": 1717142400.0,
  "finishedAt": null
}
```

通过 [GET /api/raster/jobs/{job_id}/](#121-查询异步任务状态) 轮询任务状态。任务完成后 `result` 中包含 `downloadUrl`：

```json
{
  "result": {
    "filename": "layers-export-20260528120000.zip",
    "downloadUrl": "/api/catalog/export/jobs/a1b2c3d4/download/"
  }
}
```

### 7.8 下载导出文件

```
GET /api/catalog/export/jobs/{job_id}/download/
```

**认证**：需要，权限 `catalog.export_dataresource`

**路径参数**：

| 参数     | 类型     | 说明         |
| -------- | -------- | ------------ |
| `job_id` | `string` | 导出任务 ID  |

**响应** `200 OK`：二进制 ZIP 文件

**错误响应**：

| 状态码 | 原因               | 示例                                     |
| ------ | ------------------ | ---------------------------------------- |
| 404    | 任务不存在         | `{"detail": "任务不存在或已过期"}`       |
| 404    | 文件已过期         | `{"detail": "导出文件不存在或已过期"}`   |
| 409    | 任务未完成         | `{"detail": "导出任务尚未完成"}`         |

---

## 8. 图层接口

### 8.1 获取图层列表

```
GET /api/layers/
```

**认证**：需要，权限 `core.browse_data`

**响应** `200 OK`：

```json
{
  "items": [
    {
      "id": 1,
      "name": "胡杨林分布",
      "code": "poplar_layer",
      "layerType": "vector",
      "geometryType": "polygon",
      "category": { "id": 1, "type": "layer_category", "code": "vegetation", "name": "植被" },
      "dataResourceId": 1,
      "sortOrder": 1,
      "defaultVisible": true,
      "defaultOpacity": 80,
      "symbolization": {
        "fillColor": "#228B22",
        "fillOpacity": 0.6,
        "strokeColor": "#006400",
        "strokeWidth": 1
      },
      "bounds": [87.12, 41.25, 88.95, 42.10],
      "legend": "vegetation_green",
      "rasterRules": {},
      "isActive": true,
      "updatedAt": "2026-05-28T10:00:00+08:00"
    },
    {
      "id": 3,
      "name": "DEM 高程",
      "code": "dem_layer",
      "layerType": "raster",
      "geometryType": "polygon",
      "category": null,
      "dataResourceId": 5,
      "sortOrder": 2,
      "defaultVisible": false,
      "defaultOpacity": 100,
      "symbolization": {},
      "bounds": [87.12, 41.25, 88.95, 42.10],
      "legend": "",
      "rasterRules": {
        "mode": "grayscale",
        "band": 1
      },
      "isActive": true,
      "updatedAt": "2026-05-28T10:00:00+08:00"
    }
  ]
}
```

### 8.2 获取图层 GeoJSON 要素

获取矢量图层的全部要素（GeoJSON FeatureCollection 格式）。

```
GET /api/layers/{id}/features/
```

**认证**：需要，权限 `core.load_vector_layer`

**路径参数**：

| 参数 | 类型  | 说明     |
| ---- | ----- | -------- |
| `id` | `int` | 图层 ID  |

**查询参数**：

| 参数    | 类型  | 必填 | 说明                             |
| ------- | ----- | ---- | -------------------------------- |
| `limit` | `int` | 否   | 返回要素上限，默认取系统配置     |

**响应** `200 OK`：

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "id": "1",
      "type": "Feature",
      "geometry": { "type": "Polygon", "coordinates": [[["..."]]] },
      "properties": {
        "species": "Populus euphratica",
        "area_ha": 45.2
      }
    }
  ]
}
```

**错误响应**：

| 状态码 | 原因             | 示例                                   |
| ------ | -------------- | -------------------------------------- |
| 400    | 非矢量图层     | `{"detail": "该图层不是矢量图层"}`     |
| 400    | 未配置图层名   | `{"detail": "图层未配置 GeoPackage 图层名"}` |
| 403    | 无权访问       | `{"detail": "无权访问该图层"}`         |
| 404    | 图层不存在     | `{"detail": "未找到..."}`              |

---

## 9. 成果接口

### 9.1 获取成果列表

```
GET /api/achievements/
```

**认证**：需要，权限 `core.browse_data`

**响应** `200 OK`：

```json
{
  "items": [
    {
      "id": 1,
      "title": "塔里木河流域胡杨林退化机制研究",
      "code": "poplar_degradation_2025",
      "category": { "id": 2, "type": "achievement_category", "code": "research", "name": "研究成果" },
      "summary": "基于多源遥感数据的胡杨林退化时空分析...",
      "source": "生态学报, 2025",
      "relatedLayerId": 1,
      "displayOrder": 1,
      "status": "published",
      "updatedAt": "2026-05-28T10:00:00+08:00"
    }
  ]
}
```

---

## 10. 搜索接口

### 10.1 全局搜索

同时搜索数据资源和研究成果。

```
GET /api/search/
```

**认证**：需要，权限 `core.browse_data`

**查询参数**：

| 参数 | 类型     | 必填 | 说明         |
| ---- | -------- | ---- | ------------ |
| `q`  | `string` | 是   | 搜索关键词   |

**请求示例**：

```
GET /api/search/?q=胡杨
```

**响应** `200 OK`：

```json
{
  "resources": [
    {
      "id": 1,
      "name": "胡杨林分布图",
      "code": "poplar_distribution",
      "dataType": "vector",
      "category": { "..." },
      "source": "遥感解译",
      "provider": "中科院生态所",
      "dataDate": "2025-06-01",
      "spatialExtent": "塔里木河流域",
      "coordinateSystem": "WGS84",
      "fileFormat": "GeoPackage",
      "description": "...",
      "qualityNote": "",
      "status": "active",
      "isQueryable": true,
      "isRenderable": false,
      "updatedAt": "2026-05-28T10:00:00+08:00"
    }
  ],
  "achievements": [
    {
      "id": 1,
      "title": "塔里木河流域胡杨林退化机制研究",
      "code": "poplar_degradation_2025",
      "category": { "..." },
      "summary": "...",
      "source": "生态学报, 2025",
      "relatedLayerId": 1,
      "displayOrder": 1,
      "status": "published",
      "updatedAt": "2026-05-28T10:00:00+08:00"
    }
  ]
}
```

> **注意**：`q` 为空时返回 `{"resources": [], "achievements": []}`。

---

## 11. 栅格数据接口

### 11.1 获取栅格数据集列表

```
GET /api/raster/datasets/
```

**认证**：需要，权限 `core.browse_data`

**响应** `200 OK`：

```json
{
  "items": [
    {
      "id": 1,
      "name": "DEM 高程数据",
      "code": "dem_elevation",
      "status": "ready",
      "sourcePath": "raw/dem.tif",
      "processedPath": "processed/dem_cog.tif",
      "sourceMetadataPath": "raw/dem.json",
      "processedMetadataPath": "processed/dem_cog.json",
      "dataResourceId": 5,
      "mapLayerId": 3,
      "bandCount": 1,
      "bounds3857": [9700000, 5020000, 9850000, 5120000],
      "bounds4326": [87.12, 41.25, 88.95, 42.10],
      "imageCoordinates": [[87.12, 42.10], [88.95, 42.10], [88.95, 41.25], [87.12, 41.25]],
      "defaultRules": { "mode": "grayscale", "band": 1 },
      "sourceFileSize": 104857600,
      "processedFileSize": 52428800,
      "progressLog": "导入完成",
      "errorMessage": "",
      "importedAt": "2026-05-28T10:00:00+08:00",
      "processedAt": "2026-05-28T10:05:00+08:00",
      "metadata": {
        "size": [5120, 5120],
        "driver": "GTiff",
        "coordinateSystem": "32644",
        "bands": [
          {
            "band": 1,
            "type": "Float32",
            "description": "Band 1",
            "colorInterpretation": "Gray",
            "min": 1200.0,
            "max": 4500.0,
            "isInteger": false
          }
        ]
      }
    }
  ]
}
```

### 11.2 导入栅格文件

```
POST /api/raster/import/
```

**认证**：需要，权限 `raster.manage_raster_dataset` 或 `catalog.maintain_dataresource`

**请求体**：

```json
{
  "sourcePath": "raw/new_dem.tif",
  "name": "新 DEM 数据",
  "async": true
}
```

| 字段         | 类型     | 必填 | 说明                                   |
| ------------ | -------- | ---- | -------------------------------------- |
| `sourcePath` | `string` | 是   | 源文件相对路径（相对于研究数据根目录） |
| `name`       | `string` | 否   | 数据集名称，默认取文件名               |
| `async`      | `bool`   | 否   | 是否异步执行，默认 `true`              |

**响应** `202 Accepted`（异步模式）：

```json
{
  "id": "b2c3d4e5f6...",
  "kind": "import",
  "status": "queued",
  "progressPercent": 0,
  "messages": [],
  "result": null,
  "error": "",
  "startedAt": 1717142400.0,
  "finishedAt": null
}
```

**响应** `201 Created`（同步模式，`async: false`）：

```json
{
  "id": 2,
  "name": "新 DEM 数据",
  "code": "new_dem_data",
  "status": "ready",
  "sourcePath": "raw/new_dem.tif",
  "processedPath": "processed/new_dem_cog.tif",
  "..." : "..."
}
```

**错误响应**：

| 状态码 | 原因           | 示例                               |
| ------ | -------------- | ---------------------------------- |
| 400    | 缺少 sourcePath | `{"detail": "缺少 sourcePath"}`   |
| 400    | 文件不存在     | `{"detail": "源文件不存在：..."}`  |
| 403    | 权限不足       | `{"detail": "当前用户组"xxx"无权限"}` |

### 11.3 扫描栅格源目录

扫描研究数据目录中的未处理栅格文件，自动创建数据集。

```
POST /api/raster/scan/
```

**认证**：需要，权限 `core.browse_data`

**请求体**：

```json
{}
```

**响应** `202 Accepted`：

```json
{
  "id": "c3d4e5f6...",
  "kind": "scan",
  "status": "queued",
  "progressPercent": 0,
  "messages": [],
  "result": null,
  "error": "",
  "startedAt": 1717142400.0,
  "finishedAt": null
}
```

任务完成后 `result` 为：

```json
{
  "items": [ "RasterDataset[]" ],
  "count": 3
}
```

### 11.4 注册栅格渲染样式（同步）

为栅格图层注册瓦片样式并返回 XYZ 瓦片 URL。

```
POST /api/raster/render/
```

**认证**：需要，权限 `core.load_raster_layer`（`rulesMode=custom` 时额外需要 `core.custom_symbolization`）

**请求体**：

```json
{
  "layerId": 3,
  "rulesMode": "default",
  "rules": null
}
```

| 字段        | 类型                   | 必填 | 说明                              |
| ----------- | ---------------------- | ---- | --------------------------------- |
| `layerId`   | `int`                  | 是   | 栅格图层 ID                       |
| `rulesMode` | `"default"\|"custom"`  | 否   | 符号化规则模式，默认 `"default"`  |
| `rules`     | `object\|null`         | 条件 | `custom` 模式下的自定义规则       |

**响应** `200 OK`：

```json
{
  "delivery": "xyz",
  "datasetId": 1,
  "layerId": 3,
  "styleHash": "a1b2c3d4",
  "tileUrl": "/api/raster/tiles/1/a1b2c3d4/{z}/{x}/{y}.png",
  "status": "ready",
  "bounds3857": [9700000, 5020000, 9850000, 5120000],
  "bounds4326": [87.12, 41.25, 88.95, 42.10],
  "imageCoordinates": [[87.12, 42.10], [88.95, 42.10], [88.95, 41.25], [87.12, 41.25]],
  "rules": { "mode": "grayscale", "band": 1 }
}
```

**错误响应**：

| 状态码 | 原因                   | 示例                                           |
| ------ | ---------------------- | ---------------------------------------------- |
| 400    | 无预处理数据集         | `{"detail": "该图层没有已预处理的栅格数据集"}` |
| 403    | 无权访问               | `{"detail": "无权访问该图层"}`                 |

### 11.5 异步注册栅格渲染样式

```
POST /api/raster/render/async/
```

**认证**：需要，权限 `core.load_raster_layer`

**请求体**：

```json
{
  "layerId": 3,
  "datasetId": null,
  "rulesMode": "default",
  "rules": null
}
```

| 字段        | 类型          | 必填 | 说明                                  |
| ----------- | ------------- | ---- | ------------------------------------- |
| `layerId`   | `int\|null`   | 条件 | 图层 ID，与 `datasetId` 至少填一个    |
| `datasetId` | `int\|null`   | 条件 | 数据集 ID，与 `layerId` 至少填一个    |
| `rulesMode` | `string`      | 否   | `"default"` 或 `"custom"`             |
| `rules`     | `object\|null`| 条件 | 自定义符号化规则                      |

**响应** `202 Accepted`：

```json
{
  "id": "d4e5f6...",
  "kind": "render",
  "status": "queued",
  "progressPercent": 0,
  "messages": [],
  "result": null,
  "error": "",
  "startedAt": 1717142400.0,
  "finishedAt": null
}
```

### 11.6 获取栅格唯一值分类

获取指定栅格数据集某一波段的唯一值列表，用于唯一值符号化。

```
POST /api/raster/unique-values/
```

**认证**：需要，权限 `core.custom_symbolization`

**请求体**：

```json
{
  "datasetId": 1,
  "band": 1
}
```

| 字段        | 类型  | 必填 | 说明           |
| ----------- | ----- | ---- | -------------- |
| `datasetId` | `int` | 是   | 数据集 ID      |
| `band`      | `int` | 否   | 波段号，默认 1 |

**响应** `200 OK`：

```json
{
  "band": 1,
  "items": [
    { "value": 0, "color": "#000000", "label": "无数据" },
    { "value": 1, "color": "#228B22", "label": "胡杨林" },
    { "value": 2, "color": "#FFD700", "label": "灌木" },
    { "value": 3, "color": "#8B4513", "label": "裸地" }
  ]
}
```

### 11.7 获取 XYZ 瓦片

获取渲染后的栅格 PNG 瓦片，供 Mapbox GL JS 消费。

```
GET /api/raster/tiles/{dataset_id}/{style_hash}/{z}/{x}/{y}.png
```

**认证**：需要，权限 `core.load_raster_layer`

**路径参数**：

| 参数         | 类型     | 说明                    |
| ------------ | -------- | ----------------------- |
| `dataset_id` | `int`    | 栅格数据集 ID           |
| `style_hash` | `string` | 样式哈希（来自渲染结果）|
| `z`          | `int`    | 缩放级别                |
| `x`          | `int`    | 瓦片列号                |
| `y`          | `int`    | 瓦片行号                |

**响应** `200 OK`：二进制 PNG 图片（`image/png`）

**错误响应**：

| 状态码 | 原因           | 示例                               |
| ------ | -------------- | ---------------------------------- |
| 404    | 数据集不存在   | `{"detail": "未找到..."}`          |
| 404    | 渲染失败       | `{"detail": "..."}`                |
| 403    | 无权访问       | `{"detail": "无权访问该数据资源"}` |

---

## 12. 异步任务接口

### 12.1 查询异步任务状态

所有异步操作（栅格导入、扫描、渲染、导出）均返回统一的任务对象，通过此接口轮询状态。

```
GET /api/raster/jobs/{job_id}/
```

**认证**：需要（任何已认证用户）

**路径参数**：

| 参数     | 类型     | 说明     |
| -------- | -------- | -------- |
| `job_id` | `string` | 任务 ID  |

**响应** `200 OK`：

```json
{
  "id": "a1b2c3d4e5f6...",
  "kind": "render",
  "status": "running",
  "progressPercent": 45,
  "messages": [
    "开始栅格符号化",
    "读取 COG 数据...",
    "生成瓦片 45/100"
  ],
  "result": null,
  "error": "",
  "startedAt": 1717142400.0,
  "finishedAt": null
}
```

**任务对象字段说明**：

| 字段              | 类型                  | 说明                                        |
| ----------------- | --------------------- | ------------------------------------------- |
| `id`              | `string`              | 任务唯一标识（UUID hex）                    |
| `kind`            | `string`              | 任务类型：`import` / `scan` / `render` / `export` |
| `status`          | `string`              | 状态：`queued` → `running` → `ready` / `failed` |
| `progressPercent` | `int`                 | 进度百分比（0–100）                         |
| `messages`        | `string[]`            | 进度消息队列（最多 120 条）                 |
| `result`          | `object\|null`        | 任务完成后的结果数据                        |
| `error`           | `string`              | 失败时的错误信息                            |
| `startedAt`       | `float`               | 开始时间（Unix 时间戳）                     |
| `finishedAt`      | `float\|null`         | 完成时间（Unix 时间戳）                     |

**任务类型与 result 对应关系**：

| `kind`   | `result` 类型                          |
| -------- | -------------------------------------- |
| `import` | `RasterDataset` 对象                   |
| `scan`   | `{ items: RasterDataset[], count: int }` |
| `render` | `RasterRenderResult` 对象              |
| `export` | `{ filename: string, downloadUrl: string }` |

**错误响应**：

| 状态码 | 原因       | 示例                                   |
| ------ | ---------- | -------------------------------------- |
| 404    | 任务不存在 | `{"detail": "任务不存在或已过期"}`     |

---

## 13. 后台管理

### 13.1 Django Admin

```
GET /admin/
```

**认证**：需要，权限 `core.access_admin`（由中间件强制校验）

Django Admin 提供所有模型的完整 CRUD 管理界面，包括：

- 用户管理（Django 内建）
- 用户组/角色管理（含功能权限分配）
- 系统设置（`SystemSetting` 单例）
- 数据字典（`DictionaryItem`）
- 数据资源（`DataResource`）
- 数据目录（`DataCatalog`）
- 地图图层（`MapLayer`）
- 研究成果（`Achievement`）
- 栅格数据集（`RasterDataset`）
- 操作日志（`OperationLog`，只读）

---

## 14. 使用示例

### 14.1 JavaScript / Fetch

```javascript
// 1. 获取 CSRF Token
await fetch("/api/auth/csrf/", { credentials: "include" });

// 2. 登录
const loginRes = await fetch("/api/auth/login/", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": getCookie("csrftoken"),
  },
  body: JSON.stringify({
    username: "admin",
    password: "password",
    remember: true,
  }),
});
const { user } = await loginRes.json();

// 3. 获取数据资源列表
const resourcesRes = await fetch("/api/catalog/resources/?dataType=vector", {
  credentials: "include",
});
const { items } = await resourcesRes.json();

// 4. 查询矢量数据
const queryRes = await fetch("/api/catalog/resources/1/query/", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": getCookie("csrftoken"),
  },
  body: JSON.stringify({
    attributeFilters: [
      { field: "species", operator: "eq", value: "Populus euphratica" },
    ],
    spatialFilter: null,
    limit: 5000,
  }),
});
const result = await queryRes.json();

// 5. 异步渲染栅格并轮询
const renderRes = await fetch("/api/raster/render/async/", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": getCookie("csrftoken"),
  },
  body: JSON.stringify({ layerId: 3, rulesMode: "default" }),
});
const job = await renderRes.json();

// 轮询任务状态
const poll = setInterval(async () => {
  const res = await fetch(`/api/raster/jobs/${job.id}/`, {
    credentials: "include",
  });
  const status = await res.json();
  if (status.status === "ready") {
    clearInterval(poll);
    const tileUrl = status.result.tileUrl;
    // 使用 tileUrl 加载 Mapbox 瓦片图层
  }
}, 1000);

// 辅助函数：读取 Cookie
function getCookie(name) {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}
```

### 14.2 cURL

```bash
# 获取 CSRF Cookie
curl -c cookies.txt http://localhost:8000/api/auth/csrf/

# 登录
curl -b cookies.txt -c cookies.txt \
  -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $(grep csrftoken cookies.txt | awk '{print $NF}')" \
  -d '{"username":"admin","password":"password","remember":true}'

# 获取数据目录
curl -b cookies.txt http://localhost:8000/api/catalog/directories/

# 搜索
curl -b cookies.txt "http://localhost:8000/api/search/?q=%E8%83%A1%E6%9D%A8"

# 获取当前用户
curl -b cookies.txt http://localhost:8000/api/auth/me/
```

### 14.3 Python / Requests

```python
import requests

base = "http://localhost:8000"
session = requests.Session()

# 获取 CSRF Token
session.get(f"{base}/api/auth/csrf/")

# 登录
resp = session.post(f"{base}/api/auth/login/", json={
    "username": "admin",
    "password": "password",
    "remember": True,
})
user = resp.json()["user"]

# 获取数据资源
resp = session.get(f"{base}/api/catalog/resources/", params={"dataType": "vector"})
resources = resp.json()["items"]

# 查询矢量数据
resp = session.post(f"{base}/api/catalog/resources/1/query/", json={
    "attributeFilters": [
        {"field": "species", "operator": "eq", "value": "Populus euphratica"}
    ],
    "spatialFilter": None,
    "limit": 5000,
})
result = resp.json()
```

---

## 15. 版本控制与变更历史

### 15.1 版本策略

- 遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)（语义化版本）
- 格式：`MAJOR.MINOR.PATCH`
  - **MAJOR**：不兼容的 API 变更
  - **MINOR**：新增向后兼容的功能
  - **PATCH**：向后兼容的缺陷修复
- API 版本信息记录在 `backend/pyproject.toml` 中

### 15.2 变更历史

#### v0.1.0（2026-05-28）

初始版本，包含以下 API 模块：

- **认证**：登录、注册、登出、当前用户查询、CSRF
- **数据目录**：目录树、资源列表、资源详情、矢量查询、数据导出（同步/异步）
- **图层**：图层列表、GeoJSON 要素获取
- **研究成果**：成果列表
- **搜索**：全局搜索
- **栅格**：数据集列表、导入、扫描、渲染（同步/异步）、唯一值分类、XYZ 瓦片服务
- **异步任务**：统一任务状态查询
- **后台管理**：Django Admin 全模型 CRUD

### 15.3 向后兼容承诺

- PATCH 版本更新不会改变现有端点的行为或响应格式
- MINOR 版本更新可能新增端点或可选字段，但不会破坏现有接口
- MAJOR 版本更新可能移除或修改现有端点，需查阅具体变更说明

---

## 附录 A：数据模型参考

### User

| 字段          | 类型     | 说明       |
| ------------- | -------- | ---------- |
| `id`          | `int`    | 用户 ID    |
| `username`    | `string` | 用户名     |
| `displayName` | `string` | 显示名     |
| `email`       | `string` | 邮箱       |
| `isStaff`     | `bool`   | 是否员工   |
| `isSuperuser` | `bool`   | 是否超管   |
| `roles`       | `string[]` | 用户组名列表 |
| `permissions` | `object` | 功能权限映射 |

### DataResource

| 字段             | 类型                   | 说明                                    |
| ---------------- | ---------------------- | --------------------------------------- |
| `id`             | `int`                  | 资源 ID                                 |
| `name`           | `string`               | 资源名称                                |
| `code`           | `string`               | 资源编码                                |
| `dataType`       | `string`               | 类型：`vector` / `raster` / `gene` / `table` / `document` / `image` |
| `category`       | `DictionaryItem\|null` | 分类字典项                              |
| `source`         | `string`               | 数据来源                                |
| `provider`       | `string`               | 数据提供者                              |
| `dataDate`       | `string\|null`         | 数据日期（ISO 8601）                    |
| `spatialExtent`  | `string`               | 空间范围描述                            |
| `coordinateSystem` | `string`             | 坐标系                                  |
| `fileFormat`     | `string`               | 文件格式                                |
| `description`    | `string`               | 描述                                    |
| `qualityNote`    | `string`               | 质量说明                                |
| `status`         | `string`               | 状态：`active` / `inactive`             |
| `isQueryable`    | `bool`                 | 是否可查询（矢量且有存储路径）          |
| `isRenderable`   | `bool`                 | 是否可渲染（栅格且有存储路径）          |
| `updatedAt`      | `ISO 8601`             | 更新时间                                |

### DictionaryItem

| 字段   | 类型     | 说明       |
| ------ | -------- | ---------- |
| `id`   | `int`    | 字典项 ID  |
| `type` | `string` | 字典类型   |
| `code` | `string` | 编码       |
| `name` | `string` | 名称       |

### MapLayer

| 字段             | 类型     | 说明                                  |
| ---------------- | -------- | ------------------------------------- |
| `id`             | `int`    | 图层 ID                               |
| `name`           | `string` | 图层名称                              |
| `code`           | `string` | 图层编码                              |
| `layerType`      | `string` | 类型：`vector` / `raster`             |
| `geometryType`   | `string` | 几何类型：`point` / `line` / `polygon` / `mixed` |
| `category`       | `object\|null` | 分类字典项                      |
| `dataResourceId` | `int\|null` | 关联数据资源 ID                     |
| `sortOrder`      | `int`    | 排序序号                              |
| `defaultVisible` | `bool`   | 默认是否可见                          |
| `defaultOpacity` | `int`    | 默认透明度（0–100）                   |
| `symbolization`  | `object` | 符号化配置                            |
| `bounds`         | `float[]` | 空间范围 [minX, minY, maxX, maxY]   |
| `legend`         | `string` | 图例标识                              |
| `rasterRules`    | `object` | 栅格渲染规则                          |
| `isActive`       | `bool`   | 是否激活                              |
| `updatedAt`      | `ISO 8601` | 更新时间                            |

### Achievement

| 字段           | 类型               | 说明           |
| -------------- | ------------------ | -------------- |
| `id`           | `int`              | 成果 ID        |
| `title`        | `string`           | 成果标题       |
| `code`         | `string`           | 成果编码       |
| `category`     | `DictionaryItem\|null` | 分类       |
| `summary`      | `string`           | 摘要           |
| `source`       | `string`           | 来源           |
| `relatedLayerId` | `int\|null`     | 关联图层 ID    |
| `displayOrder` | `int`              | 显示排序       |
| `status`       | `string`           | 状态：`draft` / `published` / `archived` |
| `updatedAt`    | `ISO 8601`         | 更新时间       |

### RasterDataset

| 字段                     | 类型       | 说明                                    |
| ------------------------ | ---------- | --------------------------------------- |
| `id`                     | `int`      | 数据集 ID                               |
| `name`                   | `string`   | 名称                                    |
| `code`                   | `string`   | 编码                                    |
| `status`                 | `string`   | 状态：`pending` / `processing` / `ready` / `failed` |
| `sourcePath`             | `string`   | 源文件相对路径                          |
| `processedPath`          | `string`   | 处理后文件相对路径                      |
| `sourceMetadataPath`     | `string`   | 源元数据路径                            |
| `processedMetadataPath`  | `string`   | 处理后元数据路径                        |
| `dataResourceId`         | `int\|null` | 关联数据资源 ID                         |
| `mapLayerId`             | `int\|null` | 关联图层 ID                             |
| `bandCount`              | `int`      | 波段数                                  |
| `bounds3857`             | `float[]`  | EPSG:3857 范围                          |
| `bounds4326`             | `float[]`  | EPSG:4326 范围                          |
| `imageCoordinates`       | `array`    | 图像四角坐标 [[x,y], ...]               |
| `defaultRules`           | `object`   | 默认渲染规则                            |
| `sourceFileSize`         | `int`      | 源文件大小（字节）                      |
| `processedFileSize`      | `int`      | 处理后文件大小（字节）                  |
| `progressLog`            | `string`   | 进度日志                                |
| `errorMessage`           | `string`   | 错误信息                                |
| `importedAt`             | `ISO 8601\|null` | 导入时间                        |
| `processedAt`            | `ISO 8601\|null` | 处理完成时间                    |
| `metadata`               | `object`   | GDAL 元数据（见下方）                   |

**metadata 结构**：

```json
{
  "size": [5120, 5120],
  "driver": "GTiff",
  "coordinateSystem": "32644",
  "bands": [
    {
      "band": 1,
      "type": "Float32",
      "description": "Band 1",
      "colorInterpretation": "Gray",
      "min": 1200.0,
      "max": 4500.0,
      "isInteger": false
    }
  ]
}
```

### RasterRenderResult

| 字段              | 类型       | 说明                          |
| ----------------- | ---------- | ----------------------------- |
| `delivery`        | `string`   | 始终为 `"xyz"`                |
| `datasetId`       | `int`      | 数据集 ID                     |
| `layerId`         | `int\|null` | 图层 ID                      |
| `styleHash`       | `string`   | 样式哈希（用于瓦片 URL）      |
| `tileUrl`         | `string`   | XYZ 瓦片 URL 模板             |
| `status`          | `string`   | 渲染状态                      |
| `bounds3857`      | `float[]`  | EPSG:3857 范围                |
| `bounds4326`      | `float[]`  | EPSG:4326 范围                |
| `imageCoordinates`| `array`    | 图像四角坐标                  |
| `rules`           | `object`   | 生效的渲染规则                |

---

> 本文档由源码分析自动生成，反映当前代码库的实际 API 实现。如有疑问请查阅后端源码 `backend/apps/` 目录。
