from __future__ import annotations

import io
import json
import os
import platform
import re
import shutil
import subprocess
from calendar import monthrange
from datetime import datetime, time, timedelta
from functools import wraps
from pathlib import Path
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model, update_session_auth_hash
from django.contrib.auth.models import Group
from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from django.views.decorators.http import require_GET, require_http_methods

from apps.audit.models import OperationLog
from apps.audit.service import log_operation
from apps.catalog.models import DataResource, MapLayer
from apps.core.auth_views import serialize_user
from apps.core.config import (
    load_runtime_config_document,
    update_runtime_application_config,
)
from apps.core.initialization import (
    GUEST_GROUP_NAME,
    SUPERADMIN_GROUP_NAME,
    ensure_superadmin_defaults,
    is_guest_group,
    is_initial_superadmin_user,
    is_superadmin_group,
    is_superadmin_user,
    protected_group_permissions,
    superadmin_group_locked_permissions,
)
from apps.core.models import SystemSetting, UserProfile
from apps.core.passwords import generate_password, password_validation_errors
from apps.core.permissions import (
    FEATURE_PERMISSION_NAMES,
    FEATURE_PERMISSIONS,
    disabled_feature_permissions,
    effective_feature_permissions,
    feature_permission_queryset,
    granted_feature_permissions,
    has_feature_perm,
)
from apps.raster.models import RasterDataset


def api_login_required(view_func):
    @wraps(view_func)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"detail": "请先登录"}, status=401)
        return view_func(request, *args, **kwargs)

    return wrapped


def api_permission_required(perm_name: str):
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse({"detail": "请先登录"}, status=401)
            if not has_feature_perm(request.user, perm_name):
                return JsonResponse({"detail": "当前用户无后台管理权限"}, status=403)
            return view_func(request, *args, **kwargs)

        return wrapped

    return decorator


def api_any_permission_required(*perm_names: str):
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse({"detail": "请先登录"}, status=401)
            if not any(has_feature_perm(request.user, perm) for perm in perm_names):
                return JsonResponse({"detail": "当前用户无后台管理权限"}, status=403)
            return view_func(request, *args, **kwargs)

        return wrapped

    return decorator


@require_GET
@api_login_required
def admin_profile(request):
    return JsonResponse(_serialize_profile(request.user))


@require_http_methods(["POST"])
@api_login_required
def update_admin_profile(request):
    payload = _json_payload(request)
    if isinstance(payload, JsonResponse):
        return payload

    user = request.user
    profile = _ensure_profile(user)
    # 用户名在创建时确定，不允许修改
    display_name = payload.get("displayName")
    email = payload.get("email")
    avatar_url = payload.get("avatarUrl")
    department = payload.get("department")

    if display_name is not None:
        user.first_name = str(display_name).strip()
        user.last_name = ""
    if email is not None:
        user.email = str(email).strip()
    if avatar_url is not None:
        profile.avatar_url = str(avatar_url).strip()
    if department is not None:
        profile.department = str(department).strip()

    try:
        with transaction.atomic():
            user.save()
            profile.save()
    except IntegrityError:
        return JsonResponse({"detail": "保存失败"}, status=400)

    return JsonResponse(_serialize_profile(user))


@require_http_methods(["POST"])
@api_login_required
def upload_avatar(request):
    """上传用户头像"""
    if "avatar" not in request.FILES:
        return JsonResponse({"detail": "请选择头像文件"}, status=400)

    avatar_file = request.FILES["avatar"]

    # 验证文件格式
    allowed_types = ["image/jpeg", "image/png"]
    if avatar_file.content_type not in allowed_types:
        return JsonResponse({"detail": "头像格式仅支持 JPG 和 PNG"}, status=400)

    # 验证文件大小 (2MB)
    max_size = 2 * 1024 * 1024
    if avatar_file.size > max_size:
        return JsonResponse({"detail": "头像文件大小不能超过 2MB"}, status=400)

    # 读取文件数据
    file_data = avatar_file.read()

    # 压缩图片至合适尺寸
    try:
        from PIL import Image

        image = Image.open(io.BytesIO(file_data))
        # 转换为RGB模式（如果是RGBA）
        if image.mode in ("RGBA", "LA"):
            background = Image.new("RGB", image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[-1])
            image = background
        elif image.mode != "RGB":
            image = image.convert("RGB")

        # 压缩到合适尺寸 (最大 300x300)
        max_size_pixels = (300, 300)
        image.thumbnail(max_size_pixels, Image.Resampling.LANCZOS)

        # 保存为JPEG格式
        output = io.BytesIO()
        image.save(output, format="JPEG", quality=85)
        file_data = output.getvalue()
        content_type = "image/jpeg"
    except ImportError:
        # 如果没有PIL，直接使用原始数据
        content_type = avatar_file.content_type
    except Exception:
        # 如果图片处理失败，使用原始数据
        content_type = avatar_file.content_type

    # 保存到数据库
    user = request.user
    profile = _ensure_profile(user)
    profile.avatar_data = file_data
    profile.avatar_content_type = content_type
    # 清除URL头像
    profile.avatar_url = ""
    profile.save(
        update_fields=["avatar_data", "avatar_content_type", "avatar_url", "updated_at"]
    )

    log_operation(
        request.user,
        "用户设置",
        "上传头像",
        "success",
        "上传头像成功",
        request,
    )

    return JsonResponse(_serialize_profile(user))


