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

import traceback
from typing import Dict, Optional, Tuple  # noqa: UP035

from sqlalchemy import text
from sqlalchemy.engine import Engine, reflection
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.schema import CreateTable, MetaData

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Upper bound on how many column comments are cached for a single schema. Schemas
# above it fall back to the per-table comments join, so no comment is ever lost --
# only the optimisation is skipped.
MAX_SCHEMA_COMMENTS = 1_000

# Slot in the Inspector's info_cache holding (schema, comments) for the one schema
# a worker is currently reflecting.
SCHEMA_COLUMN_COMMENTS_CACHE_KEY = "_om_schema_column_comments"


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


def get_schema_column_comments(  # pylint: disable=unused-argument
    self,
    connection,
    query,
    schema,
    info_cache,
    max_comments: int = MAX_SCHEMA_COMMENTS,
):
    """
    Bulk-fetch the column comments of a single schema, cached per reflection worker.

    Column comments live in a sparse catalog table (only commented columns have a
    row), so fetching a schema's comments once and looking them up in memory avoids
    the per-table catalog join that dominates ingestion time (issue #29429).

    Scope and bound. The cache holds exactly one schema -- the one the worker is
    currently reflecting -- and is replaced when the worker moves on, so schemas do
    not accumulate. The size is bounded explicitly: the query asks for at most
    ``max_comments + 1`` rows, and if the schema exceeds the limit the partial
    result is discarded and ``None`` is returned so the caller falls back to the
    per-table comments join. No comment is ever dropped -- only the optimisation is
    skipped, which is why size-based eviction is not used here.

    The cache lives in the ``Inspector.info_cache`` rather than on the dialect
    because the dialect is shared across the worker threads that reflect schemas in
    parallel, while each worker has its own ``info_cache``. That keeps workers
    independent: no shared state, no lock, and no cross-worker thrashing when two
    workers reflect different schemas at the same time.

    Keys are lower-cased on both storage and lookup: the query returns the
    catalog-original case from ``v_catalog.comments`` while reflection passes the
    un-normalized ``schema``/``table_name``, so mixed-case identifiers would
    otherwise miss the cache and silently drop comments that actually exist.

    :return: ``{(table_name, column_name): comment}`` for the schema, or ``None``
        when the caller should use the per-table comments join instead.
    """
    schema_key = (schema or "").lower()
    cached_schema, cached_comments = info_cache.get(SCHEMA_COLUMN_COMMENTS_CACHE_KEY, (None, None))
    if cached_schema == schema_key:
        return cached_comments

    # max_comments + 1 is a sentinel: reading one row beyond the limit is what tells
    # us the schema is oversized, without materialising all of it.
    rows = list(
        connection.execute(
            text(query) if isinstance(query, str) else query,
            {"schema": schema, "limit": max_comments + 1},
        )
    )

    comments: Optional[Dict[Tuple[str, str], str]] = None  # noqa: UP006, UP045
    if len(rows) <= max_comments:
        comments = {}
        for row in rows:
            row_dict = {k.lower(): v for k, v in dict(row._mapping).items()}
            key = (
                (row_dict["table_name"] or "").lower(),
                (row_dict["column_name"] or "").lower(),
            )
            comments[key] = row_dict["column_comment"]
    else:
        logger.debug(
            f"Schema {schema} has more than {max_comments} column comments; "
            "falling back to the per-table comments join for it."
        )

    # Replace the previous schema instead of accumulating schemas. The oversized
    # verdict is cached too, so the probe runs once per schema rather than per table.
    info_cache[SCHEMA_COLUMN_COMMENTS_CACHE_KEY] = (schema_key, comments)
    return comments


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
    import numpy as np  # pylint: disable=import-outside-toplevel  # noqa: PLC0415

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
