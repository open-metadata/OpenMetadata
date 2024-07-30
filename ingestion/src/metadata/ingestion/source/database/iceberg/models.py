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
"""
Iceberg source models.
"""
from __future__ import annotations

from typing import List, Optional

import pyiceberg.table
from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import (
    Column,
    PartitionColumnDetails,
    TablePartition,
    TableType,
)
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.source.database.iceberg.helper import (
    IcebergColumnParser,
    get_column_from_partition,
    get_column_partition_type,
)


class IcebergTable(BaseModel):
    name: str
    tableType: TableType
    description: Optional[str] = None
    owners: Optional[EntityReferenceList] = None
    columns: List[Column] = []
    tablePartition: Optional[TablePartition] = None

    @classmethod
    def from_pyiceberg(
        cls,
        name: str,
        table_type: TableType,
        owners: Optional[EntityReferenceList],
        table: pyiceberg.table.Table,
    ) -> IcebergTable:
        """Responsible for parsing the needed information from a PyIceberg Table."""
        iceberg_columns = table.schema().fields

        return IcebergTable(
            name=name,
            tableType=table_type,
            description=table.properties.get("comment"),
            owners=owners,
            columns=[IcebergColumnParser.parse(column) for column in iceberg_columns],
            tablePartition=TablePartition(
                columns=[
                    PartitionColumnDetails(
                        columnName=get_column_from_partition(
                            iceberg_columns, partition
                        ),
                        intervalType=get_column_partition_type(
                            iceberg_columns, partition
                        ),
                        interval=None,
                    )
                    for partition in table.spec().fields
                ]
            ),
        )
