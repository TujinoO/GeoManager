import json
from datetime import datetime
from typing import Any

from django.conf import settings
from django.contrib.auth.models import Group
from django.core.exceptions import RequestDataTooBig
from django.db import IntegrityError
from django.db.models import Q
from django.http import FileResponse, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from apps.audit.service import log_operation
from apps.core.api import api_login_required
from apps.catalog.data_query import (
    DataQueryError,
    get_vector_resource_profile,
    query_vector_resource,
)
from apps.catalog.export import ExportError, export_layers_zip, validate_epsg
from apps.catalog.importer import (
    ImportDataError,
    import_uploaded_table,
    preview_uploaded_table,
    validate_uploaded_table,
)
from apps.catalog.models import (
    Achievement,
    DataCatalog,
    DataResource,
    MapLayer,
    WorkspaceScene,
)
from apps.catalog.permissions import filter_accessible, user_can_access
from apps.catalog.serializers import (
    serialize_achievement,
    serialize_catalog,
    serialize_layer,
    serialize_resource,
    serialize_vector_layer,
)
from apps.catalog.services import (
    get_vector_layer_info,
    get_vector_layers_from_geopackage,
    scan_catalog_sources,
)
from apps.catalog.vector_store import layer_features_geojson
from apps.core.permissions import feature_denied_response, has_feature_perm
from apps.raster.services import (
    RasterJobError,
    get_job,
    get_job_artifact_path,
    start_export_job,
)
from apps.core.initialization import (
    GUEST_GROUP_NAME,
    SUPERADMIN_GROUP_NAME,
    ensure_superadmin_defaults,
)

WORKSPACE_SNAPSHOT_MAX_BODY_BYTES = 1024 * 1024


@require_GET
@api_login_required
def directories(request):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)
    queryset = DataCatalog.objects.filter(is_active=True).prefetch_related(
        "resources", "resources__category"
    )
    catalogs = filter_accessible(queryset, request.user)
    return JsonResponse({"items": [serialize_catalog(item) for item in catalogs]})


@require_GET
@api_login_required
def resources(request):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)

    data_type = request.GET.get("dataType", "").strip()
    query = request.GET.get("q", "").strip()

    items = []

    queryset = DataResource.objects.filter(
        status=DataResource.Status.ACTIVE
    ).select_related("category")
    if query:
        queryset = queryset.filter(name__icontains=query)
    if data_type:
        queryset = queryset.filter(data_type=data_type)
    category = request.GET.get("category", "").strip()
    if category:
        queryset = queryset.filter(category__code=category)
    source = request.GET.get("source", "").strip()
    if source:
        queryset = queryset.filter(source__icontains=source)
    provider = request.GET.get("provider", "").strip()
    if provider:
        queryset = queryset.filter(provider__icontains=provider)
    date_from = request.GET.get("dateFrom", "").strip()
    if date_from:
        queryset = queryset.filter(data_date__gte=date_from)
    date_to = request.GET.get("dateTo", "").strip()
    if date_to:
        queryset = queryset.filter(data_date__lte=date_to)
    resources_qs = filter_accessible(queryset, request.user)
    items.extend(serialize_resource(item) for item in resources_qs)

    if not data_type or data_type == DataResource.DataType.VECTOR:
        metadata_filters = [category, provider, date_from, date_to]
        if not any(metadata_filters):
            registered_layers = _registered_vector_layer_names()
            for layer_info in get_vector_layers_from_geopackage():
                layer_name = layer_info["name"]
                if layer_name in registered_layers:
                    continue
                if query and query.lower() not in layer_name.lower():
                    continue
                if source and source.lower() not in "geopackage 实时读取".lower():
                    continue
                items.append(serialize_vector_layer(layer_info))

    return JsonResponse({"items": items})


@require_POST
@api_login_required
def scan_sources(request):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)
    vector_layers, nongeographic_resources = scan_catalog_sources()
    registered_layers = _registered_vector_layer_names()
    items = [
        serialize_vector_layer(layer)
        for layer in vector_layers
        if layer["name"] not in registered_layers
    ]
    items.extend(serialize_resource(item) for item in nongeographic_resources)
    return JsonResponse({"items": items, "count": len(items)})


@require_POST
@api_login_required
def import_preview(request):
    if not _can_create_data_resource(request.user):
        return feature_denied_response(request.user)
    uploaded_file = request.FILES.get("file")
    if uploaded_file is None:
        log_operation(
            request.user,
            "数据导入",
            "预览导入文件",
            "failed",
            "未上传 Excel 或 CSV 文件",
            request,
        )
        return JsonResponse({"detail": "请上传 Excel 或 CSV 文件"}, status=400)
    try:
        result = preview_uploaded_table(uploaded_file)
    except ImportDataError as exc:
        log_operation(
            request.user,
            "数据导入",
            "预览导入文件",
            "failed",
            str(exc),
            request,
        )
        return JsonResponse(_import_error_payload(exc), status=400)
    log_operation(
        request.user,
        "数据导入",
        "预览导入文件",
        "success",
        uploaded_file.name,
        request,
    )
    return JsonResponse(result)


@require_POST
@api_login_required
def import_validate(request):
    if not _can_create_data_resource(request.user):
        return feature_denied_response(request.user)
    uploaded_file = request.FILES.get("file")
    if uploaded_file is None:
        log_operation(
            request.user,
            "数据导入",
            "校验导入文件",
            "failed",
            "未上传 Excel 或 CSV 文件",
            request,
        )
        return JsonResponse({"detail": "请上传 Excel 或 CSV 文件"}, status=400)
    try:
        payload = json.loads(request.POST.get("payload", "{}"))
    except json.JSONDecodeError:
        log_operation(
            request.user,
            "数据导入",
            "校验导入文件",
            "failed",
            "导入参数不是有效 JSON",
            request,
        )
        return JsonResponse({"detail": "导入参数不是有效 JSON"}, status=400)
    try:
        result = validate_uploaded_table(uploaded_file, payload)
    except ImportDataError as exc:
        log_operation(
            request.user,
            "数据导入",
            "校验导入文件",
            "failed",
            str(exc),
            request,
        )
        return JsonResponse(_import_error_payload(exc), status=400)
    log_operation(
        request.user,
        "数据导入",
        "校验导入文件",
        "success",
        uploaded_file.name,
        request,
    )
    return JsonResponse(result)


