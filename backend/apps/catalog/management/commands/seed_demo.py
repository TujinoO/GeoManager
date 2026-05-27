import random
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand
from shapely.geometry import Point

from apps.catalog.models import Achievement, DataCatalog, DataResource, DictionaryItem, MapLayer
from apps.core.storage import vector_geopackage_path


URUMQI_POPLAR_POINTS_LAYER = "demo_poplar_points_urumqi"


class Command(BaseCommand):
    help = "创建本地演示角色、用户和基础数据"

    def handle(self, *args, **options):
        normal = Group.objects.get_or_create(name="普通用户")[0]
        researcher = Group.objects.get_or_create(name="科研用户")[0]
        data_admin = Group.objects.get_or_create(name="数据管理员")[0]
        system_admin = Group.objects.get_or_create(name="系统管理员")[0]

        for codename in ("export_dataresource", "maintain_dataresource", "load_maplayer"):
            permission = Permission.objects.filter(codename=codename).first()
            if permission:
                researcher.permissions.add(permission)
                data_admin.permissions.add(permission)
        raster_permission = Permission.objects.filter(codename="manage_raster_cache").first()
        if raster_permission:
            data_admin.permissions.add(raster_permission)
            system_admin.permissions.add(raster_permission)

        User = get_user_model()
        admin_user, created = User.objects.get_or_create(
            username="admin",
            defaults={"is_staff": True, "is_superuser": True, "email": "admin@example.local"},
        )
        if created:
            admin_user.set_password("admin12345")
            admin_user.save(update_fields=("password",))
        admin_user.groups.add(system_admin)

        demo_user, created = User.objects.get_or_create(username="demo", defaults={"email": "demo@example.local"})
        if created:
            demo_user.set_password("demo12345")
            demo_user.save(update_fields=("password",))
        demo_user.groups.add(normal)

        layer_category, _ = DictionaryItem.objects.get_or_create(
            dict_type=DictionaryItem.DictType.LAYER_CATEGORY,
            code="poplar-forest",
            defaults={"name": "胡杨林生态图层", "sort_order": 10},
        )
        achievement_category, _ = DictionaryItem.objects.get_or_create(
            dict_type=DictionaryItem.DictType.ACHIEVEMENT_CATEGORY,
            code="project-map",
            defaults={"name": "项目图件成果", "sort_order": 10},
        )

        resource, _ = DataResource.objects.get_or_create(
            code="demo-poplar-boundary",
            defaults={
                "name": "胡杨林分布边界示例",
                "data_type": DataResource.DataType.VECTOR,
                "category": layer_category,
                "source": "平台演示数据",
                "provider": "项目组",
                "file_format": "GPKG",
                "spatial_extent": "中亚重点区域",
                "coordinate_system": "EPSG:4326",
                "description": "用于验证平台目录、图层和地图加载流程的示例数据资源。",
                "status": DataResource.Status.ACTIVE,
            },
        )

        catalog, _ = DataCatalog.objects.get_or_create(
            code="base-data",
            defaults={"name": "基础空间数据", "description": "项目基础空间数据目录", "sort_order": 10},
        )
        catalog.resources.add(resource)

        points_path = create_urumqi_poplar_points()
        point_resource, _ = DataResource.objects.update_or_create(
            code="demo-poplar-points-urumqi",
            defaults={
                "name": "胡杨林点位图示例",
                "data_type": DataResource.DataType.VECTOR,
                "category": layer_category,
                "source": "平台演示数据",
                "provider": "项目组",
                "file_format": "GPKG",
                "storage_path": URUMQI_POPLAR_POINTS_LAYER,
                "spatial_extent": "乌鲁木齐附近",
                "coordinate_system": "EPSG:4326",
                "description": "由固定随机种子生成的乌鲁木齐附近胡杨林示范点位，可用于验证点图层加载和点符号渲染。",
                "quality_note": "演示数据，不代表真实调查结果。",
                "status": DataResource.Status.ACTIVE,
            },
        )
        catalog.resources.add(point_resource)

        layer, _ = MapLayer.objects.get_or_create(
            code="demo-poplar-boundary",
            defaults={
                "name": "胡杨林分布边界",
                "layer_type": MapLayer.LayerType.VECTOR,
                "geometry_type": MapLayer.GeometryType.POLYGON,
                "category": layer_category,
                "data_resource": resource,
                "sort_order": 10,
                "default_visible": False,
                "default_opacity": 70,
                "symbolization": {
                    "fillColor": "#2f7d62",
                    "lineColor": "#174f46",
                    "circleColor": "#2f7d62",
                    "lineWidth": 1.4,
                },
                "legend": "示例图层：后续将由真实 GeoPackage 文件替换。",
                "bounds": [50, 35, 100, 48],
            },
        )
        MapLayer.objects.update_or_create(
            code="demo-poplar-points-urumqi",
            defaults={
                "name": "胡杨林点位图",
                "layer_type": MapLayer.LayerType.VECTOR,
                "geometry_type": MapLayer.GeometryType.POINT,
                "category": layer_category,
                "data_resource": point_resource,
                "source_path": URUMQI_POPLAR_POINTS_LAYER,
                "sort_order": 20,
                "default_visible": False,
                "default_opacity": 90,
                "symbolization": {
                    "circleColor": "#d9a441",
                    "circleRadius": 6,
                    "lineColor": "#6f4f1f",
                    "lineWidth": 1,
                },
                "legend": f"乌鲁木齐附近胡杨林随机点位示例，共 {point_count(points_path)} 个点。",
                "bounds": [86.9, 43.35, 88.35, 44.25],
                "is_active": True,
            },
        )

        Achievement.objects.get_or_create(
            code="demo-regional-overview",
            defaults={
                "title": "中亚胡杨林保护区数据概览",
                "category": achievement_category,
                "summary": "展示数据目录、图层和成果模块的演示成果条目。",
                "source": "项目组",
                "related_layer": layer,
                "display_order": 10,
                "status": Achievement.Status.PUBLISHED,
            },
        )

        self.stdout.write(self.style.SUCCESS("演示数据已创建。admin/admin12345，demo/demo12345"))


def create_urumqi_poplar_points():
    import geopandas as gpd

    random_generator = random.Random(20260526)
    center_lon = 87.6168
    center_lat = 43.8256
    records = []
    for index in range(80):
        lon = center_lon + random_generator.gauss(0, 0.24)
        lat = center_lat + random_generator.gauss(0, 0.14)
        records.append(
            {
                "name": f"胡杨林示范点-{index + 1:03d}",
                "point_type": random_generator.choice(["天然林", "人工修复", "样方监测"]),
                "health": random_generator.choice(["良好", "一般", "退化"]),
                "survey_date": date(2026, 5, 1) - timedelta(days=random_generator.randint(0, 365)),
                "geometry": Point(lon, lat),
            }
        )

    output_path = vector_geopackage_path()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    gdf = gpd.GeoDataFrame(records, geometry="geometry", crs="EPSG:4326")
    gdf.to_file(output_path, layer=URUMQI_POPLAR_POINTS_LAYER, driver="GPKG")
    return output_path


def point_count(path):
    import geopandas as gpd

    return len(gpd.read_file(path))
