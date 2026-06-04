import json
from pathlib import Path

from django.test import SimpleTestCase

from apps.catalog.export import (
    ExportError,
    export_layers_zip,
    export_vector_geojson,
    safe_filename,
    validate_epsg,
    write_cutline,
)


class SafeFilenameTests(SimpleTestCase):
    def test_removes_special_characters(self):
        self.assertEqual(safe_filename("test file!@#"), "test-file")

    def test_preserves_chinese_characters(self):
        self.assertEqual(safe_filename("测试数据"), "测试数据")

    def test_preserves_dots_and_hyphens(self):
        self.assertEqual(safe_filename("test-file_v2.shp"), "test-file_v2.shp")

    def test_limits_length_to_80(self):
        long_name = "a" * 100
        result = safe_filename(long_name)
        self.assertLessEqual(len(result), 80)

    def test_returns_layer_for_empty_result(self):
        self.assertEqual(safe_filename("!@#$%^&*"), "layer")

    def test_strips_leading_trailing_dots_and_hyphens(self):
        self.assertEqual(safe_filename(".-test-."), "test")


class ValidateEpsgTests(SimpleTestCase):
    def test_validates_valid_epsg(self):
        self.assertEqual(validate_epsg(4326), 4326)
        self.assertEqual(validate_epsg(3857), 3857)

    def test_rejects_low_epsg(self):
        with self.assertRaises(Exception):
            validate_epsg(100)

    def test_rejects_high_epsg(self):
        with self.assertRaises(Exception):
            validate_epsg(1000000)

    def test_rejects_non_numeric(self):
        with self.assertRaises(Exception):
            validate_epsg("invalid")


class ExportVectorGeojsonTests(SimpleTestCase):
    def test_exports_empty_feature_collection(self):
        output = Path("/tmp/test_export.geojson")
        try:
            export_vector_geojson(
                {"type": "FeatureCollection", "features": []},
                4326,
                output,
            )
            data = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(data["type"], "FeatureCollection")
            self.assertEqual(data["features"], [])
        finally:
            output.unlink(missing_ok=True)

    def test_rejects_invalid_geojson(self):
        output = Path("/tmp/test_export.geojson")
        with self.assertRaises(ExportError):
            export_vector_geojson("not a dict", 4326, output)

    def test_rejects_non_feature_collection(self):
        output = Path("/tmp/test_export.geojson")
        with self.assertRaises(ExportError):
            export_vector_geojson({"type": "Feature"}, 4326, output)


class WriteCutlineTests(SimpleTestCase):
    def test_writes_valid_cutline(self):
        geometry = {
            "type": "Polygon",
            "coordinates": [[[80, 40], [80, 45], [85, 45], [85, 40], [80, 40]]],
        }
        root = Path("/tmp")
        path = write_cutline(root, geometry)
        try:
            self.assertTrue(path.exists())
            data = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(data["type"], "FeatureCollection")
            self.assertEqual(len(data["features"]), 1)
            self.assertEqual(data["features"][0]["geometry"]["type"], "Polygon")
        finally:
            path.unlink(missing_ok=True)

    def test_rejects_non_polygon_geometry(self):
        geometry = {"type": "Point", "coordinates": [80, 40]}
        root = Path("/tmp")
        with self.assertRaises(ExportError):
            write_cutline(root, geometry)

    def test_rejects_invalid_geometry(self):
        root = Path("/tmp")
        with self.assertRaises(ExportError):
            write_cutline(root, "not a dict")


class ExportLayersZipTests(SimpleTestCase):
    def test_rejects_empty_items(self):
        with self.assertRaises(ExportError):
            export_layers_zip([], 4326)

    def test_rejects_invalid_epsg_with_reproject(self):
        items = [
            {
                "layerType": "vector",
                "name": "test",
                "geojson": {"type": "FeatureCollection", "features": []},
            }
        ]
        with self.assertRaises(ExportError):
            export_layers_zip(items, 100, reproject=True)

    def test_exports_vector_layer(self):
        items = [
            {
                "layerType": "vector",
                "name": "测试图层",
                "geojson": {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "properties": {"name": "test"},
                            "geometry": {"type": "Point", "coordinates": [80, 40]},
                        }
                    ],
                },
            }
        ]
        result = export_layers_zip(items, 4326, reproject=False)
        self.assertIsInstance(result, bytes)
        self.assertTrue(len(result) > 0)

    def test_rejects_unsupported_layer_type(self):
        items = [{"layerType": "unknown", "name": "test"}]
        with self.assertRaises(ExportError):
            export_layers_zip(items, 4326, reproject=False)
