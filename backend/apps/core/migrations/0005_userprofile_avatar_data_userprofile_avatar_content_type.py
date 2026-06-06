from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_featurepermission_create_user"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="avatar_data",
            field=models.BinaryField(blank=True, null=True, verbose_name="头像数据"),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="avatar_content_type",
            field=models.CharField(
                blank=True, max_length=50, verbose_name="头像内容类型"
            ),
        ),
    ]
