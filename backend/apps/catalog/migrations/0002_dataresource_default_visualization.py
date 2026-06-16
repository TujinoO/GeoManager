from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="dataresource",
            name="default_visualization",
            field=models.JSONField(
                blank=True, default=dict, verbose_name="默认可视化方案"
            ),
        ),
    ]
