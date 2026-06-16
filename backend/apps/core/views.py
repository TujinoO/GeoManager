import tomllib

from django.conf import settings
from django.http import Http404
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.http import require_GET

from apps.catalog.models import DataResource, DictionaryItem, MapLayer
from apps.core.config import APP_SUBDIRS, RESEARCH_SUBDIRS
from apps.core.config import load_runtime_config_document
from apps.core.models import SystemSetting

PLATFORM_ENGLISH_NAME = "Central Asia Poplar Forest Ecosystem Data Platform"
PLATFORM_ABBREVIATION = "CAPFED"
PLATFORM_EDITION = "CAPFED-WebGIS Research Edition"


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
def login_overview(request):
    generated_at = timezone.localtime().isoformat()
    metrics = _login_overview_metrics(generated_at)
    service_status = _login_overview_service_status(
        data_resources=metrics[0]["value"],
        thematic_layers=metrics[1]["value"],
    )

    return JsonResponse(
        {
            "generatedAt": generated_at,
            "platform": {
                "chineseName": settings.PROJECT_CONFIG.system_name,
                "englishName": PLATFORM_ENGLISH_NAME,
                "abbreviation": PLATFORM_ABBREVIATION,
                "edition": PLATFORM_EDITION,
                "version": _application_version(),
            },
            "hero": {
                "badge": "生态保护数据共享平台",
                "summary": (
                    "平台集成遥感影像、空间矢量、野外样方、长期监测与保护成果数据，"
                    "提供统一编目、三维地理可视化、综合查询分析和共享服务。"
                ),
                "capabilityTags": [
                    "遥感影像",
                    "矢量边界",
                    "野外样方",
                    "长期监测",
                    "成果共享",
                ],
            },
            "metrics": metrics,
            "serviceStatus": service_status,
            "footer": {
                "statisticsNotice": "统计口径已接入后端平台概览接口",
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
    if (
        not index_path.exists()
        and not settings.STATIC_ROOT.joinpath("index.html").exists()
    ):
        raise Http404("前端构建产物不存在，请先运行 pnpm build")
    return render(request, "index.html")


def _login_overview_metrics(generated_at: str) -> list[dict]:
    active_resources = DataResource.objects.filter(status=DataResource.Status.ACTIVE)
    active_layers = MapLayer.objects.filter(is_active=True)
    covered_regions = DictionaryItem.objects.filter(
        dict_type=DictionaryItem.DictType.REGION,
        is_active=True,
    ).count()
    if covered_regions == 0:
        covered_regions = (
            active_resources.exclude(spatial_extent="")
            .values("spatial_extent")
            .distinct()
            .count()
        )

    metric_values = [
        (
            "dataResources",
            "数据资源",
            active_resources.count(),
            "空间、表格、文档",
        ),
        (
            "thematicLayers",
            "专题图层",
            active_layers.count(),
            "生态保护专题",
        ),
        (
            "monitoringSites",
            "监测站点",
            active_layers.filter(geometry_type=MapLayer.GeometryType.POINT).count(),
            "长期观测网络",
        ),
        (
            "coveredBasins",
            "覆盖流域",
            covered_regions,
            "中亚重点区域",
        ),
    ]
    return [
        {
            "id": metric_id,
            "label": label,
            "value": value,
            "displayValue": _format_metric_value(value),
            "note": note,
            "updatedAt": generated_at,
        }
        for metric_id, label, value, note in metric_values
    ]


def _login_overview_service_status(
    *,
    data_resources: int,
    thematic_layers: int,
) -> dict:
    services = [
        {
            "id": "resourceCatalog",
            "label": "资源目录",
            "status": "normal" if data_resources > 0 else "warning",
            "description": (
                f"已接入 {data_resources} 项启用数据资源。"
                if data_resources > 0
                else "暂无启用数据资源，登录后可由管理员导入。"
            ),
        },
        {
            "id": "layerService",
            "label": "图层服务",
            "status": "normal" if thematic_layers > 0 else "warning",
            "description": (
                f"地图图层服务当前可用，已配置 {thematic_layers} 个启用图层。"
                if thematic_layers > 0
                else "暂无启用图层，登录后可由管理员配置。"
            ),
        },
        {
            "id": "permissionGateway",
            "label": "权限认证",
            "status": "normal",
            "description": "统一身份认证与权限控制已开启。",
        },
    ]
    node_summary = _login_overview_node_summary(services)
    return {
        "title": "平台服务状态",
        "headline": _service_status_headline(services),
        "description": "登录后可按账号权限进入数据目录、地图工作台与后台管理功能。",
        "services": services,
        "nodeSummary": node_summary,
    }


def _login_overview_node_summary(services: list[dict]) -> dict:
    total = 24
    risk = sum(1 for service in services if service["status"] == "risk")
    warning = sum(1 for service in services if service["status"] == "warning")
    normal = max(total - warning - risk, 0)
    return {
        "total": total,
        "normal": normal,
        "warning": warning,
        "risk": risk,
        "legend": [
            {"status": "normal", "label": "正常", "count": normal},
            {"status": "warning", "label": "待同步", "count": warning},
            {"status": "risk", "label": "异常", "count": risk},
        ],
    }


def _service_status_headline(services: list[dict]) -> str:
    status_text = {
        "normal": "可用",
        "warning": "待同步",
        "risk": "异常",
    }
    return " · ".join(
        f"{service['label']}{status_text.get(service['status'], '未知')}"
        for service in services
    )


def _format_metric_value(value: int) -> str:
    return f"{value:,}"


def _application_version() -> str:
    pyproject_path = settings.PROGRAM_ROOT / "backend" / "pyproject.toml"
    with pyproject_path.open("rb") as file:
        version = tomllib.load(file)["project"]["version"]
    return f"v{version}"
