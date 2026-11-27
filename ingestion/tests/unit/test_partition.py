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

"""Partition utility tests"""

import logging
from types import SimpleNamespace

import pytest
from pydantic import BaseModel
from sqlalchemy import DATE, DATETIME, MetaData
from sqlalchemy import Column as SQAColumn
from sqlalchemy import Table as SQATable
from sqlalchemy.engine.default import DefaultDialect

from metadata.generated.schema.entity.data.table import (
    Column,
    DataType,
    PartitionColumnDetails,
    PartitionIntervalTypes,
    PartitionIntervalUnit,
    PartitionProfilerConfig,
    Table,
    TablePartition,
    TableProfilerConfig,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.profiler.orm.types.custom_timestamp import CustomTimestamp
from metadata.profiler.processor.handle_partition import build_partition_predicate
from metadata.profiler.source.database.base.profiler_source import ProfilerSource
from metadata.sampler.models import TableConfig
from metadata.sampler.partition import get_partition_details
from metadata.utils.logger import sampler_logger


class MockTable(BaseModel):
    fullyQualifiedName: FullyQualifiedEntityName = FullyQualifiedEntityName("service.db.schema.table")  # noqa: N815
    tablePartition: TablePartition | None = None  # noqa: N815
    tableProfilerConfig: TableProfilerConfig | None = None  # noqa: N815
    serviceType: DatabaseServiceType = DatabaseServiceType.BigQuery  # noqa: N815

    class Config:
        arbitrary_types_allowed = True


class MockRedshiftTable(BaseModel):
    fullyQualifiedName: FullyQualifiedEntityName = FullyQualifiedEntityName("service.db.schema.table")  # noqa: N815
    tablePartition: TablePartition | None = None  # noqa: N815
    tableProfilerConfig: TableProfilerConfig | None = None  # noqa: N815
    serviceType: DatabaseServiceType = DatabaseServiceType.Redshift  # noqa: N815

    class Config:
        arbitrary_types_allowed = True


class MockAthenaTable(BaseModel):
    fullyQualifiedName: FullyQualifiedEntityName = FullyQualifiedEntityName("service.db.schema.table")  # noqa: N815
    tablePartition: TablePartition | None = None  # noqa: N815
    tableProfilerConfig: TableProfilerConfig | None = None  # noqa: N815
    serviceType: DatabaseServiceType = DatabaseServiceType.Athena  # noqa: N815

    class Config:
        arbitrary_types_allowed = True


def test_get_partition_details():
    """test get_partition_details function"""
    table_entity = MockRedshiftTable(
        tableProfilerConfig=TableProfilerConfig(
            partitioning=PartitionProfilerConfig(
                enablePartitioning=True,
                partitionColumnName="order_date",
                partitionIntervalType="TIME-UNIT",
                partitionInterval=5,
                partitionIntervalUnit="YEAR",
                partitionValues=None,
            )
        )
    )  # type: ignore

    partition = get_partition_details(table_entity)

    assert partition.enablePartitioning == True  # noqa: E712
    assert partition.partitionColumnName == "order_date"
    assert partition.partitionIntervalType == PartitionIntervalTypes.TIME_UNIT
    assert partition.partitionInterval == 5
    assert partition.partitionIntervalUnit == PartitionIntervalUnit.YEAR

    table_entity = MockTable(
        tablePartition=TablePartition(
            columns=[
                PartitionColumnDetails(
                    columnName="e",
                    intervalType=PartitionIntervalTypes.INGESTION_TIME,
                    interval="HOUR",
                )
            ]
        ),
        tableProfilerConfig=None,
    )

    partition = get_partition_details(table_entity)

    assert partition.enablePartitioning == True  # noqa: E712
    assert partition.partitionColumnName == "_PARTITIONTIME"
    assert partition.partitionIntervalType == PartitionIntervalTypes.INGESTION_TIME
    # Hourly ingestion-time partitions use a 24-hour window so tables updated less
    # frequently than every hour still produce non-empty samples.
    assert partition.partitionInterval == 24
    assert partition.partitionIntervalUnit == PartitionIntervalUnit.HOUR

    table_entity = MockTable(
        tablePartition=TablePartition(
            columns=[
                PartitionColumnDetails(
                    columnName="e",
                    intervalType=PartitionIntervalTypes.INGESTION_TIME,
                    interval="DAY",
                )
            ]
        ),
        tableProfilerConfig=None,
    )

    partition = get_partition_details(table_entity)

    assert partition.enablePartitioning is True
    assert partition.partitionColumnName == "_PARTITIONDATE"
    assert partition.partitionIntervalType == PartitionIntervalTypes.INGESTION_TIME
    # Daily ingestion-time partitions use a 3-day window so tables with common
    # ingestion delays (e.g. GA4's ~2-day lag) still produce non-empty samples.
    assert partition.partitionInterval == 3
    assert partition.partitionIntervalUnit == PartitionIntervalUnit.DAY


def test_athena_injected_partition():
    """Test injected partitioning for athena table"""
    entity = MockAthenaTable(
        tablePartition=TablePartition(
            columns=[
                PartitionColumnDetails(
                    columnName="e",
                    intervalType=PartitionIntervalTypes.INJECTED,
                    interval=None,
                )
            ]
        ),
        tableProfilerConfig=None,
    )

    with pytest.raises(
        RuntimeError,
        match="Table profiler config is missing for table with injected partitioning. Please define the partitioning in the table profiler config for column e",  # noqa: RUF043
    ):
        # As athena table has injected partitioning, it should raise an error
        # since we have not provided any partitioning details for the injected partition
        get_partition_details(entity)

    profiler_config = TableProfilerConfig(
        partitioning=PartitionProfilerConfig(
            enablePartitioning=True,
            partitionColumnName="e",
            partitionIntervalType="COLUMN-VALUE",
            partitionValues=["red"],
        )
    )

    entity.tableProfilerConfig = profiler_config

    partition = get_partition_details(entity)

    assert partition.enablePartitioning == True  # noqa: E712
    assert partition.partitionColumnName == "e"
    assert partition.partitionIntervalType == PartitionIntervalTypes.COLUMN_VALUE
    assert partition.partitionValues == ["red"]


def test_bigquery_time_unit_partition_default_intervals():
    """Auto-detected BigQuery TIME_UNIT partitions use wider default windows.

    Previously the default was 1 (day / hour), which silently produced empty
    samples for any table whose freshest partition is older than 1 day/hour —
    a common situation for GA4 exports or any table with an ingestion lag.
    The new defaults are 3 days (DAY granularity) and 24 hours (HOUR granularity).
    """
    # DAY granularity → 3-day window
    day_entity = MockTable(
        tablePartition=TablePartition(
            columns=[
                PartitionColumnDetails(
                    columnName="event_date",
                    intervalType=PartitionIntervalTypes.TIME_UNIT,
                    interval="DAY",
                )
            ]
        ),
        tableProfilerConfig=None,
    )
    partition = get_partition_details(day_entity)

    assert partition.enablePartitioning is True
    assert partition.partitionColumnName == "event_date"
    assert partition.partitionIntervalType == PartitionIntervalTypes.TIME_UNIT
    assert partition.partitionIntervalUnit == PartitionIntervalUnit.DAY
    assert partition.partitionInterval == 3, (
        "DAY-granularity TIME_UNIT partitions should default to a 3-day window "
        "so tables with a ~2-day ingestion lag (e.g. GA4 exports) are still sampled."
    )

    # HOUR granularity → 24-hour window
    hour_entity = MockTable(
        tablePartition=TablePartition(
            columns=[
                PartitionColumnDetails(
                    columnName="event_timestamp",
                    intervalType=PartitionIntervalTypes.TIME_UNIT,
                    interval="HOUR",
                )
            ]
        ),
        tableProfilerConfig=None,
    )
    partition = get_partition_details(hour_entity)

    assert partition.enablePartitioning is True
    assert partition.partitionColumnName == "event_timestamp"
    assert partition.partitionIntervalType == PartitionIntervalTypes.TIME_UNIT
    assert partition.partitionIntervalUnit == PartitionIntervalUnit.HOUR
    assert partition.partitionInterval == 24, (
        "HOUR-granularity TIME_UNIT partitions should default to a 24-hour window."
    )

    # MONTH granularity → 35-day window
    month_entity = MockTable(
        tablePartition=TablePartition(
            columns=[
                PartitionColumnDetails(
                    columnName="report_month",
                    intervalType=PartitionIntervalTypes.TIME_UNIT,
                    interval="MONTH",
                )
            ]
        ),
        tableProfilerConfig=None,
    )
    partition = get_partition_details(month_entity)

    assert partition.enablePartitioning is True
    assert partition.partitionColumnName == "report_month"
    assert partition.partitionIntervalType == PartitionIntervalTypes.TIME_UNIT
    assert partition.partitionIntervalUnit == PartitionIntervalUnit.DAY
    assert partition.partitionInterval == 35, (
        "MONTH-granularity TIME_UNIT partitions need a 35-day window so the most-recent "
        "monthly partition (which may be 31+ days old mid-cycle) is still sampled."
    )

    # YEAR granularity → 370-day window
    year_entity = MockTable(
        tablePartition=TablePartition(
            columns=[
                PartitionColumnDetails(
                    columnName="report_year",
                    intervalType=PartitionIntervalTypes.TIME_UNIT,
                    interval="YEAR",
                )
            ]
        ),
        tableProfilerConfig=None,
    )
    partition = get_partition_details(year_entity)

    assert partition.enablePartitioning is True
    assert partition.partitionColumnName == "report_year"
    assert partition.partitionIntervalType == PartitionIntervalTypes.TIME_UNIT
    assert partition.partitionIntervalUnit == PartitionIntervalUnit.DAY
    assert partition.partitionInterval == 370, (
        "YEAR-granularity TIME_UNIT partitions need a 370-day window so the current "
        "yearly partition (up to ~365 days old at year-end) is still sampled."
    )


def _table(
    service_type: DatabaseServiceType,
    partition: PartitionColumnDetails | None,
    columns: dict[str, DataType],
    profiler_config: TableProfilerConfig | None = None,
) -> Table:
    return Table(
        id="2aaa012e-099a-11ed-861d-0242ac120002",
        name="orders",
        fullyQualifiedName="service.db.schema.orders",
        serviceType=service_type,
        columns=[Column(name=name, dataType=data_type) for name, data_type in columns.items()],
        tablePartition=TablePartition(columns=[partition]) if partition else None,
        tableProfilerConfig=profiler_config,
    )


@pytest.mark.parametrize(
    "service_type,data_type,interval,expected_unit,expected_interval",
    [
        (DatabaseServiceType.Postgres, DataType.DATE, None, PartitionIntervalUnit.DAY, 3),
        (DatabaseServiceType.Timescale, DataType.TIMESTAMPZ, "604800000000 microseconds", PartitionIntervalUnit.DAY, 3),
        (DatabaseServiceType.Doris, DataType.DATETIME, None, PartitionIntervalUnit.DAY, 3),
        (DatabaseServiceType.StarRocks, DataType.TIMESTAMP, "HOUR", PartitionIntervalUnit.HOUR, 24),
        (DatabaseServiceType.Greenplum, DataType.DATE, "month", PartitionIntervalUnit.DAY, 35),
    ],
)
def test_auto_detect_time_unit_partition(service_type, data_type, interval, expected_unit, expected_interval):
    entity = _table(
        service_type,
        PartitionColumnDetails(
            columnName="Order_Date", intervalType=PartitionIntervalTypes.TIME_UNIT, interval=interval
        ),
        {"order_date": data_type, "amount": DataType.INT},
    )

    partition = get_partition_details(entity, auto_detect_partition=True)

    assert partition == PartitionProfilerConfig(
        enablePartitioning=True,
        partitionColumnName="order_date",
        partitionIntervalType=PartitionIntervalTypes.TIME_UNIT,
        partitionIntervalUnit=expected_unit,
        partitionInterval=expected_interval,
    )


def test_auto_detect_integer_range_partition():
    entity = _table(
        DatabaseServiceType.Timescale,
        PartitionColumnDetails(columnName="id", intervalType=PartitionIntervalTypes.INTEGER_RANGE, interval="1000"),
        {"id": DataType.BIGINT},
    )

    partition = get_partition_details(entity, auto_detect_partition=True)

    assert partition == PartitionProfilerConfig(
        enablePartitioning=True,
        partitionColumnName="id",
        partitionIntervalType=PartitionIntervalTypes.INTEGER_RANGE,
        partitionIntegerRangeStart=1,
        partitionIntegerRangeEnd=10000,
    )


def test_bigquery_integer_range_inference_is_preserved():
    entity = _table(
        DatabaseServiceType.BigQuery,
        PartitionColumnDetails(columnName="id", intervalType=PartitionIntervalTypes.INTEGER_RANGE),
        {"id": DataType.BIGINT},
    )

    partition = get_partition_details(entity, auto_detect_partition=True)

    assert partition.partitionColumnName == "id"
    assert partition.partitionIntegerRangeStart == 1
    assert partition.partitionIntegerRangeEnd == 10000


@pytest.mark.parametrize(
    "interval_type,data_type",
    [
        (PartitionIntervalTypes.COLUMN_VALUE, DataType.VARCHAR),
        (PartitionIntervalTypes.INJECTED, DataType.DATE),
        (PartitionIntervalTypes.ENUM, DataType.DATE),
        (PartitionIntervalTypes.OTHER, DataType.DATE),
        (PartitionIntervalTypes.INGESTION_TIME, DataType.TIMESTAMP),
        # Postgres reports every range partition as TIME_UNIT and Doris/StarRocks every partition key,
        # a date filter on these columns would fail at query time.
        (PartitionIntervalTypes.TIME_UNIT, DataType.INT),
        (PartitionIntervalTypes.TIME_UNIT, DataType.VARCHAR),
        (PartitionIntervalTypes.INTEGER_RANGE, DataType.DATE),
        (None, DataType.DATE),
    ],
)
def test_auto_detect_skips_partitions_without_a_usable_filter(interval_type, data_type):
    entity = _table(
        DatabaseServiceType.Postgres,
        PartitionColumnDetails(columnName="part", intervalType=interval_type),
        {"part": data_type},
    )

    assert get_partition_details(entity, auto_detect_partition=True) is None


def test_auto_detect_skips_partition_column_missing_from_table():
    entity = _table(
        DatabaseServiceType.Postgres,
        PartitionColumnDetails(columnName="part", intervalType=PartitionIntervalTypes.TIME_UNIT),
        {"other": DataType.DATE},
    )

    assert get_partition_details(entity, auto_detect_partition=True) is None


def test_auto_detect_preserves_the_table_column_spelling():
    entity = _table(
        DatabaseServiceType.Postgres,
        PartitionColumnDetails(columnName="ORDER_DATE", intervalType=PartitionIntervalTypes.TIME_UNIT),
        {"order_date": DataType.DATE},
    )

    partition = get_partition_details(entity, auto_detect_partition=True)

    assert partition.partitionColumnName == "order_date"


@pytest.mark.parametrize(
    "service_type,dialect_name,timestamp_cast",
    [
        (DatabaseServiceType.Postgres, "postgresql", "TIMESTAMP"),
        (DatabaseServiceType.Cockroach, "cockroachdb", "TIMESTAMP"),
        (DatabaseServiceType.Greenplum, "postgresql", "TIMESTAMP"),
        (DatabaseServiceType.Timescale, "postgresql", "TIMESTAMP"),
        (DatabaseServiceType.Doris, "pydoris", "DATETIME"),
        (DatabaseServiceType.StarRocks, "starrocks", "DATETIME"),
    ],
)
@pytest.mark.parametrize("data_type", [DataType.DATE, DataType.DATETIME, DataType.TIMESTAMP, DataType.TIMESTAMPZ])
def test_inferred_partition_compiles_for_supported_dialects(service_type, dialect_name, timestamp_cast, data_type):
    entity = _table(
        service_type,
        PartitionColumnDetails(columnName="ORDER_DATE", intervalType=PartitionIntervalTypes.TIME_UNIT),
        {"order_date": data_type},
    )
    sqa_type = {DataType.DATE: DATE, DataType.DATETIME: DATETIME}.get(data_type, CustomTimestamp)
    columns = SQATable("orders", MetaData(), SQAColumn("order_date", sqa_type())).c
    dialect = DefaultDialect()
    dialect.name = dialect_name
    partition = get_partition_details(entity, auto_detect_partition=True)

    sql = str(
        build_partition_predicate(partition, columns).compile(dialect=dialect, compile_kwargs={"literal_binds": True})
    )

    if data_type == DataType.DATE:
        assert sql == "order_date >= CAST(CURRENT_DATE - interval '3' DAY  AS DATE)"
    else:
        assert sql == f"order_date >= CAST(CURRENT_TIMESTAMP - interval '3' DAY AS {timestamp_cast})"


@pytest.mark.parametrize("partition_column", ["order_date", "Order_Date"])
def test_auto_detect_prefers_an_exact_column_match(partition_column):
    entity = _table(
        DatabaseServiceType.Postgres,
        PartitionColumnDetails(columnName=partition_column, intervalType=PartitionIntervalTypes.TIME_UNIT),
        {"order_date": DataType.INT, "Order_Date": DataType.DATE},
    )

    partition = get_partition_details(entity, auto_detect_partition=True)

    if partition_column == "order_date":
        assert partition is None
    else:
        assert partition.partitionColumnName == "Order_Date"


def test_auto_detect_skips_an_ambiguous_column_match():
    entity = _table(
        DatabaseServiceType.Postgres,
        PartitionColumnDetails(columnName="ORDER_DATE", intervalType=PartitionIntervalTypes.TIME_UNIT),
        {"order_date": DataType.DATE, "Order_Date": DataType.DATE},
    )

    assert get_partition_details(entity, auto_detect_partition=True) is None


def test_auto_detect_uses_first_partition_column():
    entity = _table(DatabaseServiceType.Doris, None, {"region": DataType.VARCHAR, "day": DataType.DATE})
    entity.tablePartition = TablePartition(
        columns=[
            PartitionColumnDetails(columnName="region", intervalType=PartitionIntervalTypes.TIME_UNIT),
            PartitionColumnDetails(columnName="day", intervalType=PartitionIntervalTypes.TIME_UNIT),
        ]
    )

    assert get_partition_details(entity, auto_detect_partition=True) is None


def test_manual_partition_config_wins_over_auto_detection():
    manual = PartitionProfilerConfig(
        enablePartitioning=True,
        partitionColumnName="region",
        partitionIntervalType=PartitionIntervalTypes.COLUMN_VALUE,
        partitionValues=["EU"],
    )
    entity = _table(
        DatabaseServiceType.Postgres,
        PartitionColumnDetails(columnName="order_date", intervalType=PartitionIntervalTypes.TIME_UNIT),
        {"order_date": DataType.DATE, "region": DataType.VARCHAR},
        profiler_config=TableProfilerConfig(partitioning=manual),
    )

    assert get_partition_details(entity, auto_detect_partition=True) == manual


@pytest.mark.parametrize("auto_detect_partition", [True, False])
def test_workflow_partition_config_wins_over_table_settings(auto_detect_partition):
    entity = _table(
        DatabaseServiceType.Postgres,
        PartitionColumnDetails(columnName="order_date", intervalType=PartitionIntervalTypes.TIME_UNIT),
        {"order_date": DataType.DATE},
        profiler_config=TableProfilerConfig(
            partitioning=PartitionProfilerConfig(partitionColumnName="order_date", partitionInterval=7)
        ),
    )
    workflow_partition = PartitionProfilerConfig(enablePartitioning=False)
    workflow_config = TableConfig(fullyQualifiedName=entity.fullyQualifiedName, partitionConfig=workflow_partition)

    assert get_partition_details(entity, workflow_config, auto_detect_partition) == workflow_partition


def test_disabled_auto_detection_returns_no_partition():
    for service_type in (DatabaseServiceType.Postgres, DatabaseServiceType.BigQuery):
        entity = _table(
            service_type,
            PartitionColumnDetails(
                columnName="order_date", intervalType=PartitionIntervalTypes.TIME_UNIT, interval="DAY"
            ),
            {"order_date": DataType.DATE},
        )
        assert get_partition_details(entity, auto_detect_partition=False) is None


def test_unset_auto_detection_keeps_bigquery_only_inference():
    """Test suites and auto classification do not pass the setting and keep the previous behavior."""
    partition = PartitionColumnDetails(
        columnName="order_date", intervalType=PartitionIntervalTypes.TIME_UNIT, interval="DAY"
    )

    postgres = _table(DatabaseServiceType.Postgres, partition, {"order_date": DataType.DATE})
    bigquery = _table(DatabaseServiceType.BigQuery, partition, {"order_date": DataType.DATE})

    assert get_partition_details(postgres) is None
    assert get_partition_details(bigquery).partitionColumnName == "order_date"


def test_auto_detection_keeps_athena_injected_validation():
    entity = _table(
        DatabaseServiceType.Athena,
        PartitionColumnDetails(columnName="dt", intervalType=PartitionIntervalTypes.INJECTED),
        {"dt": DataType.DATE},
    )

    with pytest.raises(RuntimeError, match="Table profiler config is missing"):
        get_partition_details(entity, auto_detect_partition=True)


def test_auto_detection_logs_applied_partitioning(caplog):
    entity = _table(
        DatabaseServiceType.Postgres,
        PartitionColumnDetails(columnName="order_date", intervalType=PartitionIntervalTypes.TIME_UNIT),
        {"order_date": DataType.DATE},
    )

    with caplog.at_level(logging.INFO, logger=sampler_logger().name):
        get_partition_details(entity, auto_detect_partition=True)

    assert any(
        record.levelno == logging.INFO
        and "order_date" in record.getMessage()
        and "service.db.schema.orders" in record.getMessage()
        for record in caplog.records
    )


_POSTGRES = {"hostPort": "localhost:5432", "username": "user", "database": "db"}
_SNOWFLAKE = {"account": "acc", "username": "user", "warehouse": "wh"}


@pytest.mark.parametrize(
    "service_conn_config,pipeline_config,expected",
    [
        (PostgresConnection(**_POSTGRES), {}, True),
        (PostgresConnection(**_POSTGRES), {"enableAutoPartitionDetection": False}, False),
        (PostgresConnection(**_POSTGRES, supportsAutoPartitionDetection=False), {}, False),
        (SnowflakeConnection(**_SNOWFLAKE), {}, False),
    ],
)
def test_profiler_auto_detect_partition_setting(service_conn_config, pipeline_config, expected):
    """The pipeline toggle only applies to services whose connection declares support for it."""
    source = SimpleNamespace(
        source_config=DatabaseServiceProfilerPipeline(**pipeline_config),
        service_conn_config=service_conn_config,
    )

    assert ProfilerSource._auto_detect_partition(source) is expected
