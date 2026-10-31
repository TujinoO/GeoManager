import hashlib
import io
from datetime import timedelta
from pathlib import Path
from uuid import uuid4
from urllib.parse import urlparse

from PIL import Image, UnidentifiedImageError
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse, FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.http import require_http_methods

from apps.core.permissions import has_feature_perm
from apps.core.storage import app_path
from apps.audit.service import log_operation
from apps.core.api import api_login_required
from functools import wraps
from django.http import Http404
import json
from .models import Article, Asset


def payload(request):
    if len(request.body) > 1024 * 1024:
        raise ValidationError("内容请求不能超过1 MiB")
    try:
        value = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as exc:
        raise ValidationError("请求必须是UTF-8 JSON对象") from exc
    if not isinstance(value, dict):
        raise ValidationError("请求必须是JSON对象")
    return value


def content_api(view):
    @wraps(view)
    @api_login_required
    def wrapped(request, *args, **kwargs):
        try:
            with transaction.atomic():
                return view(request, *args, **kwargs)
        except ValidationError as exc:
            return JsonResponse({"detail": "；".join(exc.messages)}, status=400)
        except Http404:
            return JsonResponse({"detail": "内容或附件不存在"}, status=404)

    return wrapped


def can_edit(user):
    return has_feature_perm(user, "core.manage_auth")


def asset_url(asset):
    return f"/api/content/assets/{asset.pk}/"


def serialize_asset(asset):
    return {
        "id": asset.pk,
        "name": asset.name,
        "url": asset_url(asset),
        "mimeType": asset.mime_type,
        "caption": asset.caption,
        "pending": asset.expires_at is not None,
    }


def serialize(article, *, editor=True):
    return {
        "id": article.pk,
        "kind": article.kind,
        "title": article.title,
        "summary": article.summary,
        "category": article.category,
        "body": article.body,
        "status": article.status,
        "source": article.source if editor else "",
        "links": article.links,
        "eventDate": article.event_date.isoformat() if article.event_date else "",
        "publishedAt": article.published_at.isoformat() if article.published_at else "",
        "coverUrl": asset_url(article.cover_asset) if article.cover_asset_id else "",
        "assets": [
            serialize_asset(a) for a in article.assets.all() if a.expires_at is None
        ],
        "pinned": article.pinned,
        "revision": article.revision,
    }


def article_query(user, manage=False):
    query = Article.objects.select_related("cover_asset").prefetch_related("assets")
    return query if manage and can_edit(user) else query.filter(status="published")


@content_api
@require_http_methods(["GET", "POST"])
def articles(request):
    if request.method == "POST":
        if not can_edit(request.user):
            return JsonResponse({"detail": "需要内容管理权限"}, status=403)
        article = Article(owner=request.user)
        set_values(article, payload(request))
        article.full_clean()
        article.save()
        log_operation(
            request.user, "内容管理", "创建内容", "success", article.title, request
        )
        return JsonResponse(serialize(article), status=201)
    manage = request.GET.get("manage") == "1"
    if manage and not can_edit(request.user):
        return JsonResponse({"detail": "需要内容管理权限"}, status=403)
    query = article_query(request.user, manage)
    for key in ("kind", "category"):
        if request.GET.get(key):
            query = query.filter(**{key: request.GET[key]})
    if request.GET.get("q"):
        q = request.GET["q"][:150]
        query = query.filter(
            Q(title__icontains=q) | Q(summary__icontains=q) | Q(category__icontains=q)
        )
    try:
        offset = max(0, int(request.GET.get("offset", 0)))
        limit = min(100, max(1, int(request.GET.get("limit", 24))))
    except ValueError:
        raise ValidationError("分页参数必须为整数")
    return JsonResponse(
        {
            "items": [
                serialize(a, editor=can_edit(request.user))
                for a in query[offset : offset + limit]
            ],
            "total": query.count(),
            "canEdit": can_edit(request.user),
        }
    )


