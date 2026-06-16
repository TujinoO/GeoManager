from django.urls import path

from apps.catalog import views


urlpatterns = [
    path("catalog/directories/", views.directories, name="catalog-directories"),
    path("catalog/resources/", views.resources, name="catalog-resources"),
    path("catalog/scan/", views.scan_sources, name="catalog-scan"),
    path(
        "catalog/import/preview/", views.import_preview, name="catalog-import-preview"
    ),
    path(
        "catalog/import/validate/",
        views.import_validate,
        name="catalog-import-validate",
    ),
    path("catalog/import/commit/", views.import_commit, name="catalog-import-commit"),
    path(
        "catalog/resources/<int:pk>/profile/",
        views.resource_profile,
        name="catalog-resource-profile",
    ),
    path(
        "catalog/resources/<int:pk>/query/",
        views.resource_query,
        name="catalog-resource-query",
    ),
    path("catalog/export/", views.export_loaded_layers, name="catalog-export"),
    path(
        "catalog/export/async/",
        views.export_loaded_layers_async,
        name="catalog-export-async",
    ),
    path(
        "catalog/export/jobs/<str:job_id>/download/",
        views.export_job_download,
        name="catalog-export-download",
    ),
    path("layers/", views.layers, name="layers"),
    path(
        "layers/<str:layer_name>/features/",
        views.layer_features,
        name="layer-features",
    ),
    path(
        "layers/<str:layer_name>/profile/",
        views.vector_layer_profile,
        name="layer-profile",
    ),
    path(
        "layers/<str:layer_name>/query/",
        views.vector_layer_query,
        name="layer-query",
    ),
    path("achievements/", views.achievements, name="achievements"),
    path("search/", views.search, name="search"),
]
