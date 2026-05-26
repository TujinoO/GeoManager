from django.contrib import admin

from apps.audit.models import OperationLog


@admin.register(OperationLog)
class OperationLogAdmin(admin.ModelAdmin):
    list_display = ("module", "action", "status", "user", "ip_address", "created_at")
    list_filter = ("module", "action", "status", "created_at")
    search_fields = ("message", "user__username")
    readonly_fields = ("user", "module", "action", "status", "message", "ip_address", "created_at")

