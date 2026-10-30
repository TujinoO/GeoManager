import gzip
from unittest.mock import patch

import pandas as pd
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase

from apps.catalog.analysis import validate_table
from apps.catalog.analysis_readers import read_analysis_upload
from apps.catalog.analysis_visuals import build_visuals
from apps.catalog.importer import ImportDataError


class StandardAnalysisReaderTests(SimpleTestCase):
    header = "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\ts01\ts02\n"

    def upload(self, text, name="variants.vcf", assembly="ASM.1", kind="variants"):
        raw = text.encode("utf-8")
        if name.endswith(".gz"):
            raw = gzip.compress(raw)
        return read_analysis_upload(SimpleUploadedFile(name, raw), kind, assembly)

    def test_tsv_preserves_identifiers_and_missing(self):
        df = self.upload(
            "\ufeffrecord_id\tvalue\n001\t0\n002\t\n", name="data.tsv", kind="traits"
        )
        self.assertEqual(
            df.to_dict("records"),
            [{"record_id": "001", "value": "0"}, {"record_id": "002", "value": ""}],
        )

    def test_compressed_text_and_delimited_txt_preserve_missing_and_zero(self):
        for name, separator in [
            ("table.csv.gz", ","),
            ("table.tsv.gz", "\t"),
            ("table.txt", ";"),
            ("table.txt.gz", "|"),
        ]:
            with self.subTest(name=name):
                df = self.upload(
                    f"sample_code{separator}value\n001{separator}0\n002{separator}\n",
                    name=name,
                    kind="molecular",
                )
                self.assertEqual(df.sample_code.tolist(), ["001", "002"])
                self.assertEqual(df.value.tolist(), ["0", ""])

    def test_compressed_text_rejects_duplicate_headers_and_corrupt_gzip(self):
        with self.assertRaises(ImportDataError):
            self.upload("sample_code\tsample_code\n001\t002\n", name="table.tsv.gz")
        with self.assertRaises(ImportDataError):
            read_analysis_upload(
                SimpleUploadedFile("table.csv.gz", b"broken gzip"), "samples"
            )

    def test_vcf_expands_samples_preserving_gt_missing_and_zero_quality(self):
        df = self.upload(
            "##fileformat=VCFv4.2\n"
            + self.header
            + "chr01\t7\t.\tA\tG\t0\tPASS\t.\tDP:GT\t9:0|1\t.:./.\n",
            name="calls.vcf.gz",
        )
        self.assertEqual(df.genotype.tolist(), ["0|1", "./."])
        self.assertEqual(df.quality.tolist(), ["0", "0"])
        self.assertEqual(validate_table(df, "variants")[0], [])

    def test_vcf_requires_assembly_and_matching_kind(self):
        for kw in [{"assembly": ""}, {"kind": "traits"}]:
            with self.subTest(kw=kw), self.assertRaises(ImportDataError):
                self.upload(self.header, **kw)

    def test_vcf_rejects_unsupported_and_malformed_records(self):
        valid = "chr01\t7\t.\tA\tG\t.\tPASS\t.\tGT\t0/1\t1/1\n"
        cases = [
            self.header + valid.replace("\tG\t", "\tG,T\t"),
            self.header + valid.replace("\tG\t", "\t<DEL>\t"),
            self.header + valid.replace("0/1", "0/2"),
            self.header + valid.replace("\t7\t", "\t0\t"),
            self.header + valid.replace("\tGT\t", "\tDP\t"),
            self.header.replace("s02", "s01") + valid,
            self.header + valid + "#CHROM\tPOS\n",
            self.header.replace("POS", "WRONG") + valid,
            valid,
            self.header + valid.replace("\tG\t", "\tA\t"),
        ]
        for text in cases:
            with self.subTest(text=text), self.assertRaises(ImportDataError):
                self.upload(text)

    def test_empty_tsv_and_expansion_budget(self):
        with self.assertRaises(ImportDataError):
            self.upload("", name="empty.tsv")
        with (
            patch("apps.catalog.analysis_readers.MAX_TEXT", 8),
            self.assertRaises(ImportDataError),
        ):
            self.upload("column\n" + "x" * 30, name="large.vcf.gz")

    def test_sequence_lengths_units_and_assembly(self):
        row = dict(
            assembly="A",
            record_id="p1",
            sequence_id="p1",
            sequence_type="protein",
            gene_id="",
            chromosome="",
            length_bp="",
            length_aa=10,
            gc_fraction="",
        )
        df = pd.DataFrame([row])
        self.assertEqual(validate_table(df, "sequence")[0], [])
        self.assertEqual(
            build_visuals(df, "sequence", "length_aa", "sequence_type")["metrics"][3][
                "value"
            ],
            "0",
        )
        for change in [
            dict(length_aa=1.5),
            dict(length_aa=0),
            dict(gc_fraction=0.4),
            dict(length_bp=4),
            dict(sequence_type="bogus"),
        ]:
            with self.subTest(change=change):
                self.assertTrue(
                    validate_table(pd.DataFrame([{**row, **change}]), "sequence")[0]
                )
        self.assertTrue(
            validate_table(pd.DataFrame([row, {**row, "assembly": "B"}]), "sequence")[0]
        )
