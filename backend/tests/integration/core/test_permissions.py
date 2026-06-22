from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.test import TestCase

from apps.core.initialization import (
    DEFAULT_USER_GROUP_NAME,
    GUEST_GROUP_NAME,
    SUPERADMIN_GROUP_NAME,
    default_user_group_permissions,
    ensure_superadmin_defaults,
    guest_group_permissions,
    is_superadmin_user,
    protected_group_permissions,
)
from apps.core.models import UserProfile
from apps.core.permissions import (
    FEATURE_PERMISSIONS,
    FEATURE_PERMISSION_NAMES,
    FeaturePermissionDef,
    ensure_feature_permissions,
    feature_denied_response,
    feature_permission_ids_for,
    feature_permission_queryset,
    group_names,
    has_feature_perm,
    permission_denied_message,
)


class FeaturePermissionDefTests(TestCase):
    def test_perm_name_format(self):
        perm = FeaturePermissionDef(
            "core", "FeaturePermission", "query_data", "查询数据", "数据权限"
        )
        self.assertEqual(perm.perm_name, "core.query_data")

    def test_feature_permissions_not_empty(self):
        self.assertGreater(len(FEATURE_PERMISSIONS), 0)

    def test_all_permissions_have_required_fields(self):
        for perm in FEATURE_PERMISSIONS:
            self.assertTrue(perm.app_label)
            self.assertTrue(perm.model_name)
            self.assertTrue(perm.codename)
            self.assertTrue(perm.name)
            self.assertTrue(perm.group)

    def test_feature_permission_names_tuple(self):
        self.assertEqual(len(FEATURE_PERMISSION_NAMES), len(FEATURE_PERMISSIONS))
        for name in FEATURE_PERMISSION_NAMES:
            self.assertIn(".", name)

    def test_create_user_permission_is_registered(self):
        self.assertIn("core.create_user", FEATURE_PERMISSION_NAMES)
        self.assertTrue(
            Permission.objects.filter(
                content_type__app_label="core",
                codename="create_user",
            ).exists()
        )

    def test_ensure_feature_permissions_creates_registered_permissions(self):
        Permission.objects.filter(
            content_type__app_label="core",
            content_type__model="featurepermission",
            codename="view_operation_logs",
        ).delete()

        ensure_feature_permissions()

        self.assertTrue(
            Permission.objects.filter(
                content_type__app_label="core",
                content_type__model="featurepermission",
                codename="view_operation_logs",
            ).exists()
        )


class HasFeaturePermTests(TestCase):
    def test_returns_false_for_anonymous_user(self):
        from django.contrib.auth.models import AnonymousUser

        user = AnonymousUser()
        self.assertFalse(has_feature_perm(user, "core.query_data"))

    def test_returns_true_for_superuser(self):
        user = get_user_model().objects.create_superuser(
            username="super", password="pass12345"
        )
        self.assertTrue(has_feature_perm(user, "core.query_data"))

    def test_returns_true_for_user_with_permission(self):
        user = get_user_model().objects.create_user(
            username="perm-user", password="pass12345"
        )

        perm = Permission.objects.get(
            content_type__app_label="core", codename="query_data"
        )
        user.user_permissions.add(perm)
        self.assertTrue(has_feature_perm(user, "core.query_data"))

    def test_returns_false_for_user_without_permission(self):
        user = get_user_model().objects.create_user(
            username="no-perm", password="pass12345"
        )
        self.assertFalse(has_feature_perm(user, "core.query_data"))

    def test_returns_true_for_group_inherited_permission(self):
        user = get_user_model().objects.create_user(
            username="group-perm-user", password="pass12345"
        )
        group = Group.objects.create(name="后台用户")
        perm = Permission.objects.get(
            content_type__app_label="core", codename="query_data"
        )
        group.permissions.add(perm)
        user.groups.add(group)

        self.assertTrue(has_feature_perm(user, "core.query_data"))

    def test_user_disabled_permission_overrides_group_grant(self):
        user = get_user_model().objects.create_user(
            username="disabled-group-perm-user", password="pass12345"
        )
        group = Group.objects.create(name="可关闭后台用户")
        perm = Permission.objects.get(
            content_type__app_label="core", codename="query_data"
        )
        group.permissions.add(perm)
        user.groups.add(group)
        UserProfile.objects.create(
            user=user,
            disabled_permissions=["core.query_data"],
        )

        self.assertFalse(has_feature_perm(user, "core.query_data"))


