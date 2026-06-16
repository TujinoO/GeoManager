import json
from datetime import datetime
from typing import Any

from django.conf import settings
from django.db import IntegrityError
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
from apps.catalog.geojson_validation import validate_geojson_geometries
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
from apps.core.permissions import feature_denied_response, has_feature_perm
from apps.core.storage import (
    StoragePathError,
    validate_vector_layer_name,
    vector_geopackage_path,
)
from apps.raster.services import (
    RasterJobError,
    get_job,
    get_job_artifact_path,
    start_export_job,
)


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
    try:
        vector_layers, nongeographic_resources = scan_catalog_sources()
    except Exception as exc:
        log_operation(
            request.user,
            "数据管理",
            "扫描数据目录",
            "failed",
            f"扫描失败：{exc}",
            request,
        )
        raise
    registered_layers = _registered_vector_layer_names()
    items = [
        serialize_vector_layer(layer)
        for layer in vector_layers
        if layer["name"] not in registered_layers
    ]
    items.extend(serialize_resource(item) for item in nongeographic_resources)
    log_operation(
        request.user,
        "数据管理",
        "扫描数据目录",
        "success",
        f"发现 {len(items)} 项可用数据",
        request,
    )
    return JsonResponse({"items": items, "count": len(items)})


@require_POST
@api_login_required
def import_preview(request):
    if not _can_upload_data(request.user):
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
    if not _can_upload_data(request.user):
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
    if not _can_upload_data(request.user):
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
    log_operation(
        request.user,
        "数据导入",
        "提交导入文件",
        "success",
        f"{result.get('resourceName', uploaded_file.name)}：导入 {result.get('importedRows', 0)} 行",
        request,
    )
    return JsonResponse(result, status=201)


def _can_upload_data(user) -> bool:
    return has_feature_perm(user, "core.upload_data") or has_feature_perm(
        user, "catalog.maintain_dataresource"
    )


@require_http_methods(["GET", "POST"])
@api_login_required
def workspaces(request):
    if request.method == "POST":
        return _create_workspace(request)
    kind = str(request.GET.get("kind", "")).strip()
    if kind and kind not in WorkspaceScene.Kind.values:
        return JsonResponse({"detail": "kind 仅支持 project 或 topic"}, status=400)
    queryset = WorkspaceScene.objects.filter(owner=request.user)
    if kind:
        queryset = queryset.filter(kind=kind)
    return JsonResponse({"items": [_serialize_workspace(item) for item in queryset]})


def _create_workspace(request):
    payload = _json_payload(request)
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
    )
    return JsonResponse(_serialize_workspace(scene), status=201)


@require_http_methods(["GET", "POST"])
@api_login_required
def workspace_detail(request, workspace_id: int):
    scene = _workspace_for_user(request.user, workspace_id)
    if isinstance(scene, JsonResponse):
        return scene
    if request.method == "GET":
        return JsonResponse(_serialize_workspace(scene))
    payload = _json_payload(request)
    if isinstance(payload, JsonResponse):
        return payload
    if payload.get("action") == "delete":
        name = scene.name
        kind_label = _workspace_kind_label(scene.kind)
        scene.delete()
        log_operation(
            request.user,
            "工作台",
            f"删除{kind_label}",
            "success",
            name,
            request,
        )
        return JsonResponse({"detail": f"{kind_label}已删除"})
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
    )
    return JsonResponse(_serialize_workspace(scene))


def _workspace_for_user(user, workspace_id: int) -> WorkspaceScene | JsonResponse:
    try:
        return WorkspaceScene.objects.get(pk=workspace_id, owner=user)
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


def _workspace_kind_label(kind: str) -> str:
    return "专题" if kind == WorkspaceScene.Kind.TOPIC else "工程"


def _json_payload(request) -> dict[str, Any] | JsonResponse:
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "请求体不是有效 JSON"}, status=400)
    if not isinstance(payload, dict):
        return JsonResponse({"detail": "请求体必须是 JSON 对象"}, status=400)
    return payload


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
        )
        return JsonResponse({"detail": str(exc)}, status=400)
    log_operation(
        request.user,
        "数据查询",
        "查询数据资源",
        "success",
        f"{resource.name}：返回 {result.get('returnedCount', 0)} 条",
        request,
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
        layer_name = validate_vector_layer_name(layer_name)
        geopackage_path = vector_geopackage_path()
    except StoragePathError as exc:
        return JsonResponse({"detail": str(exc)}, status=400)

    if not geopackage_path.exists():
        return JsonResponse(
            {"detail": f"统一 GeoPackage 文件不存在：{geopackage_path}"}, status=404
        )

    try:
        limit = int(
            request.GET.get("limit", settings.PROJECT_CONFIG.limits.query_result_limit)
        )
    except ValueError:
        limit = settings.PROJECT_CONFIG.limits.query_result_limit
    limit = min(max(limit, 1), settings.PROJECT_CONFIG.limits.query_result_limit)

    try:
        import geopandas as gpd

        gdf = gpd.read_file(geopackage_path, layer=layer_name)
        if gdf.crs and gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(4326)
        gdf, warnings = validate_geojson_geometries(gdf)
        if len(gdf) > limit:
            gdf = gdf.head(limit)
        geojson = json.loads(gdf.to_json())
        geojson["warnings"] = warnings
    except Exception as exc:
        return JsonResponse(
            {"detail": f"读取 GeoPackage 图层失败：{layer_name}，{exc}"}, status=500
        )

    return JsonResponse(geojson)


@require_GET
@api_login_required
def achievements(request):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)
    queryset = Achievement.objects.filter(
        status=Achievement.Status.PUBLISHED
    ).select_related("category", "related_layer")
    achievements_qs = filter_accessible(queryset, request.user)
    return JsonResponse(
        {"items": [serialize_achievement(item) for item in achievements_qs]}
    )


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

    achievement_qs = Achievement.objects.filter(
        status=Achievement.Status.PUBLISHED,
        title__icontains=query,
    ).select_related("category")
    return JsonResponse(
        {
            "resources": items,
            "achievements": [
                serialize_achievement(item)
                for item in filter_accessible(achievement_qs, request.user)
            ],
        }
    )


def _registered_vector_layer_names() -> set[str]:
    return set(
        DataResource.objects.filter(
            status=DataResource.Status.ACTIVE,
            data_type=DataResource.DataType.VECTOR,
        )
        .exclude(storage_path="")
        .values_list("storage_path", flat=True)
    )
