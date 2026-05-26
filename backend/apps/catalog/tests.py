from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from shapely.geometry import Point

from apps.catalog.models import DataResource, MapLayer
from apps.core.storage import vector_data_path


class LayerApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="tester", password="pass12345")
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
        self.client.force_login(self.user)
        self.relative_path = "tests/query_points.gpkg"
        self.path = vector_data_path(self.relative_path)
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
        gdf.to_file(self.path, layer="points", driver="GPKG")
        self.resource = DataResource.objects.create(
            name="测试点位数据",
            code="test-query-points",
            data_type=DataResource.DataType.VECTOR,
            file_format="GPKG",
            storage_path=self.relative_path,
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
