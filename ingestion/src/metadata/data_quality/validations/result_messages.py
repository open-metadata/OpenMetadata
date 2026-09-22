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
Result messages.

`TestCaseResult.result` is the one place a user reads why a test case came out the way it did,
so it has to carry the whole picture: what was counted, what it was counted against, which
threshold was applied, the verdict, and which rows were read to get there. `Found nullCount=3`
says none of that.

These strings are English-only free text. **They are not an interface.** The UI re-derives its
own sentence from the test case parameters and the result fields; nothing should ever parse
what is built here.

The two shapes mirror the two threshold semantics of `thresholds.py`:

- `violation_sentence()` for the row tolerance — a count of violating rows against a population.
- `statistic_sentence()` / `expected_value_sentence()` for the deviation tolerance — an
  aggregate against bounds that the threshold widened, or against an expected value.

`scope_sentence()` renders the sampling and partition provenance that
`EvaluationScopeRuntimeParameters` carries, and is appended to every message by
`BaseTestValidator.run_validation()`.
"""

from __future__ import annotations

import math
from enum import Enum

from metadata.data_quality.validations.models import EvaluationScopeRuntimeParameters  # noqa: TC001
from metadata.data_quality.validations.thresholds import FailureThreshold, ThresholdUnit
from metadata.generated.schema.entity.data.table import (
    PartitionIntervalTypes,
    PartitionProfilerConfig,
)
from metadata.generated.schema.type.basic import ProfileSampleType

UNKNOWN_POPULATION = "an uncounted population"


class SamplingStability(Enum):
    """How a validator's metric behaves once only part of the table is read.

    Sampling is never extrapolated away, so the honest thing to do is name the distortion in the
    message. A validator declares which one applies to it through
    `BaseTestValidator.SAMPLING_STABILITY`.
    """

    STABLE = None
    """Location statistics (mean, median, stddev, shares of rows) survive sampling."""

    SCALES_WITH_SAMPLE = (
        "This metric scales with the number of rows read, so the value above is the sample's, not the table's."
    )
    """Sums and counts: a 10% sample gives roughly a tenth of the table's value."""

    BIASED_INWARD = (
        "Extremes are biased toward the middle of the distribution on a sample: the table's own "
        "min/max are at least as extreme as the value above."
    )
    """MIN/MAX: a sample can only miss the extreme rows, never invent more extreme ones."""


def format_count(value: float | int | None) -> str:
    """Render a count for a human: thousands separated, no trailing `.0`"""
    if value is None:
        return "an unknown number of"
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    if isinstance(value, int):
        return f"{value:,}"
    return format_value(value)


def format_value(value) -> str:
    """Render a measured value, keeping unbounded and missing values readable"""
    if value is None:
        return "not computed"
    if isinstance(value, float):
        if math.isinf(value):
            return "unbounded" if value > 0 else "-unbounded"
        if value.is_integer():
            return f"{int(value):,}"
        return f"{round(value, 4):,}"
    if isinstance(value, int):
        return f"{value:,}"
    return str(value)


def format_percentage(part: float | int | None, whole: float | int | None) -> str | None:
    """`part` as a share of `whole`, or None when there is no share to compute"""
    if part is None or not whole:
        return None
    return f"{part / whole * 100:.2f}%"


def format_threshold(threshold: FailureThreshold, noun: str = "rows") -> str:
    """Name the threshold that was actually applied.

    Always rendered, including when it is 0: a test case configured with a tolerance on a server
    newer than the ingestion agent running it is evaluated without one, and the message saying
    "no tolerance applied" is the only place that becomes visible rather than inferred.
    """
    if not threshold.value:
        return "no tolerance"
    if threshold.unit is ThresholdUnit.PERCENTAGE:
        return f"{format_value(threshold.value)}%"
    return f"{format_count(threshold.value)} {noun}"


def verdict(passed: bool) -> str:
    """The clause every message ends its first sentence with"""
    return "so this test passed" if passed else "so this test failed"


