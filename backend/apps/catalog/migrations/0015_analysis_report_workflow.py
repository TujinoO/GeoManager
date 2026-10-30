from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("catalog", "0014_resultartifact_permissions")]
    operations = [
        migrations.AddField(
            model_name="resultartifact",
            name="source_resource",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="analysis_reports",
                to="catalog.dataresource",
                verbose_name="原始数据资源",
            ),
        ),
        migrations.AddField(
            model_name="resultartifact",
            name="report_document",
            field=models.JSONField(
                blank=True, default=dict, verbose_name="报告编辑内容"
            ),
        ),
        migrations.AddField(
            model_name="resultartifact",
            name="requires_review",
            field=models.BooleanField(default=False, verbose_name="须审核发布"),
        ),
        migrations.AddField(
            model_name="resultartifact",
            name="review_note",
            field=models.TextField(blank=True, verbose_name="审核意见"),
        ),
        migrations.AlterField(
            model_name="resultartifact",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "草稿"),
                    ("in_review", "待审核"),
                    ("published", "已发布"),
                ],
                default="draft",
                max_length=16,
                verbose_name="状态",
            ),
        ),
    ]
