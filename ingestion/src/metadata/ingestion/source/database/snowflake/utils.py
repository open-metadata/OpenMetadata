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
import operator  # noqa: I001
import os
from collections import OrderedDict
from functools import reduce
from typing import Dict, Optional

import sqlalchemy.types as sqltypes
from snowflake.sqlalchemy.snowdialect import SnowflakeDialect
from sqlalchemy import exc as sa_exc
from sqlalchemy import util as sa_util
from sqlalchemy.engine import reflection
from sqlalchemy.sql import text
from sqlalchemy.types import FLOAT

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.incremental_metadata_extraction import (
    IncrementalConfig,
)
from metadata.ingestion.source.database.snowflake.models import (
    SnowflakeTable,
    SnowflakeTableList,
)
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_GET_COMMENTS,
    SNOWFLAKE_GET_MVIEW_NAMES,
    SNOWFLAKE_GET_SCHEMA_COLUMNS,
    SNOWFLAKE_GET_STAGES,
    SNOWFLAKE_GET_STREAM_DEFINITION,
    SNOWFLAKE_GET_STREAM_NAMES,
    SNOWFLAKE_GET_TABLE_DDL,
    SNOWFLAKE_GET_TABLE_NAMES,
    SNOWFLAKE_GET_VIEW_DDL,
    SNOWFLAKE_GET_VIEW_DEFINITION,
    SNOWFLAKE_GET_VIEW_NAMES,
    SNOWFLAKE_INCREMENTAL_GET_MVIEW_NAMES,
    SNOWFLAKE_INCREMENTAL_GET_STREAM_NAMES,
    SNOWFLAKE_INCREMENTAL_GET_TABLE_NAMES,
    SNOWFLAKE_INCREMENTAL_GET_VIEW_NAMES,
)
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_display_datatype,
    get_table_comment_wrapper,
    get_view_definition_wrapper,
)

logger = ingestion_logger()

dialect = SnowflakeDialect()
Query = str
QueryMap = Dict[str, Query]


# How many schemas' column dicts we keep in the get_schema_columns cache
# per Inspector. Inspectors are per-thread in OpenMetadata's setup
# (common_db_source.py:721), so this is effectively a per-thread bound:
# the schema each thread is currently processing, plus 1 buffer slot for
# the just-finished schema. That bound is N+1 in the "1 thread" case and
# in general gives each thread its own current+previous slots, so no
# thread's actively-used schema can be evicted by another thread cycling
# through small schemas.
#
# Without this bound info_cache only clears between databases
# (_release_engine in common_db_source.py:171), so multi-schema runs
# accumulate every schema's column metadata in RAM -- ~1.6 GB per
# pathologically wide schema, OOM-killing 4 GB pods on databases like
# COM_US_IMDNA_ADL.
_DEFAULT_SCHEMA_COLUMNS_CACHE_SIZE = 2
try:
    SCHEMA_COLUMNS_CACHE_SIZE = max(
        1,
        int(
            os.environ.get(
                "OM_SNOWFLAKE_SCHEMA_COLUMNS_CACHE_SIZE",
                _DEFAULT_SCHEMA_COLUMNS_CACHE_SIZE,
            )
        ),
    )
except ValueError:
    SCHEMA_COLUMNS_CACHE_SIZE = _DEFAULT_SCHEMA_COLUMNS_CACHE_SIZE

_SCHEMA_COLUMNS_LRU_KEY = "_om_snowflake_schema_columns_lru"