@require_http_methods(["GET"])
@api_login_required
def get_avatar(request, user_id: int):
    """获取用户头像"""
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return JsonResponse({"detail": "用户不存在"}, status=404)

    try:
        profile = user.profile
        if profile.avatar_data:
            from django.http import HttpResponse

            response = HttpResponse(
                profile.avatar_data, content_type=profile.avatar_content_type
            )
            response["Content-Disposition"] = f'inline; filename="avatar_{user_id}.jpg"'
            return response
    except ObjectDoesNotExist:
        pass

    return JsonResponse({"detail": "用户未设置头像"}, status=404)


@require_http_methods(["POST"])
@api_login_required
def update_admin_profile_permissions(request):
    payload = _json_payload(request)
    if isinstance(payload, JsonResponse):
        return payload

    disabled = payload.get("disabledPermissions")
    if not isinstance(disabled, list):
        return JsonResponse({"detail": "disabledPermissions 必须是数组"}, status=400)
    disabled_set = {str(permission) for permission in disabled}
    granted = granted_feature_permissions(request.user)
    invalid = sorted(disabled_set - granted)
    if invalid:
        return JsonResponse(
            {"detail": f"不能关闭未授予的权限：{', '.join(invalid)}"},
            status=400,
        )
    locked_permissions = superadmin_group_locked_permissions()
    if is_superadmin_user(request.user) and disabled_set & locked_permissions:
        return JsonResponse(
            {"detail": "超级管理员不能关闭后台访问权限"},
            status=400,
        )

    profile = _ensure_profile(request.user)
    profile.disabled_permissions = sorted(disabled_set)
    profile.save(update_fields=["disabled_permissions", "updated_at"])
    return JsonResponse(_serialize_profile(request.user))


@require_http_methods(["POST"])
@api_login_required
def update_admin_profile_password(request):
    payload = _json_payload(request)
    if isinstance(payload, JsonResponse):
        return payload

    current_password = str(payload.get("currentPassword", ""))
    new_password = str(payload.get("newPassword", ""))
    password_confirm = str(payload.get("passwordConfirm", ""))
    if not request.user.check_password(current_password):
        log_operation(
            request.user,
            "认证授权",
            "修改密码",
            "failed",
            "当前密码验证失败",
            request,
        )
        return JsonResponse({"detail": "当前密码不正确"}, status=400)
    if new_password != password_confirm:
        log_operation(
            request.user,
            "认证授权",
            "修改密码",
            "failed",
            "两次输入的新密码不一致",
            request,
        )
        return JsonResponse({"detail": "两次输入的新密码不一致"}, status=400)
    if current_password == new_password:
        log_operation(
            request.user,
            "认证授权",
            "修改密码",
            "failed",
            "新密码与当前密码相同",
            request,
        )
        return JsonResponse({"detail": "新密码不能与当前密码相同"}, status=400)
    password_errors = password_validation_errors(new_password, user=request.user)
    if password_errors:
        log_operation(
            request.user,
            "认证授权",
            "修改密码",
            "failed",
            "新密码强度校验失败",
            request,
        )
        return JsonResponse({"detail": "；".join(password_errors)}, status=400)

    request.user.set_password(new_password)
    request.user.save(update_fields=["password"])
    update_session_auth_hash(request, request.user)
    log_operation(
        request.user,
        "认证授权",
        "修改密码",
        "success",
        "用户已修改密码",
        request,
    )
    return JsonResponse({"detail": "密码已更新"})


@require_http_methods(["GET", "POST"])
@api_permission_required("core.manage_auth")
def group_list(request):
    if request.method == "GET":
        ensure_superadmin_defaults(create_account=False)
        return JsonResponse(
            {
                "items": [_serialize_group(group) for group in _groups()],
                "availablePermissions": _available_permissions(),
            }
        )
    if not has_feature_perm(request.user, "core.manage_feature_permissions"):
        return JsonResponse({"detail": "当前用户无权限配置用户组"}, status=403)

    payload = _json_payload(request)
    if isinstance(payload, JsonResponse):
        return payload
    name = _required_string(payload.get("name"), "name")
    if isinstance(name, JsonResponse):
        return name
    permissions = _permission_names(payload.get("permissions", []))
    if isinstance(permissions, JsonResponse):
        return permissions

    try:
        group = Group.objects.create(name=name)
        _set_group_feature_permissions(group, permissions)
    except IntegrityError:
        return JsonResponse({"detail": "用户组名称已存在"}, status=400)

    log_operation(
        request.user, "认证授权", "创建用户组", "success", group.name, request
    )
    return JsonResponse(_serialize_group(group), status=201)


