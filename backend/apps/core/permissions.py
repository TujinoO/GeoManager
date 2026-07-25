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
        "view_system_logs",
        "查看系统日志",
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
        "查看指定角色日志",
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
        "core",
        "FeaturePermission",
        "manage_data_backup",
        "管理数据备份",
        "后台权限",
    ),
    FeaturePermissionDef(
        "core", "FeaturePermission", "manage_auth", "修改认证授权", "人员权限"
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "view_dashboard_resource_card",
        "查看概览数据资源卡片",
        "概览权限",
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "view_dashboard_layer_card",
        "查看概览图层数卡片",
        "概览权限",
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "view_dashboard_raster_card",
        "查看概览栅格数量卡片",
        "概览权限",
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "view_dashboard_user_card",
        "查看概览用户数量卡片",
        "概览权限",
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "view_dashboard_active_users_card",
        "查看概览活跃用户卡片",
        "概览权限",
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "view_dashboard_system_card",
        "查看概览系统信息",
        "概览权限",
    ),
    FeaturePermissionDef(
        "core",
        "FeaturePermission",
        "view_data_overview",
        "查看总数据情况",
        "概览权限",
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
        "core",
        "FeaturePermission",
        "ai_interpretation",
        "AI智能解译",
        "数据权限",
    ),
    FeaturePermissionDef(
        "catalog", "DataResource", "export_dataresource", "导出数据资源", "数据权限"
    ),
    FeaturePermissionDef(
        "catalog", "DataResource", "add_dataresource", "新增数据资源", "数据权限"
    ),
    FeaturePermissionDef(
        "catalog", "DataResource", "view_dataresource", "查看存量数据资源", "数据权限"
    ),
    FeaturePermissionDef(
        "catalog", "DataResource", "change_dataresource", "编辑数据资源", "数据权限"
    ),
    FeaturePermissionDef(
        "catalog", "DataResource", "delete_dataresource", "删除数据资源", "数据权限"
    ),
    FeaturePermissionDef(
        "catalog", "WorkspaceScene", "add_workspacescene", "新增工程专题", "数据权限"
    ),
    FeaturePermissionDef(
        "catalog", "WorkspaceScene", "view_workspacescene", "查看工程专题", "数据权限"
    ),
    FeaturePermissionDef(
        "catalog", "WorkspaceScene", "change_workspacescene", "编辑工程专题", "数据权限"
    ),
    FeaturePermissionDef(
        "catalog", "WorkspaceScene", "delete_workspacescene", "删除工程专题", "数据权限"
    ),
    FeaturePermissionDef(
        "catalog", "MapComposition", "add_mapcomposition", "新建专题出图稿", "数据权限"
    ),
    FeaturePermissionDef(
        "catalog", "MapComposition", "view_mapcomposition", "查看专题出图稿", "数据权限"
    ),
    FeaturePermissionDef(
        "catalog",
        "MapComposition",
        "change_mapcomposition",
        "编辑专题出图稿",
        "数据权限",
    ),
    FeaturePermissionDef(
        "catalog",
        "MapComposition",
        "delete_mapcomposition",
        "删除专题出图稿",
        "数据权限",
    ),
    FeaturePermissionDef(
        "catalog",
        "MapComposition",
        "export_mapcomposition",
        "导出专题图成果",
        "数据权限",
    ),
    FeaturePermissionDef(
        "catalog",
        "MapComposition",
        "publish_mapcomposition",
        "发布专题图成果",
        "数据权限",
    ),
    FeaturePermissionDef(
        "catalog",
        "MapComposition",
        "restore_mapcomposition",
        "还原专题图为工程",
        "数据权限",
    ),
    FeaturePermissionDef(
        "catalog", "ResultArtifact", "view_resultartifact", "查看成果文件", "成果权限"
    ),
    FeaturePermissionDef(
        "catalog", "ResultArtifact", "add_resultartifact", "导入成果文件", "成果权限"
    ),
    FeaturePermissionDef(
        "catalog",
        "ResultArtifact",
        "download_resultartifact",
        "下载成果文件",
        "成果权限",
    ),
    FeaturePermissionDef(
        "catalog",
        "ResultArtifact",
        "publish_resultartifact",
        "发布或下架成果文件",
        "成果权限",
    ),
    FeaturePermissionDef(
        "catalog",
        "ResultArtifact",
        "delete_resultartifact",
        "删除成果文件",
        "成果权限",
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
ALWAYS_GRANTED_FEATURE_PERMISSIONS = frozenset({"core.view_own_operation_logs"})


def has_feature_perm(user, perm_name: str) -> bool:
    if not user.is_authenticated:
        return False
    if perm_name in ALWAYS_GRANTED_FEATURE_PERMISSIONS:
        return True
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
    return ALWAYS_GRANTED_FEATURE_PERMISSIONS | {
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
    } - ALWAYS_GRANTED_FEATURE_PERMISSIONS
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
    return (
        granted_feature_permissions(user) - disabled_feature_permissions(user)
    ) | ALWAYS_GRANTED_FEATURE_PERMISSIONS


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
    return "、".join(names) if names else "未分配角色"


def permission_denied_message(user) -> str:
    return f"当前角色“{group_names(user)}”无权限"


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
