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
"""Batched comment loading for the Vertica source (issue #29429).

Column comments used to be resolved with a comments join per table, which
dominates Vertica ingestion time. The source now fetches the table and column
comments of a bounded batch of tables with one query, processes those tables,
and releases the batch before loading the next one.

The comment query runs for real against SQLite, with ``v_catalog`` attached as a
schema, so the SQL itself is exercised. Only the inspector and the workflow
context, which the source receives from outside, are stood in for.
"""

from unittest.mock import Mock, PropertyMock, patch

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.pool import StaticPool
from sqlalchemy_vertica.dialect_vertica_python import VerticaDialect

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.vertica import metadata as vertica_metadata
from metadata.ingestion.source.database.vertica.comment_batch import batched, fetch_comment_batch
from metadata.ingestion.source.database.vertica.metadata import VerticaSource, get_columns

COMMENTS = [
    ("TABLE", "public", "orders", None, "All orders"),
    ("COLUMN", "public", "orders", "id", "Order id"),
    ("COLUMN", "public", "orders", "total", "Order total"),
    ("COLUMN", "public", "customers", "name", "Customer name"),
    ("TABLE", "public", "refunds", None, "Refunds"),
    ("COLUMN", "public", "refunds", "amount", "Refunded amount"),
    ("COLUMN", "other", "orders", "id", "Order id in another schema"),
    ("SCHEMA", "public", "public", None, "Not a table comment"),
]


