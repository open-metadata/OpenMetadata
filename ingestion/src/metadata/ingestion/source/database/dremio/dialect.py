#  Copyright 2026 Collate
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
SQLAlchemy dialect for Dremio, on top of `sqlalchemy-dremio` (Arrow Flight).

`sqlalchemy-dremio` targets SQLAlchemy 1.x: its reflection methods run plain
strings with `connection.execute(...)`, which SQLAlchemy 2 rejects. The
dialect below keeps its Arrow Flight transport and replaces the reflection
methods the connector relies on, reading the catalog from `INFORMATION_SCHEMA`.

The driver drops the parameters it is given, so values are written in the SQL
text, escaped, and statements go through `exec_driver_sql` so that SQLAlchemy
does not read a `:` in a name as a bind parameter.

The driver cannot choose the project of a Dremio Cloud organisation either: it
sends the queries to the default project of the token. The project is a
session option (`project_id`) that Dremio reads on the first call of the
session and keeps in the cookie of the connection, which the driver already
sends back. The dialect takes the project from the `project_id` parameter of
the URL and sets it once, when it opens a connection.
"""

import math
from threading import Lock
from typing import Any

from cachetools import LRUCache
from pyarrow.flight import Action
from sqlalchemy import types
from sqlalchemy.dialects import registry
from sqlalchemy.engine import Connection
from sqlalchemy_dremio.flight import DremioDialect_flight

DREMIO_DIALECT_NAME = "dremio.flight"

GET_SCHEMA_NAMES = "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA"

GET_TABLE_NAMES = 'SELECT TABLE_NAME FROM INFORMATION_SCHEMA."TABLES" WHERE TABLE_SCHEMA = {schema}'

GET_TABLE_EXISTS = (
    'SELECT COUNT(*) FROM INFORMATION_SCHEMA."TABLES" WHERE TABLE_SCHEMA = {schema} AND TABLE_NAME = {table}'
)

# INFORMATION_SCHEMA."COLUMNS" is filled lazily for lakehouse tables (Iceberg,
# Delta...): it stays empty until Dremio has read the table once. DESCRIBE
# loads the schema on demand, so it is what the columns are read from.
DESCRIBE_TABLE = "DESCRIBE {path}"

# One query for all the tables of a schema, for those that Dremio has already
# loaded. The others are described one by one.
GET_SCHEMA_COLUMNS = """
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, NUMERIC_PRECISION, NUMERIC_SCALE
FROM INFORMATION_SCHEMA."COLUMNS"
WHERE TABLE_SCHEMA = {schema}
ORDER BY TABLE_NAME, ORDINAL_POSITION
"""

GET_VIEW_DEFINITION = (
    'SELECT VIEW_DEFINITION FROM INFORMATION_SCHEMA."VIEWS" WHERE TABLE_SCHEMA = {schema} AND TABLE_NAME = {view}'
)

# Types Dremio reports in INFORMATION_SCHEMA.COLUMNS.DATA_TYPE
SIMPLE_TYPES = {
    "BOOLEAN": types.BOOLEAN,
    "TINYINT": types.SMALLINT,
    "SMALLINT": types.SMALLINT,
    "INTEGER": types.INTEGER,
    "BIGINT": types.BIGINT,
    "FLOAT": types.FLOAT,
    "DOUBLE": types.DOUBLE,
    "DATE": types.DATE,
    "TIME": types.TIME,
    "TIMESTAMP": types.TIMESTAMP,
    "BINARY VARYING": types.VARBINARY,
}


# The schemas of a database are read one after the other, so the columns of the
# last few are enough to read them with one query per schema.
COLUMNS_CACHE_SIZE = 8

PROJECT_ID_PROPERTY = "project_id"
SET_SESSION_OPTIONS_ACTION = "SetSessionOptions"


def _length_delimited(field: int, payload: bytes) -> bytes:
    """Protocol buffers encoding of a field that holds bytes, a string or a message."""
    size, varint = len(payload), bytearray()
    while True:
        low, size = size & 0x7F, size >> 7
        varint.append(low | (0x80 if size else 0))
        if not size:
            return bytes([field << 3 | 2]) + bytes(varint) + payload


def set_session_option_request(name: str, value: str) -> bytes:
    """
    Arrow Flight `SetSessionOptionsRequest` with one string option, built by hand:
    `session_options` (1) is a map of `SessionOptionValue`, whose `string_value` is its field 1.
    pyarrow does not expose this action and the message is small and stable.
    """
    entry = _length_delimited(1, name.encode()) + _length_delimited(2, _length_delimited(1, value.encode()))
    return _length_delimited(1, entry)


def literal(value: str) -> str:
    """Write `value` as a single quoted SQL string"""
    return "'" + str(value).replace("'", "''") + "'"


def quote_path(schema: str | None, table: str) -> str:
    """
    Write the path of a table, where `schema` is the dotted path of its space
    and folders (e.g. `space.folder`): every part is a quoted identifier.
    """
    parts = [*(schema.split(".") if schema else []), table]
    return ".".join('"' + part.replace('"', '""') + '"' for part in parts)


NESTED_TYPES = ("ROW", "STRUCT", "ARRAY", "LIST", "MAP")

# Names of Dremio types that OpenMetadata knows under another one
OM_TYPE_NAMES = {
    "CHARACTER VARYING": "varchar",
    "BINARY VARYING": "varbinary",
    "INTEGER": "int",
    "DOUBLE PRECISION": "double",
}


def is_nested(data_type: str | None) -> bool:
    """Whether the type has fields or elements, e.g. `ROW(a VARCHAR, b INTEGER)`"""
    return (data_type or "").strip().upper().startswith(NESTED_TYPES)


def split_top_level(text: str) -> list[str]:
    """Split on the commas that are not inside parentheses"""
    parts, depth, current = [], 0, ""
    for char in text:
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        if char == "," and depth == 0:
            parts.append(current.strip())
            current = ""
        else:
            current += char
    if current.strip():
        parts.append(current.strip())
    return parts


def to_om_type(data_type: str) -> str:
    """
    Write a Dremio type the way the column parser of OpenMetadata reads it:
    `ROW(a VARCHAR, b ROW(c INTEGER))` becomes `struct<a:varchar,b:struct<c:int>>`
    """
    data_type = data_type.strip()
    upper = data_type.upper()

    if upper.startswith(("ROW(", "STRUCT(")):
        fields = []
        for field in split_top_level(data_type[data_type.index("(") + 1 : -1]):
            if field.startswith('"'):
                name, _, field_type = field[1:].partition('"')
            else:
                name, _, field_type = field.partition(" ")
            fields.append(f"{name}:{to_om_type(field_type)}")
        return f"struct<{','.join(fields)}>"
    if upper.startswith(("ARRAY(", "LIST(")):
        return f"array<{to_om_type(data_type[data_type.index('(') + 1 : -1])}>"
    if upper.startswith("MAP("):
        key, value = split_top_level(data_type[4:-1])
        return f"map<{to_om_type(key)},{to_om_type(value)}>"

    base = upper.split("(")[0].strip()
    return OM_TYPE_NAMES.get(base, base.lower())


def as_number(value: float | None) -> float | None:
    """Dremio reports a missing precision or scale as NaN"""
    return None if value is None or math.isnan(value) else value


def get_column_type(
    data_type: str,
    length: int | None,
    precision: int | None,
    scale: int | None,
) -> types.TypeEngine:
    """Translate a Dremio data type into a SQLAlchemy type"""
    data_type = (data_type or "").upper()
    precision, scale = as_number(precision), as_number(scale)

    if data_type in ("CHARACTER VARYING", "CHARACTER", "VARCHAR"):
        return types.VARCHAR(length) if length else types.VARCHAR()
    if data_type in ("DECIMAL", "NUMERIC"):
        # Dremio reports precision and scale as floats (e.g. 38.0)
        return types.DECIMAL(int(precision), int(scale or 0)) if precision else types.DECIMAL()
    if data_type in SIMPLE_TYPES:
        return SIMPLE_TYPES[data_type]()
    if data_type.startswith("INTERVAL"):
        return types.Interval()

    # ROW, LIST, MAP... are not reflected with their inner fields here
    return types.NullType()


class DremioFlightDialect(DremioDialect_flight):
    """
    `dremio+flight` dialect whose reflection works with SQLAlchemy 2
    """

    def create_connect_args(self, url):
        """The driver drops the parameters it does not know: the project id travels at the end of the connection string"""
        args, kwargs = super().create_connect_args(url)
        project_id = {key.lower(): value for key, value in url.query.items()}.get(PROJECT_ID_PROPERTY)
        if project_id:
            args = [f"{args[0]};{PROJECT_ID_PROPERTY}={project_id}", *args[1:]]
        return args, kwargs

    def connect(self, *cargs, **cparams):
        connection = super().connect(*cargs, **cparams)
        _, separator, project_id = cargs[0].rpartition(f";{PROJECT_ID_PROPERTY}=") if cargs else ("", "", "")
        if separator:
            request = Action(SET_SESSION_OPTIONS_ACTION, set_session_option_request(PROJECT_ID_PROPERTY, project_id))
            # the result is only read to get the error of an unknown project, raised by the call
            list(connection.flightclient.do_action(request, connection.options))
        return connection

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # the dialect is shared by the threads of a run
        self._columns_by_schema: LRUCache = LRUCache(maxsize=COLUMNS_CACHE_SIZE)
        self._columns_lock = Lock()

    def get_schema_names(self, connection: Connection, schema: str | None = None, **kw) -> list[str]:
        return [row[0] for row in connection.exec_driver_sql(GET_SCHEMA_NAMES)]

    def get_table_names(self, connection: Connection, schema: str | None = None, **kw) -> list[str]:
        query = GET_TABLE_NAMES.format(schema=literal(schema or ""))
        return [row[0] for row in connection.exec_driver_sql(query)]

    def has_table(
        self,
        connection: Connection,
        table_name: str,
        schema: str | None = None,
        **kw,
    ) -> bool:
        query = GET_TABLE_EXISTS.format(schema=literal(schema or ""), table=literal(table_name))
        return connection.exec_driver_sql(query).scalar() > 0

    def get_columns(
        self,
        connection: Connection,
        table_name: str,
        schema: str | None = None,
        **kw,
    ) -> list[dict[str, Any]]:
        rows = self._get_schema_columns(connection, schema or "").get(table_name)
        # INFORMATION_SCHEMA gives a bare ROW, without its fields
        if rows is None or any(is_nested(row[1]) for row in rows):
            query = DESCRIBE_TABLE.format(path=quote_path(schema, table_name))
            rows = [tuple(row[:5]) for row in connection.exec_driver_sql(query)]

        columns = []
        for name, data_type, is_nullable, precision, scale in rows:
            column = {
                "name": name,
                "type": get_column_type(data_type, None, precision, scale),
                "nullable": is_nullable != "NO",
                "default": None,
                "comment": None,
            }
            if is_nested(data_type):
                column.update({"system_data_type": to_om_type(data_type), "is_complex": True})
            columns.append(column)
        return columns

    def _get_schema_columns(self, connection: Connection, schema: str) -> dict[str, list[tuple]]:
        """
        The columns of the tables of a schema that INFORMATION_SCHEMA knows,
        by table, as (name, type, nullable, precision, scale)
        """
        with self._columns_lock:
            by_table = self._columns_by_schema.get(schema)
        if by_table is None:
            by_table = {}
            query = GET_SCHEMA_COLUMNS.format(schema=literal(schema))
            for table, name, data_type, is_nullable, precision, scale in connection.exec_driver_sql(query):
                by_table.setdefault(table, []).append((name, data_type, is_nullable, precision, scale))
            with self._columns_lock:
                self._columns_by_schema[schema] = by_table
        return by_table

    def get_view_definition(
        self,
        connection: Connection,
        view_name: str,
        schema: str | None = None,
        **kw,
    ) -> str | None:
        query = GET_VIEW_DEFINITION.format(schema=literal(schema or ""), view=literal(view_name))
        return connection.exec_driver_sql(query).scalar()


# Replaces the entry point of `sqlalchemy-dremio` for `dremio+flight`
registry.register(DREMIO_DIALECT_NAME, __name__, DremioFlightDialect.__name__)
