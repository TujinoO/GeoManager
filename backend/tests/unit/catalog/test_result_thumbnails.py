from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from io import BytesIO
import threading
from unittest.mock import patch

from django.test import RequestFactory, override_settings
from PIL import Image

from apps.catalog.result_thumbnails import _generate, thumbnail_response


def test_transparency_is_composited_on_white_and_small_images_are_not_upscaled(
    tmp_path,
):
    source, target = tmp_path / "alpha.png", tmp_path / "thumbnail.jpg"
    with Image.new("RGBA", (120, 80), (0, 0, 0, 0)) as image:
        image.save(source)
    original = source.read_bytes()
    _generate(source, target)
    with Image.open(target) as image:
        assert image.size == (120, 80)
        assert image.getpixel((60, 40)) == (255, 255, 255)
    assert source.read_bytes() == original


def test_concurrent_requests_generate_one_atomic_cached_cover(tmp_path, settings):
    source = tmp_path / "large.png"
    with Image.new("RGB", (1600, 1200), "green") as image:
        image.save(source)
    start = threading.Barrier(4)

    def read_cover():
        start.wait(timeout=10)
        response = thumbnail_response(RequestFactory().get("/"), source, source.name)
        try:
            return b"".join(response.streaming_content)
        finally:
            response.close()

    with override_settings(
        PROJECT_CONFIG=replace(settings.PROJECT_CONFIG, app_data=tmp_path / "app")
    ):
        with patch(
            "apps.catalog.result_thumbnails._generate", wraps=_generate
        ) as generate:
            with ThreadPoolExecutor(max_workers=4) as pool:
                covers = list(pool.map(lambda _: read_cover(), range(4)))
            assert generate.call_count == 1
    assert len(set(covers)) == 1
    with Image.open(BytesIO(covers[0])) as image:
        assert image.size == (480, 360)
    assert not list(tmp_path.rglob("*.tmp"))