@content_api
@require_http_methods(["GET", "POST"])
def article_detail(request, article_id):
    if request.method == "GET":
        article = get_object_or_404(
            article_query(request.user, can_edit(request.user)), pk=article_id
        )
        return JsonResponse(serialize(article, editor=can_edit(request.user)))
    if not can_edit(request.user):
        return JsonResponse({"detail": "需要内容管理权限"}, status=403)
    data = payload(request)
    article = get_object_or_404(Article, pk=article_id)
    if type(data.get("revision")) is not int or data["revision"] != article.revision:
        return JsonResponse({"detail": "内容已更新，请重新加载后编辑"}, status=409)
    commit_ids = data.get("commitAssetIds", [])
    remove_ids = data.get("removeAssetIds", [])
    for ids in (commit_ids, remove_ids):
        if not isinstance(ids, list) or any(type(i) is not int for i in ids):
            raise ValidationError("附件 ID 必须为整数数组")
    if set(commit_ids) & set(remove_ids):
        raise ValidationError("不能同时提交和删除同一附件")
    set_values(article, data)
    article.full_clean()
    with transaction.atomic():
        # Conditional update also protects SQLite, where SELECT FOR UPDATE is a no-op.
        fields = {
            f.attname: getattr(article, f.attname)
            for f in Article._meta.concrete_fields
            if f.name not in {"id", "revision", "updated_at"}
        }
        updated = Article.objects.filter(
            pk=article.pk, revision=data["revision"]
        ).update(**fields, revision=data["revision"] + 1, updated_at=timezone.now())
        if not updated:
            return JsonResponse({"detail": "内容已更新，请重新加载后编辑"}, status=409)
        pending = Asset.objects.filter(
            article=article,
            pk__in=commit_ids,
            pending_owner=request.user,
            expires_at__gt=timezone.now(),
        )
        if pending.count() != len(set(commit_ids)):
            raise ValidationError("暂存附件不存在、已过期或由其他编辑者上传")
        pending.update(pending_owner=None, expires_at=None)
        available = Asset.objects.filter(article=article, expires_at__isnull=True)
        if (
            article.cover_asset_id
            and not available.filter(pk=article.cover_asset_id).exists()
        ):
            raise ValidationError("封面必须是本次提交或已保存的附件")
        removed = list(available.filter(pk__in=remove_ids))
        if len(removed) != len(set(remove_ids)):
            raise ValidationError("附件不存在或不属于本条内容")
        captions = data.get("assetCaptions", [])
        if not isinstance(captions, list):
            raise ValidationError("assetCaptions 必须为数组")
        for item in captions:
            if (
                not isinstance(item, dict)
                or type(item.get("id")) is not int
                or not isinstance(item.get("caption"), str)
            ):
                raise ValidationError("图片说明格式无效")
            if not available.filter(pk=item["id"]).update(
                caption=item["caption"][:500]
            ):
                raise ValidationError("附件不存在或尚未提交")
        for asset in removed:
            target = app_path(asset.path)
            asset.delete()
            transaction.on_commit(lambda target=target: target.unlink(missing_ok=True))
    article.refresh_from_db()
    log_operation(
        request.user, "内容管理", "保存内容", "success", article.title, request
    )
    return JsonResponse(serialize(article))


def set_values(article, data):
    for name in ("title", "summary", "category", "body", "source", "kind", "status"):
        if name in data:
            if not isinstance(data[name], str):
                raise ValidationError(f"{name} 必须是文本")
            setattr(article, name, data[name].strip())
    if len(article.body) > 200_000:
        raise ValidationError("正文过长")
    if "links" in data:
        links = data["links"]
        if not isinstance(links, list) or len(links) > 30:
            raise ValidationError("学习链接最多 30 条")
        for link in links:
            if (
                not isinstance(link, dict)
                or not isinstance(link.get("title"), str)
                or not isinstance(link.get("url"), str)
            ):
                raise ValidationError("学习链接格式错误")
            try:
                url = urlparse(link["url"])
            except ValueError as exc:
                raise ValidationError("链接必须为 HTTP(S) 地址") from exc
            if (
                url.scheme not in {"https", "http"}
                or not url.netloc
                or url.username
                or url.password
            ):
                raise ValidationError("链接必须为 HTTP(S) 地址")
        article.links = links
    if "eventDate" in data:
        if not isinstance(data["eventDate"], str):
            raise ValidationError("事件日期必须为 YYYY-MM-DD 文本")
        try:
            article.event_date = (
                parse_date(data["eventDate"]) if data["eventDate"] else None
            )
        except ValueError as exc:
            raise ValidationError("事件日期无效") from exc
        if data["eventDate"] and not article.event_date:
            raise ValidationError("事件日期无效")
    if "pinned" in data:
        if type(data["pinned"]) is not bool:
            raise ValidationError("pinned 必须为布尔值")
        article.pinned = data["pinned"]
    if "coverAssetId" in data:
        asset_id = data["coverAssetId"]
        article.cover_asset = (
            get_object_or_404(Asset, pk=asset_id, article_id=article.pk)
            if asset_id
            else None
        )
    if article.status == "published" and not article.published_at:
        article.published_at = timezone.now()


