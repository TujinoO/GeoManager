from django.apps import AppConfig

_startup_credentials_printed = False


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"
    verbose_name = "系统核心"

    def ready(self):
        global _startup_credentials_printed
        from django.db.models.signals import post_migrate

        from apps.core.initialization import ensure_superadmin_defaults_after_migrate

        post_migrate.connect(
            ensure_superadmin_defaults_after_migrate,
            sender=self,
            dispatch_uid="apps.core.ensure_superadmin_defaults",
        )
        if not _startup_credentials_printed:
            _startup_credentials_printed = True
            self._print_credentials_async()

    def _print_credentials_async(self):
        import os
        import sys
        import threading

        if len(sys.argv) > 1 and sys.argv[1] not in {"runserver"}:
            return
        if (
            len(sys.argv) > 1
            and sys.argv[1] == "runserver"
            and os.environ.get("RUN_MAIN") != "true"
        ):
            return

        def run_print():
            from apps.core.initialization import print_superadmin_credentials_on_startup

            print_superadmin_credentials_on_startup()

        threading.Thread(
            target=run_print, name="core-startup-credentials", daemon=True
        ).start()
