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
Iceberg source assisting models.
"""
from __future__ import annotations

from itertools import takewhile

from metadata.generated.schema.entity.data.table import (
    Column,
    Constraint,
    DataType,
    TableType,
)

# class IcebergDataType(Enum):
#     BOOLEAN = "BOOLEAN"          # true or false
#     INT = "INT"                  # 32-bit signed integers
#     LONG = "LONG"                # 64-bit signed integers
#     FLOAT = "FLOAT"              # 32-bit ieee 754 floating point
#     DOUBLE = "DOUBLE"            # 64-bit ieee 754 floating point
#     DECIMAL = "DECIMAL"          # decimal(P,S) - Fixed-point decimal; precision P, scale S
#     DATE = "DATE"                # calendar date without timezone or time
#     TIME = "TIME"                # time of day without date, timezone
#     TIMESTAMP = "TIMESTAMP"      # timestamp without timezone
#     TIMESTAMPTZ = "TIMESTAMPTZ"  # timestamp with timezone
#     STRING = "STRING"            # arbitraty-length character sequences (utf-8)
#     UUID = "UUID"                # uuid
#     FIXED = "FIXED"              # fixed(L) - Fixed-length byte array of length L
#     BINARY = "BINARY"            # arbitraty-length byte array
#
#     # A struct is a tuple of typed values.
#     # Each field in the tuple is named and has an integer id that is unique in the table schema.
#     # Each field can be either optional or required, meaning that values can (or cannot) be null.
#     # Fields may be any type. Fields may have an optional comment or doc string.
#     # Fields can have default values.
#     STRUCT = "STRUCT"
#
#     # A list is a collection of values with some element type.
#     # The element field has an integer id that is unique in the table schema.
#     # Elements can be either optional or required.
#     # Element types may be any type.
#     LIST = "LIST"
#
#     # A map is a collection of key-value pairs with a key type and a value type.
#     # Both the key field and value field each have an integer id that is unique in the table schema.
#     # Map keys are required and map values can be either optional or required.
#     # Both map keys and map values may be any type, including nested types.
#     MAP = "MAP"


class IcebergColumnParser:
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
        data_type = cls.data_type_map.get(
            "".join(takewhile(lambda x: x.isalpha(), str(field.field_type))).upper(),
            DataType.UNKNOWN,
        )

        column_def = {
            "name": field.name,
            "description": field.doc,
            "dataType": data_type,
            "constraint": Constraint.NOT_NULL if field.required else None,
        }

        if data_type == DataType.ARRAY:
            column_def["arrayDataType"] = cls.data_type_map.get(
                "".join(
                    takewhile(lambda x: x.isalpha(), str(field.field_type.element_type))
                ).upper(),
                DataType.UNKNOWN,
            )
        elif data_type == DataType.FIXED:
            # FixedType has no attributes
            # TODO: Understand if DataType.FIXED is the right type for this
            column_def["dataLength"] = field.field_Type.__getnewargs__()[0]
        # HACK: Just to make it work, using dummy dataLength of 1000
        elif data_type == DataType.BINARY:
            column_def["dataLength"] = 1000
        elif data_type == DataType.DECIMAL:
            column_def["precision"] = field.field_type.precision
            column_def["scale"] = field.field_type.scale
        elif data_type == DataType.STRUCT:
            column_def["children"] = [
                cls.parse(child) for child in field.field_type.fields
            ]

        return Column(**column_def)