@require_POST
@api_login_required
def import_commit(request):
    if not _can_create_data_resource(request.user):
        return feature_denied_response(request.user)
    uploaded_file = request.FILES.get("file")
    if uploaded_file is None:
        log_operation(
            request.user,
            "数据导入",
            "提交导入文件",
            "failed",
            "未上传 Excel 或 CSV 文件",
            request,
        )
        return JsonResponse({"detail": "请上传 Excel 或 CSV 文件"}, status=400)
    try:
        payload = json.loads(request.POST.get("payload", "{}"))
    except json.JSONDecodeError:
        log_operation(
            request.user,
            "数据导入",
            "提交导入文件",
            "failed",
            "导入参数不是有效 JSON",
            request,
        )
        return JsonResponse({"detail": "导入参数不是有效 JSON"}, status=400)
    try:
        result = import_uploaded_table(uploaded_file, payload, request.user)
    except ImportDataError as exc:
        log_operation(
            request.user,
            "数据导入",
            "提交导入文件",
            "failed",
            str(exc),
            request,
        )
        return JsonResponse(_import_error_payload(exc), status=400)
    resource = DataResource.objects.filter(pk=result.get("resourceId")).first()
    log_operation(
        request.user,
        "数据导入",
        "提交导入文件",
        "success",
        f"{result.get('resourceName', uploaded_file.name)}：导入 {result.get('importedRows', 0)} 行",
        request,
        target_type="data_resource",
        target_id=resource.id if resource else result.get("resourceId"),
        target_code=resource.code if resource else "",
        target_name=resource.name if resource else result.get("resourceName", ""),
    )
    return JsonResponse(result, status=201)


def _can_create_data_resource(user) -> bool:
    return has_feature_perm(user, "catalog.add_dataresource")


@require_http_methods(["GET", "POST"])
@api_login_required
def workspaces(request):
    if request.method == "POST":
        return _create_workspace(request)
    if not has_feature_perm(request.user, "catalog.view_workspacescene"):
        return feature_denied_response(request.user)
    kind = str(request.GET.get("kind", "")).strip()
    if kind and kind not in WorkspaceScene.Kind.values:
        return JsonResponse({"detail": "kind 仅支持 project 或 topic"}, status=400)
    queryset = WorkspaceScene.objects.filter(owner=request.user)
    queryset = queryset.filter(status=WorkspaceScene.Status.ACTIVE)
    if kind:
        queryset = queryset.filter(kind=kind)
    return JsonResponse({"items": [_serialize_workspace(item) for item in queryset]})


def _create_workspace(request):
    if not has_feature_perm(request.user, "catalog.add_workspacescene"):
        return feature_denied_response(request.user)
    payload = _json_payload(request, max_body_bytes=WORKSPACE_SNAPSHOT_MAX_BODY_BYTES)
    if isinstance(payload, JsonResponse):
        return payload
    values = _workspace_payload(payload, partial=False)
    if isinstance(values, JsonResponse):
        return values
    try:
        scene = WorkspaceScene.objects.create(owner=request.user, **values)
    except IntegrityError:
        return JsonResponse({"detail": "同名工程或专题已存在"}, status=400)
    log_operation(
        request.user,
        "工作台",
        f"保存{_workspace_kind_label(scene.kind)}",
        "success",
        scene.name,
        request,
        target_type="workspace_scene",
        target_id=scene.id,
        target_code=scene.kind,
        target_name=scene.name,
    )
    return JsonResponse(_serialize_workspace(scene), status=201)


@require_http_methods(["GET", "POST"])
@api_login_required
def workspace_detail(request, workspace_id: int):
    scene = _workspace_for_user(request.user, workspace_id)
    if isinstance(scene, JsonResponse):
        return scene
    if request.method == "GET":
        if not has_feature_perm(request.user, "catalog.view_workspacescene"):
            return feature_denied_response(request.user)
        log_operation(
            request.user,
            "工作台",
            f"查看{_workspace_kind_label(scene.kind)}",
            "success",
            scene.name,
            request,
            target_type="workspace_scene",
            target_id=scene.id,
            target_code=scene.kind,
            target_name=scene.name,
        )
        return JsonResponse(_serialize_workspace(scene))
    payload = _json_payload(request, max_body_bytes=WORKSPACE_SNAPSHOT_MAX_BODY_BYTES)
    if isinstance(payload, JsonResponse):
        return payload
    if payload.get("action") == "delete":
        if not has_feature_perm(request.user, "catalog.delete_workspacescene"):
            return feature_denied_response(request.user)
        name = scene.name
        target_id = scene.id
        target_code = scene.kind
        kind_label = _workspace_kind_label(scene.kind)
        scene.delete()
        log_operation(
            request.user,
            "工作台",
            f"删除{kind_label}",
            "success",
            name,
            request,
            target_type="workspace_scene",
            target_id=target_id,
            target_code=target_code,
            target_name=name,
        )
        return JsonResponse({"detail": f"{kind_label}已删除"})
    if not has_feature_perm(request.user, "catalog.change_workspacescene"):
        return feature_denied_response(request.user)
    values = _workspace_payload(payload, partial=True)
    if isinstance(values, JsonResponse):
        return values
    for key, value in values.items():
        setattr(scene, key, value)
    try:
        scene.save()
    except IntegrityError:
        return JsonResponse({"detail": "同名工程或专题已存在"}, status=400)
    log_operation(
        request.user,
        "工作台",
        f"更新{_workspace_kind_label(scene.kind)}",
        "success",
        scene.name,
        request,
        target_type="workspace_scene",
        target_id=scene.id,
        target_code=scene.kind,
        target_name=scene.name,
    )
    return JsonResponse(_serialize_workspace(scene))


def _workspace_for_user(user, workspace_id: int) -> WorkspaceScene | JsonResponse:
    try:
        return WorkspaceScene.objects.get(
            pk=workspace_id, owner=user, status=WorkspaceScene.Status.ACTIVE
        )
    except WorkspaceScene.DoesNotExist:
        return JsonResponse({"detail": "工程或专题不存在"}, status=404)


