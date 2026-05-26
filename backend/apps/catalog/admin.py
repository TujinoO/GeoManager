from django.contrib import admin

from apps.catalog.models import Achievement, DataCatalog, DataResource, DictionaryItem, MapLayer


@admin.register(DictionaryItem)
class DictionaryItemAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "dict_type", "sort_order", "is_active")
    list_filter = ("dict_type", "is_active")
    search_fields = ("name", "code")


@admin.register(DataResource)
class DataResourceAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "data_type", "category", "status", "updated_at")
    list_filter = ("data_type", "status", "category")
    search_fields = ("name", "code", "source", "provider")
    filter_horizontal = ("access_groups",)


@admin.register(DataCatalog)
class DataCatalogAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "parent", "sort_order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "code")
    filter_horizontal = ("resources", "access_groups")


@admin.register(MapLayer)
class MapLayerAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "layer_type", "category", "default_visible", "is_active", "updated_at")
    list_filter = ("layer_type", "is_active", "category")
    search_fields = ("name", "code")
    filter_horizontal = ("access_groups",)


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ("title", "code", "category", "status", "display_order", "updated_at")
    list_filter = ("status", "category")
    search_fields = ("title", "code", "source")
    filter_horizontal = ("access_groups",)

