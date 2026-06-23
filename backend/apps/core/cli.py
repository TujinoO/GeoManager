from __future__ import annotations

import os
import subprocess
from pathlib import Path
from typing import Literal

BACKEND_ROOT = Path(__file__).resolve().parents[3]
CLI_RUN_MODE_ENV = "HUYANG_CLI_RUN_MODE"
CliRunMode = Literal["pixi", "direct"]


def cli_run_mode(env: dict[str, str] | None = None) -> CliRunMode:
    value = (env or os.environ).get(CLI_RUN_MODE_ENV, "pixi").strip().lower()
    if value == "direct":
        return "direct"
    return "pixi"


def build_cli_command(
    command: list[str],
    *,
    mode: CliRunMode | None = None,
    env: dict[str, str] | None = None,
) -> list[str]:
    selected_mode = mode or cli_run_mode(env)
    if selected_mode == "direct":
        return [*command]
    return ["pixi", "run", "--executable", *command]


def run_cli_capture(
    command: list[str],
    *,
    cwd: Path = BACKEND_ROOT,
    env: dict[str, str] | None = None,
    mode: CliRunMode | None = None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        build_cli_command(command, mode=mode, env=env),
        capture_output=True,
        text=True,
        check=False,
        env=env,
        cwd=cwd,
    )


def popen_cli(
    command: list[str],
    *,
    cwd: Path = BACKEND_ROOT,
    env: dict[str, str] | None = None,
    mode: CliRunMode | None = None,
    **kwargs,
) -> subprocess.Popen[str]:
    return subprocess.Popen(
        build_cli_command(command, mode=mode, env=env),
        cwd=cwd,
        env=env,
        **kwargs,
    )
