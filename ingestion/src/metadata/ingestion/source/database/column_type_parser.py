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
Generic Column Type Parser.
"""

import re
from typing import Any, Dict, List, Optional, Tuple, Type, Union

from sqlalchemy.dialects.postgresql import BYTEA
from sqlalchemy.sql import sqltypes as types
from sqlalchemy.types import TypeEngine

from metadata.generated.schema.entity.data.table import DataType
from metadata.ingestion.source import sqa_types


def create_sqlalchemy_type(name: str):
    sqlalchemy_type = type(
        name,
        (TypeEngine,),
        {
            "__repr__": lambda self: f"{name}()",
        },
    )
    return sqlalchemy_type


NUMERIC_TYPES_SUPPORTING_PRECISION = {
    "DOUBLE",
    "NUMBER",
    "NUMERIC",
    "FLOAT",
    "DECIMAL",
}


class ColumnTypeParser:
    """
    Column Type Parser Class
    """

    _BRACKETS = {"(": ")", "[": "]", "{": "}", "<": ">"}

    _COLUMN_TYPE_MAPPING: Dict[Type[types.TypeEngine], str] = {
        types.ARRAY: "ARRAY",
        types.Boolean: "BOOLEAN",
        types.CHAR: "CHAR",
        types.CLOB: "CLOB",
        types.Date: "DATE",
        types.DATE: "DATE",
        types.DateTime: "DATETIME",
        types.DATETIME: "DATETIME",
        types.DECIMAL: "DECIMAL",
        types.Enum: "ENUM",
        types.Interval: "INTERVAL",
        types.JSON: "JSON",
        types.LargeBinary: "BYTES",
        types.NullType: "NULL",
        types.Numeric: "INT",
        types.PickleType: "BYTES",
        types.String: "STRING",
        types.Time: "TIME",
        types.TIMESTAMP: "TIMESTAMP",
        types.VARCHAR: "VARCHAR",
        types.BINARY: "BINARY",
        types.INTEGER: "INT",
        types.Integer: "INT",
        types.BigInteger: "BIGINT",
        types.VARBINARY: "VARBINARY",
        # Custom wrapper types enriching SQA type system
        sqa_types.SQAMap: "MAP",
        sqa_types.SQAStruct: "STRUCT",
        BYTEA: "BYTEA",
    }

    _SOURCE_TYPE_TO_OM_TYPE = {
        "ARRAY": "ARRAY",
        "BIGINT": "BIGINT",
        "BIGNUMERIC": "NUMERIC",
        "BIGSERIAL": "BIGINT",
        "BINARY": "BINARY",
        "BIT": "BIT",
        "BLOB": "BLOB",
        "BOOL": "BOOLEAN",
        "BOOLEAN": "BOOLEAN",
        "BPCHAR": "CHAR",
        "BYTEINT": "BYTEINT",
        "BYTES": "BYTES",
        "CHAR": "CHAR",
        "CHARACTER VARYING": "VARCHAR",
        "BINARY VARYING": "VARBINARY",
        "CURSOR": "BINARY",
        "DATE": "DATE",
        "DATETIME": "DATETIME",
        "DATETIME2": "DATETIME",
        "DATETIMEOFFSET": "DATETIME",
        "DECIMAL": "DECIMAL",
        "DOUBLE PRECISION": "DOUBLE",
        "DOUBLE_PRECISION": "DOUBLE",
        "DOUBLE": "DOUBLE",
        "ENUM": "ENUM",
        "FLOAT": "FLOAT",
        "FLOAT4": "FLOAT",
        "FLOAT32": "FLOAT",
        "FLOAT64": "DOUBLE",
        "FLOAT8": "DOUBLE",
        "GEOGRAPHY": "GEOGRAPHY",
        "GEOMETRY": "GEOMETRY",
        "HYPERLOGLOG": "BINARY",
        "IMAGE": "IMAGE",
        "INT": "INT",
        "INT2": "SMALLINT",
        "INT4": "INT",
        "INT8": "BIGINT",
        "INT16": "BIGINT",
        "TUPLE": "TUPLE",
        "SPATIAL": "SPATIAL",
        "INT32": "BIGINT",
        "INT64": "BIGINT",
        "INT128": "BIGINT",
        "INT256": "BIGINT",
        "INTEGER": "INT",
        "UINT": "INT",
        "UINT2": "SMALLINT",
        "UINT4": "INT",
        "UINT8": "BIGINT",
        "UINT16": "BIGINT",
        "UINT32": "BIGINT",
        "UINT64": "BIGINT",
        "UINT128": "BIGINT",
        "UINT256": "BIGINT",
        "INTERVAL DAY TO SECOND": "INTERVAL",
        "INTERVAL YEAR TO MONTH": "INTERVAL",
        "INTERVAL": "INTERVAL",
        "LONG RAW": "BINARY",
        "LONG VARCHAR": "VARCHAR",
        "LONGBLOB": "LONGBLOB",
        "MAP": "MAP",
        "MEDIUMBLOB": "MEDIUMBLOB",
        "MEDIUMINT": "INT",
        "MEDIUMTEXT": "MEDIUMTEXT",
        "MONEY": "MONEY",
        "NCHAR": "CHAR",
        "NTEXT": "NTEXT",
        "NULL": "NULL",
        "NUMBER": "NUMBER",
        "NUMERIC": "NUMERIC",
        "NVARCHAR": "VARCHAR",
        "OBJECT": "JSON",
        "RAW": "BINARY",
        "REAL": "FLOAT",
        "RECORD": "STRUCT",
        "ROWID": "VARCHAR",
        "ROWVERSION": "NUMBER",
        "SET": "SET",
        "SMALLDATETIME": "DATETIME",
        "SMALLINT": "SMALLINT",
        "SMALLMONEY": "NUMBER",
        "SMALLSERIAL": "SMALLINT",
        "SQL_VARIANT": "VARBINARY",
        "STRING": "STRING",
        "STRUCT": "STRUCT",
        "ROW": "STRUCT",
        "TABLE": "BINARY",
        "TEXT": "TEXT",
        "TIME": "TIME",
        "TIMESTAMP WITHOUT TIME ZONE": "TIMESTAMP",
        "TIMESTAMP WITH TIME ZONE": "TIMESTAMP",
        "TIME WITH TIME ZONE": "TIME",
        "TIME WITHOUT TIME ZONE": "TIME",
        "TIMESTAMP": "TIMESTAMP",
        "TIMESTAMPTZ": "TIMESTAMP",
        "TIMESTAMP_NTZ": "TIMESTAMP",
        "TIMESTAMP_LTZ": "TIMESTAMP",
        "TIMESTAMP_TZ": "TIMESTAMP",
        "TIMETZ": "TIMESTAMP",
        "TINYINT": "TINYINT",
        "UNION": "UNION",
        "UROWID": "VARCHAR",
        "VARBINARY": "VARBINARY",
        "VARCHAR": "VARCHAR",
        "VARIANT": "JSON",
        "JSON": "JSON",
        "JSONB": "JSON",
        "UUID": "UUID",
        "POINT": "GEOMETRY",
        "POLYGON": "GEOMETRY",
        "AggregateFunction()": "AGGREGATEFUNCTION",
        "BYTEA": "BYTEA",
        "UNKNOWN": "UNKNOWN",
        # redshift
        "HLLSKETCH": "HLLSKETCH",
        "SUPER": "SUPER",
        # postgres
        "BOX": "GEOMETRY",
        "CIRCLE": "GEOMETRY",
        "LINE": "GEOMETRY",
        "LSEG": "GEOMETRY",
        "PATH": "GEOMETRY",
        "PG_LSN": "PG_LSN",
        "PG_SNAPSHOT": "PG_SNAPSHOT",
        "TSQUERY": "TSQUERY",
        "TXID_SNAPSHOT": "TXID_SNAPSHOT",
        "XML": "XML",
        "TSVECTOR": "TSVECTOR",
        "MACADDR": "MACADDR",
        "MACADDR8": "MACADDR",
        "CIDR": "CIDR",
        "INET": "INET",
        "TSRANGE": "DATETIMERANGE",
        # ORACLE
        "BINARY_DOUBLE": "DOUBLE",
        "BINARY_FLOAT": "FLOAT",
        "XMLTYPE": "XML",
        "BFILE": "BINARY",
        "CLOB": "CLOB",
        "NCLOB": "CLOB",
        "LONG": "LONG",
        # clickhouse
        "LOWCARDINALITY": "LOWCARDINALITY",
        "DATETIME64": "DATETIME",
        "SimpleAggregateFunction()": "AGGREGATEFUNCTION",
        "IPV4": "IPV4",
        "IPV6": "IPV6",
        # Databricks
        "VOID": "NULL",
        # mysql
        "TINYBLOB": "BLOB",
        "LONGTEXT": "TEXT",
        "TINYTEXT": "TEXT",
        "YEAR": "YEAR",
        # Tableau
        "EMPTY": "NULL",
        "I2": "INT",
        "I4": "INT",
        "R4": "FLOAT",
        "R8": "DOUBLE",
        "CY": "NUMERIC",
        "BSTR": "BINARY",
        "IDISPATCH": "BINARY",
        "ERROR": "VARCHAR",
        "IUNKNOWN": "UNKNOWN",
        "UI1": "INT",
        "BYREF": "BINARY",
        "I1": "INT",
        "UI2": "SMALLINT",
        "UI4": "INT",
        "I8": "BIGINT",
        "UI8": "BIGINT",
        "GUID": "BINARY",
        "VECTOR": "BINARY",
        "FILETIME": "BINARY",
        "RESERVED": "BINARY",
        "STR": "STRING",
        "WSTR": "STRING",
        "UDT": "JSON",
        "DBDATE": "DATE",
        "DBTIME": "TIME",
        "DBTIMESTAMP": "TIMESTAMP",
        "HCHAPTER": "VARCHAR",
        "PROPVARIANT": "BINARY",
        "VARNUMERIC": "NUMERIC",
        "WDC_INT": "INT",
        "WDC_FLOAT": "FLOAT",
        "WDC_STRING": "STRING",
        "WDC_DATETIME": "DATETIME",
        "WDC_BOOL": "BOOLEAN",
        "WDC_DATE": "DATE",
        "WDC_GEOMETRY": "GEOMETRY",
        # SAP ERP
        "CLNT": "INT",
        "INT1": "INT",
        "LRAW": "BLOB",
        "UNIT": "CHAR",
        "NUMC": "CHAR",
        "LANG": "CHAR",
        "CUKY": "CHAR",
        "DATS": "DATE",
        "TIMS": "TIME",
        "FLTP": "FLOAT",
        "QUAN": "DECIMAL",
        "DEC": "DECIMAL",
        "CURR": "DECIMAL",
        "STRG": "STRING",
        "RSTR": "STRING",
        # azuresql
        "HIERARCHYID": "UNKNOWN",
    }

    _COMPLEX_TYPE = re.compile("^(struct|map|array|uniontype)")

    _FIXED_DECIMAL = re.compile(r"(decimal|numeric)(\(\s*(\d+)\s*,\s*(\d+)\s*\))?")

    try:
        # pylint: disable=import-outside-toplevel
        from teradatasqlalchemy import BYTE, VARBYTE

        _COLUMN_TYPE_MAPPING[BYTE] = "BINARY"
        _SOURCE_TYPE_TO_OM_TYPE["BYTE"] = "BINARY"
        _COLUMN_TYPE_MAPPING[VARBYTE] = "VARBINARY"
        _SOURCE_TYPE_TO_OM_TYPE["VARBYTE"] = "VARBINARY"
    except ImportError:
        pass

    @staticmethod
    def get_column_type(column_type: Any) -> str:
        for func in [
            ColumnTypeParser.get_column_type_mapping,
            ColumnTypeParser.get_source_type_mapping,
            ColumnTypeParser.get_source_type_contains_brackets,
        ]:
            column_type_result = func(column_type)
            if column_type_result:
                return column_type_result
        return ColumnTypeParser._SOURCE_TYPE_TO_OM_TYPE.get("UNKNOWN")

    @staticmethod
    def get_column_type_mapping(column_type: Any) -> str:
        return ColumnTypeParser._COLUMN_TYPE_MAPPING.get(type(column_type), None)

    @staticmethod
    def get_source_type_mapping(column_type: Any) -> str:
        return ColumnTypeParser._SOURCE_TYPE_TO_OM_TYPE.get(str(column_type), None)

    @staticmethod
    def get_source_type_contains_brackets(column_type: Any) -> str:
        return ColumnTypeParser._SOURCE_TYPE_TO_OM_TYPE.get(
            str(column_type).split("(", maxsplit=1)[0].split("<")[0].upper(), None
        )

    @staticmethod
    def _parse_datatype_string(
        data_type: str, **kwargs: Any  # pylint: disable=unused-argument
    ) -> Union[object, Dict[str, object]]:
        data_type = data_type.lower().strip()
        data_type = data_type.replace(" ", "")
        if data_type.startswith("array<"):
            if data_type[-1] != ">":
                raise ValueError(f"expected '>' found: {data_type}")
            arr_data_type = ColumnTypeParser._parse_primitive_datatype_string(
                data_type[6:-1]
            )["dataType"]
            data_type_string = {
                "dataType": "ARRAY",
                "arrayDataType": arr_data_type,
                "dataTypeDisplay": data_type,
            }
            if arr_data_type == DataType.STRUCT.value:
                children = ColumnTypeParser._parse_struct_fields_string(
                    data_type[6:-1][7:-1]
                )["children"]
                data_type_string["children"] = children
            return data_type_string
        if data_type.startswith("map<"):
            if data_type[-1] != ">":
                raise ValueError(f"expected '>' found: {data_type}")
            parts = ColumnTypeParser._ignore_brackets_split(data_type[4:-1], ",")
            if len(parts) != 2:
                raise ValueError(
                    "The map type string format is: 'map<key_type,value_type>', "
                    + f"but got: {data_type}"
                )
            return {"dataType": "MAP", "dataTypeDisplay": data_type}
        if data_type.startswith("uniontype<") or data_type.startswith("union<"):
            if data_type[-1] != ">":
                raise ValueError(f"'>' should be the last char, but got: {data_type}")
            parts = ColumnTypeParser._ignore_brackets_split(data_type[10:-1], ",")
            temp = []
            for part in parts:
                temp.append(ColumnTypeParser._parse_datatype_string(part))
            return temp
        if data_type.startswith("struct<"):
            if data_type[-1] != ">":
                raise ValueError(f"expected '>', found: {data_type}")
            return ColumnTypeParser._parse_struct_fields_string(data_type[7:-1])
        if ":" in data_type:
            return ColumnTypeParser._parse_struct_fields_string(data_type)
        return ColumnTypeParser._parse_primitive_datatype_string(data_type)

    @staticmethod
    def _parse_struct_fields_string(stuct_type: str) -> Dict[str, object]:
        parts = ColumnTypeParser._ignore_brackets_split(
            stuct_type, ",", skip_no_child_validation=True
        )
        columns = []
        for part in parts:
            name_and_type = ColumnTypeParser._ignore_brackets_split(part, ":")
            if len(name_and_type) != 2:
                raise ValueError(
                    "expected format is: 'field_name:field_type', " + f"but got: {part}"
                )
            field_name = name_and_type[0].strip()
            if field_name.startswith("`"):
                if field_name[-1] != "`":
                    raise ValueError(
                        f"'`' should be the last char, but got: {stuct_type}"
                    )
                field_name = field_name[1:-1]
            field_type = ColumnTypeParser._parse_datatype_string(name_and_type[1])
            field_type["name"] = field_name
            columns.append(field_type)

        return {
            "children": columns,
            "dataTypeDisplay": f"struct<{stuct_type or 'unknown'}>",
            "dataType": "STRUCT",
        }

    @staticmethod
    def _parse_primitive_datatype_string(  # pylint: disable=too-many-return-statements
        dtype: str,
    ) -> Dict[str, object]:
        if dtype.upper() in ColumnTypeParser._SOURCE_TYPE_TO_OM_TYPE:
            return {
                "dataType": ColumnTypeParser._SOURCE_TYPE_TO_OM_TYPE[dtype.upper()],
                "dataTypeDisplay": dtype,
            }
        if ColumnTypeParser._FIXED_DECIMAL.match(dtype):
            match = ColumnTypeParser._FIXED_DECIMAL.match(dtype)
            if match.group(2) is not None:  # type: ignore
                return {
                    "dataType": ColumnTypeParser.get_column_type(match.group(0)),
                    "dataTypeDisplay": dtype,
                    "dataLength": int(match.group(3)),  # type: ignore
                }
            return {
                "dataType": ColumnTypeParser.get_column_type(match.group(0)),
                "dataTypeDisplay": dtype,
            }
        if dtype == "date":
            return {"dataType": "DATE", "dataTypeDisplay": dtype}
        if dtype == "timestamp":
            return {"dataType": "TIMESTAMP", "dataTypeDisplay": dtype}
        data_type = ColumnTypeParser.get_column_type(dtype)
        if not data_type:
            return {"dataType": "NULL", "dataTypeDisplay": dtype}
        data_length = 1
        if re.match(r".*(\([\w]*\))", dtype):
            data_length = re.match(r".*\(([\w]*)\)", dtype).groups()[0]
        return {
            "dataType": data_type,
            "dataTypeDisplay": data_type,
            "dataLength": data_length,
        }

    @staticmethod
    def _ignore_brackets_split(
        string: str, separator: str, skip_no_child_validation: bool = False
    ) -> List[str]:
        parts = []
        buf = ""
        level = 0
        for char in string:
            if char in ColumnTypeParser._BRACKETS:
                level += 1
                buf += char
            elif char in ColumnTypeParser._BRACKETS.values():
                if level == 0:
                    raise ValueError(f"Brackets are not correctly paired: {string}")
                level -= 1
                buf += char
            elif char == separator and level > 0:
                buf += char
            elif char == separator:
                parts.append(buf)
                buf = ""
            else:
                buf += char

        if len(buf) == 0 and not skip_no_child_validation:
            raise ValueError(f"The {separator} cannot be the last char: {string}")
        if buf:
            parts.append(buf)
        return parts

    @staticmethod
    def check_col_precision(
        datatype: str, col_raw_type: object
    ) -> Optional[Tuple[str, str]]:
        """
        Method retuerns the precision details of column if available
        """
        if datatype and datatype.upper() in NUMERIC_TYPES_SUPPORTING_PRECISION:
            args = re.search(r"\((.*)\)", str(col_raw_type))
            if args and args.group(1):
                args = tuple(re.split(r"\s*,\s*", args.group(1)))
                return args
        return None

    @staticmethod
    def is_primitive_om_type(raw_type: str) -> bool:
        return not ColumnTypeParser._COMPLEX_TYPE.match(raw_type)
