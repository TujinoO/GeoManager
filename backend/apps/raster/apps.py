from django.apps import AppConfig

_startup_scan_started = False


class RasterConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.raster"
    verbose_name = "栅格数据"

    def ready(self) -> None:
        global _startup_scan_started
        if _startup_scan_started:
            return
        _startup_scan_started = True

        import os
        import sys
        import threading

        from django.conf import settings

        if settings.PROJECT_CONFIG.runtime.disable_raster_startup_scan:
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
            from apps.raster.services import scan_unprocessed_source_files_safely

            scan_unprocessed_source_files_safely()

        threading.Thread(
            target=run_scan, name="raster-startup-scan", daemon=True
        ).start()
