#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Runs `metadata <subcommand>` via subprocess and returns a typed Status.

One CliRunner per test, bound to tmp_path. Each `.run()` writes numbered
cfg / status / stdout artifacts. Subprocess has a bounded timeout
(default 600s, kwarg override). CliExecutionError carries exit_code,
stderr, stdout, config_path, and argv for post-mortem.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

from ..config.builder import WorkflowConfig
from .errors import CliExecutionError
from .status import Status

DEFAULT_TIMEOUT_SECONDS = 600


class CliRunner:
    """Runs `metadata <subcommand>` via subprocess and returns a typed Status.

    Usage:
        runner = CliRunner(tmp_path)
        status = runner.run(cfg)                        # ingest
        status2 = runner.run(cfg.pipeline(Profiler...))  # profile
    """

    def __init__(self, tmp_path: Path) -> None:
        self.tmp_path = tmp_path
        self._invocation_counter: dict[str, int] = {}

    def run(
        self,
        config: WorkflowConfig,
        *,
        timeout: int = DEFAULT_TIMEOUT_SECONDS,
    ) -> Status:
        identifier = config.pipeline_identifier
        n = self._invocation_counter.get(identifier, 0)
        self._invocation_counter[identifier] = n + 1

        cfg_path = config.write_tmp(self.tmp_path, invocation=n)
        status_path = self.tmp_path / f"status_{identifier}_{n}.json"
        stdout_path = self.tmp_path / f"stdout_{identifier}_{n}.log"

        command = [
            "metadata",
            config.cli_subcommand,
            "-c",
            str(cfg_path),
            "--status-file",
            str(status_path),
        ]

        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired as exc:
            # exc.stdout / exc.stderr may be bytes or str depending on
            # capture config — normalize to str for consistent logging.
            out = _coerce_text(exc.stdout)
            err = _coerce_text(exc.stderr)
            stdout_path.write_text(out)
            raise CliExecutionError(
                exit_code=-1,
                stderr=(
                    f"CLI timed out after {timeout}s.\n"
                    f"stderr so far:\n{err}"
                ),
                stdout=out,
                config_path=cfg_path,
                command=command,
            ) from exc

        # Persist stdout unconditionally — useful for debugging both
        # successful runs (checking warnings) and failed ones.
        stdout_path.write_text(result.stdout or "")

        if result.returncode != 0:
            raise CliExecutionError(
                exit_code=result.returncode,
                stderr=result.stderr,
                stdout=result.stdout,
                config_path=cfg_path,
                command=command,
            )

        # Defensive: CLI reported success but wrote no status file — something
        # broke between workflow completion and file emission (e.g., a future
        # BaseWorkflow.write_status_file regression).
        if not status_path.exists():
            raise CliExecutionError(
                exit_code=0,
                stderr=(
                    f"CLI exited 0 but no status file was written at {status_path}."
                ),
                stdout=result.stdout,
                config_path=cfg_path,
                command=command,
            )

        return Status.from_json(status_path)


def _coerce_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value)
