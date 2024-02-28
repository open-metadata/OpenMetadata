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

import pytest
from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import (
    PartitionColumnDetails,
    PartitionIntervalTypes,
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


class MockAthenaTable(BaseModel):
    tablePartition: Optional[TablePartition]
    tableProfilerConfig: Optional[TableProfilerConfig]
    serviceType = DatabaseServiceType.Athena

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

    assert partition.enablePartitioning == True
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

    assert partition.enablePartitioning == True
    assert partition.partitionColumnName == "_PARTITIONTIME"
    assert partition.partitionIntervalType == PartitionIntervalTypes.INGESTION_TIME
    assert partition.partitionInterval == 1
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
    assert partition.partitionInterval == 1
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
        match="Table profiler config is missing for table with injected partitioning. Please define the partitioning in the table profiler config for column e",
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

    assert partition.enablePartitioning == True
    assert partition.partitionColumnName == "e"
    assert partition.partitionIntervalType == PartitionIntervalTypes.COLUMN_VALUE
    assert partition.partitionValues == ["red"]
