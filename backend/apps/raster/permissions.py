from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser


def can_manage_raster_data(user: AbstractBaseUser) -> bool:
    return (
        user.has_perm("raster.manage_raster_dataset")
        or user.has_perm("catalog.maintain_dataresource")
        or user.is_superuser
    )


def can_manage_raster_cache(user: AbstractBaseUser) -> bool:
    return user.has_perm("raster.manage_raster_cache") or user.is_superuser
