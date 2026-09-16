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
Deviation-from-statistic failure thresholds.

A failure threshold is a tolerance the user accepts before a test case is reported as failed.
This module implements the semantic that applies to an aggregate statistic rather than to rows:
range tests widen their bounds by the threshold, exact-value tests tolerate a delta around the
expected value.

The tolerance is always applied *downstream* of bound resolution. Bounds may be static (read from
the test case parameters) or predicted by dynamic assertion, and the widening has to hold in both
cases, so it must never happen inside `get_min_bound`/`get_max_bound`.
"""

from __future__ import annotations

import math

from metadata.generated.schema.tests.basic import ThresholdUnit
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


def _is_finite(value: float) -> bool:
    """An unset bound resolves to ∓inf. Infinite stays infinite: the tolerance is a no-op there."""
    return not (math.isinf(value) or math.isnan(value))


def _tolerance(reference: float, threshold: float, unit: ThresholdUnit, label: str) -> float:
    """Absolute tolerance allowed around `reference`.

    Args:
        reference: bound or expected value the tolerance is computed against
        threshold: configured failure threshold
        unit: unit the threshold is expressed in
        label: what `reference` is, used for logging only

    Returns:
        float: the tolerance, in the unit of the metric under test
    """
    if unit != ThresholdUnit.PERCENTAGE:
        return threshold

    if reference == 0:
        # 0 * t is 0 whatever the threshold, so the test case stays strict on this side. There is no
        # meaningful percentage of 0, and silently substituting a floor would invent a tolerance the
        # user never asked for, so surface it instead.
        logger.warning(
            f"A PERCENTAGE failure threshold of {threshold} resolves to a tolerance of 0 because "
            f"{label} is 0. The test case is evaluated strictly on that side. "
            f"Use an ABSOLUTE threshold to tolerate a deviation around 0."
        )

    # abs() so that a negative reference widens outward: -100 at 5% gives -105, not -95.
    return abs(reference) * threshold / 100


def apply_bound_tolerance(
    min_bound: float,
    max_bound: float,
    threshold: float | None,
    unit: ThresholdUnit | None,
    label: str = "bound",
) -> tuple[float, float]:
    """Widen `[min_bound, max_bound]` by the failure threshold.

    ABSOLUTE:   [min - threshold, max + threshold]
    PERCENTAGE: [min - |min| * threshold / 100, max + |max| * threshold / 100]

    Args:
        min_bound: resolved lower bound, static or predicted
        max_bound: resolved upper bound, static or predicted
        threshold: configured failure threshold. 0 or None leaves the bounds untouched
        unit: unit the threshold is expressed in
        label: what the bounds are, used for logging only

    Returns:
        tuple[float, float]: the effective bounds to evaluate the observed value against
    """
    if not threshold:
        return min_bound, max_bound

    unit = unit or ThresholdUnit.ABSOLUTE

    effective_min = (
        min_bound - _tolerance(min_bound, threshold, unit, f"the min {label}")
        if _is_finite(min_bound)
        else min_bound
    )
    effective_max = (
        max_bound + _tolerance(max_bound, threshold, unit, f"the max {label}")
        if _is_finite(max_bound)
        else max_bound
    )

    return effective_min, effective_max


def within_deviation(
    observed: float,
    expected: float,
    threshold: float | None,
    unit: ThresholdUnit | None,
    label: str = "the expected value",
) -> bool:
    """Whether `observed` deviates from `expected` by no more than the failure threshold.

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
