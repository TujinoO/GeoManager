from django.urls import path

from apps.raster import views


urlpatterns = [
    path("datasets/", views.datasets, name="raster-datasets"),
    path("import/", views.import_raster, name="raster-import"),
    path("scan/", views.scan_sources, name="raster-scan"),
    path("render/", views.render, name="raster-render"),
    path("render/async/", views.render_async, name="raster-render-async"),
    path("jobs/<str:job_id>/", views.job_status, name="raster-job-status"),
    path("png/<str:cache_key>", views.png, name="raster-png"),
    path("tiles/<int:dataset_id>/<str:style_hash>/<int:z>/<int:x>/<int:y>.png", views.tile, name="raster-tile"),
    path("cache/status/", views.cache_status, name="raster-cache-status"),
    path("cache/cleanup/", views.clear_cache, name="raster-cache-cleanup"),
]
