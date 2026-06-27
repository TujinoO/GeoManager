# 开发、测试与部署手册

本文档收敛本地环境、常用验证命令、测试约束和 Linux Docker 部署说明。产品与架构约束见 `docs/design-docs.md`，API 契约见 `docs/openapi.yaml`，接口使用说明见 `docs/developer-guide.md`。

## 本机登录凭据

本机已部署网页端的超级管理员账号：

```text
用户名：admin
密码：!XpuXrkU
```

说明：本密码已通过 Django 认证逻辑校验为当前 `admin` 账号的实际可登录密码。业务数据目录中的 `initial_superadmin_password.txt` 只代表初始化记录；如果后台再次修改过密码，以数据库实际认证结果为准。

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
- 超级管理员隔离回归测试覆盖用户列表、角色列表、日志查询、日志角色范围、上传人脱敏和访问角色过滤；新增权限隔离问题时优先在 `backend/tests/integration/core/test_api.py` 或对应应用集成测试中补充后端断言，确保敏感主体不从 API 返回。
- 权限安全回归需要覆盖组合入口，而不是只测单个接口。`FeaturePermissionTests::test_regular_admin_security_surfaces_do_not_serialize_superadmin_principals` 以非超级管理员身份连续读取用户、角色、操作日志和 Dashboard，断言响应集合中没有超级管理员账号、角色、Django superuser 或其日志摘要。

前端测试使用 Vitest、Testing Library 和 happy-dom：

- 工具函数、API 客户端、Mapbox 样式辅助函数和 hooks 走单元测试。
- 关键登录、路由和权限门禁流程通过挂载完整 React 应用并 mock 后端 API 覆盖。
- 后台认证授权和存量数据管理的权限隔离流程使用 `pnpm run test:browser -- src/admin/AdminRoutes.browser.test.tsx` 覆盖真实浏览器渲染，确认 API 已脱敏的超级管理员主体不会出现在 UI、抽屉或选择控件中。
- 长程用户体验回归使用 `pnpm run test:browser -- src/App.browser.test.tsx -t "long research user journey"`，从普通科研用户视角覆盖进入地图、选择资源、查询加载图层、查看图层范围开关、进入后台日志，并确认认证授权、系统设置、系统日志和超级管理员主体均不可见。
- 真实地图交互或 WebGL 行为需要独立引入 Playwright 等浏览器 E2E，不混入稳定 CI 测试。

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

Linux 部署使用单个 Docker 镜像和 TOML 配置。镜像构建使用 `backend/pixi.lock` 创建后端运行环境，不需要配置文件；配置只在容器运行时通过 `/config/app.toml` 挂载提供。镜像内由 Waitress 运行 Django WSGI 应用，Django 同时提供 `/api/` 接口和前端 Vite 构建产物；对公网关、HTTPS 和域名由宿主机上的反向代理自行配置。业务数据和科研数据保存在同一个 Docker 数据卷 `huyang-data` 中，并挂载到容器内 `/data`。

容器内固定路径：

- 程序目录：`/opt/app`
- 后端目录：`/opt/app/backend`
- 后端 Pixi 环境：`/opt/app/backend/.pixi/envs/default`
- 前端构建产物：`/opt/app/frontend/dist`
- 默认输入配置：`/config/app.toml`
- 默认业务数据根目录：`/data/app`
- 默认科研数据根目录：`/data/research`

Docker 容器内配置示例见 `config/app.docker.toml`。其中容器内路径、Waitress 监听地址和默认运行参数已经固化；通常只需要按部署环境调整 `allowed_hosts`、`csrf_trusted_origins`、`waitress_port`、`waitress_threads` 和 `mapbox_access_token`。

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

Docker 配置中的数据目录应直接使用容器内路径 `/data/app` 和 `/data/research`。`docker run -p` 的宿主机端口应与 `runtime.waitress_port` 保持一致，或按反向代理需求另行映射。

如果容器前面有 Nginx、Caddy、云负载均衡或 CDN，反向代理必须把源头客户端 IP 通过 `X-Forwarded-For`、`X-Real-IP`、`CF-Connecting-IP`、`True-Client-IP` 或标准 `Forwarded` 请求头传给后端。操作日志会优先从这些请求头中选择公网 IP；只有没有有效公网 IP 时才回退到 `REMOTE_ADDR`，此时 Docker 网桥环境可能显示为 `172.19.x.x` 之类的内网地址。

### Mapbox GL JS CSP

如部署侧启用 `Content-Security-Policy`，需要允许 Mapbox GL JS 的 worker、瓦片、glyph、sprite、样式和导出图片资源。当前前端使用依赖包中的 ESM 版 `mapbox-gl`，并已禁用 Mapbox events 采集，因此 CSP 至少应包含：

```text
worker-src 'self' blob:;
img-src 'self' data: blob: https://api.mapbox.com;
connect-src 'self'
  https://api.mapbox.com
  https://api.mapbox.com/v4/
  https://api.mapbox.com/styles/v1/mapbox/
  https://api.mapbox.com/fonts/v1/mapbox/
  https://api.mapbox.com/models/v1/mapbox/
  https://api.mapbox.com/mapbox-gl-js/
  https://api.mapbox.com/map-sessions/v1/;
```

如果后续使用非 Mapbox 官方账号的自定义样式或字体，需要同步把对应的 `/styles/v1/{username}/`、`/fonts/v1/{username}/` 端点加入 `connect-src`。只有重新启用 Mapbox events 采集时，才需要额外允许 `https://events.mapbox.com`。

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
