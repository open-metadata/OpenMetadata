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
Utils module to define overrided sqlalchamy methods 
"""
# pylint: disable=protected-access,unused-argument


from clickhouse_sqlalchemy.drivers.base import ischema_names
from clickhouse_sqlalchemy.types import Date
from sqlalchemy import text
from sqlalchemy import types as sqltypes
from sqlalchemy.engine import reflection
from sqlalchemy.util import warn

from metadata.ingestion.source.database.clickhouse.queries import (
    CLICKHOUSE_TABLE_COMMENTS,
    CLICKHOUSE_VIEW_DEFINITIONS,
)
from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
from metadata.utils.sqlalchemy_utils import (
    get_table_comment_wrapper,
    get_view_definition_wrapper,
)

Map = create_sqlalchemy_type("Map")
Array = create_sqlalchemy_type("Array")
Enum = create_sqlalchemy_type("Enum")
Tuple = create_sqlalchemy_type("Tuple")
BIGINT = create_sqlalchemy_type("BIGINT")
SMALLINT = create_sqlalchemy_type("SMALLINT")
INTEGER = create_sqlalchemy_type("INTEGER")

ischema_names.update(
    {
        "AggregateFunction": create_sqlalchemy_type("AggregateFunction"),
        "Map": Map,
        "Array": Array,
        "Tuple": Tuple,
        "Enum": Enum,
        "Date32": Date,
        "SimpleAggregateFunction": create_sqlalchemy_type("SimpleAggregateFunction"),
        "Int256": BIGINT,
        "Int128": BIGINT,
        "Int64": BIGINT,
        "Int32": INTEGER,
        "Int16": SMALLINT,
        "Int8": SMALLINT,
        "UInt256": BIGINT,
        "UInt128": BIGINT,
        "UInt64": BIGINT,
        "UInt32": INTEGER,
        "UInt16": SMALLINT,
        "UInt8": SMALLINT,
        "IPv4": create_sqlalchemy_type("IPv4"),
        "IPv6": create_sqlalchemy_type("IPv6"),
    }
)


@reflection.cache
def _get_column_type(
    self, name, spec
):  # pylint: disable=protected-access,too-many-branches,too-many-return-statements
    if spec.startswith("Array"):
        return self.ischema_names["Array"]

    if spec.startswith("FixedString"):
        return self.ischema_names["FixedString"]

    if spec.startswith("Nullable"):
        inner = spec[9:-1]
        coltype = self.ischema_names["_nullable"]
        return self._get_column_type(name, inner)

    if spec.startswith("LowCardinality"):
        inner = spec[15:-1]
        coltype = self.ischema_names["_lowcardinality"]
        return coltype(self._get_column_type(name, inner))

    if spec.startswith("Tuple"):
        return self.ischema_names["Tuple"]

    if spec.startswith("Map"):
        return self.ischema_names["Map"]

    if spec.startswith("Enum"):
        return self.ischema_names["Enum"]

    if spec.startswith("DateTime64"):
        return self.ischema_names["DateTime64"]

    if spec.startswith("DateTime"):
        return self.ischema_names["DateTime"]

    if spec.lower().startswith("decimal"):
        coltype = self.ischema_names["Decimal"]
        return coltype(*self._parse_decimal_params(spec))

    if spec.lower().startswith("aggregatefunction"):
        return self.ischema_names["AggregateFunction"]

    if spec.lower().startswith("simpleaggregatefunction"):
        return self.ischema_names["SimpleAggregateFunction"]
    try:
        return self.ischema_names[spec]
    except KeyError:
        warn(f"Did not recognize type '{spec}' of column '{name}'")
        return sqltypes.NullType


def get_mview_names(self, schema=None):
    """Return all materialized view names in `schema`.

    :param schema: Optional, retrieve names from a non-default schema.
        For special quoting, use :class:`.quoted_name`.

    """

    with self._operation_context() as conn:
        return self.dialect.get_mview_names(conn, schema, info_cache=self.info_cache)


def get_mview_names_dialect(self, connection, schema=None, **kw):
    query = text(
        "SELECT name FROM system.tables WHERE engine = 'MaterializedView' "
        "AND database = :database"
    )
    database = schema or connection.engine.url.database
    rows = self._execute(connection, query, database=database)
    return [row.name for row in rows]


@reflection.cache
def get_unique_constraints(self, connection, table_name, schema=None, **kw):
    return []


@reflection.cache
def get_pk_constraint(
    self, bind, table_name, schema=None, **kw  # pylint: disable=unused-argument
):
    return {"constrained_columns": [], "name": "undefined"}


@reflection.cache
def get_view_names(
    self, connection, schema=None, **kw  # pylint: disable=unused-argument
):
    query = text(
        "SELECT name FROM system.tables WHERE engine = 'View' "
        "AND database = :database"
    )
    database = schema or connection.engine.url.database
    rows = self._execute(  # pylint: disable=protected-access
        connection, query, database=database
    )
    return [row.name for row in rows]


@reflection.cache
def get_view_definition(
    self, connection, table_name, schema=None, **kw  # pylint: disable=unused-argument
):
    return get_view_definition_wrapper(
        self,
        connection,
        table_name=table_name,
        schema=schema,
        query=CLICKHOUSE_VIEW_DEFINITIONS,
    )


@reflection.cache
def get_table_comment(
    self, connection, table_name, schema=None, **kw  # pylint: disable=unused-argument
):
    return get_table_comment_wrapper(
        self,
        connection,
        table_name=table_name,
        schema=schema,
        query=CLICKHOUSE_TABLE_COMMENTS,
    )


def _get_column_info(
    self, name, format_type, default_type, default_expression, comment
):
    col_type = self._get_column_type(  # pylint: disable=protected-access
        name, format_type
    )
    col_default = self._get_column_default(  # pylint: disable=protected-access
        default_type, default_expression
    )

    raw_type = format_type.lower().replace("(", "<").replace(")", ">")
    result = {
        "name": name,
        "type": col_type,
        "nullable": format_type.startswith("Nullable("),
        "default": col_default,
        "comment": comment or None,
        "system_data_type": raw_type,
    }

    if col_type in [Map, Array, Tuple, Enum]:
        result["display_type"] = raw_type

    if col_type == Array:
        result["is_complex"] = True
    return result
