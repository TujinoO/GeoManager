"""Bounded adapters for standard tabular and genotyped VCF data."""

import gzip
import io
import re

import pandas as pd

from apps.catalog.importer import ImportDataError, read_uploaded_table

MAX_TEXT = 64 * 1024 * 1024
MAX_ROWS = 200_000


def read_analysis_upload(uploaded, kind, assembly=""):
    name = uploaded.name.lower()
    if name.endswith((".csv", ".xlsx")):
        return read_uploaded_table(uploaded)
    if not name.endswith((".tsv", ".txt", ".vcf", ".vcf.gz")):
        raise ImportDataError("请选择CSV、TSV、XLSX或变异VCF文件")
    stream = gzip.GzipFile(fileobj=uploaded) if name.endswith(".gz") else uploaded
    try:
        raw = stream.read(MAX_TEXT + 1)
        if len(raw) > MAX_TEXT:
            raise ImportDataError("文本展开超过64MiB，请按数据集拆分")
        text = raw.decode("utf-8-sig")
    except (OSError, EOFError, UnicodeError) as exc:
        raise ImportDataError("文件不是有效的UTF-8文本或gzip文件") from exc
    if not name.endswith((".vcf", ".vcf.gz")):
        try:
            return pd.read_csv(
                io.StringIO(text),
                sep="\t",
                dtype=str,
                keep_default_na=False,
                nrows=MAX_ROWS + 1,
            )
        except (pd.errors.ParserError, pd.errors.EmptyDataError) as exc:
            raise ImportDataError("制表符表格结构无效，请检查列数") from exc
    if kind != "variants" or not assembly.strip():
        raise ImportDataError("VCF请选择遗传变异类型，并填写精确参考组装编号")
    header, rows = None, []
    for line_number, line in enumerate(text.splitlines(), 1):
        if line.startswith("##") or not line.strip():
            continue
        cells = line.split("\t")
        if line.startswith("#CHROM"):
            if header is not None or cells[:9] != [
                "#CHROM",
                "POS",
                "ID",
                "REF",
                "ALT",
                "QUAL",
                "FILTER",
                "INFO",
                "FORMAT",
            ]:
                raise ImportDataError("VCF表头重复或标准字段无效")
            header = cells
            if (
                len(cells) < 10
                or not all(s.strip() for s in cells[9:])
                or len(set(cells[9:])) != len(cells[9:])
            ):
                raise ImportDataError(
                    "VCF需要不重复的样品列及GT基因型；纯位点文件请先整理为变异长表"
                )
            continue
        if not header or len(cells) != len(header):
            raise ImportDataError(f"VCF第{line_number}行列数或表头无效")
        chrom, pos, _, ref, alt, qual, flag, _, fmt = cells[:9]
        if (
            not chrom.strip()
            or not pos.isdecimal()
            or int(pos) < 1
            or ref.upper() == alt.upper()
        ):
            raise ImportDataError(f"VCF第{line_number}行染色体、位置或等位基因无效")
        if not re.fullmatch("[ACGTNacgtn]+", ref) or not re.fullmatch(
            "[ACGTNacgtn]+", alt
        ):
            raise ImportDataError(
                f"VCF第{line_number}行为多等位或结构变异，请先规范为双等位记录"
            )
        keys = fmt.split(":")
        if "GT" not in keys:
            raise ImportDataError(f"VCF第{line_number}行缺少GT基因型")
        gt_index = keys.index("GT")
        for sample, call in zip(header[9:], cells[9:], strict=True):
            values = call.split(":")
            gt = values[gt_index] if gt_index < len(values) else "."
            if not re.fullmatch(r"[01.](?:[|/][01.])*", gt):
                raise ImportDataError(f"VCF第{line_number}行基因型与双等位记录不符")
            rows.append(
                [
                    assembly.strip(),
                    sample,
                    chrom,
                    pos,
                    ref.upper(),
                    alt.upper(),
                    gt,
                    "" if qual == "." else qual,
                    flag,
                ]
            )
            if len(rows) > MAX_ROWS:
                raise ImportDataError("VCF展开超过200000条样品记录，请拆分")
    if header is None:
        raise ImportDataError("VCF缺少#CHROM表头")
    return pd.DataFrame(
        rows,
        columns=[
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
    )
