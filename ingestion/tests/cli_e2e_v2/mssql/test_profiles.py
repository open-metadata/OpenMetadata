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
"""Persisted MSSQL profiler metrics, including v1's TIME-UNIT partition scenario."""

import pytest

from metadata.generated.schema.entity.data.table import (
    PartitionIntervalTypes,
    PartitionIntervalUnit,
    PartitionProfilerConfig,
    TableProfilerConfig,
)

from ..features.database.entities import entity_exists
from ..features.database.pipelines import MetadataPipeline, ProfilerPipeline
from ..features.database.profiles import column_has_metrics, table_has_row_count
from ..runtime import expect
from .baseline import (
    NATIVE_TABLE,
    PARTITION_COLUMN,
    PARTITION_INTERVAL_YEARS,
    PARTITION_YEARS_INSIDE,
    PARTITIONED_TABLE,
    PERSONS_ROW_COUNT,
)

_PROFILED_TABLES = ("customers", "transactions", NATIVE_TABLE, PARTITIONED_TABLE)


def _only(*names):
    return {"tableFilterPattern": {"includes": [f"^({'|'.join(names)})$"]}}


@pytest.mark.e2e_contract("profile.metrics")
def test_profiler_metrics(cli, mssql):
    cli.run(mssql.invocation(MetadataPipeline()))
    for name in _PROFILED_TABLES:
        expect.poll(mssql.table_query(name)).satisfies(entity_exists)
    cli.run(mssql.invocation(ProfilerPipeline(useStatistics=False), filters=_only(*_PROFILED_TABLES)))
    for name, count in (
        ("customers", 5),
        ("transactions", 5),
        (NATIVE_TABLE, 1),
        (PARTITIONED_TABLE, PERSONS_ROW_COUNT),
    ):
        expect.poll(mssql.profile_query(name)).satisfies(table_has_row_count(count))
    expect.poll(mssql.profile_query("customers")).satisfies(
        column_has_metrics(
            "credit_score",
            valuesCount=5,
            nullCount=0,
            distinctCount=5,
            min=600,
            max=750,
            mean=680,
            sum=3400,
        )
    )


@pytest.mark.e2e_contract("profile.partition.time-unit")
def test_profiler_reads_only_the_time_unit_partition(cli, mssql):
    """v1's 30-YEAR window covered every seeded row; here half of them fall outside it.

    The seeds are anchored to the run date, so the window keeps selecting the same
    rows however long this suite lives.
    """
    filters = _only(PARTITIONED_TABLE)
    cli.run(mssql.invocation(MetadataPipeline(), filters=filters))
    expect.poll(mssql.table_query(PARTITIONED_TABLE)).satisfies(entity_exists)
    mssql.om.create_or_update_table_profiler_config(
        mssql.table_fqn(PARTITIONED_TABLE),
        TableProfilerConfig(
            partitioning=PartitionProfilerConfig(
                enablePartitioning=True,
                partitionColumnName=PARTITION_COLUMN,
                partitionIntervalType=PartitionIntervalTypes.TIME_UNIT,
                partitionInterval=PARTITION_INTERVAL_YEARS,
                partitionIntervalUnit=PartitionIntervalUnit.YEAR,
            )
        ),
    )
    cli.run(mssql.invocation(ProfilerPipeline(useStatistics=False), filters=filters))
    inside = len(PARTITION_YEARS_INSIDE)

    def check(profiled):
        # MSSQL table metrics read sys.dm_db_partition_stats, which describes the whole
        # table whatever the partition config says, so the window shows in the column
        # metrics only — as it does for Snowflake's INFORMATION_SCHEMA table metrics.
        table_has_row_count(PERSONS_ROW_COUNT)(profiled)
        column_has_metrics(
            "person_id",
            valuesCount=inside,
            nullCount=0,
            distinctCount=inside,
            min=1,
            max=inside,
        )(profiled)

    expect.poll(mssql.profile_query(PARTITIONED_TABLE)).satisfies(check)
