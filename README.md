# 中亚胡杨林生态系统保护数据共享平台

本仓库按前后端分离实现：

- `backend/`：Django 后端，负责认证、权限、业务数据、GeoPackage 读取、栅格瓦片动态渲染。
- `frontend/`：React + Vite + Ant Design + Mapbox GL JS 前端，负责统一登录、地图工作台和后台入口。
- `config/`：TOML 配置示例，数据根目录由配置指定。
- `docs/`：从设计文档提炼出的实现约束和开发记录。

## 代码格式化

前端：参考 pnpm scripts:

```
"format": "biome format . --write",
"lint": "biome lint .",
"check": "biome check .",
"fix": "biome check . --write"
```

后端：首先激活python环境，然后`ruff format .`

## 测试

测试体系和 CI 稳定性要求见 [`docs/testing.md`](docs/testing.md)。提交前至少运行后端 `python -m pytest` 和前端 `pnpm test`。

## 本地运行

后端：

```bash
cd backend
eval "$(mamba shell hook --shell zsh)"
mamba activate geomanager
python manage.py runserver 127.0.0.1:8000
```

前端：

```bash
cd frontend
pnpm install
pnpm dev
```

默认开发配置使用 `config/app.test.toml`，业务数据目录为 `/Users/gx/Documents/Source/huyang_system_data/appdata`，科研数据目录为 `/Users/gx/Documents/Source/huyang_system_data/research_data`。所有矢量数据统一从 `research_data/vector/vector.gpkg` 读取，业务库中矢量资源和图层填写该 GeoPackage 内的图层名。栅格数据统一放在 `research_data/raster/` 下，后端扫描 `raster/original/`，预处理和元数据分别写入 `raster/preprocessed/` 和 `raster/metadata/`。基因和表格数据分别放在 `research_data/gene/` 和 `research_data/table/` 下。

本地开发通过命令行参数提供 TOML 配置文件，例如 `python manage.py runserver --config ../config/app.test.toml`。生产部署同样通过启动参数传入配置文件路径，不再使用 `.env`/`APP_CONFIG` 传递应用配置。

## Docker 部署

Linux Docker Compose 部署说明见 [`docs/docker-deploy.md`](docs/docker-deploy.md)。部署拆分为 `django` 和 `nginx` 两个容器：后端使用 Gunicorn，前端在 Docker 多阶段构建中执行 `pnpm build`，最终 Nginx 镜像只保留编译后的静态文件。部署时传入 TOML 配置文件，脚本会读取配置中的宿主机数据目录并映射到容器内固定目录，业务数据和地理数据不进入镜像。
