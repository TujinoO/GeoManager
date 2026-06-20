from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
        ("catalog", "0003_dataresource_stats_workspace"),
    ]

    operations = [
        migrations.AddField(
            model_name="workspacescene",
            name="access_groups",
            field=models.ManyToManyField(
                blank=True,
                related_name="workspace_scenes",
                to="auth.group",
                verbose_name="访问角色",
            ),
        ),
        migrations.AddField(
            model_name="workspacescene",
            name="status",
            field=models.CharField(
                choices=[("active", "启用"), ("inactive", "停用")],
                default="active",
                max_length=16,
                verbose_name="状态",
            ),
        ),
    ]
