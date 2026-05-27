import tempfile
from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase, TestCase

from apps.core.config import load_project_config
from apps.core.storage import (
    StoragePathError,
    geographic_path,
    raster_cache_path,
    raster_metadata_path,
    raster_output_path,
    raster_processed_path,
    raster_source_path,
)


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

    def test_raster_paths_are_under_raster_root(self):
        self.assertTrue(str(raster_source_path("a.tif")).endswith("/raster/original/a.tif"))
        self.assertTrue(str(raster_processed_path("a.cog.tif")).endswith("/raster/preprocessed/a.cog.tif"))
        self.assertTrue(str(raster_metadata_path("source/a.tif.gdalinfo.json")).endswith("/raster/metadata/source/a.tif.gdalinfo.json"))
        self.assertTrue(str(raster_output_path("tmp/a.png")).endswith("/raster/png/output/tmp/a.png"))
        self.assertTrue(str(raster_cache_path("a.png")).endswith("/raster/png/cache/a.png"))


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

            config = load_project_config(config_path, program_root=Path("/opt/data-sharing-platform"))

            self.assertTrue(config.business_path("database").is_dir())
            self.assertTrue(config.geographic_path("vector").is_dir())
            self.assertTrue(config.geographic_path("raster").is_dir())
            self.assertTrue(config.geographic_path("raster", "original").is_dir())
            self.assertTrue(config.geographic_path("raster", "preprocessed").is_dir())
            self.assertTrue(config.geographic_path("raster", "metadata", "source").is_dir())
            self.assertTrue(config.geographic_path("raster", "metadata", "preprocessed").is_dir())
            self.assertTrue(config.geographic_path("raster", "png", "cache").is_dir())