def _workspace_payload(
    payload: dict, *, partial: bool
) -> dict[str, object] | JsonResponse:
    values: dict[str, object] = {}
    if not partial or "kind" in payload:
        kind = str(payload.get("kind", "")).strip()
        if kind not in WorkspaceScene.Kind.values:
            return JsonResponse({"detail": "kind 仅支持 project 或 topic"}, status=400)
        values["kind"] = kind
    if not partial or "name" in payload:
        name = str(payload.get("name", "")).strip()
        if not name:
            return JsonResponse({"detail": "名称不能为空"}, status=400)
        values["name"] = name
    if "description" in payload:
        values["description"] = str(payload.get("description") or "").strip()
    elif not partial:
        values["description"] = ""
    if not partial or "snapshot" in payload:
        snapshot = payload.get("snapshot")
        if not isinstance(snapshot, dict):
            return JsonResponse({"detail": "snapshot 必须是 JSON 对象"}, status=400)
        if _snapshot_contains_embedded_data(snapshot):
            return JsonResponse(
                {
                    "detail": "工程或专题快照只能保存查询、范围、资源引用和图层结构，不能包含原始数据"
                },
                status=400,
            )
        values["snapshot"] = snapshot
    return values


def _serialize_workspace(scene: WorkspaceScene) -> dict[str, object]:
    return {
        "id": scene.id,
        "kind": scene.kind,
        "name": scene.name,
        "description": scene.description,
        "snapshot": scene.snapshot,
        "owner": {
            "id": scene.owner_id,
            "displayName": scene.owner.get_full_name() or scene.owner.get_username(),
            "username": scene.owner.get_username(),
        },
        "createdAt": scene.created_at.isoformat(),
        "updatedAt": scene.updated_at.isoformat(),
    }


@require_GET
@api_login_required
def admin_workspaces(request):
    if not _can_open_workspace_admin(request.user):
        return feature_denied_response(request.user)
    kind = str(request.GET.get("kind", "")).strip()
    status = str(request.GET.get("status", "")).strip()
    if kind and kind not in WorkspaceScene.Kind.values:
        return JsonResponse({"detail": "kind 仅支持 project 或 topic"}, status=400)
    if status and status not in WorkspaceScene.Status.values:
        return JsonResponse({"detail": "status 仅支持 active 或 inactive"}, status=400)
    query = str(request.GET.get("q", "")).strip()
    queryset = (
        WorkspaceScene.objects.select_related("owner")
        .prefetch_related("access_groups")
        .filter(_workspace_admin_access_filter(request.user))
        .order_by("-updated_at", "name")
        .distinct()
    )
    if query:
        queryset = queryset.filter(
            Q(name__icontains=query)
            | Q(description__icontains=query)
            | Q(owner__username__icontains=query)
            | Q(owner__first_name__icontains=query)
        )
    if kind:
        queryset = queryset.filter(kind=kind)
    if status:
        queryset = queryset.filter(status=status)
    total = queryset.count()
    current = _positive_query_int(request.GET.get("current"), default=1)
    page_size = _positive_query_int(request.GET.get("pageSize"), default=20)
    if isinstance(current, JsonResponse):
        return current
    if isinstance(page_size, JsonResponse):
        return page_size
    start = (current - 1) * page_size
    return JsonResponse(
        {
            "items": [
                _serialize_admin_workspace(scene, request.user)
                for scene in queryset[start : start + page_size]
            ],
            "total": total,
            "availableAccessGroups": _available_access_groups(),
        }
    )


@require_http_methods(["POST"])
@api_login_required
def admin_workspace_detail(request, workspace_id: int):
    payload = _json_payload(request)
    if isinstance(payload, JsonResponse):
        return payload
    scene = (
        WorkspaceScene.objects.select_related("owner")
        .prefetch_related("access_groups")
        .filter(pk=workspace_id)
        .first()
    )
    if scene is None:
        return JsonResponse({"detail": "工程或专题不存在"}, status=404)
    if not _user_can_see_admin_workspace(scene, request.user):
        return JsonResponse({"detail": "工程或专题不存在"}, status=404)

    action = str(payload.get("action", "update")).strip()
    can_change = has_feature_perm(request.user, "catalog.change_workspacescene")
    can_delete = has_feature_perm(request.user, "catalog.delete_workspacescene")
    can_update_access = can_change or scene.owner_id == request.user.id
    if action == "delete":
        if not can_delete:
            return feature_denied_response(request.user)
        return _delete_admin_workspace(request, scene, payload)
    if action not in {"update", "setStatus", "updateAccess"}:
        return JsonResponse({"detail": "不支持的工程专题操作"}, status=400)
    if action == "updateAccess":
        if not can_update_access:
            return feature_denied_response(request.user)
    elif not can_change:
        return feature_denied_response(request.user)

    update_fields = []
    changed_access = False
    if action in {"update", "setStatus"} and "status" in payload:
        status = str(payload.get("status", "")).strip()
        if status not in WorkspaceScene.Status.values:
            return JsonResponse(
                {"detail": "status 仅支持 active 或 inactive"}, status=400
            )
        scene.status = status
        update_fields.append("status")
    if action == "update":
        values = _admin_workspace_payload(payload)
        if isinstance(values, JsonResponse):
            return values
        for key, value in values.items():
            setattr(scene, key, value)
        update_fields.extend(values.keys())
    if action in {"update", "updateAccess"} and "accessGroupIds" in payload:
        group_ids = _group_ids_payload(payload.get("accessGroupIds"))
        if isinstance(group_ids, JsonResponse):
            return group_ids
        _set_access_groups_with_superadmin(scene, group_ids)
        changed_access = True
    if update_fields:
        scene.save(update_fields=sorted(set([*update_fields, "updated_at"])))
    if not update_fields and not changed_access:
        return JsonResponse({"detail": "没有可更新的工程专题字段"}, status=400)
    log_operation(
        request.user,
        "数据管理",
        _admin_workspace_action_label(action, payload),
        "success",
        scene.name,
        request,
        target_type="workspace_scene",
        target_id=scene.id,
        target_code=scene.kind,
        target_name=scene.name,
    )
    scene.refresh_from_db()
    scene = (
        WorkspaceScene.objects.select_related("owner")
        .prefetch_related("access_groups")
        .get(pk=scene.id)
    )
    return JsonResponse(_serialize_admin_workspace(scene, request.user))


def _workspace_kind_label(kind: str) -> str:
    return "专题" if kind == WorkspaceScene.Kind.TOPIC else "工程"


def _admin_workspace_payload(payload: dict[str, Any]) -> dict[str, Any] | JsonResponse:
    values: dict[str, Any] = {}
    if "kind" in payload:
        kind = str(payload.get("kind", "")).strip()
        if kind not in WorkspaceScene.Kind.values:
            return JsonResponse({"detail": "kind 仅支持 project 或 topic"}, status=400)
        values["kind"] = kind
    if "name" in payload:
        name = str(payload.get("name", "")).strip()
        if not name:
            return JsonResponse({"detail": "名称不能为空"}, status=400)
        values["name"] = name
    if "description" in payload:
        values["description"] = str(payload.get("description") or "").strip()
    return values


