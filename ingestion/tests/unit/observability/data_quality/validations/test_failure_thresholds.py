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
Unit tests for the deviation-from-statistic failure threshold
"""

import logging
from datetime import datetime
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from sqlalchemy import text

from metadata.data_quality.validations import result_messages
from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.data_quality.validations.column.sqlalchemy.columnValueMaxToBeBetween import (
    ColumnValueMaxToBeBetweenValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnValueMeanToBeBetween import (
    ColumnValueMeanToBeBetweenValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnValueMinToBeBetween import (
    ColumnValueMinToBeBetweenValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnValuesMissingCount import (
    ColumnValuesMissingCountValidator,
)
from metadata.data_quality.validations.table.sqlalchemy.tableColumnCountToBeBetween import (
    TableColumnCountToBeBetweenValidator,
)
from metadata.data_quality.validations.table.sqlalchemy.tableColumnCountToEqual import (
    TableColumnCountToEqualValidator,
)
from metadata.data_quality.validations.table.sqlalchemy.tableRowCountToBeBetween import (
    TableRowCountToBeBetweenValidator,
)
from metadata.data_quality.validations.table.sqlalchemy.tableRowCountToEqual import (
    TableRowCountToEqualValidator,
)
from metadata.data_quality.validations.thresholds import (
    FailureThreshold,
    ThresholdUnit,
    _warn_zero_reference,
    apply_bound_tolerance,
    is_usable,
    within_deviation,
)
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.entityReference import EntityReference

ABSOLUTE = ThresholdUnit.ABSOLUTE
PERCENTAGE = ThresholdUnit.PERCENTAGE

INF = float("inf")


@pytest.mark.parametrize(
    "min_bound,max_bound,threshold,unit,expected",
    [
        # threshold = 0 leaves the bounds exactly as they were resolved
        (10, 20, 0, ABSOLUTE, (10, 20)),
        (10, 20, 0, PERCENTAGE, (10, 20)),
        (-INF, INF, 0, PERCENTAGE, (-INF, INF)),
        # ABSOLUTE widens both sides by the raw threshold
        (10, 20, 5, ABSOLUTE, (5, 25)),
        (-100, -50, 5, ABSOLUTE, (-105, -45)),
        (0, 0, 5, ABSOLUTE, (-5, 5)),
        # PERCENTAGE widens each side relative to its own bound
        (100, 200, 10, PERCENTAGE, (90, 220)),
        # |bound| so a negative bound widens outward, not inward
        (-100, 100, 5, PERCENTAGE, (-105, 105)),
        (-200, -100, 5, PERCENTAGE, (-210, -95)),
        # a bound of 0 has no percentage: the test case stays strict on that side
        (0, 100, 10, PERCENTAGE, (0, 110)),
        (-100, 0, 10, PERCENTAGE, (-110, 0)),
        # an unset bound resolves to ∓inf and stays infinite
        (-INF, 20, 5, ABSOLUTE, (-INF, 25)),
        (10, INF, 5, ABSOLUTE, (5, INF)),
        (-INF, 20, 5, PERCENTAGE, (-INF, 21)),
        (10, INF, 10, PERCENTAGE, (9, INF)),
        (-INF, INF, 10, PERCENTAGE, (-INF, INF)),
        # a percentage above 100 is accepted here, validation happens upstream
        (100, 200, 150, PERCENTAGE, (-50, 500)),
        (10, 20, 150, ABSOLUTE, (-140, 170)),
    ],
)
def test_apply_bound_tolerance(min_bound, max_bound, threshold, unit, expected):
    assert apply_bound_tolerance(min_bound, max_bound, threshold, unit) == expected


@pytest.mark.parametrize(
    "observed,expected_value,threshold,unit,expected",
    [
        # threshold = 0 is strict equality, exactly today's verdict
        (100, 100, 0, ABSOLUTE, True),
        (101, 100, 0, ABSOLUTE, False),
        (101, 100, 0, PERCENTAGE, False),
        (0, 0, 0, PERCENTAGE, True),
        # ABSOLUTE tolerates a raw delta on either side, bounds included
        (105, 100, 5, ABSOLUTE, True),
        (95, 100, 5, ABSOLUTE, True),
        (106, 100, 5, ABSOLUTE, False),
        (94, 100, 5, ABSOLUTE, False),
        # PERCENTAGE tolerates a delta relative to the expected value
        (110, 100, 10, PERCENTAGE, True),
        (90, 100, 10, PERCENTAGE, True),
        (111, 100, 10, PERCENTAGE, False),
        # |expected| so a negative expected value tolerates the same delta
        (-105, -100, 5, PERCENTAGE, True),
        (-94, -100, 5, PERCENTAGE, False),
        # an expected value of 0 has no percentage: the comparison stays strict
        (0, 0, 10, PERCENTAGE, True),
        (1, 0, 10, PERCENTAGE, False),
        # ... but an ABSOLUTE threshold still tolerates a deviation around 0
        (1, 0, 10, ABSOLUTE, True),
        (11, 0, 10, ABSOLUTE, False),
        # a percentage above 100 is accepted here, validation happens upstream
        (250, 100, 150, PERCENTAGE, True),
        (251, 100, 150, PERCENTAGE, False),
        # an unset expected value never matches a computed one
        (100, -INF, 5, ABSOLUTE, False),
        (100, None, 5, ABSOLUTE, False),
        (None, 100, 5, ABSOLUTE, False),
    ],
)
def test_within_deviation(observed, expected_value, threshold, unit, expected):
    assert within_deviation(observed, expected_value, threshold, unit) is expected


@pytest.mark.parametrize(
    "threshold,expected",
    [
        (0, True),
        (5, True),
        (150, True),  # a percentage above 100 is a tolerance, validation happens upstream
        (-0.1, False),  # narrows the bounds instead of widening them
        (float("nan"), False),  # never compares, so every test case fails
        (INF, False),  # every test case passes unconditionally
        (-INF, False),
    ],
)
def test_is_usable(threshold, expected):
    assert is_usable(threshold) is expected


def test_percentage_of_a_zero_bound_is_surfaced(caplog):
    """A zero bound silently reverts to strict: warn rather than substitute a floor."""
    # The warning is emitted once per message, so drop what the other cases already logged
    _warn_zero_reference.cache_clear()

    with caplog.at_level(logging.WARNING, logger="TestSuite"):
        assert apply_bound_tolerance(0, 100, 10, PERCENTAGE) == (0, 110)

    assert "resolves to a tolerance of 0" in caplog.text


class _MockValidator(BaseTestValidator):
    """Minimal concrete validator, only the threshold helpers are exercised"""

    def _run_validation(self) -> TestCaseResult:
        return TestCaseResult(
            timestamp=self.execution_date,
            testCaseStatus=TestCaseStatus.Success,
            result="Test passed",
            testResultValue=[],
        )


def _test_case(parameter_values, entity_link="<#E::table::service.db.schema.table>") -> TestCase:
    return TestCase(
        name="test_case",
        entityLink=entity_link,
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),  # type: ignore
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),  # type: ignore
        parameterValues=parameter_values,
    )  # type: ignore


def _threshold_params(threshold, unit):
    """The threshold is configured with the parameters the test definitions declare"""
    return [
        TestCaseParameterValue(name="threshold", value=str(threshold)),
        TestCaseParameterValue(name="thresholdUnit", value=unit.value),
    ]


def _validator(failure_threshold=0, threshold_unit=ABSOLUTE) -> _MockValidator:
    parameter_values = [
        TestCaseParameterValue(name="minValue", value="10"),
        TestCaseParameterValue(name="maxValue", value="20"),
    ] + _threshold_params(failure_threshold, threshold_unit)
    return _MockValidator(MagicMock(), _test_case(parameter_values), int(datetime.now().timestamp()))


@pytest.mark.parametrize("raw_threshold", ["-5", "nan", "inf", "-inf"])
def test_a_threshold_that_is_not_a_tolerance_is_rejected(raw_threshold, caplog):
    """A negative threshold narrows, NaN never compares and infinity always passes."""
    parameter_values = [
        TestCaseParameterValue(name="minValue", value="10"),
        TestCaseParameterValue(name="maxValue", value="20"),
        TestCaseParameterValue(name="threshold", value=raw_threshold),
    ]
    validator = _MockValidator(MagicMock(), _test_case(parameter_values), int(datetime.now().timestamp()))

    with caplog.at_level(logging.WARNING, logger="TestSuite"):
        threshold = validator.get_failure_threshold()

    assert (threshold.value, threshold.unit) == (0.0, ABSOLUTE)
    assert "has to be a finite, non-negative number" in caplog.text
    # ... and the rejected threshold leaves every verdict the one it was before thresholds
    assert validator.get_bounds("minValue", "maxValue") == (10, 20)
    assert validator.matches_expected(101, 100) is False


def test_get_bounds_without_threshold_is_a_no_op():
    assert _validator().get_bounds("minValue", "maxValue") == (10, 20)


def test_get_bounds_widens_resolved_bounds():
    assert _validator(5, ABSOLUTE).get_bounds("minValue", "maxValue") == (5, 25)
    assert _validator(10, PERCENTAGE).get_bounds("minValue", "maxValue") == (9, 22)


def test_get_bounds_widens_dynamically_resolved_bounds():
    """The tolerance must hold for bounds a subclass resolves itself, not only for static ones."""
    validator = _validator(5, ABSOLUTE)
    validator.get_min_bound = lambda _: 200.0
    validator.get_max_bound = lambda _: 400.0

    assert validator.get_bounds("minValue", "maxValue") == (195, 405)


def test_matches_expected():
    assert _validator().matches_expected(100, 100) is True
    assert _validator().matches_expected(101, 100) is False
    assert _validator(5, ABSOLUTE).matches_expected(104, 100) is True
    assert _validator(5, PERCENTAGE).matches_expected(104, 100) is True
    assert _validator(1, PERCENTAGE).matches_expected(104, 100) is False


@pytest.mark.parametrize(
    "threshold,unit,expected_status",
    [
        # the migrated validators read the threshold from the test case parameters
        (0, ABSOLUTE, TestCaseStatus.Failed),
        (5, ABSOLUTE, TestCaseStatus.Success),
        (1, ABSOLUTE, TestCaseStatus.Failed),
        (5, PERCENTAGE, TestCaseStatus.Success),
        (1, PERCENTAGE, TestCaseStatus.Failed),
    ],
)
def test_exact_value_validator_tolerates_a_deviation(threshold, unit, expected_status):
    """A row count of 102 against an expected 100 passes within a tolerance of 2"""
    validator = TableRowCountToEqualValidator(
        MagicMock(),
        _test_case([TestCaseParameterValue(name="value", value="100")] + _threshold_params(threshold, unit)),
        int(datetime.now().timestamp()),
    )
    validator._run_results = lambda *_args, **_kwargs: 102

    assert validator.run_validation().testCaseStatus == expected_status


@pytest.mark.parametrize(
    "validator_class,bound_parameter,statistic",
    [
        (ColumnValueMeanToBeBetweenValidator, "maxValueForMeanInCol", "Mean"),
        (ColumnValueMinToBeBetweenValidator, "maxValueForMinInCol", "Minimum"),
        (ColumnValueMaxToBeBetweenValidator, "maxValueForMaxInCol", "Maximum"),
    ],
)
@pytest.mark.parametrize(
    "bound,threshold,unit,tolerance,status",
    [
        (100, 5, ABSOLUTE, "5 metric units", TestCaseStatus.Success),
        (100.5, 4.5, ABSOLUTE, "4.5 metric units", TestCaseStatus.Success),
        (100, 4.5, ABSOLUTE, "4.5 metric units", TestCaseStatus.Failed),
        (100, 5, PERCENTAGE, "5%", TestCaseStatus.Success),
    ],
)
def test_statistic_tolerance_message_uses_metric_units(
    create_sqlite_table, validator_class, bound_parameter, statistic, bound, threshold, unit, tolerance, status
):
    runner = create_sqlite_table
    runner.session.execute(text("UPDATE users SET age = 105"))
    runner.session.commit()
    test_case = _test_case(
        [TestCaseParameterValue(name=bound_parameter, value=str(bound))] + _threshold_params(threshold, unit),
        entity_link="<#E::table::service.db.users::columns::age>",
    )

    result = validator_class(runner, test_case, int(datetime.now().timestamp())).run_validation()

    assert result.testCaseStatus == status
    assert f"{statistic} of `age` is 105." in result.result
    assert f"widened by a {tolerance} tolerance to at most" in result.result
    assert "rows tolerance" not in result.result


@pytest.mark.parametrize(
    "validator_class,bound_parameter,bound,noun",
    [
        (TableRowCountToBeBetweenValidator, "maxValue", 75, "rows"),
        (TableColumnCountToBeBetweenValidator, "maxColValue", 6, "columns"),
    ],
)
def test_count_tolerance_message_keeps_count_units(create_sqlite_table, validator_class, bound_parameter, bound, noun):
    test_case = _test_case(
        [TestCaseParameterValue(name=bound_parameter, value=str(bound))] + _threshold_params(5, ABSOLUTE)
    )

    result = validator_class(create_sqlite_table, test_case, int(datetime.now().timestamp())).run_validation()

    assert result.testCaseStatus == TestCaseStatus.Success
    assert f"widened by a 5 {noun} tolerance" in result.result


def test_unbounded_statistic_tolerance_uses_metric_units():
    sentence = result_messages.statistic_sentence(
        "Mean", 105, (-INF, INF), (-INF, INF), FailureThreshold(value=4.5, unit=ABSOLUTE), True
    )

    assert "a 4.5 metric units tolerance did not widen" in sentence


@pytest.mark.parametrize(
    "validator_class,parameter,observed,noun,entity_link",
    [
        (TableColumnCountToEqualValidator, "columnCount", 11, "columns", "<#E::table::service.db.users>"),
        (TableRowCountToEqualValidator, "value", 80, "rows", "<#E::table::service.db.users>"),
        (
            ColumnValuesMissingCountValidator,
            "missingCountValue",
            20,
            "rows",
            "<#E::table::service.db.users::columns::age>",
        ),
    ],
)
@pytest.mark.parametrize(
    "difference,threshold,unit,status",
    [
        (1, 1, ABSOLUTE, TestCaseStatus.Success),
        (2, 1, ABSOLUTE, TestCaseStatus.Failed),
        (1, 10, PERCENTAGE, TestCaseStatus.Success),
        (1, 1, PERCENTAGE, TestCaseStatus.Failed),
        (0, 0, ABSOLUTE, TestCaseStatus.Success),
        (1, 0, ABSOLUTE, TestCaseStatus.Failed),
    ],
)
def test_exact_count_tolerance_message_uses_count_units(
    create_sqlite_table, validator_class, parameter, observed, noun, entity_link, difference, threshold, unit, status
):
    expected = observed - difference
    test_case = _test_case(
        [TestCaseParameterValue(name=parameter, value=str(expected))] + _threshold_params(threshold, unit),
        entity_link=entity_link,
    )

    result = validator_class(create_sqlite_table, test_case, int(datetime.now().timestamp())).run_validation()

    assert result.testCaseStatus == status
    assert f"is {observed}. Expected {expected}," in result.result
    tolerance = f"{threshold}%" if unit is PERCENTAGE else f"{threshold} {noun}"
    expected_tolerance = f"with a {tolerance} tolerance" if threshold else "with no tolerance"
    assert expected_tolerance in result.result
    assert result_messages.verdict(status is TestCaseStatus.Success) in result.result
