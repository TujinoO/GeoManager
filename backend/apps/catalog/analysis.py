from __future__ import annotations

import csv
import io
import json
import math
import re
import uuid

import numpy as np
import pandas as pd
from django.db import transaction
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from apps.audit.service import log_operation
from apps.catalog.analysis_templates import TEMPLATES, template_bytes, template_catalog
from apps.catalog.analysis_visuals import build_visuals
from apps.catalog.ecology_contracts import normalize_analysis_table
from apps.catalog.taxonomy import resolve_data_category
from apps.catalog.analysis_readers import read_analysis_upload
from apps.catalog.importer import (
    ImportDataError,
    import_plain_table,
)
from apps.catalog.models import DataResource
from apps.catalog.nongeo import (
    NonGeoAnalysisError,
    _authorized_resource,
    _resource_dataframe,
)
from apps.catalog.permissions import user_can_access
from apps.core.api import api_login_required
from apps.core.permissions import feature_denied_response, has_feature_perm
from apps.omics.models import AnalysisView

MAX_ROWS = 200_000


def body_json(request):
    try:
        value = json.loads(request.body or b"{}")
    except (ValueError, UnicodeError) as exc:
        raise ValueError("请求体必须为有效JSON") from exc
    if not isinstance(value, dict):
        raise ValueError("请求体必须为对象")
    return value


@require_GET
@api_login_required
def templates(request):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)
    return JsonResponse(template_catalog())


