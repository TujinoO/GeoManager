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

Linux 部署使用单个 Docker 镜像和 TOML 配置。镜像构建使用 `backend/pixi.lock` 创建后端运行环境，不需要配置文件；容器运行时把包含 `app.toml` 的宿主机配置目录挂载到 `/config`。镜像内由 Waitress 运行 Django WSGI 应用，Django 同时提供 `/api/` 接口和前端 Vite 构建产物；对公网关、HTTPS 和域名由宿主机上的反向代理自行配置。业务数据和科研数据保存在同一个 Docker 数据卷 `huyang-data` 中，并挂载到容器内 `/data`。

容器内固定路径：

- 程序目录：`/opt/app`
- 后端目录：`/opt/app/backend`
- 后端 Pixi 环境：`/opt/app/backend/.pixi/envs/default`
- 前端构建产物：`/opt/app/frontend/dist`
- 默认输入配置：`/config/app.toml`
- 默认业务数据根目录：`/data/app`
- 默认科研数据根目录：`/data/research`

Docker 容器内配置示例见 `config/app.docker.toml`。其中容器内路径、Waitress 监听地址和默认运行参数已经固化；通常只需要按部署环境调整 `allowed_hosts`、`csrf_trusted_origins`、`waitress_port`、`waitress_threads`、`mapbox_access_token` 和 `tianditu_access_token`。

`tianditu_access_token` 必须使用天地图服务中心控制台签发的 32 位“浏览器端”应用 Key，不能把真实 Key 写入镜像、仓库或示例配置。浏览器端 Key 还必须在天地图控制台“我的应用 → 设置”中配置允许访问的域名：本地联调至少覆盖实际使用的 `localhost` 和/或 `127.0.0.1`，生产环境覆盖平台实际 HTTPS 域名；如果用户还会通过服务器 IP 或其他域名访问，也要分别纳入。域名项按控制台要求填写，不附带 URL 路径。未配置或不匹配时，WMTS 请求会返回 HTTP 403，以及错误码 `301007`（域名不匹配），平台会回滚到上一个可用底图。

服务器应把 Key 写入宿主机实际挂载目录的 `app.toml`，或以管理员身份在“后台管理 → 系统设置 → 天地图浏览器 Key”中保存。后台保存要求整个可写配置目录挂载到 `/config`；只挂载单个 `/config/app.toml` 会破坏原子替换。保存后用生产域名打开地理工作台并切换到天地图，确认 `vec_w` 与 `cva_w` 请求均返回 200、响应类型为图片、底图状态正常且业务图层仍在，才算完成生产验收。

手动 `docker run` 时，先把 `config/app.docker.toml` 复制为宿主机配置目录中的 `app.toml`，再把整个目录挂载到 `/config`。配置应使用容器内数据路径 `/data/app` 和 `/data/research`。业务数据和科研数据使用同一个 Docker named volume，不需要映射宿主机目录。

构建和启动：

```bash
docker build -t data-platform-django:latest .

docker volume create huyang-data

docker run -d --name data-platform \
  -p 80:8000 \
  -v /srv/data-platform/config:/config \
  -v huyang-data:/data \
  --memory=2300m \
  --memory-reservation=1800m \
  --memory-swap=2300m \
  --cpus=2 \
  --pids-limit=256 \
  --restart=unless-stopped \
  --log-driver=json-file \
  --log-opt max-size=10m \
  --log-opt max-file=5 \
  data-platform-django:latest serve /config/app.toml
```

Docker 配置中的数据目录应直接使用容器内路径 `/data/app` 和 `/data/research`。`docker run -p` 的宿主机端口应与 `runtime.waitress_port` 保持一致，或按反向代理需求另行映射。

### 4 GB 主机的内存安全基线