def violation_sentence(
    violations: int | None,
    population: int | None,
    violation_noun: str,
    threshold: FailureThreshold,
    passed: bool,
) -> str:
    """A row-tolerance verdict: how many rows broke the rule, out of how many, against which threshold.

    Args:
        violations: rows that broke the test condition
        population: rows the violations were counted against. None when the validator did not
                    compute it -- said as much rather than guessed, since a violation count
                    without its denominator is exactly what this message exists to fix
        violation_noun: what the violating rows are, e.g. "null rows"
        threshold: the tolerance that was applied
        passed: the verdict

    Returns:
        str: e.g. "Found 120 null rows out of 9,981 evaluated (1.20%). Threshold is 1.00%, so
             this test failed."
    """
    share = format_percentage(violations, population)
    out_of = f"{format_count(population)} evaluated" if population is not None else UNKNOWN_POPULATION
    share_suffix = f" ({share})" if share else ""

    return (
        f"Found {format_count(violations)} {violation_noun} out of {out_of}{share_suffix}. "
        f"Threshold is {format_threshold(threshold)}, {verdict(passed)}."
    )


def _bounds_phrase(min_bound: float | None, max_bound: float | None, lead: bool = True) -> str:
    """ "between 90 and 110", "at least 90", "at most 110" -- whichever bounds are set

    `lead` drops the "between" so the phrase can follow one that already introduced the window,
    which is what the widened bounds do.
    """
    has_min = min_bound is not None and not (isinstance(min_bound, float) and math.isinf(min_bound))
    has_max = max_bound is not None and not (isinstance(max_bound, float) and math.isinf(max_bound))

    if has_min and has_max:
        return f"{'between ' if lead else ''}{format_value(min_bound)} and {format_value(max_bound)}"
    if has_min:
        return f"at least {format_value(min_bound)}"
    if has_max:
        return f"at most {format_value(max_bound)}"
    return "any value"


def statistic_sentence(
    statistic: str,
    value,
    configured_bounds: tuple[float | None, float | None],
    effective_bounds: tuple[float | None, float | None],
    threshold: FailureThreshold,
    passed: bool,
) -> str:
    """A deviation verdict against bounds: the observed statistic, the bounds, the widening, the verdict.

    Args:
        statistic: what was measured, e.g. "Mean of `amount`"
        value: the observed value
        configured_bounds: the bounds the test case asked for
        effective_bounds: those bounds once the threshold widened them
        threshold: the tolerance that was applied
        passed: the verdict

    Returns:
        str: e.g. "Mean of `amount` is 87.4. Expected between 90 and 110, widened by a 5%
             tolerance to 85.5 and 115.5, so this test passed."
    """
    expected = f"Expected {_bounds_phrase(*configured_bounds)}"

    if not threshold.value:
        tolerance = ", with no tolerance applied"
    elif effective_bounds != configured_bounds:
        tolerance = (
            f", widened by a {format_threshold(threshold)} tolerance to {_bounds_phrase(*effective_bounds, lead=False)}"
        )
    else:
        # A threshold that widened nothing: there was no finite bound to widen.
        tolerance = f", with a {format_threshold(threshold)} tolerance"

    return f"{statistic} is {format_value(value)}. {expected}{tolerance}, {verdict(passed)}."


def expected_value_sentence(
    statistic: str,
    value,
    expected,
    threshold: FailureThreshold,
    passed: bool,
) -> str:
    """A deviation verdict against an exact value: the observed statistic, what was expected, the verdict.

    Args:
        statistic: what was measured, e.g. "Row count"
        value: the observed value
        expected: the value the test case expects
        threshold: the tolerance that was applied around `expected`
        passed: the verdict

    Returns:
        str: e.g. "Row count is 9,981. Expected 10,000, with a 1.00% tolerance, so this test passed."
    """
    tolerance = (
        f"with a {format_threshold(threshold)} tolerance" if threshold.value else f"with {format_threshold(threshold)}"
    )
    return f"{statistic} is {format_value(value)}. Expected {format_value(expected)}, {tolerance}, {verdict(passed)}."


