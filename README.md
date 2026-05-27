# 中亚胡杨林生态系统保护数据共享平台

本仓库按前后端分离实现：

- `backend/`：Django 后端，负责认证、权限、业务数据、GeoPackage 读取、栅格 PNG 出图与缓存。
- `frontend/`：React + Vite + Ant Design + Mapbox GL JS 前端，负责统一登录、地图工作台和后台入口。
- `config/`：TOML 配置示例，数据根目录由配置指定。
- `docs/`：从设计文档提炼出的实现约束和开发记录。

## 本地运行

后端：

```bash
cd backend
eval "$(mamba shell hook --shell zsh)"
mamba activate zyhy
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 127.0.0.1:8000
```

前端：

```bash
cd frontend
pnpm install
pnpm dev
```

默认开发配置使用 `config/app.example.toml`，业务数据目录为 `/Users/gx/Documents/Source/huyang_system_data/appdata`，地理数据目录为 `/Users/gx/Documents/Source/huyang_system_data/geodata`。所有矢量数据统一从 `geodata/vector/vector.gpkg` 读取，业务库中矢量资源和图层填写该 GeoPackage 内的图层名。栅格数据统一放在 `geodata/raster/` 下，后端扫描 `raster/original/`，预处理、元数据和 PNG 缓存分别写入 `raster/preprocessed/`、`raster/metadata/` 和 `raster/png/`。生产部署时通过 `HUYANG_CONFIG=/path/to/app.toml` 指定实际配置文件。

## Docker 部署

Linux Docker 部署说明见 [`docs/docker-deploy.md`](docs/docker-deploy.md)。镜像直接基于 `mambaorg/micromamba:latest`，并使用 conda-forge 安装 Python 3.14、Django、Pillow、GDAL、Rasterio、GeoPandas 等运行依赖；前端需提前构建到 `frontend/dist`，程序源文件内置到镜像，业务数据、地理数据和 TOML 配置通过挂载传入。