`config/app.docker.toml` 默认面向小内存单机：Waitress 使用 2 个请求线程，查询单次最多返回 5,000 条，上传限制为 64 MB，栅格单边限制为 12,000 像素，并关闭目录与栅格启动扫描。后台允许设置的硬范围为上传 1–120 MB、查询 100–10,000 条、栅格单边 1–12,000 像素和栅格任务超时 10–600 秒；上传最大值为 Waitress 的 128 MB 请求体限制预留了 multipart 开销。需要扫描时应在平台稳定后由有维护权限的用户手动触发；栅格导入、扫描、渲染和导出共用单并发、有界等待队列，不能通过提高 Waitress 线程数绕开该限制。

这些文件是新部署样例，不会覆盖现有服务器的 `/config/app.toml`。升级已有容器前必须备份宿主机 TOML，把它迁移到专用配置目录并改为目录挂载，然后显式重建容器以应用挂载、memory、CPU、pids、restart 和日志参数；单独执行 Watchtower 不会改变挂载配置或现有 HostConfig。单文件 bind mount 会使后台保存时的原子 `os.replace()` 返回 `Device or resource busy`，因此不能继续用于可在线维护的配置。本文示例容器名为 `data-platform`；现网容器名如果是 `geomanager`，所有检查、重建和 Watchtower 目标必须统一使用 `geomanager`，不能混用。

容器的 `2300m` 硬限制用于给 4 GB 宿主机、Docker daemon 和反向代理保留约 1.5 GB。容器可能在超限时单独重启，但不得再次拖垮宿主机。`--memory-swap` 与 `--memory` 设为相同值表示不允许容器额外消耗 swap；若宿主机有其他业务，应继续下调，而不是取消限制。镜像内置 `/api/health/` 健康检查，并从挂载的 `/config/app.toml` 自动读取容器内 Waitress 端口；宿主机端口映射仍需与实际端口保持一致。

发生卡顿或 OOM 时先保留证据，不要立即清理镜像或日志：

```bash
journalctl -k --since "30 minutes ago" --no-pager
docker inspect data-platform --format 'Status={{.State.Status}} OOMKilled={{.State.OOMKilled}} Exit={{.State.ExitCode}} RestartCount={{.RestartCount}}'
docker stats --no-stream data-platform
docker top data-platform -eo pid,ppid,nlwp,rss,vsz,etimes,args
docker exec data-platform sh -c 'cat /sys/fs/cgroup/memory.current; cat /sys/fs/cgroup/memory.max; cat /sys/fs/cgroup/memory.events'
```

如果数据库里存在服务重启前遗留的 `queued/running` 栅格任务，新进程首次访问任务系统时会将其标记为失败并提示重新提交；不要把这些僵尸状态误判为仍在执行。

### 镜像更新与回滚

Watchtower 只会根据容器当前的 image tag 拉取容器镜像，不会在服务器上执行 `git pull`，也不会从 GitHub Fork 直接构建代码。上游工作流发布到当前仓库所有者的 `ghcr.io/tujinoo/geomanager`；推送源码后必须先确认 GitHub Actions 已成功发布镜像，并确保远端容器也使用该镜像地址。镜像命名空间必须与签发 `GITHUB_TOKEN` 的仓库所有者一致，否则构建完成后会在推送阶段因包写入权限不足而失败。

生产更新应记录当前 image ID/digest，优先部署提交 SHA tag 或固定 digest，完成健康检查和关键页面冒烟验证后再清理旧镜像。首次故障恢复不要使用 Watchtower `--cleanup`，否则新镜像异常时可能失去便捷回滚目标。回滚时使用记录的旧 SHA tag/digest 重建同配置容器，数据卷保持不变。

远程管理应使用 SSH key，并关闭公网密码登录。密码一旦出现在聊天、终端录屏或共享日志中，应立即轮换；任何口令都不得写入仓库、部署脚本或命令历史。

如果容器前面有 Nginx、Caddy、云负载均衡或 CDN，反向代理必须把源头客户端 IP 通过 `X-Forwarded-For`、`X-Real-IP`、`CF-Connecting-IP`、`True-Client-IP` 或标准 `Forwarded` 请求头传给后端。操作日志会优先从这些请求头中选择公网 IP；只有没有有效公网 IP 时才回退到 `REMOTE_ADDR`，此时 Docker 网桥环境可能显示为 `172.19.x.x` 之类的内网地址。

