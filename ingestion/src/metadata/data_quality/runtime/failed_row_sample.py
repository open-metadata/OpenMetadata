#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Failed-row sample policy types and dispatch handler.

A `FailedRowPolicy` is a value object declared by every concrete
`BaseTestValidator` subclass. It is either `CollectFailedRows(...)` — opt in to
sampling — or `SkipFailedRows(reason=...)` — opt out with documented rationale.

`FailedRowSampleHandler.apply` evaluates the policy together with universal
default gates (consent, status) plus validator-specific extra gates. When all
gates pass, the handler invokes the fetcher and attaches the result to
`TestCaseResultResponse`.

Validators never call the handler directly — `TestSuiteInterface.run_test_case`
dispatches once per test execution.
"""

from __future__ import annotations

import traceback
from collections.abc import Callable  # noqa: TC003
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Optional, Protocol, Union, runtime_checkable

from metadata.data_quality.api.models import TestCaseResultResponse  # noqa: TC001
from metadata.generated.schema.entity.data.table import TableData  # noqa: TC001
from metadata.generated.schema.tests.testCase import TestCase  # noqa: TC001
from metadata.utils.logger import test_suite_logger

if TYPE_CHECKING:
    from metadata.data_quality.runtime.gates import FailedRowGate

logger = test_suite_logger()


@dataclass(frozen=True)
class FailedSampleContext:
    """Inputs available to fetchers, providers, and gates during dispatch."""

    test_case: TestCase
    runner: Any
    result: TestCaseResultResponse
    validator: Any


@runtime_checkable
class FailedRowFetcher(Protocol):
    """Returns a sample of failed rows, or None when no sample is available."""

    def __call__(self, ctx: FailedSampleContext) -> Optional[TableData]: ...  # noqa: UP045


@runtime_checkable
class InspectionQueryProvider(Protocol):
    """Returns the inspection query for the failed sample, when applicable."""

    def __call__(self, ctx: FailedSampleContext) -> Optional[str]: ...  # noqa: UP045


@dataclass(frozen=True)
class CollectFailedRows:
    """Opt-in policy: fetch failed rows when gates pass.

    `extra_gates` lets a validator add validator-specific gates (e.g. a
    strategy check on tableCustomSQLQuery) on top of the handler's universal
    default gates.
    """

    fetcher: FailedRowFetcher
    inspection_query: Optional[InspectionQueryProvider] = None  # noqa: UP045
    extra_gates: tuple[FailedRowGate, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class SkipFailedRows:
    """Opt-out policy: never collect failed-row samples for this validator."""

    reason: str


FailedRowPolicy = Union[CollectFailedRows, SkipFailedRows]  # noqa: UP007


def fetch_via_validator(ctx: FailedSampleContext) -> Optional[TableData]:  # noqa: UP045
    """Default fetcher — delegates to `validator.fetch_failed_rows_sample()`."""
    return ctx.validator.fetch_failed_rows_sample()


def inspection_query_via_validator(ctx: FailedSampleContext) -> Optional[str]:  # noqa: UP045
    """Default inspection-query provider — delegates to `validator.get_inspection_query()`."""
    return ctx.validator.get_inspection_query()


def _safe_call(fn: Callable[[FailedSampleContext], Any], ctx: FailedSampleContext) -> Any:
    try:
        return fn(ctx)
    except Exception:
        logger.debug(traceback.format_exc())
        logger.error("Failed-row sample provider raised; skipping attachment")
        return None


class FailedRowSampleHandler:
    """Dispatches failed-row sampling per test execution.

    Universal default gates (consent, status, future global toggle) are passed
    at construction. Validator-specific `extra_gates` ride along on
    `CollectFailedRows`. Adding a new universal concern means one tuple
    addition at the construction site — validator code never changes.
    """

    def __init__(self, *, default_gates: tuple[FailedRowGate, ...]) -> None:
        self._default_gates = default_gates

    def apply(self, ctx: FailedSampleContext) -> None:
        policy = ctx.validator.failed_row_policy
        match policy:
            case SkipFailedRows():
                return
            case CollectFailedRows():
                self._collect(policy, ctx)

    def _collect(self, policy: CollectFailedRows, ctx: FailedSampleContext) -> None:
        all_gates = self._default_gates + policy.extra_gates
        if not all(gate.allows(ctx) for gate in all_gates):
            return

        ctx.result.failedRowsSample = _safe_call(policy.fetcher, ctx)
        if policy.inspection_query is not None:
            ctx.result.inspectionQuery = _safe_call(policy.inspection_query, ctx)
