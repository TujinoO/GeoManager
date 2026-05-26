from django.urls import path

from apps.raster import views


urlpatterns = [
    path("render/", views.render, name="raster-render"),
    path("png/<str:cache_key>", views.png, name="raster-png"),
    path("cache/status/", views.cache_status, name="raster-cache-status"),
    path("cache/cleanup/", views.clear_cache, name="raster-cache-cleanup"),
]

