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
Module to define overridden dialect methods
"""
import operator
from functools import reduce
from typing import Dict, Optional

import sqlalchemy.types as sqltypes
from snowflake.sqlalchemy.snowdialect import SnowflakeDialect
from sqlalchemy import exc as sa_exc
from sqlalchemy import util as sa_util
from sqlalchemy.engine import reflection
from sqlalchemy.sql import text
from sqlalchemy.types import FLOAT

from metadata.ingestion.source.database.incremental_metadata_extraction import (
    IncrementalConfig,
)
from metadata.ingestion.source.database.snowflake.models import (
    SnowflakeTable,
    SnowflakeTableList,
)
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_GET_COMMENTS,
    SNOWFLAKE_GET_DYNAMIC_TABLE_NAMES,
    SNOWFLAKE_GET_EXTERNAL_TABLE_NAMES,
    SNOWFLAKE_GET_MVIEW_NAMES,
    SNOWFLAKE_GET_SCHEMA_COLUMNS,
    SNOWFLAKE_GET_STREAM_DEFINITION,
    SNOWFLAKE_GET_STREAM_NAMES,
    SNOWFLAKE_GET_TABLE_DDL,
    SNOWFLAKE_GET_TRANSIENT_NAMES,
    SNOWFLAKE_GET_VIEW_DDL,
    SNOWFLAKE_GET_VIEW_DEFINITION,
    SNOWFLAKE_GET_VIEW_NAMES,
    SNOWFLAKE_GET_WITHOUT_TRANSIENT_TABLE_NAMES,
    SNOWFLAKE_INCREMENTAL_GET_DYNAMIC_TABLE_NAMES,
    SNOWFLAKE_INCREMENTAL_GET_EXTERNAL_TABLE_NAMES,
    SNOWFLAKE_INCREMENTAL_GET_MVIEW_NAMES,
    SNOWFLAKE_INCREMENTAL_GET_STREAM_NAMES,
    SNOWFLAKE_INCREMENTAL_GET_TRANSIENT_NAMES,
    SNOWFLAKE_INCREMENTAL_GET_VIEW_NAMES,
    SNOWFLAKE_INCREMENTAL_GET_WITHOUT_TRANSIENT_TABLE_NAMES,
)
from metadata.utils import fqn
from metadata.utils.sqlalchemy_utils import (
    get_display_datatype,
    get_table_comment_wrapper,
    get_view_definition_wrapper,
)

dialect = SnowflakeDialect()
Query = str
QueryMap = Dict[str, Query]


TABLE_QUERY_MAPS = {
    "full": {
        "default": SNOWFLAKE_GET_WITHOUT_TRANSIENT_TABLE_NAMES,
        "transient_tables": SNOWFLAKE_GET_TRANSIENT_NAMES,
        "external_tables": SNOWFLAKE_GET_EXTERNAL_TABLE_NAMES,
        "dynamic_tables": SNOWFLAKE_GET_DYNAMIC_TABLE_NAMES,
    },
    "incremental": {
        "default": SNOWFLAKE_INCREMENTAL_GET_WITHOUT_TRANSIENT_TABLE_NAMES,
        "transient_tables": SNOWFLAKE_INCREMENTAL_GET_TRANSIENT_NAMES,
        "external_tables": SNOWFLAKE_INCREMENTAL_GET_EXTERNAL_TABLE_NAMES,
        "dynamic_tables": SNOWFLAKE_INCREMENTAL_GET_DYNAMIC_TABLE_NAMES,
    },
}

VIEW_QUERY_MAPS = {
    "full": {
        "views": SNOWFLAKE_GET_VIEW_NAMES,
        "materialized_views": SNOWFLAKE_GET_MVIEW_NAMES,
    },
    "incremental": {
        "views": SNOWFLAKE_INCREMENTAL_GET_VIEW_NAMES,
        "materialized_views": SNOWFLAKE_INCREMENTAL_GET_MVIEW_NAMES,
    },
}

STREAM_QUERY_MAPS = {
    "full": {
        "default": SNOWFLAKE_GET_STREAM_NAMES,
    },
    "incremental": {
        "default": SNOWFLAKE_INCREMENTAL_GET_STREAM_NAMES,
    },
}


def _denormalize_quote_join(*idents):
    ip = dialect.identifier_preparer
    split_idents = reduce(
        operator.add,
        [ip._split_schema_by_dot(ids) for ids in idents if ids is not None],
    )
    quoted_identifiers = ip._quote_free_identifiers(*split_idents)
    normalized_identifiers = (
        item if item.startswith('"') and item.endswith('"') else f'"{item}"'
        for item in quoted_identifiers
    )
    return ".".join(normalized_identifiers)


def _quoted_name(entity_name: Optional[str]) -> Optional[str]:
    if entity_name:
        return fqn.quote_name(entity_name)

    return None


def get_table_names_reflection(self, schema=None, **kw):
    """Return all table names in referred to within a particular schema.

    The names are expected to be real tables only, not views.
    Views are instead returned using the
    :meth:`_reflection.Inspector.get_view_names`
    method.


    :param schema: Schema name. If ``schema`` is left at ``None``, the
        database's default schema is
        used, else the named schema is searched.  If the database does not
        support named schemas, behavior is undefined if ``schema`` is not
        passed as ``None``.  For special quoting, use :class:`.quoted_name`.

    .. seealso::

        :meth:`_reflection.Inspector.get_sorted_table_and_fkc_names`

        :attr:`_schema.MetaData.sorted_tables`

    """

    with self._operation_context() as conn:  # pylint: disable=protected-access
        return self.dialect.get_table_names(
            conn, schema, info_cache=self.info_cache, **kw
        )


def get_view_names_reflection(self, schema=None, **kw):
    """Return all view names in `schema`.

    :param schema: Optional, retrieve names from a non-default schema.
        For special quoting, use :class:`.quoted_name`.

    """

    with self._operation_context() as conn:  # pylint: disable=protected-access
        return self.dialect.get_view_names(
            conn, schema, info_cache=self.info_cache, **kw
        )


def get_stream_names_reflection(self, schema=None, **kw):
    """Return all stream names in `schema`.

    :param schema: Optional, retrieve names from a non-default schema.
        For special quoting, use :class:`.quoted_name`.

    """

    with self._operation_context() as conn:  # pylint: disable=protected-access
        return self.dialect.get_stream_names(
            conn, schema, info_cache=self.info_cache, **kw
        )


def _get_query_map(
    incremental: Optional[IncrementalConfig], query_maps: Dict[str, QueryMap]
):
    """Returns the proper queries depending if the extraction is Incremental or Full."""
    if incremental and incremental.enabled:
        return query_maps["incremental"]
    return query_maps["full"]


def _get_query_parameters(
    self,
    connection,
    schema: str,
    incremental: Optional[IncrementalConfig],
    account_usage: Optional[str] = None,
):
    """Returns the proper query parameters depending if the extraction is Incremental or Full"""
    parameters = {"schema": fqn.unquote_name(schema)}

    if incremental and incremental.enabled:
        database, _ = self._current_database_schema(connection)  # pylint: disable=W0212
        parameters = {
            **parameters,
            "date": incremental.start_timestamp,
            "database": database,
            "account_usage": account_usage or "SNOWFLAKE.ACCOUNT_USAGE",
        }

    return parameters


def get_table_names(self, connection, schema: str, **kw):
    """Return the Table names to process based on the incremental setup."""
    incremental = kw.get("incremental")
    account_usage = kw.get("account_usage")

    queries = _get_query_map(incremental, TABLE_QUERY_MAPS)
    parameters = _get_query_parameters(
        self, connection, schema, incremental, account_usage
    )

    query = queries["default"]

    if kw.get("include_transient_tables"):
        query = queries["transient_tables"]

    if kw.get("external_tables"):
        query = queries["external_tables"]

    if kw.get("dynamic_tables"):
        query = queries["dynamic_tables"]

    cursor = connection.execute(query.format(**parameters))
    result = SnowflakeTableList(
        tables=[
            SnowflakeTable(name=self.normalize_name(row[0]), deleted=row[1])
            for row in cursor
        ]
    )
    return result


def get_view_names(self, connection, schema, **kw):
    incremental = kw.get("incremental")
    account_usage = kw.get("account_usage")

    queries = _get_query_map(incremental, VIEW_QUERY_MAPS)
    parameters = _get_query_parameters(
        self, connection, schema, incremental, account_usage
    )

    if kw.get("materialized_views"):
        query = queries["materialized_views"]
    else:
        query = queries["views"]

    cursor = connection.execute(query.format(**parameters))
    result = SnowflakeTableList(
        tables=[
            SnowflakeTable(name=self.normalize_name(row[0]), deleted=row[1])
            for row in cursor
        ]
    )
    return result


def get_stream_names(self, connection, schema, **kw):
    incremental = kw.get("incremental")

    queries = _get_query_map(incremental, STREAM_QUERY_MAPS)
    parameters = _get_query_parameters(self, connection, schema, incremental)

    query = queries["default"]

    cursor = connection.execute(query.format(**parameters))
    result = SnowflakeTableList(
        tables=[
            SnowflakeTable(name=self.normalize_name(row[1]), deleted=None)
            for row in cursor
        ]
    )
    return result


@reflection.cache
def get_view_definition(
    self, connection, table_name, schema=None, **kw
):  # pylint: disable=unused-argument
    view_definition = get_view_definition_wrapper(
        self,
        connection,
        table_name=table_name,
        schema=schema,
        query=SNOWFLAKE_GET_VIEW_DEFINITION,
    )
    if view_definition:
        return view_definition

    # If the view definition is not found via optimized query,
    # we need to get the view definition from the view ddl

    schema = schema or self.default_schema_name
    view_name = f"{schema}.{table_name}" if schema else table_name
    cursor = connection.execute(SNOWFLAKE_GET_VIEW_DDL.format(view_name=view_name))
    try:
        result = cursor.fetchone()
        if result:
            return result[0]
    except Exception:
        pass
    return None


@reflection.cache
def get_stream_definition(  # pylint: disable=unused-argument
    self, connection, stream_name, schema=None, **kw
):
    """
    Gets the stream definition
    """
    schema = schema or self.default_schema_name
    stream_name = f"{schema}.{stream_name}" if schema else stream_name
    cursor = connection.execute(
        SNOWFLAKE_GET_STREAM_DEFINITION.format(stream_name=stream_name)
    )
    try:
        result = cursor.fetchone()
        if result:
            return result[0]
    except Exception:
        pass
    return None


@reflection.cache
def get_table_comment(
    self, connection, table_name, schema=None, **kw
):  # pylint: disable=unused-argument
    return get_table_comment_wrapper(
        self,
        connection,
        table_name=table_name,
        schema=schema,
        query=SNOWFLAKE_GET_COMMENTS,
    )


def normalize_names(self, name):  # pylint: disable=unused-argument
    return name


# pylint: disable=too-many-locals,protected-access
@reflection.cache
def get_schema_columns(self, connection, schema, **kw):
    """Get all columns in the schema, if we hit 'Information schema query returned too much data' problem return
    None, as it is cacheable and is an unexpected return type for this function"""
    ans = {}
    current_database, _ = self._current_database_schema(connection, **kw)
    full_schema_name = _denormalize_quote_join(current_database, fqn.quote_name(schema))
    try:
        schema_primary_keys = self._get_schema_primary_keys(
            connection, full_schema_name, **kw
        )
        # removing " " from schema name because schema name is in the WHERE clause of a query
        table_schema = self.denormalize_name(fqn.unquote_name(schema))
        table_schema = table_schema.lower() if schema.islower() else table_schema
        result = connection.execute(
            text(SNOWFLAKE_GET_SCHEMA_COLUMNS), {"table_schema": table_schema}
        )

    except sa_exc.ProgrammingError as p_err:
        if p_err.orig.errno == 90030:
            # This means that there are too many tables in the schema, we need to go more granular
            return None  # None triggers _get_table_columns while staying cacheable
        raise
    for (
        table_name,
        column_name,
        coltype,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        is_nullable,
        column_default,
        is_identity,
        comment,
        identity_start,
        identity_increment,
    ) in result:
        table_name = self.normalize_name(fqn.quote_name(table_name))
        column_name = self.normalize_name(column_name)
        if table_name not in ans:
            ans[table_name] = []
        if column_name.startswith("sys_clustering_column"):
            continue  # ignoring clustering column
        col_type = self.ischema_names.get(coltype, None)
        col_type_kw = {}
        if col_type is None:
            sa_util.warn(
                f"Did not recognize type '{coltype}' of column '{column_name}'"
            )
            col_type = sqltypes.NullType
            type_instance = col_type()
        else:
            if issubclass(col_type, FLOAT):
                col_type_kw["precision"] = numeric_precision
                col_type_kw["decimal_return_scale"] = numeric_scale
            elif issubclass(col_type, sqltypes.Numeric):
                col_type_kw["precision"] = numeric_precision
                col_type_kw["scale"] = numeric_scale
            elif issubclass(col_type, (sqltypes.String, sqltypes.BINARY)):
                col_type_kw["length"] = character_maximum_length
            type_instance = col_type(**col_type_kw)

        current_table_pks = schema_primary_keys.get(table_name)

        ans[table_name].append(
            {
                "name": column_name,
                "type": type_instance,
                "nullable": is_nullable == "YES",
                "default": column_default,
                "autoincrement": is_identity == "YES",
                "system_data_type": get_display_datatype(
                    coltype,
                    char_len=character_maximum_length,
                    precision=numeric_precision,
                    scale=numeric_scale,
                ),
                "comment": comment,
                "primary_key": (
                    (
                        column_name
                        in schema_primary_keys[table_name]["constrained_columns"]
                    )
                    if current_table_pks
                    else False
                ),
            }
        )
        if is_identity == "YES":
            ans[table_name][-1]["identity"] = {
                "start": identity_start,
                "increment": identity_increment,
            }
    return ans


@reflection.cache
def _current_database_schema(self, connection, **kw):  # pylint: disable=unused-argument
    """Getting table name in quotes"""
    res = connection.exec_driver_sql(
        "select current_database(), current_schema();"
    ).fetchone()
    return (
        self.normalize_name(_quoted_name(entity_name=res[0])),
        self.normalize_name(res[1]),
    )


@reflection.cache
def get_pk_constraint(self, connection, table_name, schema=None, **kw):
    schema = schema or self.default_schema_name
    schema = _quoted_name(entity_name=schema)
    current_database, current_schema = self._current_database_schema(connection, **kw)
    full_schema_name = _denormalize_quote_join(
        current_database, schema if schema else current_schema
    )

    return self._get_schema_primary_keys(
        connection, self.denormalize_name(full_schema_name), **kw
    ).get(table_name, {"constrained_columns": [], "name": None})


@reflection.cache
def get_foreign_keys(self, connection, table_name, schema=None, **kw):
    """
    Gets all foreign keys for a table
    """
    schema = schema or self.default_schema_name
    schema = _quoted_name(entity_name=schema)
    current_database, current_schema = self._current_database_schema(connection, **kw)
    full_schema_name = _denormalize_quote_join(
        current_database, schema if schema else current_schema
    )

    foreign_key_map = self._get_schema_foreign_keys(
        connection, self.denormalize_name(full_schema_name), **kw
    )
    return foreign_key_map.get(table_name, [])


@reflection.cache
def get_schema_foreign_keys(self, connection, schema, **kw):
    current_database, current_schema = self._current_database_schema(connection, **kw)
    result = connection.execute(
        text(
            f"SHOW /* sqlalchemy:_get_schema_foreign_keys */ IMPORTED KEYS IN SCHEMA {schema}"
        )
    )
    foreign_key_map = {}
    for row in result:
        name = self.normalize_name(row._mapping["fk_name"])
        if name not in foreign_key_map:
            referred_schema = self.normalize_name(row._mapping["pk_schema_name"])
            foreign_key_map[name] = {
                "constrained_columns": [
                    self.normalize_name(row._mapping["fk_column_name"])
                ],
                # referred schema should be None in context where it doesn't need to be specified
                # https://docs.sqlalchemy.org/en/14/core/reflection.html#reflection-schema-qualified-interaction
                "referred_schema": (
                    referred_schema
                    if referred_schema not in (self.default_schema_name, current_schema)
                    else None
                ),
                "referred_table": self.normalize_name(row._mapping["pk_table_name"]),
                "referred_columns": [
                    self.normalize_name(row._mapping["pk_column_name"])
                ],
                "referred_database": self.normalize_name(
                    row._mapping["pk_database_name"]
                ),
                "name": name,
                "table_name": self.normalize_name(row._mapping["fk_table_name"]),
            }
            options = {}
            if self.normalize_name(row._mapping["delete_rule"]) != "NO ACTION":
                options["ondelete"] = self.normalize_name(row._mapping["delete_rule"])
            if self.normalize_name(row._mapping["update_rule"]) != "NO ACTION":
                options["onupdate"] = self.normalize_name(row._mapping["update_rule"])
            foreign_key_map[name]["options"] = options
        else:
            foreign_key_map[name]["constrained_columns"].append(
                self.normalize_name(row._mapping["fk_column_name"])
            )
            foreign_key_map[name]["referred_columns"].append(
                self.normalize_name(row._mapping["pk_column_name"])
            )

    ans = {}

    for _, v in foreign_key_map.items():
        if v["table_name"] not in ans:
            ans[v["table_name"]] = []
        ans[v["table_name"]].append(
            {k2: v2 for k2, v2 in v.items() if k2 != "table_name"}
        )
    return ans


@reflection.cache
def get_unique_constraints(self, connection, table_name, schema, **kw):
    schema = schema or self.default_schema_name
    schema = _quoted_name(entity_name=schema)
    current_database, current_schema = self._current_database_schema(connection, **kw)
    full_schema_name = _denormalize_quote_join(
        current_database, schema if schema else current_schema
    )

    return self._get_schema_unique_constraints(
        connection, self.denormalize_name(full_schema_name), **kw
    ).get(table_name, [])


@reflection.cache
def get_columns(self, connection, table_name, schema=None, **kw):
    """
    Gets all column info given the table info
    """
    schema = schema or self.default_schema_name
    if not schema:
        _, schema = self._current_database_schema(connection, **kw)

    schema_columns = self._get_schema_columns(connection, schema, **kw)
    if schema_columns is None:
        # Too many results, fall back to only query about single table
        return self._get_table_columns(connection, table_name, schema, **kw)
    normalized_table_name = self.normalize_name(fqn.quote_name(table_name))
    if normalized_table_name not in schema_columns:
        raise sa_exc.NoSuchTableError()
    return schema_columns[normalized_table_name]


@reflection.cache
def get_table_ddl(
    self, connection, table_name, schema=None, **kw
):  # pylint: disable=unused-argument
    """
    Gets the Table DDL
    """
    schema = schema or self.default_schema_name
    table_name = f"{schema}.{table_name}" if schema else table_name
    cursor = connection.execute(SNOWFLAKE_GET_TABLE_DDL.format(table_name=table_name))
    try:
        result = cursor.fetchone()
        if result:
            return result[0]
    except Exception:
        pass
    return None
