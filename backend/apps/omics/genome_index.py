"""Streaming import and bounded queries for versioned reference assemblies."""

from __future__ import annotations

import collections
import gzip
import hashlib
import re
import sqlite3
import uuid
from contextlib import closing
from pathlib import Path
from urllib.parse import unquote

from django.db import transaction

from apps.catalog.models import DataResource
from apps.core.storage import gene_data_path
from apps.omics.models import (
    GenomeAnnotation,
    GenomeAssembly,
    GenomeDataset,
    GenomeIndex,
    GenomeSequenceFile,
)


class GenomeError(ValueError):
    pass


def fasta_records(path, budget):
    opener = gzip.open if path.suffix.lower() == ".gz" else open
    header, parts = None, []
    with opener(path, "rt", encoding="utf-8-sig") as handle:
        for line in handle:
            budget[0] -= len(line.encode("utf-8"))
            if budget[0] < 0:
                raise GenomeError("文件展开超过本次导入预算")
            if line.startswith(">"):
                if header is not None:
                    yield header, "".join(parts).upper()
                header, parts = line[1:].strip(), []
                if not header:
                    raise GenomeError("FASTA存在空编号")
            elif line.strip():
                if header is None:
                    raise GenomeError("FASTA序列前缺少header")
                parts.append(line.strip())
        if header is not None:
            yield header, "".join(parts).upper()


def attributes(raw):
    return {
        k: unquote(v)
        for part in raw.strip().split(";")
        if "=" in part
        for k, v in [part.split("=", 1)]
    }


def header_attributes(header):
    return dict(re.findall(r"(?:^|[\t ])([A-Za-z_]+)=([^\t ]+)", header))


def index_connection(index):
    path = gene_data_path(index.index_path)
    if not path.is_file():
        raise GenomeError("基因组索引文件不存在，请重新构建")
    connection = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def assembly_item(index):
    a, s = index.assembly, index.summary
    return {
        "id": a.pk,
        "resourceId": a.data_resource_id,
        "code": a.assembly_code,
        "name": a.genome_dataset.name,
        "version": a.version,
        "sex": index.sex,
        "provenance": index.provenance,
        "status": index.status,
        "totalBp": s.get("totalBp", 0),
        "geneCount": s.get("geneCount", 0),
    }


def summary_payload(index):
    return {
        **index.summary,
        "assembly": assembly_item(index),
        "coordinateSystem": "1-based-closed",
        "sourceUrl": index.source_url,
    }