@pytest.fixture
def catalog():
    """A SQLite connection exposing v_catalog.comments, recording every statement."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    statements = []
    event.listen(engine, "before_cursor_execute", lambda *args: statements.append(args[2]))
    with engine.connect() as connection:
        connection.execute(text("ATTACH DATABASE ':memory:' AS v_catalog"))
        connection.execute(
            text(
                "CREATE TABLE v_catalog.comments "
                "(object_type TEXT, object_schema TEXT, object_name TEXT, child_object TEXT, comment TEXT)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO v_catalog.comments VALUES "
                "(:object_type, :object_schema, :object_name, :child_object, :comment)"
            ),
            [
                dict(zip(("object_type", "object_schema", "object_name", "child_object", "comment"), row, strict=True))
                for row in COMMENTS
            ],
        )
        statements.clear()
        connection.statements = statements
        yield connection


def _comment_queries(connection):
    return [statement for statement in connection.statements if "FROM v_catalog.comments" in statement]


def _inspector(columns_by_table, supports_column_comments=True):
    dialect = VerticaDialect()
    dialect._column_comment_support = supports_column_comments  # pylint: disable=protected-access
    inspector = Mock()
    inspector.dialect = dialect
    inspector.get_columns.side_effect = lambda table_name, *_args, **_kwargs: [
        {"name": name, "comment": ""} for name in columns_by_table[table_name]
    ]
    inspector.get_table_comment.return_value = {"text": "from the per-table path"}
    return inspector


@pytest.fixture
def source(catalog):
    """A VerticaSource reflecting schema ``public`` on the current thread."""
    vertica_source = object.__new__(VerticaSource)
    vertica_source._comment_batches = {}  # pylint: disable=protected-access
    vertica_source.context = Mock()
    vertica_source.context.get.return_value.database_schema = "public"
    vertica_source.context.get_current_thread_id.return_value = 1
    with patch.object(CommonDbSourceService, "connection", new_callable=PropertyMock, return_value=catalog):
        yield vertica_source


def _listed_tables(*tables):
    return patch.object(CommonDbSourceService, "get_tables_name_and_type", return_value=list(tables))


def _with_inspector(inspector):
    return patch.object(CommonDbSourceService, "inspector", new_callable=PropertyMock, return_value=inspector)


def _process(source, inspector, table_name, table_type):
    """What the table stage does with each yielded table."""
    columns = source._get_columns_internal(  # pylint: disable=protected-access
        "public", table_name, "db", inspector, table_type
    )
    description = source.get_table_description("public", table_name, inspector)
    return description, {column["name"]: column["comment"] for column in columns}


class TestBatched:
    def test_splits_into_bounded_batches_preserving_order(self):
        assert list(batched(range(5), 2)) == [[0, 1], [2, 3], [4]]

    def test_yields_nothing_for_no_items(self):
        assert not list(batched([], 2))


class TestFetchCommentBatch:
    def test_reads_only_the_requested_tables_of_the_schema(self, catalog):
        batch = fetch_comment_batch(catalog, "public", ["orders", "customers"])

        assert batch.table_comments == {"orders": "All orders"}
        assert batch.column_comments == {
            ("orders", "id"): "Order id",
            ("orders", "total"): "Order total",
            ("customers", "name"): "Customer name",
        }
        assert len(_comment_queries(catalog)) == 1

    def test_matches_the_schema_case_insensitively(self, catalog):
        batch = fetch_comment_batch(catalog, "PUBLIC", ["refunds"])

        assert batch.table_comment("refunds") == "Refunds"
        assert batch.column_comment("refunds", "amount") == "Refunded amount"

    def test_covers_only_its_own_schema_and_tables(self, catalog):
        batch = fetch_comment_batch(catalog, "public", ["orders"])

        assert batch.covers("public", "orders")
        assert not batch.covers("public", "refunds")
        assert not batch.covers("other", "orders")


class TestVerticaSourceCommentBatches:
    def test_one_comment_query_per_batch_and_comments_attached(self, source, catalog):
        inspector = _inspector({"orders": ["id", "total"], "customers": ["name"], "refunds": ["amount", "reason"]})
        processed = {}
        with (
            _listed_tables(
                ("orders", TableType.Regular), ("customers", TableType.Regular), ("refunds", TableType.Regular)
            ),
            _with_inspector(inspector),
            patch.object(vertica_metadata, "COMMENT_BATCH_SIZE", 2),
        ):
            for table_name, table_type in source.get_tables_name_and_type():
                processed[table_name] = _process(source, inspector, table_name, table_type)

        assert processed == {
            "orders": ("All orders", {"id": "Order id", "total": "Order total"}),
            "customers": (None, {"name": "Customer name"}),
            "refunds": ("Refunds", {"amount": "Refunded amount", "reason": None}),
        }
        # Three tables in batches of two: two comment queries instead of three joins.
        assert len(_comment_queries(catalog)) == 2
        # Columns are read without the per-table comments join.
        assert all(call.kwargs["include_comments"] is False for call in inspector.get_columns.call_args_list)
        inspector.get_table_comment.assert_not_called()

    def test_previous_batch_is_released_before_the_next_and_at_the_end(self, source):
        inspector = _inspector({"orders": ["id"], "customers": ["name"], "refunds": ["amount"]})
        resident_batches = []
        with (
            _listed_tables(
                ("orders", TableType.Regular), ("customers", TableType.Regular), ("refunds", TableType.Regular)
            ),
            _with_inspector(inspector),
            patch.object(vertica_metadata, "COMMENT_BATCH_SIZE", 2),
        ):
            for table_name, _ in source.get_tables_name_and_type():
                resident_batches.append((table_name, sorted(source._comment_batches[1].table_names)))  # pylint: disable=protected-access

        assert resident_batches == [
            ("orders", ["customers", "orders"]),
            ("customers", ["customers", "orders"]),
            ("refunds", ["refunds"]),
        ]
        assert not source._comment_batches  # pylint: disable=protected-access

    def test_view_columns_without_comment_keep_the_empty_string(self, source):
        inspector = _inspector({"orders_view": ["id"]})
        with _listed_tables(("orders_view", TableType.View)), _with_inspector(inspector):
            processed = [_process(source, inspector, name, kind) for name, kind in source.get_tables_name_and_type()]

        # The comments join yielded '' for view columns; keeping it avoids reporting
        # every unchanged view as modified.
        assert processed == [(None, {"id": ""})]

    def test_workers_hold_separate_batches(self, source, catalog):
        inspector = _inspector({"orders": ["id"]})
        with _listed_tables(("orders", TableType.Regular)), _with_inspector(inspector):
            source.context.get_current_thread_id.return_value = 1
            first_worker = source.get_tables_name_and_type()
            next(first_worker)
            source.context.get.return_value.database_schema = "other"
            source.context.get_current_thread_id.return_value = 2
            second_worker = source.get_tables_name_and_type()
            next(second_worker)

            assert set(source._comment_batches) == {1, 2}  # pylint: disable=protected-access
            assert source._comment_batches[1].column_comment("orders", "id") == "Order id"  # pylint: disable=protected-access
            assert source._comment_batches[2].column_comment("orders", "id") == "Order id in another schema"  # pylint: disable=protected-access
            assert len(_comment_queries(catalog)) == 2


class TestVerticaSourceFallsBackTableByTable:
    def test_server_without_column_comments_skips_the_batch(self, source, catalog):
        inspector = _inspector({"orders": ["id"]}, supports_column_comments=False)
        with _listed_tables(("orders", TableType.Regular)), _with_inspector(inspector):
            processed = [_process(source, inspector, name, kind) for name, kind in source.get_tables_name_and_type()]

        assert not _comment_queries(catalog)
        assert processed == [("from the per-table path", {"id": ""})]
        assert "include_comments" not in inspector.get_columns.call_args.kwargs

    def test_failed_comment_query_falls_back_without_stopping_ingestion(self, source, catalog):
        catalog.execute(text("DROP TABLE v_catalog.comments"))
        inspector = _inspector({"orders": ["id"]})
        with _listed_tables(("orders", TableType.Regular)), _with_inspector(inspector):
            processed = [_process(source, inspector, name, kind) for name, kind in source.get_tables_name_and_type()]

        assert processed == [("from the per-table path", {"id": ""})]
        assert "include_comments" not in inspector.get_columns.call_args.kwargs


class TestGetColumnsWithoutComments:
    def test_skips_the_comments_join_even_when_the_server_supports_it(self):
        connection = Mock()
        connection.execute.return_value = []
        dialect = VerticaDialect()
        dialect._column_comment_support = True  # pylint: disable=protected-access

        list(get_columns(dialect, connection, "orders", schema="public", include_comments=False))

        executed = [str(call.args[0]) for call in connection.execute.call_args_list]
        columns_statement = next(statement for statement in executed if "v_catalog.columns" in statement)
        assert "v_catalog.comments" not in columns_statement
