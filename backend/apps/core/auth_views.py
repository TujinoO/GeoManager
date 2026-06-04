import json

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from apps.audit.service import log_operation
from apps.core.permissions import has_feature_perm
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
        log_operation(None, "auth", "login", "failed", f"登录失败：{username}", request)
        return JsonResponse({"detail": "账号或密码错误"}, status=400)

    login(request, user)
    if not remember:
        request.session.set_expiry(0)
    log_operation(user, "auth", "login", "success", "登录成功", request)
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

    User = get_user_model()
    if len(password) < 6:
        return JsonResponse({"detail": "密码至少 6 位"}, status=400)
    user = User(username=username, email=email)
    try:
        with transaction.atomic():
            is_first_user = not User.objects.select_for_update().exists()
            user.is_staff = is_first_user
            user.is_superuser = is_first_user
            user.set_password(password)
            user.save()
    except IntegrityError:
        return JsonResponse({"detail": "账号已存在"}, status=400)

    login(request, user)
    if user.is_superuser:
        message = "首个注册用户已创建为系统管理员"
    else:
        message = "用户注册成功"
    log_operation(user, "auth", "register", "success", message, request)
    return JsonResponse({"user": serialize_user(user), "detail": message})


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
        "canAccessAdmin": has_feature_perm(user, "core.access_admin"),
        "canManageFeaturePermissions": has_feature_perm(
            user, "core.manage_feature_permissions"
        ),
        "canBrowseData": has_feature_perm(user, "core.browse_data"),
        "canQueryData": has_feature_perm(user, "core.query_data"),
        "canLoadVectorLayer": has_feature_perm(user, "core.load_vector_layer"),
        "canLoadRasterLayer": has_feature_perm(user, "core.load_raster_layer"),
        "canUseCustomSymbolization": has_feature_perm(
            user, "core.custom_symbolization"
        ),
        "canExportData": user.has_perm("catalog.export_dataresource")
        or user.is_superuser,
        "canMaintainData": user.has_perm("catalog.maintain_dataresource")
        or user.is_superuser,
        "canManageRasterData": user.has_perm("raster.manage_raster_dataset")
        or user.has_perm("catalog.maintain_dataresource")
        or user.is_superuser,
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
