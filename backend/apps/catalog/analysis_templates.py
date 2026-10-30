"""Versioned, executable import contracts and clearly synthetic demonstration data."""

from __future__ import annotations

import csv
import io
import math
import zipfile

from openpyxl import Workbook

from apps.catalog.ecology_contracts import ecology_templates, TRAITS_EXTRA


TEMPLATES = {
    "sequence": {
        "name": "基因序列统计",
        "domain": "genome",
        "unit": "序列记录",
        "columns": [
            "assembly",
            "record_id",
            "sequence_id",
            "sequence_type",
            "gene_id",
            "chromosome",
            "length_bp",
            "length_aa",
            "gc_fraction",
        ],
        "required": ["assembly", "record_id", "sequence_id", "sequence_type"],
        "numeric": ["length_bp", "length_aa", "gc_fraction"],
        "unique": ["assembly", "record_id"],
        "descriptions": {
            "sequence_id": "原始序列稳定编号",
            "sequence_type": "genome / gene / protein / rna / cds",
            "length_bp": "实际核酸长度 / bp；蛋白记录留空",
            "length_aa": "实际蛋白序列长度 / aa；核酸记录留空",
            "gc_fraction": "GC/(A+C+G+T)，0–1；蛋白和未计算记录留空",
        },
    },
    "traits": {
        "name": "生态与功能性状",
        "domain": "community",
        "unit": "观测记录",
        "columns": [
            "record_id",
            "plot_code",
            "species",
            "life_form",
            "region",
            "height_m",
            "leaf_water_fraction",
            "survey_date",
        ],
        "required": ["record_id", "species"],
        "numeric": ["height_m", "leaf_water_fraction"],
        "unique": ["record_id"],
        "descriptions": {
            "height_m": "植株高度 / m；非负",
            "leaf_water_fraction": "含水率 / 0–1；不再除以100",
            "record_id": "唯一观测编号",
            "plot_code": "样方稳定编号",
            "survey_date": "调查日期 YYYY-MM-DD",
        },
    },
    "samples": {
        "name": "生物样品与种质",
        "domain": "germplasm",
        "unit": "生物样品",
        "columns": [
            "sample_code",
            "species",
            "sex",
            "material_type",
            "region",
            "plot_code",
            "is_core",
            "longitude",
            "latitude",
        ],
        "required": ["sample_code"],
        "numeric": ["longitude", "latitude"],
        "unique": ["sample_code"],
        "descriptions": {
            "sex": "female / male / unknown；保留未确认值前先复核",
            "is_core": "true / false；未提供时留空；核心子集不另计新样品",
            "longitude": "WGS84经度 / 度",
            "latitude": "WGS84纬度 / 度",
        },
    },
    "molecular": {
        "name": "分子实验与测定",
        "domain": "molecular",
        "unit": "实验测定",
        "columns": [
            "result_id",
            "sample_code",
            "assay_code",
            "marker",
            "value",
            "unit",
            "batch",
            "quality_flag",
        ],
        "required": ["result_id", "sample_code", "marker", "unit"],
        "numeric": ["value"],
        "unique": ["result_id"],
        "descriptions": {
            "value": "同单位内比较；不混合不同标记/单位",
            "sample_code": "对应生物样品编号",
            "quality_flag": "pass / review / failed",
        },
    },
    "expression": {
        "name": "基因表达长表",
        "domain": "genome",
        "unit": "基因×样本",
        "columns": [
            "assembly",
            "gene_id",
            "sample_code",
            "group",
            "replicate",
            "value",
            "unit",
        ],
        "required": [
            "assembly",
            "gene_id",
            "sample_code",
            "group",
            "replicate",
            "unit",
        ],
        "numeric": ["value"],
        "unique": ["assembly", "gene_id", "sample_code"],
        "descriptions": {
            "assembly": "精确组装编号；跨组装基因不可直接合并",
            "value": "非负表达值；RNA FASTA不是表达矩阵",
            "unit": "TPM / FPKM / count；一个资源仅一种单位",
            "replicate": "生物重复编号",
        },
    },
    "function": {
        "name": "基因功能注释",
        "domain": "genome",
        "unit": "基因×功能条目",
        "columns": [
            "assembly",
            "gene_id",
            "database",
            "database_version",
            "term_id",
            "term_name",
            "evidence",
        ],
        "required": [
            "assembly",
            "gene_id",
            "database",
            "database_version",
            "term_id",
            "evidence",
        ],
        "numeric": [],
        "unique": ["assembly", "gene_id", "database", "term_id"],
        "descriptions": {
            "database": "GO / KEGG / InterPro 或其他明确来源",
            "evidence": "实验或计算证据代码；不可把结构注释当功能注释",
            "term_id": "原始功能条目编号",
        },
    },
    "variants": {
        "name": "变异位点长表",
        "domain": "genome",
        "unit": "样品×变异位点",
        "columns": [
            "assembly",
            "sample_code",
            "chromosome",
            "position",
            "ref",
            "alt",
            "genotype",
            "quality",
            "filter",
        ],
        "required": ["assembly", "sample_code", "chromosome", "position", "ref", "alt"],
        "numeric": ["position", "quality"],
        "unique": ["assembly", "sample_code", "chromosome", "position", "ref", "alt"],
        "descriptions": {
            "position": "1-based 碱基位置，正整数",
            "genotype": "原始基因型，如0/1；缺失保留./.",
            "quality": "原始质量值，缺失允许",
            "filter": "原始过滤状态；演示不构成真实变异证据",
        },
    },
}


