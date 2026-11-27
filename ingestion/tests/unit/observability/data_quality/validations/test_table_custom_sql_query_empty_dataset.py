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

"""``tableCustomSQLQuery`` on an empty dataset (pandas-based connectors).

A pandas-sourced dataset can legitimately be empty -- an empty file, a partition
filter that matches no rows -- and the validator must resolve the test case
(Success or Failed) rather than aborting with a ``TypeError``.  The crash used
to happen because the pandas ``compute_row_count`` collapsed a real ``0`` into
``None``, and the base flow then subtracted ``None`` in the ``<``/``<=``/``==``
branches without guarding.
"""

from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from pandas import DataFrame

from metadata.data_quality.validations.table.pandas.tableCustomSQLQuery import (
    TableCustomSQLQueryValidator,
)
from metadata.generated.schema.tests.basic import TestCaseStatus

EXECUTION_DATE = int(datetime.now(timezone.utc).timestamp())

# A query that matches no rows on the three-row DataFrame.
NO_ROWS = "a > 100"
# A query that matches all three rows on the three-row DataFrame.
ALL_ROWS = "a > 0"

EMPTY_DF = DataFrame({"a": []})
THREE_ROW_DF = DataFrame({"a": [1, 2, 3]})


class PandasRunnerStub(list):
    """Iterable of DataFrames, as the validators receive from the sampler."""

    def __call__(self):
        return list(self)


def _param(name, value):
    """A minimal test-case parameter with ``name`` and ``value`` attributes."""
    return type("P", (), {"name": name, "value": value})()


def _build_validator(
    dataframes,
    parameter_values=None,
    compute_passed_failed_row_count=True,
):
    """Build a pandas validator with a minimal test case, as the runner does."""
    validator = TableCustomSQLQueryValidator.__new__(TableCustomSQLQueryValidator)
    validator.runner = PandasRunnerStub(dataframes)
    test_case = type(
        "TestCase",
        (),
        {
            "parameterValues": list(parameter_values or []),
            "computePassedFailedRowCount": compute_passed_failed_row_count,
            "fullyQualifiedName": "test.case",
            "dimensionColumns": None,
        },
    )()
    validator.test_case = test_case
    validator.execution_date = EXECUTION_DATE
    return validator


def _sql_params(operator, threshold, sql_expression=NO_ROWS):
    """Parameter values for a custom SQL test case with the given operator."""
    return [
        _param("sqlExpression", sql_expression),
        _param("operator", operator),
        _param("threshold", threshold),
    ]


# ---------------------------------------------------------------------------
# compute_row_count: 0 is a legitimate count, not "unavailable"
# ---------------------------------------------------------------------------


class TestComputeRowCountEmptyDataset:
    """The pandas ``compute_row_count`` must return 0 for an empty dataset, not None."""

    def test_empty_dataframe_returns_zero(self):
        validator = _build_validator([EMPTY_DF])
        assert validator.compute_row_count() == 0

    def test_partition_expression_matching_no_rows_returns_zero(self):
        validator = _build_validator(
            [THREE_ROW_DF],
            parameter_values=[_param("partitionExpression", "a > 100")],
        )
        assert validator.compute_row_count() == 0

    def test_non_empty_dataframe_returns_row_count(self):
        validator = _build_validator([THREE_ROW_DF])
        assert validator.compute_row_count() == 3

    def test_no_runner_returns_none(self):
        validator = _build_validator([THREE_ROW_DF])
        validator.runner = None
        assert validator.compute_row_count() is None

    def test_partition_expression_error_returns_none(self):
        """A genuine failure (invalid partition expression) still returns None."""
        validator = _build_validator(
            [THREE_ROW_DF],
            parameter_values=[_param("partitionExpression", "nonexistent_column > 5")],
        )
        assert validator.compute_row_count() is None


# ---------------------------------------------------------------------------
# run_validation on an empty DataFrame with computePassedFailedRowCount=True
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "operator,threshold,expected_status",
    [
        # 0 rows from the query, 0 rows in the table → row_count=0 (fixed)
        ("<", 1, TestCaseStatus.Success),
        ("<", 0, TestCaseStatus.Failed),
        ("<=", 1, TestCaseStatus.Success),
        ("<=", 0, TestCaseStatus.Success),
        ("==", 0, TestCaseStatus.Success),
        ("==", 1, TestCaseStatus.Failed),
        (">", 0, TestCaseStatus.Failed),
        (">", 1, TestCaseStatus.Failed),
        (">=", 0, TestCaseStatus.Success),
        (">=", 1, TestCaseStatus.Failed),
        ("!=", 0, TestCaseStatus.Failed),
        ("!=", 1, TestCaseStatus.Success),
    ],
)
def test_empty_dataframe_run_validation(operator, threshold, expected_status):
    """Every operator resolves (not Aborted) on a 0-row DataFrame."""
    validator = _build_validator(
        [EMPTY_DF],
        parameter_values=_sql_params(operator, threshold),
    )
    result = validator.run_validation()

    assert result.testCaseStatus == expected_status
    assert result.testCaseStatus is not TestCaseStatus.Aborted
    assert result.testResultValue[0].value == "0"


