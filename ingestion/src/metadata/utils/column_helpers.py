import re
from typing import Any, Dict, Optional, Set, Type

from sqlalchemy.sql import sqltypes as types


def register_custom_type(tp: Type[types.TypeEngine], output: str = None) -> None:
    if output:
        _column_type_mapping[tp] = output
    else:
        _known_unknown_column_types.add(tp)


def register_custom_str_type(tp: str, output: str) -> None:
    _column_string_mapping[tp] = output


_column_type_mapping: Dict[Type[types.TypeEngine], str] = {
    types.Integer: "INT",
    types.Numeric: "INT",
    types.Boolean: "BOOLEAN",
    types.Enum: "ENUM",
    types._Binary: "BYTES",
    types.LargeBinary: "BYTES",
    types.PickleType: "BYTES",
    types.ARRAY: "ARRAY",
    types.VARCHAR: "VARCHAR",
    types.String: "STRING",
    types.Date: "DATE",
    types.DATE: "DATE",
    types.Time: "TIME",
    types.DateTime: "DATETIME",
    types.DATETIME: "DATETIME",
    types.TIMESTAMP: "TIMESTAMP",
    types.NullType: "NULL",
    types.JSON: "JSON",
    types.CHAR: "CHAR",
    types.DECIMAL: "DECIMAL",
    types.Interval: "INTERVAL",
}

_column_string_mapping = {
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
    "NUMERIC": "NUMBER",
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
}

_known_unknown_column_types: Set[Type[types.TypeEngine]] = {
    types.Interval,
    types.CLOB,
}


def get_column_type(column_type: Any) -> str:
    type_class: Optional[str] = None
    for sql_type in _column_type_mapping.keys():
        if isinstance(column_type, sql_type):
            type_class = _column_type_mapping[sql_type]
            break
    if type_class is None or type_class == "NULL":
        for sql_type in _known_unknown_column_types:
            if isinstance(column_type, sql_type):
                type_class = "NULL"
                break
        for col_type in _column_string_mapping.keys():
            if str(column_type).split("(")[0].split("<")[0].upper() in col_type:
                type_class = _column_string_mapping.get(col_type)
                break
            else:
                type_class = None
    return type_class


def parse_array(inside_array):
    return inside_array.lstrip("<").rstrip(">")


def get_last_index(check_remaining):
    counter = 0
    for index, i in enumerate(check_remaining):
        if i == "<":
            counter += 1
        elif i == ">":
            counter -= 1
        if counter == 0 and index >= 7:
            break
        if index == len(check_remaining) - 1:
            return None
    return index + 1


def parse_struct_children(inside_struct):
    children = []
    while inside_struct != "":
        print(inside_struct)
        col_obj = {}
        if re.match("struct<(.*)>", inside_struct):
            plucked = re.match("struct<(.*)>", inside_struct).groups()[0]
            if re.match("[\w]*:[\w()]*,*.*", plucked):
                col_obj['name'][:64], col_obj['dataType'], inside_struct = re.match("([\w]*):([\w()]*),*(.*)",
                                                                               plucked).groups()
                col_obj['dataTypeDisplay'] = col_obj['dataType']
                if col_obj['dataType'] == "array":
                    array_last_index = get_last_index(inside_struct)
                    col_obj['dataTypeDisplay'] = inside_struct[:array_last_index]
                    col_obj['arrayDataType'] = parse_array(col_obj['dataTypeDisplay'])
                    inside_struct = inside_struct[array_last_index:]
                elif col_obj['dataType'] == "struct":
                    if re.match("(?:<)(.*)(?:>)", inside_struct):
                        inside_struct = re.match("(?:<)(.*)(?:>)", inside_struct).groups()[0]
                    col_obj['children'] = parse_struct_children(inside_struct)
                    inside_struct = ""
                elif col_obj['dataType'].lower() == "map":
                    col_obj['dataType'] = get_column_type(col_obj['dataType'])
                col_obj['dataType'] = get_column_type(col_obj['dataType'])
                children.append(col_obj)
                continue
        if re.match("[\w]*:[\w()]*,*.*", inside_struct):
            col_obj['name'], col_obj['dataType'], inside_struct = re.match("([\w]*):([\w()]*),*(.*)",
                                                                           inside_struct).groups()
            if col_obj['name']:
                col_obj['name'] = col_obj['name'][:64]
            col_obj['dataTypeDisplay'] = col_obj['dataType']
            if col_obj['dataType'] == "array":
                if re.match("<(.*)>,(.*)", inside_struct):
                    parse_array_text, inside_struct = re.match("(<.*>),(.*)", inside_struct).groups()
                    arr_index = get_last_index(parse_array_text)
                    inside_array = parse_array_text[:arr_index]
                    col_obj['arrayDataType'] = get_column_type(parse_array(inside_array))
                elif re.match("<(.*)>", inside_struct):
                    parse_array_text = re.match("(<.*>)", inside_struct).groups()[0]
                    arr_index = get_last_index(parse_array_text)
                    inside_array = parse_array_text[:arr_index]
                    col_obj['arrayDataType'] = get_column_type(parse_array(inside_array))
            elif col_obj['dataType'] == 'struct':
                col_obj['dataType'] = get_column_type(col_obj['dataType'])
                struct_last_index = get_last_index(inside_struct)
                parse_struct_text = inside_struct[:struct_last_index]
                if parse_struct_text.startswith("<") and parse_struct_text.endswith(">"):
                    parse_struct_text = parse_struct_text[1:-1]
                col_obj['dataTypeDisplay'] = f"struct<{parse_struct_text}>"
                col_obj['children'] = parse_struct_children(parse_struct_text)
                inside_struct = inside_struct[struct_last_index:]
                inside_struct = inside_struct.lstrip(",")
                # if re.match("<(.*)>,*(.*)", inside_struct):
                #     col_obj['dataTypeDisplay'], inside_struct = re.match("<(.*)>,*(.*)", inside_struct).groups()
                #     col_obj['children'] = parse_struct_children(col_obj['dataTypeDisplay'])
            col_obj['dataType'] = get_column_type(col_obj['dataType'])
            children.append(col_obj)
            continue
    return children
