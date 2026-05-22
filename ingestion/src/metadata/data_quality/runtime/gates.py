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

"""Composable gates that guard failed-row sample collection.

Each gate is a named, individually testable value object. Universal gates
(consent, status) flow in via `FailedRowSampleHandler(default_gates=(...))` at
workflow setup. Validator-specific gates flow via `CollectFailedRows.extra_gates`.

Future gates land here as one-line tuple additions at the handler construction
site — validator code never changes.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar, Protocol, runtime_checkable

from metadata.data_quality.runtime.failed_row_sample import FailedSampleContext  # noqa: TC001
from metadata.generated.schema.tests.basic import TestCaseStatus


@runtime_checkable
class FailedRowGate(Protocol):
    """Allows a sample to be fetched iff every gate returns True."""

    name: str

    def allows(self, ctx: FailedSampleContext) -> bool: ...


@dataclass(frozen=True)
class ConsentMustBeGiven:
    """Universal default: only collect samples when the test case opts in."""

    name: ClassVar[str] = "consent_must_be_given"

    def allows(self, ctx: FailedSampleContext) -> bool:
        return bool(getattr(ctx.test_case, "computePassedFailedRowCount", False))


@dataclass(frozen=True)
class StatusMustBeFailed:
    """Universal default: only collect samples when the test failed."""

    name: ClassVar[str] = "status_must_be_failed"

    def allows(self, ctx: FailedSampleContext) -> bool:
        return ctx.result.testCaseResult.testCaseStatus == TestCaseStatus.Failed


@dataclass(frozen=True)
class StrategyMustBeRows:
    """tableCustomSQLQuery-specific: only sample when strategy is ROWS, not COUNT."""

    name: ClassVar[str] = "strategy_must_be_rows"

    def allows(self, ctx: FailedSampleContext) -> bool:
        from metadata.data_quality.validations.table.base.tableCustomSQLQuery import (  # noqa: PLC0415
            Strategy,
        )

        return ctx.validator._get_strategy() is Strategy.ROWS