def _delete_admin_workspace(request, scene: WorkspaceScene, payload: dict[str, Any]):
    confirmation = str(payload.get("confirmationName", "")).strip()
    if confirmation != scene.name:
        return JsonResponse({"detail": "确认名称不匹配"}, status=400)
    name = scene.name
    target_id = scene.id
    target_code = scene.kind
    scene.delete()
    log_operation(
        request.user,
        "数据管理",
        f"删除{_workspace_kind_label(target_code)}",
        "success",
        name,
        request,
        target_type="workspace_scene",
        target_id=target_id,
        target_code=target_code,
        target_name=name,
    )
    return JsonResponse({"detail": f"{_workspace_kind_label(target_code)}已删除"})


def _can_open_workspace_admin(user) -> bool:
    return (
        has_feature_perm(user, "catalog.view_workspacescene")
        or has_feature_perm(user, "catalog.change_workspacescene")
        or has_feature_perm(user, "catalog.delete_workspacescene")
    )


def _workspace_admin_access_filter(user):
    if user.is_superuser or user.groups.filter(name=SUPERADMIN_GROUP_NAME).exists():
        return Q()
    group_ids = set(user.groups.values_list("id", flat=True))
    query = Q(owner=user)
    if group_ids:
        query |= Q(access_groups__in=group_ids)
    return query


def _user_can_see_admin_workspace(scene: WorkspaceScene, user) -> bool:
    if (
        user.is_superuser
        or user.groups.filter(name=SUPERADMIN_GROUP_NAME).exists()
        or scene.owner_id == user.id
    ):
        return True
    access_group_ids = {group.id for group in scene.access_groups.all()}
    return bool(access_group_ids & set(user.groups.values_list("id", flat=True)))


def _serialize_admin_workspace(scene: WorkspaceScene, request_user) -> dict[str, Any]:
    payload = _serialize_workspace(scene)
    payload.update(
        {
            "status": scene.status,
            "accessGroups": [
                _serialize_access_group(group) for group in scene.access_groups.all()
            ],
            "canManageAccess": bool(
                has_feature_perm(request_user, "catalog.change_workspacescene")
                or scene.owner_id == getattr(request_user, "id", None)
            ),
        }
    )
    return payload


def _available_access_groups() -> list[dict[str, Any]]:
    return [_serialize_access_group(group) for group in Group.objects.order_by("name")]


def _serialize_access_group(group: Group) -> dict[str, Any]:
    return {
        "id": group.id,
        "name": group.name,
        "isGuest": group.name == GUEST_GROUP_NAME,
        "isSuperadmin": group.name == SUPERADMIN_GROUP_NAME,
    }


def _set_access_groups_with_superadmin(obj, group_ids: list[int]) -> None:
    _, superadmin_group = ensure_superadmin_defaults(create_account=False)
    obj.access_groups.set(sorted({*group_ids, superadmin_group.id}))


def _admin_workspace_action_label(action: str, payload: dict[str, Any]) -> str:
    if action == "setStatus":
        return "切换工程专题状态"
    if action == "updateAccess":
        return "更新工程专题可见范围"
    if "accessGroupIds" in payload:
        return "更新工程专题信息和可见范围"
    return "更新工程专题信息"


def _json_payload(
    request, *, max_body_bytes: int | None = None
) -> dict[str, Any] | JsonResponse:
    if max_body_bytes is not None:
        content_length = int(request.META.get("CONTENT_LENGTH") or 0)
        if content_length > max_body_bytes:
            return JsonResponse({"detail": "请求体过大"}, status=413)
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except RequestDataTooBig:
        return JsonResponse({"detail": "请求体过大"}, status=413)
    except json.JSONDecodeError:
        return JsonResponse({"detail": "请求体不是有效 JSON"}, status=400)
    if not isinstance(payload, dict):
        return JsonResponse({"detail": "请求体必须是 JSON 对象"}, status=400)
    return payload


def _snapshot_contains_embedded_data(value: object) -> bool:
    if isinstance(value, dict):
        if "geojson" in value:
            return True
        if value.get("type") == "FeatureCollection" and isinstance(
            value.get("features"), list
        ):
            return True
        return any(_snapshot_contains_embedded_data(item) for item in value.values())
    if isinstance(value, list):
        return any(_snapshot_contains_embedded_data(item) for item in value)
    return False


def _import_error_payload(exc: ImportDataError) -> dict:
    detail = str(exc.args[0]) if exc.args else str(exc)
    payload = {"detail": detail}
    if len(exc.args) > 1 and isinstance(exc.args[1], list):
        payload["issues"] = exc.args[1]
    return payload


@require_GET
@api_login_required
def resource_profile(request, pk: int):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)
    resource = get_object_or_404(
        DataResource.objects.select_related("category"),
        pk=pk,
        status=DataResource.Status.ACTIVE,
    )
    if not user_can_access(resource, request.user):
        return JsonResponse({"detail": "无权访问该数据资源"}, status=403)
    try:
        profile = get_vector_resource_profile(resource)
    except DataQueryError as exc:
        return JsonResponse({"detail": str(exc)}, status=400)
    log_operation(
        request.user,
        "数据查询",
        "查看数据资源",
        "success",
        resource.name,
        request,
        target_type="data_resource",
        target_id=resource.id,
        target_code=resource.code,
        target_name=resource.name,
    )
    return JsonResponse(
        {
            "resource": serialize_resource(resource),
            "fields": profile.fields,
            "featureCount": profile.feature_count,
            "geometryType": profile.geometry_type,
            "bounds": profile.bounds,
            "raster": profile.raster,
        }
    )


@require_GET
@api_login_required
def vector_layer_profile(request, layer_name: str):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)

    layer_info = get_vector_layer_info(layer_name)
    if not layer_info:
        return JsonResponse({"detail": f"矢量图层不存在：{layer_name}"}, status=404)

    try:
        profile = get_vector_resource_profile(layer_name=layer_name)
    except DataQueryError as exc:
        return JsonResponse({"detail": str(exc)}, status=400)

    return JsonResponse(
        {
            "resource": serialize_vector_layer(layer_info),
            "fields": profile.fields,
            "featureCount": profile.feature_count,
            "geometryType": profile.geometry_type,
            "bounds": profile.bounds,
        }
    )


