from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase

from apps.catalog.models import (
    DictionaryItem,
    MapComposition,
    MapCompositionVersion,
    ResultArtifact,
    WorkspaceScene,
)


class ResultReviewSummaryTests(TestCase):
    url = "/api/catalog/results/review-summary/"

    def setUp(self):
        users = get_user_model().objects
        self.reviewer = users.create_user(username="count-reviewer")
        self.author = users.create_user(username="count-author")
        self.admin = users.create_superuser(
            username="count-admin", password="test-only"
        )
        self.project = WorkspaceScene.objects.create(
            owner=self.author, kind="project", name="计数工程"
        )
        self.category = DictionaryItem.objects.get(code="thematic_landscape_rs")
        self.own_map = self.map(self.reviewer, "completed", 2)
        self.other_map = self.map(self.author, "completed", 1)
        self.map(self.reviewer, "draft", 0)
        self.map(self.reviewer, "completed", 0)
        self.map(self.author, "published", 1)
        self.analysis = self.artifact(self.author, "analysis", "in_review")
        self.external = self.artifact(self.author, "direct_import", "in_review")
        self.artifact(self.author, "analysis", "draft")
        self.artifact(self.author, "direct_import", "published")

    def map(self, owner, status, versions):
        item = MapComposition.objects.create(
            owner=owner,
            project=self.project,
            status=status,
            name=f"专题-{MapComposition.objects.count()}",
        )
        for number in range(1, versions + 1):
            MapCompositionVersion.objects.create(
                composition=item,
                version_number=number,
                format="png",
                width_px=100,
                height_px=100,
                preview_path="preview.png",
                artifact_path="map.png",
            )
        return item

    def artifact(self, owner, source, status):
        return ResultArtifact.objects.create(
            owner=owner,
            name="计数成果",
            category=self.category,
            source_type=source,
            status=status,
            requires_review=True,
            file_path="report.pdf",
            file_name="report.pdf",
        )

    def grant(self, *names):
        self.reviewer.user_permissions.set(
            Permission.objects.filter(
                content_type__app_label="catalog", codename__in=names
            )
        )
        self.client.force_login(self.reviewer)

    def test_requires_login_and_a_complete_review_permission_pair(self):
        self.assertEqual(self.client.get(self.url).status_code, 401)
        for names in [
            [],
            ["view_resultartifact", "view_mapcomposition"],
            ["publish_resultartifact", "publish_mapcomposition"],
            ["view_mapcomposition", "publish_resultartifact"],
        ]:
            with self.subTest(names=names):
                self.grant(*names)
                self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_mapping_counts_only_owned_ready_results_once(self):
        self.grant("view_mapcomposition", "publish_mapcomposition")
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"pendingCount": 1, "pendingMapCount": 1, "pendingArtifactCount": 0},
        )
        self.assertEqual(response["Cache-Control"], "private, no-store")

    def test_report_reviewers_count_analysis_and_imports_but_not_drafts(self):
        self.grant("view_resultartifact", "publish_resultartifact")
        self.assertEqual(
            self.client.get(self.url).json(),
            {"pendingCount": 2, "pendingMapCount": 0, "pendingArtifactCount": 2},
        )

    def test_admin_counts_all_ready_results_and_matches_management(self):
        self.client.force_login(self.admin)
        response = self.client.get(self.url)
        self.assertEqual(
            response.json(),
            {"pendingCount": 4, "pendingMapCount": 2, "pendingArtifactCount": 2},
        )
        maps = self.client.get("/api/catalog/map-compositions/").json()["items"]
        artifacts = self.client.get("/api/catalog/results/").json()["items"]
        expected = sum(
            item["status"] == "completed"
            and item["canPublish"]
            and bool(item["currentVersion"])
            for item in maps
        )
        expected += sum(
            item["status"] == "in_review" and item["canPublish"] for item in artifacts
        )
        self.assertEqual(response.json()["pendingCount"], expected)

    def test_counts_refresh_after_publication_rejection_and_permission_revocation(self):
        self.grant(
            "view_mapcomposition",
            "publish_mapcomposition",
            "view_resultartifact",
            "publish_resultartifact",
        )
        self.assertEqual(self.client.get(self.url).json()["pendingCount"], 3)
        self.own_map.status = "published"
        self.own_map.save(update_fields=["status"])
        self.analysis.status = "published"
        self.analysis.save(update_fields=["status"])
        self.assertEqual(self.client.get(self.url).json()["pendingCount"], 1)
        self.external.status = "draft"
        self.external.save(update_fields=["status"])
        self.assertEqual(self.client.get(self.url).json()["pendingCount"], 0)
        self.reviewer.user_permissions.clear()
        self.assertEqual(self.client.get(self.url).status_code, 403)