@pytest.mark.parametrize(
    "operator",
    ["<", "<=", "==", ">", ">=", "!="],
)
def test_empty_dataframe_does_not_raise_type_error(operator):
    """The previously-crashing operators (<, <=, ==) no longer raise TypeError."""
    validator = _build_validator(
        [EMPTY_DF],
        parameter_values=_sql_params(operator, 1),
    )
    # Must not raise TypeError: unsupported operand type(s) for -: 'NoneType' and 'int'
    result = validator.run_validation()
    assert result.testCaseStatus is not TestCaseStatus.Aborted


# ---------------------------------------------------------------------------
# run_validation with a partition expression matching no rows
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "operator,threshold,expected_status",
    [
        ("<", 1, TestCaseStatus.Success),
        ("<=", 1, TestCaseStatus.Success),
        ("==", 0, TestCaseStatus.Success),
        (">", 0, TestCaseStatus.Failed),
        (">=", 0, TestCaseStatus.Success),
    ],
)
def test_partition_matching_no_rows_run_validation(operator, threshold, expected_status):
    """A partition expression that matches no rows yields row_count=0, not None."""
    params = _sql_params(operator, threshold) + [_param("partitionExpression", "a > 100")]
    validator = _build_validator([THREE_ROW_DF], parameter_values=params)
    result = validator.run_validation()

    assert result.testCaseStatus == expected_status
    assert result.testCaseStatus is not TestCaseStatus.Aborted
    assert result.testResultValue[0].value == "0"


# ---------------------------------------------------------------------------
# Base-class guards: row_count=None degrades gracefully (defense-in-depth)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "operator,threshold,expected_status",
    [
        ("<", 1, TestCaseStatus.Success),
        ("<", 0, TestCaseStatus.Failed),
        ("<=", 1, TestCaseStatus.Success),
        ("<=", 0, TestCaseStatus.Success),
        ("==", 0, TestCaseStatus.Success),
        ("==", 1, TestCaseStatus.Failed),
        (">", 0, TestCaseStatus.Failed),
        (">=", 0, TestCaseStatus.Success),
        (">=", 1, TestCaseStatus.Failed),
        ("!=", 0, TestCaseStatus.Failed),
        ("!=", 1, TestCaseStatus.Success),
    ],
)
def test_none_row_count_does_not_crash(operator, threshold, expected_status):
    """When compute_row_count genuinely returns None, the base guards prevent a TypeError."""
    validator = _build_validator(
        [THREE_ROW_DF],
        parameter_values=_sql_params(operator, threshold, sql_expression=NO_ROWS),
    )
    with patch.object(
        TableCustomSQLQueryValidator,
        "compute_row_count",
        return_value=None,
    ):
        result = validator.run_validation()

    assert result.testCaseStatus == expected_status
    assert result.testCaseStatus is not TestCaseStatus.Aborted


# ---------------------------------------------------------------------------
# Regression: non-empty dataset still computes correct passed/failed rows
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "operator,threshold,sql_expression,expected_status,expected_passed,expected_failed",
    [
        # 3 rows match, 3 total → < 10: Success, passed=0, failed=3
        ("<", 10, ALL_ROWS, TestCaseStatus.Success, 0, 3),
        # 3 rows match, 3 total → == 3: Success, passed=3, failed=0
        ("==", 3, ALL_ROWS, TestCaseStatus.Success, 3, 0),
        # 3 rows match, 3 total → > 0: Success, passed=3, failed=0
        (">", 0, ALL_ROWS, TestCaseStatus.Success, 3, 0),
        # 3 rows match, 3 total → >= 3: Success, passed=3, failed=0
        (">=", 3, ALL_ROWS, TestCaseStatus.Success, 3, 0),
        # 0 rows match, 3 total → < 1: Success, passed=3, failed=0
        ("<", 1, NO_ROWS, TestCaseStatus.Success, 3, 0),
        # 0 rows match, 3 total → == 0: Success, passed=0, failed=3
        ("==", 0, NO_ROWS, TestCaseStatus.Success, 0, 3),
    ],
)
def test_non_empty_dataset_row_counts(
    operator, threshold, sql_expression, expected_status, expected_passed, expected_failed
):
    """Non-empty datasets still compute the same passed/failed rows as before."""
    validator = _build_validator(
        [THREE_ROW_DF],
        parameter_values=_sql_params(operator, threshold, sql_expression=sql_expression),
    )
    result = validator.run_validation()

    assert result.testCaseStatus == expected_status
    assert result.passedRows == expected_passed
    assert result.failedRows == expected_failed


# ---------------------------------------------------------------------------
# computePassedFailedRowCount=False: empty dataset is unaffected
# ---------------------------------------------------------------------------


def test_empty_dataframe_without_row_count_flag():
    """Without computePassedFailedRowCount, an empty dataset resolves normally."""
    validator = _build_validator(
        [EMPTY_DF],
        parameter_values=_sql_params("<", 1),
        compute_passed_failed_row_count=False,
    )
    result = validator.run_validation()

    assert result.testCaseStatus == TestCaseStatus.Success
    assert result.passedRows is None
    assert result.failedRows is None
