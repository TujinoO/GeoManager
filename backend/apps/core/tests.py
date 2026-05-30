import json
import tempfile
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.test import SimpleTestCase, TestCase

from apps.core.admin import FeatureGroupForm
from apps.core.config import load_project_config
from apps.core.models import SystemSetting
from apps.core.storage import (
    StoragePathError,
    gene_data_path,
    raster_metadata_path,
    raster_processed_path,
    raster_source_path,
    research_path,
    table_data_path,
)


class BootstrapApiTests(TestCase):
    def test_bootstrap_returns_public_runtime_settings(self):
        SystemSetting.objects.update_or_create(pk=1, defaults={"allow_registration": False})

        response = self.client.get("/api/bootstrap/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("systemName", payload)
        self.assertFalse(payload["allowRegistration"])
        self.assertIn("map", payload)


class RegistrationApiTests(TestCase):
    def test_first_registered_user_becomes_system_admin(self):
        SystemSetting.objects.update_or_create(pk=1, defaults={"allow_registration": True})

        response = self.client.post(
            "/api/auth/register/",
            data=json.dumps(
                {
                    "username": "admin",
                    "email": "admin@example.local",
                    "password": "StrongPass12345",
                    "passwordConfirm": "StrongPass12345",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        user = get_user_model().objects.get(username="admin")
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)

    def test_registration_can_be_closed_by_system_setting(self):
        SystemSetting.objects.update_or_create(pk=1, defaults={"allow_registration": False})

        response = self.client.post(
            "/api/auth/register/",
            data=json.dumps(
                {
                    "username": "closed",
                    "password": "StrongPass12345",
                    "passwordConfirm": "StrongPass12345",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)


class FeaturePermissionTests(TestCase):
    def test_admin_requires_access_admin_permission_not_staff_flag(self):
        user = get_user_model().objects.create_user(username="staff-no-access", password="pass12345", is_staff=True)
        group = Group.objects.create(name="普通用户")
        user.groups.add(group)
        self.client.force_login(user)

        response = self.client.get("/admin/")

        self.assertEqual(response.status_code, 403)
        self.assertIn("当前用户组“普通用户”无权限", response.content.decode("utf-8"))

    def test_access_admin_permission_allows_non_staff_admin_entry(self):
        user = get_user_model().objects.create_user(username="admin-access", password="pass12345", is_staff=False)
        grant(user, ("core", "access_admin"))
        self.client.force_login(user)

        response = self.client.get("/admin/")

        self.assertEqual(response.status_code, 200)

    def test_feature_group_form_preserves_non_feature_permissions(self):
        group = Group.objects.create(name="科研用户")
        add_user = Permission.objects.get(content_type__app_label="auth", codename="add_user")
        browse_data = Permission.objects.get(content_type__app_label="core", codename="browse_data")
        group.permissions.add(add_user)
        form = FeatureGroupForm(
            data={"name": group.name, "feature_permissions": [browse_data.id]},
            instance=group,
        )

        self.assertTrue(form.is_valid(), form.errors)
        form.save()

        group.refresh_from_db()
        self.assertTrue(group.permissions.filter(id=add_user.id).exists())
        self.assertTrue(group.permissions.filter(id=browse_data.id).exists())


class StoragePathTests(SimpleTestCase):
    def test_research_path_rejects_parent_traversal(self):
        with self.assertRaises(StoragePathError):
            research_path("vector", "../secret.gpkg")
        with self.assertRaises(StoragePathError):
            research_path("gene", "../secret.fasta")

    def test_raster_paths_are_under_raster_root(self):
        self.assertTrue(str(raster_source_path("a.tif")).endswith("/raster/original/a.tif"))
        self.assertTrue(str(raster_processed_path("a.cog.tif")).endswith("/raster/preprocessed/a.cog.tif"))
        self.assertTrue(str(raster_metadata_path("source/a.tif.gdalinfo.json")).endswith("/raster/metadata/source/a.tif.gdalinfo.json"))

    def test_gene_and_table_paths_are_under_fixed_subdirectories(self):
        self.assertTrue(str(gene_data_path("sample.fasta")).endswith("/gene/sample.fasta"))
        self.assertTrue(str(table_data_path("survey.csv")).endswith("/table/survey.csv"))


class ConfigLoaderTests(SimpleTestCase):
    def test_loader_creates_fixed_data_subdirectories(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            config_path = root / "app.toml"
            business_root = root / "app"
            research_root = root / "research"
            config_path.write_text(
                f"""
[system]
name = "测试系统"
mode = "development"
allow_registration = true

[storage]
app_data = "{business_root}"
research_data_root = "{research_root}"
auto_create_directories = true

[map]
default_center = [80.0, 41.5]
default_zoom = 4.5
default_basemap = "osm"

[limits]
upload_max_mb = 512
query_result_limit = 30000

[raster]
symbolizer_timeout_seconds = 120
default_symbolizer_script = "scripts/raster_symbolizers/basic_gradient.py"
""",
                encoding="utf-8",
            )

            config = load_project_config(config_path, program_root=Path("/opt/data-sharing-platform"))

            self.assertTrue(config.app_path("database").is_dir())
            self.assertTrue(config.research_path("vector").is_dir())
            self.assertTrue(config.research_path("raster").is_dir())
            self.assertTrue(config.research_path("raster", "original").is_dir())
            self.assertTrue(config.research_path("raster", "preprocessed").is_dir())
            self.assertTrue(config.research_path("raster", "metadata", "source").is_dir())
            self.assertTrue(config.research_path("raster", "metadata", "preprocessed").is_dir())
            self.assertTrue(config.research_path("gene").is_dir())
            self.assertTrue(config.research_path("table").is_dir())


def grant(user, *specs):
    for app_label, codename in specs:
        permission = Permission.objects.get(content_type__app_label=app_label, codename=codename)
        user.user_permissions.add(permission)