@require_GET
@api_login_required
def template_file(request, kind):
    if not has_feature_perm(request.user, "core.browse_data"):
        return feature_denied_response(request.user)
    fmt = request.GET.get("format", "zip" if kind == "genome" else "csv")
    if kind not in {*TEMPLATES, "genome"} or fmt not in (
        {"zip"} if kind == "genome" else {"csv", "xlsx"}
    ):
        return JsonResponse({"detail": "模板类型或格式无效"}, status=400)
    data, mime, filename = template_bytes(
        kind, example=request.GET.get("example") == "true", file_format=fmt
    )
    response = HttpResponse(data, content_type=mime)
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def validate_table(df, kind):
    spec = TEMPLATES[kind]
    issues, warnings = [], []
    if df.empty:
        issues.append("数据表为空；空模板请填写后再导入")
    if len(df) > MAX_ROWS:
        issues.append(f"超过{MAX_ROWS}行在线分析限制，请分拆为有语义的数据集")
    missing = set(spec["columns"]) - set(df.columns)
    if missing:
        return ["缺少字段：" + ", ".join(sorted(missing))], warnings
    for field in spec["required"]:
        mask = df[field].isna() | df[field].astype(str).str.strip().eq("")
        if mask.any():
            issues.append(
                f"{field}必填；Excel行号：{[int(i) + 2 for i in df.index[mask][:10]]}"
            )
    duplicates = df.duplicated(spec["unique"], keep=False)
    if duplicates.any():
        issues.append(
            f"联合键{'+'.join(spec['unique'])}重复；行号：{[int(i) + 2 for i in df.index[duplicates][:10]]}"
        )
    for field in spec["numeric"]:
        if field not in df:
            continue
        raw = df[field].astype(str).str.strip()
        values = pd.to_numeric(df[field].replace("", None), errors="coerce")
        invalid = (
            ~raw.isin({"", "NA", "N/A", "NaN", "nan", "NULL", "null"})
            & df[field].notna()
            & (~np.isfinite(values))
        )
        if (
            field in {"longitude", "latitude"}
            and kind in {"individual", "population", "community", "traits", "samples"}
            and invalid.any()
        ):
            warnings.append(f"{field}含非十进制度坐标，按原文保留；不参与空间定位")
            continue
        if invalid.any():
            issues.append(
                f"{field}不是有限数值；行号：{[int(i) + 2 for i in df.index[invalid][:10]]}"
            )
        if (
            field
            in {"height_m", "value", "quality", "length_bp", "length_aa", "gc_fraction"}
            and (values < 0).any()
        ):
            issues.append(f"{field}不能为负数")
        if field == "leaf_water_fraction" and ((values < 0) | (values > 1)).any():
            issues.append("leaf_water_fraction必须为0–1；百分数请先明确转换")
        if field == "gc_fraction" and (values > 1).any():
            issues.append("GC比例必须在0–1之间")
        if (
            field == "position"
            and ((values < 1) | (values % 1 != 0) | values.isna()).any()
        ):
            issues.append("position必须为1-based正整数")
        if field in {"longitude", "latitude"}:
            bound = 180 if field == "longitude" else 90
            if ((values < -bound) | (values > bound)).any():
                issues.append(f"{field}越出WGS84合理范围")
    if kind == "samples":
        if "sex_original" in df:
            warnings.append(
                "性别含未确认原文，已保留在sex_original列并归为未确认，请复核后再用于性别比较"
            )
        if not set(df.sex.str.strip()).issubset({"female", "male", "unknown"}):
            issues.append("sex仅允许female/male/unknown；请先复核原值")
        if not set(df.is_core.fillna("").str.strip().str.lower()).issubset(
            {"true", "false", ""}
        ):
            issues.append("is_core仅允许true/false；未提供时留空")
    if kind in {"expression", "molecular"} and df["unit"].nunique() != 1:
        issues.append("一个资源只允许一种单位，防止混合统计")
    if (
        kind == "molecular"
        and pd.to_numeric(df["value"], errors="coerce").notna().sum() == 0
    ):
        warnings.append(
            "尚未提供有效测定值，入库后仅可查看样品与指标信息；补充测定值后可分析数值分布"
        )
    if (
        kind in {"expression", "function", "variants", "sequence"}
        and df["assembly"].nunique() != 1
    ):
        issues.append("一个资源只允许一套明确组装")
    if kind == "sequence":
        if not set(df["sequence_type"]).issubset(
            {"genome", "gene", "protein", "rna", "cds"}
        ):
            issues.append("序列类型仅允许genome/gene/protein/rna/cds")
        protein = df["sequence_type"].eq("protein")
        bp = pd.to_numeric(df["length_bp"].replace("", None), errors="coerce")
        aa = pd.to_numeric(df["length_aa"].replace("", None), errors="coerce")
        if (
            (~protein & (bp.isna() | (bp < 1) | (bp % 1 != 0)))
            | (protein & (aa.isna() | (aa < 1) | (aa % 1 != 0)))
        ).any():
            issues.append("核酸需填写正整数length_bp，蛋白需填写正整数length_aa")
        if (
            protein & (bp.notna() | df["gc_fraction"].replace("", None).notna())
        ).any() or (~protein & aa.notna()).any():
            issues.append("蛋白记录的核酸长度和GC应留空；核酸记录的蛋白长度应留空")
    if kind == "molecular" and df["marker"].nunique() > 1:
        warnings.append("含多个测定标记；比较前请按marker筛选")
    if kind == "variants":
        for field in ["ref", "alt"]:
            invalid = ~df[field].astype(str).str.fullmatch(r"[ACGTNacgtn]+|<[^<>]+>|\*")
            if invalid.any():
                issues.append(f"{field}必须是DNA碱基、星号或明确符号等位基因")
        invalid = ~df["genotype"].fillna("").astype(str).map(
            lambda value: (
                not value or bool(re.fullmatch(r"(?:\.|\d+)(?:[/|](?:\.|\d+))*", value))
            )
        )
        if invalid.any():
            issues.append("genotype格式无效，示例0/1、1|1或./.")
    if kind in {"samples", "molecular", "expression"}:
        warnings.append(
            "样品编号须与平台样品登记核对；本次不强行建立未经证明的个体关联"
        )
    if kind == "expression":
        warnings.append("展示原始表达及log2(value+1)，未执行差异表达或显著性检验")
    return issues, warnings


