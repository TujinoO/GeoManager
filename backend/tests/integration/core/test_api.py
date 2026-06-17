import json
import tempfile
from pathlib import Path

import tomlkit
from apps.audit.models import OperationLog
from apps.catalog.models import DataResource, DictionaryItem, MapLayer
from apps.core.config import (
    APP_SUBDIRS,
    RESEARCH_SUBDIRS,
    load_project_config,
    update_runtime_application_config,
)
from apps.core.initialization import (
    DEFAULT_USER_GROUP_NAME,
    GUEST_GROUP_NAME,
    SUPERADMIN_GROUP_NAME,
    ensure_guest_user,
    ensure_superadmin_defaults,
    protected_group_permissions,
    superadmin_group_locked_permissions,
)
from apps.core.models import SystemSetting, UserProfile
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
from data_sharing_platform.settings import _default_csrf_trusted_origins
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.test import Client, SimpleTestCase, TestCase


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


class LoginOverviewApiTests(TestCase):
    def test_login_overview_returns_public_platform_summary_without_auth(self):
        DataResource.objects.create(
            name="胡杨林分布矢量",
            code="poplar-vector",
            data_type=DataResource.DataType.VECTOR,
            spatial_extent="塔里木河流域",
            storage_path="private/vector.gpkg",
        )
        DataResource.objects.create(
            name="停用数据",
            code="inactive-resource",
            data_type=DataResource.DataType.TABLE,
            status=DataResource.Status.INACTIVE,
        )
        DictionaryItem.objects.create(
            dict_type=DictionaryItem.DictType.REGION,
            code="tarim",
            name="塔里木河流域",
        )
        MapLayer.objects.create(
            name="样方监测点",
            code="monitoring-sites",
            layer_type=MapLayer.LayerType.VECTOR,
            geometry_type=MapLayer.GeometryType.POINT,
            is_active=True,
            source_path="private-layer",
        )
        MapLayer.objects.create(
            name="停用点图层",
            code="inactive-points",
            layer_type=MapLayer.LayerType.VECTOR,
            geometry_type=MapLayer.GeometryType.POINT,
            is_active=False,
        )

        response = self.client.get("/api/login/overview/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(
            payload["platform"]["chineseName"],
            "中亚胡杨林生态系统保护数据共享平台",
        )
        self.assertEqual(payload["platform"]["version"], "v0.1.0")
        metrics = {item["id"]: item for item in payload["metrics"]}
        self.assertEqual(metrics["dataResources"]["value"], 1)
        self.assertEqual(metrics["thematicLayers"]["value"], 1)
        self.assertEqual(metrics["monitoringSites"]["value"], 1)
        self.assertEqual(metrics["coveredBasins"]["value"], 1)
        self.assertEqual(metrics["dataResources"]["displayValue"], "1")
        self.assertEqual(payload["serviceStatus"]["nodeSummary"]["total"], 24)
        self.assertEqual(payload["serviceStatus"]["nodeSummary"]["warning"], 0)
        encoded_payload = json.dumps(payload, ensure_ascii=False)
        self.assertNotIn("storage_path", encoded_payload)
        self.assertNotIn("private/vector.gpkg", encoded_payload)
        self.assertNotIn("private-layer", encoded_payload)

    def test_login_overview_reports_warning_when_catalog_is_empty(self):
        response = self.client.get("/api/login/overview/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        services = {
            service["id"]: service for service in payload["serviceStatus"]["services"]
        }
        self.assertEqual(services["resourceCatalog"]["status"], "warning")
        self.assertEqual(services["layerService"]["status"], "warning")
        self.assertEqual(payload["serviceStatus"]["nodeSummary"]["warning"], 2)


class CsrfSettingsTests(SimpleTestCase):
    def test_debug_defaults_trust_vite_dev_origins_with_wildcard_allowed_hosts(self):
        origins = _default_csrf_trusted_origins(["*"], debug=True)

        self.assertIn("http://127.0.0.1:5173", origins)
        self.assertIn("http://localhost:5173", origins)
        self.assertNotIn("http://*", origins)