@require_http_methods(["POST"])
@api_permission_required("core.manage_auth")
def group_detail(request, group_id: int):
    try:
        group = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        return JsonResponse({"detail": "用户组不存在"}, status=404)

    payload = _json_payload(request)
    if isinstance(payload, JsonResponse):
        return payload

    # 检查是否是删除操作
    if payload.get("action") == "delete":
        if is_superadmin_group(group) or is_guest_group(group):
            return JsonResponse({"detail": "系统内置用户组不能删除"}, status=400)
        if group.user_set.exists():
            return JsonResponse({"detail": "用户组仍有关联用户，不能删除"}, status=400)
        group_name = group.name
        group.delete()
        log_operation(
            request.user, "认证授权", "删除用户组", "success", group_name, request
        )
        return JsonResponse({"detail": "用户组已删除"})

    payload = _json_payload(request)
    if isinstance(payload, JsonResponse):
        return payload
    if "name" in payload:
        name = _required_string(payload.get("name"), "name")
        if isinstance(name, JsonResponse):
            return name
        if is_superadmin_group(group) and name != SUPERADMIN_GROUP_NAME:
            return JsonResponse(
                {"detail": "超级管理员用户组名称不能修改"},
                status=400,
            )
        if is_guest_group(group) and name != GUEST_GROUP_NAME:
            return JsonResponse(
                {"detail": "游客用户组名称不能修改"},
                status=400,
            )
        group.name = name
    if "permissions" in payload:
        permissions = _permission_names(payload.get("permissions"))
        if isinstance(permissions, JsonResponse):
            return permissions
        if is_superadmin_group(group):
            locked = superadmin_group_locked_permissions()
            if locked - set(permissions):
                return JsonResponse(
                    {"detail": "超级管理员用户组必须保留后台访问权限"},
                    status=400,
                )
            permissions = protected_group_permissions()
        if is_guest_group(group):
            permissions = sorted(set(permissions))
        _set_group_feature_permissions(group, permissions)
    try:
        group.save()
    except IntegrityError:
        return JsonResponse({"detail": "用户组名称已存在"}, status=400)
    log_operation(
        request.user, "认证授权", "更新用户组", "success", group.name, request
    )
    return JsonResponse(_serialize_group(group))


@require_http_methods(["GET", "POST"])
@api_permission_required("core.manage_auth")
def user_list(request):
    User = get_user_model()
    if request.method == "POST":
        if not has_feature_perm(request.user, "core.create_user"):
            return JsonResponse({"detail": "当前用户无新建用户权限"}, status=403)
        payload = _json_payload(request)
        if isinstance(payload, JsonResponse):
            return payload
        result = _create_admin_user(User, payload)
        if isinstance(result, JsonResponse):
            return result
        created, generated_password = result
        log_operation(
            request.user,
            "认证授权",
            "创建用户",
            "success",
            created.get_username(),
            request,
        )
        response_data = _serialize_admin_user(created)
        response_data["generatedPassword"] = generated_password
        return JsonResponse(response_data, status=201)

    users = User.objects.prefetch_related("groups").order_by("id")
    return JsonResponse({"items": [_serialize_admin_user(user) for user in users]})


@require_http_methods(["POST"])
@api_permission_required("core.manage_auth")
def user_detail(request, user_id: int):
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return JsonResponse({"detail": "用户不存在"}, status=404)

    payload = _json_payload(request)
    if isinstance(payload, JsonResponse):
        return payload

    # 检查是否是删除操作
    if payload.get("action") == "delete":
        if user.pk == request.user.pk:
            return JsonResponse({"detail": "不能删除当前登录用户"}, status=400)
        if is_initial_superadmin_user(user):
            return JsonResponse({"detail": "初始化管理员不能删除"}, status=400)
        username = user.get_username()
        user.delete()
        log_operation(
            request.user,
            "认证授权",
            "删除用户",
            "success",
            username,
            request,
        )
        return JsonResponse({"detail": "用户已删除"})

    payload = _json_payload(request)
    if isinstance(payload, JsonResponse):
        return payload
    if "isActive" not in payload:
        return JsonResponse({"detail": "缺少 isActive"}, status=400)
    is_active = bool(payload["isActive"])
    if not is_active and user.pk == request.user.pk:
        return JsonResponse({"detail": "不能停用当前登录用户"}, status=400)
    if not is_active and is_initial_superadmin_user(user):
        return JsonResponse({"detail": "初始化管理员不能停用"}, status=400)
    user.is_active = is_active
    user.save(update_fields=["is_active"])
    log_operation(
        request.user,
        "认证授权",
        "更新用户状态",
        "success",
        f"{user.get_username()} {'启用' if is_active else '停用'}",
        request,
    )
    return JsonResponse(_serialize_admin_user(user))


@require_http_methods(["POST"])
@api_permission_required("core.manage_auth")
def reset_user_password(request, user_id: int):
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return JsonResponse({"detail": "用户不存在"}, status=404)
    if user.pk == request.user.pk:
        return JsonResponse({"detail": "不能重置当前登录用户密码"}, status=400)

    password = generate_password()
    user.set_password(password)
    user.save(update_fields=["password"])
    log_operation(
        request.user,
        "认证授权",
        "重置用户密码",
        "success",
        user.get_username(),
        request,
    )
    response_data = _serialize_admin_user(user)
    response_data["generatedPassword"] = password
    return JsonResponse(response_data)


