import json

from django.contrib.auth.decorators import login_required
from django.http import FileResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST

from apps.catalog.models import MapLayer
from apps.catalog.permissions import user_can_access
from apps.core.storage import raster_cache_path
from apps.raster.models import RasterCacheRecord
from apps.raster.services import RasterRenderError, cleanup_png_cache, render_layer_png


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

