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

# pylint: disable=protected-access
"""
Module for sqlalchemy dialect utils
"""

import threading
import traceback
from typing import Dict, Optional, Tuple  # noqa: UP035

from sqlalchemy import text
from sqlalchemy.engine import Engine, reflection
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.schema import CreateTable, MetaData

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Serializes the first (expensive) bulk load of the column-comment cache. The
# dialect is shared across the worker threads that reflect schemas in parallel, so
# without this several threads would each run the costly VERTICA_COLUMN_COMMENTS
# query before any of them publishes the result. A single module-level lock is
# enough: it is only taken on the rare first load / database switch (steady-state
# lookups never touch it), so gating it across dialect instances is negligible and
# avoids the race of lazily creating a per-instance lock.
_column_comment_load_lock = threading.Lock()


@reflection.cache
def get_all_table_comments(self, connection, query):
    """
    Method to fetch comment of all available tables
    """
    self.all_table_comments: Dict[Tuple[str, str], str] = {}  # noqa: UP006
    self.current_db: str = connection.engine.url.database
    result = connection.execute(text(query) if isinstance(query, str) else query)
    for table in result:
        table_dict = {k.lower(): v for k, v in dict(table._mapping).items()}
        self.all_table_comments[(table_dict["table_name"], table_dict["schema"])] = table_dict["table_comment"]


def get_table_comment_wrapper(self, connection, query, table_name, schema=None):
    if not hasattr(self, "all_table_comments") or self.current_db != connection.engine.url.database:
        self.get_all_table_comments(connection, query)
    return {"text": self.all_table_comments.get((table_name, schema))}


@reflection.cache
def get_all_column_comments(self, connection, query):
    """
    Method to fetch comments of all columns in a single query.

    Column comments live in a sparse catalog table (only commented columns have a
    row), so bulk-loading them once and caching by (schema, table, column) avoids a
    per-table catalog join while keeping the memory footprint bounded by the number
    of commented columns.

    Scope and bound: this is a complete per-database lookup table, not a
    demand-filled cache -- ``get_columns`` runs for every table and must be able to
    resolve any commented column, so the whole result set stays resident for that
    database's reflection. It is bounded by lifetime rather than by eviction: the
    dict is rebuilt and replaced wholesale when the database changes (see the
    ``current_db`` check in ``get_column_comment_wrapper``), so nothing accumulates
    across databases. Size eviction is deliberately not used, as dropping an entry
    would silently omit a column comment that exists in the catalog.

    Keys are lower-cased on both storage and lookup: the bulk query returns the
    catalog-original case from ``v_catalog.comments`` while the reflection wrapper
    is called with the un-normalized ``schema``/``table_name`` arguments, so
    mixed-case identifiers would otherwise miss the cache and silently drop
    comments that actually exist.

    The dialect is shared across the worker threads that reflect schemas in
    parallel, so the fully-built dict is published in a single assignment: a
    concurrent reader sees either the previous cache or the complete new one,
    never a half-populated dict. ``current_db`` is assigned last so the wrapper's
    freshness check only passes once the data is in place.
    """
    all_column_comments: Dict[Tuple[str, str, str], str] = {}  # noqa: UP006
    current_db = connection.engine.url.database
    result = connection.execute(text(query) if isinstance(query, str) else query)
    for row in result:
        row_dict = {k.lower(): v for k, v in dict(row._mapping).items()}
        all_column_comments[
            (
                (row_dict["schema"] or "").lower(),
                (row_dict["table_name"] or "").lower(),
                (row_dict["column_name"] or "").lower(),
            )
        ] = row_dict["column_comment"]
    # Atomic publish (see docstring): data first, freshness flag last.
    self.all_column_comments = all_column_comments
    self.current_db = current_db


def get_column_comment_wrapper(self, connection, query, table_name, column_name, schema=None):
    # Snapshot the shared attributes once. getattr avoids racing with the atomic
    # publish in get_all_column_comments (all_column_comments is assigned before
    # current_db, so a reader in that window harmlessly sees an unset current_db).
    database = connection.engine.url.database
    cache = getattr(self, "all_column_comments", None)
    if cache is None or getattr(self, "current_db", None) != database:
        # Double-checked locking: only the first racing thread runs the expensive
        # bulk query; the rest wait, then re-check and reuse the published cache.
        # Steady-state lookups skip the lock entirely (fast path above).
        with _column_comment_load_lock:
            cache = getattr(self, "all_column_comments", None)
            if cache is None or getattr(self, "current_db", None) != database:
                self.get_all_column_comments(connection, query)
            cache = self.all_column_comments
    key = (
        (schema or "").lower(),
        (table_name or "").lower(),
        (column_name or "").lower(),
    )
    return cache.get(key)


@reflection.cache
def get_all_table_owners(self, connection, query, schema_name, **kw):  # pylint: disable=unused-argument
    """
    Method to fetch owners of all available tables
    """
    self.all_table_owners: Dict[Tuple[str, str], str] = {}  # noqa: UP006
    result = connection.execute(text(query) if isinstance(query, str) else query)
    for table in result:
        self.all_table_owners[(table[0], table[1])] = table[2]


def get_table_owner_wrapper(self, connection, query, table_name, schema=None, **kw):  # pylint: disable=unused-argument
    if not hasattr(self, "all_table_owners"):
        self.get_all_table_owners(connection, query, schema)
    return self.all_table_owners.get((schema, table_name), "")


