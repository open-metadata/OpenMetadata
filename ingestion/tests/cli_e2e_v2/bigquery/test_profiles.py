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
from collections import Counter

import pytest

from metadata.generated.schema.api.data.createTableProfile import CreateTableProfileRequest
from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.generated.schema.entity.data.table import DmlOperationType, SystemProfile, TableProfile
from metadata.generated.schema.type.basic import Timestamp
from metadata.utils.time_utils import datetime_to_timestamp

from ..features.database.entities import entity_exists
from ..features.database.pipelines import MetadataPipeline, ProfilerPipeline
from ..features.database.profiles import column_has_metrics, table_has_row_count
from ..runtime import expect
from .checks import partition_query, system_profile_query, table_is_day_partitioned
from .source import wait_for_dml_jobs_visible

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
    """Opt in to jobs from another project and replay the full history into the same keys."""
    table = bigquery_profile_table
    filters = _only(table)
    cli.run(bigquery.invocation(MetadataPipeline(includeStoredProcedures=False), filters=filters))
    entity = expect.poll(bigquery.table_query(table)).satisfies(entity_exists)

    billing = bigquery.instance.secondary
    primary = bigquery.instance.primary
    since_ms = int(time.time() * 1000) - 60_000
    qualified = bigquery.source.qualified
    inserted = bigquery.source.run(
        f"INSERT INTO {qualified}.{table} (id, score) VALUES (1, 10), (2, 20), (3, 20), (4, NULL)",
        client=billing.client,
    )
    updated = bigquery.source.run(
        f"UPDATE {qualified}.{table} SET score = 30 WHERE id = 2",
        client=primary.client,
    )
    sibling = f"{table}_archive"
    bigquery.source.run(f"CREATE TABLE {qualified}.{sibling} (id INT64)")
    sibling_insert = bigquery.source.run(
        f"INSERT INTO {qualified}.{sibling} (id) VALUES (1), (2)", client=primary.client
    )
    assert [job.num_dml_affected_rows for job in (inserted, updated, sibling_insert)] == [4, 1, 2]
    wait_for_dml_jobs_visible(billing, bigquery.instance.location, [inserted.job_id])
    wait_for_dml_jobs_visible(primary, bigquery.instance.location, [updated.job_id, sibling_insert.job_id])

    existing_ts = Timestamp(since_ms + 1)
    bigquery.om.ingest_profile_data(
        entity,
        CreateTableProfileRequest(
            tableProfile=TableProfile(timestamp=existing_ts, rowCount=0),
            systemProfile=[SystemProfile(timestamp=existing_ts, operation=DmlOperationType.WRITE, rowsAffected=9)],
        ),
    )

    def matches_events(*events):
        def check(profiles):
            actual = Counter((profile.timestamp.root, profile.operation, profile.rowsAffected) for profile in profiles)
            assert actual == Counter(events)

        return check

    read_profiles = system_profile_query(bigquery.om, bigquery.table_fqn(table), since_ms=since_ms)
    original = [
        (existing_ts.root, DmlOperationType.WRITE, 9),
        (datetime_to_timestamp(inserted.started, milliseconds=True), DmlOperationType.INSERT, 4),
    ]
    options = profiler_options([MetricType.rowCount, MetricType.system])
    cli.run(bigquery.invocation(options, filters=filters))
    expect.poll(bigquery.profile_query(table)).satisfies(table_has_row_count(4))
    expect.poll(read_profiles).satisfies(matches_events(*original))

    expanded = bigquery.invocation(options, filters=filters)
    expanded.config["source"]["serviceConnection"]["config"]["systemMetricsJobProjectIds"] = [primary.project_id]
    expected = matches_events(
        *original,
        (datetime_to_timestamp(updated.started, milliseconds=True), DmlOperationType.UPDATE, 1),
    )
    for _ in range(2):
        cli.run(expanded)
        expect.poll(read_profiles).satisfies(expected)


@pytest.mark.e2e_contract("profile.partition.default")
def test_profiler_uses_default_three_day_partition_window(cli, bigquery, bigquery_partitioned_table):
    """Without a partition config, BigQuery profiling reads the inferred three-day window."""
    table = bigquery_partitioned_table
    filters = _only(table)
    cli.run(bigquery.invocation(MetadataPipeline(includeStoredProcedures=False), filters=filters))
    expect.poll(partition_query(bigquery.om, bigquery.table_fqn(table))).satisfies(
        table_is_day_partitioned("event_date")
    )
    cli.run(bigquery.invocation(profiler_options(), filters=filters))
    expect.poll(bigquery.profile_query(table)).satisfies(
        column_has_metrics("id", valuesCount=2, nullCount=0, min=1, max=2)
    )