def import_table(df, kind, name, provenance, user, size=0, source=""):
    spec = TEMPLATES[kind]
    # Preserve identifiers and raw text; only numeric-contract columns convert.
    for field in spec["numeric"]:
        if field not in df:
            continue
        if (
            field in {"longitude", "latitude"}
            and pd.to_numeric(df[field].replace("", None), errors="coerce").isna().sum()
            > df[field].replace("", None).isna().sum()
        ):
            continue
        df[field] = pd.to_numeric(df[field].replace("", None), errors="coerce")
    with transaction.atomic():
        result = import_plain_table(
            df=df,
            name=name,
            table_name="analysis_" + uuid.uuid4().hex[:20],
            metadata=spec["descriptions"],
            source_size_bytes=size,
            user=user,
            access_group_ids=set(),
            domain_type=spec["domain"],
            category=resolve_data_category(
                {
                    "individual": "thematic_individual",
                    "population": "thematic_population",
                    "community": "thematic_community",
                    "traits": "thematic_community",
                }.get(kind, "thematic_gene_germplasm")
            ),
        )
        resource = DataResource.objects.get(pk=result["resourceId"])
        resource.default_visualization = {
            "analysisKind": kind,
            "provenance": provenance,
            "templateVersion": "1.0",
            "unitOfAnalysis": spec["unit"],
        }
        resource.source = source or (
            "合成演示数据" if provenance == "synthetic" else "用户提供的观测数据"
        )
        resource.quality_note = (
            "仅用于流程与界面演示，不用于研究结论"
            if provenance == "synthetic"
            else "按专业模板结构校验；科学有效性由数据提供者确认"
        )
        resource.save(update_fields=["default_visualization", "source", "quality_note"])
    return resource


@require_POST
@api_login_required
def table_import(request):
    if not has_feature_perm(request.user, "catalog.add_dataresource"):
        return feature_denied_response(request.user)
    kind, name, provenance = (
        request.POST.get("kind"),
        request.POST.get("name", "").strip(),
        request.POST.get("provenance"),
    )
    if (
        kind not in TEMPLATES
        or not 1 <= len(name) <= 160
        or provenance not in {"observed", "synthetic"}
    ):
        return JsonResponse(
            {"detail": "请选择模板类型、填写1–160字名称并明确真实/合成来源"}, status=400
        )
    uploaded = request.FILES.get("file")
    if uploaded is None or uploaded.size > 16 * 1024 * 1024:
        return JsonResponse(
            {"detail": "请选择不超过16MiB的表格或受支持的压缩文本文件"}, status=400
        )
    try:
        source = request.POST.get("source", "").strip()
        if len(source) > 160:
            raise ValueError("数据来源不能超过160字")
        df = read_analysis_upload(
            uploaded,
            kind,
            request.POST.get("assembly", ""),
            request.POST.get("sheetName"),
        )
        df = normalize_analysis_table(df, kind)
        if kind in {
            "individual",
            "population",
            "community",
            "samples",
            "traits",
            "molecular",
            "sequence",
        }:
            for field in TEMPLATES[kind]["columns"]:
                if field not in df and field not in TEMPLATES[kind]["required"]:
                    df[field] = ""
        issues, warnings = validate_table(df, kind)
        response = {
            "valid": not issues,
            "resourceId": None,
            "rowCount": len(df),
            "issues": issues,
            "warnings": warnings,
            "columns": list(df.columns),
            "rows": df.head(8).fillna("").astype(str).values.tolist(),
        }
        if issues:
            return JsonResponse(
                {"detail": "专业模板校验未通过", **response}, status=400
            )
        if request.POST.get("validateOnly") != "true":
            resource = import_table(
                df, kind, name, provenance, request.user, uploaded.size, source
            )
            response["resourceId"] = resource.pk
            log_operation(
                request.user,
                "数据分析",
                "导入专业数据",
                "success",
                f"{name}：{len(df)}行；{provenance}",
                request,
                target_type="data_resource",
                target_id=resource.pk,
            )
        return JsonResponse(response, status=201)
    except (ImportDataError, ValueError) as exc:
        return JsonResponse({"detail": str(exc)}, status=400)


def parse_query(payload, columns):
    allowed = {
        "keyword",
        "groupBy",
        "metric",
        "xField",
        "yField",
        "filters",
        "offset",
        "limit",
    }
    if set(payload) - allowed:
        raise ValueError("含未支持的查询字段")
    for key in ["groupBy", "metric", "xField", "yField"]:
        if payload.get(key) and payload[key] not in columns:
            raise ValueError(f"字段不存在：{key}")
    filters = payload.get("filters", [])
    if not isinstance(filters, list) or len(filters) > 8:
        raise ValueError("最多8个筛选条件")
    for item in filters:
        if (
            not isinstance(item, dict)
            or item.get("field") not in columns
            or item.get("op") not in {"eq", "contains", "gte", "lte", "missing"}
            or not isinstance(item.get("value", ""), str)
        ):
            raise ValueError("筛选条件无效")
    for k, default, low, high in [("offset", 0, 0, 10_000_000), ("limit", 30, 1, 500)]:
        value = payload.get(k, default)
        if (
            isinstance(value, bool)
            or not isinstance(value, int)
            or not low <= value <= high
        ):
            raise ValueError(f"{k}越界")
    if (
        not isinstance(payload.get("keyword", ""), str)
        or len(payload.get("keyword", "")) > 200
    ):
        raise ValueError("关键词最长200字符")
    return payload


