from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("catalog", "0002_dataresource_default_visualization"),
    ]

    operations = [
        migrations.AddField(
            model_name="dataresource",
            name="item_count",
            field=models.PositiveBigIntegerField(default=0, verbose_name="数据条目数"),
        ),
        migrations.AddField(
            model_name="dataresource",
            name="size_bytes",
            field=models.PositiveBigIntegerField(default=0, verbose_name="数据大小"),
        ),
        migrations.CreateModel(
            name="WorkspaceScene",
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
                    "kind",
                    models.CharField(
                        choices=[("project", "工程"), ("topic", "专题")],
                        max_length=16,
                        verbose_name="类型",
                    ),
                ),
                ("name", models.CharField(max_length=160, verbose_name="名称")),
                ("description", models.TextField(blank=True, verbose_name="说明")),
                (
                    "snapshot",
                    models.JSONField(
                        blank=True, default=dict, verbose_name="工作台快照"
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="创建时间"),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="更新时间"),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="workspace_scenes",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="所属用户",
                    ),
                ),
            ],
            options={
                "verbose_name": "工作台场景",
                "verbose_name_plural": "工作台场景",
                "ordering": ("kind", "-updated_at", "id"),
            },
        ),
        migrations.AddConstraint(
            model_name="workspacescene",
            constraint=models.UniqueConstraint(
                fields=("owner", "kind", "name"),
                name="uniq_workspace_scene_owner_kind_name",
            ),
        ),
    ]