class ApiJsonErrorTests(TestCase):
    def test_authenticated_api_returns_json_401_instead_of_login_redirect(self):
        response = self.client.get("/api/catalog/resources/")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertEqual(response.json()["detail"], "请先登录")

    def test_csrf_failure_returns_standard_json_error(self):
        client = Client(enforce_csrf_checks=True)

        response = client.post("/api/auth/logout/")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertEqual(response.json()["detail"], "CSRF 验证失败")


class RegistrationApiTests(TestCase):
    def test_login_writes_dashboard_compatible_audit_log(self):
        user = get_user_model().objects.create_user(
            username="login-user", password="pass12345"
        )

        response = self.client.post(
            "/api/auth/login/",
            data=json.dumps(
                {
                    "username": "login-user",
                    "password": "pass12345",
                    "remember": True,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()["user"]
        self.assertTrue(payload["isActive"])
        self.assertEqual(payload["directPermissions"], [])
        self.assertIn("effectivePermissions", payload)
        self.assertTrue(
            OperationLog.objects.filter(
                user=user,
                module="认证授权",
                action="用户登录",
                status="success",
            ).exists()
        )

    def test_auth_me_reports_upload_and_data_overview_permissions(self):
        user = get_user_model().objects.create_user(
            username="permission-flags-user", password="pass12345"
        )
        grant(user, ("core", "upload_data"), ("core", "view_data_overview"))
        self.client.force_login(user)

        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, 200)
        permissions = response.json()["user"]["permissions"]
        self.assertTrue(permissions["canUploadData"])
        self.assertTrue(permissions["canViewDataOverview"])

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
                permissions__codename="manage_auth",
            ).exists()
        )
        self.assertTrue(user.groups.filter(name=DEFAULT_USER_GROUP_NAME).exists())
        self.assertFalse(user.groups.filter(name=GUEST_GROUP_NAME).exists())

    def test_guest_login_creates_dedicated_guest_user_with_browse_permissions(self):
        response = self.client.post("/api/auth/guest-login/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()["user"]
        self.assertEqual(payload["username"], "guest")
        self.assertEqual(payload["displayName"], "游客")
        self.assertEqual(payload["roles"], [GUEST_GROUP_NAME])
        permissions = payload["permissions"]
        self.assertTrue(permissions["canBrowseData"])
        self.assertTrue(permissions["canQueryData"])
        self.assertTrue(permissions["canLoadVectorLayer"])
        self.assertTrue(permissions["canLoadRasterLayer"])
        self.assertFalse(permissions["canUploadData"])
        user = get_user_model().objects.get(username="guest")
        self.assertFalse(user.has_usable_password())
        self.assertTrue(user.groups.filter(name=GUEST_GROUP_NAME).exists())
        self.assertTrue(
            OperationLog.objects.filter(
                user=user,
                module="认证授权",
                action="游客登录",
                status="success",
            ).exists()
        )

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

        response = self.client.post(
            "/api/admin/profile/permissions/",
            data=json.dumps({"disabledPermissions": ["core.browse_data"]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["user"]["permissions"]["canBrowseData"])

        response = self.client.post(
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

        response = self.client.post(
            f"/api/groups/{group.id}/",
            data=json.dumps({"action": "delete"}),
            content_type="application/json",
        )

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

        response = self.client.post(
            f"/api/users/{target.id}/groups/",
            data=json.dumps({"groupIds": [protected_group.id]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "不能将普通用户加入超级管理员用户组",
        )

    def test_current_user_cannot_update_own_groups_from_auth_management(self):
        manager = get_user_model().objects.create_user(
            username="self-group-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"))
        group = Group.objects.create(name="科研用户")
        manager.groups.add(group)
        self.client.force_login(manager)

        response = self.client.post(
            f"/api/users/{manager.id}/groups/",
            data=json.dumps({"groupIds": [group.id]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "不能修改当前登录用户的用户组",
        )

    def test_superadmin_user_groups_cannot_be_updated_from_auth_management(self):
        manager = get_user_model().objects.create_user(
            username="superadmin-group-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"))
        superadmin, protected_group = ensure_superadmin_defaults()
        self.client.force_login(manager)

        response = self.client.post(
            f"/api/users/{superadmin.id}/groups/",
            data=json.dumps({"groupIds": [protected_group.id]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "不能修改超级管理员的用户组")

    def test_manage_auth_can_toggle_user_status(self):
        manager = get_user_model().objects.create_user(
            username="status-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"))
        target = get_user_model().objects.create_user(
            username="status-target",
            password="StrongPass12345",
        )
        self.client.force_login(manager)

        response = self.client.post(
            f"/api/users/{target.id}/",
            data=json.dumps({"isActive": False}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["isActive"])
        target.refresh_from_db()
        self.assertFalse(target.is_active)

    def test_manage_auth_can_delete_user(self):
        manager = get_user_model().objects.create_user(
            username="delete-user-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"))
        target = get_user_model().objects.create_user(
            username="delete-user-target",
            password="StrongPass12345",
        )
        target_id = target.id
        self.client.force_login(manager)

        response = self.client.post(
            f"/api/users/{target_id}/",
            data=json.dumps({"action": "delete"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(get_user_model().objects.filter(id=target_id).exists())

    def test_manage_auth_can_reset_user_password(self):
        manager = get_user_model().objects.create_user(
            username="reset-password-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"))
        target = get_user_model().objects.create_user(
            username="reset-password-target",
            password="OldPass12345",
        )
        self.client.force_login(manager)

        response = self.client.post(f"/api/users/{target.id}/password/reset/")

        self.assertEqual(response.status_code, 200)
        generated_password = response.json()["generatedPassword"]
        self.assertEqual(len(generated_password), 8)
        target.refresh_from_db()
        self.assertFalse(target.check_password("OldPass12345"))
        self.assertTrue(target.check_password(generated_password))

    def test_current_user_cannot_disable_or_delete_self(self):
        manager = get_user_model().objects.create_user(
            username="self-protect-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"))
        self.client.force_login(manager)

        disable_response = self.client.post(
            f"/api/users/{manager.id}/",
            data=json.dumps({"isActive": False}),
            content_type="application/json",
        )
        delete_response = self.client.post(
            f"/api/users/{manager.id}/",
            data=json.dumps({"action": "delete"}),
            content_type="application/json",
        )

        self.assertEqual(disable_response.status_code, 400)
        self.assertEqual(disable_response.json()["detail"], "不能停用当前登录用户")
        self.assertEqual(delete_response.status_code, 400)
        self.assertEqual(delete_response.json()["detail"], "不能删除当前登录用户")

    def test_current_user_cannot_reset_own_password(self):
        manager = get_user_model().objects.create_user(
            username="self-reset-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"))
        self.client.force_login(manager)

        response = self.client.post(f"/api/users/{manager.id}/password/reset/")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "不能重置当前登录用户密码")

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
        self.assertNotIn("core.access_admin", permission_ids)
        self.assertIn("core.manage_feature_permissions", permission_ids)
        self.assertIn("core.create_user", permission_ids)
        guest_items = [
            item for item in payload["items"] if item["name"] == GUEST_GROUP_NAME
        ]
        self.assertEqual(guest_items[0]["isProtected"], True)
        self.assertEqual(guest_items[0]["lockedPermissions"], [])
        default_user_items = [
            item for item in payload["items"] if item["name"] == DEFAULT_USER_GROUP_NAME
        ]
        self.assertEqual(default_user_items[0]["isProtected"], True)
        self.assertEqual(default_user_items[0]["lockedPermissions"], [])
        protected_items = [
            item for item in payload["items"] if item["name"] == SUPERADMIN_GROUP_NAME
        ]
        self.assertEqual(protected_items[0]["isProtected"], True)
        self.assertEqual(
            protected_items[0]["lockedPermissions"],
            sorted(superadmin_group_locked_permissions()),
        )

    def test_guest_group_permissions_can_be_updated(self):
        manager = get_user_model().objects.create_user(
            username="guest-permission-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "manage_feature_permissions"))
        ensure_superadmin_defaults(create_account=False)
        group = Group.objects.get(name=GUEST_GROUP_NAME)
        self.client.force_login(manager)

        response = self.client.post(
            f"/api/groups/{group.id}/",
            data=json.dumps({"permissions": ["core.query_data"]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["permissions"], ["core.query_data"])
        self.assertEqual(response.json()["lockedPermissions"], [])

    def test_guest_account_is_protected_from_admin_user_mutations(self):
        manager = get_user_model().objects.create_user(
            username="guest-account-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "manage_feature_permissions"))
        ensure_superadmin_defaults(create_account=False)
        guest = ensure_guest_user()
        normal_group = Group.objects.get(name=DEFAULT_USER_GROUP_NAME)
        self.client.force_login(manager)

        delete_response = self.client.post(
            f"/api/users/{guest.id}/",
            data=json.dumps({"action": "delete"}),
            content_type="application/json",
        )
        disable_response = self.client.post(
            f"/api/users/{guest.id}/",
            data=json.dumps({"isActive": False}),
            content_type="application/json",
        )
        reset_response = self.client.post(
            f"/api/users/{guest.id}/password/reset/",
        )
        groups_response = self.client.post(
            f"/api/users/{guest.id}/groups/",
            data=json.dumps({"groupIds": [normal_group.id]}),
            content_type="application/json",
        )
        permissions_response = self.client.post(
            f"/api/users/{guest.id}/permissions/",
            data=json.dumps({"directPermissions": ["core.upload_data"]}),
            content_type="application/json",
        )

        self.assertEqual(delete_response.status_code, 400)
        self.assertEqual(disable_response.status_code, 400)
        self.assertEqual(reset_response.status_code, 400)
        self.assertEqual(groups_response.status_code, 400)
        self.assertEqual(permissions_response.status_code, 400)
        guest.refresh_from_db()
        self.assertTrue(guest.is_active)
        self.assertFalse(guest.has_usable_password())
        self.assertEqual(
            list(guest.groups.values_list("name", flat=True)), [GUEST_GROUP_NAME]
        )
        self.assertEqual(guest.user_permissions.count(), 0)

    def test_superadmin_group_cannot_be_deleted_and_keeps_protected_permissions(self):
        manager = get_user_model().objects.create_user(
            username="superadmin-guard-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "manage_feature_permissions"))
        _, group = ensure_superadmin_defaults(create_account=False)
        self.client.force_login(manager)

        delete_response = self.client.post(
            f"/api/groups/{group.id}/",
            data=json.dumps({"action": "delete"}),
            content_type="application/json",
        )
        self.assertEqual(delete_response.status_code, 400)
        self.assertEqual(delete_response.json()["detail"], "系统内置用户组不能删除")

        missing_locked_response = self.client.post(
            f"/api/groups/{group.id}/",
            data=json.dumps({"permissions": ["core.browse_data"]}),
            content_type="application/json",
        )
        self.assertEqual(missing_locked_response.status_code, 400)
        self.assertEqual(
            missing_locked_response.json()["detail"],
            "超级管理员用户组必须保留系统锁定权限",
        )

        patch_response = self.client.post(
            f"/api/groups/{group.id}/",
            data=json.dumps(
                {"permissions": sorted(superadmin_group_locked_permissions())}
            ),
            content_type="application/json",
        )
        self.assertEqual(patch_response.status_code, 200)
        self.assertEqual(
            set(patch_response.json()["permissions"]),
            set(protected_group_permissions()),
        )

    def test_default_user_group_cannot_be_deleted_or_renamed_but_permissions_can_change(
        self,
    ):
        manager = get_user_model().objects.create_user(
            username="default-group-guard-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "manage_feature_permissions"))
        ensure_superadmin_defaults(create_account=False)
        group = Group.objects.get(name=DEFAULT_USER_GROUP_NAME)
        self.client.force_login(manager)

        delete_response = self.client.post(
            f"/api/groups/{group.id}/",
            data=json.dumps({"action": "delete"}),
            content_type="application/json",
        )
        self.assertEqual(delete_response.status_code, 400)
        self.assertEqual(delete_response.json()["detail"], "系统内置用户组不能删除")

        rename_response = self.client.post(
            f"/api/groups/{group.id}/",
            data=json.dumps({"name": "默认用户"}),
            content_type="application/json",
        )
        self.assertEqual(rename_response.status_code, 400)

        patch_response = self.client.post(
            f"/api/groups/{group.id}/",
            data=json.dumps({"permissions": ["core.query_data"]}),
            content_type="application/json",
        )
        self.assertEqual(patch_response.status_code, 200)
        self.assertEqual(patch_response.json()["permissions"], ["core.query_data"])

    def test_superadmin_user_groups_cannot_be_updated(self):
        manager = get_user_model().objects.create_user(
            username="superadmin-user-group-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "manage_feature_permissions"))
        protected_user, _ = ensure_superadmin_defaults()
        normal_group = Group.objects.create(name="普通后台组")
        self.client.force_login(manager)

        response = self.client.post(
            f"/api/users/{protected_user.id}/groups/",
            data=json.dumps({"groupIds": [normal_group.id]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "不能修改超级管理员的用户组")

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

        response = self.client.post(
            f"/api/users/{target.id}/groups/",
            data=json.dumps({"groupIds": []}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "用户组为必选项")

    def test_user_list_returns_direct_and_effective_permissions(self):
        manager = get_user_model().objects.create_user(
            username="user-permission-list-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "manage_feature_permissions"))
        group = Group.objects.create(name="科研用户")
        permission = Permission.objects.get(
            content_type__app_label="core", codename="browse_data"
        )
        group.permissions.add(permission)
        target = get_user_model().objects.create_user(
            username="direct-permission-target",
            password="StrongPass12345",
        )
        target.groups.add(group)
        grant(target, ("core", "query_data"))
        self.client.force_login(manager)

        response = self.client.get("/api/users/")

        self.assertEqual(response.status_code, 200)
        target_payload = next(
            item
            for item in response.json()["items"]
            if item["username"] == "direct-permission-target"
        )
        self.assertEqual(target_payload["directPermissions"], ["core.query_data"])
        self.assertEqual(target_payload["groupPermissions"], ["core.browse_data"])
        self.assertEqual(
            set(target_payload["effectivePermissions"]),
            {"core.browse_data", "core.query_data"},
        )

    def test_manage_feature_permissions_can_update_user_direct_permissions(self):
        manager = get_user_model().objects.create_user(
            username="user-permission-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "manage_feature_permissions"))
        target = get_user_model().objects.create_user(
            username="direct-permission-update-target",
            password="StrongPass12345",
        )
        self.client.force_login(manager)

        response = self.client.post(
            f"/api/users/{target.id}/permissions/",
            data=json.dumps({"directPermissions": ["core.query_data"]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["directPermissions"], ["core.query_data"])
        self.assertTrue(target.has_perm("core.query_data"))

    def test_current_user_cannot_update_own_permissions_from_auth_management(self):
        manager = get_user_model().objects.create_user(
            username="own-permission-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"), ("core", "manage_feature_permissions"))
        self.client.force_login(manager)

        response = self.client.post(
            f"/api/users/{manager.id}/permissions/",
            data=json.dumps({"directPermissions": ["core.query_data"]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "请到用户设置中修改自己的权限")

    def test_manage_auth_without_feature_permission_cannot_update_user_permissions(
        self,
    ):
        manager = get_user_model().objects.create_user(
            username="user-permission-blocked-manager", password="pass12345"
        )
        grant(manager, ("core", "manage_auth"))
        target = get_user_model().objects.create_user(
            username="direct-permission-blocked-target",
            password="StrongPass12345",
        )
        self.client.force_login(manager)

        response = self.client.post(
            f"/api/users/{target.id}/permissions/",
            data=json.dumps({"directPermissions": ["core.query_data"]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "当前用户无权限配置用户权限")

    def test_unknown_profile_permission_cannot_be_disabled(self):
        superuser = get_user_model().objects.create_superuser(
            username="protected-profile-superuser",
            password="StrongPass12345",
        )
        ensure_superadmin_defaults(create_account=False)
        self.client.force_login(superuser)

        response = self.client.post(
            "/api/admin/profile/permissions/",
            data=json.dumps({"disabledPermissions": ["core.access_admin"]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "不能关闭未授予的权限：core.access_admin",
        )

    def test_change_password_requires_current_password(self):
        user = get_user_model().objects.create_user(
            username="password-user",
            password="StrongPass12345",
        )
        self.client.force_login(user)

        response = self.client.post(
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

        response = self.client.post(
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

        response = self.client.post(
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
        grant(
            manager,
            ("core", "view_operation_logs"),
            ("core", "view_all_operation_logs"),
        )
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

    def test_admin_operation_logs_can_filter_by_user_id(self):
        manager = get_user_model().objects.create_user(
            username="log-user-id-manager", password="pass12345"
        )
        target = get_user_model().objects.create_user(
            username="log-user-id-target", password="pass12345"
        )
        other = get_user_model().objects.create_user(
            username="log-user-id-other", password="pass12345"
        )
        grant(
            manager,
            ("core", "view_operation_logs"),
            ("core", "view_all_operation_logs"),
        )
        OperationLog.objects.create(
            user=target,
            module="认证授权",
            action="重置用户密码",
            status="success",
            message="目标用户日志",
        )
        OperationLog.objects.create(
            user=other,
            module="认证授权",
            action="删除用户",
            status="success",
            message="其他用户日志",
        )
        self.client.force_login(manager)

        response = self.client.get("/api/admin/operation-logs/", {"userId": target.id})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["total"], 1)
        self.assertEqual(payload["items"][0]["summary"], "目标用户日志")

    def test_admin_operation_logs_own_scope_only_returns_current_user_logs(self):
        manager = get_user_model().objects.create_user(
            username="own-log-manager", password="pass12345"
        )
        other = get_user_model().objects.create_user(
            username="own-log-other", password="pass12345"
        )
        grant(
            manager,
            ("core", "view_operation_logs"),
            ("core", "view_own_operation_logs"),
        )
        OperationLog.objects.create(
            user=manager,
            module="系统设置",
            action="保存配置",
            status="success",
            message="自己的日志",
        )
        OperationLog.objects.create(
            user=other,
            module="系统设置",
            action="保存配置",
            status="success",
            message="其他用户日志",
        )
        self.client.force_login(manager)

        response = self.client.get("/api/admin/operation-logs/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["total"], 1)
        self.assertEqual(payload["items"][0]["summary"], "自己的日志")

        response = self.client.get("/api/admin/operation-logs/", {"userId": other.id})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 0)

    def test_admin_operation_logs_group_scope_uses_configured_groups(self):
        manager = get_user_model().objects.create_user(
            username="group-log-manager", password="pass12345"
        )
        target = get_user_model().objects.create_user(
            username="group-log-target", password="pass12345"
        )
        other = get_user_model().objects.create_user(
            username="group-log-other", password="pass12345"
        )
        target_group = Group.objects.create(name="日志目标组")
        other_group = Group.objects.create(name="其他日志组")
        target.groups.add(target_group)
        other.groups.add(other_group)
        UserProfile.objects.update_or_create(
            user=manager,
            defaults={"operation_log_group_ids": [target_group.id]},
        )
        grant(
            manager,
            ("core", "view_operation_logs"),
            ("core", "view_group_operation_logs"),
        )
        OperationLog.objects.create(
            user=target,
            module="数据管理",
            action="导入数据",
            status="success",
            message="目标组日志",
        )
        OperationLog.objects.create(
            user=other,
            module="数据管理",
            action="导入数据",
            status="success",
            message="其他组日志",
        )
        self.client.force_login(manager)

        response = self.client.get("/api/admin/operation-logs/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["total"], 1)
        self.assertEqual(payload["items"][0]["summary"], "目标组日志")

    def test_update_user_permissions_saves_operation_log_groups(self):
        manager = get_user_model().objects.create_user(
            username="log-scope-admin", password="pass12345"
        )
        target = get_user_model().objects.create_user(
            username="log-scope-target", password="pass12345"
        )
        log_group = Group.objects.create(name="可见日志组")
        grant(
            manager,
            ("core", "manage_auth"),
            ("core", "manage_feature_permissions"),
        )
        self.client.force_login(manager)

        response = self.client.post(
            f"/api/users/{target.id}/permissions/",
            data=json.dumps(
                {
                    "directPermissions": ["core.view_group_operation_logs"],
                    "operationLogGroupIds": [log_group.id],
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["operationLogGroupIds"], [log_group.id])
        self.assertIn("core.view_group_operation_logs", payload["directPermissions"])

    def test_admin_dashboard_counts_data_and_daily_active_users(self):
        manager = get_user_model().objects.create_user(
            username="dashboard-manager", password="pass12345"
        )
        active_user = get_user_model().objects.create_user(
            username="active-user", password="pass12345"
        )
        get_user_model().objects.create_user(
            username="disabled-user", password="pass12345", is_active=False
        )
        grant(
            manager,
            ("core", "view_dashboard_resource_card"),
            ("core", "view_dashboard_layer_card"),
            ("core", "view_dashboard_raster_card"),
            ("core", "view_dashboard_user_card"),
            ("core", "view_dashboard_active_users_card"),
        )
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
            module="认证授权",
            action="用户登录",
            status="success",
            message="登录成功",
        )
        OperationLog.objects.create(
            user=active_user,
            module="认证授权",
            action="用户登录",
            status="success",
            message="登录成功",
        )
        self.client.force_login(manager)

        response = self.client.get("/api/admin/dashboard/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["cards"]["resources"]["total"], 2)
        self.assertEqual(payload["cards"]["layers"]["total"], 1)
        self.assertEqual(payload["cards"]["rasters"]["resources"], 1)
        self.assertEqual(payload["cards"]["rasters"]["datasets"], 1)
        self.assertEqual(
            payload["cards"]["users"]["total"], get_user_model().objects.count()
        )
        self.assertEqual(
            payload["cards"]["users"]["active"],
            get_user_model().objects.filter(is_active=True).count(),
        )
        self.assertEqual(
            payload["cards"]["users"]["disabled"],
            get_user_model().objects.filter(is_active=False).count(),
        )
        self.assertEqual(payload["cards"]["users"]["groups"], Group.objects.count())
        self.assertEqual(payload["cards"]["activeUsers"]["period"], "day")
        self.assertEqual(payload["cards"]["activeUsers"]["count"], 1)
        self.assertEqual(payload["cards"]["activeUsers"]["loginCount"], 2)
        self.assertEqual(
            payload["cards"]["activeUsers"]["ranking"][0]["username"], "active-user"
        )
        self.assertEqual(len(payload["cards"]["activeUsers"]["series"]), 24)

    def test_admin_dashboard_data_overview_permission_and_superadmin_uploaders(
        self,
    ):
        manager = get_user_model().objects.create_user(
            username="overview-manager", password="pass12345"
        )
        uploader = get_user_model().objects.create_user(
            username="overview-uploader",
            first_name="上传人",
            password="pass12345",
        )
        grant(manager, ("core", "view_data_overview"))
        DataResource.objects.create(
            name="点位",
            code="overview-vector",
            data_type=DataResource.DataType.VECTOR,
            size_bytes=100,
            item_count=5,
            maintainer=uploader,
        )
        DataResource.objects.create(
            name="表格",
            code="overview-table",
            data_type=DataResource.DataType.TABLE,
            status=DataResource.Status.INACTIVE,
            size_bytes=50,
            item_count=2,
        )
        self.client.force_login(manager)

        response = self.client.get("/api/admin/dashboard/")

        self.assertEqual(response.status_code, 200)
        overview = response.json()["cards"]["dataOverview"]
        self.assertEqual(overview["totalResources"], 2)
        self.assertEqual(overview["activeResources"], 1)
        self.assertEqual(overview["totalSizeBytes"], 150)
        self.assertEqual(overview["totalItemCount"], 7)
        self.assertNotIn("uploaders", overview)

        super_group, _ = Group.objects.get_or_create(name=SUPERADMIN_GROUP_NAME)
        superadmin = get_user_model().objects.create_user(
            username="overview-superadmin", password="pass12345"
        )
        superadmin.groups.add(super_group)
        grant(superadmin, ("core", "view_data_overview"))
        self.client.force_login(superadmin)

        response = self.client.get("/api/admin/dashboard/")

        self.assertEqual(response.status_code, 200)
        uploaders = response.json()["cards"]["dataOverview"]["uploaders"]
        uploader_rows = {item["user"]["displayName"]: item for item in uploaders}
        self.assertEqual(uploader_rows["上传人"]["resourceCount"], 1)
        self.assertEqual(uploader_rows["上传人"]["sizeBytes"], 100)
        self.assertEqual(uploader_rows["未记录"]["itemCount"], 2)

    def test_admin_dashboard_omits_unauthorized_cards(self):
        manager = get_user_model().objects.create_user(
            username="resource-card-manager", password="pass12345"
        )
        grant(
            manager,
            ("core", "view_dashboard_resource_card"),
        )
        DataResource.objects.create(
            name="样地调查点位",
            code="sample-points",
            data_type=DataResource.DataType.VECTOR,
        )
        self.client.force_login(manager)

        response = self.client.get("/api/admin/dashboard/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["cards"]["resources"]["total"], 1)
        self.assertNotIn("layers", payload["cards"])
        self.assertNotIn("activeUsers", payload["cards"])

    def test_admin_dashboard_server_returns_monitor_snapshot(self):
        manager = get_user_model().objects.create_user(
            username="server-manager", password="pass12345"
        )
        grant(
            manager,
            ("core", "view_dashboard_system_card"),
        )
        self.client.force_login(manager)

        response = self.client.get("/api/admin/dashboard/server/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("cpu", payload["cards"])
        self.assertIn("memory", payload["cards"])
        self.assertIn("disks", payload["cards"])
        self.assertIn("usagePercent", payload["cards"]["cpu"])
        self.assertIn("totalBytes", payload["cards"]["memory"])
        self.assertIn("devices", payload["cards"]["disks"])

    def test_admin_dashboard_server_rejects_user_without_system_card_permission(self):
        manager = get_user_model().objects.create_user(
            username="system-card-limited-manager", password="pass12345"
        )
        self.client.force_login(manager)

        response = self.client.get("/api/admin/dashboard/server/")

        self.assertEqual(response.status_code, 403)


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


class ConfigLoaderTests(TestCase):
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

            for subdir in APP_SUBDIRS:
                with self.subTest(root="app", subdir=subdir):
                    self.assertTrue(config.app_path(subdir).is_dir())
            for subdir in RESEARCH_SUBDIRS:
                with self.subTest(root="research", subdir=subdir):
                    self.assertTrue(config.research_path(subdir).is_dir())

    def test_runtime_config_updates_are_written_to_source_config(self):
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

            # 验证源配置被直接修改
            updated_document = tomlkit.parse(config_path.read_text(encoding="utf-8"))
            self.assertEqual(
                updated_document["application"]["system"]["name"], "更新后的系统"
            )
            self.assertEqual(
                list(updated_document["application"]["map"]["default_center"]),
                [82.0, 42.0],
            )


def grant(user, *specs):
    for app_label, codename in specs:
        permission = Permission.objects.get(
            content_type__app_label=app_label, codename=codename
        )
        user.user_permissions.add(permission)
