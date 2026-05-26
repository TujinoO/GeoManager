from django.db import models

from apps.catalog.models import DataResource, MapLayer


class RasterCacheRecord(models.Model):
    class Status(models.TextChoices):
        READY = "ready", "可用"
        FAILED = "failed", "失败"

    cache_key = models.CharField(max_length=64, unique=True, verbose_name="缓存标识")
    layer = models.ForeignKey(MapLayer, null=True, blank=True, on_delete=models.SET_NULL, verbose_name="图层")
    data_resource = models.ForeignKey(
        DataResource,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        verbose_name="数据资源",
    )
    raster_relative_path = models.CharField(max_length=255, verbose_name="栅格相对路径")
    png_relative_path = models.CharField(max_length=255, verbose_name="PNG 缓存相对路径")
    rules = models.JSONField(default=dict, blank=True, verbose_name="符号化规则")
    output_width = models.PositiveIntegerField(verbose_name="输出宽度")
    output_height = models.PositiveIntegerField(verbose_name="输出高度")
    file_size = models.PositiveBigIntegerField(default=0, verbose_name="文件大小")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.READY, verbose_name="状态")
    error_message = models.TextField(blank=True, verbose_name="错误信息")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="生成时间")
    last_accessed_at = models.DateTimeField(auto_now=True, verbose_name="最近访问时间")

    class Meta:
        verbose_name = "栅格 PNG 缓存"
        verbose_name_plural = "栅格 PNG 缓存"
        ordering = ("-last_accessed_at",)
        permissions = [
            ("manage_raster_cache", "可管理栅格 PNG 缓存"),
        ]

    def __str__(self) -> str:
        return self.cache_key

