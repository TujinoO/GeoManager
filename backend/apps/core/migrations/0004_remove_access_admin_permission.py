from django.db import migrations


def remove_access_admin_permission(apps, schema_editor):
    ContentType = apps.get_model("contenttypes", "ContentType")
    Permission = apps.get_model("auth", "Permission")
    content_type = ContentType.objects.filter(
        app_label="core",
        model="featurepermission",
    ).first()
    if content_type is None:
        return
    Permission.objects.filter(
        content_type=content_type,
        codename="access_admin",
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0003_operation_log_scope_permissions"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="featurepermission",
            options={
                "default_permissions": (),
                "permissions": [
                    ("manage_feature_permissions", "可配置功能权限"),
                    ("create_user", "可新建用户"),
                    ("view_operation_logs", "可查看操作日志"),
                    ("view_all_operation_logs", "可查看所有用户日志"),
                    ("view_own_operation_logs", "可查看自己的日志"),
                    ("view_group_operation_logs", "可查看指定用户组日志"),
                    ("manage_system_settings", "可修改系统设置"),
                    ("manage_auth", "可修改认证授权"),
                    ("view_dashboard_resource_card", "可查看 Dashboard 数据资源卡片"),
                    ("view_dashboard_layer_card", "可查看 Dashboard 图层数卡片"),
                    ("view_dashboard_raster_card", "可查看 Dashboard 栅格数量卡片"),
                    ("view_dashboard_user_card", "可查看 Dashboard 用户数量卡片"),
                    (
                        "view_dashboard_active_users_card",
                        "可查看 Dashboard 活跃用户卡片",
                    ),
                    ("view_dashboard_system_card", "可查看 Dashboard 系统信息"),
                    ("browse_data", "可浏览数据"),
                    ("query_data", "可查询数据"),
                    ("load_vector_layer", "可加载矢量图层"),
                    ("load_raster_layer", "可加载栅格图层"),
                    ("custom_symbolization", "可自定义符号化"),
                ],
                "verbose_name": "平台功能权限",
                "verbose_name_plural": "平台功能权限",
            },
        ),
        migrations.RunPython(remove_access_admin_permission, migrations.RunPython.noop),
    ]