class SuperadminInitializationTests(TestCase):
    def test_ensure_superadmin_defaults_creates_group_and_grants_all_permissions(self):
        get_user_model().objects.all().delete()
        Group.objects.filter(name=SUPERADMIN_GROUP_NAME).delete()

        user, group = ensure_superadmin_defaults()

        self.assertEqual(group.name, SUPERADMIN_GROUP_NAME)
        self.assertIsNotNone(user)
        self.assertEqual(user.username, "admin")
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_staff)
        self.assertTrue(user.groups.filter(id=group.id).exists())
        self.assertTrue(is_superadmin_user(user))
        group_permissions = {
            f"{permission.content_type.app_label}.{permission.codename}"
            for permission in group.permissions.select_related("content_type")
        }
        self.assertEqual(group_permissions, set(protected_group_permissions()))
        self.assertIn("core.manage_data_backup", group_permissions)

    def test_ensure_superadmin_defaults_creates_default_user_group_with_data_create_permission(
        self,
    ):
        ensure_superadmin_defaults(create_account=False)

        group = Group.objects.get(name=DEFAULT_USER_GROUP_NAME)
        group_permissions = {
            f"{permission.content_type.app_label}.{permission.codename}"
            for permission in group.permissions.select_related("content_type")
        }
        self.assertEqual(group_permissions, default_user_group_permissions())
        self.assertIn("catalog.add_dataresource", group_permissions)
        self.assertIn("catalog.view_dataresource", group_permissions)
        self.assertIn("catalog.change_dataresource", group_permissions)
        self.assertIn("catalog.delete_dataresource", group_permissions)
        self.assertIn("catalog.export_dataresource", group_permissions)
        self.assertIn("core.custom_symbolization", group_permissions)
        self.assertIn("raster.manage_raster_dataset", group_permissions)
        self.assertNotIn("core.manage_data_backup", group_permissions)
        self.assertNotIn("core.manage_auth", group_permissions)

    def test_ensure_superadmin_defaults_creates_guest_group_without_permissions(
        self,
    ):
        ensure_superadmin_defaults(create_account=False)

        group = Group.objects.get(name=GUEST_GROUP_NAME)
        group_permissions = {
            f"{permission.content_type.app_label}.{permission.codename}"
            for permission in group.permissions.select_related("content_type")
        }
        self.assertEqual(group_permissions, guest_group_permissions())
        self.assertEqual(group_permissions, set())
        self.assertNotIn("core.manage_data_backup", group_permissions)

    def test_ensure_superadmin_defaults_preserves_guest_group_custom_permissions(
        self,
    ):
        ensure_superadmin_defaults(create_account=False)
        group = Group.objects.get(name=GUEST_GROUP_NAME)
        group.permissions.set(
            [
                Permission.objects.get(
                    content_type__app_label="core", codename="query_data"
                )
            ]
        )

        ensure_superadmin_defaults(create_account=False)

        group.refresh_from_db()
        group_permissions = {
            f"{permission.content_type.app_label}.{permission.codename}"
            for permission in group.permissions.select_related("content_type")
        }
        self.assertEqual(group_permissions, {"core.query_data"})

    def test_existing_superuser_is_attached_to_superadmin_group(self):
        user = get_user_model().objects.create_superuser(
            username="manual-super",
            password="StrongPass12345",
        )

        ensure_superadmin_defaults()

        self.assertTrue(user.groups.filter(name=SUPERADMIN_GROUP_NAME).exists())


class GroupNamesTests(TestCase):
    def test_returns_ungrouped_for_user_without_groups(self):
        user = get_user_model().objects.create_user(
            username="no-group", password="pass12345"
        )
        self.assertEqual(group_names(user), "未分配角色")

    def test_returns_group_name(self):
        user = get_user_model().objects.create_user(
            username="with-group", password="pass12345"
        )
        group = Group.objects.create(name="科研用户")
        user.groups.add(group)
        self.assertEqual(group_names(user), "科研用户")

    def test_returns_multiple_group_names(self):
        user = get_user_model().objects.create_user(
            username="multi-group", password="pass12345"
        )
        group1 = Group.objects.create(name="科研用户")
        group2 = Group.objects.create(name="数据管理员")
        user.groups.add(group1, group2)
        names = group_names(user)
        self.assertIn("科研用户", names)
        self.assertIn("数据管理员", names)


class PermissionDeniedMessageTests(TestCase):
    def test_includes_group_name(self):
        user = get_user_model().objects.create_user(
            username="denied-user", password="pass12345"
        )
        message = permission_denied_message(user)
        self.assertIn("未分配角色", message)
        self.assertIn("无权限", message)


class FeatureDeniedResponseTests(TestCase):
    def test_returns_403_status(self):
        user = get_user_model().objects.create_user(
            username="denied-response", password="pass12345"
        )
        response = feature_denied_response(user)
        self.assertEqual(response.status_code, 403)

    def test_contains_detail_message(self):
        user = get_user_model().objects.create_user(
            username="denied-response2", password="pass12345"
        )
        response = feature_denied_response(user)
        import json

        data = json.loads(response.content)
        self.assertIn("detail", data)
        self.assertIn("无权限", data["detail"])


class FeaturePermissionQuerysetTests(TestCase):
    def test_returns_permissions_for_feature_apps(self):
        queryset = feature_permission_queryset()
        self.assertGreater(queryset.count(), 0)
        for perm in queryset:
            self.assertIn(perm.content_type.app_label, {"core", "catalog", "raster"})


class FeaturePermissionIdsForTests(TestCase):
    def test_returns_empty_set_for_new_group(self):
        group = Group.objects.create(name="测试组")
        ids = feature_permission_ids_for(group)
        self.assertEqual(ids, set())

    def test_returns_assigned_permission_ids(self):
        group = Group.objects.create(name="测试组2")
        from django.contrib.auth.models import Permission

        perm = Permission.objects.get(
            content_type__app_label="core", codename="browse_data"
        )
        group.permissions.add(perm)
        ids = feature_permission_ids_for(group)
        self.assertIn(perm.id, ids)
