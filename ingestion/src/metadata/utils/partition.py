#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Partition utility"""

from typing import List, Optional

from metadata.generated.schema.entity.data.table import (
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


def validate_athena_injected_partitioning(
    table_partitions: TablePartition,
    table_profiler_config: Optional[TableProfilerConfig],
    profiler_partitioning_config: Optional[PartitionProfilerConfig],
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

    column_partitions: Optional[List[PartitionColumnDetails]] = table_partitions.columns
    if not column_partitions:
        raise RuntimeError("Table parition is set but no columns are defined.")

    for column_partition in column_partitions:
        if column_partition.intervalType == PartitionIntervalTypes.INJECTED:
            if table_profiler_config is None or profiler_partitioning_config is None:
                raise RuntimeError(
                    error_msg.format(column_name=column_partition.columnName)
                )

            if (
                profiler_partitioning_config.partitionColumnName
                != column_partition.columnName
            ):
                raise RuntimeError(
                    error_msg.format(column_name=column_partition.columnName)
                )


def get_partition_details(entity: Table) -> Optional[PartitionProfilerConfig]:
    """Build PartitionProfilerConfig object from entity

    Args:
        entity (Table): entity table
    Returns:
        PartitionProfilerConfig
    """
    # Gather service type information
    service_type = getattr(entity, "serviceType", None)

    # Gather table partitioning information
    table_partition = getattr(entity, "tablePartition", None)

    # Profiler config
    profiler_partitioning_config: Optional[PartitionProfilerConfig] = None
    profiler_config: Optional[TableProfilerConfig] = getattr(
        entity, "tableProfilerConfig", None
    )
    if profiler_config:
        profiler_partitioning_config = getattr(profiler_config, "partitioning", None)

    if table_partition and service_type == DatabaseServiceType.Athena:
        # if table is an Athena table and it has been partitioned we need to validate injected partitioning
        validate_athena_injected_partitioning(
            table_partition, profiler_config, profiler_partitioning_config
        )
        return profiler_partitioning_config

    if profiler_partitioning_config:
        # if table has partitioning defined in the profiler config, return it
        return profiler_partitioning_config

    if service_type == DatabaseServiceType.BigQuery:
        if table_partition:
            column_partitions: Optional[
                List[PartitionColumnDetails]
            ] = entity.tablePartition.columns
            if not column_partitions:
                raise TypeError("table partition missing. Skipping table")

            partiton = column_partitions[0]

            if partiton.intervalType == PartitionIntervalTypes.TIME_UNIT:
                return PartitionProfilerConfig(
                    enablePartitioning=True,
                    partitionColumnName=partiton.columnName,
                    partitionIntervalUnit=PartitionIntervalUnit.DAY
                    if partiton.interval != "HOUR"
                    else partiton.interval,
                    partitionInterval=1,
                    partitionIntervalType=partiton.intervalType.value,
                    partitionValues=None,
                    partitionIntegerRangeStart=None,
                    partitionIntegerRangeEnd=None,
                )
            if partiton.intervalType == PartitionIntervalTypes.INGESTION_TIME:
                return PartitionProfilerConfig(
                    enablePartitioning=True,
                    partitionColumnName="_PARTITIONDATE"
                    if partiton.interval == "DAY"
                    else "_PARTITIONTIME",
                    partitionIntervalUnit=PartitionIntervalUnit.DAY
                    if partiton.interval != "HOUR"
                    else partiton.interval,
                    partitionInterval=1,
                    partitionIntervalType=partiton.intervalType.value,
                    partitionValues=None,
                    partitionIntegerRangeStart=None,
                    partitionIntegerRangeEnd=None,
                )
            if partiton.intervalType == PartitionIntervalTypes.INTEGER_RANGE:
                return PartitionProfilerConfig(
                    enablePartitioning=True,
                    partitionColumnName=partiton.columnName,
                    partitionIntervalUnit=None,
                    partitionInterval=None,
                    partitionIntervalType=partiton.intervalType.value,
                    partitionValues=None,
                    partitionIntegerRangeStart=1,
                    partitionIntegerRangeEnd=10000,
                )
            raise TypeError(
                f"Unsupported partition type {partiton.intervalType}. Skipping table"
            )

    return None