TABLE_QUERY_MAPS = {
    "full": {
        "default": SNOWFLAKE_GET_TABLE_NAMES,
    },
    "incremental": {
        "default": SNOWFLAKE_INCREMENTAL_GET_TABLE_NAMES,
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


def get_stage_names_reflection(self, schema=None, **kw):
    """Return all stage names in `schema`.

    :param schema: Optional, retrieve names from a non-default schema.
        For special quoting, use :class:`.quoted_name`.

    """

    with self._operation_context() as conn:  # pylint: disable=protected-access
        return self.dialect.get_stage_names(
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
    include_transient_tables: Optional[bool] = False,
    include_views: Optional[bool] = False,
):
    """Returns the proper query parameters depending if the extraction is Incremental or Full"""
    parameters = {
        "schema": fqn.unquote_name(schema),
        "include_transient_tables": (
            "TRUE"
            if include_transient_tables
            else "COALESCE(IS_TRANSIENT, 'NO') != 'YES'"
        ),
        "include_views": "TRUE" if include_views else "TABLE_TYPE != 'VIEW'",
    }

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
        self,
        connection,
        schema,
        incremental,
        account_usage,
        include_transient_tables=kw.get("include_transient_tables", False),
        include_views=kw.get("include_views", False),
    )

    query = queries["default"]

    cursor = connection.execute(query.format(**parameters))
    result = SnowflakeTableList(
        tables=[
            SnowflakeTable(
                name=self.normalize_name(row[0]),
                deleted=row[1],
                type_=_get_table_type(row[2] if row[2] else "BASE TABLE"),
            )
            for row in cursor
        ]
    )
    return result


def _get_table_type(table_type: str) -> TableType:
    table_type_map = {
        "BASE TABLE": TableType.Regular,
        "VIEW": TableType.View,
        "MATERIALIZED VIEW": TableType.MaterializedView,
        "EXTERNAL TABLE": TableType.External,
        "TRANSIENT TABLE": TableType.Transient,
        "DYNAMIC TABLE": TableType.Dynamic,
        "ICEBERG TABLE": TableType.Iceberg,
    }
    return table_type_map.get(table_type, TableType.Regular)


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


def get_stage_names(self, connection, schema, **kw):
    """Return all stage names in schema."""
    parameters = {"schema": fqn.unquote_name(schema)}
    cursor = connection.execute(SNOWFLAKE_GET_STAGES.format(**parameters))
    result = SnowflakeTableList(
        tables=[
            SnowflakeTable(
                name=self.normalize_name(row[1]),
                deleted=None,
                type_=TableType.Stage,
            )
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
    logger.debug(
        f"View definition not found via optimized query for {schema}.{table_name}, falling back to DDL query"
    )

    schema = schema or self.default_schema_name
    view_name = f'"{schema}"."{table_name}"' if schema else f'"{table_name}"'
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
    stream_name = f'"{schema}"."{stream_name}"' if schema else f'"{stream_name}"'
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


def _store_schema_columns_in_lru(info_cache, schema, value) -> None:
    """Add ``value`` (the schema columns dict, or ``None`` for the 90030
    fallback) to the bounded LRU and evict the oldest entry if the cache
    exceeds SCHEMA_COLUMNS_CACHE_SIZE. When an entry is evicted, drop the
    per-table ``get_columns`` cache entries for that schema too so the
    column data is actually freed."""
    if info_cache is None:
        return
    lru: OrderedDict = info_cache.setdefault(_SCHEMA_COLUMNS_LRU_KEY, OrderedDict())
    lru[schema] = value
    lru.move_to_end(schema)
    while len(lru) > SCHEMA_COLUMNS_CACHE_SIZE:
        evicted_schema, _ = lru.popitem(last=False)
        _evict_per_table_column_entries(info_cache, evicted_schema)


def _evict_per_table_column_entries(info_cache: dict, schema: str) -> None:
    """Remove per-table get_columns @reflection.cache entries for ``schema``.

    Each per-table cache entry holds the list returned by
    ``schema_columns[table_name]`` -- the SAME list object that lives inside
    the schema-wide dict. So dropping the schema-wide dict from our LRU is
    not enough on its own: the column data is still pinned via per-table
    entries until they are removed too.

    @reflection.cache key layout is
    ``(fn_name, server_version_info, default_schema_name, args, kw_items, exclude)``
    where ``args`` is the positional-arg tuple after ``(self, connection)``.
    For ``get_columns(table_name, schema)`` that is ``(table_name, schema)``.
    The check is defensive so a SQLAlchemy version that changes the layout
    just leaves entries in place rather than crashing.
    """
    to_drop = []
    for key in info_cache:
        if not isinstance(key, tuple) or len(key) < 4 or key[0] != "get_columns":
            continue
        args = key[3]
        if isinstance(args, tuple) and len(args) >= 2 and args[1] == schema:
            to_drop.append(key)
    for key in to_drop:
        info_cache.pop(key, None)


# pylint: disable=too-many-locals,protected-access
def get_schema_columns(self, connection, schema, **kw):
    """Get all columns in the schema.

    Returns ``None`` if Snowflake refuses the bulk information_schema query
    with errno 90030 ("Information schema query returned too much data") --
    callers (``get_columns`` below) treat that as a signal to fall back to
    per-table reflection.

    Caching: this function is NOT decorated with ``@reflection.cache``. The
    stock decorator would keep every schema's column dict in info_cache for
    the entire database run (info_cache is only cleared between databases
    in common_db_source.py:171), and a single pathologically wide schema
    can be ~1.6 GB. Instead we keep a bounded LRU of size
    SCHEMA_COLUMNS_CACHE_SIZE under a private key on info_cache, which is
    already per-thread via _inspector_map. When we evict a schema from the
    LRU we also drop the per-table ``get_columns`` entries for it so the
    column data is actually freed (otherwise it stays pinned via per-table
    cache references).
    """
    info_cache = kw.get("info_cache")
    if info_cache is not None:
        lru: OrderedDict = info_cache.setdefault(_SCHEMA_COLUMNS_LRU_KEY, OrderedDict())
        if schema in lru:
            lru.move_to_end(schema)
            return lru[schema]

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
            # Too many tables in the schema for the bulk query; signal the
            # per-table fallback in get_columns by returning None. Cache the
            # None so subsequent tables in the same schema don't re-run the
            # bulk query just to hit 90030 again.
            _store_schema_columns_in_lru(info_cache, schema, None)
            return None
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
        ordinal_position,
    ) in result:
        try:
            table_name = self.normalize_name(fqn.quote_name(table_name))  # noqa: PLW2901
        except ValueError:
            logger.warning(
                "Skipping column row in schema %s with unsupported table name %r",
                schema,
                table_name,
            )
            continue
        column_name = self.normalize_name(column_name)  # noqa: PLW2901
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
                "ordinal_position": ordinal_position,
            }
        )
        if is_identity == "YES":
            ans[table_name][-1]["identity"] = {
                "start": identity_start,
                "increment": identity_increment,
            }

    _store_schema_columns_in_lru(info_cache, schema, ans)
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
    table_name = f'"{schema}"."{table_name}"' if schema else f'"{table_name}"'
    cursor = connection.execute(SNOWFLAKE_GET_TABLE_DDL.format(table_name=table_name))
    try:
        result = cursor.fetchone()
        if result:
            return result[0]
    except Exception:
        pass
    return None
