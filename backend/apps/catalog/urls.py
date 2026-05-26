from django.urls import path

from apps.catalog import views


urlpatterns = [
    path("catalog/directories/", views.directories, name="catalog-directories"),
    path("catalog/resources/", views.resources, name="catalog-resources"),
    path("catalog/resources/<int:pk>/profile/", views.resource_profile, name="catalog-resource-profile"),
    path("catalog/resources/<int:pk>/query/", views.resource_query, name="catalog-resource-query"),
    path("layers/", views.layers, name="layers"),
    path("layers/<int:pk>/features/", views.layer_features, name="layer-features"),
    path("achievements/", views.achievements, name="achievements"),
    path("search/", views.search, name="search"),
]
