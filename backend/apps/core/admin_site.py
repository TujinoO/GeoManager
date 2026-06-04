from django.contrib.admin import AdminSite

from apps.core.permissions import has_feature_perm, permission_denied_message


class HuyangAdminSite(AdminSite):
    site_header = "中亚胡杨林生态系统保护数据共享平台后台"
    site_title = "平台后台"
    index_title = "后台管理"

    def has_permission(self, request):
        return request.user.is_active and has_feature_perm(
            request.user, "core.access_admin"
        )

    def permission_denied(self, request):
        from django.core.exceptions import PermissionDenied

        raise PermissionDenied(permission_denied_message(request.user))
