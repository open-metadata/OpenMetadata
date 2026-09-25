#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Execute workflows with inherited output and strict exit/status checks."""

from __future__ import annotations

import os
import signal
import subprocess
import uuid
from contextlib import suppress
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

import yaml

from .status import Status

if TYPE_CHECKING:
    from pathlib import Path


@dataclass(frozen=True)
class WorkflowInvocation:
    subcommand: str
    config: dict[str, Any] = field(repr=False)


@dataclass(frozen=True)
class RunResult:
    exit_code: int
    status: Status


class CliExecutionError(RuntimeError):
    """The CLI failed its execution or status contract."""


class CliRunner:
    def __init__(
        self,
        work_dir: Path,
        *,
        command: tuple[str, ...] = ("metadata",),
    ) -> None:
        self.work_dir = work_dir.resolve()
        self.command = command

    def run(
        self,
        invocation: WorkflowInvocation,
        *,
        expected_exit: int = 0,
        expected_success: bool = True,
        expected_errors: int = 0,
        timeout: float = 600,
    ) -> RunResult:
        run_dir = self.work_dir / uuid.uuid4().hex
        run_dir.mkdir(mode=0o700, parents=True)
        config_path = run_dir / "config.yaml"
        config_path.touch(mode=0o600)
        config_path.write_text(yaml.safe_dump(invocation.config, sort_keys=False), encoding="utf-8")
        status_path = run_dir / "status.json"
        command = [*self.command, invocation.subcommand, "-c", str(config_path), "--status-file", str(status_path)]
        print(f"CLI {invocation.subcommand}: starting", flush=True)
        try:
            process = subprocess.Popen(command, start_new_session=os.name == "posix")
        except OSError as error:
            raise CliExecutionError(f"Could not start CLI {invocation.subcommand}: {error}") from error
        try:
            process.wait(timeout=timeout)
        except subprocess.TimeoutExpired as error:
            raise CliExecutionError(f"CLI {invocation.subcommand} timed out after {timeout}s") from error
        finally:
            # Descendants must not outlive the CLI, including after cancellation or normal exit.
            if os.name == "posix":
                with suppress(ProcessLookupError):
                    os.killpg(process.pid, signal.SIGKILL)
            elif process.poll() is None:
                process.kill()
            exit_code = process.wait()
            if status_path.exists():
                status_path.chmod(0o600)
            print(f"CLI {invocation.subcommand}: exit={exit_code}", flush=True)

        try:
            status = Status.from_json(status_path)
        except (OSError, ValueError, KeyError, TypeError) as error:
            raise CliExecutionError(f"CLI status is missing or malformed: {status_path}; exit={exit_code}") from error
        if (
            exit_code != expected_exit
            or status.success is not expected_success
            or status.total_errors != expected_errors
        ):
            summary = []
            for failure in status.all_failures[:3]:
                lines = (failure.get("error") or "").splitlines()
                summary.append(lines[0][:500] if lines else "(no error text)")
            raise CliExecutionError(
                f"CLI exit={exit_code}, success={status.success}, errors={status.total_errors}; "
                f"expected exit={expected_exit}, success={expected_success}, errors={expected_errors}"
                + ("; failures: " + "; ".join(summary) if summary else "")
            )
        return RunResult(exit_code=exit_code, status=status)