### 浏览器内容安全策略与 Mapbox GL JS

平台对 Django 返回的 HTML 强制发送 `Content-Security-Policy` 和 `Permissions-Policy`，前端入口 HTML 也包含同等 CSP 兜底。策略禁止页面加载音视频、对象插件、外域脚本和外域框架，并禁用自动播放及画中画，以阻断数据导入页等功能页面上由被污染入口或代理注入的媒体浮层。

当前前端使用依赖包中的 ESM 版 `mapbox-gl`，并已禁用 Mapbox events 采集。完整策略为：

```text
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
worker-src 'self' blob:;
img-src 'self' data: blob: https://api.mapbox.com https://tiles.openfreemap.org https://*.tile.openstreetmap.org https://*.tianditu.gov.cn https://images.unsplash.com;
font-src 'self' data:;
connect-src 'self' https://api.mapbox.com https://tiles.openfreemap.org https://*.tile.openstreetmap.org https://*.tianditu.gov.cn;
frame-src 'self' blob:;
media-src 'none';
manifest-src 'self';
```

如果后续使用非 Mapbox 官方账号的自定义样式或字体，需要同步把对应的 `/styles/v1/{username}/`、`/fonts/v1/{username}/` 端点加入 `connect-src`。只有重新启用 Mapbox events 采集时，才需要额外允许 `https://events.mapbox.com`。

如果页面仍出现带关闭按钮的陌生视频或广告浮层，先在无扩展的浏览器访客窗口复测，并检查响应头是否保留上述 CSP。浏览器特权扩展可以绕过站点策略，HTTP 链路也可能被代理篡改；生产环境应优先使用 HTTPS，并停用或卸载触发注入的浏览器扩展。反向代理可以补充安全响应头，但不得覆盖为更宽松的策略。

默认数据卷名称为 `huyang-data`。如需改名，直接创建并挂载新的 Docker volume：

```bash
docker volume create data-platform-data
docker run -d --name data-platform \
  -p 80:8000 \
  -v /srv/data-platform/config:/config \
  -v data-platform-data:/data \
  data-platform-django:latest serve /config/app.toml
```

重建容器不会删除数据卷。如需备份、迁移或删除数据，请直接操作对应 Docker volume。

系统以挂载目录中的源配置文件 `/config/app.toml` 作为运行配置和后台设置写入目标。后台保存会在 `/config` 内写入临时文件、校验 TOML 后再原子替换 `app.toml`，因此该目录必须可写。`django_secret_key` 自动生成并持久化到业务数据目录的 `database/.secret_key`，由后端专用文件管理。

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
  original/
    uploaded/
raster/
  original/
  preprocessed/
  metadata/
    source/
    preprocessed/
gene/
table/
```

统一 GeoPackage 矢量数据放入科研数据根目录的 `vector/vector.gpkg`；浏览器上传的 Shapefile ZIP、GeoJSON 和 GeoPackage 原始文件以 UUID 文件名归档到 `vector/original/uploaded/`，原始文件名和 SHA256 保存于 `VectorDataset`。栅格原始数据包放入 `raster/original/uploaded/{uuid}/`，GeoTIFF/IMG 可单文件归档，ENVI 数据保留主文件与 HDR，VRT 保留全部包内引用文件和 `manifest.json`；展示 COG 写入 `raster/preprocessed/`。基因数据放入 `gene/`，表格数据放入 `table/`。栅格符号化在后端完成，前端只加载后端生成的 XYZ 或 PNG 结果。

## 常见问题

- pnpm 依赖异常：运行 `pnpm store prune` 后删除 `node_modules/` 并重新 `pnpm install`。
- Pixi 环境创建失败：运行 `pixi clean cache -y` 后重新执行 `cd backend && pixi install`。
- GDAL 相关错误：确认命令通过 `pixi run ...` 执行，并检查 `backend/pixi.toml` 与 `backend/pixi.lock` 是否包含 `gdal`、`geopandas`、`rasterio`。
- 权限问题：不要用 `sudo` 运行 pnpm 或 Pixi，优先检查安装路径和目录权限。
