from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase

from apps.core.permissions import (
    FEATURE_PERMISSIONS,
    FEATURE_PERMISSION_NAMES,
    FeaturePermissionDef,
    feature_denied_response,
    feature_permission_ids_for,
    feature_permission_queryset,
    group_names,
    has_feature_perm,
    permission_denied_message,
)


class FeaturePermissionDefTests(TestCase):
    def test_perm_name_format(self):
        perm = FeaturePermissionDef("core", "access_admin", "进入后台管理", "系统管理")
        self.assertEqual(perm.perm_name, "core.access_admin")

    def test_feature_permissions_not_empty(self):
        self.assertGreater(len(FEATURE_PERMISSIONS), 0)

    def test_all_permissions_have_required_fields(self):
        for perm in FEATURE_PERMISSIONS:
            self.assertTrue(perm.app_label)
            self.assertTrue(perm.codename)
            self.assertTrue(perm.name)
            self.assertTrue(perm.group)

    def test_feature_permission_names_tuple(self):
        self.assertEqual(len(FEATURE_PERMISSION_NAMES), len(FEATURE_PERMISSIONS))
        for name in FEATURE_PERMISSION_NAMES:
            self.assertIn(".", name)


class HasFeaturePermTests(TestCase):
    def test_returns_false_for_anonymous_user(self):
        from django.contrib.auth.models import AnonymousUser

        user = AnonymousUser()
        self.assertFalse(has_feature_perm(user, "core.access_admin"))

    def test_returns_true_for_superuser(self):
        user = get_user_model().objects.create_superuser(username="super", password="pass12345")
        self.assertTrue(has_feature_perm(user, "core.access_admin"))

    def test_returns_true_for_user_with_permission(self):
        user = get_user_model().objects.create_user(username="perm-user", password="pass12345")
        from django.contrib.auth.models import Permission

        perm = Permission.objects.get(content_type__app_label="core", codename="access_admin")
        user.user_permissions.add(perm)
        self.assertTrue(has_feature_perm(user, "core.access_admin"))

    def test_returns_false_for_user_without_permission(self):
        user = get_user_model().objects.create_user(username="no-perm", password="pass12345")
        self.assertFalse(has_feature_perm(user, "core.access_admin"))


class GroupNamesTests(TestCase):
    def test_returns_ungrouped_for_user_without_groups(self):
        user = get_user_model().objects.create_user(username="no-group", password="pass12345")
        self.assertEqual(group_names(user), "未分组")

    def test_returns_group_name(self):
        user = get_user_model().objects.create_user(username="with-group", password="pass12345")
        group = Group.objects.create(name="科研用户")
        user.groups.add(group)
        self.assertEqual(group_names(user), "科研用户")

    def test_returns_multiple_group_names(self):
        user = get_user_model().objects.create_user(username="multi-group", password="pass12345")
        group1 = Group.objects.create(name="科研用户")
        group2 = Group.objects.create(name="数据管理员")
        user.groups.add(group1, group2)
        names = group_names(user)
        self.assertIn("科研用户", names)
        self.assertIn("数据管理员", names)


class PermissionDeniedMessageTests(TestCase):
    def test_includes_group_name(self):
        user = get_user_model().objects.create_user(username="denied-user", password="pass12345")
        message = permission_denied_message(user)
        self.assertIn("未分组", message)
        self.assertIn("无权限", message)


class FeatureDeniedResponseTests(TestCase):
    def test_returns_403_status(self):
        user = get_user_model().objects.create_user(username="denied-response", password="pass12345")
        response = feature_denied_response(user)
        self.assertEqual(response.status_code, 403)

    def test_contains_detail_message(self):
        user = get_user_model().objects.create_user(username="denied-response2", password="pass12345")
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

        perm = Permission.objects.get(content_type__app_label="core", codename="browse_data")
        group.permissions.add(perm)
        ids = feature_permission_ids_for(group)
        self.assertIn(perm.id, ids)
