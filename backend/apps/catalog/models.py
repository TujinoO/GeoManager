from django.conf import settings
from django.contrib.auth.models import Group
from django.db import models


class DictionaryItem(models.Model):
    class DictType(models.TextChoices):
        DATA_CATEGORY = "data_category", "数据分类"
        LAYER_CATEGORY = "layer_category", "图层分类"
        DATA_SOURCE = "data_source", "数据来源"
        REGION = "region", "空间范围"
        PUBLIC_SCOPE = "public_scope", "公开范围"

    dict_type = models.CharField(
        max_length=32, choices=DictType.choices, verbose_name="字典类型"
    )
    code = models.SlugField(max_length=64, verbose_name="编码")
    name = models.CharField(max_length=128, verbose_name="名称")
    description = models.TextField(blank=True, verbose_name="说明")
    sort_order = models.PositiveIntegerField(default=100, verbose_name="排序")
    is_active = models.BooleanField(default=True, verbose_name="启用")

    class Meta:
        verbose_name = "字典项"
        verbose_name_plural = "字典项"
        ordering = ("dict_type", "sort_order", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("dict_type", "code"), name="uniq_dictionary_type_code"
            ),
        ]

    def __str__(self) -> str:
        return self.name


class DataResourceGroup(models.Model):
    name = models.CharField(max_length=120, unique=True, verbose_name="组别名称")
    sort_order = models.PositiveIntegerField(default=100, verbose_name="排序")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "数据资源组别"
        verbose_name_plural = "数据资源组别"
        ordering = ("sort_order", "id")

    def __str__(self) -> str:
        return self.name


class DataResource(models.Model):
    class DataType(models.TextChoices):
        VECTOR = "vector", "矢量空间数据"
        RASTER = "raster", "栅格空间数据"
        GENE = "gene", "基因非地理数据"
        TABLE = "table", "表格属性数据"
        DOCUMENT = "document", "文档资料"
        IMAGE = "image", "图片资料"

    class Status(models.TextChoices):
        ACTIVE = "active", "启用"
        INACTIVE = "inactive", "停用"

    name = models.CharField(max_length=160, verbose_name="数据名称")
    code = models.SlugField(max_length=80, unique=True, verbose_name="数据编号")
    data_type = models.CharField(
        max_length=24, choices=DataType.choices, verbose_name="数据类型"
    )
    category = models.ForeignKey(
        DictionaryItem,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="data_resources",
        verbose_name="数据分类",
    )
    source = models.CharField(max_length=160, blank=True, verbose_name="数据来源")
    provider = models.CharField(max_length=160, blank=True, verbose_name="提供单位")
    data_date = models.DateField(null=True, blank=True, verbose_name="数据时间")
    spatial_extent = models.CharField(
        max_length=255, blank=True, verbose_name="空间范围"
    )
    coordinate_system = models.CharField(
        max_length=120, blank=True, verbose_name="坐标信息"
    )
    file_format = models.CharField(max_length=40, blank=True, verbose_name="数据格式")
    storage_path = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="存储相对路径",
        help_text="矢量填写 GeoPackage 图层名；栅格相对于地理数据 raster/；基因和表格相对于非地理数据根目录。",
    )
    description = models.TextField(blank=True, verbose_name="数据说明")
    quality_note = models.TextField(blank=True, verbose_name="数据质量说明")
    default_visualization = models.JSONField(
        default=dict, blank=True, verbose_name="默认可视化方案"
    )
    size_bytes = models.PositiveBigIntegerField(default=0, verbose_name="数据大小")
    item_count = models.PositiveBigIntegerField(default=0, verbose_name="数据条目数")
    access_groups = models.ManyToManyField(
        Group, blank=True, related_name="data_resources", verbose_name="访问角色"
    )
    inventory_group = models.ForeignKey(
        DataResourceGroup,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="resources",
        verbose_name="存量数据组别",
    )
    maintainer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="maintained_resources",
        verbose_name="维护人员",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.ACTIVE,
        verbose_name="状态",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "数据资源"
        verbose_name_plural = "数据资源"
        ordering = ("name",)
        permissions = [
            ("export_dataresource", "可导出数据资源"),
        ]

    def __str__(self) -> str:
        return self.name


