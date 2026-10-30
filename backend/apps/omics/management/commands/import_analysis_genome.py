from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.audit.service import log_operation
from apps.omics.genome_index import GenomeError, build_index


class Command(BaseCommand):
    help = "流式接入FASTA/GFF及配套序列；路径仅限本机管理员命令，不暴露到网页API"

    def add_arguments(self, parser):
        for role in ["genome", "gff", "protein", "rna", "cds"]:
            parser.add_argument("--" + role, required=role in {"genome", "gff"})
        parser.add_argument("--code", required=True)
        parser.add_argument("--name", required=True)
        parser.add_argument("--owner", required=True)
        parser.add_argument(
            "--provenance", choices=["observed", "synthetic"], required=True
        )
        parser.add_argument(
            "--sex", choices=["female", "male", "unknown"], default="unknown"
        )
        parser.add_argument("--source-url", default="")

    def handle(self, *args, **options):
        user = (
            get_user_model()
            .objects.filter(username=options["owner"], is_active=True)
            .first()
        )
        if not user:
            raise CommandError("owner账号不存在或已停用")
        files = {
            r: Path(options[r]).resolve()
            for r in ["genome", "gff", "protein", "rna", "cds"]
            if options.get(r)
        }
        if not all(p.is_file() for p in files.values()):
            raise CommandError("源文件不存在")
        try:
            index = build_index(
                files=files,
                code=options["code"],
                name=options["name"],
                user=user,
                provenance=options["provenance"],
                sex=options["sex"],
                source_url=options["source_url"],
            )
        except GenomeError as exc:
            raise CommandError(str(exc)) from exc
        log_operation(
            user,
            "数据分析",
            "管理命令接入基因组",
            "success",
            options["code"],
            target_type="data_resource",
            target_id=index.assembly.data_resource_id,
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"ready: assembly={index.assembly_id}; genes={index.summary['geneCount']}; bp={index.summary['totalBp']}"
            )
        )