def load_filtered(resource, payload):
    df, total, _ = _resource_dataframe(resource, limit=MAX_ROWS + 1, offset=0)
    if total > MAX_ROWS:
        raise ValueError(
            f"此资源超过{MAX_ROWS}行，请预聚合后导入，不显示部分统计冒充全量"
        )
    df = df.replace([np.inf, -np.inf], np.nan)
    parse_query(payload, df.columns)
    keyword = payload.get("keyword", "").strip()
    if keyword:
        mask = pd.Series(False, index=df.index)
        for c in df:
            mask |= (
                df[c]
                .fillna("")
                .astype(str)
                .str.contains(keyword, case=False, regex=False)
            )
        df = df[mask]
    for item in payload.get("filters", []):
        field, op, value = item["field"], item["op"], item.get("value", "")
        s = df[field]
        if op == "missing":
            mask = s.isna() | s.astype(str).str.strip().eq("")
        elif op == "eq":
            mask = s.fillna("").astype(str).eq(value)
        elif op == "contains":
            mask = s.fillna("").astype(str).str.contains(value, regex=False, case=False)
        else:
            try:
                numeric = float(value)
            except ValueError as exc:
                raise ValueError("数值筛选必须填写有限数值") from exc
            if not math.isfinite(numeric):
                raise ValueError("数值筛选必须填写有限数值")
            values = pd.to_numeric(s, errors="coerce")
            mask = values.ge(numeric) if op == "gte" else values.le(numeric)
        df = df[mask]
    return df, total


def numeric_series(s):
    nonempty = s.dropna().astype(str).str.strip()
    nonempty = nonempty[nonempty.ne("")]
    values = pd.to_numeric(s, errors="coerce").replace([np.inf, -np.inf], np.nan)
    return values, bool(len(nonempty) and values.notna().sum() == len(nonempty))


