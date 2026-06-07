# 测试说明

本文档说明当前项目测试体系、覆盖范围、运行命令和 CI/CD 稳定性要求。测试必须使用项目已经采用的框架：后端使用 pytest + pytest-django，前端使用 Vitest、Testing Library 和 happy-dom。

## 测试分层

### 后端单元测试

后端单元测试位于 `backend/tests/unit/`，覆盖不依赖数据库或真实大文件的纯逻辑：

- `apps.core`：配置加载、固定目录约束、权限定义和权限判定。
- `apps.catalog`：导入字段规范化、表名校验、字段元数据、查询过滤、导出参数校验。
- `apps.raster`：栅格规则归一化、色带映射、瓦片坐标、进度解析、异步任务状态机。
- `apps.audit`：审计日志模型、IP 提取和匿名用户日志记录。

这类测试标记为 `unit`，应避免不必要的数据库初始化。

### 后端集成测试

后端集成测试位于 `backend/tests/integration/`，通过 Django test client 覆盖 API 权限、请求/响应和存储边界：

- 登录、注册、bootstrap、后台权限入口、超级管理员初始化、用户组权限继承、个人权限偏好和密码修改。
- 数据目录、图层列表、资源 profile/query、空间和属性查询。
- Excel/CSV 导入预览、校验、提交，包含非法坐标、字段选择和元数据写入。
- 数据导出权限、GeoJSON ZIP 输出。
- 栅格渲染、扫描、数据集列表和资源访问控制。

这类测试标记为 `integration` 和 `django_db`。涉及 GeoPackage、SQLite 或上传文件的测试应使用临时测试数据，并在测试结束后清理文件；不要依赖本地生产或演示数据。

### 前端单元测试

前端单元测试覆盖独立工具函数、API 客户端和 hook 状态逻辑：

- `src/utils`：几何构造、边界计算、图层组创建和资源显示辅助函数。
- `src/map`：Mapbox 样式辅助函数，不启动真实 WebGL 地图。
- `src/symbolization.ts`：默认符号化、深拷贝和栅格规则转换。
- `src/api/client.ts`：CSRF、JSON/FormData 请求头、错误对象、导出文件名和资源端点选择。
- `src/hooks`：图层组增删改、重排和栅格图层专用更新。

### 前端关键流程 E2E 测试

当前 CI 级 E2E 测试使用 Vitest + Testing Library 在 happy-dom 中挂载完整 React 应用，mock 后端 API，覆盖关键用户路径：

- 未登录用户访问受保护页面时进入登录页。
- 登录提交后进入业务首页。
- 普通用户不能进入后台路由。
- 具备后台权限的用户可看到管理后台卡片；具备维护权限的后台用户可在后台菜单中进入数据导入。

这类测试不启动真实后端和浏览器，目的是稳定覆盖前端路由、应用初始化和权限门禁。需要真实浏览器、地图交互或 WebGL 行为时，再单独引入 Playwright 等浏览器 E2E，并将其放在独立 CI job 中。

## 本地运行命令

后端：

```bash
cd backend
eval "$(mamba shell hook --shell zsh)" && mamba activate geomanager
python -m pytest
ruff format .
```

前端：

```bash
cd frontend
pnpm run check:api
pnpm test
pnpm check
pnpm typecheck
```

全量验证建议顺序：

```bash
cd backend
eval "$(mamba shell hook --shell zsh)" && mamba activate geomanager
python -m pytest
ruff format .

cd ../frontend
pnpm run check:api
pnpm test
pnpm check
pnpm typecheck
```

## CI/CD 稳定性要求

- CI 必须使用 `pnpm`，不要使用 `npm` 安装或运行前端依赖。
- 后端测试必须先激活 `geomanager` Python 环境，确保 Django、GeoPandas、GDAL、Rasterio、pytest-django 等依赖可用。
- 测试不得依赖真实业务数据目录或研究数据目录中的已有文件；需要文件时使用临时目录或测试内创建的小样本。
- 栅格导入、GDAL 命令、异步任务线程和网络请求应使用 mock 或小样本隔离，避免 CI 超时和非确定性失败。
- 前端测试不要访问真实 `/api` 服务；API 行为通过 mock 或 `fetch` stub 覆盖。
- 新增或修改后端 API 时，必须同步更新 `docs/openapi.yaml` 和 `docs/developer-guide.md`，运行 `pnpm run generate:api` 更新前端类型，并补充对应 API 测试。
- 提交前至少运行后端 `python -m pytest` 和前端 `pnpm run check:api`、`pnpm test`。涉及 TypeScript 类型、格式或 lint 规则时，同时运行 `pnpm check` 和 `pnpm typecheck`。
