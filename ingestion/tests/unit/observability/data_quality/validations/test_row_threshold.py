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
Validate the shared row tolerance threshold against the validators that count rows.
"""

from datetime import datetime
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from metadata.data_quality.validations.base_test_handler import ThresholdUnit
from metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeInSet import (
    ColumnValuesToBeInSetValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeNotInSet import (
    ColumnValuesToBeNotInSetValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeNotNull import (
    ColumnValuesToBeNotNullValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeUnique import (
    ColumnValuesToBeUniqueValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnValuesToMatchRegex import (
    ColumnValuesToMatchRegexValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnValuesToNotMatchRegex import (
    ColumnValuesToNotMatchRegexValidator,
)
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.metrics.registry import Metrics

EXECUTION_DATE = datetime.strptime("2021-07-03", "%Y-%m-%d")
ENTITY_LINK = "<#E::table::service.db.users::columns::nickname>"


def build_validator(validator_class, parameter_values, compute_passed_failed_row_count=False):
    """Build a validator whose only live dependency is its test case"""
    test_case = TestCase(
        name="my_test_case",
        entityLink=ENTITY_LINK,
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),  # type: ignore
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),  # type: ignore
        parameterValues=parameter_values,
        computePassedFailedRowCount=compute_passed_failed_row_count,
    )  # type: ignore
    return validator_class(MagicMock(), test_case, EXECUTION_DATE)


def threshold_params(threshold=None, unit=None):
    """Build the threshold parameter values, leaving out the ones that are not set"""
    params = []
    if threshold is not None:
        params.append(TestCaseParameterValue(name="threshold", value=str(threshold)))
    if unit is not None:
        params.append(TestCaseParameterValue(name="thresholdUnit", value=unit))
    return params


# Each validator, the parameters it needs to evaluate, and how to express `violations` out of
# `denominator` violating rows with the metrics that validator computes.
VALIDATORS = [
    pytest.param(
        ColumnValuesToBeNotNullValidator,
        [],
        lambda violations, denominator: {
            Metrics.nullCount.name: violations,
            Metrics.rowCount.name: denominator,
        },
        id="columnValuesToBeNotNull",
    ),
    pytest.param(
        ColumnValuesToBeUniqueValidator,
        [],
        lambda violations, denominator: {
            Metrics.valuesCount.name: denominator,
            Metrics.uniqueCount.name: denominator - violations,
        },
        id="columnValuesToBeUnique",
    ),
    pytest.param(
        ColumnValuesToBeInSetValidator,
        [
            TestCaseParameterValue(name="allowedValues", value="['a','b']"),
            TestCaseParameterValue(name="matchEnum", value="true"),
        ],
        lambda violations, denominator: {
            Metrics.countInSet.name: denominator - violations,
            Metrics.rowCount.name: denominator,
        },
        id="columnValuesToBeInSet",
    ),
    pytest.param(
        ColumnValuesToBeNotInSetValidator,
        [TestCaseParameterValue(name="forbiddenValues", value="['a','b']")],
        lambda violations, denominator: {
            Metrics.countInSet.name: violations,
            Metrics.rowCount.name: denominator,
        },
        id="columnValuesToBeNotInSet",
    ),
    pytest.param(
        ColumnValuesToMatchRegexValidator,
        [TestCaseParameterValue(name="regex", value="^[a-z]+$")],
        lambda violations, denominator: {
            Metrics.valuesCount.name: denominator,
            Metrics.regexCount.name: denominator - violations,
        },
        id="columnValuesToMatchRegex",
    ),
    pytest.param(
        ColumnValuesToNotMatchRegexValidator,
        [TestCaseParameterValue(name="forbiddenRegex", value="^[a-z]+$")],
        lambda violations, denominator: {
            Metrics.notRegexCount.name: violations,
            Metrics.rowCount.name: denominator,
        },
        id="columnValuesToNotMatchRegex",
    ),
]


def evaluate(validator, metric_values):
    """Evaluate the test condition the way the validators do"""
    return validator._evaluate_test_condition(metric_values, validator._get_test_parameters())


@pytest.mark.parametrize("validator_class,test_params,metrics", VALIDATORS)
@pytest.mark.parametrize("violations,expected", [(0, True), (1, False), (100, False)])
def test_no_threshold_tolerates_no_violation(validator_class, test_params, metrics, violations, expected):
    """A test case without threshold parameters keeps the pre-threshold verdict"""
    validator = build_validator(validator_class, test_params)

    assert evaluate(validator, metrics(violations, 100))["matched"] is expected


@pytest.mark.parametrize("validator_class,test_params,metrics", VALIDATORS)
@pytest.mark.parametrize("violations,expected", [(4, True), (5, True), (6, False)])
def test_absolute_threshold_passes_at_the_boundary(validator_class, test_params, metrics, violations, expected):
    """ABSOLUTE tolerates exactly `threshold` violations"""
    validator = build_validator(validator_class, test_params + threshold_params(5, ThresholdUnit.ABSOLUTE.value))

    assert evaluate(validator, metrics(violations, 100))["matched"] is expected


@pytest.mark.parametrize("validator_class,test_params,metrics", VALIDATORS)
@pytest.mark.parametrize("violations,expected", [(19, True), (20, True), (21, False)])
def test_percentage_threshold_counts_against_the_denominator(
    validator_class, test_params, metrics, violations, expected
):
    """PERCENTAGE tolerates `threshold` percent of the rows the validator evaluated"""
    validator = build_validator(validator_class, test_params + threshold_params(10, ThresholdUnit.PERCENTAGE.value))

    assert evaluate(validator, metrics(violations, 200))["matched"] is expected


@pytest.mark.parametrize("validator_class,test_params,metrics", VALIDATORS)
@pytest.mark.parametrize("unit", [ThresholdUnit.ABSOLUTE.value, ThresholdUnit.PERCENTAGE.value])
def test_empty_denominator_passes(validator_class, test_params, metrics, unit):
    """Nothing was evaluated, so nothing can violate the test - and nothing is divided by zero"""
    validator = build_validator(validator_class, test_params + threshold_params(0, unit))

    assert evaluate(validator, metrics(0, 0))["matched"] is True


def test_match_regex_counts_violations_against_the_non_null_values():
    """A column that is half NULL must not report its NULLs as regex failures"""
    validator = build_validator(
        ColumnValuesToMatchRegexValidator,
        [TestCaseParameterValue(name="regex", value="^[a-z]+$")] + threshold_params(5, ThresholdUnit.PERCENTAGE.value),
    )

    # 5 of the 50 non-null values do not match: 10% of them, but only 5% of the 100 rows
    evaluation = evaluate(
        validator,
        {
            Metrics.valuesCount.name: 50,
            Metrics.regexCount.name: 45,
            Metrics.rowCount.name: 100,
        },
    )

    assert evaluation["matched"] is False


def test_in_set_without_match_enum_ignores_the_threshold():
    """Without matchEnum the test only asks for one value in the set, there is nothing to tolerate"""
    validator = build_validator(
        ColumnValuesToBeInSetValidator,
        [
            TestCaseParameterValue(name="allowedValues", value="['a','b']"),
            TestCaseParameterValue(name="matchEnum", value="false"),
        ]
        + threshold_params(10, ThresholdUnit.PERCENTAGE.value),
    )

    assert evaluate(validator, {Metrics.countInSet.name: 1})["matched"] is True
    assert evaluate(validator, {Metrics.countInSet.name: 0})["matched"] is False


@pytest.mark.parametrize(
    "parameter_values,expected",
    [
        ([], (0.0, ThresholdUnit.ABSOLUTE)),
        (threshold_params(5), (5.0, ThresholdUnit.ABSOLUTE)),
        (threshold_params(5, "PERCENTAGE"), (5.0, ThresholdUnit.PERCENTAGE)),
        (threshold_params(5, "percentage"), (5.0, ThresholdUnit.PERCENTAGE)),
        # An unreadable threshold or unit falls back to the safest reading rather than raising
        (threshold_params(5, "RATIO"), (5.0, ThresholdUnit.ABSOLUTE)),
        (threshold_params("abc", "PERCENTAGE"), (0.0, ThresholdUnit.ABSOLUTE)),
        (threshold_params(0, "PERCENTAGE"), (0.0, ThresholdUnit.PERCENTAGE)),
    ],
)
def test_get_row_threshold(parameter_values, expected):
    validator = build_validator(ColumnValuesToBeNotNullValidator, parameter_values)

    assert validator.get_row_threshold() == expected


@pytest.mark.parametrize(
    "threshold,expected_status",
    [
        # `age` is NULL on 20 of the 80 rows, 25% of the column
        (30, TestCaseStatus.Success),
        (25, TestCaseStatus.Success),
        (20, TestCaseStatus.Failed),
    ],
)
def test_percentage_threshold_computes_its_denominator(create_sqlite_table, threshold, expected_status):
    """The row count denominator is queried even when the test case does not ask for row counts"""
    test_case = TestCase(
        name="my_test_case",
        entityLink="<#E::table::service.db.users::columns::age>",
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),  # type: ignore
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),  # type: ignore
        parameterValues=threshold_params(threshold, ThresholdUnit.PERCENTAGE.value),
        computePassedFailedRowCount=False,
    )  # type: ignore
    validator = ColumnValuesToBeNotNullValidator(
        create_sqlite_table, test_case=test_case, execution_date=EXECUTION_DATE.timestamp()
    )

    result = validator.run_validation()

    assert result.testCaseStatus == expected_status
    assert result.failedRows == 20
    assert result.passedRows == 60


@pytest.mark.parametrize(
    "parameter_values,compute_passed_failed_row_count,expected",
    [
        ([], False, False),
        ([], True, True),
        (threshold_params(5, "ABSOLUTE"), False, False),
        # The denominator of a percentage threshold has to be computed even when the
        # test case does not ask for row level results
        (threshold_params(5, "PERCENTAGE"), False, True),
    ],
)
def test_needs_row_count(parameter_values, compute_passed_failed_row_count, expected):
    validator = build_validator(ColumnValuesToBeNotNullValidator, parameter_values, compute_passed_failed_row_count)

    assert validator._needs_row_count() is expected
