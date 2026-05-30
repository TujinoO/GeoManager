# Linux Docker Compose 部署说明

本文档说明如何用 Docker Compose 部署“中亚胡杨林生态系统保护数据共享平台”。部署方式为两个容器：

- `django`：Django 后端，启动时执行数据库迁移和 `collectstatic`，由 Gunicorn 提供 WSGI 服务。
- `nginx`：服务 Docker 构建阶段生成的前端静态文件，并把 `/api/`、`/admin/` 反向代理到 `django:8000`。

前端构建在 Docker 多阶段构建中完成。Node.js、pnpm 和 `node_modules` 只存在于临时构建阶段，最终 Nginx 镜像只保留 `frontend/dist` 产物。

## 1. 容器内路径

- 程序目录：`/opt/app`
- 后端目录：`/opt/app/backend`
- 前端静态目录：`/usr/share/nginx/html`
- 默认配置路径：`/config/app.toml`
- 默认业务数据根目录：`/data/app`
- 默认科研数据根目录：`/data/research`

业务数据和科研数据通过宿主机目录挂载进入容器，不能打包进镜像。容器内程序目录使用通用路径，不包含项目名。

## 2. 准备配置文件

准备一个 TOML 配置文件，例如 `/srv/data-platform/app.toml`：

```toml
[system]
name = "中亚胡杨林生态系统保护数据共享平台"
mode = "production"
allow_registration = true

[storage]
app_data = "/data/app"
research_data_root = "/data/research"
auto_create_directories = true

[map]
default_center = [80.0, 41.5]
default_zoom = 4.5
default_basemap = "osm"

[limits]
upload_max_mb = 512
query_result_limit = 30000

[raster]
symbolizer_timeout_seconds = 120
default_symbolizer_script = "scripts/raster_symbolizers/basic_gradient.py"
```

配置文件中的 `storage.app_data` 和 `storage.research_data_root` 是容器内的路径，通过 Docker volume 挂载映射到宿主机目录。

## 3. 配置环境变量

可在项目根目录创建 `.env`，覆盖默认部署参数：

```bash
APP_CONFIG_FILE=/srv/data-platform/app.toml
APP_HTTP_PORT=80
MAPBOX_ACCESS_TOKEN=pk.your-mapbox-public-token
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,your.domain.com,your.server.ip
GUNICORN_WORKERS=3
APP_DOCKER_BUILD_MODE=serial
```

如需固定密钥，可额外设置：

```bash
DJANGO_SECRET_KEY=replace-with-a-long-random-secret
```

未设置 `DJANGO_SECRET_KEY` 时，后端会自动生成并持久化到业务数据目录的 `database/.secret_key`。

## 4. 构建并启动

在项目根目录执行：

```bash
scripts/deploy.sh /srv/data-platform/app.toml
```

部署脚本会先根据传入配置生成容器运行时配置，再调用 Docker Compose 构建并启动服务。

Compose 会构建两个镜像：

- `data-platform-django:latest`
- `data-platform-nginx:latest`

公网访问端口默认为宿主机 `80`：

```text
http://服务器IP/
```

## 5. 一键更新脚本

仓库提供 `scripts/deploy.sh`，用于在服务器本地仓库中拉取最新代码并重建部署：

```bash
scripts/deploy.sh /srv/data-platform/app.toml
```

也可以通过环境变量传入配置文件：

```bash
APP_CONFIG_FILE=/srv/data-platform/app.toml scripts/deploy.sh
```

脚本流程：

1. 读取传入的 TOML 配置文件。
2. 复制配置文件到 `.deploy/app.toml`。
3. 执行 `git pull --ff-only`。
4. 按 `APP_DOCKER_BUILD_MODE` 执行 Docker 构建。
5. 执行 `docker compose up -d --remove-orphans`。

`APP_DOCKER_BUILD_MODE` 支持：

- `parallel`：执行 `docker compose build`，由 Docker Compose 调度服务构建。
- `serial`：默认值，依次执行 `docker compose build django` 和 `docker compose build nginx`，适合 CPU/内存较小的服务器。

## 6. 初始化管理员

首次部署默认开放自助注册。后端容器启动时会先创建固定数据目录，并在 `collectstatic` 和 Gunicorn 启动前执行数据库迁移。第一个通过登录页注册的用户会自动成为系统管理员，之后可通过登录后的后台入口或 `http://服务器IP/admin/` 访问 Django admin，并在“系统设置”中关闭自助注册。

## 7. 数据目录约定

业务数据根目录下使用固定子目录：

```text
database/
media/
uploads/
exports/
logs/
static/
```

科研数据根目录下使用固定子目录：

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

GeoPackage 矢量数据放入 `/data/research/vector`，原始栅格数据放入 `/data/research/raster/original`，基因数据放入 `/data/research/gene`，表格数据放入 `/data/research/table`。栅格符号化在后端完成，前端只加载后端生成的 PNG 或瓦片结果。

## 8. 常用运维命令

查看容器日志：

```bash
docker compose logs -f
docker compose logs -f django
docker compose logs -f nginx
```

运行日志文件统一写入业务数据根目录的 `logs/` 子目录：

```text
application.log
django.log
security.log
gunicorn-access.log
gunicorn-error.log
nginx-access.log
nginx-error.log
```

执行 Django 管理命令：

```bash
docker compose exec django app-entrypoint manage check
docker compose exec django app-entrypoint manage migrate
```

进入后端容器：

```bash
docker compose exec django app-entrypoint shell
```

健康检查：

```bash
curl http://服务器IP/api/health/
```

## 9. 生产部署注意事项

- `DJANGO_ALLOWED_HOSTS` 必须包含实际访问域名或服务器 IP。
- 对外 HTTPS 建议在宿主机或上游网关终止 TLS，再反代到本机 `80`。
- 配置文件可以只读挂载，业务数据和地理数据目录必须可读写。
- Nginx 容器挂载业务数据目录，用于服务 Django 收集后的 `/static/`、上传后的 `/media/`，并写入 `/logs/` 下的访问和错误日志。
- 如不希望启动时自动扫描栅格源文件，可设置 `APP_DISABLE_RASTER_STARTUP_SCAN=1`。
