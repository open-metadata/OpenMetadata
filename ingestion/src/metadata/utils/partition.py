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

from typing import Optional

from metadata.generated.schema.entity.data.table import (
    IntervalType,
    PartitionProfilerConfig,
    Table,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)


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
        return entity.tableProfilerConfig.partitioning

    if (
        hasattr(entity, "serviceType")
        and entity.serviceType == DatabaseServiceType.BigQuery
    ):
        if hasattr(entity, "tablePartition") and entity.tablePartition:
            if entity.tablePartition.intervalType == IntervalType.TIME_UNIT:
                return PartitionProfilerConfig(
                    enablePartitioning=True,
                    partitionColumnName=entity.tablePartition.columns[0],
                    partitionIntervalUnit=entity.tablePartition.interval,
                    partitionInterval=30,
                    partitionIntervalType=entity.tablePartition.intervalType.value,
                    partitionValues=None,
                )
            if entity.tablePartition.intervalType == IntervalType.INGESTION_TIME:
                return PartitionProfilerConfig(
                    enablePartitioning=True,
                    partitionColumnName="_PARTITIONDATE"
                    if entity.tablePartition.interval == "DAY"
                    else "_PARTITIONTIME",
                    partitionIntervalUnit=entity.tablePartition.interval,
                    partitionInterval=30,
                    partitionIntervalType=entity.tablePartition.intervalType.value,
                    partitionValues=None,
                )
            raise TypeError(
                f"Unsupported partition type {entity.tablePartition.intervalType}. Skipping table"
            )

    return None
