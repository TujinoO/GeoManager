from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("content", "0001_initial")]
    operations = [
        migrations.AlterField(
            model_name="article",
            name="status",
            field=models.CharField(
                max_length=16,
                default="draft",
                choices=[
                    ("draft", "草稿"),
                    ("review", "待审核"),
                    ("published", "已发布"),
                    ("archived", "已下架"),
                ],
            ),
        ),
    ]