@require_http_methods(["POST"])
@api_permission_required("core.manage_auth")
def update_user_groups(request, user_id: int):
    payload = _json_payload(request)
    if isinstance(payload, JsonResponse):
        return payload
    group_ids = payload.get("groupIds")
    if not isinstance(group_ids, list):
        return JsonResponse({"detail": "groupIds 必须是数组"}, status=400)

    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return JsonResponse({"detail": "用户不存在"}, status=404)

    try:
        normalized_group_ids = {int(group_id) for group_id in group_ids}
    except (TypeError, ValueError):
        return JsonResponse({"detail": "groupIds 必须是整数数组"}, status=400)
    if is_initial_superadmin_user(user):
        _, protected_group = ensure_superadmin_defaults(create_account=False)
        normalized_group_ids.add(protected_group.id)
    elif not normalized_group_ids:
        return JsonResponse({"detail": "用户组为必选项"}, status=400)

    groups = list(Group.objects.filter(id__in=normalized_group_ids))
    if len(groups) != len(normalized_group_ids):
        return JsonResponse({"detail": "包含不存在的用户组"}, status=400)
    if not is_initial_superadmin_user(user) and any(
        is_superadmin_group(group) for group in groups
    ):
        return JsonResponse(
            {"detail": "不能将普通用户加入超级管理员用户组"}, status=400
        )
    user.groups.set(groups)
    log_operation(
        request.user,
        "认证授权",
        "设置用户组",
        "success",
        user.get_username(),
        request,
    )
    return JsonResponse(_serialize_admin_user(user))


@require_http_methods(["GET", "POST"])
@api_permission_required("core.manage_system_settings")
def admin_settings(request):
    if request.method == "GET":
        return JsonResponse(_serialize_application_settings(request.user))

    payload = _json_payload(request)
    if isinstance(payload, JsonResponse):
        return payload

    patch: dict[str, Any] = {}
    if "systemName" in payload:
        system_name = _required_string(payload["systemName"], "systemName")
        if isinstance(system_name, JsonResponse):
            return system_name
        patch.setdefault("system", {})["name"] = system_name
    if "allowRegistration" in payload:
        patch.setdefault("system", {})["allow_registration"] = bool(
            payload["allowRegistration"]
        )
    if "map" in payload:
        map_patch = _map_patch(payload["map"])
        if isinstance(map_patch, JsonResponse):
            return map_patch
        patch["map"] = map_patch
    if "limits" in payload:
        limits_patch = _limits_patch(payload["limits"])
        if isinstance(limits_patch, JsonResponse):
            return limits_patch
        patch["limits"] = limits_patch
    if "raster" in payload:
        raster_patch = _raster_patch(payload["raster"])
        if isinstance(raster_patch, JsonResponse):
            return raster_patch
        patch["raster"] = raster_patch

    if patch:
        update_runtime_application_config(settings.PROJECT_CONFIG, patch)
        if "system" in patch and "allow_registration" in patch["system"]:
            SystemSetting.objects.update_or_create(
                pk=1,
                defaults={"allow_registration": patch["system"]["allow_registration"]},
            )
        log_operation(request.user, "系统设置", "保存配置", "success", "", request)

    return JsonResponse(_serialize_application_settings(request.user))


@require_GET
@api_permission_required("core.view_operation_logs")
def admin_operation_logs(request):
    logs = OperationLog.objects.select_related("user").order_by("-created_at")
    logs = _filter_operation_logs(logs, request.GET)
    total = logs.count()
    current = _positive_query_int(request.GET.get("current"), default=1)
    page_size = _positive_query_int(request.GET.get("pageSize"), default=20)
    if isinstance(current, JsonResponse):
        return current
    if isinstance(page_size, JsonResponse):
        return page_size
    start = (current - 1) * page_size
    end = start + page_size
    return JsonResponse(
        {
            "items": [_serialize_operation_log(log) for log in logs[start:end]],
            "total": total,
        }
    )


@require_GET
@api_permission_required("core.access_admin")
def admin_dashboard(request):
    period = _active_period(request.GET.get("period"))
    if isinstance(period, JsonResponse):
        return period
    period_start, period_end = _active_period_bounds(period)
    login_logs = OperationLog.objects.filter(
        module="auth",
        action="login",
        status=OperationLog.Status.SUCCESS,
        created_at__gte=period_start,
        created_at__lt=period_end,
        user_id__isnull=False,
    )
    active_user_count = login_logs.values("user_id").distinct().count()
    series = _active_user_series(login_logs, period, period_start)
    ranking = _active_user_ranking(login_logs)

    data_counts = {
        "resources": DataResource.objects.count(),
        "activeResources": DataResource.objects.filter(
            status=DataResource.Status.ACTIVE
        ).count(),
        "layers": MapLayer.objects.count(),
        "activeLayers": MapLayer.objects.filter(is_active=True).count(),
        "vectorResources": DataResource.objects.filter(
            data_type=DataResource.DataType.VECTOR
        ).count(),
        "rasterResources": DataResource.objects.filter(
            data_type=DataResource.DataType.RASTER
        ).count(),
        "rasterDatasets": RasterDataset.objects.count(),
        "rasterLayers": MapLayer.objects.filter(
            layer_type=MapLayer.LayerType.RASTER
        ).count(),
        "tableResources": DataResource.objects.filter(
            data_type=DataResource.DataType.TABLE
        ).count(),
        "users": get_user_model().objects.count(),
    }

    return JsonResponse(
        {
            "generatedAt": timezone.localtime().isoformat(),
            "dataCounts": data_counts,
            "activeUsers": {
                "period": period,
                "rangeStart": timezone.localtime(period_start).date().isoformat(),
                "rangeEnd": (timezone.localtime(period_end) - timedelta(days=1))
                .date()
                .isoformat(),
                "count": active_user_count,
                "loginCount": login_logs.count(),
                "series": series,
                "ranking": ranking,
            },
        }
    )


