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

"""Unit tests for pandas and base TableCustomSQLQueryValidator on empty datasets and missing row counts."""

from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pandas as pd
import pytest

from metadata.data_quality.validations.table.pandas.tableCustomSQLQuery import (
    TableCustomSQLQueryValidator,
)
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type import basic as basic_types
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.processor.runner import PandasRunner

EXECUTION_DATE = basic_types.Timestamp(int(datetime(2026, 1, 15, tzinfo=timezone.utc).timestamp() * 1000))
ENTITY_LINK = basic_types.EntityLink("<#E::table::datalake_svc.default.events>")


def _empty_df() -> pd.DataFrame:
    return pd.DataFrame({"id": pd.Series(dtype="int64"), "val": pd.Series(dtype="float64")})


def _sample_df(rows: int = 10) -> pd.DataFrame:
    return pd.DataFrame({"id": list(range(1, rows + 1)), "val": [float(i * 10) for i in range(1, rows + 1)]})


def _make_validator(
    runner: Any,
    *,
    compute_row_count: bool = True,
    **params: str,
) -> TableCustomSQLQueryValidator:
    test_case = TestCase(
        name=basic_types.TestCaseEntityName("custom_sql_empty_dataset_test"),
        fullyQualifiedName=basic_types.FullyQualifiedEntityName(
            "datalake_svc.default.events.custom_sql_empty_dataset_test"
        ),
        entityLink=ENTITY_LINK,
        testSuite=EntityReference(id=basic_types.Uuid(uuid4()), type="TestSuite"),
        testDefinition=EntityReference(id=basic_types.Uuid(uuid4()), type="TestDefinition"),
        computePassedFailedRowCount=compute_row_count,
        parameterValues=[TestCaseParameterValue(name=k, value=v) for k, v in params.items()],
    )
    return TableCustomSQLQueryValidator(
        runner=runner,
        test_case=test_case,
        execution_date=EXECUTION_DATE,
    )


@pytest.mark.parametrize(
    ("operator", "threshold", "expected_status"),
    [
        ("<", 1, TestCaseStatus.Success),
        ("<", 0, TestCaseStatus.Failed),
        ("<=", 0, TestCaseStatus.Success),
        ("<=", -1, TestCaseStatus.Failed),
        (">", -1, TestCaseStatus.Success),
        (">", 0, TestCaseStatus.Failed),
        (">=", 0, TestCaseStatus.Success),
        (">=", 1, TestCaseStatus.Failed),
        ("==", 0, TestCaseStatus.Success),
        ("==", 5, TestCaseStatus.Failed),
        ("!=", 5, TestCaseStatus.Success),
        ("!=", 0, TestCaseStatus.Failed),
    ],
)
def test_empty_dataframe_operators_with_row_count_enabled(
    operator: str,
    threshold: int,
    expected_status: TestCaseStatus,
) -> None:
    """Issue #37312: empty pandas datasets must evaluate cleanly instead of aborting with TypeError."""
    runner = PandasRunner.from_dataframe(_empty_df())
    validator = _make_validator(
        runner,
        compute_row_count=True,
        sqlExpression="id > 0",
        operator=operator,
        threshold=str(threshold),
    )

    assert validator.compute_row_count() == 0
    assert validator._calculate_passed_failed_rows(
        expected_status == TestCaseStatus.Success,
        operator,
        threshold,
        len_rows=0,
        row_count=0,
    ) == (0, 0)

    result = validator.run_validation()

    assert result.testCaseStatus == expected_status
    assert result.errorDetails is None
    assert result.testResultValue is not None
    assert result.testResultValue[0].value == "0"
    assert result.passedRows is None
    assert result.failedRows is None


def test_partition_expression_matching_zero_rows_preserves_zero_row_count() -> None:
    runner = PandasRunner.from_dataframe(_sample_df(10))
    validator = _make_validator(
        runner,
        compute_row_count=True,
        sqlExpression="id > 999",
        operator="<=",
        threshold="0",
        partitionExpression="id > 999",
    )

    assert validator.compute_row_count() == 0

    result = validator.run_validation()

    assert result.testCaseStatus == TestCaseStatus.Success
    assert result.errorDetails is None
    assert result.testResultValue is not None
    assert result.testResultValue[0].value == "0"
    assert result.passedRows is None
    assert result.failedRows is None


def test_non_empty_dataframe_populates_passed_and_failed_rows() -> None:
    runner = PandasRunner.from_dataframe(_sample_df(10))
    validator = _make_validator(
        runner,
        compute_row_count=True,
        sqlExpression="id > 8",
        operator="<=",
        threshold="3",
    )

    result = validator.run_validation()

    assert result.testCaseStatus == TestCaseStatus.Success
    assert result.passedRows == 8
    assert result.failedRows == 2


@pytest.mark.parametrize(
    ("chunks", "expected_row_count"),
    [
        pytest.param([_empty_df(), _empty_df()], 0, id="multiple-empty-chunks"),
        pytest.param([None, _empty_df()], 0, id="none-and-empty-chunk"),
        pytest.param([_empty_df(), _sample_df(4)], 4, id="empty-and-non-empty-chunk"),
        pytest.param([], None, id="empty-runner-list"),
        pytest.param([None], None, id="single-none-chunk"),
    ],
)
def test_multi_chunk_runner_row_counts(chunks: list[pd.DataFrame | None], expected_row_count: int | None) -> None:
    validator = _make_validator(chunks, compute_row_count=True, sqlExpression="id > 0")

    assert validator.compute_row_count() == expected_row_count


