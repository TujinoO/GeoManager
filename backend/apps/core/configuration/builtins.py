from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BuiltinGroupConfig:
    superadmin_name: str
    default_user_name: str
    guest_name: str
    superadmin_locked_permissions: tuple[str, ...]
    default_user_permissions: tuple[str, ...]
    guest_permissions: tuple[str, ...]


@dataclass(frozen=True)
class BuiltinAccountConfig:
    guest_username: str
    guest_display_name: str
    guest_department: str
    superadmin_username_env: str
    superadmin_password_env: str
    superadmin_email_env: str
    default_superadmin_username: str
    default_superadmin_email: str
    superadmin_display_name: str
    superadmin_department: str
    initial_password_file: str


BUILTIN_GROUPS = BuiltinGroupConfig(
    superadmin_name="超级管理员",
    default_user_name="普通用户",
    guest_name="游客",
    superadmin_locked_permissions=(
        "core.manage_auth",
        "core.manage_feature_permissions",
        "core.manage_system_settings",
    ),
    default_user_permissions=(
        "core.browse_data",
        "core.query_data",
        "catalog.add_dataresource",
        "catalog.add_workspacescene",
        "catalog.view_workspacescene",
        "catalog.change_workspacescene",
        "catalog.delete_workspacescene",
        "catalog.view_achievement",
        "core.load_vector_layer",
        "core.load_raster_layer",
    ),
    guest_permissions=(
        "core.browse_data",
        "core.query_data",
        "catalog.view_achievement",
        "core.load_vector_layer",
        "core.load_raster_layer",
    ),
)

BUILTIN_ACCOUNTS = BuiltinAccountConfig(
    guest_username="guest",
    guest_display_name="游客",
    guest_department="公开访问",
    superadmin_username_env="HUYANG_SUPERADMIN_USERNAME",
    superadmin_password_env="HUYANG_SUPERADMIN_PASSWORD",
    superadmin_email_env="HUYANG_SUPERADMIN_EMAIL",
    default_superadmin_username="admin",
    default_superadmin_email="admin@example.local",
    superadmin_display_name="超级管理员",
    superadmin_department="系统管理",
    initial_password_file="initial_superadmin_password.txt",
)
