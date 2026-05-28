import tempfile
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase, override_settings

from apps.core.config import load_project_config
from apps.raster.services import scan_unprocessed_source_files


class RasterPermissionApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="raster-user", password="pass12345")
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


class RasterScanPathTests(TestCase):
    def test_scan_only_checks_raster_original_directory(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            config = self._config(root)
            source_file = config.geographic_path("raster", "original", "source.tif")
            processed_file = config.geographic_path("raster", "preprocessed", "processed.tif")
            loose_file = config.geographic_path("raster", "loose.tif")
            source_file.write_bytes(b"not a real tif")
            processed_file.write_bytes(b"not a source tif")
            loose_file.write_bytes(b"not a source tif")

            with override_settings(PROJECT_CONFIG=config):
                with patch("apps.raster.services.importer.import_raster_file") as import_raster_file:
                    import_raster_file.side_effect = lambda path, progress=None: path

                    imported = scan_unprocessed_source_files()

            self.assertEqual(imported, [source_file])
            import_raster_file.assert_called_once()

    def _config(self, root: Path):
        config_path = root / "app.toml"
        business_root = root / "business"
        geographic_root = root / "geo"
        config_path.write_text(
            f"""
[system]
name = "测试系统"
mode = "development"
allow_registration = false

[storage]
business_data_root = "{business_root}"
geographic_data_root = "{geographic_root}"
auto_create_directories = true

[map]
default_center = [80.0, 41.5]
default_zoom = 4.5
default_basemap = "osm"
mapbox_access_token = "pk.test-token"

[limits]
upload_max_mb = 512
query_result_limit = 30000

[raster]
symbolizer_timeout_seconds = 120
default_symbolizer_script = "scripts/raster_symbolizers/basic_gradient.py"
""",
            encoding="utf-8",
        )
        return load_project_config(config_path, program_root=Path("/opt/data-sharing-platform"))


def grant(user, *specs):
    for app_label, codename in specs:
        permission = Permission.objects.get(content_type__app_label=app_label, codename=codename)
        user.user_permissions.add(permission)
