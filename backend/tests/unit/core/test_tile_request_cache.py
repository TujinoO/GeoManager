from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Event
from unittest import TestCase
from unittest.mock import patch
from io import BytesIO
from urllib.response import addinfourl

from apps.core import map_thumbnail as tiles


class TileRequestCacheTests(TestCase):
    def test_rejects_html_mislabeled_as_an_image(self):
        response = addinfourl(
            BytesIO(b"<html>provider denied</html>"),
            {"Content-Type": "image/png"},
            "https://example.test/tile",
            200,
        )
        with patch.object(tiles, "urlopen", return_value=response):
            with self.assertRaisesRegex(tiles.ThumbnailTileError, "无效图片"):
                tiles.fetch_tile("https://example.test/tile")

    def test_waiter_timeout_is_a_structured_export_error(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "timeout.png"
            future = tiles.Future()
            tiles._inflight_tiles[str(path)] = future
            try:
                with (
                    patch.object(
                        tiles,
                        "configured_tile_url",
                        return_value=("https://example.test/tile", "test"),
                    ),
                    patch.object(tiles, "thumbnail_cache_path", return_value=path),
                    patch.object(future, "result", side_effect=TimeoutError),
                ):
                    with self.assertRaises(tiles.ThumbnailTileError):
                        tiles.thumbnail_tile(3, 5, 3, allow_fallback=False)
            finally:
                tiles._inflight_tiles.pop(str(path), None)

    def test_concurrent_requests_fetch_once_and_publish_complete_cache(self):
        started, release = Event(), Event()
        data = tiles.generated_local_tile(3, 5, 3)

        def fetch(*args, **kwargs):
            started.set()
            release.wait(3)
            return data, "image/png"

        with TemporaryDirectory() as directory:
            path = Path(directory) / "tile.png"
            with (
                patch.object(
                    tiles,
                    "configured_tile_url",
                    return_value=("https://example.test/tile", "test"),
                ),
                patch.object(tiles, "thumbnail_cache_path", return_value=path),
                patch.object(tiles, "fetch_tile", side_effect=fetch) as upstream,
            ):
                with ThreadPoolExecutor(max_workers=6) as executor:
                    first = executor.submit(
                        tiles.thumbnail_tile, 3, 5, 3, allow_fallback=False
                    )
                    self.assertTrue(started.wait(2))
                    remaining = [
                        executor.submit(
                            tiles.thumbnail_tile, 3, 5, 3, allow_fallback=False
                        )
                        for _ in range(5)
                    ]
                    release.set()
                    for result in [first, *remaining]:
                        self.assertEqual(
                            result.result(timeout=4), (data, "image/png", False)
                        )
                self.assertEqual(path.read_bytes(), data)
                upstream.assert_called_once()
                self.assertEqual(list(Path(directory).glob("*.tmp")), [])

    def test_negative_cache_prevents_retry_storm_and_export_never_uses_placeholder(
        self,
    ):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "tile.png"
            with (
                patch.object(
                    tiles,
                    "configured_tile_url",
                    return_value=("https://example.test/tile", "test"),
                ),
                patch.object(tiles, "thumbnail_cache_path", return_value=path),
                patch.object(
                    tiles, "fetch_tile", side_effect=tiles.ThumbnailTileError("offline")
                ) as upstream,
            ):
                for _ in range(3):
                    with self.assertRaises(tiles.ThumbnailTileError):
                        tiles.thumbnail_tile(3, 5, 3, allow_fallback=False)
                _, mime, fallback = tiles.thumbnail_tile(3, 5, 3)
                self.assertEqual(mime, "image/png")
                self.assertTrue(fallback)
                upstream.assert_called_once()
                self.assertFalse(path.exists())
