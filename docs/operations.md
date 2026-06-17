# 开发、测试与部署手册

本文档收敛本地环境、常用验证命令、测试约束和 Linux Docker 部署说明。产品与架构约束见 `docs/design-docs.md`，API 契约见 `docs/openapi.yaml`，接口使用说明见 `docs/developer-guide.md`。

## 本地环境

前端使用 Node.js 和 pnpm，禁止使用 npm 运行项目脚本。

```bash
cd frontend
pnpm install
pnpm dev
```

后端使用 Pixi 管理 Python、Django、GDAL、GeoPandas、Rasterio 等运行依赖。首次运行或依赖变化后先安装 Pixi 环境：

```bash
cd backend
pixi install
pixi run migrate
pixi run dev
```

默认开发配置使用 `config/app.test.toml`。业务数据根目录和科研数据根目录只从 TOML 读取，代码、业务数据和科研数据必须分离。

常用前端命令：

```bash
cd frontend
pnpm run check:api
pnpm test
pnpm run check
pnpm run typecheck
pnpm run build
```

常用后端命令：

```bash
cd backend
pixi run test
pixi run format
pixi run lint
```

## API 与 Mock

`docs/openapi.yaml` 是唯一权威 API 契约。修改接口、响应字段、状态码、权限或认证行为时，同步更新 `docs/developer-guide.md` 和 `docs/api-change-requests.md`，并重新生成前端类型。

```bash
cd frontend
pnpm run generate:api
pnpm run check:api
pnpm run api:changes:check
pnpm run api:docs
pnpm run api:lint
```

前端生成的 Redoc HTML 和 OpenAPI bundle 输出到 `frontend/generated/`。Prism mock 输入文件由 `pnpm run mock:build` 生成到 `mock/prism/openapi.prism.json`，示例数据维护在 `mock/prism/examples/*.json`。

```bash
cd frontend
pnpm run mock:build
pnpm run mock:api
pnpm run dev:mock
```

也可以同时启动 Prism 和 Vite：

```bash
cd frontend
pnpm run dev:with-mock
```

## 测试分层

后端测试使用 pytest + pytest-django：

- `backend/tests/unit/` 覆盖配置加载、路径约束、字段规范化、查询过滤、栅格规则、瓦片坐标、进度解析等纯逻辑。
- `backend/tests/integration/` 使用 Django test client 覆盖认证、权限、目录、图层、导入、导出、栅格和后台管理 API。
- 需要文件、GeoPackage、SQLite 或上传样本时，测试必须使用临时目录或测试内创建的小样本，不依赖真实业务或科研数据目录。

前端测试使用 Vitest、Testing Library 和 happy-dom：

- 工具函数、API 客户端、Mapbox 样式辅助函数和 hooks 走单元测试。
- 关键登录、路由和权限门禁流程通过挂载完整 React 应用并 mock 后端 API 覆盖。
- 真实浏览器、地图交互或 WebGL 行为需要独立引入 Playwright 等浏览器 E2E，不混入稳定 CI 测试。

提交前至少运行：

```bash
cd backend
pixi run test

cd ../frontend
pnpm run check:api
pnpm test
```

涉及 TypeScript、格式、lint 或构建时，补充运行：

```bash
cd frontend
pnpm run check
pnpm run typecheck
pnpm run build:verify
```

## Docker 部署

Linux 部署使用单个 Docker 镜像和 TOML 配置。镜像构建使用 `backend/pixi.lock` 创建后端运行环境，不需要配置文件；配置只在容器运行时通过 `/config/app.toml` 挂载提供。镜像内由 Gunicorn 运行 Django WSGI 应用，Django 同时提供 `/api/` 接口和前端 Vite 构建产物；对公网关、HTTPS 和域名由宿主机上的反向代理自行配置。业务数据和科研数据保存在同一个 Docker 数据卷 `huyang-data` 中，并挂载到容器内 `/data`。

容器内固定路径：

- 程序目录：`/opt/app`
- 后端目录：`/opt/app/backend`
- 后端 Pixi 环境：`/opt/app/backend/.pixi/envs/default`
- 前端构建产物：`/opt/app/frontend/dist`
- 默认输入配置：`/config/app.toml`
- 默认业务数据根目录：`/data/app`
- 默认科研数据根目录：`/data/research`

Docker 容器内配置示例见 `config/app.docker.toml`。其中容器内路径、Gunicorn 绑定和默认运行参数已经固化；通常只需要按部署环境调整 `allowed_hosts`、`csrf_trusted_origins`、`http_port`、`gunicorn_workers` 和 `mapbox_access_token`。

手动 `docker run` 时，挂载到 `/config/app.toml` 的配置应使用容器内数据路径 `/data/app` 和 `/data/research`。业务数据和科研数据使用同一个 Docker named volume，不需要映射宿主机目录。

构建和启动：

```bash
docker build -t data-platform-django:latest .

docker volume create huyang-data

docker run -d --name data-platform \
  -p 80:8000 \
  -v /srv/data-platform/app.toml:/config/app.toml \
  -v huyang-data:/data \
  data-platform-django:latest serve /config/app.toml
```

Docker 配置中的数据目录应直接使用容器内路径 `/data/app` 和 `/data/research`。如需按配置里的 `runtime.http_port` 暴露端口，先在宿主机读取 TOML 配置并替换 `docker run -p` 的宿主机端口。

默认数据卷名称为 `huyang-data`。如需改名，直接创建并挂载新的 Docker volume：

```bash
docker volume create data-platform-data
docker run -d --name data-platform \
  -p 80:8000 \
  -v /srv/data-platform/app.toml:/config/app.toml \
  -v data-platform-data:/data \
  data-platform-django:latest serve /config/app.toml
```

重建容器不会删除数据卷。如需备份、迁移或删除数据，请直接操作对应 Docker volume。

系统以挂载的源配置文件 `/config/app.toml` 作为运行配置和后台设置写入目标。`django_secret_key` 自动生成并持久化到业务数据目录的 `database/.secret_key`，由后端专用文件管理。

## 数据目录

业务数据根目录固定子目录：

```text
database/
media/
uploads/
exports/
logs/
static/
config/
```

科研数据根目录固定子目录：

```text
vector/
raster/
  original/
  preprocessed/
  metadata/
    source/
    preprocessed/
gene/
table/
```

GeoPackage 矢量数据放入科研数据根目录的 `vector/`，原始栅格数据放入 `raster/original/`，基因数据放入 `gene/`，表格数据放入 `table/`。栅格符号化在后端完成，前端只加载后端生成的 XYZ 或 PNG 结果。

## 常见问题

- pnpm 依赖异常：运行 `pnpm store prune` 后删除 `node_modules/` 并重新 `pnpm install`。
- Pixi 环境创建失败：运行 `pixi clean cache -y` 后重新执行 `cd backend && pixi install`。
- GDAL 相关错误：确认命令通过 `pixi run ...` 执行，并检查 `backend/pixi.toml` 与 `backend/pixi.lock` 是否包含 `gdal`、`geopandas`、`rasterio`。
- 权限问题：不要用 `sudo` 运行 pnpm 或 Pixi，优先检查安装路径和目录权限。
