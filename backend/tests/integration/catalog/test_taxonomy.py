import importlib
import json

from django.apps import apps as django_apps
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase

from apps.catalog.models import (
    DataResource,
    DictionaryItem,
    MapComposition,
    MapCompositionVersion,
    WorkspaceScene,
)
from apps.catalog.taxonomy import TaxonomyError, resolve_data_category, taxonomy_tree


class DataTaxonomyTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="taxonomy-user", password="pass12345"
        )
        grant(self.user, ("core", "browse_data"), ("catalog", "change_dataresource"))
        self.client.force_login(self.user)

    def test_seeded_taxonomy_has_four_roots_and_fifteen_selectable_leaves(self):
        tree = taxonomy_tree()

        self.assertEqual(
            [node["code"] for node in tree],
            ["base_geo", "habitat", "distribution", "thematic"],
        )
        self.assertEqual(sum(len(node["children"]) for node in tree), 15)
        self.assertTrue(all(not node["selectable"] for node in tree))
        self.assertTrue(
            all(
                child["selectable"]
                for node in tree
                for child in node["children"]
            )
        )

    def test_only_active_selectable_leaf_category_can_be_assigned(self):
        with self.assertRaisesRegex(TaxonomyError, "叶节点"):
            resolve_data_category("habitat")

        leaf = DictionaryItem.objects.get(code="habitat_soil")
        leaf.is_active = False
        leaf.save(update_fields=["is_active"])
        with self.assertRaisesRegex(TaxonomyError, "不存在或已停用"):
            resolve_data_category("habitat_soil")

    def test_parent_category_filter_includes_descendant_resources(self):
        soil = DictionaryItem.objects.get(code="habitat_soil")
        water = DictionaryItem.objects.get(code="habitat_water")
        thematic = DictionaryItem.objects.get(code="thematic_individual")
        for code, category in (
            ("taxonomy-soil", soil),
            ("taxonomy-water", water),
            ("taxonomy-individual", thematic),
        ):
            DataResource.objects.create(
                name=code,
                code=code,
                data_type=DataResource.DataType.TABLE,
                category=category,
                maintainer=self.user,
            )

        response = self.client.get(
            "/api/catalog/resources/", {"categoryCode": "habitat"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {item["code"] for item in response.json()["items"]},
            {"taxonomy-soil", "taxonomy-water"},
        )
        for item in response.json()["items"]:
            self.assertEqual(item["classificationStatus"], "classified")
            self.assertEqual(item["categoryPath"][0]["code"], "habitat")

    def test_admin_can_reclassify_pending_resource_to_leaf(self):
        resource = DataResource.objects.create(
            name="待分类土壤数据",
            code="pending-soil-resource",
            data_type=DataResource.DataType.TABLE,
            maintainer=self.user,
        )

        response = self.client.post(
            f"/api/admin/data/resources/{resource.id}/",
            data=json.dumps(
                {"action": "updateClassification", "categoryCode": "habitat_soil"}
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["classificationStatus"], "classified")
        self.assertEqual(payload["category"]["code"], "habitat_soil")
        self.assertEqual(
            [item["code"] for item in payload["categoryPath"]],
            ["habitat", "habitat_soil"],
        )
        resource.refresh_from_db()
        self.assertEqual(resource.category.code, "habitat_soil")

    def test_admin_reclassification_rejects_non_selectable_root(self):
        resource = DataResource.objects.create(
            name="根节点错误数据",
            code="root-category-resource",
            data_type=DataResource.DataType.TABLE,
            maintainer=self.user,
        )

        response = self.client.post(
            f"/api/admin/data/resources/{resource.id}/",
            data=json.dumps(
                {"action": "updateClassification", "categoryCode": "base_geo"}
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        resource.refresh_from_db()
        self.assertIsNone(resource.category_id)


class ArchivedMapCompositionMigrationTests(TestCase):
    def test_archived_composition_is_completed_without_losing_version_artifacts(self):
        user = get_user_model().objects.create_user(
            username="archived-map-owner", password="pass12345"
        )
        project = WorkspaceScene.objects.create(
            owner=user,
            kind=WorkspaceScene.Kind.PROJECT,
            name="归档专题来源工程",
        )
        composition = MapComposition.objects.create(
            owner=user,
            project=project,
            name="历史归档专题",
            status="archived",
            source_workspace_snapshot={"layers": [1]},
        )
        version = MapCompositionVersion.objects.create(
            composition=composition,
            version_number=1,
            format=MapCompositionVersion.Format.PNG,
            width_px=1200,
            height_px=800,
            preview_path="map-compositions/preview-v1.png",
            artifact_path="map-compositions/artifact-v1.png",
            workspace_snapshot={"layers": [1]},
            resource_manifest=[{"resourceId": 1}],
        )
        before_counts = (
            MapComposition.objects.count(),
            MapCompositionVersion.objects.count(),
        )
        migration = importlib.import_module(
            "apps.catalog.migrations.0009_remove_map_composition_archived_status"
        )

        migration.preserve_archived_map_compositions(django_apps, None)

        composition.refresh_from_db()
        version.refresh_from_db()
        self.assertEqual(composition.status, MapComposition.Status.COMPLETED)
        self.assertEqual(
            (
                MapComposition.objects.count(),
                MapCompositionVersion.objects.count(),
            ),
            before_counts,
        )
        self.assertEqual(version.preview_path, "map-compositions/preview-v1.png")
        self.assertEqual(version.artifact_path, "map-compositions/artifact-v1.png")
        self.assertEqual(version.resource_manifest, [{"resourceId": 1}])


def grant(user, *specs):
    for app_label, codename in specs:
        permission = Permission.objects.get(
            content_type__app_label=app_label, codename=codename
        )
        user.user_permissions.add(permission)
