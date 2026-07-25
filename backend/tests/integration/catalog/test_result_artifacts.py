import json
import tempfile
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from apps.catalog.models import DictionaryItem, ResultArtifact


class ResultArtifactApiTests(TestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(
            username="result-owner", password="pass12345"
        )
        grant(
            self.owner,
            ("catalog", "view_resultartifact"),
            ("catalog", "add_resultartifact"),
            ("catalog", "download_resultartifact"),
            ("catalog", "publish_resultartifact"),
            ("catalog", "delete_resultartifact"),
        )
        self.viewer = get_user_model().objects.create_user(
            username="result-viewer", password="pass12345"
        )
        grant(
            self.viewer,
            ("catalog", "view_resultartifact"),
            ("catalog", "download_resultartifact"),
        )
        self.audience = Group.objects.create(name="成果访问角色")
        self.viewer.groups.add(self.audience)
        self.category = DictionaryItem.objects.get(code="thematic_landscape_rs")
        self.client.force_login(self.owner)

    def test_import_rejects_draft_mode(self):
        with self.result_storage():
            response = self.create_result(
                file=uploaded("analysis.png", b"fake-png", "image/png"),
                publish=False,
                source_type="analysis",
                result_type="image",
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "成果导入必须直接发布")
        self.assertFalse(ResultArtifact.objects.exists())

    def test_published_result_is_visible_only_to_selected_role(self):
        outsider = get_user_model().objects.create_user(
            username="result-outsider", password="pass12345"
        )
        grant(outsider, ("catalog", "view_resultartifact"))
        with self.result_storage():
            response = self.create_result(
                file=uploaded("report.pdf", b"%PDF-1.4 result", "application/pdf"),
                result_type="report",
            )

            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["status"], "published")
            self.assertEqual(
                response.json()["accessGroups"],
                [
                    {
                        "id": self.audience.id,
                        "name": self.audience.name,
                        "isGuest": False,
                        "isSuperadmin": False,
                    }
                ],
            )

            self.client.force_login(self.viewer)
            visible = self.client.get("/api/catalog/results/")
            self.assertEqual(visible.status_code, 200)
            self.assertEqual(
                [item["name"] for item in visible.json()["items"]], ["测试成果"]
            )

            self.client.force_login(outsider)
            hidden = self.client.get("/api/catalog/results/")
            self.assertEqual(hidden.status_code, 200)
            self.assertEqual(hidden.json()["items"], [])

    def test_direct_publish_requires_publish_permission(self):
        uploader = get_user_model().objects.create_user(
            username="result-uploader", password="pass12345"
        )
        grant(
            uploader,
            ("catalog", "view_resultartifact"),
            ("catalog", "add_resultartifact"),
        )
        self.client.force_login(uploader)
        with self.result_storage():
            response = self.create_result(
                file=uploaded("result.csv", b"a,b\n1,2", "text/csv"),
                result_type="table",
            )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(ResultArtifact.objects.exists())

    def test_direct_publish_requires_view_permission(self):
        uploader = get_user_model().objects.create_user(
            username="result-uploader-without-view", password="pass12345"
        )
        grant(
            uploader,
            ("catalog", "add_resultartifact"),
            ("catalog", "publish_resultartifact"),
        )
        self.client.force_login(uploader)
        with self.result_storage():
            response = self.create_result(
                file=uploaded("result.csv", b"a,b\n1,2", "text/csv"),
                result_type="table",
            )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(ResultArtifact.objects.exists())

    def test_table_can_be_downloaded_but_not_previewed(self):
        with self.result_storage():
            response = self.create_result(
                file=uploaded("result.csv", b"a,b\n1,2", "text/csv"),
                result_type="table",
            )
            self.assertEqual(response.status_code, 201)
            payload = response.json()

            self.client.force_login(self.viewer)
            preview = self.client.get(payload["previewUrl"])
            self.assertEqual(preview.status_code, 400)
            download = self.client.get(payload["downloadUrl"])
            self.assertEqual(download.status_code, 200)
            self.assertEqual(b"".join(download.streaming_content), b"a,b\n1,2")
            download.close()

    def test_rejects_invalid_category_extension_and_oversized_file(self):
        with self.result_storage():
            invalid_category = self.create_result(
                file=uploaded("result.pdf", b"%PDF-1.4", "application/pdf"),
                category_code="thematic",
            )
            invalid_extension = self.create_result(
                file=uploaded("result.exe", b"MZ", "application/octet-stream")
            )
            with patch("apps.catalog.results.runtime_upload_max_mb", return_value=1):
                oversized = self.create_result(
                    file=uploaded(
                        "large.pdf",
                        b"0" * (1024 * 1024 + 1),
                        "application/pdf",
                    )
                )

        self.assertEqual(invalid_category.status_code, 400)
        self.assertEqual(invalid_extension.status_code, 400)
        self.assertEqual(oversized.status_code, 400)
        self.assertFalse(ResultArtifact.objects.exists())

    def test_historical_draft_can_be_published_unpublished_and_deleted(self):
        with self.result_storage() as config:
            relative_path = "exports/results/legacy/legacy-report.pdf"
            path = config.app_path(*relative_path.split("/"))
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b"%PDF-1.4 legacy")
            artifact = ResultArtifact.objects.create(
                owner=self.owner,
                name="历史成果草稿",
                description="历史导入草稿",
                source_type=ResultArtifact.SourceType.DIRECT_IMPORT,
                result_type=ResultArtifact.ResultType.REPORT,
                status=ResultArtifact.Status.DRAFT,
                category=self.category,
                provider="测试单位",
                file_path=relative_path,
                file_name="legacy-report.pdf",
                mime_type="application/pdf",
                size_bytes=15,
            )

            published = self.client.post(
                f"/api/catalog/results/{artifact.id}/",
                data=json.dumps(
                    {
                        "action": "publish",
                        "accessGroupIds": [self.audience.id],
                    }
                ),
                content_type="application/json",
            )
            self.assertEqual(published.status_code, 200)
            self.assertEqual(published.json()["status"], "published")
            self.assertTrue(published.json()["canUnpublish"])

            unpublished = self.client.post(
                f"/api/catalog/results/{artifact.id}/",
                data=json.dumps({"action": "unpublish"}),
                content_type="application/json",
            )
            self.assertEqual(unpublished.status_code, 200)
            self.assertEqual(unpublished.json()["status"], "draft")

            deleted = self.client.post(
                f"/api/catalog/results/{artifact.id}/",
                data=json.dumps({"action": "delete"}),
                content_type="application/json",
            )
            self.assertEqual(deleted.status_code, 200)
            self.assertEqual(deleted.json()["deleted"], True)
            self.assertFalse(ResultArtifact.objects.filter(pk=artifact.id).exists())
            self.assertFalse(path.exists())

    def create_result(
        self,
        *,
        file: SimpleUploadedFile,
        publish: bool | None = None,
        source_type: str = "direct_import",
        result_type: str = "other",
        category_code: str | None = None,
    ):
        return self.client.post(
            "/api/catalog/results/",
            data={
                "file": file,
                "payload": json.dumps(
                    {
                        "name": "测试成果",
                        "description": "成果接口集成测试",
                        "sourceType": source_type,
                        "resultType": result_type,
                        "categoryCode": category_code or self.category.code,
                        "provider": "测试单位",
                        "accessGroupIds": [self.audience.id],
                        **({"publish": publish} if publish is not None else {}),
                    },
                    ensure_ascii=False,
                ),
            },
        )

    def result_storage(self):
        temporary = tempfile.TemporaryDirectory()
        config = replace(
            settings.PROJECT_CONFIG,
            app_data=Path(temporary.name) / "app",
            research_data_root=Path(temporary.name) / "research",
        )
        override = override_settings(PROJECT_CONFIG=config)

        class ResultStorageContext:
            def __enter__(self):
                temporary.__enter__()
                override.__enter__()
                return config

            def __exit__(self, exc_type, exc_value, traceback):
                try:
                    return override.__exit__(exc_type, exc_value, traceback)
                finally:
                    temporary.__exit__(exc_type, exc_value, traceback)

        return ResultStorageContext()


def uploaded(name: str, content: bytes, content_type: str) -> SimpleUploadedFile:
    return SimpleUploadedFile(name, content, content_type)


def grant(user, *specs: tuple[str, str]) -> None:
    for app_label, codename in specs:
        permission = Permission.objects.get(
            content_type__app_label=app_label,
            codename=codename,
        )
        user.user_permissions.add(permission)
