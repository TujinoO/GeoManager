from django.contrib import admin

from apps.raster.models import RasterCacheRecord, RasterDataset


@admin.register(RasterDataset)
class RasterDatasetAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "status", "band_count", "source_relative_path", "processed_at", "imported_at")
    list_filter = ("status", "imported_at", "processed_at")
    search_fields = ("name", "code", "source_relative_path", "processed_relative_path", "error_message")
    readonly_fields = (
        "source_gdalinfo",
        "processed_gdalinfo",
        "default_rules",
        "bounds_3857",
        "bounds_4326",
        "image_coordinates",
        "source_file_size",
        "processed_file_size",
        "progress_log",
        "error_message",
        "imported_at",
        "processed_at",
        "updated_at",
    )


@admin.register(RasterCacheRecord)
class RasterCacheRecordAdmin(admin.ModelAdmin):
    list_display = ("cache_key", "layer", "status", "file_size", "output_width", "output_height", "last_accessed_at")
    list_filter = ("status", "created_at", "last_accessed_at")
    search_fields = ("cache_key", "raster_relative_path", "png_relative_path", "error_message")
    readonly_fields = (
        "cache_key",
        "layer",
        "data_resource",
        "raster_relative_path",
        "png_relative_path",
        "rules",
        "output_width",
        "output_height",
        "file_size",
        "status",
        "error_message",
        "created_at",
        "last_accessed_at",
    )
