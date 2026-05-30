FROM mambaorg/micromamba:latest AS django

ENV DEBIAN_FRONTEND=noninteractive \
    MAMBA_ROOT_PREFIX=/opt/conda \
    PATH=/opt/conda/bin:$PATH \
    APP_CONFIG=/config/app.toml \
    DJANGO_SETTINGS_MODULE=data_sharing_platform.settings \
    DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,[::1] \
    APP_DISABLE_RASTER_STARTUP_SCAN=0

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        tini \
    && rm -rf /var/lib/apt/lists/*

RUN micromamba install -y -n base -c conda-forge \
        python=3.14 \
        "django>=6.0,<7.0" \
        pillow \
        gdal \
        rasterio \
        geopandas \
        gunicorn \
    && micromamba clean -a -y

WORKDIR /opt/app

COPY backend ./backend
COPY config ./config
COPY desgin-docs.md README.md AGENTS.md ./
COPY docker/entrypoint.sh /usr/local/bin/app-entrypoint

RUN chmod +x /usr/local/bin/app-entrypoint \
    && mkdir -p /data/business /data/geographic /config

EXPOSE 8000

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/app-entrypoint"]
CMD ["serve"]


FROM node:22-bookworm-slim AS frontend-build

ENV NODE_OPTIONS="--max-old-space-size=2048"

WORKDIR /build/frontend

RUN corepack enable

COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend ./
RUN pnpm build


FROM nginx:1.27-alpine AS nginx

ENV DJANGO_UPSTREAM=django:8000 \
    BUSINESS_ROOT=/data/business

COPY --from=frontend-build /build/frontend/dist /usr/share/nginx/html
COPY docker/app.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