class WorkspaceScene(models.Model):
    class Kind(models.TextChoices):
        PROJECT = "project", "工程"
        TOPIC = "topic", "专题"

    class Status(models.TextChoices):
        ACTIVE = "active", "启用"
        INACTIVE = "inactive", "停用"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="workspace_scenes",
        verbose_name="所属用户",
    )
    kind = models.CharField(max_length=16, choices=Kind.choices, verbose_name="类型")
    name = models.CharField(max_length=160, verbose_name="名称")
    description = models.TextField(blank=True, verbose_name="说明")
    snapshot = models.JSONField(default=dict, blank=True, verbose_name="工作台快照")
    access_groups = models.ManyToManyField(
        Group, blank=True, related_name="workspace_scenes", verbose_name="访问角色"
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.ACTIVE,
        verbose_name="状态",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "工作台场景"
        verbose_name_plural = "工作台场景"
        ordering = ("kind", "-updated_at", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("owner", "kind", "name"),
                name="uniq_workspace_scene_owner_kind_name",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.get_kind_display()}：{self.name}"


class DataCatalog(models.Model):
    name = models.CharField(max_length=120, verbose_name="目录名称")
    code = models.SlugField(max_length=80, unique=True, verbose_name="目录编码")
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="children",
        verbose_name="上级目录",
    )
    description = models.TextField(blank=True, verbose_name="说明")
    resources = models.ManyToManyField(
        DataResource, blank=True, related_name="catalogs", verbose_name="数据资源"
    )
    access_groups = models.ManyToManyField(
        Group, blank=True, related_name="data_catalogs", verbose_name="访问角色"
    )
    sort_order = models.PositiveIntegerField(default=100, verbose_name="排序")
    is_active = models.BooleanField(default=True, verbose_name="启用")

    class Meta:
        verbose_name = "数据目录"
        verbose_name_plural = "数据目录"
        ordering = ("sort_order", "id")

    def __str__(self) -> str:
        return self.name


class MapLayer(models.Model):
    class LayerType(models.TextChoices):
        VECTOR = "vector", "矢量图层"
        RASTER = "raster", "栅格图层"

    class GeometryType(models.TextChoices):
        POINT = "point", "点"
        LINE = "line", "线"
        POLYGON = "polygon", "面"
        MIXED = "mixed", "混合"

    name = models.CharField(max_length=160, verbose_name="图层名称")
    code = models.SlugField(max_length=80, unique=True, verbose_name="图层编码")
    layer_type = models.CharField(
        max_length=16, choices=LayerType.choices, verbose_name="图层类型"
    )
    geometry_type = models.CharField(
        max_length=16,
        choices=GeometryType.choices,
        default=GeometryType.MIXED,
        verbose_name="几何类型",
    )
    category = models.ForeignKey(
        DictionaryItem,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="map_layers",
        verbose_name="图层分类",
    )
    data_resource = models.ForeignKey(
        DataResource,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="map_layers",
        verbose_name="数据资源",
    )
    source_path = models.CharField(
        max_length=255, blank=True, verbose_name="数据图层名或相对路径"
    )
    sort_order = models.PositiveIntegerField(default=100, verbose_name="排序")
    default_visible = models.BooleanField(default=False, verbose_name="默认显示")
    default_opacity = models.PositiveSmallIntegerField(
        default=85, verbose_name="默认透明度"
    )
    symbolization = models.JSONField(
        default=dict, blank=True, verbose_name="矢量符号化"
    )
    bounds = models.JSONField(default=list, blank=True, verbose_name="边界范围")
    legend = models.TextField(blank=True, verbose_name="图例说明")
    raster_symbolizer_script = models.CharField(
        max_length=255, blank=True, verbose_name="栅格符号化脚本"
    )
    raster_rules = models.JSONField(
        default=dict, blank=True, verbose_name="栅格符号化规则"
    )
    access_groups = models.ManyToManyField(
        Group, blank=True, related_name="map_layers", verbose_name="访问角色"
    )
    is_active = models.BooleanField(default=True, verbose_name="启用")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "地图图层"
        verbose_name_plural = "地图图层"
        ordering = ("sort_order", "id")
        permissions = [
            ("load_maplayer", "可加载地图图层"),
        ]

    def __str__(self) -> str:
        return self.name
