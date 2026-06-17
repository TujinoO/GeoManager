FROM node:24-bookworm-slim AS frontend-build

WORKDIR /opt/app/frontend

RUN corepack enable

COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend ./
RUN pnpm exec vite build --base=/static/

FROM ghcr.io/prefix-dev/pixi:latest AS pixi-bin

FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PIXI_CACHE_DIR=/opt/pixi-cache \
    PATH=/opt/app/backend/.pixi/envs/default/bin:$PATH \
    DJANGO_SETTINGS_MODULE=data_sharing_platform.settings

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        tini \
    && rm -rf /var/lib/apt/lists/*

COPY --from=pixi-bin /usr/local/bin/pixi /usr/local/bin/pixi

WORKDIR /opt/app

COPY backend/pixi.toml backend/pixi.lock ./backend/
RUN cd backend \
    && pixi install --locked \
    && pixi clean cache -y

COPY backend ./backend
COPY --from=frontend-build /opt/app/frontend/dist ./frontend/dist
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/app-entrypoint

RUN mkdir -p /data/app /data/research /config

EXPOSE 8000

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/app-entrypoint"]
CMD ["serve", "/config/app.toml"]