def analysis_payload(resource, query, df, total):
    kind = resource.default_visualization.get("analysisKind", "table")
    profiles, numeric = [], {}
    for field in df:
        values, is_numeric = numeric_series(df[field])
        if field in {"record_id", "sample_code", "gene_id", "plot_code", "replicate"}:
            is_numeric = False
        if is_numeric:
            numeric[field] = values
        valid = (
            values.dropna()
            if is_numeric
            else df[field][df[field].notna() & df[field].astype(str).str.strip().ne("")]
        )
        profiles.append(
            {
                "name": field,
                "numeric": is_numeric,
                "missing": len(df) - len(valid),
                "n": len(valid),
                **{
                    stat: (
                        float(getattr(valid, stat)())
                        if is_numeric and len(valid)
                        else None
                    )
                    for stat in ["min", "max", "mean", "median"]
                },
                "q1": float(valid.quantile(0.25))
                if is_numeric and len(valid)
                else None,
                "q3": float(valid.quantile(0.75))
                if is_numeric and len(valid)
                else None,
            }
        )
    preferred_groups = {
        "individual": "family",
        "population": "species",
        "community": "group",
        "traits": "life_form",
        "samples": "sex",
        "molecular": "quality_flag",
        "expression": "group",
        "function": "term_name",
        "variants": "chromosome",
        "sequence": "sequence_type",
    }
    preferred_metrics = {
        "individual": "altitude_m",
        "population": "density",
        "community": "shannon",
        "traits": "height_m",
        "molecular": "value",
        "expression": "value",
        "variants": "quality",
        "sequence": "length_aa"
        if df.get("length_aa", pd.Series(dtype=float)).replace("", np.nan).notna().any()
        else "length_bp",
    }
    metric = (
        query.get("metric") or preferred_metrics.get(kind) or next(iter(numeric), None)
    )
    group = (
        query.get("groupBy")
        or preferred_groups.get(kind)
        or next((c for c in df if c not in numeric), None)
    )
    if metric not in df:
        metric = next(iter(numeric), None)
    if group not in df:
        group = next((c for c in df if c not in numeric), None)
    if query.get("metric") and metric not in numeric and len(df):
        raise ValueError("所选指标不是可统计数值字段")
    categories = []
    if group:
        working = df.assign(
            _label=df[group].fillna("未填写").astype(str).replace("", "未填写")
        )
        if kind == "function" and "gene_id" in df:
            counts = (
                working.groupby("_label")["gene_id"]
                .nunique()
                .sort_values(ascending=False)
            )
        else:
            counts = working.groupby("_label").size().sort_values(ascending=False)
        means = (
            working.assign(_metric=numeric[metric]).groupby("_label")._metric.mean()
            if metric in numeric and query.get("metric")
            else None
        )
        for label, count in counts.head(30).items():
            value = means.get(label) if means is not None else count
            categories.append(
                {
                    "label": str(label),
                    "count": int(count),
                    "value": float(value) if pd.notna(value) else None,
                }
            )
    histogram = []
    mixed_variant_positions = (
        kind == "variants" and metric == "position" and df["chromosome"].nunique() > 1
    )
    if (
        metric in numeric
        and numeric[metric].notna().any()
        and not mixed_variant_positions
    ):
        counts, edges = np.histogram(numeric[metric].dropna(), bins=10)
        histogram = [
            {"start": float(edges[i]), "end": float(edges[i + 1]), "count": int(c)}
            for i, c in enumerate(counts)
        ]
    x, y = query.get("xField"), query.get("yField")
    paired = df.iloc[0:0]
    points, correlation = [], None
    if x in numeric and y in numeric and x != y:
        paired = pd.DataFrame({"x": numeric[x], "y": numeric[y]}).dropna()
        if len(paired) >= 3 and paired.x.nunique() > 1 and paired.y.nunique() > 1:
            correlation = float(paired.x.corr(paired.y))
        shown = (
            paired.iloc[
                np.linspace(0, len(paired) - 1, min(1000, len(paired)), dtype=int)
            ]
            if len(paired)
            else paired
        )
        points = [
            {"x": float(r.x), "y": float(r.y), "label": str(idx)}
            for idx, r in shown.iterrows()
        ]
    heatmap = []
    if kind == "expression" and {"gene_id", "sample_code", "value"} <= set(df):
        working = df.copy()
        working["value"] = pd.to_numeric(working.value, errors="coerce")
        genes = list(dict.fromkeys(working.gene_id))[:40]
        samples = list(dict.fromkeys(working.sample_code))[:24]
        heatmap = [
            {
                "x": str(r.sample_code),
                "y": str(r.gene_id),
                "value": float(np.log2(r.value + 1)) if pd.notna(r.value) else None,
            }
            for r in working[
                working.gene_id.isin(genes) & working.sample_code.isin(samples)
            ].itertuples()
        ]
    warnings = [
        "图表与导出共用当前筛选；分类展示前30组，其余见明细",
        "相关性使用全部有效配对，散点最多展示1000个等距点；不自动解释为因果",
    ]
    if kind == "expression":
        warnings.append(
            "热图最多40基因×24样品，颜色为log2(value+1)；不执行差异表达检验"
        )
    if kind == "function":
        warnings.append(
            "功能分类为去重基因数；同一基因可属于多类，合计不等于基因总数；不是富集分析"
        )
    if kind == "variants":
        warnings.append("展示已导入位点与质量；不从该长表推算群体多样性或GWAS")
        if mixed_variant_positions:
            warnings.append("位置分布需要先筛选单条染色体，当前不合并不同染色体坐标")
    if kind == "molecular":
        warnings.append("多标记数据请先按marker筛选；不同标记不宜混合解释")
    offset, limit = query.get("offset", 0), query.get("limit", 30)
    rows = json.loads(
        df.iloc[offset : offset + limit].to_json(orient="records", force_ascii=False)
    )
    return {
        "resourceId": resource.pk,
        "resourceName": resource.name,
        "kind": kind,
        "provenance": resource.default_visualization.get("provenance", "observed"),
        "unit": resource.default_visualization.get("unitOfAnalysis", "记录"),
        "measurementUnit": (
            str(df["unit"].dropna().iloc[0])
            if "unit" in df and df["unit"].nunique() == 1
            else "混合单位，请先筛选"
            if "unit" in df and df["unit"].nunique() > 1
            else ""
        ),
        "total": total,
        "filteredCount": len(df),
        "offset": offset,
        "rows": rows,
        "fields": profiles,
        "categories": categories,
        "histogram": histogram,
        "scatter": points,
        "pairedCount": len(paired),
        "correlation": correlation,
        "heatmap": heatmap,
        "visuals": build_visuals(df, kind, metric, group),
        "warnings": warnings,
        "query": {**query, "groupBy": group or "", "metric": metric or ""},
        "generatedAt": timezone.now().isoformat(),
        "scope": "filtered" if query.get("keyword") or query.get("filters") else "full",
    }


