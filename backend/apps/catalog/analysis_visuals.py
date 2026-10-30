"""Bounded, data-specific views computed from all filtered records, never a page."""

from itertools import combinations

import numpy as np
import pandas as pd


def text_column(df, column):
    return df[column].fillna("未填写").astype(str).str.strip().replace("", "未填写")


def numeric_column(df, column):
    return pd.to_numeric(df[column], errors="coerce").replace([np.inf, -np.inf], np.nan)


def build_visuals(df, kind, metric, group):
    out = {
        key: []
        for key in [
            "metrics",
            "boxes",
            "matrices",
            "dots",
            "flows",
            "nodes",
            "edges",
            "variantBins",
            "variantClasses",
            "notes",
        ]
    }
    if df.empty:
        return out

    def summary(label, value, note):
        out["metrics"].append({"label": label, "value": str(value), "note": note})

    def distinct(field):
        return (
            int(
                df[field].dropna().astype(str).str.strip().replace("", np.nan).nunique()
            )
            if field in df
            else 0
        )

    # Values from different assays must not be silently pooled into one distribution.
    mixed_assays = kind == "molecular" and distinct("marker") > 1
    if kind in {"traits", "molecular", "variants", "sequence"} and metric in df:
        box_group = (
            "batch"
            if kind == "molecular"
            else "chromosome"
            if kind == "variants"
            else group
        )
        if (
            box_group in df
            and not mixed_assays
            and not (kind == "variants" and metric == "position")
        ):
            work = pd.DataFrame(
                {"label": text_column(df, box_group), "v": numeric_column(df, metric)}
            ).dropna()
            for label in work.label.value_counts().head(18).index:
                values = work.loc[work.label.eq(label), "v"]
                q = values.quantile([0, 0.25, 0.5, 0.75, 1]).tolist()
                out["boxes"].append(
                    {
                        "label": str(label),
                        "field": metric,
                        "n": len(values),
                        **dict(
                            zip(
                                ["min", "q1", "median", "q3", "max"],
                                map(float, q),
                                strict=True,
                            )
                        ),
                    }
                )
            out["notes"].append(
                "五数分布使用全部有效值；箱体为Q1–Q3，中线为中位数，须端为最小/最大值（非1.5IQR）；最多18组。"
            )

    if kind == "sequence":
        summary("序列记录", len(df), "当前筛选的序列条目")
        summary("序列类型", distinct("sequence_type"), "核酸与蛋白长度分别统计")
        summary("参考组装", distinct("assembly"), "按组装版本关联")
        summary("关联基因", distinct("gene_id"), "仅统计已提供的编号")
    if kind == "traits" and {"plot_code", "species"} <= set(df):
        summary("调查样方", distinct("plot_code"), "按样方编号去重")
        summary("记录物种", distinct("species"), "按物种名称去重")
        summary("生活型", distinct("life_form"), "当前筛选记录中的类型")
        summary("有效观测", len(df), "以记录计数，非物种丰度推断")
        x, y = text_column(df, "plot_code"), text_column(df, "species")
        xs, ys = x.value_counts().head(24).index, y.value_counts().head(24).index
        counts = pd.crosstab(y, x)
        cells = [
            {
                "x": str(a),
                "y": str(b),
                "value": int(counts.at[b, a])
                if a in counts and b in counts.index
                else 0,
                "n": int(counts.at[b, a]) if a in counts and b in counts.index else 0,
            }
            for a in xs
            for b in ys
        ]
        out["matrices"].append(
            {
                "id": "community",
                "title": "样方与物种观测矩阵",
                "method": "颜色为观测记录数，空组合记0；最多24样方×24物种，不当作盖度或个体丰度。",
                "cells": cells,
            }
        )

    if kind == "samples" and {"region", "sex", "material_type", "is_core"} <= set(df):
        core = df.is_core.astype(str).str.lower().eq("true").sum()
        summary("登记样品", len(df), "一条记录对应一个样品")
        summary("核心子集", int(core), "已包含于登记样品，不能重复相加")
        summary("样品来源", distinct("region"), "按区域名称去重")
        summary("材料类型", distinct("material_type"), "当前筛选样品中的类型")
        stages = []
        for column, prefix in [
            ("region", "来源"),
            ("sex", "性别"),
            ("material_type", "材料"),
        ]:
            s = text_column(df, column)
            if column == "sex":
                s = s.replace({"female": "雌株", "male": "雄株", "unknown": "未确认"})
            top = s.value_counts().head(10).index
            stages.append(prefix + " · " + s.where(s.isin(top), "其他"))
        for a, b in zip(stages, stages[1:]):
            counts = pd.DataFrame({"a": a, "b": b}).groupby(["a", "b"]).size()
            out["flows"].extend(
                {"source": str(a), "target": str(b), "value": int(n)}
                for (a, b), n in counts.items()
            )
        out["notes"].append(
            "流向图展示来源→性别→材料的分类归属，不是迁移路径；每阶段均覆盖全部筛选样品，单阶段前10类之外合并为其他。"
        )

    if kind == "molecular" and {"marker", "batch", "quality_flag", "value"} <= set(df):
        summary("测定记录", len(df), "不是独立生物个体数")
        summary("测定标记", distinct("marker"), "不同标记须分别比较")
        summary("实验批次", distinct("batch"), "按原始批次编号去重")
        summary(
            "通过质控", int(df.quality_flag.eq("pass").sum()), "仅quality_flag=pass"
        )
        if mixed_assays:
            out["notes"].append(
                "当前包含多个测定标记，批次分布暂停显示；请添加marker筛选后比较。"
            )

    if kind == "expression" and {"gene_id", "sample_code", "group", "value"} <= set(df):
        summary("表达基因", distinct("gene_id"), "导入矩阵中的基因数")
        summary("生物样本", distinct("sample_code"), "按样本编号去重")
        summary("样本组", distinct("group"), "使用提供的分组标签")
        summary(
            "有效表达",
            int(numeric_column(df, "value").notna().sum()),
            "缺失不补零；不执行差异检验",
        )
        work = df.assign(value=numeric_column(df, "value"))
        genes = work.gene_id.drop_duplicates().head(24)
        groups = work["group"].drop_duplicates().head(12)
        dots = (
            work[work.gene_id.isin(genes) & work["group"].isin(groups)]
            .groupby(["gene_id", "group"], sort=False)
            .value
        )
        for (gene, group_name), values in dots:
            values = values.dropna()
            if len(values):
                out["dots"].append(
                    {
                        "x": str(group_name),
                        "y": str(gene),
                        "value": float(np.log2(values.mean() + 1)),
                        "fraction": float(values.gt(0).mean()),
                        "n": len(values),
                    }
                )
        # Correlation uses every filtered gene, with a bounded number of sample columns.
        samples = list(work.sample_code.drop_duplicates().head(24))
        matrix = (
            work[work.sample_code.isin(samples)]
            .pivot(index="gene_id", columns="sample_code", values="value")
            .reindex(columns=samples)
        )
        matrix = np.log2(matrix + 1)
        corr = matrix.corr(min_periods=3)
        valid = matrix.notna().astype(np.int64)
        pairs = valid.T @ valid
        out["matrices"].append(
            {
                "id": "sampleCorrelation",
                "title": "样本表达相关矩阵",
                "method": "全部筛选基因的log2(value+1) Pearson r；每格标注有效配对数，少于3对或常数列留空；最多24样本。",
                "cells": [
                    {
                        "x": str(a),
                        "y": str(b),
                        "value": float(corr.at[a, b])
                        if pd.notna(corr.at[a, b])
                        else None,
                        "n": int(pairs.at[a, b]),
                    }
                    for a in samples
                    for b in samples
                ],
            }
        )
        out["notes"].append(
            "表达气泡：颜色为log2(组内有效表达均值+1)，面积对应严格正值比例，最小空心点表示0%；最多24基因×12组，不代表显著性。"
        )

    if kind == "function" and {"gene_id", "database", "term_id", "term_name"} <= set(
        df
    ):
        summary("已注释基因", distinct("gene_id"), "同一基因多条注释仅计一次")
        summary(
            "功能条目",
            len(df[["database", "term_id"]].drop_duplicates()),
            "数据库与条目编号联合去重",
        )
        summary("注释数据库", distinct("database"), "须保留版本与证据来源")
        summary("注释归属", len(df), "各功能类别可有重叠")
        work = df.assign(
            key=text_column(df, "database") + ":" + text_column(df, "term_id")
        )
        top = (
            work.groupby("key")
            .gene_id.nunique()
            .sort_values(ascending=False)
            .head(20)
            .index
        )
        gene_sets = {}
        for key in top:
            rows = work[work.key.eq(key)]
            genes = set(rows.gene_id.dropna())
            gene_sets[key] = genes
            out["nodes"].append(
                {
                    "id": str(key),
                    "label": str(rows.term_name.iloc[0] or rows.term_id.iloc[0]),
                    "value": len(genes),
                    "category": str(rows.database.iloc[0]),
                }
            )
        for a, b in combinations(top, 2):
            shared = len(gene_sets[a] & gene_sets[b])
            if shared:
                out["edges"].append(
                    {
                        "source": str(a),
                        "target": str(b),
                        "value": shared,
                        "score": shared / len(gene_sets[a] | gene_sets[b]),
                    }
                )
        out["notes"].append(
            "关系图显示前20个功能条目；节点大小为去重基因数，连线为共同基因数，悬停显示Jaccard。属于共注释关系，不是蛋白互作或功能富集。"
        )

    if kind == "variants" and {"chromosome", "position", "ref", "alt"} <= set(df):
        summary("变异记录", len(df), "同位点不同样品分别计数")
        summary(
            "独立位点",
            len(df[["chromosome", "position", "ref", "alt"]].drop_duplicates()),
            "当前组装内坐标与等位基因联合去重",
        )
        summary("染色体", distinct("chromosome"), "当前导入覆盖范围")
        summary("关联样品", distinct("sample_code"), "不据此推断群体规模")
        classes = []
        for ref, alt in zip(
            df.ref.astype(str).str.upper(), df.alt.astype(str).str.upper()
        ):
            if (
                len(ref) == len(alt) == 1
                and ref in "ACGT"
                and alt in "ACGT"
                and ref != alt
            ):
                name = ref + "→" + alt
            elif set(ref + alt) <= set("ACGT") and len(ref) != len(alt):
                name = "插入" if len(alt) > len(ref) else "缺失"
            else:
                name = "其他/复杂"
            classes.append(name)
        out["variantClasses"] = [
            {"label": str(k), "count": int(v), "value": int(v)}
            for k, v in pd.Series(classes).value_counts().items()
        ]
        for chromosome in text_column(df, "chromosome").value_counts().head(24).index:
            values = (
                numeric_column(
                    df.loc[text_column(df, "chromosome").eq(chromosome)], "position"
                )
                .dropna()
                .astype(np.int64)
            )
            if not len(values):
                continue
            maximum = int(values.max())
            width = max(1, (maximum + 29) // 30)
            buckets = ((values - 1) // width).value_counts().to_dict()
            for start in range(1, maximum + 1, width):
                out["variantBins"].append(
                    {
                        "chromosome": str(chromosome),
                        "start": start,
                        "end": min(maximum, start + width - 1),
                        "count": int(buckets.get((start - 1) // width, 0)),
                    }
                )
        out["notes"].append(
            "位置图按染色体独立分箱，端点为最大导入坐标，不是染色体长度。气泡面积为记录数；各样品相同变异分别计数，不是GWAS或突变率。最多24条染色体，每条最多30箱。"
        )

    return out
