#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=/opt/data_sharing_platform
BACKEND_ROOT="${APP_ROOT}/backend"
FRONTEND_ROOT="${APP_ROOT}/frontend-dist"
BUSINESS_ROOT="${APP_BUSINESS_ROOT:-/data/business}"
GEOGRAPHIC_ROOT="${APP_GEOGRAPHIC_ROOT:-/data/geographic}"
GUNICORN_BIND="${GUNICORN_BIND:-127.0.0.1:8000}"
GUNICORN_WORKERS="${GUNICORN_WORKERS:-3}"

export PATH="/opt/conda/bin:${PATH}"
export PYTHONPATH="${BACKEND_ROOT}:${PYTHONPATH:-}"
export APP_CONFIG="${APP_CONFIG:-/config/app.toml}"
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-data_sharing_platform.settings}"

prepare_data_dirs() {
  for dir in \
    "${BUSINESS_ROOT}/database" \
    "${BUSINESS_ROOT}/media" \
    "${BUSINESS_ROOT}/uploads" \
    "${BUSINESS_ROOT}/exports" \
    "${BUSINESS_ROOT}/logs" \
    "${BUSINESS_ROOT}/static" \
    "${GEOGRAPHIC_ROOT}/vector" \
    "${GEOGRAPHIC_ROOT}/raster" \
    "${GEOGRAPHIC_ROOT}/preprocessed" \
    "${GEOGRAPHIC_ROOT}/metadata" \
    "${GEOGRAPHIC_ROOT}/png/output" \
    "${GEOGRAPHIC_ROOT}/png/cache"
  do
    mkdir -p "${dir}"
  done
}

wait_for_config() {
  if [[ ! -f "${APP_CONFIG}" ]]; then
    echo "TOML 配置文件不存在：${APP_CONFIG}" >&2
    echo "请通过 -v /host/config:/config:ro 或 APP_CONFIG 指定容器内配置路径。" >&2
    exit 1
  fi
}

prepare_nginx() {
  export FRONTEND_ROOT BUSINESS_ROOT
  envsubst '${FRONTEND_ROOT} ${BUSINESS_ROOT}' \
    < /etc/nginx/templates/app.conf.template \
    > /etc/nginx/conf.d/app.conf
}

case "${1:-serve}" in
  serve)
    prepare_data_dirs
    wait_for_config
    prepare_nginx
    cd "${BACKEND_ROOT}"
    python manage.py migrate --noinput
    python manage.py collectstatic --noinput
    gunicorn data_sharing_platform.wsgi:application \
      --bind "${GUNICORN_BIND}" \
      --workers "${GUNICORN_WORKERS}" \
      --access-logfile - \
      --error-logfile - &
    exec nginx -g "daemon off;"
    ;;
  manage)
    shift
    prepare_data_dirs
    wait_for_config
    cd "${BACKEND_ROOT}"
    exec python manage.py "$@"
    ;;
  shell)
    exec /bin/bash
    ;;
  *)
    exec "$@"
    ;;
esac