@require_GET
@api_permission_required("core.access_admin")
def admin_dashboard_server(request):
    return JsonResponse(_server_snapshot())


def _active_period(value: Any) -> str | JsonResponse:
    period = str(value or "day").strip()
    if period not in {"day", "week", "month"}:
        return JsonResponse({"detail": "period 仅支持 day、week、month"}, status=400)
    return period


def _active_period_bounds(period: str):
    today = timezone.localdate()
    if period == "week":
        start_date = today - timedelta(days=today.weekday())
        end_date = start_date + timedelta(days=7)
    elif period == "month":
        start_date = today.replace(day=1)
        end_date = start_date + timedelta(days=monthrange(today.year, today.month)[1])
    else:
        start_date = today
        end_date = today + timedelta(days=1)
    start = timezone.make_aware(datetime.combine(start_date, time.min))
    end = timezone.make_aware(datetime.combine(end_date, time.min))
    return start, end


def _active_user_series(login_logs, period: str, period_start) -> list[dict[str, Any]]:
    if period == "day":
        counts = {hour: 0 for hour in range(24)}
        for created_at in login_logs.values_list("created_at", flat=True):
            counts[timezone.localtime(created_at).hour] += 1
        return [
            {"key": str(hour), "label": f"{hour:02d}:00", "count": count}
            for hour, count in counts.items()
        ]

    start_date = timezone.localtime(period_start).date()
    days = 7 if period == "week" else monthrange(start_date.year, start_date.month)[1]
    counts = {start_date + timedelta(days=offset): 0 for offset in range(days)}
    for created_at in login_logs.values_list("created_at", flat=True):
        date = timezone.localtime(created_at).date()
        if date in counts:
            counts[date] += 1
    return [
        {
            "key": date.isoformat(),
            "label": date.strftime("%m-%d"),
            "count": count,
        }
        for date, count in counts.items()
    ]


def _active_user_ranking(login_logs) -> list[dict[str, Any]]:
    ranked_logs = (
        login_logs.values("user_id", "user__username", "user__first_name")
        .annotate(login_count=Count("id"))
        .order_by("-login_count", "user__username")[:5]
    )
    return [
        {
            "userId": row["user_id"],
            "displayName": row["user__first_name"] or row["user__username"],
            "username": row["user__username"],
            "loginCount": row["login_count"],
        }
        for row in ranked_logs
    ]


def _server_snapshot() -> dict[str, Any]:
    return {
        "generatedAt": timezone.localtime().isoformat(),
        "hostname": platform.node(),
        "platform": platform.platform(),
        "cpu": _cpu_snapshot(),
        "memory": _memory_snapshot(),
        "disks": _disk_snapshot(),
    }


def _cpu_snapshot() -> dict[str, Any]:
    logical_count = os.cpu_count() or 1
    load_average = _load_average()
    usage_percent = _cpu_usage_percent(logical_count, load_average)
    return {
        "model": _cpu_model(),
        "physicalCount": _physical_cpu_count(logical_count),
        "logicalCount": logical_count,
        "usagePercent": usage_percent,
        "loadAverage": load_average,
    }


def _cpu_model() -> str:
    if platform.system() == "Darwin":
        return _run_text(["sysctl", "-n", "machdep.cpu.brand_string"])
    if platform.system() == "Windows":
        return _run_text(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_Processor | Select-Object -First 1).Name",
            ]
        )
    if Path("/proc/cpuinfo").exists():
        for line in Path("/proc/cpuinfo").read_text(errors="ignore").splitlines():
            if line.lower().startswith("model name"):
                return line.split(":", 1)[1].strip()
    return platform.processor() or platform.machine()


def _physical_cpu_count(logical_count: int) -> int:
    if platform.system() == "Darwin":
        value = _run_text(["sysctl", "-n", "hw.physicalcpu"])
        return _safe_int(value, logical_count)
    if platform.system() == "Windows":
        value = _run_text(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfCores -Sum).Sum",
            ]
        )
        return _safe_int(value, logical_count)
    return logical_count


def _cpu_usage_percent(logical_count: int, load_average: list[float]) -> float:
    if platform.system() == "Windows":
        value = _run_text(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average",
            ]
        )
        return round(float(_safe_number(value, 0)), 1)
    return round(min((load_average[0] / logical_count) * 100, 100), 1)


def _load_average() -> list[float]:
    try:
        return [round(value, 2) for value in os.getloadavg()]
    except OSError:
        return [0.0, 0.0, 0.0]


def _memory_snapshot() -> dict[str, Any]:
    total = _memory_total_bytes()
    available = _memory_available_bytes()
    used = max(total - available, 0) if total else 0
    usage_percent = round((used / total) * 100, 1) if total else 0
    return {
        "model": "系统内存",
        "slotCount": 1 if total else 0,
        "totalBytes": total,
        "usedBytes": used,
        "availableBytes": available,
        "usagePercent": usage_percent,
    }


def _memory_total_bytes() -> int:
    if platform.system() == "Darwin":
        return _safe_int(_run_text(["sysctl", "-n", "hw.memsize"]), 0)
    if platform.system() == "Windows":
        return _safe_int(
            _run_text(
                [
                    "powershell",
                    "-NoProfile",
                    "-Command",
                    "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory",
                ]
            ),
            0,
        )
    meminfo = _linux_meminfo()
    return meminfo.get("MemTotal", 0) * 1024


