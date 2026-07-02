#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Errors raised by the CLI runner and baseline layers.

`E2ESetupError` (→ `Exception`) signals infrastructure failure → pytest E.
`AssertionError` signals a test assertion failure → pytest F.
Catch `E2ESetupError` to handle any setup failure without enumerating subclasses.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pathlib import Path


class E2ESetupError(Exception):
    """Base for setup-phase failures (CLI subprocess, baseline drift, JWT mint)."""


class CliExecutionError(E2ESetupError):
    """Raised on non-zero exit, timeout, or missing status file from the `metadata` CLI.

    Carries `exit_code` (-1 for timeout), `stderr`, `stdout`, `config_path`,
    `status_path`, and `command` for post-mortem.
    """

    def __init__(
        self,
        exit_code: int,
        stderr: str,
        config_path: Path,
        command: list[str],
        stdout: str = "",
        status_path: Path | None = None,
        step_failures_summary: str | None = None,
    ) -> None:
        self.exit_code = exit_code
        self.stderr = stderr
        self.stdout = stdout
        self.config_path = config_path
        self.status_path = status_path
        self.command = command
        self.step_failures_summary = step_failures_summary

        status_line = (
            f"  status:  {status_path} (exists={status_path.exists() if status_path else 'n/a'})\n"
            if status_path is not None
            else ""
        )
        failures_block = (
            f"  step failures (from status file):\n{step_failures_summary}\n" if step_failures_summary else ""
        )
        super().__init__(
            f"metadata CLI exited with code {exit_code}\n"
            f"  command: {' '.join(command)}\n"
            f"  config:  {config_path}\n"
            f"{status_line}"
            f"{failures_block}"
            f"  stdout:\n{stdout}\n"
            f"  stderr:\n{stderr}"
        )


class SourceBaselineDrift(E2ESetupError):  # noqa: N818  (intentional API surface — public exception name)
    """Raised by `ensure_baseline` when source state diverges from baseline in check_only mode."""
