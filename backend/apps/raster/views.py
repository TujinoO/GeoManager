import json
from pathlib import Path

from django.contrib.auth.decorators import login_required
from django.http import FileResponse, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST

from apps.catalog.models import MapLayer
from apps.catalog.permissions import user_can_access
from apps.core.storage import raster_cache_path
from apps.raster.models import RasterCacheRecord, RasterDataset
from apps.raster.services import (
    RasterImportError,
    RasterJobError,
    RasterRenderError,
    cleanup_png_cache,
    get_job,
    import_raster_file,
    register_tile_style,
    render_dataset_png,
    render_layer_png,
    render_xyz_tile,
    serialize_raster_dataset,
    start_import_job,
    start_render_job,
    start_scan_job,
)


@require_POST
@login_required
def render(request):
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"detail": "请求体不是有效 JSON"}, status=400)

    layer = get_object_or_404(MapLayer, pk=payload.get("layerId"), is_active=True)
    if not user_can_access(layer, request.user):
        return JsonResponse({"detail": "无权访问该图层"}, status=403)

    try:
        delivery = str(payload.get("delivery") or "image")
        if delivery == "xyz":
            dataset = RasterDataset.objects.filter(map_layer=layer, status=RasterDataset.Status.READY).first()
            if not dataset:
                return JsonResponse({"detail": "该图层没有已预处理的栅格数据集"}, status=400)
            return JsonResponse(register_tile_style(dataset, payload.get("rules") or layer.raster_rules))
        record = render_layer_png(
            layer=layer,
            width=int(payload.get("width", 1024)),
            height=int(payload.get("height", 768)),
            rules=payload.get("rules") or layer.raster_rules,
        )
    except (ValueError, RasterRenderError) as exc:
        return JsonResponse({"detail": str(exc)}, status=400)

    return JsonResponse(
        {
            "cacheKey": record.cache_key,
            "pngUrl": f"/api/raster/png/{record.cache_key}.png",
            "fileSize": record.file_size,
            "width": record.output_width,
            "height": record.output_height,
            "status": record.status,
        }
    )


@require_POST
@login_required
def render_async(request):
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"detail": "请求体不是有效 JSON"}, status=400)

    layer_id = payload.get("layerId")
    dataset_id = payload.get("datasetId")
    layer = MapLayer.objects.filter(pk=layer_id, is_active=True).first() if layer_id else None
    dataset = RasterDataset.objects.filter(pk=dataset_id).select_related("data_resource", "map_layer").first() if dataset_id else None
    if layer and not user_can_access(layer, request.user):
        return JsonResponse({"detail": "无权访问该图层"}, status=403)
    if dataset and dataset.data_resource and not user_can_access(dataset.data_resource, request.user):
        return JsonResponse({"detail": "无权访问该数据资源"}, status=403)
    if not layer and not dataset:
        return JsonResponse({"detail": "缺少 layerId 或 datasetId"}, status=400)

    try:
        job = start_render_job(
            layer_id=layer.id if layer else None,
            dataset_id=dataset.id if dataset else None,
            width=int(payload.get("width", 1400)),
            height=int(payload.get("height", 900)),
            rules=payload.get("rules") or None,
            delivery=str(payload.get("delivery") or "image"),
        )
    except (ValueError, RasterRenderError) as exc:
        return JsonResponse({"detail": str(exc)}, status=400)
    return JsonResponse(job.as_dict(), status=202)


@require_POST
@login_required
def import_raster(request):
    if not can_manage_raster_data(request.user):
        return JsonResponse({"detail": "无权导入栅格数据"}, status=403)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"detail": "请求体不是有效 JSON"}, status=400)
    source_path = str(payload.get("sourcePath") or "").strip()
    if not source_path:
        return JsonResponse({"detail": "缺少 sourcePath"}, status=400)
    if payload.get("async", True):
        return JsonResponse(start_import_job(source_path, name=str(payload.get("name") or "")).as_dict(), status=202)
    try:
        dataset = import_raster_file(Path(source_path), name=str(payload.get("name") or ""))
    except (RasterImportError, OSError) as exc:
        return JsonResponse({"detail": str(exc)}, status=400)
    return JsonResponse(serialize_raster_dataset(dataset), status=201)


@require_POST
@login_required
def scan_sources(request):
    if not can_manage_raster_data(request.user):
        return JsonResponse({"detail": "无权扫描栅格数据"}, status=403)
    return JsonResponse(start_scan_job().as_dict(), status=202)


@require_GET
@login_required
def datasets(request):
    queryset = RasterDataset.objects.select_related("data_resource", "map_layer").all()
    items = []
    for dataset in queryset:
        if dataset.data_resource and not user_can_access(dataset.data_resource, request.user):
            continue
        items.append(serialize_raster_dataset(dataset))
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
def png(request, cache_key: str):
    cache_key = cache_key.removesuffix(".png")
    record = get_object_or_404(RasterCacheRecord, cache_key=cache_key, status=RasterCacheRecord.Status.READY)
    if record.layer and not user_can_access(record.layer, request.user):
        return JsonResponse({"detail": "无权访问该缓存"}, status=403)
    png_path = raster_cache_path(record.png_relative_path)
    if not png_path.exists():
        return JsonResponse({"detail": "PNG 缓存文件不存在"}, status=404)
    return FileResponse(png_path.open("rb"), content_type="image/png")


@require_GET
@login_required
def tile(request, dataset_id: int, style_hash: str, z: int, x: int, y: int):
    dataset = get_object_or_404(RasterDataset.objects.select_related("data_resource"), pk=dataset_id)
    if dataset.data_resource and not user_can_access(dataset.data_resource, request.user):
        return JsonResponse({"detail": "无权访问该数据资源"}, status=403)
    try:
        content = render_xyz_tile(dataset_id, style_hash, z, x, y)
    except RasterRenderError as exc:
        return JsonResponse({"detail": str(exc)}, status=404)
    return HttpResponse(content, content_type="image/png")


@require_GET
@login_required
def cache_status(request):
    if not (request.user.has_perm("raster.manage_raster_cache") or request.user.is_superuser):
        return JsonResponse({"detail": "无权查看缓存状态"}, status=403)
    records = RasterCacheRecord.objects.all()
    return JsonResponse(
        {
            "count": records.count(),
            "readyCount": records.filter(status=RasterCacheRecord.Status.READY).count(),
            "failedCount": records.filter(status=RasterCacheRecord.Status.FAILED).count(),
            "totalBytes": sum(record.file_size for record in records),
        }
    )


@require_POST
@login_required
def clear_cache(request):
    if not (request.user.has_perm("raster.manage_raster_cache") or request.user.is_superuser):
        return JsonResponse({"detail": "无权清理缓存"}, status=403)
    cleanup_png_cache()
    return JsonResponse({"detail": "缓存清理检查已完成"})


def can_manage_raster_data(user) -> bool:
    return (
        user.has_perm("raster.manage_raster_dataset")
        or user.has_perm("catalog.maintain_dataresource")
        or user.is_superuser
    )
