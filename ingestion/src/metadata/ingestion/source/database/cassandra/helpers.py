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
"""
Cassandra source helpers.
"""
from __future__ import annotations

from metadata.generated.schema.entity.data.table import Column, DataType


class CassandraColumnParser:
    """
    Responsible for containing the logic to parse a column from Cassandra to OpenMetadata
    """

    datatype_mapping = {
        "ascii": DataType.STRING,
        "bigint": DataType.BIGINT,
        "blob": DataType.BLOB,
        "boolean": DataType.BOOLEAN,
        "date": DataType.DATE,
        "decimal": DataType.DECIMAL,
        "double": DataType.DOUBLE,
        "duration": DataType.INTERVAL,
        "float": DataType.FLOAT,
        "uuid": DataType.UUID,
        "inet": DataType.INET,
        "int": DataType.INT,
        "list": DataType.ARRAY,
        "map": DataType.MAP,
        "set": DataType.SET,
        "smallint": DataType.SMALLINT,
        "text": DataType.TEXT,
        "time": DataType.TIME,
        "timestamp": DataType.TIMESTAMP,
        "timeuuid": DataType.UUID,
        "tinyint": DataType.TINYINT,
        "tuple": DataType.TUPLE,
        "varint": DataType.STRING,
        "struct": DataType.STRUCT,
    }

    @classmethod
    def parse(cls, field) -> Column:
        """
        Parses a Cassandra table column into an OpenMetadata column.
        """

        data_type = None
        array_data_type = None
        raw_data_type = ""

        for letter in field.type:
            if letter == "<":
                if raw_data_type in ("", "frozen"):
                    raw_data_type = ""
                    continue

                if not data_type:
                    data_type = cls.datatype_mapping.get(
                        raw_data_type.lower(), DataType.UNKNOWN
                    )
                elif not array_data_type:
                    array_data_type = cls.datatype_mapping.get(
                        raw_data_type.lower(), DataType.UNKNOWN
                    )

                raw_data_type = ""
                if data_type != DataType.ARRAY or array_data_type:
                    break

            elif letter == ">":
                if not array_data_type and data_type:
                    array_data_type = cls.datatype_mapping.get(
                        raw_data_type.lower(), DataType.UNKNOWN
                    )
                    break

            else:
                raw_data_type += letter

        if not data_type:
            data_type = cls.datatype_mapping.get(field.type.lower(), DataType.UNKNOWN)

        column_def = {
            "name": field.column_name,
            "dataTypeDisplay": field.type,
            "dataType": data_type,
            "arrayDataType": array_data_type,
        }

        return Column(**column_def)
