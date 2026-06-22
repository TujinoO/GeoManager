from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
        verbose_name="用户",
    )
    avatar_url = models.URLField(blank=True, verbose_name="头像 URL")
    avatar_data = models.BinaryField(blank=True, null=True, verbose_name="头像数据")
    avatar_content_type = models.CharField(
        max_length=50, blank=True, verbose_name="头像内容类型"
    )
    department = models.CharField(max_length=120, blank=True, verbose_name="部门")
    disabled_permissions = models.JSONField(
        default=list,
        blank=True,
        verbose_name="用户主动关闭的权限",
    )
    operation_log_group_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name="可查看日志角色",
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "用户资料"
        verbose_name_plural = "用户资料"

    def __str__(self):
        return self.user.get_username()


class FeaturePermission(models.Model):
    class Meta:
        verbose_name = "平台功能权限"
        verbose_name_plural = "平台功能权限"
        default_permissions = ()
        permissions = [
            ("manage_feature_permissions", "可配置功能权限"),
            ("create_user", "可新建用户"),
            ("view_operation_logs", "可查看操作日志"),
            ("view_all_operation_logs", "可查看所有用户日志"),
            ("view_own_operation_logs", "可查看自己的日志"),
            ("view_group_operation_logs", "可查看指定角色日志"),
            ("manage_system_settings", "可修改系统设置"),
            ("manage_data_backup", "可管理数据备份"),
            ("manage_auth", "可修改认证授权"),
            ("view_dashboard_resource_card", "可查看 Dashboard 数据资源卡片"),
            ("view_dashboard_layer_card", "可查看 Dashboard 图层数卡片"),
            ("view_dashboard_raster_card", "可查看 Dashboard 栅格数量卡片"),
            ("view_dashboard_user_card", "可查看 Dashboard 用户数量卡片"),
            ("view_dashboard_active_users_card", "可查看 Dashboard 活跃用户卡片"),
            ("view_dashboard_system_card", "可查看 Dashboard 系统信息"),
            ("browse_data", "可浏览数据"),
            ("query_data", "可查询数据"),
            ("load_vector_layer", "可加载矢量图层"),
            ("load_raster_layer", "可加载栅格图层"),
            ("custom_symbolization", "可自定义符号化"),
        ]


class SystemSetting(models.Model):
    allow_registration = models.BooleanField(default=True, verbose_name="开放自助注册")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "系统设置"
        verbose_name_plural = "系统设置"

    def __str__(self):
        return "系统设置"
