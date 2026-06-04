from django.conf import settings
from django.db import migrations, models


def create_initial_system_setting(apps, schema_editor):
    SystemSetting = apps.get_model("core", "SystemSetting")
    SystemSetting.objects.get_or_create(
        pk=1,
        defaults={"allow_registration": settings.PROJECT_CONFIG.allow_registration},
    )


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="SystemSetting",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "allow_registration",
                    models.BooleanField(default=True, verbose_name="开放自助注册"),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="更新时间"),
                ),
            ],
            options={
                "verbose_name": "系统设置",
                "verbose_name_plural": "系统设置",
            },
        ),
        migrations.RunPython(create_initial_system_setting, migrations.RunPython.noop),
    ]
