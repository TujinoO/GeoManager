from django.db.models import Q

from apps.core.initialization import SUPERADMIN_GROUP_NAME


def user_group_ids(user) -> set[int]:
    if user.is_anonymous:
        return set()
    cached = getattr(user, "_huyang_group_ids", None)
    if cached is None:
        cached = set(user.groups.values_list("id", flat=True))
        setattr(user, "_huyang_group_ids", cached)
    return cached


def user_is_superadmin_group_member(user) -> bool:
    if user.is_anonymous:
        return False
    cached = getattr(user, "_huyang_is_superadmin_group_member", None)
    if cached is None:
        cached = user.groups.filter(name=SUPERADMIN_GROUP_NAME).exists()
        setattr(user, "_huyang_is_superadmin_group_member", cached)
    return bool(cached)


def access_filter(user):
    if user.is_superuser or user_is_superadmin_group_member(user):
        return Q()
    group_ids = user_group_ids(user)
    if not group_ids:
        return Q(access_groups__isnull=True)
    return Q(access_groups__isnull=True) | Q(access_groups__in=group_ids)


def resource_access_filter(user):
    if user.is_superuser or user_is_superadmin_group_member(user):
        return Q()
    group_ids = user_group_ids(user)
    if not group_ids:
        return Q(maintainer__isnull=True, access_groups__isnull=True) | Q(
            maintainer=user
        )
    return (
        Q(maintainer__isnull=True, access_groups__isnull=True)
        | Q(access_groups__in=group_ids)
        | Q(maintainer=user)
    )


def related_access_filter(user, relation: str):
    if user.is_superuser or user_is_superadmin_group_member(user):
        return Q()
    group_ids = user_group_ids(user)
    null_lookup = f"{relation}__access_groups__isnull"
    maintainer_null_lookup = f"{relation}__maintainer__isnull"
    maintainer_lookup = f"{relation}__maintainer"
    if not group_ids:
        return (
            Q(**{relation: None})
            | Q(**{maintainer_null_lookup: True, null_lookup: True})
            | Q(**{maintainer_lookup: user})
        )
    group_lookup = f"{relation}__access_groups__in"
    return (
        Q(**{relation: None})
        | Q(**{maintainer_null_lookup: True, null_lookup: True})
        | Q(**{group_lookup: group_ids})
        | Q(**{maintainer_lookup: user})
    )


def filter_accessible(queryset, user):
    if user.is_superuser or user_is_superadmin_group_member(user):
        return queryset
    if _model_has_field(queryset.model, "maintainer"):
        return queryset.filter(resource_access_filter(user)).distinct()
    return queryset.filter(access_filter(user)).distinct()


def user_can_access(obj, user) -> bool:
    if user.is_superuser or user_is_superadmin_group_member(user):
        return True
    if getattr(obj, "maintainer_id", None) == getattr(user, "id", None):
        return True
    prefetched = getattr(obj, "_prefetched_objects_cache", {})
    if "access_groups" in prefetched:
        access_groups = prefetched["access_groups"]
        if not access_groups:
            return (
                not _model_has_field(obj.__class__, "maintainer")
                or getattr(obj, "maintainer_id", None) is None
            )
        groups = user_group_ids(user)
        return any(group.id in groups for group in access_groups)

    access_groups = obj.access_groups
    if not access_groups.exists():
        return (
            not _model_has_field(obj.__class__, "maintainer")
            or getattr(obj, "maintainer_id", None) is None
        )
    return access_groups.filter(id__in=user_group_ids(user)).exists()


def _model_has_field(model, field_name: str) -> bool:
    return any(field.name == field_name for field in model._meta.get_fields())