def describe_partition(
    partition_details: PartitionProfilerConfig | None,
    partition_predicate: str | None = None,
) -> str | None:
    """Name the partition the rows were read from, as SQL when the sampler could compile one"""
    if not (partition_details and partition_details.enablePartitioning):
        return None

    if partition_predicate:
        return f"partitioned on {partition_predicate}"

    column = partition_details.partitionColumnName or "an unnamed column"
    interval_type = partition_details.partitionIntervalType

    if interval_type == PartitionIntervalTypes.COLUMN_VALUE and partition_details.partitionValues:
        values = ", ".join(str(value) for value in partition_details.partitionValues)
        return f"partitioned on {column} in ({values})"

    if interval_type == PartitionIntervalTypes.INTEGER_RANGE:
        start = partition_details.partitionIntegerRangeStart
        end = partition_details.partitionIntegerRangeEnd
        return f"partitioned on {column} between {format_value(start)} and {format_value(end)}"

    if partition_details.partitionInterval and partition_details.partitionIntervalUnit:
        unit = partition_details.partitionIntervalUnit.value.lower()
        plural = "" if partition_details.partitionInterval == 1 else "s"
        return f"partitioned on the last {partition_details.partitionInterval} {unit}{plural} of {column}"

    return f"partitioned on {column}"


def _describe_sample(scope: EvaluationScopeRuntimeParameters) -> str | None:
    """Name the sample the rows were read from"""
    if scope.sample_query:
        return "the rows returned by the configured sample query"

    if not scope.profile_sample:
        return None

    if scope.profile_sample_type is ProfileSampleType.ROWS:
        return f"a sample of {format_count(scope.profile_sample)} rows of the table"

    return f"a {format_value(scope.profile_sample)}% sample of the table"


def scope_sentence(
    scope: EvaluationScopeRuntimeParameters,
    stability: SamplingStability = SamplingStability.STABLE,
    bypasses_sampler: bool = False,
    threshold: FailureThreshold | None = None,
) -> str:
    """Say which rows the verdict above was measured on, and what that costs it.

    Sampling is never extrapolated: the numbers are the sample's. That is stated plainly, and
    where it makes the verdict weaker -- a metric that scales with the sample, an extreme that a
    sample biases inward, an ABSOLUTE threshold that counts rows the sample only holds a
    fraction of -- the caveat is spelled out too.

    Args:
        scope: what the test case was measured against
        stability: how this validator's metric behaves under sampling
        bypasses_sampler: whether the test runs its own SQL against the table, ignoring the sample
        threshold: the tolerance applied, to flag an absolute count read on a sample

    Returns:
        str: e.g. "Evaluated on a 10% sample of the table, partitioned on event_date >= '2026-09-10'."
    """
    sample = _describe_sample(scope)
    partition = describe_partition(scope.partition_details, scope.partition_predicate)

    if bypasses_sampler:
        bypass = (
            f"The test's own SQL runs against the full table, bypassing {sample}."
            if sample
            else "The test's own SQL runs against the full table, bypassing the sampler."
        )
        return (
            f"Evaluated on the full table. {bypass}"
            if not partition
            else f"Evaluated on the full table, {partition}. {bypass}"
        )

    if not sample and not partition:
        return "Evaluated on the full table."

    scoped = ", ".join(part for part in (sample or "the full table", partition) if part)
    sentence = f"Evaluated on {scoped}."

    if not sample:
        return sentence

    caveats = [caveat for caveat in (stability.value, _threshold_caveat(threshold)) if caveat]
    return " ".join([sentence, *caveats])


def _threshold_caveat(threshold: FailureThreshold | None) -> str | None:
    """Flag a tolerance whose meaning changes with the size of the sample.

    A percentage threshold is sample-stable -- 1% of the sample is 1% of the table, within
    sampling error. An absolute one is not: 100 violating rows in a 10% sample implies about
    1,000 in the table, and the threshold was checked against the 100.
    """
    if threshold and threshold.value and threshold.unit is ThresholdUnit.ABSOLUTE:
        return (
            "The threshold is an absolute count checked against the sample, so it does not "
            "carry over to the full table."
        )
    return None
