from django import forms
from django.contrib import admin
from django.contrib.auth.admin import GroupAdmin as DjangoGroupAdmin
from django.contrib.auth.models import Group, Permission

from apps.core.models import SystemSetting
from apps.core.permissions import (
    feature_permission_ids_for,
    feature_permission_queryset,
    has_feature_perm,
)


class FeatureGroupForm(forms.ModelForm):
    feature_permissions = forms.ModelMultipleChoiceField(
        label="平台功能权限",
        queryset=Permission.objects.none(),
        required=False,
        widget=admin.widgets.FilteredSelectMultiple("平台功能权限", is_stacked=False),
    )

    class Meta:
        model = Group
        fields = ("name", "feature_permissions")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        queryset = feature_permission_queryset().order_by(
            "content_type__app_label", "codename"
        )
        self.fields["feature_permissions"].queryset = queryset
        if self.instance.pk:
            self.fields[
                "feature_permissions"
            ].initial = self.instance.permissions.filter(id__in=queryset)

    def save(self, commit=True):
        group = super().save(commit=commit)
        if commit:
            selected = set(
                self.cleaned_data["feature_permissions"].values_list("id", flat=True)
            )
            feature_ids = set(
                feature_permission_queryset().values_list("id", flat=True)
            )
            current_non_feature = set(
                group.permissions.exclude(id__in=feature_ids).values_list(
                    "id", flat=True
                )
            )
            group.permissions.set([*current_non_feature, *selected])
        return group


admin.site.unregister(Group)


@admin.register(Group)
class FeatureGroupAdmin(DjangoGroupAdmin):
    form = FeatureGroupForm
    fields = ("name", "feature_permissions")
    list_display = ("name", "feature_permission_count")
    search_fields = ("name",)

    @admin.display(description="平台功能权限数")
    def feature_permission_count(self, obj):
        return len(feature_permission_ids_for(obj))

    def has_module_permission(self, request):
        return has_feature_perm(request.user, "core.manage_feature_permissions")

    def has_view_permission(self, request, obj=None):
        return has_feature_perm(request.user, "core.manage_feature_permissions")

    def has_add_permission(self, request):
        return has_feature_perm(request.user, "core.manage_feature_permissions")

    def has_change_permission(self, request, obj=None):
        return has_feature_perm(request.user, "core.manage_feature_permissions")

    def has_delete_permission(self, request, obj=None):
        return has_feature_perm(request.user, "core.manage_feature_permissions")


@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    fields = ("allow_registration", "updated_at")
    list_display = ("allow_registration", "updated_at")
    readonly_fields = ("updated_at",)

    def has_module_permission(self, request):
        return has_feature_perm(request.user, "core.access_admin")

    def has_view_permission(self, request, obj=None):
        return has_feature_perm(request.user, "core.access_admin")

    def has_add_permission(self, request):
        return not SystemSetting.objects.exists() and has_feature_perm(
            request.user, "core.access_admin"
        )

    def has_change_permission(self, request, obj=None):
        return has_feature_perm(request.user, "core.access_admin")

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        obj.pk = 1
        super().save_model(request, obj, form, change)
