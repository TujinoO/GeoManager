import json
import tempfile
from pathlib import Path
from zipfile import ZipFile

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase, override_settings

from apps.core.backup_service import start_backup_run
from apps.core.config import load_project_config
from apps.core.initialization import ensure_superadmin_defaults
from apps.core.models import BackupRun


class BackupPermissionApiTests(TestCase):
    def test_backup_api_requires_builtin_superadmin_even_with_permission(self):
        user = get_user_model().objects.create_user(
            username="backup-direct-user", password="pass12345"
        )
        grant(user, ("core", "manage_data_backup"))
        self.client.force_login(user)

        response = self.client.get("/api/admin/backups/overview/")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "数据备份仅限超级管理员使用")

        me_response = self.client.get("/api/auth/me/")
        self.assertFalse(
            me_response.json()["user"]["permissions"]["canManageDataBackup"]
        )


class BackupLocalRunTests(TestCase):
    def test_superadmin_can_save_local_plan_and_generate_backup_archive(self):
        superadmin, _group = ensure_superadmin_defaults()
        self.client.force_login(superadmin)

        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            config_path = root / "app.toml"
            config_path.write_text(
                minimal_config_text(root / "app", root / "research"),
                encoding="utf-8",
            )
            config = load_project_config(config_path, program_root=Path("/opt/app"))
            config.app_path("media", "note.txt").write_text(
                "backup me", encoding="utf-8"
            )

            with override_settings(
                PROJECT_CONFIG=config, PROGRAM_ROOT=Path("/opt/app")
            ):
                response = self.client.post(
                    "/api/admin/backups/settings/",
                    data=json.dumps(
                        {
                            "plans": {
                                "platform": {
                                    "enabled": True,
                                    "dailyAt": "03:00",
                                    "target": "local",
                                    "retentionCount": 2,
                                    "includeLogs": False,
                                },
                                "research": {
                                    "enabled": False,
                                    "dailyAt": "02:00",
                                    "target": "local",
                                    "retentionCount": 2,
                                    "includeLogs": False,
                                },
                            },
                            "local": {"directory": ""},
                        }
                    ),
                    content_type="application/json",
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    response.json()["plans"]["platform"]["target"], "local"
                )

                test_response = self.client.post(
                    "/api/admin/backups/targets/test/",
                    data=json.dumps({"targetType": "local"}),
                    content_type="application/json",
                )
                self.assertEqual(test_response.status_code, 200)
                self.assertEqual(test_response.json()["status"], "success")

                run = start_backup_run(
                    plan_type=BackupRun.PlanType.PLATFORM,
                    target_type=BackupRun.TargetType.LOCAL,
                    trigger=BackupRun.Trigger.MANUAL,
                    user=superadmin,
                    run_async=False,
                )

            run.refresh_from_db()
            self.assertEqual(run.status, BackupRun.Status.SUCCESS)
            self.assertTrue(Path(run.local_path).is_file())
            with ZipFile(run.local_path) as archive:
                names = archive.namelist()
                self.assertIn("manifest.json", names)
                self.assertIn("platform/media/note.txt", names)
                manifest = json.loads(archive.read("manifest.json").decode("utf-8"))
            self.assertEqual(manifest["planType"], "platform")
            self.assertGreaterEqual(manifest["fileCount"], 1)


def grant(user, *specs):
    for app_label, codename in specs:
        permission = Permission.objects.get(
            content_type__app_label=app_label, codename=codename
        )
        user.user_permissions.add(permission)


def minimal_config_text(business_root: Path, research_root: Path) -> str:
    business_text = business_root.as_posix()
    research_text = research_root.as_posix()
    return f"""
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
app_data = "{business_text}"
research_data_root = "{research_text}"

[application.map]
default_center = [80.0, 41.5]
default_zoom = 4.5
default_basemap = "osm"
mapbox_access_token = ""

[application.limits]
upload_max_mb = 512
query_result_limit = 30000
max_raster_side_pixels = 10000

[application.raster]
symbolizer_timeout_seconds = 120
"""