@reflection.cache
def get_all_view_definitions(self, connection, query):
    """
    Method to fetch view definition of all available views
    """
    self.all_view_definitions: Dict[Tuple[str, str], str] = {}  # noqa: UP006
    self.current_db: str = connection.engine.url.database  # type: ignore
    result = connection.execute(text(query) if isinstance(query, str) else query)
    for view in result:
        if hasattr(view, "view_def") and hasattr(view, "schema"):
            self.all_view_definitions[(view.view_name, view.schema)] = view.view_def
        elif hasattr(view, "VIEW_DEF") and hasattr(view, "SCHEMA"):
            self.all_view_definitions[(view.VIEW_NAME, view.SCHEMA)] = view.VIEW_DEF


def get_view_definition_wrapper(self, connection, query, table_name, schema=None):
    if not hasattr(self, "all_view_definitions") or self.current_db != connection.engine.url.database:
        self.get_all_view_definitions(connection, query)
    return self.all_view_definitions.get((table_name, schema), "")


def get_schema_descriptions(engine: Engine, query: str):
    with engine.connect() as conn:
        results = conn.execute(text(query)).all()
    schema_desc_map = {}
    for row in results:
        schema_desc_map[row.schema_name] = row.comment
    return schema_desc_map


def is_complex_type(col_type: str):
    return (
        col_type.lower().startswith("array")
        or col_type.lower().startswith("map")
        or col_type.lower().startswith("struct")
        or col_type.lower().startswith("row")
    )


def get_display_datatype(
    col_type: str,
    char_len: Optional[int],  # noqa: UP045
    precision: Optional[int],  # noqa: UP045
    scale: Optional[int],  # noqa: UP045
):
    if char_len or (precision is not None and scale is None):
        length = char_len or scale
        return f"{col_type}({str(length)})"  # noqa: RUF010
    if scale is not None and precision is not None:
        return f"{col_type}({str(precision)},{str(scale)})"  # noqa: RUF010
    return col_type


def convert_numpy_to_list(data):
    """
    Recursively converts numpy arrays to lists in a nested data structure.
    """
    import numpy as np  # pylint: disable=import-outside-toplevel

    if isinstance(data, np.ndarray):
        return data.tolist()
    if isinstance(data, list):
        return [convert_numpy_to_list(item) for item in data]
    if isinstance(data, dict):
        return {key: convert_numpy_to_list(value) for key, value in data.items()}
    return data


@reflection.cache
def get_all_table_ddls(self, connection, query, schema_name, **kw):  # pylint: disable=unused-argument
    """
    Method to fetch ddl of all available tables
    """
    try:
        self.all_table_ddls: Dict[Tuple[str, str], str] = {}  # noqa: UP006
        self.current_db: str = schema_name
        meta = MetaData()
        meta.reflect(bind=connection, schema=schema_name)
        for table in meta.sorted_tables or []:
            self.all_table_ddls[(table.schema, table.name)] = str(CreateTable(table))
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.debug(f"Failed to get table ddls for {schema_name}: {exc}")
        # Roll back the aborted transaction so the connection remains usable
        # for subsequent queries (e.g. get_table_comment). Without this,
        # psycopg2 raises InFailedSqlTransaction on every query that follows.
        if isinstance(exc, ProgrammingError):
            try:  # noqa: SIM105
                connection.rollback()
            except Exception:
                pass
        try:  # noqa: SIM105
            connection.rollback()
        except Exception:
            pass


def get_table_ddl_wrapper(self, connection, query, table_name, schema=None, **kw):  # pylint: disable=unused-argument
    if not hasattr(self, "all_table_ddls") or self.current_db != schema:
        self.get_all_table_ddls(connection, query, schema)
    return self.all_table_ddls.get((schema, table_name))


def get_table_ddl(self, connection, table_name, schema=None, **kw):  # pylint: disable=unused-argument
    return get_table_ddl_wrapper(
        self,
        connection=connection,
        query=None,
        table_name=table_name,
        schema=schema,
    )


@reflection.cache
def get_schema_comment_results(self, connection, query, database, schema=None):
    """
    Method to fetch comment of all available schemas
    """
    self.schema_comment_result: Dict[str, str] = {}  # noqa: UP006
    self.current_db: str = database
    result = connection.execute(text(query) if isinstance(query, str) else query).fetchall()
    self.schema_comment_result[schema] = result


@reflection.cache
def get_table_comment_results(self, connection, query, database, table_name, schema=None):
    """
    Method to fetch comment of all available tables
    """
    self.table_comment_result: Dict[Tuple[str, str], str] = {}  # noqa: UP006
    self.current_db: str = database
    result = connection.execute(text(query) if isinstance(query, str) else query).fetchall()
    self.table_comment_result[(table_name, schema)] = result


def get_table_comment_result_wrapper(self, connection, query, database, table_name, schema=None):
    if (
        not hasattr(self, "table_comment_result")
        or self.table_comment_result.get((table_name, schema)) is None
        or self.current_db != database
    ):
        self.get_table_comment_results(connection, query, database, table_name, schema)
    return self.table_comment_result.get((table_name, schema))


def get_schema_comment_result_wrapper(self, connection, query, database, schema=None):
    if (
        not hasattr(self, "schema_comment_result")
        or self.schema_comment_result.get((schema)) is None  # noqa: UP034
        or self.current_db != database
    ):
        self.get_schema_comment_results(connection, query, database, schema)
    return self.schema_comment_result.get((schema))  # noqa: UP034
