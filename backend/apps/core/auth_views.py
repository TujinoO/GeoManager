import json

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from apps.audit.service import log_operation


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
        log_operation(None, "auth", "login", "failed", f"登录失败：{username}", request)
        return JsonResponse({"detail": "账号或密码错误"}, status=400)

    login(request, user)
    if not remember:
        request.session.set_expiry(0)
    log_operation(user, "auth", "login", "success", "登录成功", request)
    return JsonResponse({"user": serialize_user(user)})


@require_POST
@login_required
def logout_view(request):
    user = request.user
    logout(request)
    log_operation(user, "auth", "logout", "success", "退出登录", request)
    return JsonResponse({"detail": "已退出"})


@require_GET
def me_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False}, status=401)
    return JsonResponse({"authenticated": True, "user": serialize_user(request.user)})


def serialize_user(user):
    groups = list(user.groups.values_list("name", flat=True))
    permissions = {
        "canAccessAdmin": user.is_staff or user.is_superuser,
        "canExportData": user.has_perm("catalog.export_dataresource") or user.is_superuser,
        "canMaintainData": user.has_perm("catalog.maintain_dataresource") or user.is_superuser,
        "canManageRasterCache": user.has_perm("raster.manage_raster_cache") or user.is_superuser,
    }
    return {
        "id": user.id,
        "username": user.get_username(),
        "displayName": user.get_full_name() or user.get_username(),
        "email": user.email,
        "isStaff": user.is_staff,
        "isSuperuser": user.is_superuser,
        "roles": groups,
        "permissions": permissions,
    }

