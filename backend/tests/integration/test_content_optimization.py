import io
import json
from contextlib import redirect_stdout

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.db import connection
from django.test.utils import CaptureQueriesContext
from PIL import Image

from apps.content.models import Article
from apps.content.views import store_asset


class ContentOptimizationTests(TestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_superuser(
            "editor", password="test-only"
        )
        self.reader = get_user_model().objects.create_user(
            "reader", password="test-only"
        )
        self.client.force_login(self.admin)

    def post(self, path, value):
        return self.client.post(
            path, json.dumps(value), content_type="application/json"
        )

    def test_review_publish_archive_visibility_and_attachment_revalidation(self):
        article = Article.objects.create(
            kind="knowledge", title="胡杨监测", category="监测与数据", body="完整正文"
        )
        stream = io.BytesIO()
        Image.new("RGB", (10, 10), "green").save(stream, "PNG")
        asset = store_asset(article, "forest.png", stream.getvalue())
        path = f"/api/content/articles/{article.pk}/"
        asset_path = f"/api/content/assets/{asset.pk}/"
        response = self.post(path, {"revision": 1, "status": "review"})
        self.assertEqual(response.status_code, 200)
        self.client.force_login(self.reader)
        self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(self.client.get(asset_path).status_code, 404)
        self.client.force_login(self.admin)
        self.assertEqual(
            self.post(path, {"revision": 2, "status": "published"}).status_code, 200
        )
        self.client.force_login(self.reader)
        self.assertEqual(self.client.get(path).status_code, 200)
        response = self.client.get(asset_path)
        etag = response["ETag"]
        response.close()
        self.assertEqual(
            self.client.get(asset_path, HTTP_IF_NONE_MATCH=etag).status_code, 304
        )
        self.client.force_login(self.admin)
        self.assertEqual(
            self.post(path, {"revision": 3, "status": "archived"}).status_code, 200
        )
        self.client.force_login(self.reader)
        self.assertEqual(
            self.client.get(asset_path, HTTP_IF_NONE_MATCH=etag).status_code, 404
        )
        self.assertEqual(self.client.get(path).status_code, 404)

    def test_summary_response_does_not_fetch_body_or_media_lists(self):
        article = Article.objects.create(
            kind="knowledge",
            title="胡杨监测",
            category="监测与数据",
            body="正文" * 30000,
            source="内部备注",
            status="published",
        )
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get("/api/content/articles/?summaryOnly=1")
        content_queries = [
            q["sql"]
            for q in queries
            if q["sql"].startswith("SELECT") and 'FROM "content_article"' in q["sql"]
        ]
        self.assertEqual(
            len(content_queries), 2
        )  # One page query and one count, irrespective of page size.
        self.assertNotIn('"body"', content_queries[0])
        self.assertNotIn('"source"', content_queries[0])
        row = response.json()["items"][0]
        self.assertEqual(row["id"], article.pk)
        self.assertEqual(row["body"], "")
        self.assertEqual(row["source"], "")
        self.assertEqual(row["assets"], [])
        self.assertEqual(row["links"], [])
        full = self.client.get(f"/api/content/articles/{article.pk}/")
        self.assertEqual(full.json()["body"], article.body)
        self.assertLess(len(response.content) * 20, len(full.content))

    def test_rejects_empty_review_and_publication(self):
        for status in ("review", "published"):
            with self.subTest(status=status):
                response = self.post(
                    "/api/content/articles/",
                    {
                        "kind": "knowledge",
                        "title": "标题",
                        "category": "研究方法",
                        "body": "  ",
                        "status": status,
                    },
                )
                self.assertEqual(response.status_code, 400)
        self.assertEqual(Article.objects.count(), 0)

    def test_curated_seed_is_idempotent_and_preserves_existing_edits(self):
        output = io.StringIO()
        with redirect_stdout(output):
            call_command("seed_platform_content", owner="editor", publish=True)
        self.assertEqual(Article.objects.count(), 13)
        self.assertEqual(Article.objects.filter(kind="knowledge").count(), 8)
        self.assertEqual(Article.objects.filter(kind="news", pinned=True).count(), 1)
        article = Article.objects.get(seed_key="news-most-beautiful-teacher-2026")
        article.title = "已由编辑完善"
        article.save()
        with redirect_stdout(output):
            call_command("seed_platform_content", owner="editor", publish=True)
        self.assertEqual(Article.objects.count(), 13)
        article.refresh_from_db()
        self.assertEqual(article.title, "已由编辑完善")

    def test_seed_defaults_to_private_drafts(self):
        with redirect_stdout(io.StringIO()):
            call_command("seed_platform_content", owner="editor")
        self.assertEqual(Article.objects.filter(status="draft").count(), 13)
        self.client.force_login(self.reader)
        self.assertEqual(self.client.get("/api/content/articles/").json()["total"], 0)

    def test_news_seed_does_not_import_or_change_science_articles(self):
        with redirect_stdout(io.StringIO()):
            call_command(
                "seed_platform_content", owner="editor", kind="news", publish=True
            )
        self.assertEqual(Article.objects.count(), 5)
        self.assertFalse(Article.objects.filter(kind="knowledge").exists())
        self.assertEqual(
            Article.objects.filter(status="published", kind="news").count(), 5
        )
        self.client.force_login(self.reader)
        response = self.client.get("/api/content/articles/", {"kind": "news"}).json()
        self.assertEqual(response["total"], 5)
        self.assertTrue(response["items"][0]["pinned"])
