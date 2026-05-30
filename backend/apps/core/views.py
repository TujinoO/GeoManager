import os

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from apps.core.config import APP_SUBDIRS, RESEARCH_SUBDIRS
from apps.core.models import SystemSetting


def registration_allowed() -> bool:
    system_setting = SystemSetting.objects.filter(pk=1).only("allow_registration").first()
    if system_setting is None:
        return settings.PROJECT_CONFIG.allow_registration
    return system_setting.allow_registration


@require_GET
def bootstrap(request):
    config = settings.PROJECT_CONFIG
    return JsonResponse(
        {
            "systemName": config.system_name,
            "allowRegistration": registration_allowed(),
            "map": {
                "defaultCenter": config.map.default_center,
                "defaultZoom": config.map.default_zoom,
                "defaultBasemap": config.map.default_basemap,
                "mapboxAccessToken": os.environ.get("MAPBOX_ACCESS_TOKEN", ""),
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
            "appSubdirs": list(APP_SUBDIRS),
            "researchSubdirs": list(RESEARCH_SUBDIRS),
        }
    )
