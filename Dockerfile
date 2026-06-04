FROM mambaorg/micromamba:latest

ENV DEBIAN_FRONTEND=noninteractive \
    MAMBA_ROOT_PREFIX=/opt/conda \
    PATH=/opt/conda/bin:$PATH \
    APP_CONFIG=/config/app.toml \
    DJANGO_SETTINGS_MODULE=data_sharing_platform.settings \
    DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,[::1] \
    APP_DISABLE_RASTER_STARTUP_SCAN=0 \
    MAPBOX_ACCESS_TOKEN=""

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
    && mkdir -p /data/app /data/geographic /config

EXPOSE 8000

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/app-entrypoint"]
CMD ["serve"]
