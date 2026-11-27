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

"""Validate column value at location."""

from collections.abc import Iterator
from datetime import datetime
from unittest.mock import patch

from metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeAtExpectedLocation import (
    ColumnValuesToBeAtExpectedLocationValidator,
)
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    ThresholdUnit,
)
from metadata.generated.schema.tests.testCase import TestCaseParameterValue
from metadata.generated.schema.type.basic import Timestamp


def _fetch_data() -> Iterator[dict]:
    # Two rows resolve to their geojson shapes (valid), the third sits outside
    # 60001's buffered polygon (invalid), so the dataset carries one broken row
    # for the failure threshold to tolerate -- or not.
    rows = [
        {"postal_code": 60001, "lon": "1,7743058", "lat": "49,6852237"},
        {"postal_code": 44001, "lon": "-1,5244159", "lat": "47,5546432"},
        {"postal_code": 60001, "lon": "3,17932", "lat": "49,59686"},
    ]

    yield from rows


def _build_validator(test_case, threshold: float | None = None, unit: str | None = None):
    """Return a validator over `_fetch_data`, optionally configured with a threshold"""
    if threshold is not None:
        test_case.parameterValues = list(test_case.parameterValues) + [
            TestCaseParameterValue(name="threshold", value=str(threshold)),
            TestCaseParameterValue(name="thresholdUnit", value=unit or "ABSOLUTE"),
        ]
    return ColumnValuesToBeAtExpectedLocationValidator(
        None,
        test_case,
        Timestamp(root=int(datetime.strptime("2021-07-03", "%Y-%m-%d").timestamp())),
    )


def _run(test_case, threshold: float | None = None, unit: str | None = None) -> TestCaseResult:
    validator = _build_validator(test_case, threshold=threshold, unit=unit)
    with patch(
        "metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeAtExpectedLocation.ColumnValuesToBeAtExpectedLocationValidator._fetch_data",
        return_value=_fetch_data(),
    ):
        return validator.run_validation()


def test_column_value_to_be_at_expected_location(
    test_case_column_values_to_be_at_expected_location,
):
    """With the default threshold the test passes only when no row is invalid."""
    result: TestCaseResult = _run(test_case_column_values_to_be_at_expected_location)

    assert result.testCaseStatus == TestCaseStatus.Failed
    assert result.testResultValue[0].value == "2"
    assert result.testResultValue[1].value == "1"
    assert result.testResultValue[2].value == "0"
    # The default threshold is still a tolerance that was applied: zero absolute.
    assert result.appliedThreshold is not None
    assert result.appliedThreshold.value == 0
    assert result.appliedThreshold.unit == ThresholdUnit.ABSOLUTE


def test_an_absolute_threshold_tolerates_invalid_rows(
    test_case_column_values_to_be_at_expected_location,
):
    """A threshold of 5 ABSOLUTE absorbs the single invalid row, so the test passes."""
    result: TestCaseResult = _run(
        test_case_column_values_to_be_at_expected_location,
        threshold=5,
        unit="ABSOLUTE",
    )

    assert result.testCaseStatus == TestCaseStatus.Success
    assert result.testResultValue[0].value == "2"
    assert result.testResultValue[1].value == "1"
    # The run records the tolerance its verdict was taken under.
    assert result.appliedThreshold is not None
    assert result.appliedThreshold.value == 5
    assert result.appliedThreshold.unit == ThresholdUnit.ABSOLUTE


def test_a_strict_absolute_threshold_still_fails(
    test_case_column_values_to_be_at_expected_location,
):
    """A threshold of 0 ABSOLUTE tolerates nothing, so the broken row fails the test."""
    result: TestCaseResult = _run(
        test_case_column_values_to_be_at_expected_location,
        threshold=0,
        unit="ABSOLUTE",
    )

    assert result.testCaseStatus == TestCaseStatus.Failed
    assert result.appliedThreshold is not None
    assert result.appliedThreshold.value == 0
    assert result.appliedThreshold.unit == ThresholdUnit.ABSOLUTE


def test_a_percentage_threshold_tolerates_a_share_of_evaluated_rows(
    test_case_column_values_to_be_at_expected_location,
):
    """1 of 3 evaluated rows is ~33%, within a 40% tolerance, so the test passes."""
    result: TestCaseResult = _run(
        test_case_column_values_to_be_at_expected_location,
        threshold=40,
        unit="PERCENTAGE",
    )

    assert result.testCaseStatus == TestCaseStatus.Success
    assert result.appliedThreshold is not None
    assert result.appliedThreshold.value == 40
    assert result.appliedThreshold.unit == ThresholdUnit.PERCENTAGE


def test_a_strict_percentage_threshold_fails(
    test_case_column_values_to_be_at_expected_location,
):
    """1 of 3 evaluated rows is ~33%, more than a 20% tolerance, so the test fails."""
    result: TestCaseResult = _run(
        test_case_column_values_to_be_at_expected_location,
        threshold=20,
        unit="PERCENTAGE",
    )

    assert result.testCaseStatus == TestCaseStatus.Failed
    assert result.appliedThreshold is not None
    assert result.appliedThreshold.value == 20
    assert result.appliedThreshold.unit == ThresholdUnit.PERCENTAGE
