import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.test import TestCase, override_settings

from apps.audit.models import OperationLog
from apps.catalog.models import DataResource
from apps.core.config import load_project_config
from apps.raster.models import RasterDataset
from apps.raster.services import scan_unprocessed_source_files


class RasterPermissionApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="raster-user", password="pass12345"
        )
        self.client.force_login(self.user)

    def test_render_async_requires_raster_load_permission(self):
        response = self.client.post(
            "/api/raster/render/async/",
            data={"datasetId": 1, "rulesMode": "default"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn("当前用户组“未分组”无权限", response.json()["detail"])

    def test_default_render_does_not_require_custom_symbolization_permission(self):
        grant(self.user, ("core", "load_raster_layer"))

        response = self.client.post(
            "/api/raster/render/async/",
            data={"datasetId": 1, "rulesMode": "default"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "缺少 layerId 或 datasetId")

    def test_custom_render_requires_custom_symbolization_permission(self):
        grant(self.user, ("core", "load_raster_layer"))

        response = self.client.post(
            "/api/raster/render/async/",
            data={
                "datasetId": 1,
                "rulesMode": "custom",
                "rules": {"mode": "gray"},
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn("当前用户组“未分组”无权限", response.json()["detail"])

    def test_render_async_denies_group_restricted_dataset_resource(self):
        grant(self.user, ("core", "load_raster_layer"))
        resource = DataResource.objects.create(
            name="受限栅格资源",
            code="restricted-raster-resource",
            data_type=DataResource.DataType.RASTER,
            status=DataResource.Status.ACTIVE,
        )
        restricted_group = Group.objects.create(name="外部协作组")
        resource.access_groups.add(restricted_group)
        dataset = self._dataset("restricted-dataset", resource)

        response = self.client.post(
            "/api/raster/render/async/",
            data={"datasetId": dataset.id, "rulesMode": "default"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "无权访问该数据资源")

    def test_datasets_endpoint_hides_group_restricted_datasets(self):
        grant(self.user, ("core", "browse_data"))
        public_resource = DataResource.objects.create(
            name="公开栅格资源",
            code="public-raster-resource",
            data_type=DataResource.DataType.RASTER,
            status=DataResource.Status.ACTIVE,
        )
        restricted_resource = DataResource.objects.create(
            name="受限栅格资源",
            code="restricted-raster-list-resource",
            data_type=DataResource.DataType.RASTER,
            status=DataResource.Status.ACTIVE,
        )
        restricted_group = Group.objects.create(name="受限组")
        restricted_resource.access_groups.add(restricted_group)
        self._dataset("public-dataset", public_resource)
        self._dataset("hidden-dataset", restricted_resource)

        response = self.client.get("/api/raster/datasets/")

        self.assertEqual(response.status_code, 200)
        names = [item["name"] for item in response.json()["items"]]
        self.assertEqual(names, ["public-dataset"])

    def test_scan_endpoint_does_not_write_operation_log(self):
        grant(self.user, ("core", "browse_data"))
        job = SimpleNamespace(
            as_dict=lambda: {
                "id": "scan-job-1",
                "type": "scan",
                "status": "pending",
                "progress": 0,
                "messages": [],
                "result": None,
                "error": "",
            }
        )

        with patch("apps.raster.views.start_scan_job", return_value=job):
            response = self.client.post(
                "/api/raster/scan/", data={}, content_type="application/json"
            )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["id"], "scan-job-1")
        self.assertFalse(
            OperationLog.objects.filter(
                module="栅格管理", action="发起栅格目录扫描"
            ).exists()
        )

    def _dataset(self, code: str, resource: DataResource) -> RasterDataset:
        return RasterDataset.objects.create(
            name=code,
            code=code,
            source_relative_path=f"{code}.tif",
            processed_relative_path=f"{code}.cog.tif",
            data_resource=resource,
            processed_gdalinfo={
                "bands": [{"band": 1, "type": "UInt16", "min": 0, "max": 100}]
            },
            default_rules={"mode": "gray", "bands": [1]},
            band_count=1,
            status=RasterDataset.Status.READY,
        )


class RasterScanPathTests(TestCase):
    def test_scan_only_checks_raster_original_directory(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            config = self._config(root)
            source_file = config.research_path("raster", "original", "source.tif")
            processed_file = config.research_path(
                "raster", "preprocessed", "processed.tif"
            )
            loose_file = config.research_path("raster", "loose.tif")
            source_file.write_bytes(b"not a real tif")
            processed_file.write_bytes(b"not a source tif")
            loose_file.write_bytes(b"not a source tif")

            with override_settings(PROJECT_CONFIG=config):
                with patch(
                    "apps.raster.services.importer.import_raster_file"
                ) as import_raster_file:
                    import_raster_file.side_effect = lambda path, progress=None: path

                    imported = scan_unprocessed_source_files()

            self.assertEqual(imported, [source_file])
            import_raster_file.assert_called_once()

    def _config(self, root: Path):
        config_path = root / "app.toml"
        business_root = root / "app"
        research_root = root / "research"
        config_path.write_text(
            f"""
[runtime]
debug = true
allowed_hosts = ["*"]
csrf_trusted_origins = []
waitress_host = "127.0.0.1"
waitress_port = 8000
waitress_threads = 1
disable_catalog_startup_scan = true
disable_raster_startup_scan = true

[application.system]
name = "测试系统"
allow_registration = true

[application.storage]
app_data = "{business_root}"
research_data_root = "{research_root}"

[application.map]
default_center = [80.0, 41.5]
default_zoom = 4.5
default_basemap = "osm"
mapbox_access_token = ""

[application.limits]
upload_max_mb = 512
query_result_limit = 30000

[application.raster]
symbolizer_timeout_seconds = 120
""",
            encoding="utf-8",
        )
        return load_project_config(
            config_path, program_root=Path("/opt/data-sharing-platform")
        )


def grant(user, *specs):
    for app_label, codename in specs:
        permission = Permission.objects.get(
            content_type__app_label=app_label, codename=codename
        )
        user.user_permissions.add(permission)
