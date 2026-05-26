import tempfile
from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase, TestCase

from apps.core.config import load_project_config
from apps.core.storage import StoragePathError, geographic_path


class BootstrapApiTests(TestCase):
    def test_bootstrap_returns_public_runtime_settings(self):
        response = self.client.get("/api/bootstrap/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("systemName", payload)
        self.assertIn("map", payload)
        self.assertEqual(payload["map"]["mapboxAccessToken"], settings.PROJECT_CONFIG.map.mapbox_access_token)


class StoragePathTests(SimpleTestCase):
    def test_geographic_path_rejects_parent_traversal(self):
        with self.assertRaises(StoragePathError):
            geographic_path("vector", "../secret.gpkg")


class ConfigLoaderTests(SimpleTestCase):
    def test_loader_creates_fixed_data_subdirectories(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
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
png_cache_max_mb = 512
cache_cleanup_policy = "least_recently_used"
symbolizer_timeout_seconds = 120
default_symbolizer_script = "scripts/raster_symbolizers/basic_gradient.py"
""",
                encoding="utf-8",
            )

            config = load_project_config(config_path, program_root=Path("/opt/huyang-program"))

            self.assertTrue(config.business_path("database").is_dir())
            self.assertTrue(config.geographic_path("vector").is_dir())
            self.assertTrue(config.geographic_path("png", "cache").is_dir())
