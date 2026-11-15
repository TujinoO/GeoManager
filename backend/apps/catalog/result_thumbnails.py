"""Private, derived JPEG covers; callers must authorize the source before use."""

from __future__ import annotations

import hashlib
import os
from contextlib import closing
from pathlib import Path
import tempfile
import threading

from django.http import FileResponse, HttpResponseNotModified, JsonResponse
from django.utils.http import parse_etags
from PIL import Image, ImageOps
import pypdfium2 as pdfium

from apps.core.storage import app_path

MAX_SIDE = 480
JPEG_QUALITY = 60
RENDERER_VERSION = 1
_LOCKS = tuple(threading.Lock() for _ in range(32))
# PDFium is not thread-safe, including operations on different documents.
_PDF_LOCK = threading.Lock()


def thumbnail_response(request, source: Path, filename: str):
    stat = source.stat()
    identity = (
        f"{source.resolve()}:{stat.st_mtime_ns}:{stat.st_size}:"
        f"{RENDERER_VERSION}:{MAX_SIDE}:{JPEG_QUALITY}"
    )
    key = hashlib.sha256(identity.encode()).hexdigest()
    etag = f'"{key}"'
    if etag in parse_etags(request.headers.get("If-None-Match", "")):
        response = HttpResponseNotModified()
    else:
        target = app_path("cache", "result-thumbnails", key[:2], f"{key}.jpg")
        try:
            with _LOCKS[int(key[:2], 16) % len(_LOCKS)]:
                if not target.is_file():
                    _generate(source, target)
            response = FileResponse(
                target.open("rb"),
                content_type="image/jpeg",
                filename=f"{Path(filename).stem}_thumbnail.jpg",
            )
        except (OSError, ValueError, RuntimeError, Image.DecompressionBombError):
            return JsonResponse({"detail": "无法生成成果缩略图"}, status=400)
    response["ETag"] = etag
    response["Cache-Control"] = "private, no-cache"
    response["Vary"] = "Cookie"
    response["X-Content-Type-Options"] = "nosniff"
    response["X-Frame-Options"] = "SAMEORIGIN"
    response["Content-Security-Policy"] = (
        "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'"
    )
    response["Referrer-Policy"] = "no-referrer"
    return response


def _generate(source: Path, target: Path) -> None:
    if source.suffix.lower() == ".pdf":
        with _PDF_LOCK:
            with pdfium.PdfDocument(str(source)) as document:
                if not len(document):
                    raise ValueError("PDF没有页面")
                with closing(document[0]) as page:
                    width, height = page.get_size()
                    if min(width, height) <= 0:
                        raise ValueError("PDF页面尺寸无效")
                    with closing(
                        page.render(scale=min(1, MAX_SIDE / max(width, height)))
                    ) as bitmap:
                        image = bitmap.to_pil().copy()
    else:
        with Image.open(source) as original:
            # JPEG decoding can downsample before allocating the full bitmap.
            original.draft("RGB", (MAX_SIDE, MAX_SIDE))
            original.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
            image = ImageOps.exif_transpose(original)
    try:
        image.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
        with Image.new("RGB", image.size, "white") as cover:
            if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
                with image.convert("RGBA") as rgba:
                    cover.paste(rgba, mask=rgba.getchannel("A"))
            else:
                cover.paste(image)
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(
                    dir=target.parent, suffix=".tmp", delete=False
                ) as handle:
                    temporary = Path(handle.name)
                    cover.save(
                        handle, format="JPEG", quality=JPEG_QUALITY, optimize=True
                    )
                os.replace(temporary, target)
            finally:
                if temporary is not None:
                    temporary.unlink(missing_ok=True)
    finally:
        image.close()
