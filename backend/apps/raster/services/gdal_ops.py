from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any, Callable

from apps.raster.services.exceptions import RasterImportError


def gdalinfo_json(path: Path) -> dict[str, Any]:
    result = subprocess.run(["gdalinfo", "-json", str(path)], capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RasterImportError(result.stderr.strip() or "gdalinfo 执行失败")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RasterImportError("gdalinfo 未返回有效 JSON") from exc


def run_gdal_command(command: list[str], progress: Callable[[str], None] | None = None) -> str:
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    output: list[str] = []
    assert process.stdout is not None
    for line in process.stdout:
        output.append(line)
        if progress:
            progress(line)
    return_code = process.wait()
    text = "".join(output)
    if return_code != 0:
        raise RasterImportError(text.strip() or f"命令执行失败：{' '.join(command)}")
    return text
