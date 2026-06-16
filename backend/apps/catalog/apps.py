from django.apps import AppConfig

_startup_scan_started = False


class CatalogConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.catalog"
    verbose_name = "数据目录"

    def ready(self) -> None:
        global _startup_scan_started
        if _startup_scan_started:
            return
        _startup_scan_started = True

        import os
        import sys
        import threading

        from django.conf import settings

        if settings.PROJECT_CONFIG.runtime.disable_catalog_startup_scan:
            return
        if len(sys.argv) > 1 and sys.argv[1] not in {"runserver"}:
            return
        if (
            len(sys.argv) > 1
            and sys.argv[1] == "runserver"
            and os.environ.get("RUN_MAIN") != "true"
        ):
            return

        def run_scan() -> None:
            from apps.catalog.services import scan_catalog_sources_safely

            scan_catalog_sources_safely()

        threading.Thread(
            target=run_scan, name="catalog-startup-scan", daemon=True
        ).start()
