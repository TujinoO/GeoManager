import json
from datetime import datetime

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST

from apps.catalog.data_query import DataQueryError, get_resource_profile, query_resource
from apps.catalog.export import ExportError, export_layers_zip, validate_epsg
from apps.catalog.models import Achievement, DataCatalog, DataResource, MapLayer
from apps.catalog.permissions import filter_accessible, user_can_access
from apps.catalog.serializers import (
    serialize_achievement,
    serialize_catalog,
    serialize_layer,
    serialize_resource,
)
from apps.core.permissions import feature_denied_response, has_feature_perm
from apps.core.storage import StoragePathError, validate_vector_layer_name, vector_geopackage_path


@require_GET
@login_required
def directories(request):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)
    queryset = DataCatalog.objects.filter(is_active=True).prefetch_related("resources", "resources__category")
    catalogs = filter_accessible(queryset, request.user)
    return JsonResponse({"items": [serialize_catalog(item) for item in catalogs]})


@require_GET
@login_required
def resources(request):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)
    queryset = DataResource.objects.filter(status=DataResource.Status.ACTIVE).select_related("category")
    query = request.GET.get("q", "").strip()
    if query:
        queryset = queryset.filter(name__icontains=query)
    data_type = request.GET.get("dataType", "").strip()
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
    return JsonResponse({"items": [serialize_resource(item) for item in resources_qs]})


@require_GET
@login_required
def resource_profile(request, pk: int):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)
    resource = get_object_or_404(DataResource.objects.select_related("category"), pk=pk, status=DataResource.Status.ACTIVE)
    if not user_can_access(resource, request.user):
        return JsonResponse({"detail": "无权访问该数据资源"}, status=403)
    try:
        profile = get_resource_profile(resource)
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


@require_POST
@login_required
def resource_query(request, pk: int):
    if not has_feature_perm(request.user, "core.query_data") or not has_feature_perm(
        request.user, "core.load_vector_layer"
    ):
        return feature_denied_response(request.user)
    resource = get_object_or_404(DataResource.objects.select_related("category"), pk=pk, status=DataResource.Status.ACTIVE)
    if not user_can_access(resource, request.user):
        return JsonResponse({"detail": "无权访问该数据资源"}, status=403)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"detail": "请求体不是有效 JSON"}, status=400)
    try:
        result = query_resource(resource, payload)
    except DataQueryError as exc:
        return JsonResponse({"detail": str(exc)}, status=400)
    return JsonResponse(result)


@require_POST
@login_required
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
            resource = get_object_or_404(DataResource, pk=resource_id, status=DataResource.Status.ACTIVE)
            if not user_can_access(resource, request.user):
                return JsonResponse({"detail": "无权访问该数据资源"}, status=403)

    try:
        content = export_layers_zip(items, epsg)
    except ExportError as exc:
        return JsonResponse({"detail": str(exc)}, status=400)

    filename = f"layers-export-{datetime.now().strftime('%Y%m%d%H%M%S')}.zip"
    response = HttpResponse(content, content_type="application/zip")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@require_GET
@login_required
def layers(request):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)
    queryset = MapLayer.objects.filter(is_active=True).select_related("category", "data_resource")
    layers_qs = filter_accessible(queryset, request.user)
    return JsonResponse({"items": [serialize_layer(item) for item in layers_qs]})


@require_GET
@login_required
def layer_features(request, pk: int):
    if not has_feature_perm(request.user, "core.load_vector_layer"):
        return feature_denied_response(request.user)
    layer = get_object_or_404(MapLayer, pk=pk, is_active=True)
    if not user_can_access(layer, request.user):
        return JsonResponse({"detail": "无权访问该图层"}, status=403)
    if layer.layer_type != MapLayer.LayerType.VECTOR:
        return JsonResponse({"detail": "该图层不是矢量图层"}, status=400)

    source_path = layer.source_path or (layer.data_resource.storage_path if layer.data_resource else "")
    if not source_path:
        return JsonResponse({"detail": "图层未配置 GeoPackage 图层名"}, status=400)

    try:
        layer_name = validate_vector_layer_name(source_path)
        geopackage_path = vector_geopackage_path()
    except StoragePathError as exc:
        return JsonResponse({"detail": str(exc)}, status=400)

    if not geopackage_path.exists():
        return JsonResponse({"detail": f"统一 GeoPackage 文件不存在：{geopackage_path}"}, status=404)

    try:
        limit = int(request.GET.get("limit", settings.PROJECT_CONFIG.limits.query_result_limit))
    except ValueError:
        limit = settings.PROJECT_CONFIG.limits.query_result_limit
    limit = min(max(limit, 1), settings.PROJECT_CONFIG.limits.query_result_limit)

    try:
        import geopandas as gpd

        gdf = gpd.read_file(geopackage_path, layer=layer_name)
        if gdf.crs and gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(4326)
        if len(gdf) > limit:
            gdf = gdf.head(limit)
        geojson = json.loads(gdf.to_json())
    except Exception as exc:
        return JsonResponse({"detail": f"读取 GeoPackage 图层失败：{layer_name}，{exc}"}, status=500)

    return JsonResponse(geojson)


@require_GET
@login_required
def achievements(request):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)
    queryset = Achievement.objects.filter(status=Achievement.Status.PUBLISHED).select_related("category", "related_layer")
    achievements_qs = filter_accessible(queryset, request.user)
    return JsonResponse({"items": [serialize_achievement(item) for item in achievements_qs]})


@require_GET
@login_required
def search(request):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)
    query = request.GET.get("q", "").strip()
    if not query:
        return JsonResponse({"resources": [], "achievements": []})

    resource_qs = DataResource.objects.filter(status=DataResource.Status.ACTIVE, name__icontains=query).select_related(
        "category"
    )
    achievement_qs = Achievement.objects.filter(
        status=Achievement.Status.PUBLISHED,
        title__icontains=query,
    ).select_related("category")
    return JsonResponse(
        {
            "resources": [serialize_resource(item) for item in filter_accessible(resource_qs, request.user)],
            "achievements": [serialize_achievement(item) for item in filter_accessible(achievement_qs, request.user)],
        }
    )
