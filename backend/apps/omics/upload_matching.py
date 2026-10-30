"""Match original genome download names without guessing nucleotide sequence roles."""

import re

from apps.omics.genome_index import GenomeError

ROLE_LABELS = {
    "genome": "基因组序列",
    "gff": "基因结构注释",
    "protein": "蛋白序列",
    "rna": "转录本序列",
    "cds": "编码序列",
}


def match_genome_uploads(uploads):
    if not 2 <= len(uploads) <= 5:
        raise GenomeError("请选择同一组装的2至5个文件，至少包含基因组序列与GFF注释")
    matched, assemblies = {}, set()
    for file in uploads:
        name = file.name.lower().removesuffix(".gz")
        tokens = set(re.split(r"[._\s-]+", name))
        roles = set()
        if name.endswith((".gff", ".gff3")):
            roles.add("gff")
        if "genome" in tokens or name.endswith(".fna"):
            roles.add("genome")
        if tokens & {"protein", "pep", "peptide"} or name.endswith(".faa"):
            roles.add("protein")
        if tokens & {"rna", "mrna", "transcript", "transcripts", "cdna"}:
            roles.add("rna")
        if "cds" in tokens:
            roles.add("cds")
        if len(roles) != 1:
            raise GenomeError(
                f"无法明确识别“{file.name}”的用途，请保留下载时含genome、GFF、Protein、RNA或CDS的原始文件名后重新选择"
            )
        role = roles.pop()
        if role in matched:
            raise GenomeError(
                f"{ROLE_LABELS[role]}重复：{matched[role].name}、{file.name}；每次只导入一个组装"
            )
        if role != "gff" and not name.endswith((".fa", ".fasta", ".fna", ".faa")):
            raise GenomeError(f"{file.name}需为FASTA格式或其gzip文件")
        matched[role] = file
        accession = re.match(r"(gwh[a-z0-9]+)[._-]", name)
        if accession:
            assemblies.add(accession[1])
    if len(assemblies) > 1:
        raise GenomeError("选择的文件来自不同GWH组装，请分别导入雌株FG和雄株MG配套文件")
    missing = {"genome", "gff"} - matched.keys()
    if missing:
        raise GenomeError("缺少" + "、".join(ROLE_LABELS[r] for r in sorted(missing)))
    return matched
