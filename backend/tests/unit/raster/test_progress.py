from django.test import SimpleTestCase

from apps.raster.services.progress import (
    normalize_progress_text,
    parse_progress_percent,
)


class NormalizeProgressTextTests(SimpleTestCase):
    def test_strips_whitespace(self):
        self.assertEqual(normalize_progress_text("  hello  "), "hello")

    def test_collapses_whitespace(self):
        self.assertEqual(normalize_progress_text("hello   world"), "hello world")

    def test_replaces_carriage_return(self):
        self.assertEqual(normalize_progress_text("hello\rworld"), "hello world")

    def test_empty_string(self):
        self.assertEqual(normalize_progress_text(""), "")

    def test_only_whitespace(self):
        self.assertEqual(normalize_progress_text("   "), "")


class ParseProgressPercentTests(SimpleTestCase):
    def test_parses_percent_at_end(self):
        self.assertEqual(parse_progress_percent("progress 75%"), 75)

    def test_parses_percent_in_middle(self):
        self.assertEqual(parse_progress_percent("50% done"), 50)

    def test_returns_none_for_no_number(self):
        self.assertIsNone(parse_progress_percent("no numbers here"))

    def test_clamps_to_100(self):
        self.assertEqual(parse_progress_percent("100%"), 100)

    def test_ignores_numbers_above_100(self):
        self.assertIsNone(parse_progress_percent("value 200"))

    def test_detects_done_keyword(self):
        self.assertEqual(parse_progress_percent("all done"), 100)

    def test_prefers_last_valid_number(self):
        self.assertEqual(parse_progress_percent("10 then 80 then 50"), 50)
