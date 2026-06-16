from __future__ import annotations

from dataclasses import dataclass

from django.apps import apps
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth.models import Permission
from django.core.exceptions import ObjectDoesNotExist
from django.http import JsonResponse
from django.db.models import Q


@dataclass(frozen=True)
class FeaturePermissionDef:
    app_label: str
    model_name: str
    codename: str
    name: str
    group: str

    @property
    def perm_name(self) -> str:
        return f"{self.app_label}.{self.codename}"


FEATURE_PERMISSIONS: tuple[FeaturePermissionDef, ...] = (
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "manage_feature_permissions",
        "配置功能权限",
        "人员权限",
    ),
    FeaturePermissionDef(
        "core", "FeaturePermission", "create_user", "新建用户", "人员权限"
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "view_operation_logs",
        "查看操作日志",
        "后台权限",
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "view_all_operation_logs",
        "查看所有用户日志",
        "日志权限",
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "view_own_operation_logs",
        "查看自己的日志",
        "日志权限",
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "view_group_operation_logs",
        "查看指定用户组日志",
        "日志权限",
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "manage_system_settings",
        "修改系统设置",
        "后台权限",
    ),
    FeaturePermissionDef(
        "core", "FeaturePermission", "manage_auth", "修改认证授权", "人员权限"
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "view_dashboard_resource_card",
        "查看 Dashboard 数据资源卡片",
        "Dashboard 权限",
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "view_dashboard_layer_card",
        "查看 Dashboard 图层数卡片",
        "Dashboard 权限",
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "view_dashboard_raster_card",
        "查看 Dashboard 栅格数量卡片",
        "Dashboard 权限",
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "view_dashboard_user_card",
        "查看 Dashboard 用户数量卡片",
        "Dashboard 权限",
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "view_dashboard_active_users_card",
        "查看 Dashboard 活跃用户卡片",
        "Dashboard 权限",
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "view_dashboard_system_card",
        "查看 Dashboard 系统信息",
        "Dashboard 权限",
    ),
    FeaturePermissionDef(
        "core", "FeaturePermission", "browse_data", "浏览数据", "数据权限"
    ),
    FeaturePermissionDef(
        "core", "FeaturePermission", "query_data", "查询数据", "数据权限"
    ),
    FeaturePermissionDef(
        "core", "FeaturePermission", "load_vector_layer", "加载矢量图层", "数据权限"
    ),
    FeaturePermissionDef(
        "core", "FeaturePermission", "load_raster_layer", "加载栅格图层", "数据权限"
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "custom_symbolization",
        "自定义符号化",
        "数据权限",
    ),
    FeaturePermissionDef(
        "catalog", "DataResource", "export_dataresource", "导出数据资源", "数据权限"
    ),
    FeaturePermissionDef(
        "catalog", "DataResource", "maintain_dataresource", "维护数据资源", "数据权限"
    ),
    FeaturePermissionDef(
        "raster",
        "RasterDataset",
        "manage_raster_dataset",
        "管理栅格数据集",
        "数据权限",
    ),
)

FEATURE_PERMISSION_NAMES = tuple(item.perm_name for item in FEATURE_PERMISSIONS)


def has_feature_perm(user, perm_name: str) -> bool:
    if not user.is_authenticated:
        return False
    if user.is_superuser:
        return perm_name not in disabled_feature_permissions(user)
    return user.has_perm(perm_name) and perm_name not in disabled_feature_permissions(
        user
    )


def granted_feature_permissions(user) -> set[str]:
    if not user.is_authenticated:
        return set()
    if user.is_superuser:
        return set(FEATURE_PERMISSION_NAMES)
    return {
        permission
        for permission in FEATURE_PERMISSION_NAMES
        if user.has_perm(permission)
    }


def disabled_feature_permissions(user) -> set[str]:
    if not user.is_authenticated:
        return set()
    profile = _user_profile(user)
    if profile is None:
        return set()
    disabled = {
        permission
        for permission in profile.disabled_permissions
        if permission in FEATURE_PERMISSION_NAMES
    }
    from apps.core.initialization import (
        is_superadmin_user,
        superadmin_group_locked_permissions,
    )

    if is_superadmin_user(user):
        disabled -= superadmin_group_locked_permissions()
    return disabled


def effective_feature_permissions(user) -> set[str]:
    if user.is_superuser:
        return set(FEATURE_PERMISSION_NAMES)
    return granted_feature_permissions(user) - disabled_feature_permissions(user)


def direct_feature_permissions(user) -> set[str]:
    if not user.is_authenticated:
        return set()
    feature_ids = set(feature_permission_queryset().values_list("id", flat=True))
    return {
        f"{permission.content_type.app_label}.{permission.codename}"
        for permission in user.user_permissions.filter(id__in=feature_ids)
        .select_related("content_type")
        .all()
    }


def _user_profile(user):
    try:
        return user.profile
    except ObjectDoesNotExist:
        return None


def group_names(user) -> str:
    names = (
        list(user.groups.values_list("name", flat=True))
        if user.is_authenticated
        else []
    )
    return "、".join(names) if names else "未分组"


def permission_denied_message(user) -> str:
    return f"当前用户组“{group_names(user)}”无权限"


def feature_denied_response(user) -> JsonResponse:
    return JsonResponse({"detail": permission_denied_message(user)}, status=403)


def feature_permission_queryset():
    query = Q()
    for item in FEATURE_PERMISSIONS:
        query |= Q(
            content_type__app_label=item.app_label,
            content_type__model=item.model_name.lower(),
            codename=item.codename,
        )
    if not query:
        return Permission.objects.none()
    return Permission.objects.select_related("content_type").filter(query)


def ensure_feature_permissions() -> None:
    for item in FEATURE_PERMISSIONS:
        model = apps.get_model(item.app_label, item.model_name)
        content_type = ContentType.objects.get_for_model(model)
        Permission.objects.update_or_create(
            content_type=content_type,
            codename=item.codename,
            defaults={"name": item.name},
        )


def feature_permission_ids_for(group) -> set[int]:
    feature_ids = feature_permission_queryset().values_list("id", flat=True)
    return set(
        group.permissions.filter(id__in=feature_ids).values_list("id", flat=True)
    )
