from django.contrib import admin

from apps.raster.models import RasterDataset


@admin.register(RasterDataset)
class RasterDatasetAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "status", "band_count", "source_relative_path", "processed_at", "imported_at")
    list_filter = ("status", "imported_at", "processed_at")
    search_fields = ("name", "code", "source_relative_path", "processed_relative_path", "error_message")
    readonly_fields = (
        "source_gdalinfo",
        "processed_gdalinfo",
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
