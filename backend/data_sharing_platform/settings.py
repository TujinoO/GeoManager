import os
from pathlib import Path

from apps.core.config import ConfigValidationError, load_project_config
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
PROGRAM_ROOT = BASE_DIR.parent

_app_config = os.environ.get("APP_CONFIG")
if not _app_config:
    raise ImproperlyConfigured(
        "环境变量 APP_CONFIG 未设置。请在 .env 文件或系统环境变量中指定 TOML 配置文件路径。"
    )
CONFIG_PATH = Path(_app_config)

try:
    PROJECT_CONFIG = load_project_config(CONFIG_PATH, program_root=PROGRAM_ROOT)
except ConfigValidationError as exc:
    raise ImproperlyConfigured(str(exc)) from exc


def _get_secret_key() -> str:
    env_key = os.environ.get("DJANGO_SECRET_KEY")
    if env_key:
        return env_key
    key_file = PROJECT_CONFIG.app_path("database", ".secret_key")
    if key_file.exists():
        return key_file.read_text().strip()
    from django.core.management.utils import get_random_secret_key

    key = get_random_secret_key()
    key_file.parent.mkdir(parents=True, exist_ok=True)
    key_file.write_text(key)
    return key


SECRET_KEY = _get_secret_key()
DEBUG = os.environ.get("DEBUG", "False").lower() in ("true", "1", "yes")
ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")
    if h.strip()
]


def _default_csrf_trusted_origins(allowed_hosts: list[str], debug: bool) -> list[str]:
    origins = {
        origin
        for host in allowed_hosts
        if host != "*"
        for origin in (f"http://{host}", f"https://{host}")
    }
    if debug:
        origins.update(
            {
                "http://127.0.0.1:5173",
                "http://localhost:5173",
            }
        )
    return sorted(origins)


_env_csrf_origins = os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "")
if _env_csrf_origins:
    CSRF_TRUSTED_ORIGINS = [
        o.strip() for o in _env_csrf_origins.split(",") if o.strip()
    ]
else:
    CSRF_TRUSTED_ORIGINS = _default_csrf_trusted_origins(ALLOWED_HOSTS, DEBUG)

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
        "NAME": PROJECT_CONFIG.app_path("database", "data.sqlite3"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 6},
    },
]

LANGUAGE_CODE = "zh-hans"
TIME_ZONE = "Asia/Shanghai"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = PROJECT_CONFIG.app_path("static")
MEDIA_URL = "media/"
MEDIA_ROOT = PROJECT_CONFIG.app_path("media")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LOGIN_URL = "/"
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"

LOG_DIR = PROJECT_CONFIG.app_path("logs")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s [%(levelname)s] %(name)s:%(lineno)d %(message)s",
        },
    },
    "handlers": {
        "application_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": LOG_DIR / "application.log",
            "maxBytes": 10 * 1024 * 1024,
            "backupCount": 10,
            "formatter": "standard",
            "encoding": "utf-8",
        },
        "django_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": LOG_DIR / "django.log",
            "maxBytes": 10 * 1024 * 1024,
            "backupCount": 10,
            "formatter": "standard",
            "encoding": "utf-8",
        },
        "security_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": LOG_DIR / "security.log",
            "maxBytes": 10 * 1024 * 1024,
            "backupCount": 10,
            "formatter": "standard",
            "encoding": "utf-8",
        },
    },
    "root": {
        "handlers": ["application_file"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["django_file"],
            "level": "INFO",
            "propagate": False,
        },
        "django.security": {
            "handlers": ["security_file"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
