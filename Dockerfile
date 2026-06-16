FROM node:24-bookworm-slim AS frontend-build

WORKDIR /opt/app/frontend

RUN corepack enable

COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend ./
RUN pnpm exec vite build --base=/static/

FROM mambaorg/micromamba:latest

ENV DEBIAN_FRONTEND=noninteractive \
    MAMBA_ROOT_PREFIX=/opt/conda \
    PATH=/opt/conda/bin:$PATH \
    DJANGO_SETTINGS_MODULE=data_sharing_platform.settings

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        tini \
    && rm -rf /var/lib/apt/lists/*

COPY backend/environment.yml /tmp/environment.yml
RUN micromamba env update -n base -f /tmp/environment.yml \
    && micromamba clean -a -y

WORKDIR /opt/app

COPY backend ./backend
COPY --from=frontend-build /opt/app/frontend/dist ./frontend/dist
COPY docs/design-docs.md README.md AGENTS.md ./
COPY docker/entrypoint.sh /usr/local/bin/app-entrypoint

RUN chmod +x /usr/local/bin/app-entrypoint \
    && mkdir -p /data/app /data/research /config

EXPOSE 8000

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/app-entrypoint"]
CMD ["serve", "/config/app.toml"]
