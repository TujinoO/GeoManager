#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=/opt/app
BACKEND_ROOT="${APP_ROOT}/backend"
DEFAULT_CONFIG=/config/app.toml

export PATH="${BACKEND_ROOT}/.pixi/envs/default/bin:${PATH}"
export PYTHONPATH="${BACKEND_ROOT}:${PYTHONPATH:-}"
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-data_sharing_platform.settings}"

wait_for_config() {
  local config_path="$1"
  if [[ ! -f "${config_path}" ]]; then
    echo "TOML 配置文件不存在：${config_path}" >&2
    echo "请通过 app-entrypoint serve /container/path/app.toml 指定容器内配置路径。" >&2
    exit 1
  fi
}

load_runtime_values() {
  local config_path="$1"
  python - "${config_path}" <<'PY'
import shlex
import sys
from pathlib import Path

from apps.core.config import load_project_config

config = load_project_config(Path(sys.argv[1]), program_root=Path("/opt/app"))
values = {
    "GUNICORN_BIND": config.runtime.gunicorn_bind,
    "GUNICORN_WORKERS": str(config.runtime.gunicorn_workers),
    "LOG_ROOT": str(config.app_path("logs")),
}
for key, value in values.items():
    print(f"{key}={shlex.quote(value)}")
PY
}

case "${1:-serve}" in
  serve)
    CONFIG_PATH="${2:-${DEFAULT_CONFIG}}"
    wait_for_config "${CONFIG_PATH}"
    cd "${BACKEND_ROOT}"
    python manage.py migrate --config "${CONFIG_PATH}" --noinput
    python manage.py collectstatic --noinput
    eval "$(load_runtime_values "${CONFIG_PATH}")"
    exec gunicorn data_sharing_platform.wsgi:application \
      --bind "${GUNICORN_BIND}" \
      --workers "${GUNICORN_WORKERS}" \
      --access-logfile "${LOG_ROOT}/gunicorn-access.log" \
      --error-logfile "${LOG_ROOT}/gunicorn-error.log"
    ;;
  manage)
    shift
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
