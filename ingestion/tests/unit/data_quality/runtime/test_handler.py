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

"""Unit tests for FailedRowSampleHandler dispatch logic.

Verifies that the handler honors policy variants (Skip vs Collect), evaluates
default + extra gates in conjunction, swallows fetcher exceptions, and
attaches the result on `TestCaseResultResponse`.
"""

from dataclasses import dataclass
from typing import ClassVar
from unittest.mock import MagicMock

from metadata.data_quality.api.models import TestCaseResultResponse
from metadata.data_quality.runtime.failed_row_sample import (
    CollectFailedRows,
    FailedRowSampleHandler,
    FailedSampleContext,
    SkipFailedRows,
)
from metadata.generated.schema.entity.data.table import TableData
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus


@dataclass(frozen=True)
class _AlwaysAllow:
    name: ClassVar[str] = "always_allow"

    def allows(self, ctx: FailedSampleContext) -> bool:
        return True


@dataclass(frozen=True)
class _AlwaysDeny:
    name: ClassVar[str] = "always_deny"

    def allows(self, ctx: FailedSampleContext) -> bool:
        return False


def _make_ctx(policy, status=TestCaseStatus.Failed):
    validator = MagicMock()
    validator.failed_row_policy = policy
    response = MagicMock(spec=TestCaseResultResponse)
    response.failedRowsSample = None
    response.inspectionQuery = None
    response.testCaseResult = MagicMock(spec=TestCaseResult)
    response.testCaseResult.testCaseStatus = status
    return FailedSampleContext(
        test_case=MagicMock(computePassedFailedRowCount=True),
        runner=MagicMock(),
        result=response,
        validator=validator,
    )


class TestSkipFailedRows:
    def test_skip_policy_never_invokes_fetcher(self):
        fetcher = MagicMock()
        handler = FailedRowSampleHandler(default_gates=(_AlwaysAllow(),))
        ctx = _make_ctx(SkipFailedRows(reason="row-count test"))

        handler.apply(ctx)

        fetcher.assert_not_called()
        assert ctx.result.failedRowsSample is None
        assert ctx.result.inspectionQuery is None

    def test_skip_policy_ignores_gates_entirely(self):
        handler = FailedRowSampleHandler(default_gates=(_AlwaysAllow(),))
        ctx = _make_ctx(SkipFailedRows(reason="not applicable"))

        handler.apply(ctx)

        assert ctx.result.failedRowsSample is None


class TestCollectFailedRowsGates:
    def test_default_gates_all_pass_invokes_fetcher(self):
        sample = TableData(columns=["a"], rows=[["1"]])
        fetcher = MagicMock(return_value=sample)
        handler = FailedRowSampleHandler(default_gates=(_AlwaysAllow(),))
        ctx = _make_ctx(CollectFailedRows(fetcher=fetcher))

        handler.apply(ctx)

        fetcher.assert_called_once_with(ctx)
        assert ctx.result.failedRowsSample == sample

    def test_any_default_gate_denies_skips_fetcher(self):
        fetcher = MagicMock()
        handler = FailedRowSampleHandler(default_gates=(_AlwaysAllow(), _AlwaysDeny()))
        ctx = _make_ctx(CollectFailedRows(fetcher=fetcher))

        handler.apply(ctx)

        fetcher.assert_not_called()
        assert ctx.result.failedRowsSample is None

    def test_extra_gate_denies_skips_fetcher(self):
        fetcher = MagicMock()
        handler = FailedRowSampleHandler(default_gates=(_AlwaysAllow(),))
        ctx = _make_ctx(CollectFailedRows(fetcher=fetcher, extra_gates=(_AlwaysDeny(),)))

        handler.apply(ctx)

        fetcher.assert_not_called()

    def test_extra_gates_combine_with_default_gates(self):
        sample = TableData(columns=["a"], rows=[["1"]])
        fetcher = MagicMock(return_value=sample)
        handler = FailedRowSampleHandler(default_gates=(_AlwaysAllow(),))
        ctx = _make_ctx(CollectFailedRows(fetcher=fetcher, extra_gates=(_AlwaysAllow(),)))

        handler.apply(ctx)

        assert ctx.result.failedRowsSample == sample


class TestInspectionQuery:
    def test_inspection_query_attached_when_provided(self):
        sample = TableData(columns=["a"], rows=[["1"]])
        fetcher = MagicMock(return_value=sample)
        provider = MagicMock(return_value="SELECT 1")
        handler = FailedRowSampleHandler(default_gates=(_AlwaysAllow(),))
        ctx = _make_ctx(CollectFailedRows(fetcher=fetcher, inspection_query=provider))

        handler.apply(ctx)

        assert ctx.result.inspectionQuery == "SELECT 1"

    def test_inspection_query_skipped_when_none(self):
        fetcher = MagicMock(return_value=TableData(columns=[], rows=[]))
        handler = FailedRowSampleHandler(default_gates=(_AlwaysAllow(),))
        ctx = _make_ctx(CollectFailedRows(fetcher=fetcher, inspection_query=None))

        handler.apply(ctx)

        assert ctx.result.inspectionQuery is None


class TestExceptionSafety:
    def test_fetcher_exception_swallowed(self):
        fetcher = MagicMock(side_effect=RuntimeError("boom"))
        handler = FailedRowSampleHandler(default_gates=(_AlwaysAllow(),))
        ctx = _make_ctx(CollectFailedRows(fetcher=fetcher))

        handler.apply(ctx)

        assert ctx.result.failedRowsSample is None

    def test_inspection_provider_exception_swallowed(self):
        sample = TableData(columns=["a"], rows=[["1"]])
        fetcher = MagicMock(return_value=sample)
        provider = MagicMock(side_effect=RuntimeError("boom"))
        handler = FailedRowSampleHandler(default_gates=(_AlwaysAllow(),))
        ctx = _make_ctx(CollectFailedRows(fetcher=fetcher, inspection_query=provider))

        handler.apply(ctx)

        assert ctx.result.failedRowsSample == sample
        assert ctx.result.inspectionQuery is None
