"""Editable, resource-bound report drafts using the existing result lifecycle."""

import base64
import binascii
import io
import json
import uuid
import warnings

from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from PIL import Image, UnidentifiedImageError

from apps.audit.service import log_operation
from apps.catalog.models import DataResource, ResultArtifact
from apps.catalog.permissions import user_can_access
from apps.catalog.results import (
    _result_for_user,
    _serialize_result,
    _user_can_manage_result,
)
from apps.catalog.taxonomy import resolve_data_category
from apps.core.api import api_login_required
from apps.core.permissions import feature_denied_response, has_feature_perm
from apps.core.storage import app_path


def _text(value, limit):
    if not isinstance(value, str) or len(value) > limit:
        raise ValueError("报告文字类型或长度不符合要求")
    return value


def validate_document(value):
    if not isinstance(value, dict):
        raise ValueError("缺少报告编辑内容")
    title = _text(value.get("title"), 160).strip()
    if not title:
        raise ValueError("请填写报告标题")
    paragraphs, figures = value.get("paragraphs"), value.get("figures")
    if not isinstance(paragraphs, list) or len(paragraphs) > 40:
        raise ValueError("分析文字最多40段")
    if not isinstance(figures, list) or len(figures) > 30:
        raise ValueError("图表最多30幅")
    clean = {
        "title": title,
        "source": _text(value.get("source", ""), 4000),
        "paragraphs": [_text(p, 4000) for p in paragraphs],
        "figures": [],
    }
    ids = set()
    for figure in figures:
        if not isinstance(figure, dict):
            raise ValueError("图表内容无效")
        fid = _text(figure.get("id"), 100)
        image = _text(figure.get("imageData"), 2 * 1024 * 1024)
        if not fid or fid in ids or not image.startswith("data:image/png;base64,"):
            raise ValueError("图表编号必须唯一，图片必须为PNG")
        ids.add(fid)
        try:
            raw = base64.b64decode(image.split(",", 1)[1], validate=True)
            _image(io.BytesIO(raw)).close()
        except (ValueError, binascii.Error) as exc:
            raise ValueError("图表PNG内容无效") from exc
        if not isinstance(figure.get("included"), bool):
            raise ValueError("请明确选择纳入报告的图表")
        clean["figures"].append(
            {
                "id": fid,
                "title": _text(figure.get("title"), 200),
                "caption": _text(figure.get("caption", ""), 4000),
                "imageData": image,
                "included": figure["included"],
            }
        )
    if not clean["paragraphs"] and not any(f["included"] for f in clean["figures"]):
        raise ValueError("报告至少包含一段分析或一幅图表")
    return clean


def _image(stream):
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            image = Image.open(stream)
            if (
                image.format != "PNG"
                or not 1 <= image.width <= 3600
                or not 1 <= image.height <= 3600
            ):
                raise ValueError("PNG图片长边不得超过3600像素")
            image.load()
            rgba = image.convert("RGBA")
            background = Image.new("RGB", image.size, "white")
            background.paste(rgba, mask=rgba.getchannel("A"))
            return background
    except (
        OSError,
        UnidentifiedImageError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as exc:
        raise ValueError("PNG图片内容无效或过大") from exc


@require_http_methods(["GET", "POST"])
@api_login_required
def report(request, id=None):
    existing = _result_for_user(request.user, id) if id else None
    if id and (existing is None or not existing.report_document):
        return JsonResponse({"detail": "分析报告不存在"}, status=404)
    if request.method == "GET":
        if not id:
            return JsonResponse({"detail": "请指定报告编号"}, status=400)
        if not has_feature_perm(request.user, "catalog.view_resultartifact"):
            return feature_denied_response(request.user)
        return JsonResponse(
            {
                **_serialize_result(existing, request.user),
                "reportDocument": existing.report_document,
            }
        )
    if not all(
        has_feature_perm(request.user, p)
        for p in [
            "core.query_data",
            "catalog.export_dataresource",
            "catalog.add_resultartifact",
            "catalog.view_resultartifact",
        ]
    ):
        return feature_denied_response(request.user)
    if existing and not _user_can_manage_result(existing, request.user):
        return JsonResponse({"detail": "分析报告不存在"}, status=404)
    if existing and existing.status != "draft":
        return JsonResponse(
            {"detail": "待审核或已发布报告不能编辑，请退回或下架后修改"}, status=400
        )
    images = []
    destination = None
    try:
        resource_id = int(request.POST.get("resourceId", "0"))
        resource = DataResource.objects.filter(pk=resource_id, status="active").first()
        if not resource or not user_can_access(resource, request.user):
            return JsonResponse({"detail": "原始数据不存在或无权访问"}, status=404)
        if existing and existing.source_resource_id != resource.pk:
            raise ValueError("不能更换报告关联的原始数据，请另存新报告")
        raw = request.POST.get("document", "")
        if len(raw.encode("utf-8")) > 6 * 1024 * 1024:
            raise ValueError("报告编辑内容超过6MiB，请减少图表")
        document = validate_document(json.loads(raw))
        pages = request.FILES.getlist("pages")
        if not 1 <= len(pages) <= 20 or sum(p.size for p in pages) > 32 * 1024 * 1024:
            raise ValueError("请提供1–20页PNG预览，合计不超过32MiB")
        pixels = 0
        for page in pages:
            image = _image(page)
            images.append(image)
            pixels += image.width * image.height
            if pixels > 100_000_000:
                raise ValueError("报告页面总像素过多，请分成两份报告")
        # Match map export: browser prepares styled, high-resolution pages;
        # server validates them and owns final PDF persistence.
        key = uuid.uuid4().hex
        relative = f"exports/results/{key}/analysis-report.pdf"
        destination = app_path(*relative.split("/"))
        destination.parent.mkdir(parents=True, exist_ok=True)
        images[0].save(
            destination,
            "PDF",
            save_all=True,
            append_images=images[1:],
            resolution=240,
            quality=95,
        )
        with transaction.atomic():
            artifact = (
                ResultArtifact.objects.select_for_update().get(pk=existing.pk)
                if existing
                else ResultArtifact(owner=request.user)
            )
            if existing and artifact.status != "draft":
                raise ValueError("报告状态已经变化，请刷新后再操作")
            artifact.name = document["title"]
            artifact.description = "\n".join(document["paragraphs"])[:4000]
            artifact.source_type = "analysis"
            artifact.result_type = "report"
            artifact.status = "draft"
            artifact.category = resource.category or resolve_data_category(
                {
                    "individual": "thematic_individual",
                    "population": "thematic_population",
                    "community": "thematic_community",
                }.get(resource.domain_type, "thematic_gene_germplasm")
            )
            artifact.source_resource = resource
            artifact.report_document = document
            artifact.requires_review = True
            artifact.review_note = ""
            artifact.file_path = relative
            artifact.file_name = f"{artifact.name}.pdf"
            artifact.mime_type = "application/pdf"
            artifact.size_bytes = destination.stat().st_size
            artifact.published_at = None
            artifact.published_by = None
            artifact.save()
            log_operation(
                request.user,
                "数据分析",
                "保存分析报告草稿",
                "success",
                artifact.name,
                request,
                target_type="result_artifact",
                target_id=artifact.id,
                target_name=artifact.name,
            )
        return JsonResponse(
            {**_serialize_result(artifact, request.user), "reportDocument": document},
            status=200 if existing else 201,
        )
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        return JsonResponse({"detail": str(exc) or "报告参数无效"}, status=400)
    finally:
        for image in images:
            image.close()
