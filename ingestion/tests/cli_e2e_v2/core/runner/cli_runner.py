#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Runs the metadata CLI in a subprocess and returns a parsed Status.

Function-scoped — one CliRunner per pytest test, bound to that test's
tmp_path. Each .run() invocation writes its own numbered config YAML and
status JSON so multiple runs within a single test (e.g., ingest → profile)
keep distinct artifacts. Artifacts survive test teardown when pytest
preserves tmp_path (default: last 3 sessions under --basetemp).
"""

from __future__ import annotations

import subprocess
from pathlib import Path

from tests.cli_e2e_v2.core.config.builder import WorkflowConfig
from tests.cli_e2e_v2.core.runner.errors import CliExecutionError
from tests.cli_e2e_v2.core.runner.status import Status


class CliRunner:
    """Runs `metadata <subcommand>` via subprocess and returns a typed Status.

    Usage:
        runner = CliRunner(tmp_path)
        status = runner.run(cfg)                 # ingest
        status2 = runner.run(cfg.as_profiler())  # profile (separate artifacts)
    """

    def __init__(self, tmp_path: Path) -> None:
        self.tmp_path = tmp_path
        self._invocation_counter: dict[str, int] = {}

    def run(self, config: WorkflowConfig) -> Status:
        pipeline = config.pipeline_type
        n = self._invocation_counter.get(pipeline, 0)
        self._invocation_counter[pipeline] = n + 1

        cfg_path = config.write_tmp(self.tmp_path, invocation=n)
        status_path = self.tmp_path / f"status_{pipeline}_{n}.json"

        command = [
            "metadata",
            config.cli_subcommand,
            "-c",
            str(cfg_path),
            "--status-file",
            str(status_path),
        ]

        result = subprocess.run(command, capture_output=True, text=True)

        if result.returncode != 0:
            raise CliExecutionError(
                exit_code=result.returncode,
                stderr=result.stderr,
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
                    f"CLI exited 0 but no status file was written at {status_path}.\n"
                    f"stdout:\n{result.stdout}\n"
                    f"stderr:\n{result.stderr}"
                ),
                config_path=cfg_path,
                command=command,
            )

        return Status.from_json(status_path)
