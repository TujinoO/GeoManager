import os
from pathlib import Path

from apps.core.config import ConfigValidationError, load_project_config
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
PROGRAM_ROOT = BASE_DIR.parent
CONFIG_PATH = Path(os.environ.get("APP_CONFIG", PROGRAM_ROOT / "config" / "app.example.toml"))

try:
    PROJECT_CONFIG = load_project_config(CONFIG_PATH, program_root=PROGRAM_ROOT)
except ConfigValidationError as exc:
    raise ImproperlyConfigured(str(exc)) from exc


def _get_secret_key() -> str:
    env_key = os.environ.get("DJANGO_SECRET_KEY")
    if env_key:
        return env_key
    key_file = PROJECT_CONFIG.business_path("database", ".secret_key")
    if key_file.exists():
        return key_file.read_text().strip()
    from django.core.management.utils import get_random_secret_key

    key = get_random_secret_key()
    key_file.parent.mkdir(parents=True, exist_ok=True)
    key_file.write_text(key)
    return key


SECRET_KEY = _get_secret_key()
DEBUG = PROJECT_CONFIG.mode == "development"
ALLOWED_HOSTS = [h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",") if h.strip()]

_env_csrf_origins = os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "")
if _env_csrf_origins:
    CSRF_TRUSTED_ORIGINS = [o.strip() for o in _env_csrf_origins.split(",") if o.strip()]
else:
    CSRF_TRUSTED_ORIGINS = [origin for host in ALLOWED_HOSTS if host != "*" for origin in (f"http://{host}", f"https://{host}")]

INSTALLED_APPS = [
    "apps.core.admin_config.HuyangAdminConfig",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "apps.core",
    "apps.catalog",
    "apps.raster",
    "apps.audit",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.core.middleware.AdminAccessPermissionMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "data_sharing_platform.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "data_sharing_platform.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": PROJECT_CONFIG.business_path("database", "data.sqlite3"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "zh-hans"
TIME_ZONE = "Asia/Shanghai"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = PROJECT_CONFIG.business_path("static")
MEDIA_URL = "media/"
MEDIA_ROOT = PROJECT_CONFIG.business_path("media")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LOGIN_URL = "/"
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
