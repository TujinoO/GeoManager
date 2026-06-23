from __future__ import annotations

from typing import Any

from django.conf import settings

from apps.core.config import load_runtime_config_document


def runtime_application() -> dict[str, Any]:
    raw = load_runtime_config_document(settings.PROJECT_CONFIG)
    application = raw.get("application")
    if not isinstance(application, dict):
        raise RuntimeConfigError("运行配置缺少 application 节")
    return application


def runtime_system_name() -> str:
    try:
        return str(runtime_application()["system"]["name"])
    except (KeyError, TypeError) as exc:
        raise RuntimeConfigError("无法读取系统名称配置") from exc


def runtime_allow_registration() -> bool:
    try:
        value = runtime_application()["system"]["allow_registration"]
    except (KeyError, TypeError) as exc:
        raise RuntimeConfigError("无法读取注册开关配置") from exc
    if not isinstance(value, bool):
        raise RuntimeConfigError("注册开关配置必须是布尔值")
    return value


def runtime_upload_max_mb() -> int:
    return runtime_limit_int("upload_max_mb", "上传大小限制")


def runtime_query_result_limit() -> int:
    return runtime_limit_int("query_result_limit", "查询结果上限")


def runtime_max_raster_side_pixels() -> int:
    return runtime_limit_int("max_raster_side_pixels", "栅格单边像素上限")


def runtime_limit_int(key: str, label: str) -> int:
    try:
        value = int(runtime_application()["limits"][key])
    except (KeyError, TypeError, ValueError) as exc:
        raise RuntimeConfigError(f"无法读取{label}") from exc
    if value <= 0:
        raise RuntimeConfigError(f"{label}必须是正整数")
    return value


class RuntimeConfigError(RuntimeError):
    pass
