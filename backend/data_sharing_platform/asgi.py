import os

from django.core.asgi import get_asgi_application


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "data_sharing_platform.settings")

application = get_asgi_application()
