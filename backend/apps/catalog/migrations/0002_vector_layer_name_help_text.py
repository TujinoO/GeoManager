from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="dataresource",
            name="storage_path",
            field=models.CharField(
                blank=True,
                help_text="矢量填写 geodata/vector/vector.gpkg 内的图层名；栅格相对于 geographic/raster。",
                max_length=255,
                verbose_name="存储相对路径",
            ),
        ),
        migrations.AlterField(
            model_name="maplayer",
            name="source_path",
            field=models.CharField(blank=True, max_length=255, verbose_name="数据图层名或相对路径"),
        ),
    ]
