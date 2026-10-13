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
"""Persisted Snowflake profiler metrics, DML system metrics and time-unit partition profiling."""

import time

import pytest

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.generated.schema.entity.data.table import (
    DmlOperationType,
    PartitionIntervalTypes,
    PartitionIntervalUnit,
    PartitionProfilerConfig,
    TableProfilerConfig,
)

from ..features.database.entities import entity_exists
from ..features.database.pipelines import MetadataPipeline, ProfilerPipeline
from ..features.database.profiles import column_has_metrics, table_has_row_count
from ..runtime import expect
from .checks import system_profile_matches, system_profile_query

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


def _metadata():
    return MetadataPipeline(includeStoredProcedures=False)


def _only(table):
    return {"tableFilterPattern": {"includes": [f"^{table}$"]}}


@pytest.mark.e2e_contract("profile.metrics")
def test_profiler_metrics(cli, snowflake):
    cli.run(snowflake.invocation(_metadata()))
    for name in ("CUSTOMERS", "TRANSACTIONS", "ALL_TYPES"):
        expect.poll(snowflake.table_query(name)).satisfies(entity_exists)
    cli.run(snowflake.invocation(profiler_options()))
    for name, count in (("CUSTOMERS", 5), ("TRANSACTIONS", 5), ("ALL_TYPES", 3)):
        expect.poll(snowflake.profile_query(name)).satisfies(table_has_row_count(count))
    expect.poll(snowflake.profile_query("CUSTOMERS")).satisfies(
        column_has_metrics(
            "CREDIT_SCORE",
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
    expect.poll(snowflake.profile_query("CUSTOMERS")).satisfies(
        column_has_metrics("FIRST_NAME", valuesCount=5, nullCount=0, minLength=3, maxLength=7)
    )


@pytest.mark.e2e_contract("profile.system")
def test_system_profile_attributes_dml_to_its_table(
    cli, snowflake, snowflake_profile_table, snowflake_secondary_source
):
    """v1 checked INSERT, MERGE and DELETE system metrics on same-named tables in two schemas.

    The connector reads ACCOUNT_USAGE.QUERY_HISTORY, which lags by up to 45 minutes, so the
    profiler reads the same statements through the real-time shim.
    """
    table = snowflake_profile_table
    filters = _only(table)
    cli.run(snowflake.invocation(_metadata(), filters=filters))
    expect.poll(snowflake.table_query(table)).satisfies(entity_exists)

    shim = snowflake.source.account_usage_shim()
    owned, sibling = snowflake.source, snowflake_secondary_source
    sibling.run(f"CREATE TABLE {sibling.qualified}.profile_values (id NUMBER(38, 0) NOT NULL, score NUMBER(38, 0))")
    since_ms = int(time.time() * 1000) - 60_000
    results = [
        owned.dml(
            f"INSERT INTO {owned.qualified}.profile_values (id, score) VALUES (1, 10), (2, 20), (3, 20), (4, NULL)"
        ),
        owned.dml(f"UPDATE {owned.qualified}.profile_values SET score = 30 WHERE id = 2"),
        owned.dml(f"DELETE FROM {owned.qualified}.profile_values WHERE id = 4"),
        owned.dml(
            f"MERGE INTO {owned.qualified}.profile_values AS t "
            "USING (SELECT 1 AS id, 11 AS score UNION ALL SELECT 5, 50) AS s ON t.id = s.id "
            "WHEN MATCHED THEN UPDATE SET t.score = s.score "
            "WHEN NOT MATCHED THEN INSERT (id, score) VALUES (s.id, s.score)"
        ),
        owned.dml(f"UPDATE {owned.qualified}.customers SET credit_score = 700 WHERE id = 1"),
        sibling.dml(f"INSERT INTO {sibling.qualified}.profile_values (id, score) VALUES (1, 1), (2, 2)"),
        sibling.dml(f"DELETE FROM {sibling.qualified}.profile_values WHERE id = 1"),
    ]
    assert [(result.inserted, result.updated, result.deleted) for result in results] == [
        (4, 0, 0),
        (0, 1, 0),
        (0, 0, 1),
        (1, 1, 0),
        (0, 1, 0),
        (2, 0, 0),
        (0, 0, 1),
    ]
    shim.record(*results)
    shim.wait_for_queries([result.query_id for result in results])

    cli.run(
        snowflake.invocation(
            profiler_options([MetricType.rowCount, MetricType.system]), filters=filters, account_usage=shim
        )
    )
    expect.poll(snowflake.profile_query(table)).satisfies(table_has_row_count(4))
    expect.poll(system_profile_query(snowflake.om, snowflake.table_fqn(table), since_ms=since_ms)).satisfies(
        system_profile_matches(
            [
                (DmlOperationType.INSERT, 4),
                (DmlOperationType.UPDATE, 1),
                (DmlOperationType.DELETE, 1),
                (DmlOperationType.INSERT, 1),
                (DmlOperationType.UPDATE, 1),
            ]
        )
    )


@pytest.mark.e2e_contract("profile.partition.time-unit")
def test_profiler_reads_only_the_time_unit_partition(cli, snowflake, snowflake_partitioned_table):
    """v1 configured a TIME-UNIT window wide enough to cover every row, here two rows fall outside it.

    Table metrics read INFORMATION_SCHEMA and always describe the whole table, so only the
    column metrics show the window.
    """
    table = snowflake_partitioned_table
    filters = _only(table)
    cli.run(snowflake.invocation(_metadata(), filters=filters))
    expect.poll(snowflake.table_query(table)).satisfies(entity_exists)
    snowflake.om.create_or_update_table_profiler_config(
        snowflake.table_fqn(table),
        TableProfilerConfig(
            partitioning=PartitionProfilerConfig(
                enablePartitioning=True,
                partitionColumnName="EVENT_DATE",
                partitionIntervalType=PartitionIntervalTypes.TIME_UNIT,
                partitionInterval=4,
                partitionIntervalUnit=PartitionIntervalUnit.DAY,
            )
        ),
    )
    cli.run(snowflake.invocation(profiler_options(), filters=filters))

    def check(profiled):
        table_has_row_count(4)(profiled)
        column_has_metrics("ID", valuesCount=2, nullCount=0, min=1, max=2)(profiled)

    expect.poll(snowflake.profile_query(table)).satisfies(check)
