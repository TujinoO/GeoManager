import json
import tempfile
from pathlib import Path

import tomlkit
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.test import SimpleTestCase, TestCase
from data_sharing_platform.settings import _default_csrf_trusted_origins

from apps.audit.models import OperationLog
from apps.catalog.models import DataResource, MapLayer
from apps.core.config import (
    ensure_runtime_config_file,
    load_project_config,
    update_runtime_application_config,
)
from apps.core.initialization import (
    GUEST_GROUP_NAME,
    SUPERADMIN_GROUP_NAME,
    ensure_superadmin_defaults,
)
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
from apps.raster.models import RasterDataset


class BootstrapApiTests(TestCase):
    def test_bootstrap_returns_public_runtime_settings(self):
        SystemSetting.objects.update_or_create(
            pk=1, defaults={"allow_registration": False}
        )

        response = self.client.get("/api/bootstrap/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("systemName", payload)
        self.assertFalse(payload["allowRegistration"])
        self.assertIn("map", payload)


class CsrfSettingsTests(SimpleTestCase):
    def test_debug_defaults_trust_vite_dev_origins_with_wildcard_allowed_hosts(self):
        origins = _default_csrf_trusted_origins(["*"], debug=True)

        self.assertIn("http://127.0.0.1:5173", origins)
        self.assertIn("http://localhost:5173", origins)
        self.assertNotIn("http://*", origins)


class RegistrationApiTests(TestCase):
    def test_registered_user_after_initialization_is_standard_user(self):
        SystemSetting.objects.update_or_create(
            pk=1, defaults={"allow_registration": True}
        )
        ensure_superadmin_defaults()

        response = self.client.post(
            "/api/auth/register/",
            data=json.dumps(
                {
                    "username": "researcher",
                    "email": "researcher@example.local",
                    "password": "123456",
                    "passwordConfirm": "123456",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        user = get_user_model().objects.get(username="researcher")
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(
            Group.objects.filter(
                name=SUPERADMIN_GROUP_NAME,
                permissions__codename="access_admin",
            ).exists()
        )
        self.assertTrue(user.groups.filter(name=GUEST_GROUP_NAME).exists())

    def test_registration_can_be_closed_by_system_setting(self):
        SystemSetting.objects.update_or_create(
            pk=1, defaults={"allow_registration": False}
        )

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
    def test_legacy_django_admin_route_is_removed(self):
        response = self.client.get("/admin2/")

        self.assertEqual(response.status_code, 404)

    def test_user_can_disable_only_granted_feature_permissions(self):
        user = get_user_model().objects.create_user(
            username="toggle-user", password="pass12345"
        )
        grant(user, ("core", "browse_data"))
        self.client.force_login(user)

        response = self.client.patch(
            "/api/admin/profile/permissions/",
            data=json.dumps({"disabledPermissions": ["core.browse_data"]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["user"]["permissions"]["canBrowseData"])

        response = self.client.patch(
            "/api/admin/profile/permissions/",
            data=json.dumps({"disabledPermissions": ["core.query_data"]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("不能关闭未授予的权限", response.json()["detail"])

    def test_group_delete_requires_empty_group(self):
        manager = get_user_model().objects.create_user(
            username="group-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "manage_feature_permissions"))
        group = Group.objects.create(name="待删除用户组")
        user = get_user_model().objects.create_user(
            username="group-member", password="pass12345"
        )
        user.groups.add(group)
        self.client.force_login(manager)

        response = self.client.delete(f"/api/groups/{group.id}/")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "用户组仍有关联用户，不能删除")

    def test_create_user_permission_can_create_user_when_registration_is_closed(self):
        SystemSetting.objects.update_or_create(
            pk=1, defaults={"allow_registration": False}
        )
        manager = get_user_model().objects.create_user(
            username="user-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "create_user"))
        group = Group.objects.create(name="科研用户")
        self.client.force_login(manager)

        response = self.client.post(
            "/api/users/",
            data=json.dumps(
                {
                    "username": "created-by-admin",
                    "password": "StrongPass12345",
                    "displayName": "后台创建用户",
                    "email": "created@example.local",
                    "department": "生态监测组",
                    "groupIds": [group.id],
                    "isActive": True,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        user = get_user_model().objects.get(username="created-by-admin")
        self.assertEqual(user.email, "created@example.local")
        self.assertEqual(user.profile.department, "生态监测组")
        self.assertTrue(user.groups.filter(id=group.id).exists())

    def test_create_user_requires_group(self):
        manager = get_user_model().objects.create_user(
            username="user-manager-empty-group", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "create_user"))
        self.client.force_login(manager)

        response = self.client.post(
            "/api/users/",
            data=json.dumps(
                {
                    "username": "created-without-group",
                    "displayName": "无组用户",
                    "groupIds": [],
                    "isActive": True,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "用户组为必选项")

    def test_manage_feature_permissions_without_create_user_cannot_create_user(self):
        manager = get_user_model().objects.create_user(
            username="permission-only-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "manage_feature_permissions"))
        self.client.force_login(manager)

        response = self.client.post(
            "/api/users/",
            data=json.dumps(
                {
                    "username": "blocked-create",
                    "password": "StrongPass12345",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "当前用户无新建用户权限")

    def test_create_user_permission_can_list_groups_for_assignment(self):
        manager = get_user_model().objects.create_user(
            username="create-user-lister", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "create_user"))
        self.client.force_login(manager)

        response = self.client.get("/api/groups/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.json())

    def test_create_user_cannot_assign_superadmin_group(self):
        manager = get_user_model().objects.create_user(
            username="create-user-protected-group", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "create_user"))
        _, protected_group = ensure_superadmin_defaults(create_account=False)
        self.client.force_login(manager)

        response = self.client.post(
            "/api/users/",
            data=json.dumps(
                {
                    "username": "blocked-protected-group",
                    "password": "StrongPass12345",
                    "groupIds": [protected_group.id],
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "不能将普通用户加入超级管理员用户组",
        )

    def test_regular_user_cannot_be_assigned_to_superadmin_group(self):
        manager = get_user_model().objects.create_user(
            username="assign-protected-group-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "manage_feature_permissions"))
        target = get_user_model().objects.create_user(
            username="regular-protected-target",
            password="StrongPass12345",
        )
        _, protected_group = ensure_superadmin_defaults(create_account=False)
        self.client.force_login(manager)

        response = self.client.patch(
            f"/api/users/{target.id}/groups/",
            data=json.dumps({"groupIds": [protected_group.id]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "不能将普通用户加入超级管理员用户组",
        )

    def test_group_list_returns_available_feature_permissions(self):
        manager = get_user_model().objects.create_user(
            username="permission-list-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "manage_feature_permissions"))
        self.client.force_login(manager)

        response = self.client.get("/api/groups/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        permission_ids = {
            permission["id"] for permission in payload["availablePermissions"]
        }
        self.assertIn("core.access_admin", permission_ids)
        self.assertIn("core.manage_feature_permissions", permission_ids)
        self.assertIn("core.create_user", permission_ids)
        guest_items = [
            item for item in payload["items"] if item["name"] == GUEST_GROUP_NAME
        ]
        self.assertEqual(guest_items[0]["isProtected"], True)
        self.assertEqual(
            set(guest_items[0]["lockedPermissions"]),
            {"core.browse_data", "core.load_vector_layer", "core.load_raster_layer"},
        )
        protected_items = [
            item for item in payload["items"] if item["name"] == SUPERADMIN_GROUP_NAME
        ]
        self.assertEqual(protected_items[0]["isProtected"], True)
        self.assertEqual(protected_items[0]["lockedPermissions"], ["core.access_admin"])

    def test_superadmin_group_cannot_be_deleted_or_lose_admin_access(self):
        manager = get_user_model().objects.create_user(
            username="superadmin-guard-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "manage_feature_permissions"))
        _, group = ensure_superadmin_defaults(create_account=False)
        self.client.force_login(manager)

        delete_response = self.client.delete(f"/api/groups/{group.id}/")
        self.assertEqual(delete_response.status_code, 400)
        self.assertEqual(delete_response.json()["detail"], "系统内置用户组不能删除")

        patch_response = self.client.patch(
            f"/api/groups/{group.id}/",
            data=json.dumps({"permissions": ["core.browse_data"]}),
            content_type="application/json",
        )
        self.assertEqual(patch_response.status_code, 400)
        self.assertEqual(
            patch_response.json()["detail"],
            "超级管理员用户组必须保留后台访问权限",
        )

    def test_superadmin_user_keeps_superadmin_group_when_groups_are_updated(self):
        manager = get_user_model().objects.create_user(
            username="superadmin-user-group-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "manage_feature_permissions"))
        protected_user, protected_group = ensure_superadmin_defaults()
        normal_group = Group.objects.create(name="普通后台组")
        self.client.force_login(manager)

        response = self.client.patch(
            f"/api/users/{protected_user.id}/groups/",
            data=json.dumps({"groupIds": [normal_group.id]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn(protected_group.id, response.json()["groupIds"])

    def test_regular_user_cannot_be_left_without_group(self):
        manager = get_user_model().objects.create_user(
            username="empty-group-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "manage_feature_permissions"))
        target = get_user_model().objects.create_user(
            username="empty-group-target",
            password="StrongPass12345",
        )
        self.client.force_login(manager)

        response = self.client.patch(
            f"/api/users/{target.id}/groups/",
            data=json.dumps({"groupIds": []}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "用户组为必选项")

    def test_superadmin_cannot_disable_own_admin_access_permission(self):
        superuser = get_user_model().objects.create_superuser(
            username="protected-profile-superuser",
            password="StrongPass12345",
        )
        ensure_superadmin_defaults(create_account=False)
        self.client.force_login(superuser)

        response = self.client.patch(
            "/api/admin/profile/permissions/",
            data=json.dumps({"disabledPermissions": ["core.access_admin"]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "超级管理员不能关闭后台访问权限")

    def test_change_password_requires_current_password(self):
        user = get_user_model().objects.create_user(
            username="password-user",
            password="StrongPass12345",
        )
        self.client.force_login(user)

        response = self.client.patch(
            "/api/admin/profile/password/",
            data=json.dumps(
                {
                    "currentPassword": "wrong-password",
                    "newPassword": "NewStrong12345",
                    "passwordConfirm": "NewStrong12345",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "当前密码不正确")
        self.assertTrue(
            OperationLog.objects.filter(
                user=user,
                module="认证授权",
                action="修改密码",
                status="failed",
            ).exists()
        )

    def test_change_password_rejects_weak_password(self):
        user = get_user_model().objects.create_user(
            username="weak-password-user",
            password="StrongPass12345",
        )
        self.client.force_login(user)

        response = self.client.patch(
            "/api/admin/profile/password/",
            data=json.dumps(
                {
                    "currentPassword": "StrongPass12345",
                    "newPassword": "weak5",
                    "passwordConfirm": "weak5",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("密码长度至少 6 位", response.json()["detail"])

    def test_change_password_updates_password_and_logs_success(self):
        user = get_user_model().objects.create_user(
            username="change-password-user",
            password="StrongPass12345",
        )
        self.client.force_login(user)

        response = self.client.patch(
            "/api/admin/profile/password/",
            data=json.dumps(
                {
                    "currentPassword": "StrongPass12345",
                    "newPassword": "NewStrong12345",
                    "passwordConfirm": "NewStrong12345",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertFalse(user.check_password("StrongPass12345"))
        self.assertTrue(user.check_password("NewStrong12345"))
        self.assertTrue(
            OperationLog.objects.filter(
                user=user,
                module="认证授权",
                action="修改密码",
                status="success",
            ).exists()
        )

    def test_admin_operation_logs_query_uses_real_audit_logs(self):
        manager = get_user_model().objects.create_user(
            username="log-manager", password="pass12345"
        )
        grant(manager, ("core", "view_operation_logs"))
        OperationLog.objects.create(
            user=manager,
            module="系统设置",
            action="保存配置",
            status="success",
            message="写入运行配置",
        )
        OperationLog.objects.create(
            user=manager,
            module="认证授权",
            action="创建用户",
            status="failed",
            message="用户名重复",
        )
        self.client.force_login(manager)

        response = self.client.get(
            "/api/admin/operation-logs/",
            {"module": "系统设置", "result": "success"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["total"], 1)
        self.assertEqual(payload["items"][0]["action"], "保存配置")

    def test_admin_dashboard_counts_data_and_daily_active_users(self):
        manager = get_user_model().objects.create_user(
            username="dashboard-manager", password="pass12345"
        )
        active_user = get_user_model().objects.create_user(
            username="active-user", password="pass12345"
        )
        grant(manager, ("core", "access_admin"))
        raster_resource = DataResource.objects.create(
            name="胡杨林分布栅格",
            code="poplar-raster",
            data_type=DataResource.DataType.RASTER,
        )
        DataResource.objects.create(
            name="样地调查点位",
            code="sample-points",
            data_type=DataResource.DataType.VECTOR,
        )
        raster_layer = MapLayer.objects.create(
            name="胡杨林分布栅格",
            code="poplar-raster-layer",
            layer_type=MapLayer.LayerType.RASTER,
            data_resource=raster_resource,
        )
        RasterDataset.objects.create(
            name="胡杨林分布栅格",
            code="poplar-raster-dataset",
            source_relative_path="raster/original/poplar.tif",
            data_resource=raster_resource,
            map_layer=raster_layer,
        )
        OperationLog.objects.create(
            user=active_user,
            module="auth",
            action="login",
            status="success",
            message="登录成功",
        )
        OperationLog.objects.create(
            user=active_user,
            module="auth",
            action="login",
            status="success",
            message="登录成功",
        )
        self.client.force_login(manager)

        response = self.client.get("/api/admin/dashboard/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["dataCounts"]["resources"], 2)
        self.assertEqual(payload["dataCounts"]["layers"], 1)
        self.assertEqual(payload["dataCounts"]["rasterResources"], 1)
        self.assertEqual(payload["dataCounts"]["rasterDatasets"], 1)
        self.assertEqual(payload["activeUsers"]["period"], "day")
        self.assertEqual(payload["activeUsers"]["count"], 1)
        self.assertEqual(payload["activeUsers"]["loginCount"], 2)
        self.assertEqual(
            payload["activeUsers"]["ranking"][0]["username"], "active-user"
        )
        self.assertEqual(len(payload["activeUsers"]["series"]), 24)

    def test_admin_dashboard_server_returns_monitor_snapshot(self):
        manager = get_user_model().objects.create_user(
            username="server-manager", password="pass12345"
        )
        grant(manager, ("core", "access_admin"))
        self.client.force_login(manager)

        response = self.client.get("/api/admin/dashboard/server/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("cpu", payload)
        self.assertIn("memory", payload)
        self.assertIn("disks", payload)
        self.assertIn("usagePercent", payload["cpu"])
        self.assertIn("totalBytes", payload["memory"])
        self.assertIn("devices", payload["disks"])


class StoragePathTests(SimpleTestCase):
    def test_research_path_rejects_parent_traversal(self):
        with self.assertRaises(StoragePathError):
            research_path("vector", "../secret.gpkg")
        with self.assertRaises(StoragePathError):
            research_path("gene", "../secret.fasta")

    def test_raster_paths_are_under_raster_root(self):
        self.assertTrue(
            str(raster_source_path("a.tif")).endswith("/raster/original/a.tif")
        )
        self.assertTrue(
            str(raster_processed_path("a.cog.tif")).endswith(
                "/raster/preprocessed/a.cog.tif"
            )
        )
        self.assertTrue(
            str(raster_metadata_path("source/a.tif.gdalinfo.json")).endswith(
                "/raster/metadata/source/a.tif.gdalinfo.json"
            )
        )

    def test_gene_and_table_paths_are_under_fixed_subdirectories(self):
        self.assertTrue(
            str(gene_data_path("sample.fasta")).endswith("/gene/sample.fasta")
        )
        self.assertTrue(
            str(table_data_path("survey.csv")).endswith("/table/survey.csv")
        )


class ConfigLoaderTests(SimpleTestCase):
    def test_loader_creates_fixed_data_subdirectories(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            config_path = root / "app.toml"
            business_root = root / "app"
            research_root = root / "research"
            config_path.write_text(
                f"""
[runtime]
debug = true
allowed_hosts = ["*"]
csrf_trusted_origins = []
gunicorn_bind = "127.0.0.1:8000"
gunicorn_workers = 1
http_port = 8000
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
mapbox_access_token = "pk.test-token"

[application.limits]
upload_max_mb = 512
query_result_limit = 30000

[application.raster]
symbolizer_timeout_seconds = 120
""",
                encoding="utf-8",
            )

            config = load_project_config(
                config_path, program_root=Path("/opt/data-sharing-platform")
            )

            self.assertTrue(config.app_path("database").is_dir())
            self.assertTrue(config.research_path("vector").is_dir())
            self.assertTrue(config.research_path("raster").is_dir())
            self.assertTrue(config.research_path("raster", "original").is_dir())
            self.assertTrue(config.research_path("raster", "preprocessed").is_dir())
            self.assertTrue(
                config.research_path("raster", "metadata", "source").is_dir()
            )
            self.assertTrue(
                config.research_path("raster", "metadata", "preprocessed").is_dir()
            )
            self.assertTrue(config.research_path("gene").is_dir())
            self.assertTrue(config.research_path("table").is_dir())

    def test_migration_helper_copies_source_config_to_appdata_runtime_config(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            config_path = root / "app.toml"
            business_root = root / "app"
            research_root = root / "research"
            config_path.write_text(
                f"""
[runtime]
debug = true
allowed_hosts = ["*"]
csrf_trusted_origins = []
gunicorn_bind = "127.0.0.1:8000"
gunicorn_workers = 1
http_port = 8000
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

            config = load_project_config(
                config_path, program_root=Path("/opt/data-sharing-platform")
            )
            copied = ensure_runtime_config_file(config)

            self.assertTrue(copied)
            self.assertEqual(
                config.runtime_config_path.read_text(), config_path.read_text()
            )

    def test_runtime_config_updates_are_written_with_tomlkit(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            config_path = root / "app.toml"
            business_root = root / "app"
            research_root = root / "research"
            config_path.write_text(
                f"""
[runtime]
debug = true
allowed_hosts = ["*"]
csrf_trusted_origins = []
gunicorn_bind = "127.0.0.1:8000"
gunicorn_workers = 1
http_port = 8000
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

            config = load_project_config(
                config_path, program_root=Path("/opt/data-sharing-platform")
            )
            update_runtime_application_config(
                config,
                {
                    "system": {"name": "更新后的系统"},
                    "map": {"default_center": [82.0, 42.0]},
                },
            )

            runtime_document = tomlkit.parse(
                config.runtime_config_path.read_text(encoding="utf-8")
            )
            source_document = tomlkit.parse(config_path.read_text(encoding="utf-8"))
            self.assertEqual(
                runtime_document["application"]["system"]["name"], "更新后的系统"
            )
            self.assertEqual(
                list(runtime_document["application"]["map"]["default_center"]),
                [82.0, 42.0],
            )
            self.assertEqual(
                source_document["application"]["system"]["name"], "测试系统"
            )


def grant(user, *specs):
    for app_label, codename in specs:
        permission = Permission.objects.get(
            content_type__app_label=app_label, codename=codename
        )
        user.user_permissions.add(permission)
