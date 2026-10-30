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
from apps.omics.upload_matching import match_genome_uploads


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
    all_files = [f for _, items in request.FILES.lists() for f in items]
    if sum(f.size for f in all_files) > 512 * 1024 * 1024:
        return JsonResponse(
            {
                "detail": "配套上传文件合计不得超过512MiB；更大数据请使用管理命令流式接入"
            },
            status=400,
        )
    try:
        if "files" in request.FILES:
            if set(request.FILES) != {"files"}:
                raise GenomeError("整组选择文件不能与单独指定用途的文件同时提交")
            selected = match_genome_uploads(request.FILES.getlist("files"))
        else:
            selected = {role: request.FILES[role] for role in request.FILES}
            if set(selected) - {"genome", "gff", "protein", "rna", "cds"} or any(
                len(items) != 1 for _, items in request.FILES.lists()
            ):
                raise GenomeError("文件用途无效或重复，请重新选择配套文件")
            if not {"genome", "gff"} <= set(selected):
                raise GenomeError("必须选择基因组序列和GFF注释配套文件")
    except GenomeError as exc:
        return JsonResponse({"detail": str(exc)}, status=400)
    source_url = request.POST.get("sourceUrl", "").strip()
    if len(source_url) > 2000:
        return JsonResponse({"detail": "来源说明不能超过2000字"}, status=400)
    paths = {}
    # Individual temporary upload copies are retained under the OS temp directory;
    # no recursive cleanup or deletion is performed by this importer.
    root = Path(tempfile.mkdtemp(prefix="gpedsp-genome-"))
    try:
        for role in ["genome", "gff", "protein", "rna", "cds"]:
            file = selected.get(role)
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
            index["matchedFiles"] = [
                {"role": role, "name": file.name} for role, file in selected.items()
            ]
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
