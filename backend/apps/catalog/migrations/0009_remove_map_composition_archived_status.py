from django.db import migrations, models


def delete_archived_map_compositions(apps, schema_editor):
    composition_model = apps.get_model("catalog", "MapComposition")
    archived = composition_model.objects.filter(status="archived")
    archived.update(published_version=None)
    archived.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0008_map_composition_publication_and_project_only"),
    ]

    operations = [
        migrations.RunPython(
            delete_archived_map_compositions,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="mapcomposition",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "草稿"),
                    ("completed", "已生成成果"),
                    ("published", "已发布"),
                ],
                default="draft",
                max_length=16,
                verbose_name="状态",
            ),
        ),
    ]
