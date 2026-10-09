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
Validate how dimension group verdicts roll up into the test case status.

The shared sqlite table holds 80 rows over 7 names: `Eve` (10 rows) has a null age on every row
and `John` (20 rows) on half of them, so the age column is 25% null overall. A 60% threshold
passes the aggregate and John, and fails Eve.
"""

import sqlite3
from contextlib import contextmanager
from datetime import datetime
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from sqlalchemy import event
from sqlalchemy.exc import OperationalError

from metadata.data_quality.validations import result_messages
from metadata.data_quality.validations.column.sqlalchemy.columnValueMeanToBeBetween import (
    ColumnValueMeanToBeBetweenValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeNotNull import (
    ColumnValuesToBeNotNullValidator,
)
from metadata.data_quality.validations.thresholds import DimensionFailurePolicy
from metadata.generated.schema.tests.basic import (
    DimensionValue,
    TestCaseDimensionResult,
    TestCaseResult,
    TestCaseStatus,
)
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.entityReference import EntityReference

EXECUTION_DATE = datetime.strptime("2021-07-03", "%Y-%m-%d")
ENTITY_LINK_AGE = "<#E::table::service.db.users::columns::age>"


def build_test_case(parameter_values, top_dimensions=None, dimension_columns=("name",)):
    return TestCase(
        name="my_test_case",
        entityLink=ENTITY_LINK_AGE,
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),  # type: ignore
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),  # type: ignore
        parameterValues=parameter_values,
        dimensionColumns=list(dimension_columns),
        topDimensions=top_dimensions,
        computePassedFailedRowCount=True,
    )  # type: ignore


def policy_param(policy):
    return [] if policy is None else [TestCaseParameterValue(name="dimensionFailurePolicy", value=policy)]


def not_null_within_60_percent(policy, dimension_columns=("name",)):
    return build_test_case(
        [
            TestCaseParameterValue(name="threshold", value="60"),
            TestCaseParameterValue(name="thresholdUnit", value="PERCENTAGE"),
            *policy_param(policy),
        ],
        dimension_columns=dimension_columns,
    )


def run(runner, validator_class, test_case):
    return validator_class(runner, test_case, EXECUTION_DATE.timestamp()).run_validation()


@pytest.mark.parametrize(
    "policy,expected_status",
    [
        (None, TestCaseStatus.Success),
        ("OVERALL_ONLY", TestCaseStatus.Success),
        ("ANY_DIMENSION", TestCaseStatus.Failed),
    ],
)
def test_aggregate_passes_while_one_group_breaches(create_sqlite_table, policy, expected_status):
    res = run(create_sqlite_table, ColumnValuesToBeNotNullValidator, not_null_within_60_percent(policy))

    assert res.testCaseStatus == expected_status
    assert res.failedRows == 20
    statuses = {dim.dimensionKey: dim.testCaseStatus for dim in res.dimensionResults}
    assert statuses["name=Eve"] == TestCaseStatus.Failed
    assert statuses["name=John"] == TestCaseStatus.Success


def test_any_dimension_names_the_failing_groups(create_sqlite_table):
    res = run(create_sqlite_table, ColumnValuesToBeNotNullValidator, not_null_within_60_percent("ANY_DIMENSION"))

    assert "so this test passed" in res.result
    assert "1 dimension group failed (name=Eve)" in res.result
    assert "ANY_DIMENSION" in res.result


def test_overall_only_leaves_the_result_message_alone(create_sqlite_table):
    without_policy = run(create_sqlite_table, ColumnValuesToBeNotNullValidator, not_null_within_60_percent(None))
    overall_only = run(
        create_sqlite_table, ColumnValuesToBeNotNullValidator, not_null_within_60_percent("OVERALL_ONLY")
    )

    assert overall_only.result == without_policy.result
    assert "ANY_DIMENSION" not in overall_only.result


def test_any_dimension_passes_when_every_group_passes(create_sqlite_table):
    test_case = build_test_case(
        [
            TestCaseParameterValue(name="threshold", value="100"),
            TestCaseParameterValue(name="thresholdUnit", value="PERCENTAGE"),
            *policy_param("ANY_DIMENSION"),
        ]
    )

    res = run(create_sqlite_table, ColumnValuesToBeNotNullValidator, test_case)

    assert res.testCaseStatus == TestCaseStatus.Success
    assert all(dim.testCaseStatus == TestCaseStatus.Success for dim in res.dimensionResults)


def dimension_result(value, status):
    return TestCaseDimensionResult(
        id=str(uuid4()),
        testCaseResultId=str(uuid4()),
        timestamp=int(EXECUTION_DATE.timestamp() * 1000),
        dimensionValues=[DimensionValue(name="name", value=value)],
        dimensionKey=f"name={value}",
        testCaseStatus=status,
    )


def test_others_takes_part_in_the_roll_up():
    """Groups beyond topDimensions only ever fail the test case through the Others group"""
    validator = ColumnValuesToBeNotNullValidator(
        MagicMock(), build_test_case(policy_param("ANY_DIMENSION")), EXECUTION_DATE
    )
    test_result = TestCaseResult(
        timestamp=int(EXECUTION_DATE.timestamp() * 1000),
        testCaseStatus=TestCaseStatus.Success,
        result="Overall passed.",
    )

    validator._roll_up_dimension_results(
        test_result,
        [
            dimension_result("John", TestCaseStatus.Success),
            dimension_result("Others", TestCaseStatus.Failed),
        ],
    )

    assert test_result.testCaseStatus == TestCaseStatus.Failed
    assert "(name=Others)" in test_result.result


@pytest.mark.parametrize("status", [TestCaseStatus.Aborted, TestCaseStatus.Failed])
def test_roll_up_only_ever_fails_a_passing_test_case(status):
    validator = ColumnValuesToBeNotNullValidator(
        MagicMock(), build_test_case(policy_param("ANY_DIMENSION")), EXECUTION_DATE
    )
    test_result = TestCaseResult(
        timestamp=int(EXECUTION_DATE.timestamp() * 1000), testCaseStatus=status, result="Untouched."
    )

    validator._roll_up_dimension_results(test_result, [dimension_result("Eve", TestCaseStatus.Failed)])

    assert test_result.testCaseStatus == status
    assert test_result.result == "Untouched."


@pytest.mark.parametrize(
    "parameter_values,expected",
    [
        ([], DimensionFailurePolicy.OVERALL_ONLY),
        (policy_param("OVERALL_ONLY"), DimensionFailurePolicy.OVERALL_ONLY),
        (policy_param("ANY_DIMENSION"), DimensionFailurePolicy.ANY_DIMENSION),
        (policy_param("any_dimension"), DimensionFailurePolicy.ANY_DIMENSION),
        (policy_param("EVERY_DIMENSION"), DimensionFailurePolicy.OVERALL_ONLY),
    ],
)
def test_get_dimension_failure_policy(parameter_values, expected):
    validator = ColumnValuesToBeNotNullValidator(MagicMock(), build_test_case(parameter_values), EXECUTION_DATE)

    assert validator.get_dimension_failure_policy() is expected


def test_rollup_sentence_summarises_groups_beyond_the_listed_ones():
    groups = [f"name=g{i}" for i in range(7)]

    sentence = result_messages.dimension_rollup_sentence(groups)

    assert sentence.startswith("7 dimension groups failed (name=g0, name=g1, name=g2, name=g3, name=g4 and 2 more)")


def test_dimension_results_carry_the_bounds_they_were_evaluated_against(create_sqlite_table):
    """A 10% threshold widens 30..30.55 to 27..33.605 for the aggregate and for every group"""
    test_case = build_test_case(
        [
            TestCaseParameterValue(name="minValueForMeanInCol", value="30"),
            TestCaseParameterValue(name="maxValueForMeanInCol", value="30.55"),
            TestCaseParameterValue(name="threshold", value="10"),
            TestCaseParameterValue(name="thresholdUnit", value="PERCENTAGE"),
        ]
    )

    res = run(create_sqlite_table, ColumnValueMeanToBeBetweenValidator, test_case)

    assert res.minBound == pytest.approx(27)
    assert res.maxBound == pytest.approx(33.605)
    assert res.dimensionResults
    for dim in res.dimensionResults:
        assert (dim.minBound, dim.maxBound) == (res.minBound, res.maxBound)


def test_unset_bounds_are_left_out_of_dimension_results(create_sqlite_table):
    test_case = build_test_case([TestCaseParameterValue(name="maxValueForMeanInCol", value="31")])

    res = run(create_sqlite_table, ColumnValueMeanToBeBetweenValidator, test_case)

    assert res.dimensionResults
    assert all(dim.minBound is None and dim.maxBound == 31 for dim in res.dimensionResults)


@contextmanager
def failing_grouped_queries(runner):
    """Make the database reject every grouped query, as a statement timeout would"""
    engine = runner.session.get_bind()

    def reject(conn, cursor, statement, parameters, context, executemany):
        if "GROUP BY" in statement.upper():
            raise OperationalError(statement, parameters, sqlite3.OperationalError("interrupted"))

    event.listen(engine, "before_cursor_execute", reject)
    try:
        yield
    finally:
        event.remove(engine, "before_cursor_execute", reject)


def aborted_dimensions(result):
    return [dim.dimensionKey for dim in result.dimensionResults or [] if dim.testCaseStatus == TestCaseStatus.Aborted]


@pytest.mark.parametrize("policy", ["OVERALL_ONLY", "ANY_DIMENSION"])
def test_a_failed_grouped_query_reports_an_aborted_dimension(create_sqlite_table, policy):
    """Eve breaches, but her group was never evaluated: the test case keeps the aggregate verdict"""
    with failing_grouped_queries(create_sqlite_table):
        res = run(create_sqlite_table, ColumnValuesToBeNotNullValidator, not_null_within_60_percent(policy))

    assert res.testCaseStatus == TestCaseStatus.Success
    assert aborted_dimensions(res) == ["name=(not evaluated)"]
    assert "Dimension name could not be evaluated" in res.result
    assert res.dimensionResults[0].result == "Dimension name could not be evaluated (OperationalError): interrupted"


def test_a_missing_dimension_column_reports_an_aborted_dimension(create_sqlite_table):
    res = run(
        create_sqlite_table,
        ColumnValuesToBeNotNullValidator,
        not_null_within_60_percent("ANY_DIMENSION", dimension_columns=("dropped_column",)),
    )

    assert res.testCaseStatus == TestCaseStatus.Success
    assert aborted_dimensions(res) == ["dropped_column=(not evaluated)"]
    assert "Dimension dropped_column could not be evaluated" in res.result


def test_the_other_dimension_columns_still_roll_up(create_sqlite_table):
    """One column cannot run; the one that can still fails the test case under ANY_DIMENSION"""
    res = run(
        create_sqlite_table,
        ColumnValuesToBeNotNullValidator,
        not_null_within_60_percent("ANY_DIMENSION", dimension_columns=("dropped_column", "name")),
    )

    assert res.testCaseStatus == TestCaseStatus.Failed
    assert aborted_dimensions(res) == ["dropped_column=(not evaluated)"]
    statuses = {dim.dimensionKey: dim.testCaseStatus for dim in res.dimensionResults}
    assert statuses["name=Eve"] == TestCaseStatus.Failed
    assert "1 dimension group failed (name=Eve)" in res.result
    assert "Dimension dropped_column could not be evaluated" in res.result


def test_an_evaluated_dimension_adds_nothing_to_the_message(create_sqlite_table):
    res = run(create_sqlite_table, ColumnValuesToBeNotNullValidator, not_null_within_60_percent("OVERALL_ONLY"))

    assert aborted_dimensions(res) == []
    assert "could not be evaluated" not in res.result


def not_null_within_60_percent_min_rows(min_rows, policy="ANY_DIMENSION", unit="PERCENTAGE"):
    """Eve (10 rows) is below a minimum of 15, John (20 rows) is not"""
    return build_test_case(
        [
            TestCaseParameterValue(name="threshold", value="60"),
            TestCaseParameterValue(name="thresholdUnit", value=unit),
            *policy_param(policy),
            TestCaseParameterValue(name="minRowsPerDimension", value=min_rows),
        ]
    )


def excluded_dimensions(result):
    return sorted(dim.dimensionKey for dim in result.dimensionResults or [] if dim.excludedFromRollUp)


def test_a_failing_group_below_the_minimum_does_not_fail_the_test_case(create_sqlite_table):
    res = run(create_sqlite_table, ColumnValuesToBeNotNullValidator, not_null_within_60_percent_min_rows("15"))

    assert res.testCaseStatus == TestCaseStatus.Success
    statuses = {dim.dimensionKey: dim.testCaseStatus for dim in res.dimensionResults}
    assert statuses["name=Eve"] == TestCaseStatus.Failed
    assert "name=Eve" in excluded_dimensions(res)
    assert "name=John" not in excluded_dimensions(res)
    assert "1 dimension group failed with fewer than 15 rows (name=Eve)" in res.result
    assert "so it does not fail the test case" in res.result
    assert "ANY_DIMENSION policy fails the test case" not in res.result


def test_a_failing_group_at_the_minimum_still_fails_the_test_case(create_sqlite_table):
    res = run(create_sqlite_table, ColumnValuesToBeNotNullValidator, not_null_within_60_percent_min_rows("10"))

    assert res.testCaseStatus == TestCaseStatus.Failed
    assert "name=Eve" not in excluded_dimensions(res)
    assert "1 dimension group failed (name=Eve)" in res.result


@pytest.mark.parametrize(
    "policy,unit",
    [("OVERALL_ONLY", "PERCENTAGE"), ("ANY_DIMENSION", "ABSOLUTE")],
)
def test_the_minimum_only_applies_to_a_percentage_roll_up(create_sqlite_table, policy, unit):
    """Nothing rolls up under OVERALL_ONLY, and an ABSOLUTE count is not distorted by group size"""
    res = run(
        create_sqlite_table,
        ColumnValuesToBeNotNullValidator,
        not_null_within_60_percent_min_rows("15", policy=policy, unit=unit),
    )

    assert excluded_dimensions(res) == []
    assert "fewer than 15 rows" not in res.result


@pytest.mark.parametrize("min_rows", ["0", "-5", "nan", "inf", "many"])
def test_an_unusable_minimum_rolls_every_group_up(create_sqlite_table, min_rows):
    res = run(create_sqlite_table, ColumnValuesToBeNotNullValidator, not_null_within_60_percent_min_rows(min_rows))

    assert res.testCaseStatus == TestCaseStatus.Failed
    assert excluded_dimensions(res) == []


def test_excluded_and_rolled_up_groups_are_both_named():
    validator = ColumnValuesToBeNotNullValidator(MagicMock(), not_null_within_60_percent_min_rows("15"), EXECUTION_DATE)
    test_result = TestCaseResult(
        timestamp=int(EXECUTION_DATE.timestamp() * 1000),
        testCaseStatus=TestCaseStatus.Success,
        result="Overall passed.",
    )
    small = dimension_result("Eve", TestCaseStatus.Failed)
    small.excludedFromRollUp = True

    validator._roll_up_dimension_results(test_result, [small, dimension_result("Others", TestCaseStatus.Failed)])

    assert test_result.testCaseStatus == TestCaseStatus.Failed
    assert "1 dimension group failed (name=Others)" in test_result.result
    assert "fewer than 15 rows (name=Eve)" in test_result.result


def test_an_excluded_failing_group_is_named_when_the_aggregate_already_failed():
    validator = ColumnValuesToBeNotNullValidator(MagicMock(), not_null_within_60_percent_min_rows("15"), EXECUTION_DATE)
    test_result = TestCaseResult(
        timestamp=int(EXECUTION_DATE.timestamp() * 1000),
        testCaseStatus=TestCaseStatus.Failed,
        result="Overall failed.",
    )
    small = dimension_result("Eve", TestCaseStatus.Failed)
    small.excludedFromRollUp = True

    validator._roll_up_dimension_results(test_result, [small])

    assert test_result.testCaseStatus == TestCaseStatus.Failed
    assert "fewer than 15 rows (name=Eve)" in test_result.result


def test_excluded_sentence_agrees_with_the_number_of_groups():
    sentence = result_messages.excluded_dimensions_sentence(["name=a", "name=b"], 2.5)

    assert sentence.startswith("2 dimension groups failed with fewer than 2.5 rows (name=a, name=b)")
    assert "so they do not fail the test case" in sentence
