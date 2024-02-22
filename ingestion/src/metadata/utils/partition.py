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
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)

def validate_athena_injected_partitioning(entity: Table) -> None:
    """Validate Athena partitioning. Injected partition need to be defined
    in the table profiler config for the profiler to work correctly. We'll throw an
    error if the partitioning is not defined in the table profiler config.

    Attr:
        entity (Table): entity table
    """
    error_msg = (
        "Table profiler config is missing for table with injected partitioning. Please define "
        "the partitioning in the table profiler config for column {column_name}."
    )

    if (
        (hasattr(entity, "serviceType") and entity.serviceType != DatabaseServiceType.Athena) or
        (entity.tablePartition is None or entity.tablePartition.columns is None)
    ):
        return

    column_partitions: List[PartitionColumnDetails] = entity.tablePartition.columns
    for column_partition in column_partitions:
        if column_partition.intervalType == PartitionIntervalTypes.INJECTED:
            table_profiler_config = entity.tableProfilerConfig
            if (table_profiler_config is None or table_profiler_config.partitioning is None):
                raise RuntimeError(error_msg.format(column_name=column_partition.columnName))

            partitioning_config = table_profiler_config.partitioning
            if partitioning_config.partitionColumnName != column_partition.columnName:
                raise RuntimeError(error_msg.format(column_name=column_partition.columnName))



def get_partition_details(entity: Table) -> Optional[PartitionProfilerConfig]:
    """Build PartitionProfilerConfig object from entity

    Args:
        entity (Table): entity table
    Returns:
        PartitionProfilerConfig
    """
    if (
        hasattr(entity, "tableProfilerConfig")
        and hasattr(entity.tableProfilerConfig, "partitioning")
        and entity.tableProfilerConfig.partitioning
    ):
        validate_athena_injected_partitioning(entity)
        return entity.tableProfilerConfig.partitioning

    if (
        hasattr(entity, "serviceType")
        and entity.serviceType == DatabaseServiceType.Athena
    ):
        validate_athena_injected_partitioning(entity)

    if (
        hasattr(entity, "serviceType")
        and entity.serviceType == DatabaseServiceType.BigQuery
    ):
        if hasattr(entity, "tablePartition") and entity.tablePartition:
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