@require_POST
@api_login_required
def resource_query(request, pk: int):
    can_query = has_feature_perm(request.user, "core.query_data")
    can_load_vector = has_feature_perm(request.user, "core.load_vector_layer")
    if not can_query or not can_load_vector:
        return feature_denied_response(request.user)
    resource = get_object_or_404(
        DataResource.objects.select_related("category"),
        pk=pk,
        status=DataResource.Status.ACTIVE,
    )
    if not user_can_access(resource, request.user):
        return JsonResponse({"detail": "无权访问该数据资源"}, status=403)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"detail": "请求体不是有效 JSON"}, status=400)
    try:
        result = query_vector_resource(resource, payload)
    except DataQueryError as exc:
        log_operation(
            request.user,
            "数据查询",
            "查询数据资源",
            "failed",
            f"{resource.name}：{exc}",
            request,
            target_type="data_resource",
            target_id=resource.id,
            target_code=resource.code,
            target_name=resource.name,
        )
        return JsonResponse({"detail": str(exc)}, status=400)
    log_operation(
        request.user,
        "数据查询",
        "查询数据资源",
        "success",
        f"{resource.name}：返回 {result.get('returnedCount', 0)} 条",
        request,
        target_type="data_resource",
        target_id=resource.id,
        target_code=resource.code,
        target_name=resource.name,
    )
    return JsonResponse(result)


@require_POST
@api_login_required
def vector_layer_query(request, layer_name: str):
    can_query = has_feature_perm(request.user, "core.query_data")
    can_load_vector = has_feature_perm(request.user, "core.load_vector_layer")
    if not can_query or not can_load_vector:
        return feature_denied_response(request.user)

    layer_info = get_vector_layer_info(layer_name)
    if not layer_info:
        return JsonResponse({"detail": f"矢量图层不存在：{layer_name}"}, status=404)

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"detail": "请求体不是有效 JSON"}, status=400)
    try:
        result = query_vector_resource(layer_name=layer_name, payload=payload)
    except DataQueryError as exc:
        log_operation(
            request.user,
            "数据查询",
            "查询矢量图层",
            "failed",
            f"{layer_name}：{exc}",
            request,
        )
        return JsonResponse({"detail": str(exc)}, status=400)
    log_operation(
        request.user,
        "数据查询",
        "查询矢量图层",
        "success",
        f"{layer_name}：返回 {result.get('returnedCount', 0)} 条",
        request,
    )
    return JsonResponse(result)


@require_POST
@api_login_required
def export_loaded_layers(request):
    if not has_feature_perm(request.user, "catalog.export_dataresource"):
        return feature_denied_response(request.user)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"detail": "请求体不是有效 JSON"}, status=400)
    try:
        epsg = validate_epsg(payload.get("epsg", 4326))
    except Exception as exc:
        return JsonResponse({"detail": str(exc)}, status=400)

    items = payload.get("items") or []
    if not isinstance(items, list):
        return JsonResponse({"detail": "items 必须是数组"}, status=400)

    for item in items:
        resource_id = item.get("resourceId")
        if resource_id:
            resource = get_object_or_404(
                DataResource, pk=resource_id, status=DataResource.Status.ACTIVE
            )
            if not user_can_access(resource, request.user):
                return JsonResponse({"detail": "无权访问该数据资源"}, status=403)

    try:
        content = export_layers_zip(
            items,
            epsg,
            reproject=bool(payload.get("reproject", True)),
            clip_geometry=payload.get("clipGeometry") if payload.get("clip") else None,
        )
    except ExportError as exc:
        log_operation(
            request.user,
            "数据导出",
            "导出已加载图层",
            "failed",
            str(exc),
            request,
        )
        return JsonResponse({"detail": str(exc)}, status=400)

    filename = f"layers-export-{datetime.now().strftime('%Y%m%d%H%M%S')}.zip"
    response = HttpResponse(content, content_type="application/zip")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    log_operation(
        request.user,
        "数据导出",
        "导出已加载图层",
        "success",
        f"{filename}：{len(items)} 个图层",
        request,
    )
    return response


@require_POST
@api_login_required
def export_loaded_layers_async(request):
    if not has_feature_perm(request.user, "catalog.export_dataresource"):
        return feature_denied_response(request.user)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"detail": "请求体不是有效 JSON"}, status=400)

    reproject = bool(payload.get("reproject", True))
    epsg = None
    if reproject:
        try:
            epsg = validate_epsg(payload.get("epsg", 4326))
        except Exception as exc:
            return JsonResponse({"detail": str(exc)}, status=400)

    items = payload.get("items") or []
    if not isinstance(items, list):
        return JsonResponse({"detail": "items 必须是数组"}, status=400)

    for item in items:
        resource_id = item.get("resourceId")
        if resource_id:
            resource = get_object_or_404(
                DataResource, pk=resource_id, status=DataResource.Status.ACTIVE
            )
            if not user_can_access(resource, request.user):
                return JsonResponse({"detail": "无权访问该数据资源"}, status=403)

    clip_geometry = payload.get("clipGeometry") if payload.get("clip") else None
    try:
        job = start_export_job(
            items=items, epsg=epsg, reproject=reproject, clip_geometry=clip_geometry
        )
    except ExportError as exc:
        log_operation(
            request.user,
            "数据导出",
            "发起异步导出",
            "failed",
            str(exc),
            request,
        )
        return JsonResponse({"detail": str(exc)}, status=400)
    log_operation(
        request.user,
        "数据导出",
        "发起异步导出",
        "success",
        f"任务 {job.id}：{len(items)} 个图层",
        request,
    )
    return JsonResponse(job.as_dict(), status=202)


@require_GET
@api_login_required
def export_job_download(request, job_id: str):
    if not has_feature_perm(request.user, "catalog.export_dataresource"):
        return feature_denied_response(request.user)
    try:
        job = get_job(job_id)
        path = get_job_artifact_path(job_id)
    except RasterJobError as exc:
        return JsonResponse({"detail": str(exc)}, status=404)
    if job.status != "ready":
        return JsonResponse({"detail": "导出任务尚未完成"}, status=409)
    if not path.exists():
        return JsonResponse({"detail": "导出文件不存在或已过期"}, status=404)
    filename = (job.result or {}).get(
        "filename"
    ) or f"layers-export-{datetime.now().strftime('%Y%m%d%H%M%S')}.zip"
    log_operation(
        request.user,
        "数据导出",
        "下载异步导出文件",
        "success",
        filename,
        request,
    )
    return FileResponse(
        path.open("rb"),
        as_attachment=True,
        filename=filename,
        content_type="application/zip",
    )