def test_run_results_skips_none_chunks_and_queries_each_dataframe_once() -> None:
    df_one = _sample_df(4)
    df_two = _sample_df(6)
    validator = _make_validator([None, df_one, df_two], compute_row_count=False, sqlExpression="id > 2")

    with (
        patch.object(df_one, "query", wraps=df_one.query) as spy_one,
        patch.object(df_two, "query", wraps=df_two.query) as spy_two,
    ):
        matched_rows = validator._run_results("id > 2")

    assert matched_rows == 6
    assert spy_one.call_count == 1
    assert spy_two.call_count == 1


@pytest.mark.parametrize(
    ("operator", "threshold", "len_rows", "expected_status", "expected_split"),
    [
        ("<", 5, 2, TestCaseStatus.Success, (0, 2)),
        ("<", 2, 5, TestCaseStatus.Failed, (0, 5)),
        ("<=", 2, 2, TestCaseStatus.Success, (0, 2)),
        ("<=", 1, 3, TestCaseStatus.Failed, (0, 3)),
        ("==", 2, 2, TestCaseStatus.Success, (2, 0)),
        ("==", 5, 2, TestCaseStatus.Failed, (0, 3)),
        (">", 1, 2, TestCaseStatus.Success, (2, 0)),
        (">", 5, 2, TestCaseStatus.Failed, (2, 0)),
        (">=", 2, 2, TestCaseStatus.Success, (2, 0)),
        (">=", 5, 2, TestCaseStatus.Failed, (2, 0)),
        ("!=", 5, 2, TestCaseStatus.Success, (2, 0)),
        ("!=", 2, 2, TestCaseStatus.Failed, (0, 2)),
    ],
)
def test_unavailable_row_count_degrades_gracefully_across_operators(
    operator: str,
    threshold: int,
    len_rows: int,
    expected_status: TestCaseStatus,
    expected_split: tuple[int, int],
) -> None:
    """When row_count is None (invalid partitionExpression or [None] runner), arithmetic must not crash."""
    df = _sample_df(5)
    query = f"id <= {len_rows}"
    validator = _make_validator(
        PandasRunner.from_dataframe(df),
        compute_row_count=True,
        sqlExpression=query,
        operator=operator,
        threshold=str(threshold),
        partitionExpression="missing_col > 0",
    )

    assert validator.compute_row_count() is None
    assert (
        validator._calculate_passed_failed_rows(
            expected_status == TestCaseStatus.Success,
            operator,
            threshold,
            len_rows=len_rows,
            row_count=None,
        )
        == expected_split
    )

    result = validator.run_validation()

    assert result.testCaseStatus == expected_status
    assert result.errorDetails is None
    assert result.passedRows is None
    assert result.failedRows is None


def test_none_chunk_runner_with_row_count_enabled_does_not_abort() -> None:
    validator = _make_validator(
        [None],
        compute_row_count=True,
        sqlExpression="id > 0",
        operator="<=",
        threshold="0",
    )

    result = validator.run_validation()

    assert result.testCaseStatus == TestCaseStatus.Success
    assert result.errorDetails is None
    assert result.testResultValue is not None
    assert result.testResultValue[0].value == "0"


def test_percentage_threshold_on_empty_dataframe_computes_row_count_once() -> None:
    runner = PandasRunner.from_dataframe(_empty_df())
    validator = _make_validator(
        runner,
        compute_row_count=True,
        sqlExpression="id > 0",
        operator="<=",
        threshold="5",
        thresholdUnit="PERCENTAGE",
    )

    with patch.object(validator, "compute_row_count", wraps=validator.compute_row_count) as spy_row_count:
        result = validator.run_validation()

    assert spy_row_count.call_count == 1
    assert result.testCaseStatus == TestCaseStatus.Success
    assert result.result is not None
    assert "Found 0 row(s), 0% of the 0 row(s) counted." in result.result
    assert result.passedRows is None
    assert result.failedRows is None


def test_percentage_with_unavailable_row_count_computes_row_count_once() -> None:
    validator = _make_validator(
        [None],
        compute_row_count=True,
        sqlExpression="id > 0",
        operator="<=",
        threshold="5",
        thresholdUnit="PERCENTAGE",
    )

    with patch.object(validator, "compute_row_count", wraps=validator.compute_row_count) as spy_row_count:
        result = validator.run_validation()

    assert spy_row_count.call_count == 1
    assert result.testCaseStatus == TestCaseStatus.Success


@pytest.mark.parametrize(
    "unsafe_expr",
    [
        "__import__('os').system('echo x')",
        "id > 0 and id.__class__.__init__.__globals__",
    ],
)
def test_unsafe_sql_and_partition_expressions_are_rejected_and_abort(unsafe_expr: str) -> None:
    runner = PandasRunner.from_dataframe(_sample_df(3))

    bad_sql_validator = _make_validator(
        runner,
        compute_row_count=True,
        sqlExpression=unsafe_expr,
        operator="<=",
        threshold="0",
    )
    with pytest.raises(RuntimeError, match="Unsafe pandas query expression"):
        bad_sql_validator._run_results(unsafe_expr)
    assert bad_sql_validator.run_validation().testCaseStatus == TestCaseStatus.Aborted

    bad_partition_validator = _make_validator(
        runner,
        compute_row_count=True,
        sqlExpression="id > 0",
        operator="<=",
        threshold="5",
        partitionExpression=unsafe_expr,
    )
    with pytest.raises(RuntimeError, match="Unsafe pandas query expression"):
        bad_partition_validator.compute_row_count()
    assert bad_partition_validator.run_validation().testCaseStatus == TestCaseStatus.Aborted