@require_POST
@api_login_required
def query_resource(request, id):
    resource, error = _authorized_resource(request, id)
    if error:
        return error
    try:
        query = body_json(request)
        df, total = load_filtered(resource, query)
        return JsonResponse(analysis_payload(resource, query, df, total))
    except (ValueError, NonGeoAnalysisError) as exc:
        return JsonResponse({"detail": str(exc)}, status=400)


def csv_safe(value):
    if isinstance(value, str) and value.lstrip().startswith(
        ("=", "+", "-", "@", "\t", "\r")
    ):
        return "'" + value
    return "" if pd.isna(value) else value


@require_POST
@api_login_required
def export_resource(request, id):
    resource, error = _authorized_resource(request, id)
    if error:
        return error
    if not has_feature_perm(request.user, "catalog.export_dataresource"):
        return feature_denied_response(request.user)
    try:
        df, _ = load_filtered(resource, body_json(request))
    except (ValueError, NonGeoAnalysisError) as exc:
        return JsonResponse({"detail": str(exc)}, status=400)
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow([csv_safe(c) for c in df.columns])
    writer.writerows(
        [csv_safe(v) for v in row] for row in df.itertuples(index=False, name=None)
    )
    response = HttpResponse(
        output.getvalue().encode("utf-8-sig"), content_type="text/csv; charset=utf-8"
    )
    response["Content-Disposition"] = (
        f'attachment; filename="analysis-{resource.pk}.csv"'
    )
    log_operation(
        request.user,
        "数据分析",
        "导出筛选结果",
        "success",
        f"{resource.code}: {len(df)}行",
        request,
        target_type="data_resource",
        target_id=resource.pk,
    )
    return response


def serialize_view(view):
    return {
        "id": view.pk,
        "name": view.name,
        "resourceId": view.resource_id,
        "query": view.query,
        "updatedAt": view.updated_at.isoformat(),
    }


@require_http_methods(["GET", "POST"])
@api_login_required
def saved_views(request):
    if not has_feature_perm(request.user, "core.query_data"):
        return feature_denied_response(request.user)
    if request.method == "GET":
        return JsonResponse(
            {
                "items": [
                    serialize_view(v)
                    for v in AnalysisView.objects.filter(owner=request.user)
                    .select_related("resource")
                    .order_by("-updated_at")[:100]
                    if v.resource.status == "active"
                    and user_can_access(v.resource, request.user)
                ]
            }
        )
    try:
        payload = body_json(request)
        resource, error = _authorized_resource(request, payload.get("resourceId"))
        if error:
            return error
        name = payload.get("name", "")
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 120:
            raise ValueError("视图名称为1–120字")
        query = payload.get("query", {})
        if not isinstance(query, dict):
            raise ValueError("query必须为对象")
        df, _, _ = _resource_dataframe(resource, limit=1, offset=0)
        parse_query(query, df.columns)
        view, _ = AnalysisView.objects.update_or_create(
            owner=request.user,
            name=name.strip(),
            defaults={"resource": resource, "query": query},
        )
        return JsonResponse(serialize_view(view), status=201)
    except (ValueError, TypeError, NonGeoAnalysisError) as exc:
        return JsonResponse({"detail": str(exc)}, status=400)
