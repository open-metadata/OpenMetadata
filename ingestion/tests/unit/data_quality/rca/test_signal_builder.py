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

"""
Unit tests for SignalBuilder.

All tests are pure Python — no database, no server, no filesystem.
TableData, TestCase, and TestCaseResult are constructed directly from
their generated Pydantic models where possible; MagicMock(spec=...) is
used as a fallback for deeply-nested entities.
"""

from unittest.mock import MagicMock
from uuid import UUID

import pytest

from metadata.data_quality.api.models import TestCaseResultResponse
from metadata.data_quality.rca.signal_builder import SignalBuilder
from metadata.generated.schema.entity.data.table import TableData
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.entityReference import EntityReference


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_entity_ref(name: str = "test_suite", ref_type: str = "testSuite") -> EntityReference:
    """Create a minimal EntityReference sufficient for TestCase construction."""
    return EntityReference(
        id=str(UUID(int=hash(name) % (10**10))),
        type=ref_type,
        name=name,
    )


def _make_test_case(
    name: str = "order_amount_range_check",
    param_values: list | None = None,
    enable_rca: bool = False,
) -> MagicMock:
    """
    Build a plain MagicMock impersonating a TestCase.

    We deliberately avoid spec=TestCase because:
    1. The generated Python class does NOT yet have enableRcaAnalysis
       (code generation not yet run post-schema change).
    2. spec= would block setting any attribute absent from the class,
       including testDefinition sub-attributes.
    Plain MagicMock() lets us configure exactly the fields SignalBuilder
    will read, which is all we care about here.
    """
    tc = MagicMock()
    tc.name = name
    tc.entityLink = "<#E::table::mydb.public.orders::columns::amount>"
    tc.parameterValues = param_values or []
    tc.enableRcaAnalysis = enable_rca
    # testDefinition.name gives the test type string read by SignalBuilder
    tc.testDefinition.name = "columnValuesToBeBetween"
    return tc


def _make_test_case_result(
    status: TestCaseStatus = TestCaseStatus.Failed,
    result_msg: str = "42 values out of range [0, 100]",
    failed_rows: int | None = 42,
    passed_rows: int | None = 958,
    failed_pct: float | None = 4.2,
) -> TestCaseResult:
    """Construct a real TestCaseResult entity."""
    return TestCaseResult(
        timestamp=1_700_000_000_000,
        testCaseStatus=status,
        result=result_msg,
        failedRows=failed_rows,
        passedRows=passed_rows,
        failedRowsPercentage=failed_pct,
    )


