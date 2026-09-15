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

These cover the schema-scoped column-comment cache that replaces the old
per-table ``LEFT JOIN v_catalog.comments`` (the dominant ingestion cost),
verifying that:

* a normal schema costs exactly one bulk comment query, reused across tables,
* the previous schema is released when a worker moves to another schema,
* a schema above ``MAX_SCHEMA_COMMENTS`` falls back to the per-table join
  without losing any comment,
* concurrent workers stay independent through their own ``info_cache``,
* ``VERTICA_GET_COLUMNS`` no longer joins ``v_catalog.comments``, and
* ``VerticaDialect`` enables SQLAlchemy statement caching.
"""

import threading
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

# The dialect lives in the optional ``vertica`` plugin; skip cleanly when absent.
pytest.importorskip("sqlalchemy_vertica")

from sqlalchemy_vertica.base import VerticaDialect

# Importing the module applies the OpenMetadata monkeypatches onto VerticaDialect
# (get_columns, supports_statement_cache, ...).
import metadata.ingestion.source.database.vertica.metadata  # noqa: F401
from metadata.ingestion.source.database.vertica.queries import (
    VERTICA_SCHEMA_COLUMN_COMMENTS,
)
from metadata.utils.sqlalchemy_utils import (
    MAX_SCHEMA_COMMENTS,
    SCHEMA_COLUMN_COMMENTS_CACHE_KEY,
    get_schema_column_comments,
)


def _column_row(name, data_type="varchar", default=None, nullable=True, comment=None):
    """Row shape returned by the VERTICA_GET_COLUMNS family (attribute access)."""
    return SimpleNamespace(
        column_name=name,
        data_type=data_type,
        column_default=default,
        is_nullable=nullable,
        comment=comment,
    )


def _comment_row(table, column, comment):
    """Row shape returned by VERTICA_SCHEMA_COLUMN_COMMENTS (``._mapping`` access)."""
    return SimpleNamespace(
        _mapping={
            "table_name": table,
            "column_name": column,
            "column_comment": comment,
        }
    )


def _is_comment_query(statement):
    # The bulk comment query is the only one selecting ``column_comment``; the
    # per-table fallback also touches v_catalog.comments, so match on the alias.
    return "column_comment" in str(statement)


def _make_connection(columns_by_table, comments_by_schema, database="testdb"):
    """
    Mock connection routing by SQL text: the bulk comment query resolves against
    ``comments_by_schema`` using the bound ``:schema``, and the per-table columns
    query resolves against the rows registered for that table name.
    """
    connection = MagicMock()
    connection.engine.url.database = database

    def _execute(query, params=None, *_args, **_kwargs):
        statement = str(query)
        if _is_comment_query(statement):
            schema = (params or {}).get("schema")
            return iter(list(comments_by_schema.get(schema, [])))
        for table, rows in columns_by_table.items():
            if f"'{table}'" in statement:
                return iter(list(rows))
        return iter([])

    connection.execute.side_effect = _execute
    return connection


def _new_dialect():
    # Bypass __init__ side effects; class attributes (ischema_names and the
    # monkeypatched methods) are all we need for reflection.
    return object.__new__(VerticaDialect)


def _comment_query_count(connection):
    return sum(1 for call in connection.execute.call_args_list if _is_comment_query(call.args[0]))


def _executed_columns_queries(connection):
    return [str(call.args[0]) for call in connection.execute.call_args_list if "v_catalog.columns" in str(call.args[0])]


def test_get_columns_resolves_comments_from_schema_cache():
    dialect = _new_dialect()
    connection = _make_connection(
        columns_by_table={"t1": [_column_row("c1"), _column_row("c2")]},
        comments_by_schema={"public": [_comment_row("t1", "c1", "c1 comment")]},
    )

    columns = list(dialect.get_columns(connection, "t1", schema="public", info_cache={}))
    comment_by_name = {c["name"]: c["comment"] for c in columns}

    assert comment_by_name["c1"] == "c1 comment"
    # A column without a comment resolves to None, not an empty-string artifact
    # from the old outer join.
    assert comment_by_name["c2"] is None
    # Two columns, but the (slow) comment catalog is queried only once.
    assert _comment_query_count(connection) == 1


def test_one_bulk_comment_query_per_schema():
    dialect = _new_dialect()
    info_cache = {}
    connection = _make_connection(
        columns_by_table={"t1": [_column_row("c1")], "t2": [_column_row("cx")]},
        comments_by_schema={
            "public": [
                _comment_row("t1", "c1", "c1 comment"),
                _comment_row("t2", "cx", "cx comment"),
            ]
        },
    )

    t1 = {
        c["name"]: c["comment"] for c in dialect.get_columns(connection, "t1", schema="public", info_cache=info_cache)
    }
    t2 = {
        c["name"]: c["comment"] for c in dialect.get_columns(connection, "t2", schema="public", info_cache=info_cache)
    }

    assert t1["c1"] == "c1 comment"
    assert t2["cx"] == "cx comment"
    # The whole point of the fix: the second table reuses the cache, so the
    # comment catalog is queried exactly once for the schema.
    assert _comment_query_count(connection) == 1


def test_previous_schema_is_released_when_worker_changes_schema():
    dialect = _new_dialect()
    info_cache = {}
    connection = _make_connection(
        columns_by_table={},
        comments_by_schema={
            "schema_a": [_comment_row("t", "c", "from A")],
            "schema_b": [_comment_row("t", "c", "from B")],
        },
    )

    first = get_schema_column_comments(dialect, connection, VERTICA_SCHEMA_COLUMN_COMMENTS, "schema_a", info_cache)
    assert first == {("t", "c"): "from A"}
    assert _comment_query_count(connection) == 1

    # Same schema again -> served from the cache, no extra query.
    get_schema_column_comments(dialect, connection, VERTICA_SCHEMA_COLUMN_COMMENTS, "schema_a", info_cache)
    assert _comment_query_count(connection) == 1

    # Moving to another schema replaces the entry rather than accumulating.
    second = get_schema_column_comments(dialect, connection, VERTICA_SCHEMA_COLUMN_COMMENTS, "schema_b", info_cache)
    assert second == {("t", "c"): "from B"}
    # Exactly one slot is kept, so schema_a's comments are no longer resident.
    assert info_cache[SCHEMA_COLUMN_COMMENTS_CACHE_KEY] == ("schema_b", {("t", "c"): "from B"})


def test_oversized_schema_returns_none_and_caches_the_verdict():
    dialect = _new_dialect()
    info_cache = {}
    connection = _make_connection(
        columns_by_table={},
        comments_by_schema={"big": [_comment_row("t", f"c{i}", f"comment {i}") for i in range(3)]},
    )

    result = get_schema_column_comments(
        dialect, connection, VERTICA_SCHEMA_COLUMN_COMMENTS, "big", info_cache, max_comments=2
    )

    # Over the limit -> the partial result is discarded so memory stays bounded.
    assert result is None
    assert info_cache[SCHEMA_COLUMN_COMMENTS_CACHE_KEY] == ("big", None)

    # The verdict is cached, so the probe runs once per schema, not once per table.
    repeated = get_schema_column_comments(
        dialect, connection, VERTICA_SCHEMA_COLUMN_COMMENTS, "big", info_cache, max_comments=2
    )
    assert repeated is None
    assert _comment_query_count(connection) == 1


def test_oversized_schema_falls_back_to_per_table_join_without_losing_comments():
    dialect = _new_dialect()
    oversized = [_comment_row(f"t{i}", "c", f"comment {i}") for i in range(MAX_SCHEMA_COMMENTS + 1)]
    connection = _make_connection(
        # The fallback resolves the comment from the join itself, not from the cache.
        columns_by_table={"t1": [_column_row("c1", comment="joined comment")]},
        comments_by_schema={"public": oversized},
    )

    columns = list(dialect.get_columns(connection, "t1", schema="public", info_cache={}))
    comment_by_name = {c["name"]: c["comment"] for c in columns}

    # No comment is lost: only the optimisation is skipped for this schema.
    assert comment_by_name["c1"] == "joined comment"
    columns_queries = _executed_columns_queries(connection)
    assert columns_queries, "expected a v_catalog.columns query"
    assert all("v_catalog.comments" in query for query in columns_queries)


def test_get_columns_without_schema_uses_the_join_fallback():
    # Reflected with schema=None there is no schema to scope the cache to, so the
    # per-table join resolves the comments instead of silently dropping them.
    dialect = _new_dialect()
    connection = _make_connection(
        columns_by_table={"t1": [_column_row("c1", comment="the comment")]},
        comments_by_schema={},
    )

    columns = list(dialect.get_columns(connection, "t1", schema=None, info_cache={}))
    comment_by_name = {c["name"]: c["comment"] for c in columns}

    assert comment_by_name["c1"] == "the comment"
    assert _comment_query_count(connection) == 0


def test_comment_lookup_is_case_insensitive():
    # v_catalog.comments returns catalog-original case, while get_columns is
    # reflected with mixed-case schema/table arguments. Keys are normalized to
    # lowercase on both sides so the comment is not silently dropped.
    dialect = _new_dialect()
    connection = _make_connection(
        columns_by_table={"t1": [_column_row("MyCol")]},
        comments_by_schema={"Public": [_comment_row("T1", "MYCOL", "case-folded comment")]},
    )

    columns = list(dialect.get_columns(connection, "T1", schema="Public", info_cache={}))
    comment_by_name = {c["name"]: c["comment"] for c in columns}

    assert comment_by_name["MyCol"] == "case-folded comment"


def test_concurrent_workers_use_separate_info_caches():
    # The dialect is shared across the worker threads that reflect schemas in
    # parallel, but each worker owns its info_cache. No shared state, no lock, and
    # no cross-worker thrashing: each worker loads its own schema exactly once.
    dialect = _new_dialect()
    schemas = ["schema_a", "schema_b", "schema_c", "schema_d"]
    connection = _make_connection(
        columns_by_table={},
        comments_by_schema={schema: [_comment_row("t", "c", f"from {schema}")] for schema in schemas},
    )

    start = threading.Barrier(len(schemas))
    lock = threading.Lock()
    results = {}

    def worker(schema):
        info_cache = {}
        start.wait()
        # Two lookups per worker: the second must be served from that worker's own
        # cache, so every worker still costs exactly one bulk query.
        for _ in range(2):
            comments = get_schema_column_comments(
                dialect, connection, VERTICA_SCHEMA_COLUMN_COMMENTS, schema, info_cache
            )
            with lock:
                results[schema] = comments

    threads = [threading.Thread(target=worker, args=(schema,)) for schema in schemas]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    # Every worker resolved its own schema, unaffected by the others.
    for schema in schemas:
        assert results[schema] == {("t", "c"): f"from {schema}"}
    # One bulk query per worker, not one per lookup.
    assert _comment_query_count(connection) == len(schemas)


def test_fast_path_query_does_not_join_comments():
    dialect = _new_dialect()
    connection = _make_connection(
        columns_by_table={"t1": [_column_row("c1")]},
        comments_by_schema={"public": []},
    )

    list(dialect.get_columns(connection, "t1", schema="public", info_cache={}))

    columns_queries = _executed_columns_queries(connection)
    assert columns_queries, "expected a v_catalog.columns query"
    for query in columns_queries:
        assert "v_catalog.comments" not in query
        assert "comment" not in query.lower()


def test_vertica_dialect_enables_statement_cache():
    assert VerticaDialect.supports_statement_cache is True
