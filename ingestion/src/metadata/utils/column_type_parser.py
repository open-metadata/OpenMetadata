import re
from typing import Any, Dict, List, Optional, Tuple, Type, Union

from sqlalchemy.sql import sqltypes as types
from sqlalchemy.types import TypeEngine

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
    _BRACKETS = {"(": ")", "[": "]", "{": "}", "<": ">"}

    _COLUMN_TYPE_MAPPING: Dict[Type[types.TypeEngine], str] = {
        types.ARRAY: "ARRAY",
        types.Boolean: "BOOLEAN",
        types.CHAR: "CHAR",
        types.CLOB: "BINARY",
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
    }

    _SOURCE_TYPE_TO_OM_TYPE = {
        "ARRAY": "ARRAY",
        "BIGINT": "BIGINT",
        "BIGNUMERIC": "NUMERIC",
        "BIGSERIAL": "BIGINT",
        "BINARY": "BINARY",
        "BIT": "INT",
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
        "FLOAT64": "DOUBLE",
        "FLOAT8": "DOUBLE",
        "GEOGRAPHY": "GEOGRAPHY",
        "HYPERLOGLOG": "BINARY",
        "IMAGE": "BINARY",
        "INT": "INT",
        "INT2": "SMALLINT",
        "INT4": "INT",
        "INT8": "BIGINT",
        "INT16": "BIGINT",
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
        "MONEY": "NUMBER",
        "NCHAR": "CHAR",
        "NTEXT": "TEXT",
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
        "XML": "BINARY",
        "XMLTYPE": "BINARY",
        "UUID": "UUID",
    }

    _COMPLEX_TYPE = re.compile("^(struct|map|array|uniontype)")

    _FIXED_DECIMAL = re.compile(r"(decimal|numeric)(\(\s*(\d+)\s*,\s*(\d+)\s*\))?")

    _FIXED_STRING = re.compile(r"(var)?char\(\s*(\d+)\s*\)")

    @staticmethod
    def get_column_type(column_type: Any) -> str:
        if not ColumnTypeParser._COLUMN_TYPE_MAPPING.get(type(column_type)):
            if not ColumnTypeParser._SOURCE_TYPE_TO_OM_TYPE.get(str(column_type)):
                if not ColumnTypeParser._SOURCE_TYPE_TO_OM_TYPE.get(
                    str(column_type).split("(")[0].split("<")[0].upper()
                ):
                    return ColumnTypeParser._SOURCE_TYPE_TO_OM_TYPE.get("VARCHAR")
                return ColumnTypeParser._SOURCE_TYPE_TO_OM_TYPE.get(
                    str(column_type).split("(")[0].split("<")[0].upper()
                )
            return ColumnTypeParser._SOURCE_TYPE_TO_OM_TYPE.get(str(column_type))
        return ColumnTypeParser._COLUMN_TYPE_MAPPING.get(type(column_type))

    @staticmethod
    def _parse_datatype_string(
        s: str, **kwargs: Any
    ) -> Union[object, Dict[str, object]]:
        s = s.strip()
        s = s.replace(" ", "")
        if s.startswith("array<"):
            if s[-1] != ">":
                raise ValueError("expected '>' found: %s" % s)
            arr_data_type = ColumnTypeParser._parse_primitive_datatype_string(s[6:-1])[
                "dataType"
            ]
            return {
                "dataType": "ARRAY",
                "arrayDataType": arr_data_type,
                "dataTypeDisplay": s,
            }
        elif s.startswith("map<"):
            if s[-1] != ">":
                raise ValueError("expected '>' found: %s" % s)
            parts = ColumnTypeParser._ignore_brackets_split(s[4:-1], ",")
            if len(parts) != 2:
                raise ValueError(
                    "The map type string format is: 'map<key_type,value_type>', "
                    + "but got: %s" % s
                )
            kt = ColumnTypeParser._parse_datatype_string(parts[0])
            vt = ColumnTypeParser._parse_datatype_string(parts[1])
            return {"dataType": "MAP", "dataTypeDisplay": s}
        elif s.startswith("uniontype<") or s.startswith("union<"):
            if s[-1] != ">":
                raise ValueError("'>' should be the last char, but got: %s" % s)
            parts = ColumnTypeParser._ignore_brackets_split(s[10:-1], ",")
            t = []
            for part in parts:
                if part.startswith("struct<"):
                    t.append(ColumnTypeParser._parse_datatype_string(part))
                else:
                    t.append(ColumnTypeParser._parse_datatype_string(part))
            return t
        elif s.startswith("struct<"):
            if s[-1] != ">":
                raise ValueError("expected '>', found: %s" % s)
            return ColumnTypeParser._parse_struct_fields_string(s[7:-1])
        elif ":" in s:
            return ColumnTypeParser._parse_struct_fields_string(s)
        else:
            return ColumnTypeParser._parse_primitive_datatype_string(s)

    @staticmethod
    def _parse_struct_fields_string(s: str) -> Dict[str, object]:
        parts = ColumnTypeParser._ignore_brackets_split(s, ",")
        columns = []
        for part in parts:
            name_and_type = ColumnTypeParser._ignore_brackets_split(part, ":")
            if len(name_and_type) != 2:
                raise ValueError(
                    "expected format is: 'field_name:field_type', "
                    + "but got: %s" % part
                )
            field_name = name_and_type[0].strip()
            if field_name.startswith("`"):
                if field_name[-1] != "`":
                    raise ValueError("'`' should be the last char, but got: %s" % s)
                field_name = field_name[1:-1]
            field_type = ColumnTypeParser._parse_datatype_string(name_and_type[1])
            field_type["name"] = field_name
            columns.append(field_type)
        return {
            "children": columns,
            "dataTypeDisplay": "struct<{}>".format(s),
            "dataType": "STRUCT",
        }

    @staticmethod
    def _parse_primitive_datatype_string(s: str) -> Dict[str, object]:
        if s.upper() in ColumnTypeParser._SOURCE_TYPE_TO_OM_TYPE.keys():
            return {
                "dataType": ColumnTypeParser._SOURCE_TYPE_TO_OM_TYPE[s.upper()],
                "dataTypeDisplay": s,
            }
        elif ColumnTypeParser._FIXED_STRING.match(s):
            m = ColumnTypeParser._FIXED_STRING.match(s)
            return {"dataType": "STRING", "dataTypeDisplay": s}
        elif ColumnTypeParser._FIXED_DECIMAL.match(s):
            m = ColumnTypeParser._FIXED_DECIMAL.match(s)
            if m.group(2) is not None:  # type: ignore
                return {
                    "dataType": ColumnTypeParser.get_column_type(m.group(0)),
                    "dataTypeDisplay": s,
                    "dataLength": int(m.group(3)),  # type: ignore
                }
            else:
                return {
                    "dataType": ColumnTypeParser.get_column_type(m.group(0)),
                    "dataTypeDisplay": s,
                }
        elif s == "date":
            return {"dataType": "DATE", "dataTypeDisplay": s}
        elif s == "timestamp":
            return {"dataType": "TIMESTAMP", "dataTypeDisplay": s}
        else:
            dataType = ColumnTypeParser.get_column_type(s)
            if not dataType:
                return {"dataType": "NULL", "dataTypeDisplay": s}
            else:
                dataLength = 1
                if re.match(".*(\([\w]*\))", s):
                    dataLength = re.match(".*\(([\w]*)\)", s).groups()[0]
                return {
                    "dataType": dataType,
                    "dataTypeDisplay": dataType,
                    "dataLength": dataLength,
                }

    @staticmethod
    def _ignore_brackets_split(s: str, separator: str) -> List[str]:
        parts = []
        buf = ""
        level = 0
        for c in s:
            if c in ColumnTypeParser._BRACKETS.keys():
                level += 1
                buf += c
            elif c in ColumnTypeParser._BRACKETS.values():
                if level == 0:
                    raise ValueError("Brackets are not correctly paired: %s" % s)
                level -= 1
                buf += c
            elif c == separator and level > 0:
                buf += c
            elif c == separator:
                parts.append(buf)
                buf = ""
            else:
                buf += c

        if len(buf) == 0:
            raise ValueError("The %s cannot be the last char: %s" % (separator, s))
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

    @staticmethod
    def is_primitive_om_type(raw_type: str) -> bool:
        return not ColumnTypeParser._COMPLEX_TYPE.match(raw_type)