@require_GET
@api_login_required
def layers(request):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)

    items = []

    registered_layers = _registered_vector_layer_names()
    vector_layers = get_vector_layers_from_geopackage()
    for layer_info in vector_layers:
        if layer_info["name"] in registered_layers:
            continue
        items.append(serialize_vector_layer(layer_info))

    queryset = MapLayer.objects.filter(
        is_active=True, layer_type=MapLayer.LayerType.RASTER
    ).select_related("category", "data_resource")
    layers_qs = filter_accessible(queryset, request.user)
    items.extend(serialize_layer(item) for item in layers_qs)

    return JsonResponse({"items": items})


@require_GET
@api_login_required
def layer_features(request, layer_name: str):
    if not has_feature_perm(request.user, "core.load_vector_layer"):
        return feature_denied_response(request.user)

    layer_info = get_vector_layer_info(layer_name)
    if not layer_info:
        return JsonResponse({"detail": f"矢量图层不存在：{layer_name}"}, status=404)

    try:
        limit = int(
            request.GET.get("limit", settings.PROJECT_CONFIG.limits.query_result_limit)
        )
    except ValueError:
        limit = settings.PROJECT_CONFIG.limits.query_result_limit
    limit = min(max(limit, 1), settings.PROJECT_CONFIG.limits.query_result_limit)

    try:
        geojson = layer_features_geojson(layer_name, limit)
    except DataQueryError as exc:
        return JsonResponse({"detail": str(exc)}, status=500)

    return JsonResponse(geojson)


@require_http_methods(["GET", "POST"])
@api_login_required
def achievements(request):
    if request.method == "POST":
        return create_achievement(request)
    if not has_feature_perm(request.user, "catalog.view_achievement"):
        return feature_denied_response(request.user)
    queryset = Achievement.objects.select_related("category", "related_layer")
    if not _can_manage_achievements(request.user):
        queryset = queryset.filter(status=Achievement.Status.PUBLISHED)
    status = str(request.GET.get("status", "")).strip()
    if status:
        if not _can_manage_achievements(request.user):
            return feature_denied_response(request.user)
        if status not in Achievement.Status.values:
            return JsonResponse(
                {"detail": "status 仅支持 draft、published 或 archived"}, status=400
            )
        queryset = queryset.filter(status=status)
    achievements_qs = filter_accessible(queryset, request.user)
    return JsonResponse(
        {"items": [serialize_achievement(item) for item in achievements_qs]}
    )


@require_http_methods(["GET", "POST"])
@api_login_required
def achievement_detail(request, achievement_id: int):
    achievement = get_object_or_404(
        Achievement.objects.select_related(
            "category", "related_layer"
        ).prefetch_related("access_groups"),
        pk=achievement_id,
    )
    if not user_can_access(achievement, request.user):
        return JsonResponse({"detail": "无权访问该成果"}, status=403)
    if request.method == "GET":
        if not has_feature_perm(request.user, "catalog.view_achievement"):
            return feature_denied_response(request.user)
        if (
            achievement.status != Achievement.Status.PUBLISHED
            and not _can_manage_achievements(request.user)
        ):
            return JsonResponse({"detail": "成果不存在"}, status=404)
        log_operation(
            request.user,
            "成果管理",
            "查看成果",
            "success",
            achievement.title,
            request,
            target_type="achievement",
            target_id=achievement.id,
            target_code=achievement.code,
            target_name=achievement.title,
        )
        return JsonResponse(serialize_achievement(achievement))

    payload = _json_payload(request)
    if isinstance(payload, JsonResponse):
        return payload
    if payload.get("action") == "delete":
        if not has_feature_perm(request.user, "catalog.delete_achievement"):
            return feature_denied_response(request.user)
        title = achievement.title
        target_id = achievement.id
        target_code = achievement.code
        achievement.delete()
        log_operation(
            request.user,
            "成果管理",
            "删除成果",
            "success",
            title,
            request,
            target_type="achievement",
            target_id=target_id,
            target_code=target_code,
            target_name=title,
        )
        return JsonResponse({"detail": "成果已删除"})

    if not has_feature_perm(request.user, "catalog.change_achievement"):
        return feature_denied_response(request.user)
    values = _achievement_payload(payload, partial=True, user=request.user)
    if isinstance(values, JsonResponse):
        return values
    for key, value in values.items():
        if key == "access_group_ids":
            continue
        setattr(achievement, key, value)
    try:
        achievement.save()
        if "access_group_ids" in values:
            achievement.access_groups.set(values["access_group_ids"])
    except IntegrityError:
        return JsonResponse({"detail": "成果编码已存在"}, status=400)
    log_operation(
        request.user,
        "成果管理",
        "更新成果",
        "success",
        achievement.title,
        request,
        target_type="achievement",
        target_id=achievement.id,
        target_code=achievement.code,
        target_name=achievement.title,
    )
    achievement.refresh_from_db()
    return JsonResponse(serialize_achievement(achievement))


@require_POST
@api_login_required
def create_achievement(request):
    if not has_feature_perm(request.user, "catalog.add_achievement"):
        return feature_denied_response(request.user)
    payload = _json_payload(request)
    if isinstance(payload, JsonResponse):
        return payload
    values = _achievement_payload(payload, partial=False, user=request.user)
    if isinstance(values, JsonResponse):
        return values
    access_group_ids = values.pop("access_group_ids", None)
    try:
        achievement = Achievement.objects.create(**values)
        if access_group_ids is not None:
            achievement.access_groups.set(access_group_ids)
    except IntegrityError:
        return JsonResponse({"detail": "成果编码已存在"}, status=400)
    log_operation(
        request.user,
        "成果管理",
        "新增成果",
        "success",
        achievement.title,
        request,
        target_type="achievement",
        target_id=achievement.id,
        target_code=achievement.code,
        target_name=achievement.title,
    )
    return JsonResponse(serialize_achievement(achievement), status=201)


