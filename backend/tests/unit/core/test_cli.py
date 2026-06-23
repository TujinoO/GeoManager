from __future__ import annotations

import subprocess
from unittest import mock

from django.test import SimpleTestCase

from apps.core import cli


class CliCommandTests(SimpleTestCase):
    def test_default_mode_wraps_command_with_pixi_run_executable(self):
        self.assertEqual(
            cli.build_cli_command(["gdalwarp", "-t_srs", "EPSG:3857"]),
            ["pixi", "run", "--executable", "gdalwarp", "-t_srs", "EPSG:3857"],
        )

    def test_direct_mode_keeps_original_command(self):
        self.assertEqual(
            cli.build_cli_command(["gdalwarp", "in.tif"], mode="direct"),
            ["gdalwarp", "in.tif"],
        )

    def test_env_can_switch_to_direct_mode(self):
        self.assertEqual(
            cli.build_cli_command(
                ["gdalinfo", "-json", "a.tif"],
                env={cli.CLI_RUN_MODE_ENV: "direct"},
            ),
            ["gdalinfo", "-json", "a.tif"],
        )

    def test_unknown_env_mode_falls_back_to_pixi(self):
        self.assertEqual(
            cli.build_cli_command(["gdalinfo"], env={cli.CLI_RUN_MODE_ENV: "bad"}),
            ["pixi", "run", "--executable", "gdalinfo"],
        )

    def test_run_cli_capture_uses_backend_workspace(self):
        result = subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout="ok",
            stderr="",
        )
        with mock.patch.object(cli.subprocess, "run", return_value=result) as run:
            self.assertIs(cli.run_cli_capture(["gdalinfo"]), result)

        run.assert_called_once()
        self.assertEqual(
            run.call_args.args[0], ["pixi", "run", "--executable", "gdalinfo"]
        )
        self.assertEqual(run.call_args.kwargs["cwd"], cli.BACKEND_ROOT)

    def test_popen_cli_uses_backend_workspace(self):
        process = mock.Mock()
        with mock.patch.object(cli.subprocess, "Popen", return_value=process) as popen:
            self.assertIs(cli.popen_cli(["gdalwarp"], stdout=subprocess.PIPE), process)

        popen.assert_called_once()
        self.assertEqual(
            popen.call_args.args[0], ["pixi", "run", "--executable", "gdalwarp"]
        )
        self.assertEqual(popen.call_args.kwargs["cwd"], cli.BACKEND_ROOT)
        self.assertEqual(popen.call_args.kwargs["stdout"], subprocess.PIPE)
