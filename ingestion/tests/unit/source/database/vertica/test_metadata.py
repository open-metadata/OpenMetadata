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
Unit tests for the Vertica connector metadata reflection (issue #29429).

These cover the column-comment bulk-caching that replaces the old per-table
``LEFT JOIN v_catalog.comments`` (the dominant ingestion cost), verifying that:

* column comments are resolved from a single bulk query instead of a per-table
  join,
* the bulk comment query runs only once and is reused across tables,
* ``VERTICA_GET_COLUMNS`` no longer joins ``v_catalog.comments``,
* the cache is invalidated when the database changes, and
* ``VerticaDialect`` enables SQLAlchemy statement caching.
"""

import threading
import time
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

# The dialect lives in the optional ``vertica`` plugin; skip cleanly when absent.
pytest.importorskip("sqlalchemy_vertica")

from sqlalchemy_vertica.base import VerticaDialect  # noqa: E402

# Importing the module applies the OpenMetadata monkeypatches onto VerticaDialect
# (get_columns, get_all_column_comments, supports_statement_cache, ...).
import metadata.ingestion.source.database.vertica.metadata  # noqa: E402,F401
from metadata.ingestion.source.database.vertica.queries import (  # noqa: E402
    VERTICA_COLUMN_COMMENTS,
)
from metadata.utils.sqlalchemy_utils import (  # noqa: E402
    get_all_column_comments,
    get_column_comment_wrapper,
)


def _column_row(name, data_type="varchar", default=None, nullable=True, schema="public"):
    """Row shape returned by VERTICA_GET_COLUMNS (attribute access)."""
    return SimpleNamespace(
        column_name=name,
        data_type=data_type,
        column_default=default,
        is_nullable=nullable,
        table_schema=schema,
    )


def _comment_row(schema, table, column, comment):
    """Row shape returned by VERTICA_COLUMN_COMMENTS (``._mapping`` access)."""
    return SimpleNamespace(
        _mapping={
            "schema": schema,
            "table_name": table,
            "column_name": column,
            "column_comment": comment,
        }
    )


def _make_connection(columns_by_table, comment_rows, database="testdb"):
    """
    Build a mock connection that routes queries by their SQL text:
    the comment bulk query -> comment_rows, the per-table columns query ->
    the rows registered for that table name.
    """
    connection = MagicMock()
    connection.engine.url.database = database

    def _execute(query, *_args, **_kwargs):
        text = str(query)
        if "v_catalog.comments" in text:
            return iter(list(comment_rows))
        for table, rows in columns_by_table.items():
            if f"'{table}'" in text:
                return iter(list(rows))
        return iter([])

    connection.execute.side_effect = _execute
    return connection


def _new_dialect():
    # Bypass __init__ side effects; class attributes (ischema_names and the
    # monkeypatched methods) are all we need for reflection.
    return object.__new__(VerticaDialect)


def _comment_query_count(connection):
    return sum(
        1
        for call in connection.execute.call_args_list
        if "v_catalog.comments" in str(call.args[0])
    )


def test_get_columns_resolves_comments_from_bulk_cache():
    dialect = _new_dialect()
    connection = _make_connection(
        columns_by_table={"t1": [_column_row("c1"), _column_row("c2")]},
        comment_rows=[_comment_row("public", "t1", "c1", "c1 comment")],
    )

    columns = list(dialect.get_columns(connection, "t1", schema="public"))
    comment_by_name = {c["name"]: c["comment"] for c in columns}

    assert comment_by_name["c1"] == "c1 comment"
    # A column without a comment resolves to None, not an empty-string artifact
    # from the old outer join.
    assert comment_by_name["c2"] is None
    # Two columns, but the (slow) comment catalog is queried only once.
    assert _comment_query_count(connection) == 1


def test_bulk_comment_query_runs_once_across_tables():
    dialect = _new_dialect()
    connection = _make_connection(
        columns_by_table={
            "t1": [_column_row("c1")],
            "t2": [_column_row("cx")],
        },
        comment_rows=[
            _comment_row("public", "t1", "c1", "c1 comment"),
            _comment_row("public", "t2", "cx", "cx comment"),
        ],
    )

    t1 = {c["name"]: c["comment"] for c in dialect.get_columns(connection, "t1", schema="public")}
    t2 = {c["name"]: c["comment"] for c in dialect.get_columns(connection, "t2", schema="public")}

    assert t1["c1"] == "c1 comment"
    assert t2["cx"] == "cx comment"
    # The whole point of the fix: the second table reuses the cache, so the
    # comment catalog is still queried only once in total.
    assert _comment_query_count(connection) == 1


def test_comment_lookup_is_case_insensitive():
    # v_catalog.comments returns catalog-original case, while get_columns is
    # reflected with mixed-case schema/table arguments. Keys are normalized to
    # lowercase on both sides so the comment is not silently dropped.
    dialect = _new_dialect()
    connection = _make_connection(
        columns_by_table={"t1": [_column_row("MyCol", schema="Public")]},
        comment_rows=[_comment_row("public", "t1", "mycol", "case-folded comment")],
    )

    columns = list(dialect.get_columns(connection, "T1", schema="Public"))
    comment_by_name = {c["name"]: c["comment"] for c in columns}

    assert comment_by_name["MyCol"] == "case-folded comment"


def test_get_columns_resolves_comments_when_schema_is_none():
    # When reflected with schema=None, VERTICA_GET_COLUMNS spans every schema, so
    # the comment key must be taken from each row's own table_schema rather than
    # the (missing) argument, otherwise comments are silently dropped.
    dialect = _new_dialect()
    connection = _make_connection(
        columns_by_table={"t1": [_column_row("c1", schema="realschema")]},
        comment_rows=[_comment_row("realschema", "t1", "c1", "the comment")],
    )

    columns = list(dialect.get_columns(connection, "t1", schema=None))
    comment_by_name = {c["name"]: c["comment"] for c in columns}

    assert comment_by_name["c1"] == "the comment"


def test_bulk_population_is_atomic():
    # The dialect is shared across the worker threads that reflect schemas in
    # parallel, so the cache must be published in a single assignment: a reader
    # must never observe a half-built dict. We assert the dialect does not expose
    # the new dict until every row has been consumed.
    dialect = _new_dialect()
    observed = []

    def rows():
        # Produced lazily as the loop iterates. At this point the cache must still
        # be built in a local variable, not yet assigned onto the dialect.
        observed.append(getattr(dialect, "all_column_comments", None))
        yield _comment_row("public", "t1", "c1", "c1 comment")
        yield _comment_row("public", "t1", "c2", "c2 comment")

    connection = MagicMock()
    connection.engine.url.database = "db"
    connection.execute.return_value = rows()

    get_all_column_comments(dialect, connection, VERTICA_COLUMN_COMMENTS)

    # Nothing was published while rows were still being read (atomic publish).
    assert observed == [None]
    assert dialect.all_column_comments[("public", "t1", "c1")] == "c1 comment"
    assert dialect.all_column_comments[("public", "t1", "c2")] == "c2 comment"


def test_first_load_runs_bulk_query_once_under_concurrency():
    # The dialect is shared across worker threads reflecting schemas in parallel.
    # On the first load they all see an empty cache; double-checked locking must
    # ensure only one thread runs the expensive bulk query while the rest wait and
    # reuse the published result.
    dialect = _new_dialect()
    comment_query_calls = []
    start = threading.Barrier(5)

    def _execute(query, *_args, **_kwargs):
        if "v_catalog.comments" in str(query):
            comment_query_calls.append(1)
            time.sleep(0.05)  # widen the load window so all threads race the load
            return iter([_comment_row("public", "t1", "c1", "c1 comment")])
        return iter([])

    connection = MagicMock()
    connection.engine.url.database = "db"
    connection.execute.side_effect = _execute

    results = []

    def worker():
        start.wait()
        results.append(
            get_column_comment_wrapper(
                dialect,
                connection,
                VERTICA_COLUMN_COMMENTS,
                table_name="t1",
                column_name="c1",
                schema="public",
            )
        )

    threads = [threading.Thread(target=worker) for _ in range(5)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert all(result == "c1 comment" for result in results)
    # Five racing threads, but the costly comment catalog is queried exactly once.
    assert len(comment_query_calls) == 1


def test_get_columns_query_does_not_join_comments():
    dialect = _new_dialect()
    connection = _make_connection(
        columns_by_table={"t1": [_column_row("c1")]},
        comment_rows=[],
    )

    list(dialect.get_columns(connection, "t1", schema="public"))

    columns_queries = [
        str(call.args[0])
        for call in connection.execute.call_args_list
        if "v_catalog.columns" in str(call.args[0])
    ]
    assert columns_queries, "expected a v_catalog.columns query"
    for query in columns_queries:
        assert "v_catalog.comments" not in query
        assert "comment" not in query.lower()


def test_column_comment_cache_is_invalidated_on_db_switch():
    dialect = SimpleNamespace()
    # Bind the bulk loader so the wrapper can call self.get_all_column_comments.
    dialect.get_all_column_comments = get_all_column_comments.__get__(dialect)

    conn_a = MagicMock()
    conn_a.engine.url.database = "db_a"
    conn_a.execute.return_value = iter([_comment_row("public", "t", "c", "from A")])

    first = get_column_comment_wrapper(
        dialect, conn_a, VERTICA_COLUMN_COMMENTS, table_name="t", column_name="c", schema="public"
    )
    second = get_column_comment_wrapper(
        dialect, conn_a, VERTICA_COLUMN_COMMENTS, table_name="t", column_name="c", schema="public"
    )
    assert first == second == "from A"
    # Same DB -> cache reused, loaded only once.
    assert conn_a.execute.call_count == 1

    conn_b = MagicMock()
    conn_b.engine.url.database = "db_b"
    conn_b.execute.return_value = iter([_comment_row("public", "t", "c", "from B")])

    switched = get_column_comment_wrapper(
        dialect, conn_b, VERTICA_COLUMN_COMMENTS, table_name="t", column_name="c", schema="public"
    )
    # Different DB -> cache invalidated and reloaded from the new connection.
    assert switched == "from B"
    assert conn_b.execute.call_count == 1


def test_vertica_dialect_enables_statement_cache():
    assert VerticaDialect.supports_statement_cache is True
