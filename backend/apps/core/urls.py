from django.urls import path

from apps.core import auth_views, views


urlpatterns = [
    path("bootstrap/", views.bootstrap, name="bootstrap"),
    path("health/", views.health, name="health"),
    path("auth/csrf/", auth_views.csrf_cookie, name="csrf"),
    path("auth/login/", auth_views.login_view, name="login"),
    path("auth/logout/", auth_views.logout_view, name="logout"),
    path("auth/me/", auth_views.me_view, name="me"),
]