COMMON_DESCRIPTIONS = {
    "record_id": "唯一观测编号；按文本保留，不重复使用",
    "result_id": "唯一测定记录编号；不同测定分别登记",
    "sample_code": "稳定样品编号；同一样品跨表使用同一编号，不以行号代替",
    "species": "物种名称；同一数据集内统一中文名或学名写法",
    "life_form": "生活型，例如乔木、灌木、草本；未知可留空",
    "region": "采集或调查区域名称；统一写法以便分类汇总",
    "plot_code": "样方稳定编号；不同日期的同一样方保持一致",
    "material_type": "采样材料，例如叶片、种子、枝条、DNA；不是样品数量",
    "assay_code": "实验或测定编号；保留原始实验记录中的编号",
    "marker": "测定标记或指标，例如DNA_concentration；不同标记分开比较",
    "batch": "实验批次编号；用于检查批次分布，不自动校正批次效应",
    "gene_id": "原始基因编号；必须和assembly指定的参考版本一致",
    "group": "样本分组名称，例如control、stress；不自动构成差异表达检验",
    "assembly": "精确组装版本或登录号；一个资源只使用一套参考组装",
    "database_version": "功能注释数据库版本或发布日期；不可省略版本含义",
    "term_name": "功能条目名称；term_id为原始稳定编号，不自行编造真实条目",
    "evidence": "原始注释的证据代码或来源；合成示例使用SYNTHETIC",
    "chromosome": "当前组装内染色体/序列编号；不可直接混用FG与MG坐标",
    "ref": "参考等位基因；ACGTN序列、星号或明确符号等位基因",
    "alt": "替代等位基因；多等位记录应先规范拆分，不能把逗号串当单个等位基因",
}
for _spec in TEMPLATES.values():
    _spec["descriptions"] = {
        **{
            column: COMMON_DESCRIPTIONS[column]
            for column in _spec["columns"]
            if column in COMMON_DESCRIPTIONS
        },
        **_spec["descriptions"],
    }


TEMPLATES.update(ecology_templates())
TEMPLATES["traits"]["name"] = "生态观测—物种功能性状"
TEMPLATES["samples"]["name"] = "种质数据"
TEMPLATES["molecular"]["name"] = "分子数据"
TEMPLATES["traits"]["descriptions"].update(dict(TRAITS_EXTRA))
TEMPLATES["traits"]["columns"] += [
    f for f, _ in TRAITS_EXTRA if f not in TEMPLATES["traits"]["columns"]
]
TEMPLATES["samples"]["columns"].append("altitude_m")
TEMPLATES["samples"]["numeric"].append("altitude_m")
TEMPLATES["samples"]["descriptions"]["altitude_m"] = "海拔（m）；可选"
TEMPLATES["molecular"]["columns"] += ["treatment", "replicate", "time_h", "method"]
TEMPLATES["molecular"]["numeric"].append("time_h")
TEMPLATES["molecular"]["descriptions"].update(
    {
        "treatment": "实验处理名称",
        "replicate": "生物重复编号",
        "time_h": "处理时间（h）",
        "method": "实验测定方法",
    }
)
TEMPLATES["traits"]["numeric"] += [
    f
    for f, _ in TRAITS_EXTRA
    if f
    not in {
        "locality",
        "site_number",
        "family",
        "genus",
        "family_latin",
        "genus_latin",
        "scientific_name",
    }
]


def template_catalog():
    return {
        "version": "1.0",
        "items": [
            {
                "kind": k,
                "name": v["name"],
                "unit": v["unit"],
                "columns": [
                    {
                        "name": c,
                        "required": c in v["required"],
                        "numeric": c in v["numeric"],
                        "description": v["descriptions"].get(c, c),
                    }
                    for c in v["columns"]
                ],
                "uniqueKey": v["unique"],
                "formats": ["csv", "tsv", "xls", "xlsx"]
                + (["vcf", "vcf.gz"] if k == "variants" else []),
            }
            for k, v in TEMPLATES.items()
        ]
        + [
            {
                "kind": "genome",
                "name": "基因组配套文件",
                "unit": "参考组装",
                "columns": [],
                "uniqueKey": ["assembly"],
                "formats": ["zip"],
            }
        ],
    }


