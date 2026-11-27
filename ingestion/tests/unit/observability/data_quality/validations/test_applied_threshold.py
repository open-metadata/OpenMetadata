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
"""
Validate the threshold snapshot a run records.

A test case can be edited between two runs, so the tolerance a verdict was taken under is part
of that verdict: the agent records it with the result rather than leaving the reader to re-read
whatever the test case says later.
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from pandas import DataFrame
from sqlalchemy import text

from metadata.data_quality.validations.column.sqlalchemy.columnValueMeanToBeBetween import (
    ColumnValueMeanToBeBetweenValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeInSet import (
    ColumnValuesToBeInSetValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeNotNull import (
    ColumnValuesToBeNotNullValidator,
)
from metadata.data_quality.validations.table.pandas.tableColumnCountToBeBetween import (
    TableColumnCountToBeBetweenValidator as PandasColumnCountValidator,
)
from metadata.data_quality.validations.table.pandas.tableRowInsertedCountToBeBetween import (
    TableRowInsertedCountToBeBetweenValidator as PandasInsertedCountValidator,
)
from metadata.data_quality.validations.table.sqlalchemy.tableColumnCountToBeBetween import (
    TableColumnCountToBeBetweenValidator as SQLColumnCountValidator,
)
from metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery import (
    TableCustomSQLQueryValidator,
)
from metadata.data_quality.validations.table.sqlalchemy.tableRowInsertedCountToBeBetween import (
    TableRowInsertedCountToBeBetweenValidator as SQLInsertedCountValidator,
)
from metadata.generated.schema.tests.basic import TestCaseStatus, ThresholdUnit
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.runner import PandasRunner

EXECUTION_DATE = int(datetime(2021, 7, 3, tzinfo=timezone.utc).timestamp() * 1000)
ENTITY_LINK_AGE = "<#E::table::service.db.users::columns::age>"


def build_test_case(parameter_values, dimension_columns=None, entity_link=ENTITY_LINK_AGE):
    return TestCase(
        name="my_test_case",
        entityLink=entity_link,
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),  # type: ignore
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),  # type: ignore
        parameterValues=parameter_values,
        dimensionColumns=list(dimension_columns) if dimension_columns else None,
        computePassedFailedRowCount=True,
    )  # type: ignore


def threshold_params(value=None, unit=None):
    params = []
    if value is not None:
        params.append(TestCaseParameterValue(name="threshold", value=str(value)))
    if unit is not None:
        params.append(TestCaseParameterValue(name="thresholdUnit", value=unit))
    return params


def run_not_null(parameter_values, null_count=30, row_count=1000):
    """A not-null run whose metrics are the ones handed in"""
    validator = ColumnValuesToBeNotNullValidator(MagicMock(), build_test_case(parameter_values), EXECUTION_DATE)
    validator.get_column = MagicMock()
    validator._run_results = MagicMock(return_value=null_count)
    validator.get_row_count = MagicMock(return_value=row_count)
    validator._run_results_and_row_count = MagicMock(
        return_value={Metrics.nullCount.name: null_count, Metrics.rowCount.name: row_count}
    )
    return validator.run_validation()


def test_a_run_records_the_tolerance_it_applied():
    """30 of 1,000 rows fail a 5% tolerance: the run passed, and says what it allowed"""
    result = run_not_null(threshold_params(5, "PERCENTAGE"))

    assert result.testCaseStatus is TestCaseStatus.Success
    assert result.failedRows == 30
    assert result.appliedThreshold.value == 5
    assert result.appliedThreshold.unit is ThresholdUnit.PERCENTAGE


def test_the_same_rows_under_a_stricter_tolerance_record_that_one():
    """The reverse direction: the same 3% of failing rows, now failing a 1% tolerance"""
    result = run_not_null(threshold_params(1, "PERCENTAGE"))

    assert result.testCaseStatus is TestCaseStatus.Failed
    assert result.failedRows == 30
    assert result.appliedThreshold.value == 1
    assert result.appliedThreshold.unit is ThresholdUnit.PERCENTAGE


def test_a_run_that_tolerated_nothing_records_that_rather_than_nothing():
    """An unset threshold is still a threshold applied: zero, and absolute"""
    result = run_not_null([])

    assert result.appliedThreshold.value == 0
    assert result.appliedThreshold.unit is ThresholdUnit.ABSOLUTE


def test_an_absolute_tolerance_records_its_unit():
    result = run_not_null(threshold_params(100, "ABSOLUTE"))

    assert result.appliedThreshold.value == 100
    assert result.appliedThreshold.unit is ThresholdUnit.ABSOLUTE


def test_an_aborted_run_applied_no_tolerance():
    validator = ColumnValuesToBeNotNullValidator(MagicMock(), build_test_case(threshold_params(5)), EXECUTION_DATE)
    validator.get_column = MagicMock(side_effect=ValueError("no such column"))

    result = validator.run_validation()

    assert result.testCaseStatus is TestCaseStatus.Aborted
    assert result.appliedThreshold is None


def test_a_threshold_that_is_not_a_tolerance_is_not_recorded_as_one():
    """`tableCustomSQLQuery` reads `threshold` as the result its query is expected to return"""
    validator = TableCustomSQLQueryValidator(
        MagicMock(),
        build_test_case(
            [
                TestCaseParameterValue(name="sqlExpression", value="SELECT 1"),
                *threshold_params(0),
            ]
        ),
        EXECUTION_DATE,
    )

    assert validator.result_applied_threshold(TestCaseStatus.Failed) is None


def test_a_statistical_run_keeps_the_bounds_it_was_configured_with():
    """The 5% tolerance widened 90-110 into 85.5-115.5; the run reports both"""
    validator = ColumnValueMeanToBeBetweenValidator(
        MagicMock(),
        build_test_case(
            [
                TestCaseParameterValue(name="minValueForMeanInCol", value="90"),
                TestCaseParameterValue(name="maxValueForMeanInCol", value="110"),
                *threshold_params(5, "PERCENTAGE"),
            ]
        ),
        EXECUTION_DATE,
    )
    validator.get_column = MagicMock()
    validator._run_results = MagicMock(return_value=87.4)

    result = validator.run_validation()

    assert (result.minBound, result.maxBound) == (pytest.approx(85.5), pytest.approx(115.5))
    assert (result.configuredMinBound, result.configuredMaxBound) == (90, 110)
    assert result.appliedThreshold.value == 5


def test_an_unset_bound_is_left_out_of_the_configured_window():
    validator = ColumnValueMeanToBeBetweenValidator(
        MagicMock(),
        build_test_case([TestCaseParameterValue(name="maxValueForMeanInCol", value="110")]),
        EXECUTION_DATE,
    )
    validator.get_column = MagicMock()
    validator._run_results = MagicMock(return_value=87.4)

    result = validator.run_validation()

    assert result.configuredMinBound is None
    assert result.configuredMaxBound == 110


def test_every_dimension_of_a_run_carries_the_run_s_threshold(create_sqlite_table):
    """A dimension is a group of the rows the run read, so it was judged by the same tolerance"""
    test_case = build_test_case(threshold_params(60, "PERCENTAGE"), dimension_columns=("name",))
    validator = ColumnValuesToBeNotNullValidator(create_sqlite_table, test_case, EXECUTION_DATE)

    result = validator.run_validation()

    assert result.dimensionResults
    assert all(dim.appliedThreshold == result.appliedThreshold for dim in result.dimensionResults)


def test_every_dimension_of_a_statistical_run_keeps_the_configured_window(create_sqlite_table):
    test_case = build_test_case(
        [
            TestCaseParameterValue(name="minValueForMeanInCol", value="27"),
            TestCaseParameterValue(name="maxValueForMeanInCol", value="33"),
            *threshold_params(2, "PERCENTAGE"),
        ],
        dimension_columns=("name",),
    )
    validator = ColumnValueMeanToBeBetweenValidator(create_sqlite_table, test_case, EXECUTION_DATE)

    result = validator.run_validation()

    assert result.dimensionResults
    assert all((dim.configuredMinBound, dim.configuredMaxBound) == (27, 33) for dim in result.dimensionResults)


@pytest.mark.parametrize(
    "parameter,configured,effective",
    [
        ("maxValueForMeanInCol", (None, 110), (None, pytest.approx(115.5))),
        ("minValueForMeanInCol", (90, None), (pytest.approx(85.5), None)),
    ],
)
def test_dimensions_preserve_one_sided_configured_bounds(create_sqlite_table, parameter, configured, effective):
    bound = next(value for value in configured if value is not None)
    test_case = build_test_case(
        [TestCaseParameterValue(name=parameter, value=str(bound)), *threshold_params(5, "PERCENTAGE")],
        dimension_columns=("name",),
    )

    result = ColumnValueMeanToBeBetweenValidator(create_sqlite_table, test_case, EXECUTION_DATE).run_validation()

    assert result.testCaseStatus is not TestCaseStatus.Aborted
    assert (result.configuredMinBound, result.configuredMaxBound) == configured
    assert result.dimensionResults
    for dimension in result.dimensionResults:
        assert (dimension.minBound, dimension.maxBound) == effective
        assert (dimension.configuredMinBound, dimension.configuredMaxBound) == configured


@pytest.mark.parametrize("match_enum", [True, False, None])
def test_in_set_records_whether_the_run_applied_a_tolerance(create_sqlite_table, match_enum):
    params = [TestCaseParameterValue(name="allowedValues", value="[30]"), *threshold_params(5, "PERCENTAGE")]
    if match_enum is not None:
        params.append(TestCaseParameterValue(name="matchEnum", value=str(match_enum).lower()))
    test_case = build_test_case(params, dimension_columns=("name",))

    result = ColumnValuesToBeInSetValidator(create_sqlite_table, test_case, EXECUTION_DATE).run_validation()

    assert result.testCaseStatus is (TestCaseStatus.Failed if match_enum else TestCaseStatus.Success)
    assert getattr(result.appliedThreshold, "applied", None) is bool(match_enum)
    if match_enum:
        assert result.appliedThreshold.value == 5
        assert result.appliedThreshold.unit is ThresholdUnit.PERCENTAGE
    assert result.dimensionResults
    assert all(dimension.appliedThreshold == result.appliedThreshold for dimension in result.dimensionResults)


@pytest.mark.parametrize("backend", ["sqlalchemy", "pandas"])
@pytest.mark.parametrize("count_kind", ["columns", "inserted_rows"])
@pytest.mark.parametrize(
    "configured,threshold,unit,effective,status",
    [
        ((9, 10), 20, "PERCENTAGE", (pytest.approx(7.2), 12), TestCaseStatus.Success),
        ((9, 10), 0, "ABSOLUTE", (9, 10), TestCaseStatus.Failed),
        ((None, 10), 1, "ABSOLUTE", (None, 11), TestCaseStatus.Success),
        ((12, None), 20, "PERCENTAGE", (pytest.approx(9.6), None), TestCaseStatus.Success),
    ],
)
def test_table_count_runs_preserve_configured_and_effective_bounds(
    request, backend, count_kind, configured, threshold, unit, effective, status
):
    if backend == "sqlalchemy":
        runner = request.getfixturevalue("create_sqlite_table")
        runner.session.execute(text("DELETE FROM users WHERE id > 11"))
        runner.session.commit()
        validator_class = SQLColumnCountValidator if count_kind == "columns" else SQLInsertedCountValidator
    else:
        data = {f"column_{index}": list(range(11)) for index in range(10)}
        data["inserted_date"] = [int(datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"))] * 11
        runner = PandasRunner.from_dataframe(DataFrame(data))
        validator_class = PandasColumnCountValidator if count_kind == "columns" else PandasInsertedCountValidator

    min_param, max_param = ("minColValue", "maxColValue") if count_kind == "columns" else ("min", "max")
    params = [
        TestCaseParameterValue(name=name, value=str(bound))
        for name, bound in zip((min_param, max_param), configured, strict=True)
        if bound is not None
    ]
    params.extend(threshold_params(threshold, unit))
    if count_kind == "inserted_rows":
        params.extend(
            [
                TestCaseParameterValue(name="columnName", value="inserted_date"),
                TestCaseParameterValue(name="rangeType", value="DAY"),
                TestCaseParameterValue(name="rangeInterval", value="365"),
            ]
        )
    test_case = build_test_case(params, entity_link="<#E::table::service.db.users>")

    result = validator_class(runner, test_case, EXECUTION_DATE).run_validation()

    assert result.testCaseStatus is status
    assert result.testResultValue[0].value == "11"
    assert (result.minBound, result.maxBound) == effective
    assert (result.configuredMinBound, result.configuredMaxBound) == configured
    assert result.appliedThreshold.value == threshold
    assert result.appliedThreshold.unit is ThresholdUnit(unit)
