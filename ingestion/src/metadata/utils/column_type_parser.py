import re
from typing import Any, Dict, List, Union

from metadata.generated.schema.entity.data.table import Column
from metadata.utils.column_helpers import get_column_type


class ColumnTypeParser:
    _BRACKETS = {"(": ")", "[": "]", "{": "}", "<": ">"}

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
        "DATE": "DATE",
        "DATETIME": "DATETIME",
        "DATETIME2": "DATETIME",
        "DATETIMEOFFSET": "DATETIME",
        "DECIMAL": "DECIMAL",
        "DOUBLE PRECISION": "DOUBLE",
        "DOUBLE": "DOUBLE",
        "ENUM": "ENUM",
        "FLOAT4": "FLOAT",
        "FLOAT64": "DOUBLE",
        "FLOAT8": "DOUBLE",
        "FLOAT": "FLOAT",
        "GEOGRAPHY": "GEOGRAPHY",
        "HYPERLOGLOG": "BINARY",
        "IMAGE": "BINARY",
        "INT": "INT",
        "INT2": "SMALLINT",
        "INT4": "INT",
        "INT64": "BIGINT",
        "INT8": "BIGINT",
        "INTEGER": "INT",
        "INTERVAL DAY TO SECOND": "INTERVAL",
        "INTERVAL YEAR TO MONTH": "INTERVAL",
        "INTERVAL": "INTERVAL",
        "JSON": "JSON",
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
        "TIMESTAMP": "TIMESTAMP",
        "TIMESTAMPTZ": "TIMESTAMP",
        "TIMETZ": "TIMESTAMP",
        "TINYINT": "TINYINT",
        "UNION": "UNION",
        "UROWID": "VARCHAR",
        "VARBINARY": "VARBINARY",
        "VARCHAR": "VARCHAR",
        "VARIANT": "JSON",
        "XML": "BINARY",
        "XMLTYPE": "BINARY",
        "CURSOR": "BINARY",
        "TIMESTAMP_LTZ": "TIMESTAMP",
        "TIMESTAMP_TZ": "TIMESTAMP",
    }

    _COMPLEX_TYPE = re.compile("^(struct|map|array|uniontype)")

    _FIXED_DECIMAL = re.compile(r"(decimal|numeric)(\(\s*(\d+)\s*,\s*(\d+)\s*\))?")

    _FIXED_STRING = re.compile(r"(var)?char\(\s*(\d+)\s*\)")

    @staticmethod
    def _parse_datatype_string(
        s: str, **kwargs: Any
    ) -> Union[object, Dict[str, object]]:
        s = s.strip()
        if s.startswith("array<"):
            if s[-1] != ">":
                raise ValueError("expected '>' found: %s" % s)
            return {
                "dataType": "ARRAY",
                "arrayDataType": s[0:5].upper(),
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
        elif s.startswith("uniontype<"):
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
            return {"type": "STRING", "dataTypeDisplay": s}
        elif ColumnTypeParser._FIXED_DECIMAL.match(s):
            m = ColumnTypeParser._FIXED_DECIMAL.match(s)
            if m.group(2) is not None:  # type: ignore
                return {
                    "dataType": get_column_type(m.group(0)),
                    "dataTypeDisplay": s,
                    "dataLength": int(m.group(3)),  # type: ignore
                }
            else:
                return {"dataType": get_column_type(m.group(0)), "dataTypeDisplay": s}
        elif s == "date":
            return {"dataType": "DATE", "dataTypeDisplay": s}
        elif s == "timestamp":
            return {"dataType": "TIMESTAMP", "dataTypeDisplay": s}
        else:
            dataType = get_column_type(s)
            if not dataType:
                return {"dataType": "NULL", "dataTypeDisplay": s}
            else:
                if re.match(".*(\([\w]*\))", s):
                    dataLength = re.match(".*\(([\w]*)\)", s).groups()[0]
                return {
                    "dataType": dataType,
                    "dataTypeDisplay": dataType,
                    "dataLength": dataLength if dataLength is not None else 1,
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
    def is_primitive_om_type(raw_type: str) -> bool:
        return not ColumnTypeParser._COMPLEX_TYPE.match(raw_type)
