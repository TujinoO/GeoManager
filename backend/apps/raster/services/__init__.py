from apps.raster.services.cache import cache_file_size, cleanup_png_cache
from apps.raster.services.catalog_sync import upsert_catalog_records
from apps.raster.services.color_mapping import (
    array_to_rgba,
    colorize_gray_png,
    hex_to_rgba,
    palette_array,
    scale_array,
)
from apps.raster.services.constants import (
    DEFAULT_TILE_SIZE,
    PALETTES,
    RASTER_EXTENSIONS,
    UNIQUE_COLORS,
    WEB_MERCATOR_HALF_WORLD,
)
from apps.raster.services.exceptions import (
    RasterImportError,
    RasterJobError,
    RasterRenderError,
)
from apps.raster.services.gdal_ops import gdal_translate_command, gdalinfo_json, run_gdal_command
from apps.raster.services.geo_utils import (
    bounds_4326_from_gdalinfo,
    bounds_from_gdalinfo,
    cache_key_for,
    image_coordinates_from_gdalinfo,
    intersects_bounds,
    style_hash_for,
    tile_bounds_3857,
    transparent_png,
)
from apps.raster.services.importer import (
    append_dataset_progress,
    dataset_for_layer,
    handle_import_progress,
    import_raster_file,
    is_raster_file,
    metadata_relative_path,
    processed_relative_path,
    save_metadata,
    scan_unprocessed_source_files,
    scan_unprocessed_source_files_safely,
    stable_code,
    store_source_file,
)
from apps.raster.services.jobs import (
    RasterJob,
    get_job,
    start_import_job,
    start_render_job,
    start_scan_job,
)
from apps.raster.services.profile import dataset_for_resource, get_raster_profile
from apps.raster.services.renderer import (
    register_tile_style,
    render_dataset_png,
    render_layer_png,
    render_png_with_gdal_translate,
    render_xyz_tile,
)
from apps.raster.services.rules_engine import (
    band_min_max,
    default_raster_rules,
    default_unique_values,
    normalize_rules,
    normalize_stretch_bands,
    normalize_unique_values,
    output_source_bands,
    stretch_min_max,
)
from apps.raster.services.serializers import (
    compact_raster_metadata,
    render_result,
    serialize_raster_dataset,
)

__all__ = [
    # exceptions
    "RasterRenderError",
    "RasterImportError",
    "RasterJobError",
    # constants
    "RASTER_EXTENSIONS",
    "WEB_MERCATOR_HALF_WORLD",
    "DEFAULT_TILE_SIZE",
    "PALETTES",
    "UNIQUE_COLORS",
    # jobs
    "RasterJob",
    "start_import_job",
    "start_scan_job",
    "start_render_job",
    "get_job",
    # importer
    "scan_unprocessed_source_files",
    "scan_unprocessed_source_files_safely",
    "import_raster_file",
    "is_raster_file",
    "store_source_file",
    "processed_relative_path",
    "metadata_relative_path",
    "stable_code",
    "gdalinfo_json",
    "save_metadata",
    "run_gdal_command",
    "handle_import_progress",
    "append_dataset_progress",
    "upsert_catalog_records",
    # renderer
    "render_layer_png",
    "render_dataset_png",
    "register_tile_style",
    "render_xyz_tile",
    "render_png_with_gdal_translate",
    "gdal_translate_command",
    # serializers
    "serialize_raster_dataset",
    "compact_raster_metadata",
    "render_result",
    # importer (dataset lookup)
    "dataset_for_layer",
    "dataset_for_resource",
    "get_raster_profile",
    # cache
    "cleanup_png_cache",
    "cache_file_size",
    # rules engine
    "default_raster_rules",
    "normalize_rules",
    "normalize_stretch_bands",
    "normalize_unique_values",
    "default_unique_values",
    "band_min_max",
    "output_source_bands",
    "stretch_min_max",
    # color mapping
    "colorize_gray_png",
    "array_to_rgba",
    "scale_array",
    "palette_array",
    "hex_to_rgba",
    # geo utils
    "bounds_from_gdalinfo",
    "bounds_4326_from_gdalinfo",
    "image_coordinates_from_gdalinfo",
    "cache_key_for",
    "style_hash_for",
    "tile_bounds_3857",
    "intersects_bounds",
    "transparent_png",
]