def _memory_available_bytes() -> int:
    if platform.system() == "Windows":
        value = _run_text(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory",
            ]
        )
        return _safe_int(value, 0) * 1024
    if platform.system() == "Darwin":
        page_size = _safe_int(_run_text(["sysctl", "-n", "hw.pagesize"]), 4096)
        stats = _run_text(["vm_stat"])
        free_pages = 0
        for key in ("Pages free", "Pages inactive", "Pages speculative"):
            match = re.search(rf"{re.escape(key)}:\s+(\d+)\.", stats)
            if match:
                free_pages += int(match.group(1))
        return free_pages * page_size
    meminfo = _linux_meminfo()
    return meminfo.get("MemAvailable", 0) * 1024


def _linux_meminfo() -> dict[str, int]:
    meminfo_path = Path("/proc/meminfo")
    if not meminfo_path.exists():
        return {}
    values = {}
    for line in meminfo_path.read_text(errors="ignore").splitlines():
        key, _, value = line.partition(":")
        number = value.strip().split(" ")[0]
        values[key] = _safe_int(number, 0)
    return values


def _disk_snapshot() -> dict[str, Any]:
    root_usage = shutil.disk_usage(settings.BASE_DIR)
    devices = _disk_devices()
    used = root_usage.used
    total = root_usage.total
    return {
        "count": len(devices) or 1,
        "devices": devices,
        "mount": str(settings.BASE_DIR),
        "totalBytes": total,
        "usedBytes": used,
        "freeBytes": root_usage.free,
        "usagePercent": round((used / total) * 100, 1) if total else 0,
    }


def _disk_devices() -> list[dict[str, str]]:
    if platform.system() == "Darwin":
        return _darwin_disk_devices()
    if platform.system() == "Linux":
        return _linux_disk_devices()
    if platform.system() == "Windows":
        return _windows_disk_devices()
    return []


def _darwin_disk_devices() -> list[dict[str, str]]:
    text = _run_text(["diskutil", "list", "physical"])
    devices = []
    for line in text.splitlines():
        match = re.match(r"^/dev/(\S+)", line.strip())
        if match:
            device = match.group(1)
            info = _run_text(["diskutil", "info", device])
            model = ""
            size = ""
            for info_line in info.splitlines():
                if "Device / Media Name:" in info_line:
                    model = info_line.split(":", 1)[1].strip()
                if "Disk Size:" in info_line:
                    size = info_line.split(":", 1)[1].strip()
            devices.append({"name": device, "model": model, "size": size})
    return devices


def _linux_disk_devices() -> list[dict[str, str]]:
    text = _run_text(["lsblk", "-dn", "-o", "NAME,MODEL,SIZE,TYPE"])
    devices = []
    for line in text.splitlines():
        parts = line.split()
        if len(parts) >= 3 and parts[-1] == "disk":
            devices.append(
                {
                    "name": parts[0],
                    "model": " ".join(parts[1:-2]),
                    "size": parts[-2],
                }
            )
    return devices


def _windows_disk_devices() -> list[dict[str, str]]:
    text = _run_text(
        [
            "powershell",
            "-NoProfile",
            "-Command",
            'Get-CimInstance Win32_DiskDrive | ForEach-Object { "$($_.DeviceID)|$($_.Model)|$($_.Size)" }',
        ]
    )
    devices = []
    for line in text.splitlines():
        name, model, size = _split_fixed(line, "|", 3)
        if name:
            devices.append(
                {
                    "name": name,
                    "model": model,
                    "size": _format_bytes_text(_safe_int(size, 0)),
                }
            )
    return devices


def _run_text(command: list[str]) -> str:
    try:
        return subprocess.check_output(
            command,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=2,
        ).strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def _safe_int(value: Any, default: int) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def _safe_number(value: Any, default: float) -> float:
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return default


def _split_fixed(value: str, separator: str, count: int) -> list[str]:
    parts = value.split(separator)
    return [*(parts[:count]), *([""] * count)][:count]


def _format_bytes_text(value: int) -> str:
    if value <= 0:
        return ""
    units = ["B", "KB", "MB", "GB", "TB"]
    current = float(value)
    unit_index = 0
    while current >= 1024 and unit_index < len(units) - 1:
        current /= 1024
        unit_index += 1
    return f"{current:.1f} {units[unit_index]}"


def _serialize_profile(user) -> dict[str, Any]:
    profile = _ensure_profile(user)
    granted = granted_feature_permissions(user)
    disabled = disabled_feature_permissions(user)
    effective = effective_feature_permissions(user)

    # 构建头像URL
    avatar_url = profile.avatar_url
    if profile.avatar_data:
        avatar_url = f"/api/admin/users/{user.id}/avatar/"

    return {
        "user": serialize_user(user),
        "avatarUrl": avatar_url,
        "department": profile.department,
        "grantedPermissions": sorted(granted),
        "disabledPermissions": sorted(disabled),
        "effectivePermissions": sorted(effective),
        "availablePermissions": [
            _serialize_permission(item) for item in FEATURE_PERMISSIONS
        ],
    }


def _serialize_admin_user(user) -> dict[str, Any]:
    serialized = serialize_user(user)
    serialized["groupIds"] = list(user.groups.values_list("id", flat=True))
    serialized["isActive"] = user.is_active
    return serialized


