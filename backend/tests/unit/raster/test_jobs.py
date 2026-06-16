from pathlib import Path

from django.test import SimpleTestCase

from apps.raster.services.exceptions import RasterJobError
from apps.raster.services.jobs import (
    RasterJob,
    _JOBS,
    _LOCK,
    _append_job,
    _create_job,
    _fail_job,
    _finish_job,
    _set_job_artifact,
    get_job,
    get_job_artifact_path,
)


class RasterJobStateTests(SimpleTestCase):
    def setUp(self):
        with _LOCK:
            _JOBS.clear()

    def tearDown(self):
        with _LOCK:
            _JOBS.clear()

    def test_job_append_caps_messages_and_never_reduces_progress(self):
        job = RasterJob(id="job-1", kind="render")

        for index in range(130):
            job.append(f"message {index}", index)
        job.append("old progress", 50)

        self.assertEqual(len(job.messages), 120)
        self.assertEqual(job.messages[0], "message 11")
        self.assertEqual(job.messages[-1], "old progress")
        self.assertEqual(job.progress_percent, 100)

    def test_append_job_parses_progress_from_message(self):
        job = _create_job("scan")

        _append_job(job.id, "扫描进度 60%")

        stored = get_job(job.id)
        self.assertEqual(stored.status, "running")
        self.assertEqual(stored.progress_percent, 60)
        self.assertEqual(stored.messages, ["扫描进度 60%"])

    def test_finish_job_marks_ready_with_result(self):
        job = _create_job("render")

        _finish_job(job.id, {"status": "ready"}, "ready")

        stored = get_job(job.id)
        self.assertEqual(stored.status, "ready")
        self.assertEqual(stored.progress_percent, 100)
        self.assertEqual(stored.result, {"status": "ready"})
        self.assertIsNotNone(stored.finished_at)

    def test_fail_job_records_error_and_message(self):
        job = _create_job("import")

        _fail_job(job.id, "GDAL 处理失败")

        stored = get_job(job.id)
        self.assertEqual(stored.status, "failed")
        self.assertEqual(stored.error, "GDAL 处理失败")
        self.assertIn("GDAL 处理失败", stored.messages)
        self.assertIsNotNone(stored.finished_at)

    def test_get_job_raises_for_missing_job(self):
        with self.assertRaisesRegex(RasterJobError, "任务不存在或已过期"):
            get_job("missing")

    def test_get_job_artifact_path_requires_ready_artifact(self):
        job = _create_job("export")

        with self.assertRaisesRegex(RasterJobError, "导出文件不存在或已过期"):
            get_job_artifact_path(job.id)

        _set_job_artifact(job.id, Path("/tmp/export.zip"))

        self.assertEqual(get_job_artifact_path(job.id), Path("/tmp/export.zip"))
