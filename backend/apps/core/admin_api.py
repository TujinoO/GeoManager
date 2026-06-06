from __future__ import annotations

import io
import json
from datetime import datetime, time
from functools import wraps
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model, update_session_auth_hash
from django.contrib.auth.models import Group
from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from django.views.decorators.http import require_GET, require_http_methods

from apps.audit.models import OperationLog
from apps.audit.service import log_operation
from apps.core.auth_views import serialize_user
from apps.core.config import (
    load_runtime_config_document,
    update_runtime_application_config,
)
from apps.core.initialization import (
    SUPERADMIN_GROUP_NAME,
    ensure_superadmin_defaults,
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


@require_http_methods(["PATCH"])
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


@require_http_methods(["PATCH"])
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


@require_http_methods(["PATCH"])
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
@api_any_permission_required("core.manage_feature_permissions", "core.create_user")
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


@require_http_methods(["PATCH", "DELETE"])
@api_permission_required("core.manage_feature_permissions")
def group_detail(request, group_id: int):
    try:
        group = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        return JsonResponse({"detail": "用户组不存在"}, status=404)

    if request.method == "DELETE":
        if is_superadmin_group(group):
            return JsonResponse({"detail": "超级管理员用户组不能删除"}, status=400)
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
@api_any_permission_required("core.manage_feature_permissions", "core.create_user")
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


@require_http_methods(["PATCH"])
@api_permission_required("core.manage_feature_permissions")
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


@require_http_methods(["GET", "PATCH"])
@api_permission_required("core.access_admin")
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
@api_permission_required("core.access_admin")
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
    is_protected = is_superadmin_group(group)
    return {
        "id": group.id,
        "name": group.name,
        "userCount": group.user_set.count(),
        "permissions": sorted(permissions & set(FEATURE_PERMISSION_NAMES)),
        "isProtected": is_protected,
        "lockedPermissions": sorted(
            superadmin_group_locked_permissions() if is_protected else set()
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
        "editable": has_feature_perm(user, "core.access_admin"),
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
    operator = str(params.get("operator", "")).strip()
    module = str(params.get("module", "")).strip()
    action = str(params.get("action", "")).strip()
    result = str(params.get("result", "")).strip()
    keyword = str(params.get("keyword", "")).strip()
    start_time = _parse_query_datetime(params.get("startTime"), end_of_day=False)
    end_time = _parse_query_datetime(params.get("endTime"), end_of_day=True)

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
