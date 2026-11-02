"""Install curated examples explicitly, preserving all existing editorial work."""

import hashlib
import json
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date

from apps.audit.service import log_operation
from apps.content.models import Article
from apps.content.views import store_asset
from apps.core.permissions import has_feature_perm


class Command(BaseCommand):
    help = "导入胡杨科普和团队新闻样例，按 seed_key 去重，已有内容全部保留。"

    def add_arguments(self, parser):
        parser.add_argument("--owner", required=True, help="现有内容管理员用户名")
        parser.add_argument(
            "--publish", action="store_true", help="按清单状态导入；省略时全部作为草稿"
        )
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument(
            "--kind",
            choices=["knowledge", "news"],
            help="仅导入指定栏目；省略时导入全部样例",
        )

    def handle(self, *args, **options):
        owner = (
            get_user_model()
            .objects.filter(username=options["owner"], is_active=True)
            .first()
        )
        if owner is None or not has_feature_perm(owner, "core.manage_auth"):
            raise CommandError("请选择现有且有内容管理权限的账号")
        root = Path(__file__).resolve().parents[2] / "seed_data"
        rows = json.loads((root / "articles.json").read_text(encoding="utf-8"))
        if options.get("kind"):
            rows = [row for row in rows if row["kind"] == options["kind"]]
        provenance = {
            row["file"]: row
            for row in json.loads(
                (root / "provenance.json").read_text(encoding="utf-8")
            )
        }
        # Validate every packaged image before making any database changes.
        for row in provenance.values():
            path = (root / row["file"]).resolve()
            if not path.is_relative_to(root.resolve()) or not path.is_file():
                raise CommandError("样例媒体路径无效")
            if hashlib.sha256(path.read_bytes()).hexdigest() != row["sha256"]:
                raise CommandError(f"样例媒体校验失败：{path.name}")
        created = skipped = 0
        with transaction.atomic():
            for row in rows:
                if Article.objects.filter(seed_key=row["seedKey"]).exists():
                    skipped += 1
                    continue
                if options["dry_run"]:
                    created += 1
                    continue
                status = row["status"] if options["publish"] else "draft"
                article = Article(
                    owner=owner,
                    seed_key=row["seedKey"],
                    kind=row["kind"],
                    title=row["title"],
                    category=row["category"],
                    summary=row["summary"],
                    body=row["body"],
                    source=row["source"],
                    links=row["links"],
                    pinned=row["pinned"],
                    status=status,
                    event_date=parse_date(row["eventDate"])
                    if row["eventDate"]
                    else None,
                    published_at=timezone.now() if status == "published" else None,
                )
                article.full_clean()
                article.save()
                for image in row["assets"]:
                    if image["file"] not in provenance:
                        raise CommandError("样例媒体缺少来源记录")
                    path = root / image["file"]
                    asset = store_asset(
                        article, path.name, path.read_bytes(), image["caption"]
                    )
                    if not article.cover_asset_id:
                        article.cover_asset = asset
                        article.save(update_fields=["cover_asset"])
                log_operation(
                    owner,
                    "内容管理",
                    "导入样例",
                    "success",
                    f"{article.title} [{status}]",
                )
                created += 1
        self.stdout.write(
            f"{'DRY_RUN' if options['dry_run'] else 'IMPORTED'} created={created} skipped={skipped}"
        )
