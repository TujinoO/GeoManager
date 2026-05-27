import io
import json
import zipfile

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.test import TestCase
from shapely.geometry import Point

from apps.catalog.models import DataResource, MapLayer
from apps.core.storage import vector_geopackage_path


class LayerApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="tester", password="pass12345")
        grant(self.user, ("core", "browse_data"))
        self.client.force_login(self.user)

    def test_layers_endpoint_returns_public_layers(self):
        MapLayer.objects.create(
            name="公开图层",
            code="public-layer",
            layer_type=MapLayer.LayerType.VECTOR,
            is_active=True,
        )

        response = self.client.get("/api/layers/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["items"][0]["code"], "public-layer")

    def test_layers_endpoint_hides_group_restricted_layers(self):
        layer = MapLayer.objects.create(
            name="受限图层",
            code="restricted-layer",
            layer_type=MapLayer.LayerType.VECTOR,
            is_active=True,
        )
        restricted_group = Group.objects.create(name="科研用户")
        layer.access_groups.add(restricted_group)

        response = self.client.get("/api/layers/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["items"], [])


class ResourceQueryApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="resource-tester", password="pass12345")
        grant(self.user, ("core", "browse_data"), ("core", "query_data"), ("core", "load_vector_layer"))
        self.client.force_login(self.user)
        self.layer_name = "test_query_points"
        self.path = vector_geopackage_path()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.unlink(missing_ok=True)

        import geopandas as gpd

        gdf = gpd.GeoDataFrame(
            [
                {"name": "样点一", "height": 4.2, "phase": "2025", "geometry": Point(87.6, 43.8)},
                {"name": "样点二", "height": 8.5, "phase": "2026", "geometry": Point(87.7, 43.9)},
            ],
            geometry="geometry",
            crs="EPSG:4326",
        )
        gdf.to_file(self.path, layer=self.layer_name, driver="GPKG")
        self.resource = DataResource.objects.create(
            name="测试点位数据",
            code="test-query-points",
            data_type=DataResource.DataType.VECTOR,
            file_format="GPKG",
            storage_path=self.layer_name,
            status=DataResource.Status.ACTIVE,
        )

    def test_resource_profile_returns_fields_and_metadata(self):
        response = self.client.get(f"/api/catalog/resources/{self.resource.id}/profile/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["featureCount"], 2)
        self.assertEqual(payload["geometryType"], "Point")
        self.assertIn("height", [field["name"] for field in payload["fields"]])

    def test_resource_query_filters_by_attribute(self):
        response = self.client.post(
            f"/api/catalog/resources/{self.resource.id}/query/",
            data={"attributeFilters": [{"field": "height", "operator": "gte", "value": "8"}], "limit": 10},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["totalCount"], 1)
        self.assertEqual(payload["geojson"]["features"][0]["properties"]["name"], "样点二")


class ExportApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="exporter", password="pass12345")
        grant(self.user, ("core", "browse_data"))
        self.client.force_login(self.user)
        self.resource = DataResource.objects.create(
            name="导出测试数据",
            code="export-test-data",
            data_type=DataResource.DataType.VECTOR,
            status=DataResource.Status.ACTIVE,
        )
        self.geojson = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"name": "空间查询结果"},
                    "geometry": {"type": "Point", "coordinates": [87.6, 43.8]},
                }
            ],
        }

    def test_export_requires_export_permission(self):
        response = self.client.post(
            "/api/catalog/export/",
            data={"epsg": 4326, "items": [self._vector_item()]},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn("当前用户组“未分组”无权限", response.json()["detail"])

    def test_export_vector_geojson_zip(self):
        grant(self.user, ("catalog", "export_dataresource"))

        response = self.client.post(
            "/api/catalog/export/",
            data={"epsg": 4326, "items": [self._vector_item()]},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/zip")
        with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
            names = archive.namelist()
            self.assertEqual(len(names), 1)
            self.assertTrue(names[0].endswith(".geojson"))
            exported = json.loads(archive.read(names[0]).decode("utf-8"))
            self.assertEqual(exported["features"][0]["properties"]["name"], "空间查询结果")

    def _vector_item(self):
        return {
            "layerType": "vector",
            "name": "查询结果",
            "resourceId": self.resource.id,
            "geojson": self.geojson,
        }


def grant(user, *specs):
    for app_label, codename in specs:
        permission = Permission.objects.get(content_type__app_label=app_label, codename=codename)
        user.user_permissions.add(permission)
