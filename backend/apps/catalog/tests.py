import io
import json
import sqlite3
import zipfile

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from shapely.geometry import Point

from apps.catalog.models import DataResource, MapLayer
from apps.catalog.services import scan_catalog_sources, scan_vector_geopackage
from apps.core.storage import gene_data_path, table_data_path, vector_geopackage_path


class LayerApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="tester", password="pass12345"
        )
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
        self.user = get_user_model().objects.create_user(
            username="resource-tester", password="pass12345"
        )
        grant(
            self.user,
            ("core", "browse_data"),
            ("core", "query_data"),
            ("core", "load_vector_layer"),
        )
        self.client.force_login(self.user)
        self.layer_name = "test_query_points"
        self.path = vector_geopackage_path()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.unlink(missing_ok=True)
        gene_data_path("populus.fasta").unlink(missing_ok=True)
        table_data_path("survey.csv").unlink(missing_ok=True)

        import geopandas as gpd

        gdf = gpd.GeoDataFrame(
            [
                {
                    "name": "样点一",
                    "height": 4.2,
                    "phase": "2025",
                    "geometry": Point(87.6, 43.8),
                },
                {
                    "name": "样点二",
                    "height": 8.5,
                    "phase": "2026",
                    "geometry": Point(87.7, 43.9),
                },
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
        response = self.client.get(
            f"/api/catalog/resources/{self.resource.id}/profile/"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["featureCount"], 2)
        self.assertEqual(payload["geometryType"], "Point")
        self.assertIn("height", [field["name"] for field in payload["fields"]])

    def test_resource_query_filters_by_attribute(self):
        response = self.client.post(
            f"/api/catalog/resources/{self.resource.id}/query/",
            data={
                "attributeFilters": [
                    {"field": "height", "operator": "gte", "value": "8"}
                ],
                "limit": 10,
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["totalCount"], 1)
        self.assertEqual(
            payload["geojson"]["features"][0]["properties"]["name"], "样点二"
        )


class CatalogScanTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="catalog-scanner", password="pass12345"
        )
        grant(self.user, ("core", "browse_data"))
        self.client.force_login(self.user)
        self.layer_name = "scan_test_points"
        self.path = vector_geopackage_path()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.unlink(missing_ok=True)

        import geopandas as gpd

        gdf = gpd.GeoDataFrame(
            [{"name": "扫描点", "geometry": Point(87.6, 43.8)}],
            geometry="geometry",
            crs="EPSG:4326",
        )
        gdf.to_file(self.path, layer=self.layer_name, driver="GPKG")

    def test_scan_vector_geopackage_registers_resources_and_layers(self):
        resources = scan_vector_geopackage()

        self.assertEqual(
            [resource.storage_path for resource in resources], [self.layer_name]
        )
        resource = DataResource.objects.get(storage_path=self.layer_name)
        layer = MapLayer.objects.get(source_path=self.layer_name)
        self.assertEqual(resource.data_type, DataResource.DataType.VECTOR)
        self.assertEqual(layer.geometry_type, MapLayer.GeometryType.POINT)
        self.assertTrue(layer.default_visible)

    def test_scan_endpoint_requires_browse_permission(self):
        self.user.user_permissions.clear()

        response = self.client.post(
            "/api/catalog/scan/", data={}, content_type="application/json"
        )

        self.assertEqual(response.status_code, 403)

    def test_scan_endpoint_registers_sources(self):
        response = self.client.post(
            "/api/catalog/scan/", data={}, content_type="application/json"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["items"][0]["name"], self.layer_name)

    def test_scan_catalog_sources_registers_nongeographic_files(self):
        gene_file = gene_data_path("populus.fasta")
        table_file = table_data_path("survey.csv")
        gene_file.parent.mkdir(parents=True, exist_ok=True)
        table_file.parent.mkdir(parents=True, exist_ok=True)
        gene_file.write_text(">sample\nATCG\n", encoding="utf-8")
        table_file.write_text("id,value\n1,42\n", encoding="utf-8")
        self.addCleanup(gene_file.unlink, missing_ok=True)
        self.addCleanup(table_file.unlink, missing_ok=True)

        resources = scan_catalog_sources()

        resource_types = {
            resource.storage_path: resource.data_type for resource in resources
        }
        self.assertEqual(
            resource_types["gene/populus.fasta"], DataResource.DataType.GENE
        )
        self.assertEqual(
            resource_types["table/survey.csv"], DataResource.DataType.TABLE
        )


class DataImportApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="importer", password="pass12345"
        )
        grant(self.user, ("catalog", "maintain_dataresource"))
        self.client.force_login(self.user)
        self.vector_path = vector_geopackage_path()
        self.table_path = table_data_path("data.sqlite")
        self.vector_path.parent.mkdir(parents=True, exist_ok=True)
        self.table_path.parent.mkdir(parents=True, exist_ok=True)
        self.vector_path.unlink(missing_ok=True)
        self.table_path.unlink(missing_ok=True)

    def test_import_preview_detects_coordinate_columns_and_quantization_error(self):
        response = self.client.post(
            "/api/catalog/import/preview/",
            data={
                "file": self._csv_file(
                    "sample.csv", "name,longitude,latitude\nA,87.600,43.80\n"
                )
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["detected"]["isGeographic"])
        self.assertEqual(payload["detected"]["longitudeColumn"], "longitude")
        self.assertEqual(payload["detected"]["latitudeColumn"], "latitude")
        self.assertEqual(payload["detected"]["coordinateStats"]["validRows"], 1)
        self.assertGreater(
            payload["detected"]["coordinateStats"]["quantizationErrorMeters"]["max"], 0
        )

    def test_import_geographic_table_writes_gpkg_metadata_and_catalog_records(self):
        response = self.client.post(
            "/api/catalog/import/commit/",
            data={
                "file": self._csv_file("points.csv", "name,lon,lat\nA,87.600,43.800\n"),
                "payload": json.dumps(
                    {
                        "name": "导入点位",
                        "tableName": "import_points",
                        "importMode": "geographic",
                        "longitudeColumn": "lon",
                        "latitudeColumn": "lat",
                        "missingCoordinatePolicy": "cancel",
                        "overwrite": False,
                        "fieldMetadata": {
                            "name": "样点名称",
                            "lon": "经度",
                            "lat": "纬度",
                        },
                    }
                ),
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["mode"], "geographic")
        self.assertEqual(payload["importedRows"], 1)
        resource = DataResource.objects.get(storage_path="import_points")
        layer = MapLayer.objects.get(source_path="import_points")
        self.assertEqual(resource.data_type, DataResource.DataType.VECTOR)
        self.assertEqual(layer.geometry_type, MapLayer.GeometryType.POINT)
        with sqlite3.connect(self.vector_path) as connection:
            description = connection.execute(
                "SELECT description FROM gpkg_data_columns WHERE table_name = ? AND column_name = ?",
                ("import_points", "name"),
            ).fetchone()[0]
        self.assertEqual(description, "样点名称")

    def test_import_geographic_table_requires_missing_coordinate_policy(self):
        response = self.client.post(
            "/api/catalog/import/commit/",
            data={
                "file": self._csv_file("points.csv", "name,lon,lat\nA,87.600,\n"),
                "payload": json.dumps(
                    {
                        "name": "导入点位",
                        "tableName": "missing_points",
                        "importMode": "geographic",
                        "longitudeColumn": "lon",
                        "latitudeColumn": "lat",
                        "missingCoordinatePolicy": "cancel",
                        "overwrite": False,
                        "fieldMetadata": {},
                    }
                ),
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("存在空或非法坐标", response.json()["detail"])

    def test_import_geographic_table_can_ignore_missing_coordinates(self):
        response = self.client.post(
            "/api/catalog/import/commit/",
            data={
                "file": self._csv_file(
                    "points.csv", "name,lon,lat\nA,87.600,43.800\nB,,43.900\n"
                ),
                "payload": json.dumps(
                    {
                        "name": "导入点位",
                        "tableName": "ignore_missing_points",
                        "importMode": "geographic",
                        "longitudeColumn": "lon",
                        "latitudeColumn": "lat",
                        "missingCoordinatePolicy": "ignore",
                        "overwrite": False,
                        "fieldMetadata": {},
                    }
                ),
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["importedRows"], 1)
        self.assertEqual(payload["skippedRows"], 1)

    def test_import_plain_table_writes_sqlite_data_and_metadata(self):
        response = self.client.post(
            "/api/catalog/import/commit/",
            data={
                "file": self._csv_file("survey.csv", "name,value\nA,42\n"),
                "payload": json.dumps(
                    {
                        "name": "调查表",
                        "tableName": "survey_table",
                        "importMode": "table",
                        "missingCoordinatePolicy": "cancel",
                        "overwrite": False,
                        "fieldMetadata": {"name": "名称", "value": "数值"},
                    }
                ),
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["mode"], "table")
        resource = DataResource.objects.get(storage_path="survey_table")
        self.assertEqual(resource.data_type, DataResource.DataType.TABLE)
        with sqlite3.connect(self.table_path) as connection:
            row = connection.execute("SELECT name, value FROM survey_table").fetchone()
            description = connection.execute(
                "SELECT description FROM data_columns WHERE table_name = ? AND column_name = ?",
                ("survey_table", "value"),
            ).fetchone()[0]
        self.assertEqual(row, ("A", "42"))
        self.assertEqual(description, "数值")

    def _csv_file(self, name: str, content: str) -> SimpleUploadedFile:
        return SimpleUploadedFile(
            name, content.encode("utf-8"), content_type="text/csv"
        )


class ExportApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="exporter", password="pass12345"
        )
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
            self.assertEqual(
                exported["features"][0]["properties"]["name"], "空间查询结果"
            )

    def _vector_item(self):
        return {
            "layerType": "vector",
            "name": "查询结果",
            "resourceId": self.resource.id,
            "geojson": self.geojson,
        }


def grant(user, *specs):
    for app_label, codename in specs:
        permission = Permission.objects.get(
            content_type__app_label=app_label, codename=codename
        )
        user.user_permissions.add(permission)
