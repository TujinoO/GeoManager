import io
import json
import sqlite3
import zipfile

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from shapely.geometry import Point

from apps.audit.models import OperationLog
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
            layer_type=MapLayer.LayerType.RASTER,
            is_active=True,
        )

        response = self.client.get("/api/layers/")

        self.assertEqual(response.status_code, 200)
        items = response.json()["items"]
        raster_items = [item for item in items if item.get("layerType") == "raster"]
        self.assertEqual(raster_items[0]["code"], "public-layer")

    def test_layers_endpoint_hides_group_restricted_layers(self):
        layer = MapLayer.objects.create(
            name="受限图层",
            code="restricted-layer",
            layer_type=MapLayer.LayerType.RASTER,
            is_active=True,
        )
        restricted_group = Group.objects.create(name="科研用户")
        layer.access_groups.add(restricted_group)

        response = self.client.get("/api/layers/")

        self.assertEqual(response.status_code, 200)
        items = response.json()["items"]
        raster_items = [item for item in items if item.get("layerType") == "raster"]
        self.assertEqual(raster_items, [])


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

    def test_vector_layer_profile_returns_fields_and_metadata(self):
        response = self.client.get(f"/api/layers/{self.layer_name}/profile/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["featureCount"], 2)
        self.assertEqual(payload["geometryType"], "Point")
        self.assertIn("height", [field["name"] for field in payload["fields"]])

    def test_vector_layer_query_filters_by_attribute(self):
        response = self.client.post(
            f"/api/layers/{self.layer_name}/query/",
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
        self.assertIn("warnings", payload)

    def test_vector_layer_query_filters_by_spatial_polygon(self):
        response = self.client.post(
            f"/api/layers/{self.layer_name}/query/",
            data=json.dumps(
                {
                    "spatialFilter": {
                        "mode": "polygon",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [
                                [
                                    [87.55, 43.75],
                                    [87.65, 43.75],
                                    [87.65, 43.85],
                                    [87.55, 43.85],
                                    [87.55, 43.75],
                                ]
                            ],
                        },
                    },
                    "limit": 10,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["totalCount"], 1)
        self.assertEqual(
            payload["geojson"]["features"][0]["properties"]["name"], "样点一"
        )

    def test_vector_layer_query_rejects_unknown_attribute_operator(self):
        response = self.client.post(
            f"/api/layers/{self.layer_name}/query/",
            data=json.dumps(
                {
                    "attributeFilters": [
                        {
                            "field": "height",
                            "operator": "startsWith",
                            "value": "8",
                        }
                    ]
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("不支持的属性操作符", response.json()["detail"])

    def test_vector_layer_query_rejects_invalid_json_body(self):
        response = self.client.post(
            f"/api/layers/{self.layer_name}/query/",
            data="{",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "请求体不是有效 JSON")

    def test_resource_query_denies_group_restricted_resource(self):
        resource = DataResource.objects.create(
            name="受限矢量资源",
            code="restricted-query-resource",
            data_type=DataResource.DataType.VECTOR,
            storage_path=self.layer_name,
            status=DataResource.Status.ACTIVE,
        )
        restricted_group = Group.objects.create(name="外部协作组")
        resource.access_groups.add(restricted_group)

        response = self.client.post(
            f"/api/catalog/resources/{resource.id}/query/",
            data=json.dumps({"limit": 10}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "无权访问该数据资源")


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

    def test_scan_vector_geopackage_returns_layer_info(self):
        layers = scan_vector_geopackage()

        self.assertEqual(len(layers), 1)
        self.assertEqual(layers[0]["name"], self.layer_name)
        self.assertEqual(layers[0]["geometryType"], "point")
        self.assertEqual(layers[0]["featureCount"], 1)

    def test_scan_endpoint_requires_browse_permission(self):
        self.user.user_permissions.clear()

        response = self.client.post(
            "/api/catalog/scan/", data={}, content_type="application/json"
        )

        self.assertEqual(response.status_code, 403)

    def test_scan_endpoint_returns_layers(self):
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

        vector_layers, nongeographic_resources = scan_catalog_sources()

        self.assertEqual(len(vector_layers), 1)
        self.assertEqual(vector_layers[0]["name"], self.layer_name)

        resource_types = {
            resource.storage_path: resource.data_type
            for resource in nongeographic_resources
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
        self.assertIsNone(payload["detected"]["coordinateStats"])
        self.assertEqual(payload["detected"]["validationIssues"], [])

    def test_import_preview_does_not_run_coordinate_validation(self):
        response = self.client.post(
            "/api/catalog/import/preview/",
            data={
                "file": self._csv_file(
                    "sample.csv", "name,longitude,latitude\nA,87.600,\n"
                )
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIsNone(payload["detected"]["coordinateStats"])
        self.assertEqual(payload["detected"]["validationIssues"], [])

    def test_import_validate_returns_coordinate_issues(self):
        response = self.client.post(
            "/api/catalog/import/validate/",
            data={
                "file": self._csv_file(
                    "points.csv", "name,lon,lat\nA,181.000,43.800\n"
                ),
                "payload": json.dumps(
                    {
                        "importMode": "geographic",
                        "longitudeColumn": "lon",
                        "latitudeColumn": "lat",
                    }
                ),
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["coordinateStats"]["totalRows"], 1)
        self.assertEqual(payload["validationIssues"][0]["code"], "invalid_longitude")

    def test_import_geographic_table_writes_gpkg_metadata(self):
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
        self.assertEqual(payload["layerName"], "import_points")
        self.assertEqual(payload["tableName"], "import_points")
        self.assertEqual(payload["resourceName"], "导入点位")

        import geopandas as gpd

        gdf = gpd.read_file(self.vector_path, layer="import_points")
        self.assertEqual(len(gdf), 1)

        resource = DataResource.objects.get(storage_path="import_points")
        self.assertEqual(resource.name, "导入点位")
        self.assertEqual(resource.id, payload["resourceId"])
        self.assertEqual(resource.data_type, DataResource.DataType.VECTOR)

        with sqlite3.connect(self.vector_path) as connection:
            description = connection.execute(
                "SELECT description FROM gpkg_data_columns WHERE table_name = ? AND column_name = ?",
                ("import_points", "name"),
            ).fetchone()[0]
        self.assertEqual(description, "样点名称")

    def test_imported_geographic_table_resource_list_uses_display_name(self):
        grant(self.user, ("core", "browse_data"))
        response = self.client.post(
            "/api/catalog/import/commit/",
            data={
                "file": self._csv_file("points.csv", "name,lon,lat\nA,87.600,43.800\n"),
                "payload": json.dumps(
                    {
                        "name": "样地调查点",
                        "tableName": "survey_points_2026",
                        "importMode": "geographic",
                        "longitudeColumn": "lon",
                        "latitudeColumn": "lat",
                        "overwrite": False,
                        "fieldMetadata": {},
                    }
                ),
            },
        )
        self.assertEqual(response.status_code, 201)

        resources_response = self.client.get("/api/catalog/resources/?dataType=vector")

        self.assertEqual(resources_response.status_code, 200)
        names = [item["name"] for item in resources_response.json()["items"]]
        self.assertIn("样地调查点", names)
        self.assertNotIn("survey_points_2026", names)

    def test_import_geographic_table_respects_included_columns(self):
        response = self.client.post(
            "/api/catalog/import/commit/",
            data={
                "file": self._csv_file(
                    "points.csv",
                    "name,lon,lat,drop_me\nA,87.600,43.800,hidden\n",
                ),
                "payload": json.dumps(
                    {
                        "name": "导入点位",
                        "tableName": "included_points",
                        "importMode": "geographic",
                        "longitudeColumn": "lon",
                        "latitudeColumn": "lat",
                        "overwrite": False,
                        "includedColumns": ["name", "lon", "lat"],
                        "fieldMetadata": {
                            "name": "样点名称",
                            "lon": "经度",
                            "lat": "纬度",
                            "drop_me": "不应入库",
                        },
                    }
                ),
            },
        )

        self.assertEqual(response.status_code, 201)
        import geopandas as gpd

        gdf = gpd.read_file(self.vector_path, layer="included_points")
        self.assertNotIn("drop_me", gdf.columns)
        with sqlite3.connect(self.vector_path) as connection:
            hidden_metadata = connection.execute(
                "SELECT description FROM gpkg_data_columns WHERE table_name = ? AND column_name = ?",
                ("included_points", "drop_me"),
            ).fetchone()
        self.assertIsNone(hidden_metadata)

    def test_import_geographic_table_rejects_missing_coordinates(self):
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
                        "overwrite": False,
                        "fieldMetadata": {},
                    }
                ),
            },
        )

        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertEqual(payload["detail"], "数据校验未通过")
        self.assertEqual(payload["issues"][0]["code"], "missing_geometry")

    def test_import_geographic_table_rejects_non_decimal_coordinates(self):
        response = self.client.post(
            "/api/catalog/import/commit/",
            data={
                "file": self._csv_file("points.csv", "name,lon,lat\nA,87,43.800\n"),
                "payload": json.dumps(
                    {
                        "name": "导入点位",
                        "tableName": "integer_coordinate_points",
                        "importMode": "geographic",
                        "longitudeColumn": "lon",
                        "latitudeColumn": "lat",
                        "overwrite": False,
                        "fieldMetadata": {},
                    }
                ),
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["issues"][0]["code"], "invalid_coordinate_format"
        )

    def test_import_geographic_table_rejects_out_of_range_coordinates(self):
        response = self.client.post(
            "/api/catalog/import/commit/",
            data={
                "file": self._csv_file(
                    "points.csv", "name,lon,lat\nA,181.000,43.800\nB,87.600,91.000\n"
                ),
                "payload": json.dumps(
                    {
                        "name": "导入点位",
                        "tableName": "out_of_range_points",
                        "importMode": "geographic",
                        "longitudeColumn": "lon",
                        "latitudeColumn": "lat",
                        "overwrite": False,
                        "fieldMetadata": {},
                    }
                ),
            },
        )

        self.assertEqual(response.status_code, 400)
        issue_codes = [issue["code"] for issue in response.json()["issues"]]
        self.assertIn("invalid_longitude", issue_codes)
        self.assertIn("invalid_latitude", issue_codes)

    def test_import_geographic_table_requires_uncertainty_confirmation(self):
        response = self.client.post(
            "/api/catalog/import/commit/",
            data={
                "file": self._csv_file(
                    "points.csv",
                    "name,lon,lat\nA,87.6,43.8\nB,87.600001,43.800001\n",
                ),
                "payload": json.dumps(
                    {
                        "name": "导入点位",
                        "tableName": "uncertain_points",
                        "importMode": "geographic",
                        "longitudeColumn": "lon",
                        "latitudeColumn": "lat",
                        "overwrite": False,
                        "fieldMetadata": {},
                    }
                ),
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["issues"][0]["code"], "coordinate_uncertainty")

    def test_import_geographic_table_can_ignore_uncertainty(self):
        response = self.client.post(
            "/api/catalog/import/commit/",
            data={
                "file": self._csv_file(
                    "points.csv",
                    "name,lon,lat\nA,87.6,43.8\nB,87.600001,43.800001\n",
                ),
                "payload": json.dumps(
                    {
                        "name": "导入点位",
                        "tableName": "confirmed_uncertain_points",
                        "importMode": "geographic",
                        "longitudeColumn": "lon",
                        "latitudeColumn": "lat",
                        "ignoreCoordinateUncertainty": True,
                        "overwrite": False,
                        "fieldMetadata": {},
                    }
                ),
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["importedRows"], 2)

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
                        "overwrite": False,
                        "fieldMetadata": {"name": "名称", "value": "数值"},
                    }
                ),
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["mode"], "table")
        self.assertEqual(payload["resourceName"], "调查表")
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

    def test_import_plain_table_respects_included_columns(self):
        response = self.client.post(
            "/api/catalog/import/commit/",
            data={
                "file": self._csv_file("survey.csv", "name,value,drop_me\nA,42,x\n"),
                "payload": json.dumps(
                    {
                        "name": "调查表",
                        "tableName": "included_table",
                        "importMode": "table",
                        "overwrite": False,
                        "includedColumns": ["name", "value"],
                        "fieldMetadata": {
                            "name": "名称",
                            "value": "数值",
                            "drop_me": "不应入库",
                        },
                    }
                ),
            },
        )

        self.assertEqual(response.status_code, 201)
        with sqlite3.connect(self.table_path) as connection:
            columns = [
                row[1]
                for row in connection.execute("PRAGMA table_info(included_table)")
            ]
            hidden_metadata = connection.execute(
                "SELECT description FROM data_columns WHERE table_name = ? AND column_name = ?",
                ("included_table", "drop_me"),
            ).fetchone()
        self.assertEqual(columns, ["name", "value"])
        self.assertIsNone(hidden_metadata)

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
        self.assertIn("当前用户组\u201c未分组\u201d无权限", response.json()["detail"])

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


class AdminDataResourceApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="data-admin", password="pass12345"
        )
        grant(
            self.user,
            ("catalog", "maintain_dataresource"),
            ("catalog", "export_dataresource"),
            ("core", "browse_data"),
        )
        self.client.force_login(self.user)
        self.group = Group.objects.create(name="科研用户")
        self.resource = DataResource.objects.create(
            name="存量样地数据",
            code="inventory-plots",
            data_type=DataResource.DataType.VECTOR,
            source="用户导入",
            provider="平台组",
            file_format="GPKG",
            storage_path="inventory_plots",
            status=DataResource.Status.ACTIVE,
        )

    def test_admin_data_resource_list_includes_active_and_inactive_resources(self):
        self.resource.status = DataResource.Status.INACTIVE
        self.resource.save(update_fields=["status"])

        response = self.client.get("/api/admin/data/resources/?status=inactive")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["total"], 1)
        self.assertEqual(payload["items"][0]["name"], "存量样地数据")
        self.assertEqual(payload["items"][0]["status"], "inactive")

    def test_status_toggle_hides_resource_from_regular_catalog(self):
        response = self.client.post(
            f"/api/admin/data/resources/{self.resource.id}/",
            data=json.dumps({"action": "setStatus", "status": "inactive"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.resource.refresh_from_db()
        self.assertEqual(self.resource.status, DataResource.Status.INACTIVE)
        regular_response = self.client.get("/api/catalog/resources/")
        self.assertEqual(regular_response.status_code, 200)
        regular_ids = {
            item["id"]
            for item in regular_response.json()["items"]
            if isinstance(item["id"], int)
        }
        self.assertNotIn(self.resource.id, regular_ids)
        self.assertTrue(
            OperationLog.objects.filter(
                module="数据管理", action="切换数据状态"
            ).exists()
        )

    def test_update_access_groups_and_default_visualization(self):
        response = self.client.post(
            f"/api/admin/data/resources/{self.resource.id}/",
            data=json.dumps(
                {
                    "action": "update",
                    "accessGroupIds": [self.group.id],
                    "visualization": {
                        "layerName": "默认样地点",
                        "defaultVisible": True,
                        "defaultOpacity": 72,
                        "symbolization": {"pointColor": "#2f7d62"},
                    },
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.resource.refresh_from_db()
        self.assertEqual(self.resource.access_groups.first(), self.group)
        self.assertEqual(self.resource.default_visualization["defaultOpacity"], 72)
        layer = MapLayer.objects.get(data_resource=self.resource)
        self.assertEqual(layer.name, "默认样地点")
        self.assertEqual(layer.default_opacity, 72)
        self.assertEqual(layer.symbolization["pointColor"], "#2f7d62")
        self.assertEqual(layer.access_groups.first(), self.group)

    def test_delete_requires_matching_confirmation_name(self):
        response = self.client.post(
            f"/api/admin/data/resources/{self.resource.id}/",
            data=json.dumps({"action": "delete", "confirmationName": "错误名称"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertTrue(DataResource.objects.filter(pk=self.resource.id).exists())

    def test_delete_removes_resource_and_logs_operation(self):
        response = self.client.post(
            f"/api/admin/data/resources/{self.resource.id}/",
            data=json.dumps(
                {"action": "delete", "confirmationName": self.resource.name}
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(DataResource.objects.filter(pk=self.resource.id).exists())
        self.assertTrue(
            OperationLog.objects.filter(
                module="数据管理", action="删除存量数据"
            ).exists()
        )

    def test_admin_data_export_supports_csv_and_xlsx(self):
        csv_response = self.client.get("/api/admin/data/resources/export/?format=csv")
        xlsx_response = self.client.get("/api/admin/data/resources/export/?format=xlsx")

        self.assertEqual(csv_response.status_code, 200)
        self.assertIn("text/csv", csv_response["Content-Type"])
        self.assertIn("存量样地数据", csv_response.content.decode("utf-8-sig"))
        self.assertEqual(xlsx_response.status_code, 200)
        self.assertIn("spreadsheetml", xlsx_response["Content-Type"])


def grant(user, *specs):
    for app_label, codename in specs:
        permission = Permission.objects.get(
            content_type__app_label=app_label, codename=codename
        )
        user.user_permissions.add(permission)
