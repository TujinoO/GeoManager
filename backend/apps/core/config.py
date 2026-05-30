from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any


APP_SUBDIRS = ("database", "media", "uploads", "exports", "logs", "static")
RESEARCH_SUBDIRS = (
    "vector",
    "raster",
    "raster/original",
    "raster/preprocessed",
    "raster/metadata/source",
    "raster/metadata/preprocessed",
    "gene",
    "table",
)


class ConfigValidationError(RuntimeError):
    pass


@dataclass(frozen=True)
class MapConfig:
    default_center: tuple[float, float]
    default_zoom: float
    default_basemap: str


@dataclass(frozen=True)
class LimitConfig:
    upload_max_mb: int
    query_result_limit: int


@dataclass(frozen=True)
class RasterConfig:
    symbolizer_timeout_seconds: int
    default_symbolizer_script: str


@dataclass(frozen=True)
class ProjectConfig:
    config_path: Path
    system_name: str
    mode: str
    allow_registration: bool
    app_data: Path
    research_data_root: Path
    auto_create_directories: bool
    map: MapConfig
    limits: LimitConfig
    raster: RasterConfig

    def app_path(self, *parts: str) -> Path:
        return self.app_data.joinpath(*parts)

    def research_path(self, *parts: str) -> Path:
        return self.research_data_root.joinpath(*parts)


def load_project_config(config_path: Path, program_root: Path) -> ProjectConfig:
    config_path = config_path.expanduser().resolve()
    program_root = program_root.expanduser().resolve()
    if not config_path.exists():
        raise ConfigValidationError(f"TOML 配置文件不存在：{config_path}")

    try:
        with config_path.open("rb") as config_file:
            raw = tomllib.load(config_file)
    except tomllib.TOMLDecodeError as exc:
        raise ConfigValidationError(f"TOML 配置格式错误：{exc}") from exc

    system = _table(raw, "system")
    storage = _table(raw, "storage")
    map_config = _table(raw, "map")
    limits = _table(raw, "limits")
    raster = _table(raw, "raster")

    app_root = _absolute_path(storage.get("app_data"), "storage.app_data")
    research_root = _absolute_path(storage.get("research_data_root"), "storage.research_data_root")
    _validate_separate_roots(program_root, app_root, research_root)

    project_config = ProjectConfig(
        config_path=config_path,
        system_name=_string(system.get("name"), "system.name"),
        mode=_string(system.get("mode"), "system.mode"),
        allow_registration=bool(system.get("allow_registration", False)),
        app_data=app_root,
        research_data_root=research_root,
        auto_create_directories=bool(storage.get("auto_create_directories", False)),
        map=MapConfig(
            default_center=_center(map_config.get("default_center")),
            default_zoom=float(map_config.get("default_zoom", 4.5)),
            default_basemap=_string(map_config.get("default_basemap"), "map.default_basemap"),
        ),
        limits=LimitConfig(
            upload_max_mb=_positive_int(limits.get("upload_max_mb"), "limits.upload_max_mb"),
            query_result_limit=_positive_int(limits.get("query_result_limit"), "limits.query_result_limit"),
        ),
        raster=RasterConfig(
            symbolizer_timeout_seconds=_positive_int(
                raster.get("symbolizer_timeout_seconds"),
                "raster.symbolizer_timeout_seconds",
            ),
            default_symbolizer_script=_string(
                raster.get("default_symbolizer_script"),
                "raster.default_symbolizer_script",
            ),
        ),
    )
    _prepare_fixed_directories(project_config)
    return project_config


def _table(raw: dict[str, Any], key: str) -> dict[str, Any]:
    value = raw.get(key)
    if not isinstance(value, dict):
        raise ConfigValidationError(f"缺少 TOML 配置段：[{key}]")
    return value


def _string(value: Any, key: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ConfigValidationError(f"配置项 {key} 必须是非空字符串")
    return value.strip()


def _positive_int(value: Any, key: str) -> int:
    if not isinstance(value, int) or value <= 0:
        raise ConfigValidationError(f"配置项 {key} 必须是正整数")
    return value


def _absolute_path(value: Any, key: str) -> Path:
    path_text = _string(value, key)
    path = Path(path_text).expanduser()
    if not path.is_absolute():
        raise ConfigValidationError(f"配置项 {key} 必须是绝对路径")
    return path.resolve()


def _center(value: Any) -> tuple[float, float]:
    if not isinstance(value, list | tuple) or len(value) != 2:
        raise ConfigValidationError("配置项 map.default_center 必须是 [经度, 纬度]")
    lon = float(value[0])
    lat = float(value[1])
    if not -180 <= lon <= 180 or not -90 <= lat <= 90:
        raise ConfigValidationError("配置项 map.default_center 超出经纬度范围")
    return lon, lat


def _validate_separate_roots(program_root: Path, app_root: Path, research_root: Path) -> None:
    roots = {
        "业务数据总目录": app_root,
        "科研数据总目录": research_root,
    }
    seen: dict[Path, str] = {}
    for label, root in roots.items():
        if root in seen:
            raise ConfigValidationError(f"{seen[root]}和{label}不能相同")
        seen[root] = label
        if _is_relative_to(root, program_root):
            raise ConfigValidationError(f"{label}不能位于程序目录内")
    root_items = list(roots.items())
    for index, (label, root) in enumerate(root_items):
        for other_label, other_root in root_items[index + 1 :]:
            if _is_relative_to(root, other_root) or _is_relative_to(other_root, root):
                raise ConfigValidationError(f"{label}和{other_label}不能互为上下级目录")


def _prepare_fixed_directories(config: ProjectConfig) -> None:
    required_paths = [
        *(config.app_path(subdir) for subdir in APP_SUBDIRS),
        *(config.research_path(subdir) for subdir in RESEARCH_SUBDIRS),
    ]
    for directory in required_paths:
        if config.auto_create_directories:
            directory.mkdir(parents=True, exist_ok=True)
        if not directory.exists() or not directory.is_dir():
            raise ConfigValidationError(f"固定子目录不存在：{directory}")
        if not os.access(directory, os.R_OK | os.W_OK):
            raise ConfigValidationError(f"固定子目录缺少读写权限：{directory}")


def _is_relative_to(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
    except ValueError:
        return False
    return True
