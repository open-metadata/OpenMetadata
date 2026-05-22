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

"""Unit tests for individual failed-row gates.

Each gate is a small value object with a single boolean predicate. These
tests pin the gate semantics so the handler's compositional behavior is
predictable.
"""

from unittest.mock import MagicMock

from metadata.data_quality.api.models import TestCaseResultResponse
from metadata.data_quality.runtime.failed_row_sample import FailedSampleContext
from metadata.data_quality.runtime.gates import (
    ConsentMustBeGiven,
    StatusMustBeFailed,
    StrategyMustBeRows,
)
from metadata.data_quality.validations.table.base.tableCustomSQLQuery import Strategy
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus


def _make_ctx(*, compute_flag=True, status=TestCaseStatus.Failed, strategy=Strategy.ROWS):
    test_case = MagicMock()
    test_case.computePassedFailedRowCount = compute_flag

    response = MagicMock(spec=TestCaseResultResponse)
    response.testCaseResult = MagicMock(spec=TestCaseResult)
    response.testCaseResult.testCaseStatus = status

    validator = MagicMock()
    validator._get_strategy.return_value = strategy

    return FailedSampleContext(
        test_case=test_case,
        runner=MagicMock(),
        result=response,
        validator=validator,
    )


class TestConsentMustBeGiven:
    def test_allows_when_flag_true(self):
        assert ConsentMustBeGiven().allows(_make_ctx(compute_flag=True)) is True

    def test_denies_when_flag_false(self):
        assert ConsentMustBeGiven().allows(_make_ctx(compute_flag=False)) is False

    def test_denies_when_flag_none(self):
        assert ConsentMustBeGiven().allows(_make_ctx(compute_flag=None)) is False

    def test_denies_when_attr_missing(self):
        ctx = _make_ctx()
        del ctx.test_case.computePassedFailedRowCount
        ctx.test_case.computePassedFailedRowCount = None
        assert ConsentMustBeGiven().allows(ctx) is False


class TestStatusMustBeFailed:
    def test_allows_when_failed(self):
        assert StatusMustBeFailed().allows(_make_ctx(status=TestCaseStatus.Failed)) is True

    def test_denies_when_success(self):
        assert StatusMustBeFailed().allows(_make_ctx(status=TestCaseStatus.Success)) is False

    def test_denies_when_aborted(self):
        assert StatusMustBeFailed().allows(_make_ctx(status=TestCaseStatus.Aborted)) is False


class TestStrategyMustBeRows:
    def test_allows_when_rows(self):
        assert StrategyMustBeRows().allows(_make_ctx(strategy=Strategy.ROWS)) is True

    def test_denies_when_count(self):
        assert StrategyMustBeRows().allows(_make_ctx(strategy=Strategy.COUNT)) is False


class TestGateName:
    def test_each_gate_exposes_stable_name(self):
        assert ConsentMustBeGiven.name == "consent_must_be_given"
        assert StatusMustBeFailed.name == "status_must_be_failed"
        assert StrategyMustBeRows.name == "strategy_must_be_rows"
