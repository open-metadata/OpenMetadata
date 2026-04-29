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

import json
import logging
import subprocess
from typing import TYPE_CHECKING

from .errors import CliExecutionError
from .status import Status

if TYPE_CHECKING:
    from pathlib import Path

    from ..config.builder import WorkflowConfig

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 600

# Cap inline step failures GLOBALLY across all steps. Failures cascade —
# step 1's first failure is overwhelmingly the root cause, step 5's third
# failure is downstream noise. The full list is in the status JSON for
# deep dives.
_INLINE_FAILURES_LIMIT = 3
_INLINE_FAILURE_CHARS = 500


def _summarize_step_failures(status_path: Path) -> str | None:
    """Best-effort: read the status JSON and pull out the first few step
    failures (across all steps, capped globally) as a short, scannable
    block. Returns None on any read / parse failure — caller falls back
    to the raw stdout/stderr dump.

    Output shape (one line per failure, truncated):
        [StepName::FailureName] first-line-of-error…
    """
    if not status_path.exists():
        return None
    try:
        data = json.loads(status_path.read_text())
    except (json.JSONDecodeError, OSError):
        return None

    lines: list[str] = []
    for step in data.get("steps") or []:
        step_name = step.get("name", "?")
        for failure in step.get("failures") or []:
            if len(lines) >= _INLINE_FAILURES_LIMIT:
                return "\n".join(lines)
            name = failure.get("name", "?")
            err = (failure.get("error") or "").splitlines()[0][:_INLINE_FAILURE_CHARS]
            lines.append(f"    [{step_name}::{name}] {err}")
    return "\n".join(lines) if lines else None


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
                check=False,
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
                stderr=(f"CLI timed out after {timeout}s.\nstderr so far:\n{err}"),
                stdout=out,
                config_path=cfg_path,
                status_path=status_path,
                command=command,
            ) from exc

        # Persist stdout unconditionally — useful for debugging both
        # successful runs (checking warnings) and failed ones.
        stdout_path.write_text(result.stdout or "")

        # One line with the three artifact paths. Invaluable for post-mortem
        # because pytest's tmp_path lives under a deep auto-generated dir.
        logger.info(
            "[cli] %s invocation=%d exit=%d cfg=%s status=%s stdout=%s",
            identifier,
            n,
            result.returncode,
            cfg_path,
            status_path,
            stdout_path,
        )

        if result.returncode != 0:
            raise CliExecutionError(
                exit_code=result.returncode,
                stderr=result.stderr,
                stdout=result.stdout,
                config_path=cfg_path,
                status_path=status_path,
                command=command,
                step_failures_summary=_summarize_step_failures(status_path),
            )

        # Defensive: CLI reported success but wrote no status file — something
        # broke between workflow completion and file emission (e.g., a future
        # BaseWorkflow.write_status_file regression).
        if not status_path.exists():
            raise CliExecutionError(
                exit_code=0,
                stderr=(f"CLI exited 0 but no status file was written at {status_path}."),
                stdout=result.stdout,
                config_path=cfg_path,
                status_path=status_path,
                command=command,
            )

        return Status.from_json(status_path)


def _coerce_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value)
