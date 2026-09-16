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

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.data_quality.validations.thresholds import (
    apply_bound_tolerance,
    within_deviation,
)
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    ThresholdUnit,
)
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


def test_percentage_of_a_zero_bound_is_surfaced(caplog):
    """A zero bound silently reverts to strict: warn rather than substitute a floor."""
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


def _validator(failure_threshold=0, threshold_unit=ABSOLUTE) -> _MockValidator:
    test_case = TestCase(
        name="test_case",
        entityLink="<#E::table::service.db.schema.table>",
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),  # type: ignore
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),  # type: ignore
        parameterValues=[
            TestCaseParameterValue(name="minValue", value="10"),
            TestCaseParameterValue(name="maxValue", value="20"),
        ],
        failureThreshold=failure_threshold,
        thresholdUnit=threshold_unit,
    )
    return _MockValidator(MagicMock(), test_case, int(datetime.now().timestamp()))


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
