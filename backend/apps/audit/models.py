from django.conf import settings
from django.db import models


class OperationLog(models.Model):
    class Status(models.TextChoices):
        SUCCESS = "success", "成功"
        FAILED = "failed", "失败"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        verbose_name="操作用户",
    )
    module = models.CharField(max_length=64, verbose_name="模块")
    action = models.CharField(max_length=64, verbose_name="操作")
    status = models.CharField(
        max_length=16, choices=Status.choices, verbose_name="结果"
    )
    message = models.TextField(blank=True, verbose_name="说明")
    ip_address = models.GenericIPAddressField(
        null=True, blank=True, verbose_name="IP 地址"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="操作时间")

    class Meta:
        verbose_name = "操作日志"
        verbose_name_plural = "操作日志"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("module", "action")),
            models.Index(fields=("created_at",)),
        ]

    def __str__(self) -> str:
        return f"{self.module}.{self.action} {self.status}"
