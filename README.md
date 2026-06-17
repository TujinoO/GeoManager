# 中亚胡杨林生态系统保护数据共享平台

本仓库按前后端分离实现：

- `backend/`：Django 后端，负责认证、权限、业务数据、GeoPackage 读取、栅格瓦片动态渲染。
- `frontend/`：React + Vite + Ant Design + Mapbox GL JS 前端，负责统一登录、地图工作台和后台入口。
- `config/`：TOML 配置示例，数据根目录由配置指定。
- `docs/`：权威设计、API 契约、开发指南和运行手册。

## 代码格式化

前端：

```
cd frontend
pnpm run check
pnpm run fix
```

后端：

```
cd backend
pixi run format
```

## 测试

测试体系和 CI 稳定性要求见 [`docs/operations.md`](docs/operations.md)。提交前至少运行后端 `pixi run test` 和前端 `pnpm test`。

## 本地运行

后端：

```bash
cd backend
pixi install
pixi run dev
```

前端：

```bash
cd frontend
pnpm install
pnpm dev
```

默认开发配置使用 `config/app.test.toml`。所有矢量数据统一从科研数据根目录下的 `vector/vector.gpkg` 读取，业务库中矢量资源和图层填写该 GeoPackage 内的图层名。栅格数据统一放在科研数据根目录的 `raster/` 下，后端扫描 `raster/original/`，预处理和元数据分别写入 `raster/preprocessed/` 和 `raster/metadata/`。基因和表格数据分别放在科研数据根目录的 `gene/` 和 `table/` 下。

本地开发通过 Pixi task 提供 TOML 配置文件，例如 `pixi run dev` 会执行 `python manage.py runserver --config ../config/app.test.toml`。生产部署同样通过启动参数传入配置文件路径。

## Docker 部署

镜像构建使用 `backend/pixi.lock` 安装后端运行环境，不需要配置文件；运行容器时把 TOML 配置挂载到 `/config/app.toml`。镜像内由 Waitress + Django 同时提供 API 和前端构建产物；业务数据和科研数据统一保存在 Docker 数据卷 `huyang-data` 中。

```bash
docker build -t data-platform-django:latest .

docker volume create huyang-data

docker run -d --name data-platform \
  -p 127.0.0.1:8000:8000 \
  -v /absolute/path/app.docker.toml:/config/app.toml \
  -v huyang-data:/data \
  data-platform-django:latest
```

配置文件可从 [`config/app.docker.toml`](config/app.docker.toml) 复制修改，其中数据路径保持：

```toml
[application.storage]
app_data = "/data/app"
research_data_root = "/data/research"
```

`127.0.0.1:8000` 适合由宿主机 nginx 反向代理；如需直接对外访问，可改为 `-p 8000:8000`。更完整的运行说明见 [`docs/operations.md`](docs/operations.md)。
