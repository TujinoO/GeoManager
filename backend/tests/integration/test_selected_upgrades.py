import io
import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from PIL import Image

from apps.catalog.models import MapComposition, WorkspaceScene
from apps.content.models import Article, Asset
from apps.core.map_thumbnail import ThumbnailTileError


class SelectedUpgradeTests(TestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_superuser(
            "upgrade-admin", password="test-password"
        )
        self.reader = get_user_model().objects.create_user(
            "upgrade-reader", password="test-password"
        )
        self.client.force_login(self.admin)

    def post(self, url, data):
        return self.client.post(url, json.dumps(data), content_type="application/json")

    def article(self):
        return Article.objects.create(
            owner=self.admin,
            kind="knowledge",
            title="胡杨保护",
            category="生态",
            body="正文",
        )

    def image(self):
        stream = io.BytesIO()
        Image.new("RGB", (8, 8), "green").save(stream, "PNG")
        return SimpleUploadedFile(
            "test.png", stream.getvalue(), content_type="image/png"
        )

    def test_workspace_summary_pagination_search_and_invalid_parameters(self):
        for i in range(27):
            WorkspaceScene.objects.create(
                owner=self.admin,
                kind="project",
                name=f"生态工程{i:02d}",
                snapshot={"groups": [], "large": "x" * 4000},
            )
        response = self.client.get("/api/catalog/workspaces/?limit=10&offset=20")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 27)
        self.assertEqual(len(response.json()["items"]), 7)
        self.assertNotIn("snapshot", response.json()["items"][0])
        response = self.client.get("/api/catalog/workspaces/?q=生态工程26")
        self.assertEqual(response.json()["total"], 1)
        item = response.json()["items"][0]
        self.assertIn(
            "snapshot", self.client.get(f"/api/catalog/workspaces/{item['id']}/").json()
        )
        for query in ("limit=0", "limit=101", "offset=-1", "offset=abc"):
            self.assertEqual(
                self.client.get(f"/api/catalog/workspaces/?{query}").status_code, 400
            )

    def test_workspace_and_composition_compare_and_swap(self):
        workspace = WorkspaceScene.objects.create(
            owner=self.admin, kind="project", name="CAS工程", snapshot={}
        )
        composition = MapComposition.objects.create(
            owner=self.admin, project=workspace, name="CAS出图", layout={}
        )
        for obj, url, data in [
            (
                workspace,
                f"/api/catalog/workspaces/{workspace.id}/",
                {"name": "已修改工程"},
            ),
            (
                composition,
                f"/api/catalog/map-compositions/{composition.id}/",
                {"name": "已修改出图"},
            ),
        ]:
            original = obj.updated_at.isoformat()
            response = self.post(url, {**data, "expectedUpdatedAt": original})
            self.assertEqual(response.status_code, 200)
            conflict = self.post(
                url, {"name": "不应覆盖", "expectedUpdatedAt": original}
            )
            self.assertEqual(conflict.status_code, 409)
            obj.refresh_from_db()
            self.assertEqual(obj.name, data["name"])
            self.assertEqual(
                self.post(url, {**data, "expectedUpdatedAt": "invalid"}).status_code,
                400,
            )

    def test_content_requires_login_and_enforces_management_permission(self):
        article = self.article()
        self.client.logout()
        self.assertEqual(self.client.get("/api/content/articles/").status_code, 401)
        self.client.force_login(self.reader)
        self.assertEqual(self.client.get("/api/content/articles/").json()["total"], 0)
        self.assertEqual(
            self.client.get(f"/api/content/articles/{article.id}/").status_code, 404
        )
        self.assertEqual(self.post("/api/content/articles/", {}).status_code, 403)
        self.assertEqual(
            self.client.get("/api/content/articles/?manage=1").status_code, 403
        )

    def test_content_create_publish_and_revision_conflict(self):
        response = self.post(
            "/api/content/articles/",
            {
                "kind": "news",
                "title": "生态监测",
                "category": "科研进展",
                "body": "安全文本 $x^2$",
                "status": "draft",
                "source": "内部素材页码",
            },
        )
        self.assertEqual(response.status_code, 201)
        article = response.json()
        url = f"/api/content/articles/{article['id']}/"
        self.assertEqual(
            self.post(url, {"revision": 1, "status": "published"}).status_code, 200
        )
        self.assertEqual(
            self.post(url, {"revision": 1, "body": "旧编辑"}).status_code, 409
        )
        self.client.force_login(self.reader)
        self.assertEqual(self.client.get("/api/content/articles/").json()["total"], 1)
        self.assertEqual(self.client.get(url).json()["body"], "安全文本 $x^2$")
        self.assertEqual(self.client.get(url).json()["source"], "")
        self.assertEqual(
            self.client.get("/api/content/articles/").json()["items"][0]["source"], ""
        )

    def test_image_format_must_match_extension(self):
        article = self.article()
        image = self.image()
        image.name = "incorrect.jpg"
        response = self.client.post(
            f"/api/content/articles/{article.id}/assets/", {"file": image}
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Asset.objects.count(), 0)

    def test_staged_asset_commit_is_atomic_and_private(self):
        article = self.article()
        url = f"/api/content/articles/{article.id}/"
        response = self.client.post(url + "assets/", {"file": self.image()})
        self.assertEqual(response.status_code, 201)
        asset = response.json()
        self.assertTrue(asset["pending"])
        self.assertEqual(self.client.get(url).json()["assets"], [])
        self.client.force_login(self.reader)
        self.assertEqual(self.client.get(asset["url"]).status_code, 404)
        self.client.force_login(self.admin)
        failed = self.post(
            url,
            {
                "revision": 1,
                "body": "不能写入",
                "commitAssetIds": [asset["id"], 999999],
            },
        )
        self.assertEqual(failed.status_code, 400)
        article.refresh_from_db()
        self.assertEqual(article.revision, 1)
        self.assertEqual(article.body, "正文")
        response = self.post(
            url,
            {
                "revision": 1,
                "status": "published",
                "commitAssetIds": [asset["id"]],
                "coverAssetId": asset["id"],
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["assets"][0]["pending"])
        self.client.force_login(self.reader)
        self.assertEqual(self.client.get(asset["url"]).status_code, 200)

    def test_expired_or_foreign_staged_asset_cannot_commit(self):
        article = self.article()
        response = self.client.post(
            f"/api/content/articles/{article.id}/assets/", {"file": self.image()}
        )
        asset = Asset.objects.get(pk=response.json()["id"])
        for changes in (
            {"pending_owner": self.reader},
            {
                "pending_owner": self.admin,
                "expires_at": timezone.now() - timedelta(seconds=1),
            },
        ):
            Asset.objects.filter(pk=asset.pk).update(**changes)
            response = self.post(
                f"/api/content/articles/{article.id}/",
                {"revision": 1, "commitAssetIds": [asset.pk]},
            )
            self.assertEqual(response.status_code, 400)
        self.assertEqual(
            self.client.get(f"/api/content/assets/{asset.pk}/").status_code, 404
        )

    def test_content_validation_and_discard_single_staged_asset(self):
        for data in (
            {"kind": "other"},
            {
                "title": "x",
                "links": [{"title": "unsafe", "url": "javascript:alert(1)"}],
            },
        ):
            self.assertEqual(self.post("/api/content/articles/", data).status_code, 400)
        article = self.article()
        upload = self.client.post(
            f"/api/content/articles/{article.id}/assets/", {"file": self.image()}
        ).json()
        self.assertEqual(self.client.delete(upload["url"]).status_code, 200)
        self.assertEqual(self.client.get(upload["url"]).status_code, 404)

    def test_export_tile_failure_is_not_a_successful_placeholder(self):
        with patch(
            "apps.core.views.thumbnail_tile", side_effect=ThumbnailTileError("offline")
        ) as request_tile:
            response = self.client.get(
                "/api/map/thumbnail-tiles/3/4/2.png?purpose=export&basemap=osm"
            )
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response["Cache-Control"], "no-store")
            self.assertFalse(request_tile.call_args.kwargs["allow_fallback"])
        self.assertEqual(
            self.client.get(
                "/api/map/thumbnail-tiles/3/4/2.png?purpose=invalid"
            ).status_code,
            400,
        )