@require_GET
@api_login_required
def admin_achievements(request):
    if not _can_open_achievement_admin(request.user):
        return feature_denied_response(request.user)
    queryset = (
        Achievement.objects.select_related("category", "related_layer")
        .prefetch_related("access_groups")
        .order_by("-updated_at", "display_order", "title")
    )
    query = str(request.GET.get("q", "")).strip()
    if query:
        queryset = queryset.filter(
            Q(title__icontains=query)
            | Q(code__icontains=query)
            | Q(summary__icontains=query)
            | Q(source__icontains=query)
        )
    status = str(request.GET.get("status", "")).strip()
    if status:
        if status not in Achievement.Status.values:
            return JsonResponse(
                {"detail": "status 仅支持 draft、published 或 archived"}, status=400
            )
        queryset = queryset.filter(status=status)
    category = str(request.GET.get("category", "")).strip()
    if category:
        queryset = queryset.filter(category__code=category)
    source = str(request.GET.get("source", "")).strip()
    if source:
        queryset = queryset.filter(source__icontains=source)
    if not (
        has_feature_perm(request.user, "catalog.change_achievement")
        or has_feature_perm(request.user, "catalog.delete_achievement")
    ):
        queryset = filter_accessible(queryset, request.user)
    total = queryset.count()
    current = _positive_query_int(request.GET.get("current"), default=1)
    page_size = _positive_query_int(request.GET.get("pageSize"), default=20)
    if isinstance(current, JsonResponse):
        return current
    if isinstance(page_size, JsonResponse):
        return page_size
    start = (current - 1) * page_size
    return JsonResponse(
        {
            "items": [
                _serialize_admin_achievement(item, request.user)
                for item in queryset[start : start + page_size]
            ],
            "total": total,
            "availableAccessGroups": _available_access_groups(),
        }
    )


@require_http_methods(["POST"])
@api_login_required
def admin_achievement_detail(request, achievement_id: int):
    payload = _json_payload(request)
    if isinstance(payload, JsonResponse):
        return payload
    achievement = (
        Achievement.objects.select_related("category", "related_layer")
        .prefetch_related("access_groups")
        .filter(pk=achievement_id)
        .first()
    )
    if achievement is None:
        return JsonResponse({"detail": "成果不存在"}, status=404)
    can_change = has_feature_perm(request.user, "catalog.change_achievement")
    can_delete = has_feature_perm(request.user, "catalog.delete_achievement")
    if not (can_change or can_delete or user_can_access(achievement, request.user)):
        return JsonResponse({"detail": "无权访问该成果"}, status=403)

    action = str(payload.get("action", "update")).strip()
    if action == "delete":
        if not can_delete:
            return feature_denied_response(request.user)
        return _delete_admin_achievement(request, achievement, payload)
    if action not in {"update", "setStatus", "updateAccess"}:
        return JsonResponse({"detail": "不支持的成果操作"}, status=400)
    if not can_change:
        return feature_denied_response(request.user)

    update_fields = []
    changed_access = False
    if action in {"update", "setStatus"} and "status" in payload:
        status = str(payload.get("status", "")).strip()
        if status not in Achievement.Status.values:
            return JsonResponse(
                {"detail": "status 仅支持 draft、published 或 archived"}, status=400
            )
        achievement.status = status
        update_fields.append("status")
    if action == "update":
        values = _admin_achievement_payload(payload, request.user)
        if isinstance(values, JsonResponse):
            return values
        for key, value in values.items():
            setattr(achievement, key, value)
        update_fields.extend(values.keys())
    if action in {"update", "updateAccess"} and "accessGroupIds" in payload:
        group_ids = _group_ids_payload(payload.get("accessGroupIds"))
        if isinstance(group_ids, JsonResponse):
            return group_ids
        _set_access_groups_with_superadmin(achievement, group_ids)
        changed_access = True
    if update_fields:
        achievement.save(update_fields=sorted(set([*update_fields, "updated_at"])))
    if not update_fields and not changed_access:
        return JsonResponse({"detail": "没有可更新的成果字段"}, status=400)
    log_operation(
        request.user,
        "数据管理",
        _admin_achievement_action_label(action, payload),
        "success",
        achievement.title,
        request,
        target_type="achievement",
        target_id=achievement.id,
        target_code=achievement.code,
        target_name=achievement.title,
    )
    achievement.refresh_from_db()
    achievement = (
        Achievement.objects.select_related("category", "related_layer")
        .prefetch_related("access_groups")
        .get(pk=achievement.id)
    )
    return JsonResponse(_serialize_admin_achievement(achievement, request.user))


@require_GET
@api_login_required
def search(request):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)
    query = request.GET.get("q", "").strip()
    if not query:
        return JsonResponse({"resources": [], "achievements": []})

    items = []
    registered_layers = _registered_vector_layer_names()
    vector_layers = get_vector_layers_from_geopackage()
    for layer_info in vector_layers:
        if layer_info["name"] in registered_layers:
            continue
        if query.lower() in layer_info["name"].lower():
            items.append(serialize_vector_layer(layer_info))

    resource_qs = DataResource.objects.filter(
        status=DataResource.Status.ACTIVE, name__icontains=query
    ).select_related("category")
    items.extend(
        serialize_resource(item)
        for item in filter_accessible(resource_qs, request.user)
    )

    if has_feature_perm(request.user, "catalog.view_achievement"):
        achievement_qs = Achievement.objects.filter(
            status=Achievement.Status.PUBLISHED,
            title__icontains=query,
        ).select_related("category")
        achievements = [
            serialize_achievement(item)
            for item in filter_accessible(achievement_qs, request.user)
        ]
    else:
        achievements = []
    return JsonResponse(
        {
            "resources": items,
            "achievements": achievements,
        }
    )


def _can_manage_achievements(user) -> bool:
    return (
        has_feature_perm(user, "catalog.add_achievement")
        or has_feature_perm(user, "catalog.change_achievement")
        or has_feature_perm(user, "catalog.delete_achievement")
    )


