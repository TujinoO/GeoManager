from __future__ import annotations

import hashlib
import math
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

from apps.core.config import load_runtime_config_document

THUMBNAIL_TILE_MAX_ZOOM = 12
THUMBNAIL_TILE_TIMEOUT_SECONDS = 8
THUMBNAIL_TILE_SIZE = 256
THUMBNAIL_MAX_MERCATOR_LAT = 85.05112878
MAPBOX_SATELLITE_STYLE = "mapbox/satellite-streets-v12"
OSM_TILE_URL_TEMPLATE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
MAPBOX_TILE_URL_TEMPLATE = (
    "https://api.mapbox.com/styles/v1/"
    f"{MAPBOX_SATELLITE_STYLE}/tiles/256/{{z}}/{{x}}/{{y}}@2x"
    "?access_token={token}"
)
OSM_TILE_SUBDOMAINS = ("a", "b", "c")


class ThumbnailTileError(RuntimeError):
    pass


def thumbnail_tile(z: int, x: int, y: int) -> tuple[bytes, str]:
    validate_tile_coordinates(z, x, y)
    url, cache_key = configured_tile_url(z, x, y)
    cache_path = thumbnail_cache_path(cache_key, z, x, y)
    if cache_path.exists():
        data = cache_path.read_bytes()
        return data, detect_image_content_type(data)

    try:
        data, content_type = fetch_tile(url)
    except ThumbnailTileError:
        stale = latest_cached_tile(cache_key, z, x, y)
        if stale is not None:
            data = stale.read_bytes()
            return data, detect_image_content_type(data)
        return generated_local_tile(z, x, y), "image/svg+xml"

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_bytes(data)
    return data, content_type


def validate_tile_coordinates(z: int, x: int, y: int) -> None:
    if z < 0 or z > THUMBNAIL_TILE_MAX_ZOOM:
        raise ValueError("缩略图瓦片层级超出范围")
    tile_count = 2**z
    if x < 0 or y < 0 or x >= tile_count or y >= tile_count:
        raise ValueError("缩略图瓦片坐标超出范围")


def configured_tile_url(z: int, x: int, y: int) -> tuple[str, str]:
    map_config = load_runtime_config_document(settings.PROJECT_CONFIG)["application"][
        "map"
    ]
    default_basemap = str(map_config.get("default_basemap", "osm")).strip()
    mapbox_access_token = str(map_config.get("mapbox_access_token", "")).strip()
    if mapbox_access_token and default_basemap != "osm":
        cache_key = cache_key_for("mapbox", MAPBOX_SATELLITE_STYLE, mapbox_access_token)
        return (
            MAPBOX_TILE_URL_TEMPLATE.format(z=z, x=x, y=y, token=mapbox_access_token),
            cache_key,
        )

    subdomain = OSM_TILE_SUBDOMAINS[(x + y) % len(OSM_TILE_SUBDOMAINS)]
    cache_key = cache_key_for("osm", "standard", "")
    return OSM_TILE_URL_TEMPLATE.format(s=subdomain, z=z, x=x, y=y), cache_key


def fetch_tile(url: str) -> tuple[bytes, str]:
    request = Request(
        url,
        headers={
            "User-Agent": "GeoManager thumbnail tile proxy",
            "Accept": "image/png,image/*;q=0.8,*/*;q=0.5",
        },
    )
    try:
        with urlopen(request, timeout=THUMBNAIL_TILE_TIMEOUT_SECONDS) as response:
            content_type = response.headers.get("Content-Type", "image/png")
            data = response.read()
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        raise ThumbnailTileError("缩略图瓦片源不可访问") from exc

    if not data:
        raise ThumbnailTileError("缩略图瓦片源返回空内容")
    declared_type = content_type.split(";", 1)[0].strip().lower()
    if not declared_type.startswith("image/"):
        raise ThumbnailTileError("缩略图瓦片源返回了非图片内容")
    return data, detect_image_content_type(data, declared_type)


def detect_image_content_type(data: bytes, declared_type: str = "image/png") -> str:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if len(data) >= 12 and data[4:8] == b"ftyp" and data[8:12] in (b"avif", b"avis"):
        return "image/avif"
    if data.lstrip().startswith((b"<svg", b"<?xml")):
        return "image/svg+xml"
    return declared_type if declared_type.startswith("image/") else "image/png"


