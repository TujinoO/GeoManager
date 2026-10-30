import base64
import io
import json

import pandas as pd
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase
from PIL import Image

from apps.catalog.analysis import validate_table
from apps.catalog.analysis_templates import TEMPLATES
from apps.catalog.analysis_visuals import build_visuals
from apps.catalog.ecology_contracts import normalize_analysis_table
from apps.catalog.models import ResultArtifact
from tests.integration.catalog import test_analysis_workspace as workspace


class EcologySourceMappingTests(SimpleTestCase):
    def prepared(self, data, kind):
        df = normalize_analysis_table(pd.DataFrame(data), kind)
        for field in TEMPLATES[kind]["columns"]:
            if field not in df and field not in TEMPLATES[kind]["required"]:
                df[field] = ""
        return df

    def test_original_individual_empty_county_header_and_extra_field(self):
        df = self.prepared(
            {
                "采集号": ["001"],
                "物种中文名": ["胡杨"],
                "Unnamed: 3": ["轮台县"],
                "原始备注": ["保留"],
            },
            "individual",
        )
        self.assertEqual(df.collection_code[0], "001")
        self.assertEqual(df.city[0], "轮台县")
        self.assertEqual(df["原始备注"][0], "保留")
        self.assertEqual(validate_table(df, "individual")[0], [])

    def test_community_missing_values_and_english_aliases(self):
        df = self.prepared(
            {
                "Sample": ["A1", "A2", "A3"],
                "km": ["a", "a", "b"],
                "FRic": ["NA", "0", "1.2"],
                "bio6": ["-20", "-18", "-22"],
                "Shannon": ["0", "1.2", "1.8"],
            },
            "community",
        )
        self.assertEqual(df.fric.tolist(), ["NA", "0", "1.2"])
        self.assertEqual(df.bio6.tolist(), ["-20", "-18", "-22"])
        self.assertEqual(validate_table(df, "community")[0], [])

    def test_germplasm_does_not_invent_species_material_or_sex(self):
        df = self.prepared(
            {
                "DNA样本编号": ["GA1", "GA2"],
                "采集地点": ["轮台", "轮台"],
                "性别": ["雌株", "雌株珠"],
                "经度": ["84°10′", "84.2"],
            },
            "samples",
        )
        self.assertEqual(df.species.tolist(), ["", ""])
        self.assertEqual(df.material_type.tolist(), ["", ""])
        self.assertEqual(df.is_core.tolist(), ["", ""])
        self.assertEqual(df.sex.tolist(), ["female", "unknown"])
        self.assertEqual(df.sex_original[1], "雌株珠")
        errors, warnings = validate_table(df, "samples")
        self.assertEqual(errors, [])
        self.assertTrue(any("原文" in w for w in warnings))
        self.assertTrue(any("空间定位" in w for w in warnings))
        metrics = build_visuals(df, "samples", None, "region")["metrics"]
        self.assertEqual(
            next(m["value"] for m in metrics if m["label"] == "核心子集"), "未提供"
        )


