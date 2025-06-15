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
Microstrategy source helpers.
"""
from __future__ import annotations

from typing import Any, Dict

from metadata.generated.schema.entity.data.table import Column, DataType


class MicroStrategyColumnParser:
    """
    Responsible for containing the logic to parse a column from MicroStrategy to OpenMetadata
    """

    datatype_mapping = {
        "big decimal": DataType.DECIMAL,
        "binary": DataType.BYTES,
        "char": DataType.CHAR,
        "date": DataType.DATE,
        "decimal": DataType.DECIMAL,
        "double": DataType.DOUBLE,
        "float": DataType.FLOAT,
        "integer": DataType.INT,
        "longvarbin": DataType.BLOB,
        "longvarchar": DataType.CLOB,
        "nchar": DataType.CHAR,
        "numeric": DataType.NUMERIC,
        "nvarchar": DataType.VARCHAR,
        "real": DataType.STRING,
        "time": DataType.TIME,
        "timestamp": DataType.TIMESTAMP,
        "unsigned": DataType.INT,
        "varbin": DataType.BYTES,
        "varchar": DataType.VARCHAR,
        "utf8char": DataType.CHAR,
    }

    @classmethod
    def parse(cls, field: Dict[str, Any]) -> Column:
        """
        Parses a MicroStrategy table column into an OpenMetadata column.
        """

        array_data_type = None
        data_type = cls.datatype_mapping.get(
            field["dataType"].lower(), DataType.UNKNOWN
        )

        column_def = {
            "name": field["name"],
            "dataTypeDisplay": field["dataType"],
            "dataType": data_type,
            "arrayDataType": array_data_type,
        }

        return Column(**column_def)
