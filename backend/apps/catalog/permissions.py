from django.db.models import Q


def user_group_ids(user) -> set[int]:
    if user.is_anonymous:
        return set()
    cached = getattr(user, "_huyang_group_ids", None)
    if cached is None:
        cached = set(user.groups.values_list("id", flat=True))
        setattr(user, "_huyang_group_ids", cached)
    return cached


def access_filter(user):
    if user.is_superuser:
        return Q()
    group_ids = user_group_ids(user)
    if not group_ids:
        return Q(access_groups__isnull=True)
    return Q(access_groups__isnull=True) | Q(access_groups__in=group_ids)


def related_access_filter(user, relation: str):
    if user.is_superuser:
        return Q()
    group_ids = user_group_ids(user)
    null_lookup = f"{relation}__access_groups__isnull"
    if not group_ids:
        return Q(**{null_lookup: True})
    group_lookup = f"{relation}__access_groups__in"
    return Q(**{null_lookup: True}) | Q(**{group_lookup: group_ids})


def filter_accessible(queryset, user):
    if user.is_superuser:
        return queryset
    return queryset.filter(access_filter(user)).distinct()


def user_can_access(obj, user) -> bool:
    if user.is_superuser:
        return True
    prefetched = getattr(obj, "_prefetched_objects_cache", {})
    if "access_groups" in prefetched:
        access_groups = prefetched["access_groups"]
        if not access_groups:
            return True
        groups = user_group_ids(user)
        return any(group.id in groups for group in access_groups)

    access_groups = obj.access_groups
    if not access_groups.exists():
        return True
    return access_groups.filter(id__in=user_group_ids(user)).exists()
