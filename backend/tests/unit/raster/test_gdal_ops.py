from __future__ import annotations

import subprocess
from pathlib import Path
from unittest import mock

from django.test import SimpleTestCase

from apps.raster.services import gdal_ops
from apps.raster.services.exceptions import RasterImportError


class GdalOpsTests(SimpleTestCase):
    def test_gdalinfo_uses_cli_wrapper(self):
        result = subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout='{"size":[1,1]}',
            stderr="",
        )
        with mock.patch.object(gdal_ops, "run_cli_capture", return_value=result) as run:
            self.assertEqual(gdal_ops.gdalinfo_json(Path("a.tif")), {"size": [1, 1]})

        run.assert_called_once_with(
            ["gdalinfo", "-json", "a.tif"],
        )

    def test_gdal_command_uses_cli_wrapper(self):
        process = mock.Mock()
        process.stdout.read.side_effect = ["", ""]
        process.poll.return_value = 0
        process.wait.return_value = 0
        with mock.patch.object(gdal_ops, "popen_cli", return_value=process) as popen:
            gdal_ops.run_gdal_command(["gdalwarp", "in.tif", "out.tif"])

        popen.assert_called_once()
        self.assertEqual(
            popen.call_args.args[0],
            ["gdalwarp", "in.tif", "out.tif"],
        )
        self.assertEqual(popen.call_args.kwargs["stdout"], subprocess.PIPE)
        self.assertEqual(popen.call_args.kwargs["stderr"], subprocess.STDOUT)

    def test_gdalinfo_raises_import_error_on_command_failure(self):
        result = subprocess.CompletedProcess(
            args=[],
            returncode=1,
            stdout="",
            stderr="failed",
        )
        with mock.patch.object(gdal_ops, "run_cli_capture", return_value=result):
            with self.assertRaisesMessage(RasterImportError, "failed"):
                gdal_ops.gdalinfo_json(Path("a.tif"))
