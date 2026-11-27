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

"""Partition utility"""

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
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.ingestion.ometa.utils import model_str
from metadata.sampler.models import TableConfig
from metadata.utils.logger import sampler_logger

logger = sampler_logger()


def validate_athena_injected_partitioning(
    table_partitions: TablePartition,
    table_profiler_config: TableProfilerConfig | None,
    profiler_partitioning_config: PartitionProfilerConfig | None,
) -> None:
    """Validate Athena partitioning. Injected partition need to be defined
    in the table profiler c onfig for the profiler to work correctly. We'll throw an
    error if the partitioning is not defined in the table profiler config.

    Attr:
        entity (Table): entity table
    """
    error_msg = (
        "Table profiler config is missing for table with injected partitioning. Please define "
        "the partitioning in the table profiler config for column {column_name}. "
        "For more information, visit "
        "https://docs.open-metadata.org/v1.3.x/connectors/ingestion/workflows/profiler#profiler-options "
    )

    column_partitions: list[PartitionColumnDetails] | None = table_partitions.columns
    if not column_partitions:
        raise RuntimeError("Table partition is set but no columns are defined.")

    for column_partition in column_partitions:
        if column_partition.intervalType == PartitionIntervalTypes.INJECTED:
            if table_profiler_config is None or profiler_partitioning_config is None:
                raise RuntimeError(error_msg.format(column_name=column_partition.columnName))

            if profiler_partitioning_config.partitionColumnName != column_partition.columnName:
                raise RuntimeError(error_msg.format(column_name=column_partition.columnName))


def get_partition_details(
    entity: Table,
    entity_config: TableConfig | None = None,
    auto_detect_partition: bool | None = None,
) -> PartitionProfilerConfig | None:
    """Build PartitionProfilerConfig object from entity

    Args:
        entity (Table): entity table
        entity_config (TableConfig): per-table partition config from the workflow, always takes priority
        auto_detect_partition (bool | None): True infers the partition config from `tablePartition` for
            any service, False never infers it. None keeps the BigQuery-only inference used by the
            workflows that do not expose the setting (test suites, auto classification).
    Returns:
        PartitionProfilerConfig
    """
    if entity_config:
        return entity_config.partitionConfig

    # Gather service type information
    service_type = getattr(entity, "serviceType", None)

    # Gather table partitioning information
    table_partition = getattr(entity, "tablePartition", None)

    # Profiler config
    profiler_partitioning_config: PartitionProfilerConfig | None = None
    profiler_config: TableProfilerConfig | None = getattr(entity, "tableProfilerConfig", None)
    if profiler_config:
        profiler_partitioning_config = getattr(profiler_config, "partitioning", None)

    if table_partition and service_type == DatabaseServiceType.Athena:
        # if table is an Athena table and it has been partitioned we need to validate injected partitioning
        validate_athena_injected_partitioning(table_partition, profiler_config, profiler_partitioning_config)
        return profiler_partitioning_config

    if profiler_partitioning_config:
        # if table has partitioning defined in the profiler config, return it
        return profiler_partitioning_config

    if auto_detect_partition is None:
        auto_detect_partition = service_type == DatabaseServiceType.BigQuery

    if not auto_detect_partition or not table_partition:
        return None

    partition_config = _infer_partition_config(entity, table_partition, service_type)
    if partition_config:
        logger.info(
            "Auto-detected %s partitioning on column '%s' for table %s. "
            "Define the partitioning in the table profiler config to override it.",
            getattr(partition_config.partitionIntervalType, "value", None),
            partition_config.partitionColumnName,
            model_str(entity.fullyQualifiedName),
        )
    return partition_config


_GRANULARITY_WINDOW: dict[str, tuple[PartitionIntervalUnit, int]] = {
    # (unit, interval) pairs sized so even lagging tables yield non-empty samples.
    # HOUR: 24 h covers any table updated less frequently than once per hour.
    # DAY:  3 days covers common ~2-day ingestion delays (e.g. GA4 exports).
    # MONTH/YEAR: sized to exceed one full period so monthly/yearly tables are not
    #             silently empty when the most-recent partition is > 3 days old.
    "HOUR": (PartitionIntervalUnit.HOUR, 24),
    "DAY": (PartitionIntervalUnit.DAY, 3),
    "MONTH": (PartitionIntervalUnit.DAY, 35),
    "YEAR": (PartitionIntervalUnit.DAY, 370),
}

DEFAULT_INTEGER_RANGE_START = 1
DEFAULT_INTEGER_RANGE_END = 10000

# Several sources report every partition key as TIME_UNIT (e.g. Postgres range partitions, Doris,
# StarRocks) even when the key is an integer or a string. The date arithmetic filter only compiles
# against temporal columns, so the column type is checked before trusting the reported interval type.
_TIME_PARTITION_DATA_TYPES = frozenset({DataType.DATE, DataType.DATETIME, DataType.TIMESTAMP, DataType.TIMESTAMPZ})
_INTEGER_PARTITION_DATA_TYPES = frozenset(
    {
        DataType.TINYINT,
        DataType.SMALLINT,
        DataType.INT,
        DataType.BIGINT,
        DataType.BYTEINT,
        DataType.LONG,
        DataType.NUMBER,
        DataType.NUMERIC,
        DataType.DECIMAL,
    }
)


