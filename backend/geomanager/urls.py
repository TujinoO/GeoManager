from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path, re_path

from apps.core.views import frontend_app


urlpatterns = [
    path("api/", include("apps.core.urls")),
    path("api/", include("apps.catalog.urls")),
    path("api/raster/", include("apps.raster.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

urlpatterns += [
    re_path(r"^(?!api/|static/|media/|admin2/).*$", frontend_app, name="frontend-app"),
]
