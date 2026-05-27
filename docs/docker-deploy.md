# Linux Docker 部署说明

本文档说明如何把“中亚胡杨林生态系统保护数据共享平台”部署到 Linux Docker。镜像直接基于 `mambaorg/micromamba:latest`，并通过 conda-forge 安装 Python 3.14、Pillow、GDAL、Rasterio、GeoPandas、Django 等后端依赖。程序源文件会复制到镜像内，业务数据、地理数据和配置文件通过 Docker 参数挂载。

## 1. 容器内路径

- 程序目录：`/opt/huyang_system`
- 后端目录：`/opt/huyang_system/backend`
- 前端构建产物：`/opt/huyang_system/frontend-dist`，由宿主机提前构建后复制进镜像
- 默认配置路径：`/config/app.toml`
- 默认业务数据根目录：`/data/business`
- 默认地理数据根目录：`/data/geographic`

业务数据和地理数据必须与程序目录分离，不能放在 `/opt/huyang_system` 下。

## 2. 准备宿主机目录

```bash
mkdir -p /srv/huyang/config
mkdir -p /srv/huyang/business-data
mkdir -p /srv/huyang/geographic-data
```

创建配置文件 `/srv/huyang/config/app.toml`：

```toml
[system]
name = "中亚胡杨林生态系统保护数据共享平台"
mode = "production"
allow_registration = false

[storage]
business_data_root = "/data/business"
geographic_data_root = "/data/geographic"
auto_create_directories = true

[map]
default_center = [80.0, 41.5]
default_zoom = 4.5
default_basemap = "osm"
mapbox_access_token = "pk.your-mapbox-public-token"

[limits]
upload_max_mb = 512
query_result_limit = 30000

[raster]
png_cache_max_mb = 512
cache_cleanup_policy = "least_recently_used"
symbolizer_timeout_seconds = 120
default_symbolizer_script = "scripts/raster_symbolizers/basic_gradient.py"
```

注意：`business_data_root` 和 `geographic_data_root` 要填写容器内路径，不是宿主机路径。

## 3. 构建前端

Docker 镜像不会现场编译前端。构建镜像前，先在宿主机生成 `frontend/dist`：

```bash
cd frontend
pnpm install
pnpm build
cd ..
```

## 4. 构建镜像

在项目根目录执行：

```bash
docker build -t huyang-system:latest .
```

构建过程会直接复制 `frontend/dist`，不会安装 Node.js、pnpm，也不会执行前端编译。

## 5. 启动容器

```bash
docker run -d \
  --name huyang-system \
  -p 8080:80 \
  -e HUYANG_CONFIG=/config/app.toml \
  -e DJANGO_SECRET_KEY='change-this-to-a-long-random-secret' \
  -e DJANGO_ALLOWED_HOSTS='localhost,127.0.0.1,your.domain.com' \
  -v /srv/huyang/config:/config:ro \
  -v /srv/huyang/business-data:/data/business \
  -v /srv/huyang/geographic-data:/data/geographic \
  huyang-system:latest
```

启动后访问 `http://服务器IP:8080/`。容器启动时会自动执行数据库迁移和 `collectstatic`。

## 6. 初始化管理员

```bash
docker exec -it huyang-system huyang-entrypoint manage createsuperuser
```

创建后可通过登录后的后台入口或 `http://服务器IP:8080/admin/` 访问 Django admin。

## 7. 数据目录约定

业务数据根目录下会使用固定子目录：

```text
database/
media/
uploads/
exports/
logs/
static/
```

地理数据根目录下会使用固定子目录：

```text
vector/
raster/
preprocessed/
metadata/
png/output/
png/cache/
```

GeoPackage 矢量数据放入 `/data/geographic/vector`，原始栅格数据放入 `/data/geographic/raster`。栅格符号化在后端完成，PNG 输出和缓存写入 `/data/geographic/png`。

## 8. 常用运维命令

查看日志：

```bash
docker logs -f huyang-system
```

执行 Django 管理命令：

```bash
docker exec -it huyang-system huyang-entrypoint manage check
docker exec -it huyang-system huyang-entrypoint manage migrate
docker exec -it huyang-system huyang-entrypoint manage seed_demo
```

进入容器 shell：

```bash
docker exec -it huyang-system huyang-entrypoint shell
```

健康检查：

```bash
curl http://服务器IP:8080/api/health/
```

## 9. 生产部署注意事项

- 必须设置强随机 `DJANGO_SECRET_KEY`。
- `DJANGO_ALLOWED_HOSTS` 必须包含实际访问域名或服务器 IP。
- 对外提供 HTTPS 时，建议在宿主机或上游网关终止 TLS，再反代到容器的 `80` 端口。
- 配置文件可以只读挂载，业务数据和地理数据目录必须可读写。
- 如果宿主机目录已有严格权限，确保容器进程对挂载目录具备读写权限。
- 如不希望启动时自动扫描栅格源文件，可添加 `-e HUYANG_DISABLE_RASTER_STARTUP_SCAN=1`。
