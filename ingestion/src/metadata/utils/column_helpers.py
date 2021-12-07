import re
from typing import Any, Dict, Optional, Set, Type

from sqlalchemy.sql import sqltypes as types

from metadata.ingestion.api.source import SourceStatus


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


def check_column_complex_type(
    status: SourceStatus, dataset_name: str, column_raw_type: Any, col_name: str
):
    arr_data_type = None
    col_obj = None
    data_type_display = None
    children = None
    if column_raw_type.startswith("struct<"):
        col_type = "STRUCT"
        col_obj = _handle_complex_data_types(
            status,
            dataset_name,
            f"{col_name}:{column_raw_type}",
        )
        if "children" in col_obj and col_obj["children"] is not None:
            children = col_obj["children"]
    elif column_raw_type.startswith("map<"):
        col_type = "MAP"
        col_obj = _handle_complex_data_types(
            status,
            dataset_name,
            f"{col_name}:{column_raw_type}",
        )
    elif column_raw_type.startswith("array<"):
        col_type = "ARRAY"
        arr_data_type = re.match(r"(?:array<)(\w*)(?:.*)", column_raw_type)
        arr_data_type = arr_data_type.groups()[0].upper()
    elif column_raw_type.startswith("uniontype<") or column_raw_type.startswith(
        "union<"
    ):
        col_type = "UNION"
    else:
        col_type = get_column_type(status, dataset_name, column_raw_type.split("(")[0])
        data_type_display = col_type
    if data_type_display is None:
        data_type_display = column_raw_type
    return col_type, data_type_display, arr_data_type, children


def get_column_type(status: SourceStatus, dataset_name: str, column_type: Any) -> str:
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
    if type_class is None or type_class == "NULL":
        status.warning(
            dataset_name, f"unable to map type {column_type!r} to metadata schema"
        )
        type_class = "NULL"
    return type_class


def get_last_index(nested_str):
    counter = 1
    for index, i in enumerate(nested_str):
        if i == ">":
            counter -= 1
        elif i == "<":
            counter += 1
        if counter == 0:
            break
    index = index - counter
    return index


def get_array_type(col_type):
    col = {}
    col["dataType"] = "ARRAY"
    col_type = col_type[: get_last_index(col_type) + 2]
    col["dataTypeDisplay"] = col_type
    col["arrayDataType"] = (
        re.match(r"(?:array<)(\w*)(?:.*)", col_type).groups()[0].upper()
    )
    return col


def _handle_complex_data_types(status, dataset_name, raw_type: str, level=0):
    col = {}
    if re.match(r"([\w\s]*)(:)(.*)", raw_type):
        name, col_type = raw_type.lstrip("<").split(":", 1)
        col["name"] = name
    else:
        col["name"] = f"field_{level}"
        if raw_type.startswith("struct<"):
            col_type = raw_type
        else:
            col_type = raw_type.lstrip("<").split(":", 1)[0]
    if col_type.startswith("struct<"):
        children = []
        struct_type, col_type = re.match(r"(struct<)(.*)", col_type).groups()
        pluck_index = get_last_index(col_type)
        pluck_nested = col_type[: pluck_index + 1]
        col["dataTypeDisplay"] = struct_type + pluck_nested
        while pluck_nested != "":
            col["dataType"] = "STRUCT"
            plucked = col_type[: get_last_index(col_type)]
            counter = 0
            continue_next = False
            for index, type in enumerate(plucked.split(",")):
                if continue_next:
                    continue_next = False
                    continue
                if re.match(r"(\w*)(:)(struct)(.*)", type):
                    col_name, datatype, rest = re.match(
                        r"(\w*)(?::)(struct)(.*)", ",".join(plucked.split(",")[index:])
                    ).groups()
                    type = f"{col_name}:{datatype}{rest[:get_last_index(rest) + 2]}"
                elif type.startswith("struct"):
                    datatype, rest = re.match(
                        r"(struct)(.*)", ",".join(plucked.split(",")[index:])
                    ).groups()
                    type = f"{datatype}{rest[:get_last_index(rest) + 2]}"
                elif re.match(r"([\w\s]*)(:?)(map)(.*)", type):
                    get_map_type = ",".join(plucked.split(",")[index:])
                    type, col_type = re.match(
                        r"([\w]*:?map<[\w,]*>)(.*)", get_map_type
                    ).groups()
                    continue_next = True
                elif re.match(r"([\w\s]*)(:?)(uniontype)(.*)", type):
                    get_union_type = ",".join(plucked.split(",")[index:])
                    type, col_type = re.match(
                        r"([\w\s]*:?uniontype<[\w\s,]*>)(.*)", get_union_type
                    ).groups()
                    continue_next = True
                children.append(
                    _handle_complex_data_types(status, dataset_name, type, counter)
                )
                if plucked.endswith(type):
                    break
                counter += 1
            pluck_nested = col_type[get_last_index(col_type) + 3 :]
            col["children"] = children
    elif col_type.startswith("array"):
        col.update(get_array_type(col_type))
    elif col_type.startswith("map"):
        col["dataType"] = "MAP"
        col["dataTypeDisplay"] = col_type
    elif col_type.startswith("uniontype"):
        col["dataType"] = "UNION"
        col["dataTypeDisplay"] = col_type
    else:
        if re.match(r"(?:[\w\s]*)(?:\()([\d]*)(?:\))", col_type):
            col["dataLength"] = re.match(
                r"(?:[\w\s]*)(?:\()([\d]*)(?:\))", col_type
            ).groups()[0]
        else:
            col["dataLength"] = 1
        col["dataType"] = get_column_type(
            status,
            dataset_name,
            re.match(r"([\w\s]*)(?:.*)", col_type).groups()[0],
        )
        col["dataTypeDisplay"] = col_type.rstrip(">")
    return col
