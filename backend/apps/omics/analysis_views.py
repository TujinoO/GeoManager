from __future__ import annotations

import tempfile
from pathlib import Path

from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from apps.audit.service import log_operation
from apps.catalog.permissions import filter_accessible, user_can_access
from apps.catalog.models import DataResource
from apps.core.api import api_login_required
from apps.core.permissions import feature_denied_response, has_feature_perm
from apps.omics.genome_index import (
    GenomeError,
    assembly_item,
    build_index,
    gene_detail,
    search_genes,
    sequence_region,
    summary_payload,
)
from apps.omics.models import GenomeIndex


def authorized_index(request, id):
    if not has_feature_perm(request.user, "core.query_data"):
        return None, feature_denied_response(request.user)
    index = (
        GenomeIndex.objects.select_related(
            "assembly__data_resource", "assembly__genome_dataset"
        )
        .filter(
            assembly_id=id, status="ready", assembly__data_resource__status="active"
        )
        .first()
    )
    if not index:
        return None, JsonResponse({"detail": "组装不存在或索引未就绪"}, status=404)
    if not user_can_access(index.assembly.data_resource, request.user):
        return None, JsonResponse({"detail": "无权访问该组装"}, status=403)
    return index, None


@require_GET
@api_login_required
def assemblies(request):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)
    ids = filter_accessible(
        DataResource.objects.filter(status="active"), request.user
    ).values_list("pk", flat=True)
    indexes = (
        GenomeIndex.objects.select_related("assembly__genome_dataset")
        .filter(status="ready", assembly__data_resource_id__in=ids)
        .order_by("assembly__assembly_code")
    )
    return JsonResponse({"items": [assembly_item(i) for i in indexes]})


@require_GET
@api_login_required
def summary(request, id):
    index, error = authorized_index(request, id)
    if error:
        return error
    return JsonResponse(summary_payload(index))


@require_GET
@api_login_required
def genes(request, id):
    index, error = authorized_index(request, id)
    if error:
        return error
    try:
        return JsonResponse(search_genes(index, request.GET))
    except GenomeError as exc:
        return JsonResponse({"detail": str(exc)}, status=400)


@require_GET
@api_login_required
def gene(request, id, geneId):
    index, error = authorized_index(request, id)
    if error:
        return error
    try:
        return JsonResponse(gene_detail(index, geneId))
    except GenomeError as exc:
        return JsonResponse({"detail": str(exc)}, status=404)


@require_GET
@api_login_required
def sequence(request, id):
    index, error = authorized_index(request, id)
    if error:
        return error
    try:
        return JsonResponse(sequence_region(index, request.GET))
    except GenomeError as exc:
        return JsonResponse({"detail": str(exc)}, status=400)


@require_POST
@api_login_required
def genome_import(request):
    if not has_feature_perm(request.user, "catalog.add_dataresource"):
        return feature_denied_response(request.user)
    if sum(f.size for f in request.FILES.values()) > 512 * 1024 * 1024:
        return JsonResponse(
            {
                "detail": "配套上传文件合计不得超过512MiB；更大数据请使用管理命令流式接入"
            },
            status=400,
        )
    # Only explicitly named role files are accepted. Original archive paths are never extracted.
    if not {"genome", "gff"} <= set(request.FILES):
        return JsonResponse({"detail": "必须选择genome和gff配套文件"}, status=400)
    source_url = request.POST.get("sourceUrl", "").strip()
    if len(source_url) > 2000:
        return JsonResponse({"detail": "来源说明不能超过2000字"}, status=400)
    paths = {}
    # Individual temporary upload copies are retained under the OS temp directory;
    # no recursive cleanup or deletion is performed by this importer.
    root = Path(tempfile.mkdtemp(prefix="gpedsp-genome-"))
    try:
        for role in ["genome", "gff", "protein", "rna", "cds"]:
            file = request.FILES.get(role)
            if file is None:
                continue
            path = root / (
                role + (".gz" if file.name.lower().endswith(".gz") else ".txt")
            )
            with path.open("xb") as handle:
                for chunk in file.chunks():
                    handle.write(chunk)
            paths[role] = path
        validate_only = request.POST.get("validateOnly") == "true"
        index = build_index(
            files=paths,
            code=request.POST.get("code", "").strip(),
            name=request.POST.get("name", "").strip(),
            user=request.user,
            provenance=request.POST.get("provenance", ""),
            sex=request.POST.get("sex", "unknown"),
            source_url=source_url,
            max_expanded=4 * 1024 * 1024 * 1024,
            validate_only=validate_only,
        )
        if validate_only:
            return JsonResponse(index)
        log_operation(
            request.user,
            "数据分析",
            "导入基因组",
            "success",
            index.assembly.assembly_code,
            request,
            target_type="data_resource",
            target_id=index.assembly.data_resource_id,
        )
        return JsonResponse(summary_payload(index), status=201)
    except GenomeError as exc:
        log_operation(
            request.user, "数据分析", "导入基因组", "failed", str(exc), request
        )
        return JsonResponse({"detail": str(exc)}, status=400)
