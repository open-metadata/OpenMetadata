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
"""Persisted MySQL profiler metrics and independently observable freshness."""

import pytest
from sqlalchemy import select

from metadata.generated.schema.configuration.profilerConfiguration import MetricType

from ..features.database.entities import column, entity_exists
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


def profiler_options():
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
def test_profiler_metrics(cli, mysql):
    cli.run(mysql.invocation(MetadataPipeline(includeStoredProcedures=False)))
    for name in ("customers", "transactions", "all_types"):
        expect.poll(mysql.table_query(name)).satisfies(entity_exists)
    cli.run(mysql.invocation(profiler_options()))
    for name, count in (("customers", 5), ("transactions", 5), ("all_types", 3)):
        expect.poll(mysql.profile_query(name)).satisfies(table_has_row_count(count))
    expect.poll(mysql.profile_query("customers")).satisfies(
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
    expect.poll(mysql.profile_query("customers")).satisfies(
        column_has_metrics("first_name", valuesCount=5, nullCount=0, minLength=3, maxLength=7)
    )


@pytest.mark.e2e_contract("profile.freshness.rows")
def test_profile_row_freshness(cli, mysql, mysql_profile_table):
    filters = {"tableFilterPattern": {"includes": ["profile_values"]}}
    cli.run(mysql.invocation(MetadataPipeline(includeStoredProcedures=False), filters=filters))
    expect.poll(mysql.table_query("profile_values")).satisfies(entity_exists)
    invocation = mysql.invocation(profiler_options(), filters=filters)
    cli.run(invocation)
    query = mysql.profile_query("profile_values")
    expect.poll(query).satisfies(table_has_row_count(4))

    with mysql.source.admin_engine.begin() as connection:
        connection.execute(mysql_profile_table.insert(), {"id": 5, "score": 40})
    with mysql.source.admin_engine.connect() as connection:
        assert connection.execute(
            select(mysql_profile_table.c.score).order_by(mysql_profile_table.c.id)
        ).scalars().all() == [10, 20, 20, None, 40]
    cli.run(invocation)
    expect.poll(query).satisfies(table_has_row_count(5))


@pytest.mark.e2e_contract("profile.freshness.columns")
def test_profile_column_freshness(cli, mysql, mysql_profile_table):
    filters = {"tableFilterPattern": {"includes": ["profile_values"]}}
    cli.run(mysql.invocation(MetadataPipeline(includeStoredProcedures=False), filters=filters))
    expect.poll(mysql.table_query("profile_values")).satisfies(entity_exists)
    invocation = mysql.invocation(profiler_options(), filters=filters)
    cli.run(invocation)
    query = mysql.profile_query("profile_values")

    def initial(table):
        assert table is not None and table.profile is not None, "table profile missing"
        column_has_metrics(
            "score",
            valuesCount=3,
            nullCount=1,
            distinctCount=2,
            uniqueCount=1,
            min=10,
            max=20,
            sum=50,
            # MySQL AVG(INT) retains four fractional digits.
            mean=pytest.approx(50 / 3, abs=0.00005, rel=0),
        )(table)

    before = expect.poll(query).satisfies(initial)
    table_timestamp = before.profile.timestamp.root
    column_timestamp = column(before, "score").profile.timestamp.root
    with mysql.source.admin_engine.begin() as connection:
        connection.execute(mysql_profile_table.insert(), {"id": 5, "score": 40})
    with mysql.source.admin_engine.connect() as connection:
        assert connection.execute(
            select(mysql_profile_table.c.score).order_by(mysql_profile_table.c.id)
        ).scalars().all() == [10, 20, 20, None, 40]
    cli.run(invocation)

    def updated(table):
        assert table is not None and table.profile is not None, "table profile missing"
        column_has_metrics(
            "score", valuesCount=4, nullCount=1, distinctCount=3, uniqueCount=2, min=10, max=40, sum=90, mean=22.5
        )(table)
        assert table.profile.timestamp.root > table_timestamp
        assert column(table, "score").profile.timestamp.root > column_timestamp

    expect.poll(query).satisfies(updated)
