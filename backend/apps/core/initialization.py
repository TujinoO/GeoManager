from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import OperationalError, ProgrammingError, transaction

from apps.core.models import UserProfile
from apps.core.passwords import generate_password
from apps.core.permissions import (
    FEATURE_PERMISSION_NAMES,
    ensure_feature_permissions,
    feature_permission_queryset,
)

SUPERADMIN_GROUP_NAME = "超级管理员"
DEFAULT_USER_GROUP_NAME = "普通用户"
LEGACY_GUEST_GROUP_NAME = "游客"
GUEST_GROUP_NAME = DEFAULT_USER_GROUP_NAME
SUPERADMIN_USERNAME_ENV = "HUYANG_SUPERADMIN_USERNAME"
SUPERADMIN_PASSWORD_ENV = "HUYANG_SUPERADMIN_PASSWORD"
SUPERADMIN_EMAIL_ENV = "HUYANG_SUPERADMIN_EMAIL"
DEFAULT_SUPERADMIN_USERNAME = "admin"
DEFAULT_SUPERADMIN_EMAIL = "admin@example.local"
INITIAL_PASSWORD_FILE = "initial_superadmin_password.txt"
LOCKED_SUPERADMIN_PERMISSIONS: tuple[str, ...] = ()
GUEST_GROUP_PERMISSIONS = (
    "core.browse_data",
    "core.query_data",
    "core.upload_data",
    "core.load_vector_layer",
    "core.load_raster_layer",
)


def ensure_superadmin_defaults(
    *, create_account: bool = True
) -> tuple[Any | None, Group]:
    with transaction.atomic():
        ensure_feature_permissions()
        ensure_guest_group()
        group, _ = Group.objects.get_or_create(name=SUPERADMIN_GROUP_NAME)
        _grant_all_feature_permissions(group)
        user = _ensure_initial_superadmin(group) if create_account else None
        _attach_existing_superusers(group)
        return user, group


def ensure_superadmin_defaults_after_migrate(**kwargs) -> None:
    ensure_superadmin_defaults()


def print_superadmin_credentials_on_startup() -> None:
    if not _server_startup_command():
        return
    try:
        user, _ = ensure_superadmin_defaults()
    except (OperationalError, ProgrammingError):
        return
    username = user.get_username() if user is not None else superadmin_username()
    password = _initial_password()
    print(
        "\n".join(
            [
                "超级管理员账号已就绪：",
                f"用户名: {username}",
                f"密码: {password}",
            ]
        ),
        flush=True,
    )


def is_superadmin_group(group: Group) -> bool:
    return group.name == SUPERADMIN_GROUP_NAME


def is_guest_group(group: Group) -> bool:
    return group.name == GUEST_GROUP_NAME


def ensure_guest_group() -> Group:
    group = Group.objects.filter(name=GUEST_GROUP_NAME).first()
    if group is None:
        legacy_group = Group.objects.filter(name=LEGACY_GUEST_GROUP_NAME).first()
        if legacy_group is not None:
            legacy_group.name = GUEST_GROUP_NAME
            legacy_group.save(update_fields=["name"])
            group = legacy_group
        else:
            group = Group.objects.create(name=GUEST_GROUP_NAME)
            _set_group_permissions(group, GUEST_GROUP_PERMISSIONS)
            return group
    _add_group_permissions(group, GUEST_GROUP_PERMISSIONS)
    return group


def is_superadmin_user(user) -> bool:
    return bool(
        getattr(user, "is_authenticated", False)
        and user.groups.filter(name=SUPERADMIN_GROUP_NAME).exists()
    )


def is_initial_superadmin_user(user) -> bool:
    return bool(
        getattr(user, "is_authenticated", True)
        and getattr(user, "username", "") == superadmin_username()
    )


def superadmin_group_locked_permissions() -> set[str]:
    return set(LOCKED_SUPERADMIN_PERMISSIONS)


def protected_group_permissions() -> list[str]:
    return list(FEATURE_PERMISSION_NAMES)


def guest_group_permissions() -> set[str]:
    return set(GUEST_GROUP_PERMISSIONS)


def initial_password_path() -> Path:
    return settings.PROJECT_CONFIG.app_path("database", INITIAL_PASSWORD_FILE)


def superadmin_username() -> str:
    return _env_value(SUPERADMIN_USERNAME_ENV, DEFAULT_SUPERADMIN_USERNAME)


def _grant_all_feature_permissions(group: Group) -> None:
    permissions = list(feature_permission_queryset())
    if not permissions:
        return
    group.permissions.add(*permissions)


def _set_group_permissions(group: Group, permission_names: tuple[str, ...]) -> None:
    permissions_by_name = {
        f"{permission.content_type.app_label}.{permission.codename}": permission
        for permission in feature_permission_queryset()
    }
    selected = [
        permissions_by_name[permission_name]
        for permission_name in permission_names
        if permission_name in permissions_by_name
    ]
    if selected:
        group.permissions.set(selected)


def _add_group_permissions(group: Group, permission_names: tuple[str, ...]) -> None:
    permissions_by_name = {
        f"{permission.content_type.app_label}.{permission.codename}": permission
        for permission in feature_permission_queryset()
    }
    selected = [
        permissions_by_name[permission_name]
        for permission_name in permission_names
        if permission_name in permissions_by_name
    ]
    if selected:
        group.permissions.add(*selected)


def _ensure_initial_superadmin(group: Group):
    User = get_user_model()

    username = superadmin_username()
    email = _env_value(SUPERADMIN_EMAIL_ENV, DEFAULT_SUPERADMIN_EMAIL)
    password = _initial_password()
    user, created = User.objects.select_for_update().get_or_create(
        username=username,
        defaults={
            "email": email,
            "first_name": "超级管理员",
            "is_active": True,
            "is_staff": False,
            "is_superuser": False,
        },
    )
    if created:
        user.set_password(password)
    user.email = user.email or email
    user.first_name = user.first_name or "超级管理员"
    user.is_active = True
    user.is_staff = False
    user.is_superuser = False
    user.save(
        update_fields=[
            "email",
            "first_name",
            "is_active",
            "is_staff",
            "is_superuser",
            "password",
        ]
    )
    user.groups.add(group)
    profile, _ = UserProfile.objects.get_or_create(user=user)
    if not profile.department:
        profile.department = "系统管理"
        profile.save(update_fields=["department", "updated_at"])
    return user


def _attach_existing_superusers(group: Group) -> None:
    User = get_user_model()
    for user in User.objects.select_for_update().filter(is_superuser=True):
        changed = False
        if not user.is_staff:
            user.is_staff = True
            changed = True
        if not user.is_active:
            user.is_active = True
            changed = True
        if changed:
            user.save(update_fields=["is_staff", "is_active"])
        user.groups.add(group)


def _initial_password() -> str:
    env_password = os.environ.get(SUPERADMIN_PASSWORD_ENV, "").strip()
    if env_password:
        return env_password

    path = initial_password_path()
    if path.exists():
        return path.read_text(encoding="utf-8").strip()

    password = generate_password(length=8)
    if not _running_tests():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f"{password}\n", encoding="utf-8")
        path.chmod(0o600)
    return password


def _env_value(name: str, default: str) -> str:
    return os.environ.get(name, "").strip() or default


def _running_tests() -> bool:
    return "test" in sys.argv


def _server_startup_command() -> bool:
    if _running_tests():
        return False
    if len(sys.argv) > 1 and sys.argv[1] == "runserver":
        return os.environ.get("RUN_MAIN") == "true"
    program_name = Path(sys.argv[0]).name
    return program_name in {"gunicorn", "uvicorn", "daphne"}
