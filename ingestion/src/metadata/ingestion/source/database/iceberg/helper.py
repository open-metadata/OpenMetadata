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
Iceberg source helpers.
"""
from __future__ import annotations

from itertools import takewhile
from typing import Optional, Tuple

import pyiceberg.partitioning
import pyiceberg.table
import pyiceberg.types

from metadata.generated.schema.entity.data.table import (
    Column,
    Constraint,
    DataType,
    PartitionIntervalTypes,
)


def namespace_to_str(namespace: tuple[str]) -> str:
    """Turns a PyIceberg Namespace into a String.

    The PyIceberg namespaces are returned as tuples and we turn them into a String
    concatenating the items with a '.' in between.
    """
    return ".".join(namespace)


def get_table_name_as_str(table: pyiceberg.table.Table) -> str:
    """Returns the Table Name as Tring from a PyIceberg Table.

    The PyIceberg table name is returned as tuple and we turn them into a String
    concatenating the items with a '.' in between.
    """
    # We are skipping the first item because it is the schema name.
    return ".".join(table.name()[1:])


def get_column_from_partition(
    columns: Tuple[pyiceberg.types.NestedField, ...],
    partition: pyiceberg.partitioning.PartitionField,
) -> Optional[str]:
    """Returns the Column Name belonging to a partition."""
    # A Partition in Iceberg has a Source Column to which a Transformation is applied.
    # We need to return the Source Column name.
    return next(
        (column.name for column in columns if column.field_id == partition.source_id),
        None,
    )


def get_column_partition_type(
    columns: Tuple[pyiceberg.types.NestedField, ...],
    partition: pyiceberg.partitioning.PartitionField,
) -> Optional[PartitionIntervalTypes]:
    """Get the partition type for a given partition column."""
    iceberg_interval_type_map = {
        "INT": PartitionIntervalTypes.INTEGER_RANGE,
        **dict.fromkeys(
            ["TIME", "DATE", "TIMESTAMP", "TIMESTAMPTZ"],
            PartitionIntervalTypes.TIME_UNIT,
        ),
    }

    data_type = str(
        next(
            (
                column.field_type
                for column in columns
                if column.field_id == partition.source_id
            ),
            "",
        )
    )
    if not data_type.isalpha():
        return None

    return iceberg_interval_type_map.get(
        data_type.upper(), PartitionIntervalTypes.COLUMN_VALUE
    )


def get_owner_from_table(
    table: pyiceberg.table.Table, property_key: str
) -> Optional[str]:
    """Retrives the owner information from given Table Property."""
    return table.properties.get(property_key)


class IcebergColumnParser:
    """Responsible for containing the logic to parse a column from PyIceberg to OpenMetadata"""

    data_type_map = {
        # Primitive
        "BOOLEAN": DataType.BOOLEAN,
        "INT": DataType.INT,
        "LONG": DataType.LONG,
        "FLOAT": DataType.FLOAT,
        "DOUBLE": DataType.DOUBLE,
        "DECIMAL": DataType.DECIMAL,
        "DATE": DataType.DATE,
        "TIME": DataType.TIME,
        "TIMESTAMP": DataType.TIMESTAMP,
        "TIMESTAMPTZ": DataType.TIMESTAMPZ,
        "STRING": DataType.STRING,
        "UUID": DataType.UUID,
        "FIXED": DataType.FIXED,
        "BINARY": DataType.BINARY,
        # Nested
        "STRUCT": DataType.STRUCT,
        "LIST": DataType.ARRAY,
        "MAP": DataType.MAP,
    }

    @classmethod
    def parse(cls, field: pyiceberg.types.NestedField) -> Column:
        """Parses a PyIceberg Field into an OpenMetadata Column."""
        data_type = cls.data_type_map.get(
            "".join(takewhile(lambda x: x.isalpha(), str(field.field_type))).upper(),
            DataType.UNKNOWN,
        )

        column_def = {
            "name": field.name,
            "description": field.doc,
            "dataType": data_type,
            "dataTypeDisplay": str(field.field_type),
            "constraint": Constraint.NOT_NULL if field.required else None,
        }

        if data_type == DataType.ARRAY:
            array_data_type = cls.data_type_map.get(
                "".join(
                    takewhile(lambda x: x.isalpha(), str(field.field_type.element_type))
                ).upper(),
                DataType.UNKNOWN,
            )
            column_def["arrayDataType"] = array_data_type
        # Iceberg Binary type has no length. Using a noop 0 value.
        elif data_type == DataType.BINARY:
            column_def["dataLength"] = 0
        elif data_type == DataType.DECIMAL:
            column_def["precision"] = field.field_type.precision
            column_def["scale"] = field.field_type.scale
        elif data_type == DataType.STRUCT:
            column_def["children"] = [
                cls.parse(child) for child in field.field_type.fields
            ]

        return Column(**column_def)
