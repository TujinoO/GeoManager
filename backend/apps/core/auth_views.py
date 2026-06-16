import json

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from apps.audit.service import log_operation
from apps.core.api import api_login_required
from apps.core.initialization import (
    ensure_default_user_group,
    ensure_guest_user,
    ensure_superadmin_defaults,
)
from apps.core.passwords import password_validation_errors
from apps.core.permissions import (
    direct_feature_permissions,
    effective_feature_permissions,
    feature_permission_queryset,
    has_feature_perm,
)
from apps.core.views import registration_allowed


@require_GET
@ensure_csrf_cookie
def csrf_cookie(request):
    return JsonResponse({"detail": "csrf cookie set"})


@require_POST
def login_view(request):
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"detail": "请求体不是有效 JSON"}, status=400)

    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))
    remember = bool(payload.get("remember", False))
    user = authenticate(request, username=username, password=password)
    if user is None or not user.is_active:
        log_operation(
            None,
            "认证授权",
            "用户登录",
            "failed",
            f"登录失败：{username}",
            request,
        )
        return JsonResponse({"detail": "账号或密码错误"}, status=400)

    login(request, user)
    if not remember:
        request.session.set_expiry(0)
    log_operation(user, "认证授权", "用户登录", "success", "登录成功", request)
    return JsonResponse({"user": serialize_user(user)})


@require_POST
def guest_login_view(request):
    ensure_superadmin_defaults(create_account=False)
    user = ensure_guest_user()
    login(request, user)
    request.session.set_expiry(0)
    log_operation(user, "认证授权", "游客登录", "success", "游客登录成功", request)
    return JsonResponse({"user": serialize_user(user)})


@require_POST
def register_view(request):
    if not registration_allowed():
        return JsonResponse({"detail": "当前系统未开放自助注册"}, status=403)

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"detail": "请求体不是有效 JSON"}, status=400)

    username = str(payload.get("username", "")).strip()
    email = str(payload.get("email", "")).strip()
    password = str(payload.get("password", ""))
    password_confirm = str(payload.get("passwordConfirm", ""))
    if not username:
        return JsonResponse({"detail": "请输入账号"}, status=400)
    if password != password_confirm:
        return JsonResponse({"detail": "两次输入的密码不一致"}, status=400)
    password_errors = password_validation_errors(password)
    if password_errors:
        return JsonResponse({"detail": "；".join(password_errors)}, status=400)

    ensure_superadmin_defaults()
    default_user_group = ensure_default_user_group()
    User = get_user_model()
    user = User(username=username, email=email)
    try:
        with transaction.atomic():
            user.set_password(password)
            user.save()
            user.groups.add(default_user_group)
    except IntegrityError:
        return JsonResponse({"detail": "账号已存在"}, status=400)

    login(request, user)
    message = "用户注册成功"
    log_operation(user, "认证授权", "用户注册", "success", message, request)
    return JsonResponse({"user": serialize_user(user), "detail": message})


@require_POST
@api_login_required
def logout_view(request):
    user = request.user
    logout(request)
    log_operation(user, "认证授权", "用户退出", "success", "退出登录", request)
    return JsonResponse({"detail": "已退出"})


@require_GET
def me_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False}, status=401)
    return JsonResponse({"authenticated": True, "user": serialize_user(request.user)})


def serialize_user(user):
    groups = list(user.groups.values_list("name", flat=True))
    group_ids = list(user.groups.values_list("id", flat=True))
    profile = _profile_values(user)
    permissions = {
        "canAccessAdmin": True,
        "canManageFeaturePermissions": has_feature_perm(
            user, "core.manage_feature_permissions"
        ),
        "canCreateUser": has_feature_perm(user, "core.create_user"),
        "canViewOperationLogs": has_feature_perm(user, "core.view_operation_logs"),
        "canViewAllOperationLogs": has_feature_perm(
            user, "core.view_all_operation_logs"
        ),
        "canViewOwnOperationLogs": has_feature_perm(
            user, "core.view_own_operation_logs"
        ),
        "canViewGroupOperationLogs": has_feature_perm(
            user, "core.view_group_operation_logs"
        ),
        "canManageSystemSettings": has_feature_perm(
            user, "core.manage_system_settings"
        ),
        "canManageAuth": has_feature_perm(user, "core.manage_auth"),
        "canViewDashboardResourceCard": has_feature_perm(
            user, "core.view_dashboard_resource_card"
        ),
        "canViewDashboardLayerCard": has_feature_perm(
            user, "core.view_dashboard_layer_card"
        ),
        "canViewDashboardRasterCard": has_feature_perm(
            user, "core.view_dashboard_raster_card"
        ),
        "canViewDashboardUserCard": has_feature_perm(
            user, "core.view_dashboard_user_card"
        ),
        "canViewDashboardActiveUsersCard": has_feature_perm(
            user, "core.view_dashboard_active_users_card"
        ),
        "canViewDashboardSystemCard": has_feature_perm(
            user, "core.view_dashboard_system_card"
        ),
        "canViewDataOverview": has_feature_perm(user, "core.view_data_overview"),
        "canBrowseData": has_feature_perm(user, "core.browse_data"),
        "canQueryData": has_feature_perm(user, "core.query_data"),
        "canUploadData": has_feature_perm(user, "core.upload_data"),
        "canLoadVectorLayer": has_feature_perm(user, "core.load_vector_layer"),
        "canLoadRasterLayer": has_feature_perm(user, "core.load_raster_layer"),
        "canUseCustomSymbolization": has_feature_perm(
            user, "core.custom_symbolization"
        ),
        "canExportData": has_feature_perm(user, "catalog.export_dataresource"),
        "canMaintainData": has_feature_perm(user, "catalog.maintain_dataresource"),
        "canManageRasterData": has_feature_perm(user, "raster.manage_raster_dataset")
        or has_feature_perm(user, "catalog.maintain_dataresource"),
    }
    return {
        "id": user.id,
        "username": user.get_username(),
        "displayName": user.get_full_name() or user.get_username(),
        "email": user.email,
        "avatarUrl": profile["avatar_url"],
        "department": profile["department"],
        "isStaff": user.is_staff,
        "isSuperuser": user.is_superuser,
        "roles": groups,
        "groupIds": group_ids,
        "isActive": user.is_active,
        "groupPermissions": sorted(group_feature_permissions(user)),
        "directPermissions": sorted(direct_feature_permissions(user)),
        "effectivePermissions": sorted(effective_feature_permissions(user)),
        "operationLogGroupIds": profile["operation_log_group_ids"],
        "permissions": permissions,
    }


def _profile_values(user):
    try:
        profile = user.profile
    except ObjectDoesNotExist:
        return {"avatar_url": "", "department": "", "operation_log_group_ids": []}
    avatar_url = profile.avatar_url
    if profile.avatar_data:
        avatar_url = f"/api/users/{user.id}/avatar/"
    return {
        "avatar_url": avatar_url,
        "department": profile.department,
        "operation_log_group_ids": profile.operation_log_group_ids,
    }


def group_feature_permissions(user) -> set[str]:
    if not user.is_authenticated:
        return set()
    feature_ids = set(feature_permission_queryset().values_list("id", flat=True))
    return {
        f"{permission.content_type.app_label}.{permission.codename}"
        for group in user.groups.prefetch_related("permissions__content_type").all()
        for permission in group.permissions.all()
        if permission.id in feature_ids
    }
