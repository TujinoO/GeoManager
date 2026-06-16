from django.db import models

from apps.catalog.models import DataResource, MapLayer


class RasterDataset(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "等待处理"
        PROCESSING = "processing", "处理中"
        READY = "ready", "可用"
        FAILED = "failed", "失败"

    name = models.CharField(max_length=160, verbose_name="数据名称")
    code = models.SlugField(max_length=96, unique=True, verbose_name="数据编号")
    source_relative_path = models.CharField(
        max_length=500, unique=True, verbose_name="源文件相对路径"
    )
    processed_relative_path = models.CharField(
        max_length=500, blank=True, verbose_name="预处理文件相对路径"
    )
    source_metadata_relative_path = models.CharField(
        max_length=500, blank=True, verbose_name="源文件元数据路径"
    )
    processed_metadata_relative_path = models.CharField(
        max_length=500, blank=True, verbose_name="预处理文件元数据路径"
    )
    source_gdalinfo = models.JSONField(
        default=dict, blank=True, verbose_name="源文件 GDAL 元数据"
    )
    processed_gdalinfo = models.JSONField(
        default=dict, blank=True, verbose_name="预处理文件 GDAL 元数据"
    )
    data_resource = models.ForeignKey(
        DataResource,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="raster_datasets",
        verbose_name="数据资源",
    )
    map_layer = models.ForeignKey(
        MapLayer,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="raster_datasets",
        verbose_name="地图图层",
    )
    default_rules = models.JSONField(
        default=dict, blank=True, verbose_name="默认符号化规则"
    )
    bounds_3857 = models.JSONField(
        default=list, blank=True, verbose_name="EPSG:3857 范围"
    )
    bounds_4326 = models.JSONField(default=list, blank=True, verbose_name="经纬度范围")
    image_coordinates = models.JSONField(
        default=list, blank=True, verbose_name="Mapbox 图片角点"
    )
    band_count = models.PositiveIntegerField(default=0, verbose_name="波段数")
    source_file_size = models.PositiveBigIntegerField(
        default=0, verbose_name="源文件大小"
    )
    processed_file_size = models.PositiveBigIntegerField(
        default=0, verbose_name="预处理文件大小"
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name="状态",
    )
    progress_log = models.TextField(blank=True, verbose_name="处理日志")
    error_message = models.TextField(blank=True, verbose_name="错误信息")
    imported_at = models.DateTimeField(auto_now_add=True, verbose_name="导入时间")
    processed_at = models.DateTimeField(
        null=True, blank=True, verbose_name="预处理完成时间"
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "栅格数据集"
        verbose_name_plural = "栅格数据集"
        ordering = ("-imported_at",)
        permissions = [
            ("manage_raster_dataset", "可管理栅格数据集"),
        ]

    def __str__(self) -> str:
        return self.name
