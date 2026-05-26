from django.contrib import admin

from apps.raster.models import RasterCacheRecord


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

