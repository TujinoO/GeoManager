import json
from pathlib import Path

from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST

from apps.catalog.models import MapLayer
from apps.catalog.permissions import user_can_access
from apps.core.permissions import feature_denied_response, has_feature_perm
from apps.raster.models import RasterDataset
from apps.raster.permissions import can_manage_raster_data
from apps.raster.services import (
    RasterImportError,
    RasterJobError,
    RasterRenderError,
    classify_unique_values,
    get_job,
    import_raster_file,
    register_tile_style,
    render_xyz_tile,
    serialize_raster_dataset,
    start_import_job,
    start_render_job,
    start_scan_job,
)


@require_POST
@login_required
def render(request):
    if not has_feature_perm(request.user, "core.load_raster_layer"):
        return feature_denied_response(request.user)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"detail": "请求体不是有效 JSON"}, status=400)

    rules_mode = str(payload.get("rulesMode") or "default")
    if rules_mode == "custom" and not has_feature_perm(
        request.user, "core.custom_symbolization"
    ):
        return feature_denied_response(request.user)
    rules = payload.get("rules") if rules_mode == "custom" else None
    layer = get_object_or_404(MapLayer, pk=payload.get("layerId"), is_active=True)
    if not user_can_access(layer, request.user):
        return JsonResponse({"detail": "无权访问该图层"}, status=403)

    try:
        dataset = RasterDataset.objects.filter(
            map_layer=layer, status=RasterDataset.Status.READY
        ).first()
        if not dataset:
            return JsonResponse(
                {"detail": "该图层没有已预处理的栅格数据集"}, status=400
            )
        return JsonResponse(register_tile_style(dataset, rules or layer.raster_rules))
    except (ValueError, RasterRenderError) as exc:
        return JsonResponse({"detail": str(exc)}, status=400)


@require_POST
@login_required
def render_async(request):
    if not has_feature_perm(request.user, "core.load_raster_layer"):
        return feature_denied_response(request.user)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"detail": "请求体不是有效 JSON"}, status=400)

    rules_mode = str(payload.get("rulesMode") or "default")
    if rules_mode == "custom" and not has_feature_perm(
        request.user, "core.custom_symbolization"
    ):
        return feature_denied_response(request.user)
    rules = payload.get("rules") if rules_mode == "custom" else None
    layer_id = payload.get("layerId")
    dataset_id = payload.get("datasetId")
    layer = (
        MapLayer.objects.filter(pk=layer_id, is_active=True).first()
        if layer_id
        else None
    )
    dataset = (
        RasterDataset.objects.filter(pk=dataset_id)
        .select_related("data_resource", "map_layer")
        .first()
        if dataset_id
        else None
    )
    if layer and not user_can_access(layer, request.user):
        return JsonResponse({"detail": "无权访问该图层"}, status=403)
    if (
        dataset
        and dataset.data_resource
        and not user_can_access(dataset.data_resource, request.user)
    ):
        return JsonResponse({"detail": "无权访问该数据资源"}, status=403)
    if not layer and not dataset:
        return JsonResponse({"detail": "缺少 layerId 或 datasetId"}, status=400)

    try:
        job = start_render_job(
            layer_id=layer.id if layer else None,
            dataset_id=dataset.id if dataset else None,
            rules=rules,
        )
    except (ValueError, RasterRenderError) as exc:
        return JsonResponse({"detail": str(exc)}, status=400)
    return JsonResponse(job.as_dict(), status=202)


@require_POST
@login_required
def unique_values(request):
    if not has_feature_perm(request.user, "core.custom_symbolization"):
        return feature_denied_response(request.user)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"detail": "请求体不是有效 JSON"}, status=400)

    dataset = (
        RasterDataset.objects.filter(pk=payload.get("datasetId"))
        .select_related("data_resource")
        .first()
    )
    if not dataset:
        return JsonResponse({"detail": "栅格数据集不存在"}, status=404)
    if dataset.data_resource and not user_can_access(
        dataset.data_resource, request.user
    ):
        return JsonResponse({"detail": "无权访问该数据资源"}, status=403)

    try:
        return JsonResponse(
            classify_unique_values(dataset, int(payload.get("band", 1)))
        )
    except (ValueError, RasterRenderError) as exc:
        return JsonResponse({"detail": str(exc)}, status=400)


@require_POST
@login_required
def import_raster(request):
    if not can_manage_raster_data(request.user):
        return feature_denied_response(request.user)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"detail": "请求体不是有效 JSON"}, status=400)
    source_path = str(payload.get("sourcePath") or "").strip()
    if not source_path:
        return JsonResponse({"detail": "缺少 sourcePath"}, status=400)
    if payload.get("async", True):
        return JsonResponse(
            start_import_job(
                source_path, name=str(payload.get("name") or "")
            ).as_dict(),
            status=202,
        )
    try:
        dataset = import_raster_file(
            Path(source_path), name=str(payload.get("name") or "")
        )
    except (RasterImportError, OSError) as exc:
        return JsonResponse({"detail": str(exc)}, status=400)
    return JsonResponse(serialize_raster_dataset(dataset), status=201)


@require_POST
@login_required
def scan_sources(request):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)
    return JsonResponse(start_scan_job().as_dict(), status=202)


@require_GET
@login_required
def datasets(request):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)
    queryset = RasterDataset.objects.select_related("data_resource", "map_layer").all()
    items = [
        serialize_raster_dataset(dataset)
        for dataset in queryset
        if not dataset.data_resource
        or user_can_access(dataset.data_resource, request.user)
    ]
    return JsonResponse({"items": items})


@require_GET
@login_required
def job_status(request, job_id: str):
    try:
        return JsonResponse(get_job(job_id).as_dict())
    except RasterJobError as exc:
        return JsonResponse({"detail": str(exc)}, status=404)


@require_GET
@login_required
def tile(request, dataset_id: int, style_hash: str, z: int, x: int, y: int):
    if not has_feature_perm(request.user, "core.load_raster_layer"):
        return feature_denied_response(request.user)
    dataset = get_object_or_404(
        RasterDataset.objects.select_related("data_resource"), pk=dataset_id
    )
    if dataset.data_resource and not user_can_access(
        dataset.data_resource, request.user
    ):
        return JsonResponse({"detail": "无权访问该数据资源"}, status=403)
    try:
        content = render_xyz_tile(dataset_id, style_hash, z, x, y)
    except RasterRenderError as exc:
        return JsonResponse({"detail": str(exc)}, status=404)
    return HttpResponse(content, content_type="image/png")
