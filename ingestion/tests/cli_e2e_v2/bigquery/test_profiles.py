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
"""Persisted BigQuery profiler metrics, DML system metrics and default partition profiling."""

import time

import pytest

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.generated.schema.entity.data.table import DmlOperationType

from ..features.database.entities import entity_exists
from ..features.database.pipelines import MetadataPipeline, ProfilerPipeline
from ..features.database.profiles import column_has_metrics, table_has_row_count
from ..runtime import expect
from .checks import partition_query, system_profile_matches, system_profile_query, table_is_day_partitioned
from .source import wait_for_jobs_visible

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


def profiler_options(metrics=None):
    return ProfilerPipeline(
        metrics=metrics or _ALL_PROFILER_METRICS,
        profileSampleConfig={
            "sampleConfigType": "STATIC",
            "config": {"profileSample": 100, "profileSampleType": "PERCENTAGE"},
        },
        randomizedSample=False,
        useStatistics=False,
    )


def _only(table):
    return {"tableFilterPattern": {"includes": [f"^{table}$"]}}


@pytest.mark.e2e_contract("profile.metrics")
def test_profiler_metrics(cli, bigquery):
    cli.run(bigquery.invocation(MetadataPipeline(includeStoredProcedures=False)))
    for name in ("customers", "transactions", "all_types"):
        expect.poll(bigquery.table_query(name)).satisfies(entity_exists)
    cli.run(bigquery.invocation(profiler_options()))
    for name, count in (("customers", 5), ("transactions", 5), ("all_types", 3)):
        expect.poll(bigquery.profile_query(name)).satisfies(table_has_row_count(count))
    expect.poll(bigquery.profile_query("customers")).satisfies(
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
            median=680,
        )
    )
    expect.poll(bigquery.profile_query("customers")).satisfies(
        column_has_metrics("first_name", valuesCount=5, nullCount=0, minLength=3, maxLength=7)
    )


@pytest.mark.e2e_contract("profile.system")
def test_system_profile_attributes_dml_to_its_table(cli, bigquery, bigquery_profile_table):
    """v1 checked INSERT/UPDATE system metrics; this also requires sibling-table DML to stay out.

    The connector reads INFORMATION_SCHEMA.JOBS of the billing project, so the DML runs there,
    exactly as it did through the v1 workflow engine.
    """
    table = bigquery_profile_table
    filters = _only(table)
    cli.run(bigquery.invocation(MetadataPipeline(includeStoredProcedures=False), filters=filters))
    expect.poll(bigquery.table_query(table)).satisfies(entity_exists)

    billing = bigquery.instance.secondary
    since_ms = int(time.time() * 1000) - 60_000
    qualified = bigquery.source.qualified
    jobs = [
        bigquery.source.run(
            f"INSERT INTO {qualified}.{table} (id, score) VALUES (1, 10), (2, 20), (3, 20), (4, NULL)",
            client=billing.client,
        ),
        bigquery.source.run(f"UPDATE {qualified}.{table} SET score = 30 WHERE id = 2", client=billing.client),
        bigquery.source.run(f"UPDATE {qualified}.customers SET credit_score = 700 WHERE id = 1", client=billing.client),
    ]
    assert [job.num_dml_affected_rows for job in jobs] == [4, 1, 1]
    wait_for_jobs_visible(billing, bigquery.instance.location, [job.job_id for job in jobs])

    cli.run(bigquery.invocation(profiler_options([MetricType.rowCount, MetricType.system]), filters=filters))
    expect.poll(bigquery.profile_query(table)).satisfies(table_has_row_count(4))
    expect.poll(system_profile_query(bigquery.om, bigquery.table_fqn(table), since_ms=since_ms)).satisfies(
        system_profile_matches([(DmlOperationType.INSERT, 4), (DmlOperationType.UPDATE, 1)])
    )


@pytest.mark.e2e_contract("profile.partition.default")
def test_profiler_defaults_to_latest_day_partition(cli, bigquery, bigquery_partitioned_table):
    """Without a partition config, BigQuery profiling must read only [CURRENT_DATE - 1 DAY, ...)."""
    table = bigquery_partitioned_table
    filters = _only(table)
    cli.run(bigquery.invocation(MetadataPipeline(includeStoredProcedures=False), filters=filters))
    expect.poll(partition_query(bigquery.om, bigquery.table_fqn(table))).satisfies(
        table_is_day_partitioned("event_date")
    )
    cli.run(bigquery.invocation(profiler_options(), filters=filters))
    expect.poll(bigquery.profile_query(table)).satisfies(
        column_has_metrics("id", valuesCount=1, nullCount=0, min=1, max=1)
    )
