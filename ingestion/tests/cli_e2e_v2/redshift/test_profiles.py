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
"""Persisted Redshift profiler metrics, DML system metrics and TIME-UNIT partition profiling."""

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
from .baseline import (
    NATIVE_TABLE,
    PARTITION_COLUMN,
    PARTITION_INTERVAL_YEARS,
    PARTITION_YEARS_INSIDE,
    PARTITIONED_TABLE,
    PERSONS_ROW_COUNT,
    PROFILE_TABLE,
)
from .checks import system_profile_matches, system_profile_query

_PROFILED_TABLES = ("customers", "transactions", NATIVE_TABLE, PARTITIONED_TABLE)
# The connector groups a table's DML by the second it started in, so statements a
# second apart stay distinct system-profile entries.
_DML_SPACING_SECONDS = 1.5


def _only(*names):
    return {"tableFilterPattern": {"includes": [f"^({'|'.join(names)})$"]}}


@pytest.mark.e2e_contract("profile.metrics")
def test_profiler_metrics(cli, redshift):
    cli.run(redshift.invocation(MetadataPipeline()))
    for name in _PROFILED_TABLES:
        expect.poll(redshift.table_query(name)).satisfies(entity_exists)
    cli.run(redshift.invocation(ProfilerPipeline(useStatistics=False), filters=_only(*_PROFILED_TABLES)))
    for name, count in (
        ("customers", 5),
        ("transactions", 5),
        (NATIVE_TABLE, 1),
        (PARTITIONED_TABLE, PERSONS_ROW_COUNT),
    ):
        expect.poll(redshift.profile_query(name)).satisfies(table_has_row_count(count))
    expect.poll(redshift.profile_query("customers")).satisfies(
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


@pytest.mark.e2e_contract("profile.system")
def test_system_profile_attributes_dml_to_its_table(cli, redshift, redshift_secondary_source):
    """v1 checked one INSERT of 6 rows; here every DML kind, against a same-named table in another schema.

    Each kind is one statement whose row count Redshift reports itself, so the expected
    profile is exact rather than a floor.
    """
    filters = _only(PROFILE_TABLE)
    cli.run(redshift.invocation(MetadataPipeline(), filters=filters))
    expect.poll(redshift.table_query(PROFILE_TABLE)).satisfies(entity_exists)

    owned, sibling = redshift.source, redshift_secondary_source
    results = []
    for source, statement in (
        (
            owned,
            f"INSERT INTO {owned.qualified}.{PROFILE_TABLE} (id, score) VALUES (1, 10), (2, 20), (3, 20), (4, NULL)",
        ),
        (owned, f"UPDATE {owned.qualified}.{PROFILE_TABLE} SET score = 30 WHERE id = 2"),
        (owned, f"DELETE FROM {owned.qualified}.{PROFILE_TABLE} WHERE id = 4"),
        (owned, f"UPDATE {owned.qualified}.customers SET credit_score = 700 WHERE id = 1"),
        (sibling, f"INSERT INTO {sibling.qualified}.{PROFILE_TABLE} (id, score) VALUES (1, 1), (2, 2)"),
        (sibling, f"DELETE FROM {sibling.qualified}.{PROFILE_TABLE} WHERE id = 1"),
    ):
        results.append(source.dml(statement))
        time.sleep(_DML_SPACING_SECONDS)
    assert [result.rows for result in results] == [4, 1, 1, 1, 2, 1]
    since_ms = int(time.time() * 1000) - 600_000
    owned.wait_for_dml(*results)

    cli.run(
        redshift.invocation(
            ProfilerPipeline(useStatistics=False, metrics=[MetricType.rowCount, MetricType.system]), filters=filters
        )
    )
    expect.poll(redshift.profile_query(PROFILE_TABLE)).satisfies(table_has_row_count(3))
    expect.poll(system_profile_query(redshift.om, redshift.table_fqn(PROFILE_TABLE), since_ms=since_ms)).satisfies(
        system_profile_matches(
            [
                (DmlOperationType.INSERT, 4),
                (DmlOperationType.UPDATE, 1),
                (DmlOperationType.DELETE, 1),
            ]
        )
    )


@pytest.mark.e2e_contract("profile.partition.time-unit")
def test_profiler_reads_only_the_time_unit_partition(cli, redshift):
    """v1 skipped this case; here half of the seeded rows fall outside the window.

    The seeds are anchored to the run date, so the window keeps selecting the same
    rows however long this suite lives.
    """
    filters = _only(PARTITIONED_TABLE)
    cli.run(redshift.invocation(MetadataPipeline(), filters=filters))
    expect.poll(redshift.table_query(PARTITIONED_TABLE)).satisfies(entity_exists)
    redshift.om.create_or_update_table_profiler_config(
        redshift.table_fqn(PARTITIONED_TABLE),
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
    cli.run(redshift.invocation(ProfilerPipeline(useStatistics=False), filters=filters))
    inside = len(PARTITION_YEARS_INSIDE)
    expect.poll(redshift.profile_query(PARTITIONED_TABLE)).satisfies(
        column_has_metrics("person_id", valuesCount=inside, nullCount=0, distinctCount=inside, min=1, max=inside)
    )
