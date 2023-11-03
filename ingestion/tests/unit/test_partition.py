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

"""Partition utility tests"""

from typing import Optional

from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import (
    IntervalType,
    PartitionIntervalType,
    PartitionIntervalUnit,
    PartitionProfilerConfig,
    TablePartition,
    TableProfilerConfig,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.utils.partition import get_partition_details


class MockTable(BaseModel):
    tablePartition: Optional[TablePartition]
    tableProfilerConfig: Optional[TableProfilerConfig]
    serviceType = DatabaseServiceType.BigQuery

    class Config:
        arbitrary_types_allowed = True


class MockRedshiftTable(BaseModel):
    tablePartition: Optional[TablePartition]
    tableProfilerConfig: Optional[TableProfilerConfig]
    serviceType = DatabaseServiceType.Redshift

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
    )

    partition = get_partition_details(table_entity)

    assert partition.enablePartitioning == True
    assert partition.partitionColumnName == "order_date"
    assert partition.partitionIntervalType == PartitionIntervalType.TIME_UNIT
    assert partition.partitionInterval == 5
    assert partition.partitionIntervalUnit == PartitionIntervalUnit.YEAR

    table_entity = MockTable(
        tablePartition=TablePartition(
            columns=["e"], intervalType=IntervalType.INGESTION_TIME, interval="HOUR"
        ),
        tableProfilerConfig=None,
    )

    partition = get_partition_details(table_entity)

    assert partition.enablePartitioning == True
    assert partition.partitionColumnName == "_PARTITIONTIME"
    assert partition.partitionIntervalType == PartitionIntervalType.INGESTION_TIME
    assert partition.partitionInterval == 30
    assert partition.partitionIntervalUnit == PartitionIntervalUnit.HOUR

    table_entity = MockTable(
        tablePartition=TablePartition(
            columns=["e"], intervalType=IntervalType.INGESTION_TIME, interval="DAY"
        ),
        tableProfilerConfig=None,
    )

    partition = get_partition_details(table_entity)

    assert partition.enablePartitioning == True
    assert partition.partitionColumnName == "_PARTITIONDATE"
    assert partition.partitionIntervalType == PartitionIntervalType.INGESTION_TIME
    assert partition.partitionInterval == 30
    assert partition.partitionIntervalUnit == PartitionIntervalUnit.DAY