def _serialize_group(group: Group) -> dict[str, Any]:
    permissions = {
        f"{permission.content_type.app_label}.{permission.codename}"
        for permission in group.permissions.select_related("content_type").all()
    }
    is_superadmin = is_superadmin_group(group)
    is_guest = is_guest_group(group)
    return {
        "id": group.id,
        "name": group.name,
        "userCount": group.user_set.count(),
        "permissions": sorted(permissions & set(FEATURE_PERMISSION_NAMES)),
        "isProtected": is_superadmin or is_guest,
        "lockedPermissions": sorted(
            superadmin_group_locked_permissions() if is_superadmin else set()
        ),
    }


def _available_permissions() -> list[dict[str, str]]:
    return [_serialize_permission(item) for item in FEATURE_PERMISSIONS]


def _serialize_permission(permission) -> dict[str, str]:
    return {
        "id": permission.perm_name,
        "label": permission.name,
        "group": permission.group,
    }


def _serialize_application_settings(user) -> dict[str, Any]:
    raw = load_runtime_config_document(settings.PROJECT_CONFIG)
    application = raw["application"]
    return {
        "systemName": application["system"]["name"],
        "allowRegistration": application["system"]["allow_registration"],
        "map": {
            "defaultCenter": application["map"]["default_center"],
            "defaultZoom": application["map"]["default_zoom"],
            "defaultBasemap": application["map"]["default_basemap"],
            "mapboxAccessToken": application["map"].get("mapbox_access_token", ""),
        },
        "limits": {
            "uploadMaxMb": application["limits"]["upload_max_mb"],
            "queryResultLimit": application["limits"]["query_result_limit"],
        },
        "raster": {
            "symbolizerTimeoutSeconds": application["raster"][
                "symbolizer_timeout_seconds"
            ],
        },
        "editable": has_feature_perm(user, "core.manage_system_settings"),
    }


def _serialize_operation_log(log: OperationLog) -> dict[str, Any]:
    operator = "系统"
    if log.user_id and log.user:
        operator = log.user.get_full_name() or log.user.get_username()
    return {
        "id": log.id,
        "occurredAt": timezone.localtime(log.created_at).strftime("%Y-%m-%d %H:%M:%S"),
        "operator": operator,
        "module": log.module,
        "action": log.action,
        "result": log.status,
        "ipAddress": log.ip_address or "",
        "summary": log.message,
    }


def _filter_operation_logs(queryset, params):
    user_id = params.get("userId")
    operator = str(params.get("operator", "")).strip()
    module = str(params.get("module", "")).strip()
    action = str(params.get("action", "")).strip()
    result = str(params.get("result", "")).strip()
    keyword = str(params.get("keyword", "")).strip()
    start_time = _parse_query_datetime(params.get("startTime"), end_of_day=False)
    end_time = _parse_query_datetime(params.get("endTime"), end_of_day=True)

    if user_id not in (None, ""):
        try:
            queryset = queryset.filter(user_id=int(user_id))
        except (TypeError, ValueError):
            return queryset.none()
    if operator:
        queryset = queryset.filter(
            Q(user__username__icontains=operator)
            | Q(user__first_name__icontains=operator)
            | Q(user__last_name__icontains=operator)
        )
    if module:
        queryset = queryset.filter(module__icontains=module)
    if action:
        queryset = queryset.filter(action__icontains=action)
    if result:
        queryset = queryset.filter(status=result)
    if keyword:
        queryset = queryset.filter(
            Q(user__username__icontains=keyword)
            | Q(user__first_name__icontains=keyword)
            | Q(user__last_name__icontains=keyword)
            | Q(module__icontains=keyword)
            | Q(action__icontains=keyword)
            | Q(message__icontains=keyword)
        )
    if start_time:
        queryset = queryset.filter(created_at__gte=start_time)
    if end_time:
        queryset = queryset.filter(created_at__lte=end_time)
    return queryset


def _parse_query_datetime(value: Any, *, end_of_day: bool):
    if not value:
        return None
    raw_value = str(value)
    parsed = parse_datetime(raw_value)
    if parsed is None:
        parsed_date = parse_date(raw_value)
        if parsed_date is None:
            return None
        time_value = time.max if end_of_day else time.min
        parsed = datetime.combine(parsed_date, time_value)
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def _positive_query_int(value: Any, *, default: int) -> int | JsonResponse:
    if value in (None, ""):
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return JsonResponse({"detail": "分页参数必须是正整数"}, status=400)
    if parsed <= 0:
        return JsonResponse({"detail": "分页参数必须是正整数"}, status=400)
    return parsed