def example_rows(kind):
    rows = []
    for i in range(1, 49):
        sample = f"DEMO-S{i:03}"
        if kind in {"individual", "population", "community"}:
            record = {c: "" for c in TEMPLATES[kind]["columns"]}
            record.update(
                {
                    "record_id": f"DEMO-R{i:03}",
                    "collection_code": sample,
                    "species": ["胡杨", "柽柳", "芦苇"][i % 3],
                    "plot_code": f"DEMO-P{i:03}",
                    "group": ["A", "B"][i % 2],
                    "family": "杨柳科",
                    "genus": "杨属",
                    "region": "塔里木",
                    "density": round(0.2 + i / 100, 3),
                    "shannon": round(0.5 + i / 40, 3),
                    "soil_ph": round(7 + i / 100, 3),
                    "altitude_m": 1000 + i,
                }
            )
            rows.append([record[c] for c in TEMPLATES[kind]["columns"]])
        elif kind == "sequence":
            rows.append(
                [
                    "DEMO-FG",
                    f"DEMO-Q{i}",
                    f"DEMO-Q{i}",
                    "protein",
                    "",
                    "",
                    "",
                    100 + i,
                    "",
                ]
            )
        elif kind == "traits":
            rows.append(
                [
                    f"DEMO-T{i:03}",
                    f"DEMO-P{(i - 1) // 4 + 1:02}",
                    ["胡杨", "柽柳", "芦苇"][i % 3],
                    ["乔木", "灌木", "草本"][i % 3],
                    ["塔里木", "额济纳", "伊犁"][i % 3],
                    round(1 + i % 15 + math.sin(i), 3),
                    round(0.45 + (i % 20) / 100, 3),
                    "2026-05-10",
                ]
            )
        elif kind == "samples":
            rows.append(
                [
                    sample,
                    "胡杨",
                    ["female", "male", "unknown"][i % 3],
                    ["叶片", "种子", "枝条"][i % 3],
                    ["塔里木", "额济纳", "伊犁"][(i // 3) % 3],
                    f"DEMO-P{(i - 1) // 4 + 1:02}",
                    "true" if i % 4 == 0 else "false",
                    round(80 + i / 100, 4),
                    round(40 + i / 100, 4),
                ]
            )
        elif kind == "molecular":
            rows.append(
                [
                    f"DEMO-R{i:03}",
                    sample,
                    f"DEMO-A{i:03}",
                    "DNA_concentration",
                    round(20 + i * 1.3, 2),
                    "ng/µL",
                    f"B{(i - 1) // 12 + 1}",
                    "pass" if i % 7 else "review",
                ]
            )
        elif kind == "expression":
            for j in range(1, 7):
                rows.append(
                    [
                        "DEMO-FG",
                        f"DEMO-G{i:03}",
                        f"DEMO-E{j}",
                        "control" if j < 4 else "stress",
                        (j - 1) % 3 + 1,
                        0
                        if (i + j) % 11 == 0
                        else round(
                            (i % 10 + 1)
                            * (j + 1)
                            * (1.8 if i % 3 == 0 and j > 3 else 1)
                            + math.sin(i + j),
                            3,
                        ),
                        "TPM",
                    ]
                )
        elif kind == "function":
            rows.append(
                [
                    "DEMO-FG",
                    f"DEMO-G{i:03}",
                    "DEMO_DB",
                    "synthetic-1",
                    f"DEMO:TERM{i % 5}",
                    ["模拟胁迫响应", "模拟代谢", "模拟转运", "模拟发育", "模拟信号"][
                        i % 5
                    ],
                    "SYNTHETIC",
                ]
            )
            if i % 3 != 0:
                term = (i + 1) % 5
                rows.append(
                    [
                        "DEMO-FG",
                        f"DEMO-G{i:03}",
                        "DEMO_DB",
                        "synthetic-2",
                        f"DEMO:TERM{term}",
                        [
                            "模拟胁迫响应",
                            "模拟代谢",
                            "模拟转运",
                            "模拟发育",
                            "模拟信号",
                        ][term],
                        "SYNTHETIC",
                    ]
                )
        elif kind == "variants":
            rows.append(
                [
                    "DEMO-FG",
                    sample,
                    f"chr{i % 3 + 1:02}",
                    100 + i * 131,
                    "A",
                    "G" if i % 2 else "AT",
                    "0/1",
                    30 + i % 30,
                    "PASS" if i % 5 else "LowQual",
                ]
            )
    return [row + [""] * (len(TEMPLATES[kind]["columns"]) - len(row)) for row in rows]


def template_bytes(kind, *, example=False, file_format="csv"):
    if kind == "genome":
        return genome_example(), "application/zip", "genome_synthetic_example.zip"
    spec = TEMPLATES[kind]
    rows = example_rows(kind) if example else []
    if file_format == "xlsx":
        workbook = Workbook()
        data = workbook.active
        data.title = "data"
        data.append(spec["columns"])
        for row in rows:
            data.append(row)
        data.freeze_panes = "A2"
        dictionary = workbook.create_sheet("字段说明")
        dictionary.append(["字段", "必填", "类型", "说明"])
        for c in spec["columns"]:
            dictionary.append(
                [
                    c,
                    "是" if c in spec["required"] else "否",
                    "数值" if c in spec["numeric"] else "文本",
                    spec["descriptions"].get(c, c),
                ]
            )
        dictionary.append(
            [
                "来源",
                "",
                "",
                "本文件示例为合成数据，仅用于功能演示"
                if example
                else "请保留原始数据与来源；空值留空",
            ]
        )
        for sheet in workbook:
            for column in sheet.columns:
                sheet.column_dimensions[column[0].column_letter].width = min(
                    65, max(18, max(len(str(c.value or "")) for c in column) + 2)
                )
        output = io.BytesIO()
        workbook.save(output)
        return (
            output.getvalue(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            f"{kind}_{'example' if example else 'template'}.xlsx",
        )
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(spec["columns"])
    writer.writerows(rows)
    return (
        output.getvalue().encode("utf-8-sig"),
        "text/csv; charset=utf-8",
        f"{kind}_{'example' if example else 'template'}.csv",
    )


def genome_example():
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        genome, gff, protein, rna, cds = [], ["##gff-version 3"], [], [], []
        for i in range(1, 4):
            seqid = f"DEMO-CHR{i:02}"
            sequence = ("ATG" + "GCT" * 99 + "TAA" + "ACGT" * 49 + "A") * 40
            genome.append(f">{seqid}\tOriSeqID=chr{i:02}\n{sequence}\n")
            for j in range(1, 21):
                start = (j - 1) * 500 + 1
                gene, tx, prot = (
                    f"DEMO-G{i:02}{j:03}",
                    f"DEMO-T{i:02}{j:03}",
                    f"DEMO-P{i:02}{j:03}",
                )
                strand = "+"
                for kind, a, b, attr, phase in [
                    ("gene", start, start + 302, f"ID={gene};Accession={gene}", "."),
                    (
                        "mRNA",
                        start,
                        start + 302,
                        f"ID={tx};Parent={gene};Accession={tx}",
                        ".",
                    ),
                    ("exon", start, start + 302, f"Parent={tx}", "."),
                    (
                        "CDS",
                        start,
                        start + 302,
                        f"Parent={tx};Protein_Accession={prot}",
                        "0",
                    ),
                ]:
                    gff.append(
                        f"{seqid}\tdemo\t{kind}\t{a}\t{b}\t.\t{strand}\t{phase}\t{attr}"
                    )
                sequence_part = sequence[start - 1 : start + 302]
                # Translate the exact synthetic CDS, including stop symbols.
                codons = {
                    "ATG": "M",
                    "GCT": "A",
                    "TAA": "*",
                    "ACG": "T",
                    "TAC": "Y",
                    "GTA": "V",
                    "CGT": "R",
                    "AAA": "K",
                    "AAT": "N",
                    "TGA": "*",
                    "TGC": "C",
                    "TTA": "L",
                    "GCA": "A",
                    "GCG": "A",
                    "CTA": "L",
                    "TAG": "*",
                    "AGC": "S",
                    "CTG": "L",
                }
                aa = "".join(
                    codons.get(sequence_part[k : k + 3], "X")
                    for k in range(0, len(sequence_part), 3)
                )
                header = f"Gene={gene}\tmRNA={tx}\tOriID={tx}"
                protein.append(f">{prot}\t{header}\n{aa}\n")
                rna.append(f">{tx}\tGene={gene}\n{sequence_part}\n")
                cds.append(f">{tx}\tGene={gene}\n{sequence_part}\n")
        for name, content in [
            ("genome.fasta", "".join(genome)),
            ("annotation.gff3", "\n".join(gff) + "\n"),
            ("protein.faa", "".join(protein)),
            ("rna.fasta", "".join(rna)),
            ("cds.fasta", "".join(cds)),
        ]:
            archive.writestr(name, content)
        archive.writestr(
            "README.txt",
            "合成基因组演示文件；非真实胡杨基因组，不用于生物学推断。\n解压后在平台基因组导入表单选择对应角色的5个文件。\n坐标1-based closed。大文件用管理命令 import_analysis_genome。\n",
        )
    return out.getvalue()
