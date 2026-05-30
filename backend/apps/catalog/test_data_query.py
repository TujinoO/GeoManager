from django.test import SimpleTestCase

from apps.catalog.data_query import (
    DataQueryError,
    _coerce_value,
    _json_value,
    _limit,
    geometry_type,
    normalize_for_geojson,
)
from django.conf import settings
from unittest.mock import patch
import pandas as pd
import numpy as np
from datetime import datetime, date


class GeometryTypeTests(SimpleTestCase):
    def test_returns_empty_for_empty_gdf(self):
        import geopandas as gpd

        gdf = gpd.GeoDataFrame(columns=["geometry"])
        self.assertEqual(geometry_type(gdf), "")

    def test_returns_single_type(self):
        from shapely.geometry import Point
        import geopandas as gpd

        gdf = gpd.GeoDataFrame(geometry=[Point(0, 0), Point(1, 1)])
        self.assertEqual(geometry_type(gdf), "Point")

    def test_returns_mixed_for_multiple_types(self):
        from shapely.geometry import Point, LineString
        import geopandas as gpd

        gdf = gpd.GeoDataFrame(geometry=[Point(0, 0), LineString([(0, 0), (1, 1)])])
        self.assertEqual(geometry_type(gdf), "Mixed")


class LimitTests(SimpleTestCase):
    @patch("apps.catalog.data_query.settings")
    def test_returns_default_limit_when_none(self, mock_settings):
        mock_settings.PROJECT_CONFIG.limits.query_result_limit = 30000
        self.assertEqual(_limit(None), 30000)

    @patch("apps.catalog.data_query.settings")
    def test_returns_default_limit_when_zero(self, mock_settings):
        mock_settings.PROJECT_CONFIG.limits.query_result_limit = 30000
        self.assertEqual(_limit(0), 30000)

    @patch("apps.catalog.data_query.settings")
    def test_clamps_to_max_limit(self, mock_settings):
        mock_settings.PROJECT_CONFIG.limits.query_result_limit = 30000
        self.assertEqual(_limit(50000), 30000)

    @patch("apps.catalog.data_query.settings")
    def test_returns_valid_limit(self, mock_settings):
        mock_settings.PROJECT_CONFIG.limits.query_result_limit = 30000
        self.assertEqual(_limit(100), 100)


class CoerceValueTests(SimpleTestCase):
    def test_coerces_numeric_string(self):
        series = pd.Series([1, 2, 3])
        result = _coerce_value(series, "4")
        self.assertEqual(result, 4)

    def test_coerces_string_to_string(self):
        series = pd.Series(["a", "b", "c"])
        result = _coerce_value(series, "d")
        self.assertEqual(result, "d")

    def test_coerces_datetime(self):
        series = pd.to_datetime(pd.Series(["2025-01-01", "2025-01-02"]))
        result = _coerce_value(series, "2025-01-03")
        self.assertEqual(str(result), "2025-01-03 00:00:00")


class JsonValueTests(SimpleTestCase):
    def test_returns_none_for_nan(self):
        self.assertIsNone(_json_value(np.nan))

    def test_returns_none_for_none(self):
        self.assertIsNone(_json_value(None))

    def test_returns_isoformat_for_datetime(self):
        dt = datetime(2025, 1, 15, 10, 30)
        self.assertEqual(_json_value(dt), "2025-01-15T10:30:00")

    def test_returns_isoformat_for_date(self):
        d = date(2025, 1, 15)
        self.assertEqual(_json_value(d), "2025-01-15")

    def test_converts_numpy_types(self):
        self.assertEqual(_json_value(np.int64(42)), 42)
        self.assertEqual(_json_value(np.float64(3.14)), 3.14)

    def test_returns_regular_values_unchanged(self):
        self.assertEqual(_json_value("hello"), "hello")
        self.assertEqual(_json_value(42), 42)
        self.assertEqual(_json_value(3.14), 3.14)


class NormalizeForGeojsonTests(SimpleTestCase):
    def test_normalizes_datetime_columns(self):
        import geopandas as gpd
        from shapely.geometry import Point

        gdf = gpd.GeoDataFrame(
            {"name": ["A"], "date": pd.to_datetime(["2025-01-01"]), "geometry": [Point(0, 0)]}
        )
        result = normalize_for_geojson(gdf)
        self.assertEqual(result["date"].iloc[0], "2025-01-01")

    def test_preserves_non_datetime_columns(self):
        import geopandas as gpd
        from shapely.geometry import Point

        gdf = gpd.GeoDataFrame({"name": ["A"], "value": [42], "geometry": [Point(0, 0)]})
        result = normalize_for_geojson(gdf)
        self.assertEqual(result["name"].iloc[0], "A")
        self.assertEqual(result["value"].iloc[0], 42)