def _window_for_granularity(
    interval: str | None,
) -> tuple[PartitionIntervalUnit, int]:
    """Return (unit, count) for the default profiler window matching *interval*."""
    return _GRANULARITY_WINDOW.get((interval or "").upper(), (PartitionIntervalUnit.DAY, 3))


def _get_partition_column(entity: Table, column_name: str | None) -> Column | None:
    if not column_name:
        return None
    for column in entity.columns or []:
        if model_str(column.name) == column_name:
            return column
    # Quoted identifiers can differ only by case. A folded match is safe only when it is unique.
    matches = [column for column in entity.columns or [] if model_str(column.name).lower() == column_name.lower()]
    return matches[0] if len(matches) == 1 else None


def _infer_partition_config(
    entity: Table,
    table_partition: TablePartition,
    service_type: DatabaseServiceType | None,
) -> PartitionProfilerConfig | None:
    """Infer the profiler partition config from the partition metadata collected during ingestion.
    Only the first partition column is used, matching the BigQuery behavior.
    """
    if service_type == DatabaseServiceType.BigQuery:
        return _handle_bigquery_partition(entity, table_partition)

    if not table_partition.columns:
        return None

    partition = table_partition.columns[0]
    column = _get_partition_column(entity, partition.columnName)
    column_type = column.dataType if column else None

    if (
        column
        and partition.intervalType == PartitionIntervalTypes.TIME_UNIT
        and column_type in _TIME_PARTITION_DATA_TYPES
    ):
        interval_unit, interval = _window_for_granularity(partition.interval)
        return PartitionProfilerConfig(
            enablePartitioning=True,
            partitionColumnName=model_str(column.name),
            partitionIntervalUnit=interval_unit,
            partitionInterval=interval,
            partitionIntervalType=partition.intervalType,
            partitionValues=None,
            partitionIntegerRangeStart=None,
            partitionIntegerRangeEnd=None,
        )

    if (
        column
        and partition.intervalType == PartitionIntervalTypes.INTEGER_RANGE
        and column_type in _INTEGER_PARTITION_DATA_TYPES
    ):
        return PartitionProfilerConfig(
            enablePartitioning=True,
            partitionColumnName=model_str(column.name),
            partitionIntervalUnit=None,
            partitionInterval=None,
            partitionIntervalType=partition.intervalType,
            partitionValues=None,
            partitionIntegerRangeStart=DEFAULT_INTEGER_RANGE_START,
            partitionIntegerRangeEnd=DEFAULT_INTEGER_RANGE_END,
        )

    interval_type = partition.intervalType.value if partition.intervalType else None
    logger.debug(
        "Cannot auto-detect partitioning for table %s: partition column '%s' has interval type %s and "
        "data type %s. Configure the partitioning in the table profiler config to profile a subset of "
        "the partitions.",
        model_str(entity.fullyQualifiedName),
        partition.columnName,
        interval_type,
        column_type.value if column_type else None,
    )
    return None


def _handle_bigquery_partition(entity: Table, table_partition: TablePartition) -> PartitionProfilerConfig | None:
    """Bigquery specific logic for partitions"""
    if table_partition:
        column_partitions: list[PartitionColumnDetails] | None = entity.tablePartition.columns
        if not column_partitions:
            raise TypeError("table partition missing. Skipping table")

        partition = column_partitions[0]

        if partition.intervalType == PartitionIntervalTypes.TIME_UNIT:
            interval_unit, interval_days = _window_for_granularity(partition.interval)
            return PartitionProfilerConfig(
                enablePartitioning=True,
                partitionColumnName=partition.columnName,
                partitionIntervalUnit=interval_unit,
                partitionInterval=interval_days,
                partitionIntervalType=partition.intervalType.value,
                partitionValues=None,
                partitionIntegerRangeStart=None,
                partitionIntegerRangeEnd=None,
            )
        if partition.intervalType == PartitionIntervalTypes.INGESTION_TIME:
            interval_unit, interval_days = _window_for_granularity(partition.interval)
            return PartitionProfilerConfig(
                enablePartitioning=True,
                partitionColumnName="_PARTITIONDATE" if partition.interval == "DAY" else "_PARTITIONTIME",
                partitionIntervalUnit=interval_unit,
                partitionInterval=interval_days,
                partitionIntervalType=partition.intervalType.value,
                partitionValues=None,
                partitionIntegerRangeStart=None,
                partitionIntegerRangeEnd=None,
            )
        if partition.intervalType == PartitionIntervalTypes.INTEGER_RANGE:
            return PartitionProfilerConfig(
                enablePartitioning=True,
                partitionColumnName=partition.columnName,
                partitionIntervalUnit=None,
                partitionInterval=None,
                partitionIntervalType=partition.intervalType.value,
                partitionValues=None,
                partitionIntegerRangeStart=DEFAULT_INTEGER_RANGE_START,
                partitionIntegerRangeEnd=DEFAULT_INTEGER_RANGE_END,
            )
        # TODO: Allow External Hive Partitioning for profiler
        logger.info(
            f"Unknown partition type {partition.intervalType}. Cannot infer partition. Partitionning "
            "will be set to None. If partitionning is required for your table, you can set it "
            "directly in the table config. More information can be found at "
            "https://docs.open-metadata.org/latest/how-to-guides/data-quality-observability/profiler/"
            "workflow#4.-updating-profiler-setting-at-the-table-level"
        )

    return None