class AnalysisReportWorkflowTests(TestCase):
    grant = workspace.AnalysisWorkspaceTests.grant
    imported = workspace.AnalysisWorkspaceTests.imported

    def setUp(self):
        workspace.AnalysisWorkspaceTests.setUp(self)
        for permission in [
            "view_resultartifact",
            "add_resultartifact",
            "download_resultartifact",
        ]:
            self.grant(self.owner, "catalog", permission)
        self.grant(self.other, "catalog", "view_resultartifact")
        self.grant(self.other, "catalog", "publish_resultartifact")
        self.audience = Group.objects.create(name="report-audience")
        self.other.groups.add(self.audience)
        self.resource_id = self.imported("community")

    def page(self):
        out = io.BytesIO()
        Image.new("RGB", (300, 424), "white").save(out, "PNG")
        return out.getvalue()

    def document(self):
        return {
            "title": "群落分析报告",
            "source": "原始群落调查",
            "paragraphs": ["分析基于有效记录；相关性不表示因果关系。"],
            "figures": [
                {
                    "id": "f1",
                    "title": "相关矩阵",
                    "caption": "逐对排除缺测值",
                    "included": True,
                    "imageData": "data:image/png;base64,"
                    + base64.b64encode(self.page()).decode(),
                }
            ],
        }

    def save_report(self, id=None, document=None, pages=None):
        return self.client.post(
            "/api/analysis/reports/" + (f"{id}/" if id else ""),
            {
                "resourceId": self.resource_id,
                "document": json.dumps(document or self.document()),
                "pages": SimpleUploadedFile(
                    "page.png", pages if pages is not None else self.page(), "image/png"
                ),
            },
        )

    def action(self, id, action, **kwargs):
        return self.client.post(
            f"/api/catalog/results/{id}/",
            json.dumps({"action": action, **kwargs}),
            content_type="application/json",
        )

    def test_edit_review_reject_resubmit_publish_and_download(self):
        created = self.save_report()
        self.assertEqual(created.status_code, 201, created.content)
        artifact = created.json()
        id = artifact["id"]
        self.assertTrue(artifact["canEditReport"])
        self.assertTrue(artifact["canSubmitReview"])
        self.assertFalse(artifact["canDelete"])
        self.assertEqual(artifact["sourceResourceId"], self.resource_id)
        updated = self.save_report(
            id, document={**self.document(), "title": "修订报告"}
        )
        self.assertEqual(updated.status_code, 200, updated.content)
        self.assertEqual(ResultArtifact.objects.count(), 1)
        self.grant(self.owner, "catalog", "publish_resultartifact")
        self.assertEqual(
            self.action(id, "publish", accessGroupIds=[self.audience.id]).status_code,
            400,
        )
        self.client.force_login(self.other)
        self.assertEqual(
            self.client.get(f"/api/catalog/results/{id}/").status_code, 404
        )
        self.client.force_login(self.owner)
        self.assertEqual(self.action(id, "submit_review").json()["status"], "in_review")
        self.assertEqual(self.save_report(id).status_code, 400)
        self.client.force_login(self.other)
        self.assertEqual(
            self.client.get(f"/api/catalog/results/{id}/").status_code, 200
        )
        self.assertEqual(
            self.action(id, "reject", reviewNote="补充分析说明").json()["status"],
            "draft",
        )
        self.client.force_login(self.owner)
        self.assertEqual(
            self.client.get(f"/api/analysis/reports/{id}/").json()["reviewNote"],
            "补充分析说明",
        )
        self.assertEqual(self.save_report(id).status_code, 200)
        self.assertEqual(self.action(id, "submit_review").status_code, 200)
        self.client.force_login(self.other)
        self.assertEqual(
            self.action(id, "publish", accessGroupIds=[self.audience.id]).json()[
                "status"
            ],
            "published",
        )
        self.client.force_login(self.owner)
        self.assertEqual(self.save_report(id).status_code, 400)
        response = self.client.get(f"/api/catalog/results/{id}/file/?variant=artifact")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(b"".join(response.streaming_content).startswith(b"%PDF"))

    def test_invalid_images_and_cross_resource_access_are_rejected(self):
        self.assertEqual(self.save_report(pages=b"not a PNG").status_code, 400)
        doc = self.document()
        doc["figures"][0]["imageData"] = "https://example.com/a.png"
        self.assertEqual(self.save_report(document=doc).status_code, 400)
        self.client.force_login(self.other)
        self.assertEqual(self.save_report().status_code, 403)
        self.grant(self.other, "catalog", "add_resultartifact")
        self.grant(self.other, "catalog", "export_dataresource")
        self.assertEqual(self.save_report().status_code, 404)
        self.assertFalse(ResultArtifact.objects.exists())

    def test_external_pdf_uses_same_review_lifecycle(self):
        pdf = io.BytesIO()
        Image.new("RGB", (300, 424), "white").save(pdf, "PDF")
        response = self.client.post(
            "/api/catalog/results/",
            {
                "file": SimpleUploadedFile(
                    "report.pdf", pdf.getvalue(), "application/pdf"
                ),
                "payload": json.dumps(
                    {
                        "name": "外部报告",
                        "sourceType": "direct_import",
                        "resultType": "report",
                        "categoryCode": "thematic_community",
                        "accessGroupIds": [],
                        "reportKind": "nongeo",
                        "publish": False,
                    }
                ),
            },
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["status"], "draft")
        self.assertFalse(response.json()["canEditReport"])
        self.assertTrue(response.json()["canSubmitReview"])
        self.assertEqual(
            self.action(response.json()["id"], "submit_review").json()["status"],
            "in_review",
        )
