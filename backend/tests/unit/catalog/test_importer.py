import pandas as pd
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase

from apps.catalog.importer import (
    ImportDataError,
    _included_columns,
    _metadata_map,
    infer_coordinate_columns,
    normalize_dataframe,
    read_uploaded_table,
    validate_import_table_name,
    validate_uploaded_table,
)


class ImporterUnitTests(SimpleTestCase):
    def test_normalize_dataframe_trims_values_and_deduplicates_columns(self):
        df = pd.DataFrame(
            [[" 样点A ", "", None]],
            columns=["name", "name", ""],
        )

        normalized = normalize_dataframe(df)

        self.assertEqual(list(normalized.columns), ["name", "name_2", "column_3"])
        self.assertEqual(normalized.iloc[0].tolist(), ["样点A", "", ""])

    def test_infer_coordinate_columns_detects_chinese_aliases(self):
        df = pd.DataFrame(
            {
                "样点": ["A"],
                "经度": ["87.600"],
                "纬度": ["43.800"],
            }
        )

        longitude, latitude = infer_coordinate_columns(df)

        self.assertEqual(longitude, "经度")
        self.assertEqual(latitude, "纬度")

    def test_validate_table_mode_skips_coordinate_validation(self):
        result = validate_uploaded_table(
            self._csv_file("survey.csv", "name,lon,lat\nA,181.000,\n"),
            {"importMode": "table"},
        )

        self.assertEqual(result, {"coordinateStats": None, "validationIssues": []})

    def test_validate_rejects_unknown_import_mode(self):
        with self.assertRaisesRegex(
            ImportDataError, "导入方式必须是 geographic 或 table"
        ):
            validate_uploaded_table(
                self._csv_file("survey.csv", "name\nA\n"),
                {"importMode": "unsupported"},
            )

    def test_included_columns_keep_required_coordinate_columns(self):
        selected = _included_columns(
            ["name"],
            ["name", "lon", "lat", "note"],
            required_columns={"lon", "lat"},
        )

        self.assertEqual(selected, ["name", "lon", "lat"])

    def test_included_columns_reject_unknown_columns(self):
        with self.assertRaisesRegex(ImportDataError, "上传字段不存在：missing"):
            _included_columns(["name", "missing"], ["name", "value"])

    def test_metadata_map_rejects_invalid_json(self):
        with self.assertRaisesRegex(ImportDataError, "字段元数据不是有效 JSON"):
            _metadata_map("{bad-json", {"name"})

    def test_metadata_map_ignores_unknown_columns(self):
        metadata = _metadata_map({"name": "样点名称", "extra": "忽略"}, {"name"})

        self.assertEqual(metadata, {"name": "样点名称"})

    def test_validate_import_table_name_rejects_unsafe_names(self):
        unsafe_names = ["1bad", "has-dash", "含中文", "a" * 64]

        for table_name in unsafe_names:
            with self.subTest(table_name=table_name):
                with self.assertRaises(ImportDataError):
                    validate_import_table_name(table_name)

    def test_read_uploaded_table_rejects_empty_file(self):
        with self.assertRaisesRegex(ImportDataError, "上传文件为空"):
            read_uploaded_table(self._csv_file("empty.csv", ""))

    def test_read_uploaded_table_rejects_unsupported_extension(self):
        with self.assertRaisesRegex(ImportDataError, "仅支持 .csv、.xls、.xlsx 文件"):
            read_uploaded_table(
                SimpleUploadedFile(
                    "survey.txt", b"name\nA\n", content_type="text/plain"
                )
            )

    def _csv_file(self, name: str, content: str) -> SimpleUploadedFile:
        return SimpleUploadedFile(
            name, content.encode("utf-8"), content_type="text/csv"
        )
