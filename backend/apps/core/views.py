from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from apps.core.config import BUSINESS_SUBDIRS, GEOGRAPHIC_SUBDIRS


@require_GET
def bootstrap(request):
    config = settings.PROJECT_CONFIG
    return JsonResponse(
        {
            "systemName": config.system_name,
            "allowRegistration": config.allow_registration,
            "map": {
                "defaultCenter": config.map.default_center,
                "defaultZoom": config.map.default_zoom,
                "defaultBasemap": config.map.default_basemap,
                "mapboxAccessToken": config.map.mapbox_access_token,
            },
            "limits": {
                "uploadMaxMb": config.limits.upload_max_mb,
                "queryResultLimit": config.limits.query_result_limit,
            },
        }
    )


@require_GET
def health(request):
    config = settings.PROJECT_CONFIG
    return JsonResponse(
        {
            "status": "ok",
            "mode": config.mode,
            "configLoaded": True,
            "businessSubdirs": list(BUSINESS_SUBDIRS),
            "geographicSubdirs": list(GEOGRAPHIC_SUBDIRS),
        }
    )