def _create_admin_user(User, payload: dict[str, Any]):
    username = _required_string(payload.get("username"), "username")
    if isinstance(username, JsonResponse):
        return username

    # 自动生成密码
    password = generate_password()

    email = str(payload.get("email", "")).strip()
    display_name = str(payload.get("displayName", "")).strip()
    department = str(payload.get("department", "")).strip()
    is_active = bool(payload.get("isActive", True))
    group_ids = payload.get("groupIds", [])
    if not isinstance(group_ids, list):
        return JsonResponse({"detail": "groupIds 必须是数组"}, status=400)
    try:
        normalized_group_ids = {int(group_id) for group_id in group_ids}
    except (TypeError, ValueError):
        return JsonResponse({"detail": "groupIds 必须是整数数组"}, status=400)
    if not normalized_group_ids:
        return JsonResponse({"detail": "用户组为必选项"}, status=400)

    groups = list(Group.objects.filter(id__in=normalized_group_ids))
    if len(groups) != len(normalized_group_ids):
        return JsonResponse({"detail": "包含不存在的用户组"}, status=400)
    if any(is_superadmin_group(group) for group in groups):
        return JsonResponse(
            {"detail": "不能将普通用户加入超级管理员用户组"}, status=400
        )

    try:
        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=display_name,
                is_active=is_active,
            )
            user.groups.set(groups)
            profile = _ensure_profile(user)
            profile.department = department
            profile.save(update_fields=["department", "updated_at"])
    except IntegrityError:
        return JsonResponse({"detail": "用户名已存在"}, status=400)
    return user, password


def _groups():
    return Group.objects.prefetch_related("permissions", "user_set").order_by("name")


def _ensure_profile(user):
    try:
        return user.profile
    except ObjectDoesNotExist:
        return UserProfile.objects.create(user=user)


def _json_payload(request) -> dict[str, Any] | JsonResponse:
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "请求体不是有效 JSON"}, status=400)
    if not isinstance(payload, dict):
        return JsonResponse({"detail": "请求体必须是 JSON 对象"}, status=400)
    return payload


def _required_string(value: Any, key: str) -> str | JsonResponse:
    if not isinstance(value, str) or not value.strip():
        return JsonResponse({"detail": f"{key} 必须是非空字符串"}, status=400)
    return value.strip()


def _permission_names(value: Any) -> list[str] | JsonResponse:
    if not isinstance(value, list):
        return JsonResponse({"detail": "permissions 必须是数组"}, status=400)
    names = [str(item) for item in value]
    invalid = sorted(set(names) - set(FEATURE_PERMISSION_NAMES))
    if invalid:
        return JsonResponse({"detail": f"权限不存在：{', '.join(invalid)}"}, status=400)
    return names


def _set_group_feature_permissions(group: Group, permission_names: list[str]) -> None:
    permissions = feature_permission_queryset()
    feature_ids = set(permissions.values_list("id", flat=True))
    permissions_by_name = {
        f"{permission.content_type.app_label}.{permission.codename}": permission.id
        for permission in permissions
    }
    selected_ids = {
        permissions_by_name[permission]
        for permission in permission_names
        if permission in permissions_by_name
    }
    non_feature_ids = set(
        group.permissions.exclude(id__in=feature_ids).values_list("id", flat=True)
    )
    group.permissions.set([*non_feature_ids, *selected_ids])


def _map_patch(value: Any) -> dict[str, Any] | JsonResponse:
    if not isinstance(value, dict):
        return JsonResponse({"detail": "map 必须是对象"}, status=400)
    patch: dict[str, Any] = {}
    if "defaultCenter" in value:
        center = value["defaultCenter"]
        if not isinstance(center, list | tuple) or len(center) != 2:
            return JsonResponse(
                {"detail": "defaultCenter 必须是 [经度, 纬度]"}, status=400
            )
        patch["default_center"] = [float(center[0]), float(center[1])]
    if "defaultZoom" in value:
        patch["default_zoom"] = float(value["defaultZoom"])
    if "defaultBasemap" in value:
        default_basemap = _required_string(value["defaultBasemap"], "defaultBasemap")
        if isinstance(default_basemap, JsonResponse):
            return default_basemap
        patch["default_basemap"] = default_basemap
    if "mapboxAccessToken" in value:
        patch["mapbox_access_token"] = str(value["mapboxAccessToken"]).strip()
    return patch


def _limits_patch(value: Any) -> dict[str, Any] | JsonResponse:
    if not isinstance(value, dict):
        return JsonResponse({"detail": "limits 必须是对象"}, status=400)
    patch: dict[str, Any] = {}
    if "uploadMaxMb" in value:
        upload_max_mb = _positive_int(value["uploadMaxMb"], "uploadMaxMb")
        if isinstance(upload_max_mb, JsonResponse):
            return upload_max_mb
        patch["upload_max_mb"] = upload_max_mb
    if "queryResultLimit" in value:
        query_result_limit = _positive_int(
            value["queryResultLimit"],
            "queryResultLimit",
        )
        if isinstance(query_result_limit, JsonResponse):
            return query_result_limit
        patch["query_result_limit"] = query_result_limit
    return patch


def _raster_patch(value: Any) -> dict[str, Any] | JsonResponse:
    if not isinstance(value, dict):
        return JsonResponse({"detail": "raster 必须是对象"}, status=400)
    patch: dict[str, Any] = {}
    if "symbolizerTimeoutSeconds" in value:
        symbolizer_timeout_seconds = _positive_int(
            value["symbolizerTimeoutSeconds"],
            "symbolizerTimeoutSeconds",
        )
        if isinstance(symbolizer_timeout_seconds, JsonResponse):
            return symbolizer_timeout_seconds
        patch["symbolizer_timeout_seconds"] = symbolizer_timeout_seconds
    return patch


def _positive_int(value: Any, key: str) -> int | JsonResponse:
    if not isinstance(value, int) or value <= 0:
        return JsonResponse({"detail": f"{key} 必须是正整数"}, status=400)
    return value