def store_asset(article, name, content, caption="", *, pending_owner=None):
    if len(content) > 30 * 1024 * 1024:
        raise ValidationError("附件不能超过 30 MiB")
    suffix = Path(name).suffix.lower()
    if suffix == ".pdf" and content.startswith(b"%PDF-"):
        mime = "application/pdf"
    elif suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        try:
            with Image.open(io.BytesIO(content)) as im:
                expected = {
                    ".png": "PNG",
                    ".jpg": "JPEG",
                    ".jpeg": "JPEG",
                    ".webp": "WEBP",
                }[suffix]
                if im.format != expected:
                    raise ValidationError("图片格式与文件扩展名不一致")
                im.verify()
        except (
            UnidentifiedImageError,
            Image.DecompressionBombError,
            ValueError,
            OSError,
        ):
            raise ValidationError("无效的图片文件")
        mime = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}[
            expected
        ]
    else:
        raise ValidationError("只支持 PNG、JPG、WebP 和 PDF")
    digest = hashlib.sha256(content).hexdigest()
    existing = Asset.objects.filter(
        article=article, checksum=digest, expires_at__isnull=True
    ).first()
    if existing:
        return existing
    relative = f"media/content/{article.pk}/{uuid4().hex}{suffix}"
    target = app_path(relative)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    try:
        return Asset.objects.create(
            article=article,
            name=Path(name).name,
            path=relative,
            mime_type=mime,
            checksum=digest,
            size_bytes=len(content),
            caption=caption[:500],
            pending_owner=pending_owner,
            expires_at=timezone.now() + timedelta(hours=24) if pending_owner else None,
        )
    except Exception:
        target.unlink(missing_ok=True)
        raise


@content_api
@require_http_methods(["POST"])
def upload_asset(request, article_id):
    if not can_edit(request.user):
        return JsonResponse({"detail": "需要内容管理权限"}, status=403)
    article = get_object_or_404(Article, pk=article_id)
    upload = request.FILES.get("file")
    if upload is None:
        raise ValidationError("请选择附件")
    asset = store_asset(
        article,
        upload.name,
        upload.read(30 * 1024 * 1024 + 1),
        request.POST.get("caption", ""),
        pending_owner=request.user,
    )
    return JsonResponse(serialize_asset(asset), status=201)


@content_api
@require_http_methods(["GET", "DELETE"])
def asset_file(request, asset_id):
    asset = get_object_or_404(Asset.objects.select_related("article"), pk=asset_id)
    if asset.expires_at is not None:
        if (
            asset.expires_at <= timezone.now()
            or not can_edit(request.user)
            or asset.pending_owner_id != request.user.pk
        ):
            return JsonResponse({"detail": "暂存附件不存在或已过期"}, status=404)
    if request.method == "DELETE":
        if asset.expires_at is None:
            return JsonResponse({"detail": "已提交附件请随正文保存删除"}, status=400)
        target = app_path(asset.path)
        asset.delete()
        target.unlink(missing_ok=True)
        return JsonResponse({"detail": "暂存附件已撤销"})
    if asset.article.status != "published" and not can_edit(request.user):
        return JsonResponse({"detail": "媒体不存在或未发布"}, status=404)
    target = app_path(asset.path)
    if not target.is_file():
        return JsonResponse({"detail": "文件不存在"}, status=404)
    response = FileResponse(
        target.open("rb"), content_type=asset.mime_type, filename=asset.name
    )
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "private, no-store"
    return response
