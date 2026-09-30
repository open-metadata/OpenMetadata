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
"""Persisted Oracle profiler metrics over the declared baseline."""

import pytest

from metadata.generated.schema.configuration.profilerConfiguration import MetricType

from ..features.database.entities import entity_exists
from ..features.database.pipelines import MetadataPipeline, ProfilerPipeline
from ..features.database.profiles import column_has_metrics, table_has_row_count
from ..runtime import expect

_ALL_PROFILER_METRICS = [
    MetricType.rowCount,
    MetricType.columnCount,
    MetricType.columnNames,
    MetricType.valuesCount,
    MetricType.nullCount,
    MetricType.nullProportion,
    MetricType.distinctCount,
    MetricType.distinctProportion,
    MetricType.uniqueCount,
    MetricType.uniqueProportion,
    MetricType.duplicateCount,
    MetricType.min,
    MetricType.max,
    MetricType.mean,
    MetricType.sum,
    MetricType.stddev,
    MetricType.median,
    MetricType.firstQuartile,
    MetricType.thirdQuartile,
    MetricType.interQuartileRange,
    MetricType.nonParametricSkew,
    MetricType.histogram,
    MetricType.minLength,
    MetricType.maxLength,
]


def profiler_options() -> ProfilerPipeline:
    """Profile every row deterministically.

    v1 needed ``profileSample: 1`` because it ran against a shared instance where
    sampling did not reliably pick up the seeded rows. Against an owned source with
    a declared baseline the full table is small, so sample the lot and drop the
    randomisation instead of working around it.
    """
    return ProfilerPipeline(
        metrics=_ALL_PROFILER_METRICS,
        profileSampleConfig={
            "sampleConfigType": "STATIC",
            "config": {"profileSample": 100, "profileSampleType": "PERCENTAGE"},
        },
        randomizedSample=False,
        useStatistics=False,
    )


@pytest.mark.e2e_contract("profile.metrics")
def test_profiler_metrics(cli, oracle):
    """Profiling emits table row counts and per-column numeric and string metrics."""
    cli.run(oracle.invocation(MetadataPipeline(includeStoredProcedures=False)))
    for name in ("customers", "transactions", "all_types"):
        expect.poll(oracle.table_query(name)).satisfies(entity_exists)

    cli.run(oracle.invocation(profiler_options()))

    for name, count in (("customers", 5), ("transactions", 5), ("all_types", 3)):
        expect.poll(oracle.profile_query(name)).satisfies(table_has_row_count(count))

    expect.poll(oracle.profile_query("customers")).satisfies(
        column_has_metrics(
            "credit_score",
            valuesCount=5,
            nullCount=0,
            distinctCount=5,
            uniqueCount=5,
            min=600,
            max=750,
            mean=680,
            sum=3400,
        )
    )
    expect.poll(oracle.profile_query("customers")).satisfies(
        column_has_metrics("first_name", valuesCount=5, nullCount=0, minLength=3, maxLength=7)
    )
