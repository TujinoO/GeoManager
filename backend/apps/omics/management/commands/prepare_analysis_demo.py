import json
from pathlib import Path

import pandas as pd
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.catalog.analysis import import_table
from apps.catalog.analysis_templates import (
    TEMPLATES,
    example_rows,
    template_bytes,
    template_catalog,
)
from apps.catalog.models import DataResource
from apps.omics.genome_index import build_index
from apps.omics.models import GenomeAssembly


class Command(BaseCommand):
    help = "生成全部空模板和合成示例，增量登记演示表；可选接入已下载的官方FG/MG"

    def add_arguments(self, parser):
        parser.add_argument("--owner", required=True)
        parser.add_argument("--output", required=True)
        parser.add_argument("--genome-directory")
        parser.add_argument(
            "--demo-version",
            choices=["1", "2"],
            default="2",
            help="v2补充可视化演示；保留已存在的v1资源",
        )

    def handle(self, *args, **options):
        user = (
            get_user_model()
            .objects.filter(username=options["owner"], is_active=True)
            .first()
        )
        if not user:
            raise CommandError("指定owner不存在")
        out = Path(options["output"]).resolve()
        out.mkdir(parents=True, exist_ok=True)
        records = []
        for kind, spec in TEMPLATES.items():
            for example in [False, True]:
                for fmt in ["csv", "xlsx"]:
                    raw, _, filename = template_bytes(
                        kind, example=example, file_format=fmt
                    )
                    target = out / filename
                    if target.exists() and target.read_bytes() != raw:
                        # XLSX carries ZIP timestamps; retain each user's existing version.
                        self.stdout.write(f"保留已有模板：{filename}")
                    elif not target.exists():
                        target.write_bytes(raw)
            marker = f"analysis-demo-{kind}-v{options['demo_version']}"
            resource = DataResource.objects.filter(code=marker).first()
            if not resource:
                df = pd.DataFrame(example_rows(kind), columns=spec["columns"]).astype(
                    str
                )
                resource = import_table(
                    df,
                    kind,
                    "[合成演示] "
                    + spec["name"]
                    + (" · 丰富示例" if options["demo_version"] == "2" else ""),
                    "synthetic",
                    user,
                )
                resource.code = marker
                resource.save(update_fields=["code"])
            records.append(
                {
                    "kind": kind,
                    "resourceId": resource.pk,
                    "provenance": "synthetic",
                    "rows": resource.item_count,
                }
            )
        raw, _, filename = template_bytes("genome", example=True, file_format="zip")
        if not (out / filename).exists():
            (out / filename).write_bytes(raw)
        catalog = out / "field-dictionary.json"
        if not catalog.exists():
            catalog.write_text(
                json.dumps(template_catalog(), ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        if options.get("genome_directory"):
            folder = Path(options["genome_directory"]).resolve()
            for sex, code, accession in [
                ("female", "FG", "GWHBHNV00000000"),
                ("male", "MG", "GWHBHOO00000000"),
            ]:
                if GenomeAssembly.objects.filter(assembly_code=accession).exists():
                    self.stdout.write(f"保留已接入组装 {accession}")
                    continue
                suffix = {
                    "genome": "genome.fasta.gz",
                    "gff": "gff.gz",
                    "protein": "Protein.faa.gz",
                    "rna": "RNA.fasta.gz",
                    "cds": "CDS.fasta.gz",
                }
                files = {r: folder / f"{accession}.{s}" for r, s in suffix.items()}
                if not all(p.is_file() for p in files.values()):
                    raise CommandError(f"{code}五类官方文件不完整")
                self.stdout.write(f"开始流式索引 {code}，原件与已有资料保留")
                index = build_index(
                    files=files,
                    code=accession,
                    name=f"胡杨{code} {'雌' if sex == 'female' else '雄'}株参考基因组",
                    user=user,
                    provenance="observed",
                    sex=sex,
                    source_url=f"https://ngdc.cncb.ac.cn/gwh/Assembly/{24416 if sex == 'female' else 24435}/show",
                )
                self.stdout.write(
                    f"完成 {code}: {index.summary['geneCount']} genes; assemblyId={index.assembly_id}"
                )
        manifest = out / "demo-resources.json"
        manifest.write_text(
            json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        self.stdout.write(self.style.SUCCESS(f"模板目录 {out}；六类演示表已就绪"))
