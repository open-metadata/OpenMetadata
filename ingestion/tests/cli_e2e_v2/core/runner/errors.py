#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Errors raised by the CLI runner and baseline layers.

`E2ESetupError` is the shared base for any exception that signals
"the test couldn't run" (CLI failure, source baseline drift in
check_only mode, JWT mint failure). It inherits `Exception` — NOT
`AssertionError` — so pytest reports these as test errors (E) rather
than test failures (F). Assertion failures (`StructuralMismatch` in
`core/expected/differ.py`) keep the `AssertionError` lineage so pytest
renders their diffs with introspection.

Two-category rule:
  - E2ESetupError (→ Exception)  : infrastructure couldn't complete → E
  - AssertionError               : test assertion failed → F

Downstream code that wants to catch any setup failure (e.g. a retry
wrapper, a diagnostic collector) imports E2ESetupError rather than
enumerating the concrete subclasses.
"""

from __future__ import annotations

from pathlib import Path


class E2ESetupError(Exception):
    """Base for setup-phase failures — the test couldn't run as intended.

    Subclassed by every exception that signals infrastructure trouble:
    CLI subprocess failure, source-baseline drift, JWT mint failure.
    """


class CliExecutionError(E2ESetupError):
    """Raised when `metadata` CLI subprocess exits with a non-zero code OR
    times out OR completes successfully without writing a status file.

    Carries full diagnostic context so pytest's default failure rendering
    surfaces everything a developer needs for post-mortem:
      - exit_code:   subprocess return code (-1 for a timeout)
      - stderr:      complete captured stderr
      - stdout:      complete captured stdout (often carries step-level
                     progress logs the CLI doesn't persist elsewhere)
      - config_path: rendered YAML location — survives test teardown via
                     pytest's tmp_path
      - status_path: path where the status JSON was expected to land —
                     included even when the file wasn't written so a
                     developer can inspect the (existing or missing) file
                     directly from the failure message
      - command:     full argv of the subprocess
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
        # Surface extracted step failures above the raw stdout/stderr dump so
        # a developer scanning the exception sees the actionable content
        # first — the wall of capture logs is still below for deep dives.
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


class SourceBaselineDrift(E2ESetupError):
    """Raised by `ensure_baseline` when source state does not match the declared
    baseline in check_only mode.

    Cloud sources default to check_only so we never mutate shared resources; when
    drift is detected, the test setup fails loudly with operator instructions
    rather than silently diverging.
    """