def build_index(
    *,
    files,
    code,
    name,
    user,
    provenance,
    sex="unknown",
    source_url="",
    max_expanded=4 * 1024**3,
):
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,100}", code):
        raise GenomeError("组装编号仅支持字母、数字、点、下划线和连字符，最长100字符")
    if not 1 <= len(name) <= 160:
        raise GenomeError("名称必须为1–160字")
    if provenance not in {"observed", "synthetic"} or sex not in {
        "female",
        "male",
        "unknown",
    }:
        raise GenomeError("来源或性别标签无效")
    if not {"genome", "gff"} <= set(files):
        raise GenomeError("至少提供genome和gff文件")
    if GenomeAssembly.objects.filter(assembly_code=code).exists():
        raise GenomeError("此组装编号已存在；新版本请使用新的唯一编号")
    relative = f"analysis/{uuid.uuid4().hex}"
    root = gene_data_path(relative)
    root.mkdir(parents=True, exist_ok=False)
    manifest, paths = [], {}
    for role, original in files.items():
        if role not in {"genome", "gff", "protein", "rna", "cds"}:
            raise GenomeError("不支持的文件角色")
        path = Path(original)
        dest = root / (role + (".gz" if path.suffix.lower() == ".gz" else ".txt"))
        digest = hashlib.sha256()
        with path.open("rb") as src, dest.open("xb") as out:
            for chunk in iter(lambda: src.read(1024 * 1024), b""):
                digest.update(chunk)
                out.write(chunk)
        paths[role] = dest
        manifest.append(
            {
                "role": role,
                "name": path.name,
                "sha256": digest.hexdigest(),
                "size": dest.stat().st_size,
            }
        )
    with transaction.atomic():
        resource = DataResource.objects.create(
            name=name,
            code="genome-" + uuid.uuid4().hex[:24],
            data_type="gene",
            domain_type="genome",
            file_format="GENOME_INDEX",
            storage_path=f"gene/{relative}/index.sqlite",
            source=source_url
            or ("合成演示数据" if provenance == "synthetic" else "用户提供"),
            maintainer=user,
            status="inactive",
            default_visualization={"analysisKind": "genome", "provenance": provenance},
        )
        dataset = GenomeDataset.objects.create(
            genome_dataset_code=code,
            name=name,
            dataset_type="reference",
            data_resource=resource,
            status="indexing",
            metadata={"provenance": provenance, "sex": sex},
        )
        assembly = GenomeAssembly.objects.create(
            assembly_code=code,
            genome_dataset=dataset,
            version="1",
            data_resource=resource,
        )
        annotation = GenomeAnnotation.objects.create(
            annotation_code=code + "-annotation",
            genome_dataset=dataset,
            annotation_type="structural",
            reference_version=code,
            data_resource=resource,
        )
        index = GenomeIndex.objects.create(
            assembly=assembly,
            annotation=annotation,
            index_path=f"{relative}/index.sqlite",
            provenance=provenance,
            sex=sex,
            source_url=source_url,
        )
    try:
        summary = _write_index(root, paths, manifest, max_expanded)
        with transaction.atomic():
            index.summary, index.status = summary, "ready"
            index.save()
            assembly.genome_size = summary["totalBp"]
            assembly.save(update_fields=["genome_size"])
            annotation.gene_count = summary["geneCount"]
            annotation.save(update_fields=["gene_count"])
            dataset.status = "ready"
            dataset.save(update_fields=["status"])
            resource.status, resource.item_count = "active", summary["geneCount"]
            resource.size_bytes = sum(f["size"] for f in manifest)
            resource.save(update_fields=["status", "item_count", "size_bytes"])
            for f in manifest:
                GenomeSequenceFile.objects.create(
                    file_code=code + "-" + f["role"],
                    genome_dataset=dataset,
                    file_role=f["role"],
                    file_format="gzip" if f["name"].endswith(".gz") else "text",
                    data_resource=resource,
                    storage_path=str(
                        paths[f["role"]].relative_to(gene_data_path())
                    ).replace("\\", "/"),
                    checksum=f["sha256"],
                    size_bytes=f["size"],
                )
        return index
    except Exception as exc:
        index.status, index.error = "failed", "索引构建失败，请核对文件配套与日志"
        index.save(update_fields=["status", "error", "updated_at"])
        if isinstance(
            exc, (GenomeError, ValueError, UnicodeError, OSError, sqlite3.Error)
        ):
            raise GenomeError(
                str(exc)
                if isinstance(exc, GenomeError)
                else "文件格式、压缩完整性或索引写入失败"
            ) from exc
        raise


