from __future__ import annotations

from dataclasses import dataclass

from django.contrib.auth.models import Permission
from django.http import JsonResponse


@dataclass(frozen=True)
class FeaturePermissionDef:
    app_label: str
    codename: str
    name: str
    group: str

    @property
    def perm_name(self) -> str:
        return f"{self.app_label}.{self.codename}"


FEATURE_PERMISSIONS: tuple[FeaturePermissionDef, ...] = (
    FeaturePermissionDef("core", "access_admin", "进入后台管理", "系统管理"),
    FeaturePermissionDef("core", "manage_feature_permissions", "配置功能权限", "系统管理"),
    FeaturePermissionDef("core", "browse_data", "浏览数据", "数据功能"),
    FeaturePermissionDef("core", "query_data", "查询数据", "数据功能"),
    FeaturePermissionDef("core", "load_vector_layer", "加载矢量图层", "图层功能"),
    FeaturePermissionDef("core", "load_raster_layer", "加载栅格图层", "图层功能"),
    FeaturePermissionDef("core", "custom_symbolization", "自定义符号化", "图层功能"),
    FeaturePermissionDef("catalog", "export_dataresource", "导出数据资源", "数据管理"),
    FeaturePermissionDef("catalog", "maintain_dataresource", "维护数据资源", "数据管理"),
    FeaturePermissionDef("raster", "manage_raster_dataset", "管理栅格数据集", "栅格管理"),
)

FEATURE_PERMISSION_NAMES = tuple(item.perm_name for item in FEATURE_PERMISSIONS)


def has_feature_perm(user, perm_name: str) -> bool:
    return bool(user.is_authenticated and (user.is_superuser or user.has_perm(perm_name)))


def group_names(user) -> str:
    names = list(user.groups.values_list("name", flat=True)) if user.is_authenticated else []
    return "、".join(names) if names else "未分组"


def permission_denied_message(user) -> str:
    return f"当前用户组“{group_names(user)}”无权限"


def feature_denied_response(user) -> JsonResponse:
    return JsonResponse({"detail": permission_denied_message(user)}, status=403)


def feature_permission_queryset():
    app_labels = {item.app_label for item in FEATURE_PERMISSIONS}
    codenames = {item.codename for item in FEATURE_PERMISSIONS}
    return Permission.objects.select_related("content_type").filter(
        content_type__app_label__in=app_labels,
        codename__in=codenames,
    )


def feature_permission_ids_for(group) -> set[int]:
    feature_ids = feature_permission_queryset().values_list("id", flat=True)
    return set(group.permissions.filter(id__in=feature_ids).values_list("id", flat=True))
