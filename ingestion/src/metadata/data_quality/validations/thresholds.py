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
Failure thresholds.

A failure threshold is a tolerance the user accepts before a test case is reported as failed. It is
configured with the `threshold` and `thresholdUnit` parameters declared on the test definitions that
support them, and read as a `FailureThreshold` by `BaseTestValidator.get_failure_threshold()`.

Two semantics read that same configuration. The row tolerance counts violating rows and lives in
`BaseTestValidator._apply_row_threshold()`. The deviation-from-statistic tolerance implemented here
applies to an aggregate statistic instead: range tests widen their bounds by the threshold and
exact-value tests tolerate a delta around the expected value.

The deviation tolerance is always applied *downstream* of bound resolution. Bounds may be static
(read from the test case parameters) or predicted by dynamic assertion, and the widening has to hold
in both cases, so it must never happen inside `get_min_bound`/`get_max_bound`.
"""

from __future__ import annotations

import math
from enum import Enum
from functools import lru_cache
from typing import TypeGuard

from pydantic import BaseModel

from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

# Failure threshold parameters, declared on the test definitions that support them
THRESHOLD_PARAM = "threshold"
THRESHOLD_UNIT_PARAM = "thresholdUnit"


class ThresholdUnit(str, Enum):
    """How the `threshold` parameter reads: a raw deviation, or a share of what it applies to"""

    ABSOLUTE = "ABSOLUTE"
    PERCENTAGE = "PERCENTAGE"


class FailureThreshold(BaseModel):
    """What a test case tolerates before it is reported as failed, and in which unit

    The defaults are the pre-threshold verdict: no deviation at all is tolerated.
    """

    value: float = 0.0
    unit: ThresholdUnit = ThresholdUnit.ABSOLUTE


def _is_finite(value: float | None) -> TypeGuard[float]:
    """Whether a tolerance can be computed against `value`

    An unset bound resolves to ∓inf, and an unreadable one to None. Both are left as they are: the
    tolerance is a no-op on that side, which keeps the verdict the one the test case had before.
    """
    return value is not None and not (math.isinf(value) or math.isnan(value))


@lru_cache(maxsize=16)
def _warn_zero_reference(threshold: float, label: str) -> None:
    """Warn that a percentage of 0 is still 0, once per message

    A dimensional test case evaluates the same bounds once per dimension row, so warning on every
    call would repeat the same line for every group.
    """
    logger.warning(
        "A PERCENTAGE failure threshold of %s resolves to a tolerance of 0 because %s is 0. The "
        "test case is evaluated strictly on that side. Use an ABSOLUTE threshold to tolerate a "
        "deviation around 0.",
        threshold,
        label,
    )


def _tolerance(reference: float, threshold: float, unit: ThresholdUnit, label: str) -> float:
    """Absolute tolerance allowed around `reference`

    Args:
        reference: bound or expected value the tolerance is computed against
        threshold: configured failure threshold
        unit: unit the threshold is expressed in
        label: what `reference` is, used for logging only

    Returns:
        float: the tolerance, in the unit of the metric under test
    """
    if unit is not ThresholdUnit.PERCENTAGE:
        return threshold

    if reference == 0:
        # 0 * t is 0 whatever the threshold, so the test case stays strict on this side. There is no
        # meaningful percentage of 0, and silently substituting a floor would invent a tolerance the
        # user never asked for, so surface it instead.
        _warn_zero_reference(threshold, label)

    # abs() so that a negative reference widens outward: -100 at 5% gives -105, not -95.
    return abs(reference) * threshold / 100


def apply_bound_tolerance(
    min_bound: float | None,
    max_bound: float | None,
    threshold: float | None,
    unit: ThresholdUnit | None,
    label: str = "bound",
) -> tuple[float | None, float | None]:
    """Widen `[min_bound, max_bound]` by the failure threshold

    ABSOLUTE:   [min - threshold, max + threshold]
    PERCENTAGE: [min - |min| * threshold / 100, max + |max| * threshold / 100]

    Args:
        min_bound: resolved lower bound, static or predicted
        max_bound: resolved upper bound, static or predicted
        threshold: configured failure threshold. 0 or None leaves the bounds untouched
        unit: unit the threshold is expressed in
        label: what the bounds are, used for logging only

    Returns:
        tuple[float | None, float | None]: the effective bounds to evaluate the observed value against
    """
    if not threshold:
        return min_bound, max_bound

    unit = unit or ThresholdUnit.ABSOLUTE

    effective_min = (
        min_bound - _tolerance(min_bound, threshold, unit, f"the min {label}") if _is_finite(min_bound) else min_bound
    )
    effective_max = (
        max_bound + _tolerance(max_bound, threshold, unit, f"the max {label}") if _is_finite(max_bound) else max_bound
    )

    return effective_min, effective_max


def within_deviation(
    observed: float | None,
    expected: float | None,
    threshold: float | None,
    unit: ThresholdUnit | None,
    label: str = "the expected value",
) -> bool:
    """Whether `observed` deviates from `expected` by no more than the failure threshold

    ABSOLUTE:   |observed - expected| <= threshold
    PERCENTAGE: |observed - expected| <= |expected| * threshold / 100

    Args:
        observed: value computed against the data
        expected: value the test case expects
        threshold: configured failure threshold. 0 or None means strict equality
        unit: unit the threshold is expressed in
        label: what `expected` is, used for logging only

    Returns:
        bool: True when the deviation is tolerated
    """
    if not threshold or observed is None or expected is None or not _is_finite(expected):
        return observed == expected

    return abs(observed - expected) <= _tolerance(expected, threshold, unit or ThresholdUnit.ABSOLUTE, label)
