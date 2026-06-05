# OpenAPI 规范标准

> 中亚胡杨林生态系统保护数据共享平台 — API 接口规范强制标准

## 1. 概述

本项目采用 **OpenAPI 3.1.0** 作为 API 接口的统一规范标准。所有新增和现有 API 接口必须严格遵循此规范。

### 1.1 规范文件位置

- **OpenAPI 定义文件**：`docs/openapi.yaml`
- **本文档**：`docs/openapi-standards.md`（规范标准说明）

### 1.2 参考规范

- [OpenAPI 官方规范（中文版）](https://openapi.apifox.cn/)
- [OpenAPI 3.1.0 官方文档](https://spec.openapis.org/oas/v3.1.0)

---

## 2. 强制规范要求

### 2.1 接口定义规范

#### 路径命名
- 使用小写字母和连字符（kebab-case）
- 使用名词复数形式表示资源集合
- 示例：`/api/catalog/resources/`、`/api/raster/datasets/`

#### HTTP 方法
| 方法 | 用途 | 幂等性 | 请求体 |
|------|------|--------|--------|
| GET | 获取资源 | 是 | 否 |
| POST | 创建资源/执行操作 | 否 | 是 |
| PUT | 全量更新 | 是 | 是 |
| DELETE | 删除资源 | 是 | 否 |

#### operationId 规范
- 每个操作必须有唯一的 `operationId`
- 使用 camelCase 命名
- 示例：`getResources`、`importCommit`、`renderRasterAsync`

### 2.2 参数校验规范

#### 路径参数
```yaml
parameters:
  - name: id
    in: path
    required: true
    schema:
      type: integer
    description: 资源 ID
```

#### 查询参数
```yaml
parameters:
  - name: dataType
    in: query
    schema:
      type: string
      enum: [vector, raster, gene, table, document, image]
    description: 数据类型筛选
```

#### 请求体
- 使用 `$ref` 引用 `components/schemas` 中定义的 Schema
- 必须字段使用 `required` 数组声明
- 提供完整的字段描述

### 2.3 响应格式规范

#### 成功响应
- GET 请求：`200 OK`
- POST 创建资源：`201 Created`
- POST 异步任务：`202 Accepted`

#### 响应结构
```yaml
responses:
  '200':
    description: 成功
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/SuccessResponse'
```

#### 统一错误响应
```yaml
ErrorResponse:
  type: object
  required: [detail]
  properties:
    detail:
      type: string
      description: 错误描述信息
```

### 2.4 错误处理规范

| 状态码 | 含义 | 使用场景 |
|--------|------|----------|
| 400 | 请求错误 | 参数校验失败、业务逻辑错误 |
| 401 | 未认证 | 未登录或 Session 过期 |
| 403 | 权限不足 | 缺少功能权限或数据访问权限 |
| 404 | 资源不存在 | ID 不存在、文件缺失 |
| 409 | 冲突 | 异步任务未完成时尝试操作 |
| 500 | 服务器错误 | 未捕获异常 |

### 2.5 认证授权规范

#### 认证方式
```yaml
securitySchemes:
  sessionAuth:
    type: apiKey
    in: cookie
    name: sessionid
    description: Django Session Cookie
```

#### 权限声明
- 公共接口：不设置 `security`
- 需认证接口：设置 `security: [{ sessionAuth: [] }]`

#### CSRF 保护
- 所有 POST/PUT/DELETE 请求需携带 `X-CSRFToken` 请求头
- Token 从 `/api/auth/csrf/` 接口获取

---

## 3. Schema 定义规范

### 3.1 命名规范
- 使用 PascalCase 命名 Schema
- 示例：`DataResource`、`MapLayer`、`RasterDataset`

### 3.2 字段类型映射

| Python 类型 | OpenAPI 类型 | format |
|-------------|--------------|--------|
| int | integer | - |
| float | number | double |
| str | string | - |
| bool | boolean | - |
| datetime | string | date-time |
| date | string | date |
| list | array | - |
| dict | object | - |

### 3.3 可空字段
```yaml
nullable: true
```

### 3.4 枚举值
```yaml
dataType:
  type: string
  enum: [vector, raster, gene, table, document, image]
```

---

## 4. 文档维护规范

### 4.1 新增接口流程

1. **先定义 Schema**：在 `components/schemas` 中定义请求/响应的数据结构
2. **定义路径**：在 `paths` 中添加接口定义
3. **引用 Schema**：使用 `$ref` 引用已定义的 Schema
4. **添加标签**：为接口分配合适的 `tags`
5. **验证规范**：使用工具验证 OpenAPI 文档的正确性

### 4.2 修改接口流程

1. **更新 Schema**：修改相关的数据结构定义
2. **更新路径**：修改接口的参数、响应等定义
3. **同步文档**：确保 `docs/developer-guide.md` 与 `openapi.yaml` 保持一致
4. **版本更新**：在 `info.version` 中更新版本号

### 4.3 文档同步要求

- `openapi.yaml` 是 API 的权威定义
- `docs/developer-guide.md` 是人类可读的说明文档
- 两者必须保持同步，以 `openapi.yaml` 为准

---

## 5. 工具集成

### 5.1 推荐工具

| 用途 | 工具 |
|------|------|
| 文档生成 | Swagger UI、Redoc、Stoplight |
| 代码生成 | OpenAPI Generator |
| 规范验证 | Spectral、swagger-cli |
| API 测试 | Postman、Insomnia |

### 5.2 验证命令

```bash
# 安装 swagger-cli
npm install -g @apidevtools/swagger-cli

# 验证 OpenAPI 文档
swagger-cli validate docs/openapi.yaml

# 生成 HTML 文档
swagger-cli bundle docs/openapi.yaml -o docs/openapi-bundled.yaml -t yaml
```

---

## 6. 检查清单

### 6.1 新增接口检查项

- [ ] 路径命名符合规范（小写、连字符、复数）
- [ ] operationId 唯一且符合命名规范
- [ ] 所有参数有完整的 description
- [ ] 请求体 Schema 定义完整（类型、必填、枚举）
- [ ] 响应状态码正确（200/201/202）
- [ ] 错误响应包含 detail 字段
- [ ] 安全设置正确（公共接口无 security，需认证接口有 security）
- [ ] 标签分类正确

### 6.2 修改接口检查项

- [ ] Schema 更新与代码实现一致
- [ ] 响应格式与实际返回一致
- [ ] 版本号已更新
- [ ] developer-guide.md 文档已同步

---

## 7. 版本管理

### 7.1 版本号规则

遵循 [Semantic Versioning](https://semver.org/)：

- **MAJOR**：不兼容的 API 变更（删除接口、修改响应结构）
- **MINOR**：新增向后兼容的功能（新增接口、新增可选字段）
- **PATCH**：向后兼容的缺陷修复（文档修正、描述更新）

### 7.2 变更记录

每次版本更新需在 `CHANGELOG.md` 中记录变更内容。

---

## 8. 示例

### 8.1 完整接口定义示例

```yaml
/api/catalog/resources/:
  get:
    tags: [数据目录]
    summary: 获取数据资源列表
    description: 支持多条件筛选的数据资源分页列表
    operationId: getResources
    security:
      - sessionAuth: []
    parameters:
      - name: q
        in: query
        schema:
          type: string
        description: 按名称模糊搜索
      - name: dataType
        in: query
        schema:
          type: string
          enum: [vector, raster, gene, table, document, image]
        description: 数据类型筛选
    responses:
      '200':
        description: 成功
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ResourceListResponse'
      '401':
        $ref: '#/components/responses/Unauthorized'
      '403':
        $ref: '#/components/responses/Forbidden'
```

### 8.2 Schema 定义示例

```yaml
DataResource:
  type: object
  properties:
    id:
      type: integer
    name:
      type: string
    code:
      type: string
    dataType:
      type: string
      enum: [vector, raster, gene, table, document, image]
    category:
      $ref: '#/components/schemas/DictionaryItem'
    status:
      type: string
      enum: [active, inactive]
    updatedAt:
      type: string
      format: date-time
```

---

## 9. 常见问题

### Q1: 如何处理文件上传接口？

文件上传使用 `multipart/form-data` 格式：

```yaml
requestBody:
  required: true
  content:
    multipart/form-data:
      schema:
        type: object
        required: [file]
        properties:
          file:
            type: string
            format: binary
            description: 上传的文件
```

### Q2: 如何定义嵌套对象？

使用 `$ref` 引用或内联定义：

```yaml
# 使用 $ref 引用
category:
  $ref: '#/components/schemas/DictionaryItem'

# 内联定义
metadata:
  type: object
  properties:
    size:
      type: array
      items:
        type: integer
```

### Q3: 如何处理 GeoJSON 数据？

定义专门的 GeoJSON Schema：

```yaml
GeoJSONFeatureCollection:
  type: object
  properties:
    type:
      type: string
      example: FeatureCollection
    features:
      type: array
      items:
        $ref: '#/components/schemas/GeoJSONFeature'
```

---

> 本文档是项目 API 开发的强制标准，所有开发人员必须严格遵守。
