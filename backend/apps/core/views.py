from django.conf import settings
from django.http import Http404
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET

from apps.core.config import APP_SUBDIRS, RESEARCH_SUBDIRS
from apps.core.config import load_runtime_config_document
from apps.core.models import SystemSetting


def registration_allowed() -> bool:
    system_setting = (
        SystemSetting.objects.filter(pk=1).only("allow_registration").first()
    )
    if system_setting is None:
        return settings.PROJECT_CONFIG.allow_registration
    return system_setting.allow_registration


@require_GET
def bootstrap(request):
    config = settings.PROJECT_CONFIG
    runtime_document = load_runtime_config_document(config)
    application = runtime_document["application"]
    return JsonResponse(
        {
            "systemName": application["system"]["name"],
            "allowRegistration": registration_allowed(),
            "map": {
                "defaultCenter": application["map"]["default_center"],
                "defaultZoom": application["map"]["default_zoom"],
                "defaultBasemap": application["map"]["default_basemap"],
                "mapboxAccessToken": application["map"].get("mapbox_access_token", ""),
            },
            "limits": {
                "uploadMaxMb": application["limits"]["upload_max_mb"],
                "queryResultLimit": application["limits"]["query_result_limit"],
            },
        }
    )


@require_GET
def health(request):
    return JsonResponse(
        {
            "status": "ok",
            "configLoaded": True,
            "configFormat": "toml",
            "appSubdirs": list(APP_SUBDIRS),
            "researchSubdirs": list(RESEARCH_SUBDIRS),
        }
    )


@require_GET
def frontend_app(request):
    index_path = settings.FRONTEND_DIST / "index.html"
    if not index_path.exists() and not settings.STATIC_ROOT.joinpath("index.html").exists():
        raise Http404("前端构建产物不存在，请先运行 pnpm build")
    return render(request, "index.html")
