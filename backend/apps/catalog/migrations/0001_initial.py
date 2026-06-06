import django.db.models.deletion
from django.conf import settings
from django.contrib.auth.models import Group
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DictionaryItem",
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
                    "dict_type",
                    models.CharField(
                        choices=[
                            ("data_category", "数据分类"),
                            ("layer_category", "图层分类"),
                            ("achievement_category", "成果分类"),
                            ("data_source", "数据来源"),
                            ("region", "空间范围"),
                            ("public_scope", "公开范围"),
                        ],
                        max_length=32,
                        verbose_name="字典类型",
                    ),
                ),
                ("code", models.SlugField(max_length=64, verbose_name="编码")),
                ("name", models.CharField(max_length=128, verbose_name="名称")),
                ("description", models.TextField(blank=True, verbose_name="说明")),
                (
                    "sort_order",
                    models.PositiveIntegerField(default=100, verbose_name="排序"),
                ),
                ("is_active", models.BooleanField(default=True, verbose_name="启用")),
            ],
            options={
                "verbose_name": "字典项",
                "verbose_name_plural": "字典项",
                "ordering": ("dict_type", "sort_order", "id"),
                "constraints": [
                    models.UniqueConstraint(
                        fields=("dict_type", "code"), name="uniq_dictionary_type_code"
                    )
                ],
            },
        ),
        migrations.CreateModel(
            name="DataResource",
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
                ("name", models.CharField(max_length=160, verbose_name="数据名称")),
                (
                    "code",
                    models.SlugField(
                        max_length=80, unique=True, verbose_name="数据编号"
                    ),
                ),
                (
                    "data_type",
                    models.CharField(
                        choices=[
                            ("vector", "矢量空间数据"),
                            ("raster", "栅格空间数据"),
                            ("gene", "基因非地理数据"),
                            ("table", "表格属性数据"),
                            ("document", "文档资料"),
                            ("image", "图片资料"),
                        ],
                        max_length=24,
                        verbose_name="数据类型",
                    ),
                ),
                (
                    "source",
                    models.CharField(
                        blank=True, max_length=160, verbose_name="数据来源"
                    ),
                ),
                (
                    "provider",
                    models.CharField(
                        blank=True, max_length=160, verbose_name="提供单位"
                    ),
                ),
                (
                    "data_date",
                    models.DateField(blank=True, null=True, verbose_name="数据时间"),
                ),
                (
                    "spatial_extent",
                    models.CharField(
                        blank=True, max_length=255, verbose_name="空间范围"
                    ),
                ),
                (
                    "coordinate_system",
                    models.CharField(
                        blank=True, max_length=120, verbose_name="坐标信息"
                    ),
                ),
                (
                    "file_format",
                    models.CharField(
                        blank=True, max_length=40, verbose_name="数据格式"
                    ),
                ),
                (
                    "storage_path",
                    models.CharField(
                        blank=True,
                        help_text="矢量填写 GeoPackage 图层名；栅格相对于地理数据 raster/；基因和表格相对于非地理数据根目录。",
                        max_length=255,
                        verbose_name="存储相对路径",
                    ),
                ),
                ("description", models.TextField(blank=True, verbose_name="数据说明")),
                (
                    "quality_note",
                    models.TextField(blank=True, verbose_name="数据质量说明"),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("active", "启用"), ("inactive", "停用")],
                        default="active",
                        max_length=16,
                        verbose_name="状态",
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
                    "access_groups",
                    models.ManyToManyField(
                        blank=True,
                        related_name="data_resources",
                        to="auth.group",
                        verbose_name="访问角色",
                    ),
                ),
                (
                    "maintainer",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="maintained_resources",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="维护人员",
                    ),
                ),
                (
                    "category",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="data_resources",
                        to="catalog.dictionaryitem",
                        verbose_name="数据分类",
                    ),
                ),
            ],
            options={
                "verbose_name": "数据资源",
                "verbose_name_plural": "数据资源",
                "ordering": ("name",),
                "permissions": [
                    ("export_dataresource", "可导出数据资源"),
                    ("maintain_dataresource", "可导入数据资源"),
                ],
            },
        ),
        migrations.CreateModel(
            name="DataCatalog",
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
                ("name", models.CharField(max_length=120, verbose_name="目录名称")),
                (
                    "code",
                    models.SlugField(
                        max_length=80, unique=True, verbose_name="目录编码"
                    ),
                ),
                ("description", models.TextField(blank=True, verbose_name="说明")),
                (
                    "sort_order",
                    models.PositiveIntegerField(default=100, verbose_name="排序"),
                ),
                ("is_active", models.BooleanField(default=True, verbose_name="启用")),
                (
                    "access_groups",
                    models.ManyToManyField(
                        blank=True,
                        related_name="data_catalogs",
                        to="auth.group",
                        verbose_name="访问角色",
                    ),
                ),
                (
                    "parent",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="children",
                        to="catalog.datacatalog",
                        verbose_name="上级目录",
                    ),
                ),
                (
                    "resources",
                    models.ManyToManyField(
                        blank=True,
                        related_name="catalogs",
                        to="catalog.dataresource",
                        verbose_name="数据资源",
                    ),
                ),
            ],
            options={
                "verbose_name": "数据目录",
                "verbose_name_plural": "数据目录",
                "ordering": ("sort_order", "id"),
            },
        ),
        migrations.CreateModel(
            name="MapLayer",
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
                ("name", models.CharField(max_length=160, verbose_name="图层名称")),
                (
                    "code",
                    models.SlugField(
                        max_length=80, unique=True, verbose_name="图层编码"
                    ),
                ),
                (
                    "layer_type",
                    models.CharField(
                        choices=[("vector", "矢量图层"), ("raster", "栅格图层")],
                        max_length=16,
                        verbose_name="图层类型",
                    ),
                ),
                (
                    "geometry_type",
                    models.CharField(
                        choices=[
                            ("point", "点"),
                            ("line", "线"),
                            ("polygon", "面"),
                            ("mixed", "混合"),
                        ],
                        default="mixed",
                        max_length=16,
                        verbose_name="几何类型",
                    ),
                ),
                (
                    "source_path",
                    models.CharField(
                        blank=True, max_length=255, verbose_name="数据图层名或相对路径"
                    ),
                ),
                (
                    "sort_order",
                    models.PositiveIntegerField(default=100, verbose_name="排序"),
                ),
                (
                    "default_visible",
                    models.BooleanField(default=False, verbose_name="默认显示"),
                ),
                (
                    "default_opacity",
                    models.PositiveSmallIntegerField(
                        default=85, verbose_name="默认透明度"
                    ),
                ),
                (
                    "symbolization",
                    models.JSONField(
                        blank=True, default=dict, verbose_name="矢量符号化"
                    ),
                ),
                (
                    "bounds",
                    models.JSONField(blank=True, default=list, verbose_name="边界范围"),
                ),
                ("legend", models.TextField(blank=True, verbose_name="图例说明")),
                (
                    "raster_symbolizer_script",
                    models.CharField(
                        blank=True, max_length=255, verbose_name="栅格符号化脚本"
                    ),
                ),
                (
                    "raster_rules",
                    models.JSONField(
                        blank=True, default=dict, verbose_name="栅格符号化规则"
                    ),
                ),
                ("is_active", models.BooleanField(default=True, verbose_name="启用")),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="创建时间"),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="更新时间"),
                ),
                (
                    "access_groups",
                    models.ManyToManyField(
                        blank=True,
                        related_name="map_layers",
                        to="auth.group",
                        verbose_name="访问角色",
                    ),
                ),
                (
                    "category",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="map_layers",
                        to="catalog.dictionaryitem",
                        verbose_name="图层分类",
                    ),
                ),
                (
                    "data_resource",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="map_layers",
                        to="catalog.dataresource",
                        verbose_name="数据资源",
                    ),
                ),
            ],
            options={
                "verbose_name": "地图图层",
                "verbose_name_plural": "地图图层",
                "ordering": ("sort_order", "id"),
                "permissions": [("load_maplayer", "可加载地图图层")],
            },
        ),
        migrations.CreateModel(
            name="Achievement",
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
                ("title", models.CharField(max_length=180, verbose_name="成果标题")),
                (
                    "code",
                    models.SlugField(
                        max_length=80, unique=True, verbose_name="成果编码"
                    ),
                ),
                ("summary", models.TextField(blank=True, verbose_name="成果说明")),
                (
                    "source",
                    models.CharField(
                        blank=True, max_length=160, verbose_name="成果来源"
                    ),
                ),
                (
                    "image_path",
                    models.CharField(
                        blank=True, max_length=255, verbose_name="图片相对路径"
                    ),
                ),
                (
                    "attachment_path",
                    models.CharField(
                        blank=True, max_length=255, verbose_name="附件相对路径"
                    ),
                ),
                (
                    "display_order",
                    models.PositiveIntegerField(default=100, verbose_name="展示排序"),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "草稿"),
                            ("published", "已发布"),
                            ("archived", "已下架"),
                        ],
                        default="draft",
                        max_length=20,
                        verbose_name="状态",
                    ),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="更新时间"),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="创建时间"),
                ),
                (
                    "access_groups",
                    models.ManyToManyField(
                        blank=True,
                        related_name="achievements",
                        to="auth.group",
                        verbose_name="访问角色",
                    ),
                ),
                (
                    "category",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="achievements",
                        to="catalog.dictionaryitem",
                        verbose_name="成果分类",
                    ),
                ),
                (
                    "related_layer",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="achievements",
                        to="catalog.maplayer",
                        verbose_name="关联图层",
                    ),
                ),
            ],
            options={
                "verbose_name": "项目成果",
                "verbose_name_plural": "项目成果",
                "ordering": ("display_order", "-updated_at"),
            },
        ),
    ]
