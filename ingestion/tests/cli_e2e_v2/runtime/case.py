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
"""Run a workflow once, then check fresh persisted observations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Generic, TypeVar

from . import expect

if TYPE_CHECKING:
    from collections.abc import Callable

    from .cli import CliRunner, RunResult, WorkflowInvocation
    from .expect import Query

T = TypeVar("T")


@dataclass(frozen=True)
class WorkflowCase(Generic[T]):
    invocation: WorkflowInvocation
    persisted: Query[T]
    check: Callable[[T], None]


def run_and_check(
    cli: CliRunner,
    case: WorkflowCase[T],
    *,
    expected_exit: int = 0,
    expected_success: bool = True,
    expected_errors: int = 0,
    poll_timeout: float = 30,
) -> RunResult:
    result = cli.run(
        case.invocation, expected_exit=expected_exit, expected_success=expected_success, expected_errors=expected_errors
    )
    expect.poll(case.persisted, timeout=poll_timeout).satisfies(case.check)
    return result
