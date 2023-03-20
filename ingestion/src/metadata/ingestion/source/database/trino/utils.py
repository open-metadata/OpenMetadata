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


import re
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import exc, sql, util
from sqlalchemy.engine.base import Connection
from sqlalchemy.sql import sqltypes
from trino.sqlalchemy import datatype, error
from trino.sqlalchemy.datatype import (
    MAP,
    ROW,
    SQLType,
    TypeEngine,
    _type_map,
    aware_split,
    unquote,
)

from metadata.ingestion.source.database.trino.queries import TRINO_TABLE_COMMENTS

ROW_DATA_TYPE = "row"
ARRAY_DATA_TYPE = "array"


def get_type_name_and_opts(type_str: str) -> Tuple[str, Optional[str]]:
    match = re.match(r"^(?P<type>\w+)\s*(?:\((?P<options>.*)\))?", type_str)
    if not match:
        util.warn(f"Could not parse type name '{type_str}'")
        return sqltypes.NULLTYPE
    type_name = match.group("type")
    type_opts = match.group("options")
    return type_name, type_opts


def parse_array_data_type(type_str: str) -> str:
    """
    This mehtod is used to convert the complex array datatype to the format that is supported by OpenMetadata
    For Example:
    If we have a row type as array(row(col1 bigint, col2 string))
    this method will return type as -> array<struct<col1:bigint,col2:string>>
    """
    type_name, type_opts = get_type_name_and_opts(type_str)
    final = type_name + "<"
    if type_opts:
        if type_opts.startswith(ROW_DATA_TYPE):
            final += parse_row_data_type(type_opts)
        elif type_opts.startswith(ARRAY_DATA_TYPE):
            final += parse_array_data_type(type_opts)
        else:
            final += type_opts
    return final + ">"


def parse_row_data_type(type_str: str) -> str:
    """
    This mehtod is used to convert the complex row datatype to the format that is supported by OpenMetadata
    For Example:
    If we have a row type as row(col1 bigint, col2 bigint, col3 row(col4 string, col5 bigint))
    this method will return type as -> struct<col1:bigint,col2:bigint,col3:struct<col4:string,col5:bigint>>
    """
    type_name, type_opts = get_type_name_and_opts(type_str)
    final = type_name.replace(ROW_DATA_TYPE, "struct") + "<"
    if type_opts:
        for data_type in datatype.aware_split(type_opts) or []:
            attr_name, attr_type_str = datatype.aware_split(
                data_type.strip(), delimiter=" ", maxsplit=1
            )
            if attr_type_str.startswith(ROW_DATA_TYPE):
                final += attr_name + ":" + parse_row_data_type(attr_type_str) + ","
            elif attr_type_str.startswith(ARRAY_DATA_TYPE):
                final += attr_name + ":" + parse_array_data_type(attr_type_str) + ","
            else:
                final += attr_name + ":" + attr_type_str + ","
    return final[:-1] + ">"


def _get_columns(
    self, connection: Connection, table_name: str, schema: str = None, **__
) -> List[Dict[str, Any]]:
    # pylint: disable=protected-access
    schema = schema or self._get_default_schema_name(connection)
    query = f"SHOW COLUMNS FROM {schema}.{table_name}"

    res = connection.execute(sql.text(query), schema=schema, table=table_name)
    columns = []
    for record in res:
        col_type, profile_key = datatype.parse_sqltype(record.Type)
        column = {
            "name": record.Column,
            "type": col_type,
            "nullable": True,
            "comment": record.Comment,
            "raw_data_type": record.Type,
            "profile_key": profile_key,
        }
        type_str = record.Type.strip().lower()
        type_name, type_opts = get_type_name_and_opts(type_str)
        if type_opts and type_name == ROW_DATA_TYPE:
            column["raw_data_type"] = parse_row_data_type(type_str)
            column["is_complex"] = True
        elif type_opts and type_name == ARRAY_DATA_TYPE:
            column["raw_data_type"] = parse_array_data_type(type_str)
            column["is_complex"] = True
        columns.append(column)
    return columns


def get_table_comment(  # pylint: disable=unused-argument
    self, connection: Connection, table_name: str, schema: str = None, **kw
) -> Dict[str, Any]:
    """
    Override get table comment method to batch process comments
    """
    catalog_name = self._get_default_catalog_name(  # pylint: disable=protected-access
        connection
    )
    if catalog_name is None:
        raise exc.NoSuchTableError("catalog is required in connection")
    schema_name = (
        self._get_default_schema_name(connection)  # pylint: disable=protected-access
        or schema
    )
    if schema_name is None:
        raise exc.NoSuchTableError("schema is required")
    self.processed_schema = (
        self.processed_schema if hasattr(self, "processed_schema") else set()
    )
    try:
        if (
            not hasattr(self, "all_table_comments")
            or self.current_db != connection.engine.url.database
            or schema not in self.processed_schema
        ):
            self.processed_schema.add(schema)
            self.get_all_table_comments(
                connection,
                TRINO_TABLE_COMMENTS.format(
                    catalog_name=catalog_name, schema_name=schema
                ),
            )
        return {"text": self.all_table_comments.get((table_name, schema))}
    except error.TrinoQueryError as exe:
        if exe.error_name in (error.PERMISSION_DENIED,):
            return {"text": None}
        raise


def parse_sqltype(type_str: str) -> TypeEngine:
    type_str = type_str.strip().lower()
    match = re.match(r"^(?P<type>\w+)\s*(?:\((?P<options>.*)\))?", type_str)
    if not match:
        util.warn(f"Could not parse type name '{type_str}'")
        return sqltypes.NULLTYPE
    type_name = match.group("type")
    type_opts = match.group("options")

    if type_name == "array":
        item_type = parse_sqltype(type_opts)
        if isinstance(item_type, sqltypes.ARRAY):
            # Multi-dimensions array is normalized in SQLAlchemy, e.g:
            # `ARRAY(ARRAY(INT))` in Trino SQL will become `ARRAY(INT(), dimensions=2)` in SQLAlchemy
            dimensions = (item_type.dimensions or 1) + 1
            return sqltypes.ARRAY(item_type.item_type, dimensions=dimensions)
        return sqltypes.ARRAY(item_type), "array"
    elif type_name == "map":
        key_type_str, value_type_str = aware_split(type_opts)
        key_type = parse_sqltype(key_type_str)
        value_type = parse_sqltype(value_type_str)
        return MAP(key_type, value_type), "map"
    elif type_name == "row":
        attr_types: List[Tuple[Optional[str], SQLType]] = []
        for attr in aware_split(type_opts):
            attr_name, attr_type_str = aware_split(
                attr.strip(), delimiter=" ", maxsplit=1
            )
            attr_name = unquote(attr_name)
            attr_type = parse_sqltype(attr_type_str)
            attr_types.append((attr_name, attr_type))
        return ROW(attr_types), "row"

    if type_name not in _type_map:
        util.warn(f"Did not recognize type '{type_name}'")
        return sqltypes.NULLTYPE
    type_class = _type_map[type_name]
    type_args = [int(o.strip()) for o in type_opts.split(",")] if type_opts else []
    if type_name in ("time", "timestamp"):
        type_kwargs: Dict[str, Any] = dict()
        if type_str.endswith("with time zone"):
            type_kwargs["timezone"] = True
        if type_opts is not None:
            type_kwargs["precision"] = int(type_opts)
        return type_class(**type_kwargs), "time"
    return type_class(*type_args), type_name
