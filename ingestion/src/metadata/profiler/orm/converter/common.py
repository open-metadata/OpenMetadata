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
Common Class For Profiler Converter.
"""

import re
from typing import Any

import sqlalchemy

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.ingestion.source import sqa_types
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.profiler.orm.registry import CustomTypes
from metadata.profiler.orm.types.custom_xml import XML

_TYPE_WRAPPER = re.compile(r"^\s*(array|nullable|lowcardinality)\s*([<(])", re.IGNORECASE)


def _unwrap_type(type_display: str) -> tuple[str, str] | None:
    match = _TYPE_WRAPPER.match(type_display)
    if not match:
        return None

    opening = match.end() - 1
    brackets = {"<": ">", "(": ")"}
    stack: list[str] = []
    quote = None
    escaped = False
    for index in range(opening, len(type_display)):
        char = type_display[index]
        # Enum labels and quoted field names may contain commas or brackets.
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
        elif char in "'\"`":
            quote = char
        elif char in brackets:
            stack.append(brackets[char])
        elif char in brackets.values():
            if not stack or char != stack.pop():
                raise ValueError("Mismatched type wrapper brackets")
            if not stack:
                inner = type_display[opening + 1 : index].strip()
                if not inner or type_display[index + 1 :].strip():
                    raise ValueError("Expected a single wrapped type")
                return match.group(1).lower(), inner
        elif char == "," and len(stack) == 1:
            raise ValueError("Expected a single wrapped type")
    raise ValueError("Unclosed type wrapper")


class CommonMapTypes:
    """
    Base Class for mapping types
    """

    _TYPE_MAP = {  # noqa: RUF012
        DataType.NUMBER: sqlalchemy.NUMERIC,
        DataType.TINYINT: sqlalchemy.SMALLINT,
        DataType.SMALLINT: sqlalchemy.SMALLINT,
        DataType.INT: sqlalchemy.INT,
        DataType.BIGINT: sqlalchemy.BIGINT,
        DataType.BYTEINT: sqlalchemy.SMALLINT,
        DataType.BYTES: CustomTypes.BYTES.value,
        DataType.FLOAT: sqlalchemy.FLOAT,
        DataType.DOUBLE: sqlalchemy.DECIMAL,
        DataType.DECIMAL: sqlalchemy.DECIMAL,
        DataType.NUMERIC: sqlalchemy.NUMERIC,
        DataType.TIMESTAMP: CustomTypes.TIMESTAMP.value,
        DataType.TIME: sqlalchemy.TIME,
        DataType.DATE: sqlalchemy.DATE,
        DataType.DATETIME: sqlalchemy.DATETIME,
        DataType.INTERVAL: sqlalchemy.Interval,
        DataType.STRING: sqlalchemy.String,
        DataType.MEDIUMTEXT: sqlalchemy.TEXT,
        DataType.TEXT: sqlalchemy.TEXT,
        # An XML column is a text document in every dialect that has one, and every
        # driver hands it back as a string. It keeps its own TEXT subclass so
        # `NOT_COMPUTE` still recognises it by name and skips its column metrics.
        DataType.XML: XML,
        DataType.CHAR: sqlalchemy.CHAR,
        DataType.VARCHAR: sqlalchemy.VARCHAR,
        DataType.BOOLEAN: sqlalchemy.BOOLEAN,
        DataType.BINARY: CustomTypes.BYTES.value,
        DataType.VARBINARY: CustomTypes.BYTES.value,
        DataType.ARRAY: CustomTypes.ARRAY.value,
        DataType.BLOB: CustomTypes.BYTES.value,
        DataType.LONGBLOB: sqlalchemy.LargeBinary,
        DataType.MEDIUMBLOB: sqlalchemy.LargeBinary,
        DataType.MAP: sqa_types.SQAMap,
        DataType.STRUCT: sqa_types.SQAStruct,
        DataType.UNION: sqa_types.SQAUnion,
        DataType.SET: sqa_types.SQASet,
        DataType.GEOGRAPHY: sqa_types.SQASGeography,
        DataType.GEOMETRY: CustomTypes.GEOMETRY.value,
        DataType.ENUM: sqlalchemy.Enum,
        DataType.JSON: sqlalchemy.JSON,
        DataType.UUID: CustomTypes.UUID.value,
        DataType.BYTEA: CustomTypes.BYTEA.value,
        DataType.NTEXT: sqlalchemy.NVARCHAR,
        DataType.IMAGE: CustomTypes.IMAGE.value,
        DataType.IPV4: CustomTypes.IP.value,
        DataType.IPV6: CustomTypes.IP.value,
        DataType.DATETIMERANGE: CustomTypes.SQADATETIMERANGE.value,
    }

    def map_types(self, col: Column, table_service_type):
        """returns an ORM type"""

        if col.arrayDataType:
            if col.arrayDataType == DataType.ARRAY:
                item_type, dimensions = self._nested_array_item_type(col)
                return self._TYPE_MAP[col.dataType](item_type=item_type, dimensions=dimensions)
            return self._TYPE_MAP[col.dataType](item_type=self._array_element_type(col.arrayDataType))
        return self.return_custom_type(col, table_service_type)

    def _array_element_type(self, data_type: DataType | None):
        """SQLAlchemy needs an element type to build an ARRAY, so an unmapped one is left untyped."""
        if data_type is None or data_type == DataType.ARRAY:
            return sqlalchemy.types.NullType()
        return self._TYPE_MAP.get(data_type) or sqlalchemy.types.NullType()

    def _nested_array_item_type(self, col: Column) -> tuple[Any, int | None]:
        """SQLAlchemy does not nest ARRAY types: a multi-dimensional array is
        ARRAY(base_type, dimensions=N). The column only records that its element is
        itself an array, so the depth and the base type are read from
        `dataTypeDisplay`, e.g. `array<array<string>>` or `Array(Array(String))`."""
        dimensions = 0
        inner = col.dataTypeDisplay or ""
        try:
            while wrapper := _unwrap_type(inner):
                wrapper_type, inner = wrapper
                if wrapper_type == "array":
                    dimensions += 1
        except ValueError:
            return sqlalchemy.types.NullType(), None
        if dimensions < 2:
            # arrayDataType establishes a minimum depth, not an exact dimension count.
            return sqlalchemy.types.NullType(), None
        try:
            base_type = DataType(ColumnTypeParser.get_column_type(inner.strip()))
        except ValueError:
            base_type = None
        return self._array_element_type(base_type), dimensions

    def return_custom_type(self, col: Column, _):
        return self._TYPE_MAP.get(col.dataType, CustomTypes.UNDETERMINED.value)

    @staticmethod
    def map_sqa_to_om_types() -> dict[Any, set[DataType]]:
        """returns an ORM type"""
        return {
            sqlalchemy.NUMERIC: {DataType.NUMBER, DataType.NUMERIC},
            sqlalchemy.SMALLINT: {
                DataType.TINYINT,
                DataType.SMALLINT,
                DataType.BYTEINT,
            },
            sqlalchemy.INT: {DataType.INT},
            sqlalchemy.BIGINT: {DataType.BIGINT},
            CustomTypes.BYTES.value: {DataType.BLOB, DataType.BYTES, DataType.BYTEA},
            sqlalchemy.FLOAT: {DataType.FLOAT},
            sqlalchemy.DECIMAL: {DataType.DOUBLE, DataType.DECIMAL},
            CustomTypes.TIMESTAMP.value: {DataType.TIMESTAMP},
            sqlalchemy.TIME: {DataType.TIME},
            sqlalchemy.DATE: {DataType.DATE},
            sqlalchemy.DATETIME: {DataType.DATETIME},
            sqlalchemy.Interval: {DataType.INTERVAL},
            sqlalchemy.String: {DataType.STRING},
            sqlalchemy.TEXT: {DataType.TEXT, DataType.MEDIUMTEXT},
            XML: {DataType.XML},
            sqlalchemy.CHAR: {DataType.CHAR},
            sqlalchemy.VARCHAR: {DataType.VARCHAR},
            sqlalchemy.BOOLEAN: {DataType.BOOLEAN},
            sqlalchemy.LargeBinary: {
                DataType.MEDIUMBLOB,
                DataType.BINARY,
                DataType.LONGBLOB,
            },
            sqlalchemy.VARBINARY: {DataType.VARBINARY},
            CustomTypes.ARRAY.value: {DataType.ARRAY},
            sqa_types.SQAMap: {DataType.MAP},
            sqa_types.SQAStruct: {DataType.STRUCT},
            sqa_types.SQAUnion: {DataType.UNION},
            sqa_types.SQASet: {DataType.SET},
            sqa_types.SQASGeography: {DataType.GEOGRAPHY},
            CustomTypes.GEOMETRY.value: {DataType.GEOMETRY},
            sqlalchemy.Enum: {DataType.ENUM},
            sqlalchemy.JSON: {DataType.JSON},
            CustomTypes.UUID.value: {DataType.UUID},
            sqlalchemy.NVARCHAR: {DataType.NTEXT},
            CustomTypes.IMAGE.value: {DataType.IMAGE},
            CustomTypes.IP.value: {DataType.IPV6, DataType.IPV4},
            CustomTypes.SQADATETIMERANGE.value: {DataType.DATETIMERANGE},
        }
