from django.db.models import Q


def access_filter(user):
    if user.is_superuser:
        return Q()
    return Q(access_groups__isnull=True) | Q(access_groups__in=user.groups.all())


def filter_accessible(queryset, user):
    if user.is_superuser:
        return queryset
    return queryset.filter(access_filter(user)).distinct()


def user_can_access(obj, user) -> bool:
    if user.is_superuser:
        return True
    access_groups = obj.access_groups.all()
    if not access_groups.exists():
        return True
    return access_groups.filter(id__in=user.groups.values("id")).exists()