def generated_local_tile(z: int, x: int, y: int) -> bytes:
    world_size = THUMBNAIL_TILE_SIZE * 2**z
    origin_x = x * THUMBNAIL_TILE_SIZE
    origin_y = y * THUMBNAIL_TILE_SIZE
    grid_paths = generated_grid_paths(world_size, origin_x, origin_y)
    land_paths = "\n".join(
        f'<path d="{polygon_to_tile_path(points, world_size, origin_x, origin_y)}" />'
        for points in fallback_land_polygons()
    )
    lake_paths = "\n".join(
        f'<path d="{polygon_to_tile_path(points, world_size, origin_x, origin_y)}" />'
        for points in fallback_water_polygons()
    )
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" data-local-basemap="world-mercator">
<rect width="256" height="256" fill="#b8dce8"/>
<g stroke="#7ba8b3" stroke-opacity=".24" stroke-width=".75" fill="none">{grid_paths}</g>
<g fill="#e7dfc7" stroke="#a5a98f" stroke-width=".9" stroke-linejoin="round" stroke-linecap="round">{land_paths}</g>
<g fill="#b8dce8" stroke="#7ba8b3" stroke-width=".45" stroke-linejoin="round">{lake_paths}</g>
</svg>"""
    return svg.encode("utf-8")


def generated_grid_paths(world_size: int, origin_x: int, origin_y: int) -> str:
    paths: list[str] = []
    for lng in range(-180, 181, 30):
        global_x, _ = lon_lat_to_world_pixel(lng, 0, world_size)
        tile_x = global_x - origin_x
        if -1 <= tile_x <= THUMBNAIL_TILE_SIZE + 1:
            paths.append(f'<path d="M{tile_x:.2f} 0V256"/>')
    for lat in range(-60, 61, 30):
        _, global_y = lon_lat_to_world_pixel(0, lat, world_size)
        tile_y = global_y - origin_y
        if -1 <= tile_y <= THUMBNAIL_TILE_SIZE + 1:
            paths.append(f'<path d="M0 {tile_y:.2f}H256"/>')
    return "".join(paths)


def polygon_to_tile_path(
    points: tuple[tuple[float, float], ...],
    world_size: int,
    origin_x: int,
    origin_y: int,
) -> str:
    commands = []
    for index, (lng, lat) in enumerate(points):
        world_x, world_y = lon_lat_to_world_pixel(lng, lat, world_size)
        tile_x = world_x - origin_x
        tile_y = world_y - origin_y
        command = "M" if index == 0 else "L"
        commands.append(f"{command}{tile_x:.2f} {tile_y:.2f}")
    commands.append("Z")
    return "".join(commands)


def lon_lat_to_world_pixel(
    lng: float, lat: float, world_size: int
) -> tuple[float, float]:
    clamped_lat = max(-THUMBNAIL_MAX_MERCATOR_LAT, min(THUMBNAIL_MAX_MERCATOR_LAT, lat))
    sin_lat = math.sin(math.radians(clamped_lat))
    return (
        ((lng + 180) / 360) * world_size,
        (0.5 - math.log((1 + sin_lat) / (1 - sin_lat)) / (4 * math.pi)) * world_size,
    )


def fallback_land_polygons() -> tuple[tuple[tuple[float, float], ...], ...]:
    return (
        (
            (-168, 71),
            (-145, 72),
            (-132, 69),
            (-124, 62),
            (-112, 60),
            (-107, 54),
            (-96, 50),
            (-92, 57),
            (-80, 55),
            (-65, 50),
            (-54, 47),
            (-60, 42),
            (-74, 40),
            (-81, 32),
            (-97, 25),
            (-105, 20),
            (-117, 23),
            (-125, 32),
            (-124, 43),
            (-134, 52),
            (-151, 58),
            (-168, 60),
            (-168, 71),
        ),
        (
            (-52, 82),
            (-35, 80),
            (-22, 73),
            (-24, 63),
            (-42, 60),
            (-55, 66),
            (-61, 75),
            (-52, 82),
        ),
        (
            (-81, 12),
            (-70, 11),
            (-60, 5),
            (-50, -5),
            (-38, -12),
            (-42, -24),
            (-54, -34),
            (-58, -48),
            (-67, -55),
            (-74, -42),
            (-76, -25),
            (-81, -10),
            (-81, 12),
        ),
        (
            (-10, 36),
            (-9, 43),
            (0, 50),
            (16, 55),
            (31, 59),
            (46, 66),
            (75, 71),
            (103, 73),
            (136, 69),
            (165, 62),
            (180, 55),
            (170, 48),
            (148, 45),
            (135, 40),
            (124, 37),
            (118, 25),
            (106, 21),
            (101, 8),
            (94, 14),
            (88, 22),
            (78, 29),
            (68, 25),
            (58, 28),
            (49, 31),
            (39, 36),
            (30, 41),
            (20, 39),
            (12, 44),
            (3, 42),
            (-5, 37),
            (-10, 36),
        ),
        (
            (-17, 36),
            (-5, 37),
            (10, 33),
            (25, 31),
            (34, 28),
            (43, 12),
            (51, 11),
            (48, -5),
            (40, -15),
            (35, -28),
            (25, -35),
            (15, -35),
            (5, -30),
            (-5, -20),
            (-12, -5),
            (-17, 12),
            (-17, 36),
        ),
        ((35, 32), (52, 30), (58, 22), (52, 13), (43, 12), (39, 21), (35, 32)),
        ((68, 24), (78, 29), (90, 22), (88, 9), (80, 7), (74, 15), (68, 24)),
        ((95, 22), (108, 22), (110, 12), (104, 1), (97, 7), (95, 22)),
        (
            (112, -11),
            (125, -13),
            (142, -11),
            (154, -24),
            (147, -39),
            (131, -44),
            (115, -34),
            (112, -20),
            (112, -11),
        ),
        (
            (-180, -70),
            (-120, -73),
            (-60, -72),
            (0, -75),
            (70, -72),
            (140, -73),
            (180, -70),
            (180, -85),
            (-180, -85),
            (-180, -70),
        ),
        (
            (129, 32),
            (135, 35),
            (142, 41),
            (145, 45),
            (141, 46),
            (136, 41),
            (130, 34),
            (129, 32),
        ),
        ((-10, 50), (-2, 50), (1, 58), (-6, 59), (-10, 54), (-10, 50)),
        (
            (95, 5),
            (110, 3),
            (124, 0),
            (140, -4),
            (132, -9),
            (113, -7),
            (100, -3),
            (95, 5),
        ),
        ((166, -34), (178, -38), (174, -46), (166, -47), (166, -34)),
        ((43, -12), (50, -15), (50, -25), (44, -26), (43, -12)),
        ((-25, 66), (-14, 66), (-13, 63), (-23, 63), (-25, 66)),
    )


def fallback_water_polygons() -> tuple[tuple[tuple[float, float], ...], ...]:
    return (
        ((47, 47), (53, 46), (54, 40), (51, 36), (47, 37), (46, 42), (47, 47)),
        ((58, 46), (61, 46), (61, 44), (58, 44), (58, 46)),
        ((73, 47), (80, 46), (78, 45), (73, 45), (73, 47)),
        ((76, 43), (78, 43), (78, 42), (76, 42), (76, 43)),
        ((29, 46), (32, 46), (32, 41), (29, 41), (29, 46)),
    )


def cache_key_for(provider: str, style: str, token: str) -> str:
    digest = hashlib.sha256(f"{provider}:{style}:{token}".encode()).hexdigest()[:16]
    return f"{provider}-{digest}"


def thumbnail_cache_path(cache_key: str, z: int, x: int, y: int) -> Path:
    return settings.PROJECT_CONFIG.app_path(
        "media",
        "map-thumbnail-tiles",
        cache_key,
        str(z),
        str(x),
        f"{y}.png",
    )


def latest_cached_tile(cache_key: str, z: int, x: int, y: int) -> Path | None:
    path = thumbnail_cache_path(cache_key, z, x, y)
    return path if path.exists() else None