def _achievement_payload(
    payload: dict[str, Any], *, partial: bool, user
) -> dict[str, Any] | JsonResponse:
    values: dict[str, Any] = {}
    if not partial or "title" in payload:
        title = str(payload.get("title", "")).strip()
        if not title:
            return JsonResponse({"detail": "成果标题不能为空"}, status=400)
        values["title"] = title
    if not partial or "code" in payload:
        code = str(payload.get("code", "")).strip()
        if not code:
            return JsonResponse({"detail": "成果编码不能为空"}, status=400)
        values["code"] = code
    if "summary" in payload:
        values["summary"] = str(payload.get("summary") or "").strip()
    elif not partial:
        values["summary"] = ""
    if "source" in payload:
        values["source"] = str(payload.get("source") or "").strip()
    elif not partial:
        values["source"] = ""
    if "imagePath" in payload:
        values["image_path"] = str(payload.get("imagePath") or "").strip()
    elif not partial:
        values["image_path"] = ""
    if "attachmentPath" in payload:
        values["attachment_path"] = str(payload.get("attachmentPath") or "").strip()
    elif not partial:
        values["attachment_path"] = ""
    if "displayOrder" in payload:
        try:
            values["display_order"] = int(payload.get("displayOrder"))
        except (TypeError, ValueError):
            return JsonResponse({"detail": "displayOrder 必须是整数"}, status=400)
    elif not partial:
        values["display_order"] = 100
    if "status" in payload:
        status = str(payload.get("status", "")).strip()
        if status not in Achievement.Status.values:
            return JsonResponse(
                {"detail": "status 仅支持 draft、published 或 archived"}, status=400
            )
        values["status"] = status
    elif not partial:
        values["status"] = Achievement.Status.DRAFT
    if "categoryId" in payload:
        category_id = payload.get("categoryId")
        if category_id in (None, ""):
            values["category"] = None
        else:
            category = DictionaryItem.objects.filter(
                pk=category_id,
                dict_type=DictionaryItem.DictType.ACHIEVEMENT_CATEGORY,
                is_active=True,
            ).first()
            if not category:
                return JsonResponse({"detail": "成果分类不存在"}, status=400)
            values["category"] = category
    elif not partial:
        values["category"] = None
    if "relatedLayerId" in payload:
        layer_id = payload.get("relatedLayerId")
        if layer_id in (None, ""):
            values["related_layer"] = None
        else:
            layer = MapLayer.objects.filter(pk=layer_id, is_active=True).first()
            if not layer:
                return JsonResponse({"detail": "关联图层不存在"}, status=400)
            if not user_can_access(layer, user):
                return JsonResponse({"detail": "无权访问关联图层"}, status=403)
            values["related_layer"] = layer
    elif not partial:
        values["related_layer"] = None
    if "accessGroupIds" in payload:
        group_ids = _group_ids_payload(payload.get("accessGroupIds"))
        if isinstance(group_ids, JsonResponse):
            return group_ids
        values["access_group_ids"] = group_ids
    return values


def _can_open_achievement_admin(user) -> bool:
    return (
        has_feature_perm(user, "catalog.view_achievement")
        or has_feature_perm(user, "catalog.change_achievement")
        or has_feature_perm(user, "catalog.delete_achievement")
    )


def _admin_achievement_payload(
    payload: dict[str, Any], user
) -> dict[str, Any] | JsonResponse:
    values: dict[str, Any] = {}
    if "title" in payload:
        title = str(payload.get("title", "")).strip()
        if not title:
            return JsonResponse({"detail": "成果标题不能为空"}, status=400)
        values["title"] = title
    if "summary" in payload:
        values["summary"] = str(payload.get("summary") or "").strip()
    if "source" in payload:
        values["source"] = str(payload.get("source") or "").strip()
    if "displayOrder" in payload:
        try:
            values["display_order"] = int(payload.get("displayOrder"))
        except (TypeError, ValueError):
            return JsonResponse({"detail": "displayOrder 必须是整数"}, status=400)
    if "relatedLayerId" in payload:
        layer_id = payload.get("relatedLayerId")
        if layer_id in (None, ""):
            values["related_layer"] = None
        else:
            layer = MapLayer.objects.filter(pk=layer_id, is_active=True).first()
            if not layer:
                return JsonResponse({"detail": "关联图层不存在"}, status=400)
            if not user_can_access(layer, user):
                return JsonResponse({"detail": "无权访问关联图层"}, status=403)
            values["related_layer"] = layer
    return values


def _delete_admin_achievement(
    request, achievement: Achievement, payload: dict[str, Any]
):
    confirmation = str(payload.get("confirmationName", "")).strip()
    if confirmation != achievement.title:
        return JsonResponse({"detail": "确认名称不匹配"}, status=400)
    title = achievement.title
    target_id = achievement.id
    target_code = achievement.code
    achievement.delete()
    log_operation(
        request.user,
        "数据管理",
        "删除成果",
        "success",
        title,
        request,
        target_type="achievement",
        target_id=target_id,
        target_code=target_code,
        target_name=title,
    )
    return JsonResponse({"detail": "成果已删除"})


def _serialize_admin_achievement(
    achievement: Achievement, request_user
) -> dict[str, Any]:
    payload = serialize_achievement(achievement)
    payload.update(
        {
            "accessGroups": [
                _serialize_access_group(group)
                for group in achievement.access_groups.all()
            ],
            "canManageAccess": bool(
                has_feature_perm(request_user, "catalog.change_achievement")
            ),
            "owner": {"id": None, "username": "", "displayName": "未记录"},
            "createdAt": achievement.created_at.isoformat(),
        }
    )
    return payload


def _admin_achievement_action_label(action: str, payload: dict[str, Any]) -> str:
    if action == "setStatus":
        return "切换成果状态"
    if action == "updateAccess":
        return "更新成果可见范围"
    if "accessGroupIds" in payload:
        return "更新成果信息和可见范围"
    return "更新成果信息"


def _group_ids_payload(value: Any) -> list[int] | JsonResponse:
    if not isinstance(value, list):
        return JsonResponse({"detail": "accessGroupIds 必须是数组"}, status=400)
    try:
        group_ids = sorted({int(group_id) for group_id in value})
    except (TypeError, ValueError):
        return JsonResponse({"detail": "accessGroupIds 必须是整数数组"}, status=400)
    if Group.objects.filter(id__in=group_ids).count() != len(group_ids):
        return JsonResponse({"detail": "包含不存在的访问用户组"}, status=400)
    return group_ids


def _positive_query_int(value: Any, *, default: int) -> int | JsonResponse:
    try:
        parsed = int(value) if value not in (None, "") else default
    except (TypeError, ValueError):
        return JsonResponse({"detail": "分页参数必须是正整数"}, status=400)
    if parsed < 1:
        return JsonResponse({"detail": "分页参数必须是正整数"}, status=400)
    return parsed


def _registered_vector_layer_names() -> set[str]:
    return set(
        DataResource.objects.filter(
            status=DataResource.Status.ACTIVE,
            data_type=DataResource.DataType.VECTOR,
        )
        .exclude(storage_path="")
        .values_list("storage_path", flat=True)
    )
