#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Errors raised by the CLI runner and baseline layers."""

from __future__ import annotations

from pathlib import Path


class CliExecutionError(Exception):
    """Raised when `metadata` CLI subprocess exits with a non-zero code.

    Carries full diagnostic context so pytest's default failure rendering
    surfaces everything a developer needs for post-mortem:
      - exit_code: the subprocess's return code
      - stderr:    complete captured stderr (useful when no status file got written)
      - config_path: rendered YAML location — survives test teardown via pytest's tmp_path
      - command:   full argv of the subprocess
    """

    def __init__(
        self,
        exit_code: int,
        stderr: str,
        config_path: Path,
        command: list[str],
    ) -> None:
        self.exit_code = exit_code
        self.stderr = stderr
        self.config_path = config_path
        self.command = command
        super().__init__(
            f"metadata CLI exited with code {exit_code}\n"
            f"  command: {' '.join(command)}\n"
            f"  config:  {config_path}\n"
            f"  stderr:\n{stderr}"
        )


class SourceBaselineDrift(Exception):
    """Raised by `ensure_baseline` when source state does not match the declared
    baseline in check_only mode.

    Cloud sources default to check_only so we never mutate shared resources; when
    drift is detected, the test setup fails loudly with operator instructions
    rather than silently diverging.
    """
