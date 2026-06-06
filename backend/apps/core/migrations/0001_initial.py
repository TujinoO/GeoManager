from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def create_initial_system_setting(apps, schema_editor):
    SystemSetting = apps.get_model("core", "SystemSetting")
    SystemSetting.objects.get_or_create(
        pk=1,
        defaults={"allow_registration": settings.PROJECT_CONFIG.allow_registration},
    )


def initialize_runtime_config(apps, schema_editor):
    from apps.core.config import ensure_runtime_config_file

    ensure_runtime_config_file(settings.PROJECT_CONFIG)


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="FeaturePermission",
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
            ],
            options={
                "verbose_name": "平台功能权限",
                "verbose_name_plural": "平台功能权限",
                "default_permissions": (),
                "permissions": [
                    ("access_admin", "可进入后台管理"),
                    ("manage_feature_permissions", "可配置功能权限"),
                    ("create_user", "可新建用户"),
                    ("browse_data", "可浏览数据"),
                    ("query_data", "可查询数据"),
                    ("load_vector_layer", "可加载矢量图层"),
                    ("load_raster_layer", "可加载栅格图层"),
                    ("custom_symbolization", "可自定义符号化"),
                ],
            },
        ),
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
        migrations.CreateModel(
            name="UserProfile",
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
                ("avatar_url", models.URLField(blank=True, verbose_name="头像 URL")),
                (
                    "avatar_data",
                    models.BinaryField(blank=True, null=True, verbose_name="头像数据"),
                ),
                (
                    "avatar_content_type",
                    models.CharField(
                        blank=True, max_length=50, verbose_name="头像内容类型"
                    ),
                ),
                (
                    "department",
                    models.CharField(blank=True, max_length=120, verbose_name="部门"),
                ),
                (
                    "disabled_permissions",
                    models.JSONField(
                        blank=True,
                        default=list,
                        verbose_name="用户主动关闭的权限",
                    ),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="更新时间"),
                ),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="profile",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="用户",
                    ),
                ),
            ],
            options={
                "verbose_name": "用户资料",
                "verbose_name_plural": "用户资料",
            },
        ),
        migrations.RunPython(create_initial_system_setting, migrations.RunPython.noop),
        migrations.RunPython(initialize_runtime_config, migrations.RunPython.noop),
    ]
