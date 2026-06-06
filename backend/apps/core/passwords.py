from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError


def generate_password(length: int = 8) -> str:
    """使用 Django 内置方法生成随机密码"""
    if length < 6:
        length = 6
    if length > 16:
        length = 16
    User = get_user_model()
    return User.objects.make_random_password(
        length=length,
        allowed_chars="abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*",
    )


def password_validation_errors(password: str, *, user=None) -> list[str]:
    errors: list[str] = []
    if len(password) < 6:
        errors.append("密码长度至少 6 位")
    if len(password) > 16:
        errors.append("密码长度不能超过 16 位")
    try:
        validate_password(password, user=user)
    except ValidationError as exc:
        errors.extend(str(message) for message in exc.messages)
    return list(dict.fromkeys(errors))