def _make_table_data(n_rows: int = 3) -> TableData:
    """Construct a TableData with two columns and n_rows of fake data."""
    return TableData(
        columns=["amount", "order_id"],
        rows=[[-5 * (i + 1), 1000 + i] for i in range(n_rows)],
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestSignalBuilderFullResponse:
    """Tests for SignalBuilder.build() with a fully-populated response."""

    @pytest.fixture
    def full_response(self) -> MagicMock:
        """
        Return a MagicMock response with all diagnostic fields set.

        We use MagicMock instead of real TestCaseResultResponse because
        TestCaseResultResponse(testCase=MagicMock()) fails Pydantic validation
        (testCase must be a real TestCase instance). SignalBuilder only reads
        attributes via getattr, so a MagicMock is a perfectly valid input.
        """
        param_values = [
            TestCaseParameterValue(name="minValue", value="0"),
            TestCaseParameterValue(name="maxValue", value="100"),
        ]
        test_case = _make_test_case(
            name="order_amount_range_check",
            param_values=param_values,
            enable_rca=True,
        )
        test_result = _make_test_case_result()
        table_data = _make_table_data(n_rows=3)

        response = MagicMock()
        response.testCase = test_case
        response.testCaseResult = test_result
        response.failedRowsSample = table_data
        response.inspectionQuery = "SELECT * FROM orders WHERE amount < 0"
        return response

    def test_build_returns_correct_test_name(self, full_response):
        """SignalBuilder should extract the test case name verbatim."""
        signal = SignalBuilder.build(full_response)
        assert signal["test_name"] == "order_amount_range_check"

    def test_build_returns_correct_failed_rows(self, full_response):
        """SignalBuilder should forward failedRows from TestCaseResult."""
        signal = SignalBuilder.build(full_response)
        assert signal["failed_rows"] == 42

    def test_build_returns_inspection_sql(self, full_response):
        """SignalBuilder should forward the raw inspectionQuery string."""
        signal = SignalBuilder.build(full_response)
        assert signal["inspection_sql"] == "SELECT * FROM orders WHERE amount < 0"

    def test_build_returns_sample_rows(self, full_response):
        """SignalBuilder should return up to 5 sample rows as list of dicts."""
        signal = SignalBuilder.build(full_response)
        samples = signal["sample_failing_values"]
        assert isinstance(samples, list)
        assert len(samples) <= 5
        assert len(samples) == 3  # our fixture has 3 rows
        # Every item should be a dict (column_repr → value).
        # Column keys may be raw strings or FullyQualifiedEntityName wrappers,
        # so we check the string representation contains the column name.
        for row in samples:
            assert isinstance(row, dict)
            keys_str = " ".join(str(k) for k in row.keys())
            assert "amount" in keys_str
            assert "order_id" in keys_str

    def test_build_returns_parameters_as_dict(self, full_response):
        """SignalBuilder should convert parameterValues list to a flat dict."""
        signal = SignalBuilder.build(full_response)
        params = signal["parameters"]
        assert isinstance(params, dict)
        assert "minValue" in params
        assert "maxValue" in params
        assert params["minValue"] == "0"
        assert params["maxValue"] == "100"

    def test_build_has_no_missing_keys(self, full_response):
        """All expected top-level keys must be present in the returned signal."""
        signal = SignalBuilder.build(full_response)
        expected_keys = {
            "test_name", "test_type", "entity_link", "result_message",
            "failed_rows", "passed_rows", "failed_pct", "parameters",
            "sample_failing_values", "inspection_sql", "dimension_failures",
        }
        assert expected_keys.issubset(signal.keys()), (
            f"Missing keys: {expected_keys - signal.keys()}"
        )


class TestSignalBuilderMinimalResponse:
    """Tests for SignalBuilder.build() with minimal / sparse input."""

    @pytest.fixture
    def minimal_response(self) -> MagicMock:
        """
        Return a MagicMock response with all optional fields absent.

        Same reasoning as full_response — MagicMock bypasses Pydantic
        validation while letting SignalBuilder read all attributes normally.
        """
        test_case = _make_test_case(param_values=[])
        test_result = _make_test_case_result(failed_rows=None, passed_rows=None, failed_pct=None)

        response = MagicMock()
        response.testCase = test_case
        response.testCaseResult = test_result
        response.failedRowsSample = None
        response.inspectionQuery = None
        return response

    def test_build_returns_empty_samples_when_no_failed_rows(self, minimal_response):
        """When failedRowsSample is None, sample_failing_values must be []."""
        signal = SignalBuilder.build(minimal_response)
        assert signal["sample_failing_values"] == []

    def test_build_returns_empty_sql_when_no_inspection_query(self, minimal_response):
        """When inspectionQuery is None, inspection_sql must be empty string."""
        signal = SignalBuilder.build(minimal_response)
        assert signal["inspection_sql"] == ""

    def test_build_returns_empty_parameters_when_none(self, minimal_response):
        """When parameterValues is empty, parameters must be {}."""
        signal = SignalBuilder.build(minimal_response)
        assert signal["parameters"] == {}

    def test_build_failed_rows_is_none_when_not_set(self, minimal_response):
        """When failedRows is unset, failed_rows should be None (not raise)."""
        signal = SignalBuilder.build(minimal_response)
        assert signal["failed_rows"] is None

    def test_minimal_build_does_not_raise(self, minimal_response):
        """Building a signal from a minimal response must not raise."""
        try:
            signal = SignalBuilder.build(minimal_response)
        except Exception as exc:  # pragma: no cover
            pytest.fail(f"SignalBuilder.build() raised unexpectedly: {exc}")
        assert isinstance(signal, dict)


class TestSignalBuilderNeverRaises:
    """Tests verifying SignalBuilder is resilient to completely broken input."""

    def test_build_with_magicmock_does_not_raise(self):
        """
        SignalBuilder.build() must return a dict even when given a totally
        malformed MagicMock response — all guards and getattr calls must be
        None-safe.
        """
        mock_response = MagicMock()
        try:
            result = SignalBuilder.build(mock_response)
        except Exception as exc:  # pragma: no cover
            pytest.fail(f"SignalBuilder.build() raised with MagicMock input: {exc}")
        assert isinstance(result, dict)

    def test_parse_sample_rows_with_none_returns_empty(self):
        """_parse_sample_rows(None) must return [] without raising."""
        result = SignalBuilder._parse_sample_rows(None)
        assert result == []

    def test_parse_sample_rows_respects_max_rows(self):
        """_parse_sample_rows must return at most max_rows items."""
        table_data = _make_table_data(n_rows=10)
        result = SignalBuilder._parse_sample_rows(table_data, max_rows=3)
        assert len(result) == 3

    def test_parse_sample_rows_returns_dicts(self):
        """_parse_sample_rows must return list of dicts, not list of lists."""
        table_data = _make_table_data(n_rows=2)
        result = SignalBuilder._parse_sample_rows(table_data, max_rows=5)
        assert all(isinstance(row, dict) for row in result)