def _write_index(root, paths, manifest, expanded):
    budget = [expanded]
    warnings, seqs, lengths, counts = [], [], [], collections.Counter()
    with sqlite3.connect(root / "index.sqlite") as db:
        db.executescript("""
        CREATE TABLE dna (id TEXT PRIMARY KEY, alias TEXT UNIQUE, length INTEGER, offset INTEGER);
        CREATE TABLE feature (id TEXT, accession TEXT, parent TEXT, type TEXT, seqid TEXT, start0 INTEGER, end0 INTEGER, strand TEXT, phase TEXT, gene_id TEXT);
        CREATE TABLE alias (alias TEXT, gene_id TEXT, UNIQUE(alias,gene_id));
        CREATE TABLE sequence (role TEXT, id TEXT, gene_id TEXT, transcript_id TEXT, sequence TEXT, length INTEGER, PRIMARY KEY(role,id));
        CREATE INDEX feature_id ON feature(id);
        CREATE INDEX feature_parent ON feature(parent);
        """)
        with (root / "dna.bin").open("xb") as dna:
            for header, sequence in fasta_records(paths["genome"], budget):
                seqid = header.split()[0]
                alias = header_attributes(header).get("OriSeqID", seqid)
                if not sequence:
                    raise GenomeError(f"空DNA序列：{seqid}")
                if re.search(r"[^ACGTRYSWKMBDHVN]", sequence):
                    raise GenomeError(f"DNA字符集无效：{seqid}")
                c = collections.Counter(sequence)
                counts.update(c)
                canonical = sum(c[b] for b in "ACGT")
                bins = []
                for start in range(0, len(sequence), 1_000_000):
                    bc = collections.Counter(sequence[start : start + 1_000_000])
                    den = sum(bc[b] for b in "ACGT")
                    bins.append(
                        {
                            "start": start + 1,
                            "end": min(start + 1_000_000, len(sequence)),
                            "gc": (bc["G"] + bc["C"]) / den if den else None,
                            "geneCount": 0,
                        }
                    )
                try:
                    db.execute(
                        "INSERT INTO dna VALUES(?,?,?,?)",
                        (seqid, alias, len(sequence), dna.tell()),
                    )
                except sqlite3.IntegrityError as exc:
                    raise GenomeError(f"重复DNA编号或别名：{seqid}") from exc
                dna.write(sequence.encode("ascii"))
                lengths.append(len(sequence))
                seqs.append(
                    {
                        "id": seqid,
                        "name": alias,
                        "length": len(sequence),
                        "gc": (c["G"] + c["C"]) / canonical if canonical else None,
                        "n": c["N"],
                        "geneCount": 0,
                        "bins": bins,
                    }
                )
        if not seqs:
            raise GenomeError("FASTA没有序列")
        seqmap = {s["id"]: s for s in seqs}
        opener = gzip.open if paths["gff"].suffix == ".gz" else open
        row_count = 0
        with opener(paths["gff"], "rt", encoding="utf-8-sig") as handle:
            for line_number, line in enumerate(handle, 1):
                budget[0] -= len(line.encode("utf-8"))
                if budget[0] < 0:
                    raise GenomeError("GFF展开超过预算")
                if line.startswith("##FASTA"):
                    break
                if line.startswith("#") or not line.strip():
                    continue
                parts = line.rstrip("\r\n").split("\t")
                if len(parts) != 9:
                    raise GenomeError(f"GFF第{line_number}行不是9列")
                seqid, _, kind, start, end, _, strand, phase, raw = parts
                try:
                    start, end = int(start), int(end)
                except ValueError as exc:
                    raise GenomeError(f"GFF第{line_number}行坐标非整数") from exc
                if (
                    seqid not in seqmap
                    or not 1 <= start <= end <= seqmap[seqid]["length"]
                ):
                    raise GenomeError(f"GFF第{line_number}行seqid或坐标不匹配")
                if strand not in {"+", "-", ".", "?"} or phase not in {
                    "0",
                    "1",
                    "2",
                    ".",
                }:
                    raise GenomeError(f"GFF第{line_number}行链向或phase无效")
                a = attributes(raw)
                if kind == "gene" and not a.get("ID"):
                    raise GenomeError(f"GFF第{line_number}行基因缺ID")
                for parent in a.get("Parent", "").split(","):
                    db.execute(
                        "INSERT INTO feature VALUES(?,?,?,?,?,?,?,?,?,NULL)",
                        (
                            a.get("ID", ""),
                            a.get("Accession", ""),
                            parent,
                            kind,
                            seqid,
                            start - 1,
                            end,
                            strand,
                            phase,
                        ),
                    )
                row_count += 1
                if row_count > 3_000_000:
                    raise GenomeError("注释超过300万记录预算")
                if kind == "gene":
                    seqmap[seqid]["geneCount"] += 1
                    seqmap[seqid]["bins"][(start - 1) // 1_000_000]["geneCount"] += 1
        if db.execute(
            "SELECT id FROM feature WHERE type='gene' GROUP BY id HAVING COUNT(*)>1 LIMIT 1"
        ).fetchone():
            raise GenomeError("GFF基因ID重复")
        if db.execute(
            "SELECT parent FROM feature f WHERE parent!='' AND NOT EXISTS(SELECT 1 FROM feature p WHERE p.id=f.parent) LIMIT 1"
        ).fetchone():
            raise GenomeError("GFF存在未解析Parent")
        db.execute("UPDATE feature SET gene_id=id WHERE type='gene'")
        # Ordered passes resolve child-before-parent and usual GFF hierarchy.
        for _ in range(6):
            changed = db.execute(
                "UPDATE feature SET gene_id=(SELECT p.gene_id FROM feature p WHERE p.id=feature.parent AND p.gene_id IS NOT NULL LIMIT 1) WHERE gene_id IS NULL AND EXISTS(SELECT 1 FROM feature p WHERE p.id=feature.parent AND p.gene_id IS NOT NULL)"
            ).rowcount
            if not changed:
                break
        db.executescript("""
        CREATE INDEX feature_gene ON feature(gene_id,type);
        CREATE INDEX feature_region ON feature(type,seqid,start0,end0);
        INSERT OR IGNORE INTO alias SELECT id,gene_id FROM feature WHERE id!='' AND gene_id IS NOT NULL;
        INSERT OR IGNORE INTO alias SELECT accession,gene_id FROM feature WHERE accession!='' AND gene_id IS NOT NULL;
        """)
        for role in ["protein", "rna", "cds"]:
            if role not in paths:
                warnings.append(f"未提供{role}序列文件")
                continue
            for header, sequence in fasta_records(paths[role], budget):
                sid = header.split()[0]
                a = header_attributes(header)
                match = None
                for key in [
                    a.get("Gene"),
                    a.get("OriGeneID"),
                    a.get("mRNA"),
                    a.get("OriID"),
                    sid,
                ]:
                    if key:
                        match = db.execute(
                            "SELECT gene_id FROM alias WHERE alias=? LIMIT 1", (key,)
                        ).fetchone()
                        if match:
                            break
                if not match:
                    raise GenomeError(f"{role}序列{sid}无法关联GFF，请确认配套版本")
                if not sequence:
                    raise GenomeError(f"{role}存在空序列{sid}")
                if (
                    role != "protein" and re.search(r"[^ACGTRYSWKMBDHVNU]", sequence)
                ) or (role == "protein" and re.search(r"[^A-Z*]", sequence)):
                    raise GenomeError(f"{role}字符集无效")
                tx = (
                    a.get("OriTrascriptID")
                    or a.get("OriTranscriptID")
                    or a.get("mRNA")
                    or a.get("OriID", "")
                )
                try:
                    db.execute(
                        "INSERT INTO sequence VALUES(?,?,?,?,?,?)",
                        (role, sid, match[0], tx, sequence, len(sequence)),
                    )
                except sqlite3.IntegrityError as exc:
                    raise GenomeError(f"{role}序列编号重复：{sid}") from exc
                db.execute("INSERT OR IGNORE INTO alias VALUES(?,?)", (sid, match[0]))
                if a.get("OriID"):
                    db.execute(
                        "INSERT OR IGNORE INTO alias VALUES(?,?)",
                        (a["OriID"], match[0]),
                    )
        db.execute("CREATE INDEX sequence_gene ON sequence(gene_id,role)")
        gene_count = db.execute(
            "SELECT count(*) FROM feature WHERE type='gene'"
        ).fetchone()[0]
        if not gene_count:
            raise GenomeError("GFF没有gene模型")
        missing = db.execute(
            "SELECT count(*) FROM feature g WHERE type='gene' AND NOT EXISTS(SELECT 1 FROM sequence s WHERE s.gene_id=g.id AND s.role='protein')"
        ).fetchone()[0]
        if missing:
            warnings.append(
                f"{missing}个基因没有配套蛋白序列；保留模型，不自动标为假基因"
            )
        total = sum(lengths)
        cumulative = 0
        n50 = 0
        for length in sorted(lengths, reverse=True):
            cumulative += length
            if cumulative >= total / 2:
                n50 = length
                break
        canonical = sum(counts[b] for b in "ACGT")
        return {
            "totalBp": total,
            "sequenceCount": len(seqs),
            "chromosomeCount": sum(
                bool(re.fullmatch(r"chr\d+", s["name"], re.I)) for s in seqs
            ),
            "sequenceN50": n50,
            "gc": (counts["G"] + counts["C"]) / canonical if canonical else None,
            "nCount": counts["N"],
            "geneCount": gene_count,
            "transcriptCount": db.execute(
                "SELECT count(*) FROM feature WHERE type IN ('mRNA','transcript','lnc_RNA','ncRNA','tRNA','rRNA')"
            ).fetchone()[0],
            "proteinCount": db.execute(
                "SELECT count(*) FROM sequence WHERE role='protein'"
            ).fetchone()[0],
            "sequences": seqs,
            "files": manifest,
            "warnings": warnings,
        }


def bounded_int(value, default, low, high, label):
    try:
        result = int(value) if value is not None else default
    except (TypeError, ValueError) as exc:
        raise GenomeError(f"{label}必须是整数") from exc
    if not low <= result <= high:
        raise GenomeError(f"{label}超出范围")
    return result


def serialize_gene(row):
    return {
        "id": row["id"],
        "accession": row["accession"],
        "seqid": row["seqid"],
        "start": row["start0"] + 1,
        "end": row["end0"],
        "strand": row["strand"],
        "proteinCount": row["protein_count"],
    }


def search_genes(index, params):
    limit = bounded_int(params.get("limit"), 30, 1, 500, "limit")
    offset = bounded_int(params.get("offset"), 0, 0, 10_000_000, "offset")
    clauses, values = ["g.type='gene'"], []
    with closing(index_connection(index)) as db:
        if params.get("seqid"):
            row = db.execute(
                "SELECT id,length FROM dna WHERE id=? OR alias=?",
                (params["seqid"], params["seqid"]),
            ).fetchone()
            if row is None:
                raise GenomeError("染色体编号或别名不存在")
            start = bounded_int(params.get("start"), 1, 1, row["length"], "start")
            end = bounded_int(
                params.get("end"), row["length"], start, row["length"], "end"
            )
            clauses.extend(["g.seqid=?", "g.start0<?", "g.end0>?"])
            values.extend([row["id"], end, start - 1])
        elif params.get("start") or params.get("end"):
            raise GenomeError("区间检索必须选择染色体")
        q = str(params.get("q", "")).strip()
        if len(q) > 150:
            raise GenomeError("检索词最长150字符")
        if q:
            exact = db.execute(
                "SELECT gene_id FROM alias WHERE alias=?", (q,)
            ).fetchall()
            if exact:
                clauses.append("g.id IN (" + ",".join("?" for _ in exact) + ")")
                values.extend(row[0] for row in exact)
            else:
                clauses.append(
                    "g.id IN (SELECT a.gene_id FROM alias a WHERE instr(lower(a.alias),lower(?))>0)"
                )
                values.append(q)
        where = " AND ".join(clauses)
        total = db.execute(
            "SELECT count(*) FROM feature g WHERE " + where, values
        ).fetchone()[0]
        items = db.execute(
            "SELECT g.*, (SELECT count(*) FROM sequence s WHERE s.gene_id=g.id AND s.role='protein') protein_count FROM feature g WHERE "
            + where
            + " ORDER BY g.seqid,g.start0,g.id LIMIT ? OFFSET ?",
            [*values, limit, offset],
        ).fetchall()
        return {
            "items": [serialize_gene(r) for r in items],
            "total": total,
            "offset": offset,
            "coordinateSystem": "1-based-closed",
        }


def gene_detail(index, gene_id):
    with closing(index_connection(index)) as db:
        found = db.execute(
            "SELECT DISTINCT gene_id FROM alias WHERE alias=?", (gene_id,)
        ).fetchall()
        if len(found) != 1:
            raise GenomeError("基因编号不存在或有歧义，请使用原始基因编号")
        canonical = found[0][0]
        row = db.execute(
            "SELECT g.*,(SELECT count(*) FROM sequence s WHERE s.gene_id=g.id AND s.role='protein') protein_count FROM feature g WHERE g.type='gene' AND g.id=?",
            (canonical,),
        ).fetchone()
        features = db.execute(
            "SELECT * FROM feature WHERE gene_id=? ORDER BY start0,end0,type",
            (canonical,),
        ).fetchall()
        sequences = db.execute(
            "SELECT role,id,length,transcript_id FROM sequence WHERE gene_id=? ORDER BY role,id",
            (canonical,),
        ).fetchall()
        return {
            "gene": serialize_gene(row),
            "features": [
                {
                    "id": r["id"],
                    "parent": r["parent"],
                    "type": r["type"],
                    "start": r["start0"] + 1,
                    "end": r["end0"],
                    "strand": r["strand"],
                    "phase": r["phase"],
                }
                for r in features
            ],
            "sequences": [
                {
                    "id": r["id"],
                    "role": r["role"],
                    "length": r["length"],
                    "transcriptId": r["transcript_id"],
                }
                for r in sequences
            ],
            "coordinateSystem": "1-based-closed",
        }


def sequence_region(index, params):
    role = params.get("role", "genome")
    sid = params.get("seqid", "")
    strand = params.get("strand", "+")
    if (
        role not in {"genome", "protein", "rna", "cds"}
        or strand not in {"+", "-"}
        or (role == "protein" and strand != "+")
    ):
        raise GenomeError("序列角色或链向无效")
    with closing(index_connection(index)) as db:
        row = (
            db.execute("SELECT * FROM dna WHERE id=? OR alias=?", (sid, sid)).fetchone()
            if role == "genome"
            else db.execute(
                "SELECT * FROM sequence WHERE role=? AND id=?", (role, sid)
            ).fetchone()
        )
        if row is None:
            raise GenomeError("该序列编号不存在")
        start = bounded_int(params.get("start"), 1, 1, row["length"], "start")
        end = bounded_int(
            params.get("end"),
            min(row["length"], start + 999),
            start,
            row["length"],
            "end",
        )
        if end - start + 1 > 100_000:
            raise GenomeError("单次最多返回100000字符，请缩小区间")
        if role == "genome":
            with (
                gene_data_path(index.index_path).with_name("dna.bin").open("rb") as dna
            ):
                dna.seek(row["offset"] + start - 1)
                seq = dna.read(end - start + 1).decode("ascii")
        else:
            seq = row["sequence"][start - 1 : end]
        if strand == "-":
            seq = seq.translate(str.maketrans("ACGTRYSWKMBDHVNU", "TGCAYRSWMKVHDBNA"))[
                ::-1
            ]
        return {
            "id": row["id"],
            "role": role,
            "start": start,
            "end": end,
            "strand": strand,
            "sequence": seq,
            "length": row["length"],
            "coordinateSystem": "1-based-closed",
        }
