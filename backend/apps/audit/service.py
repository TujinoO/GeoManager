from __future__ import annotations

from typing import Any


def log_operation(user: Any, module: str, action: str, status: str, message: str = "", request: Any = None) -> None:
    from apps.audit.models import OperationLog

    OperationLog.objects.create(
        user=user if getattr(user, "is_authenticated", False) else None,
        module=module,
        action=action,
        status=status,
        message=message,
        ip_address=_client_ip(request),
    )


def _client_ip(request: Any) -> str | None:
    if request is None:
        return None
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")

