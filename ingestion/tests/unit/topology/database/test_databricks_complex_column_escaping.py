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

"""Escaping tests for the legacy Databricks complex-column DESCRIBE.

The legacy text-DESCRIBE path (Databricks Runtime < 16.2, selected when
``DESCRIBE TABLE EXTENDED ... AS JSON`` is unavailable) issues a per-column
``DESCRIBE TABLE <catalog>.<schema>.<table> <column>`` to recover the full
type string of ``array``/``struct``/``map`` columns. Until this fix that query
was a raw f-string — the only *executed* SQL in ``metadata.py`` that bypassed
the module's ``_quote_identifier`` / ``_format_identifier_query`` helpers
(added by the 09c6491 SQL-injection hardening pass).

A backtick in the catalog, schema, table or column name closed the quoting
early, the malformed SQL raised a ``DatabaseError`` that was caught and only
logged, and because ``col_info["is_complex"]`` was never reached the column was
emitted as a childless ``STRUCT``/``ARRAY``/``MAP`` — correct top-level
``dataType``/``dataTypeDisplay`` but no parsed nested fields.

These tests pin the executed SQL string so the escaping can never silently
regress: they read the ``TextClause`` handed to ``connection.execute`` and
assert every identifier is backtick-quoted with internal backticks doubled, for
both the catalog and no-catalog branches.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock

from metadata.ingestion.source.database.databricks.metadata import get_columns

_METADATA = "metadata.ingestion.source.database.databricks.metadata"


def _run_get_columns(
    monkeypatch,
    rows,
    *,
    table_name="tbl",
    schema="sch",
    db_name: str | None = "db",
    describe_rows=None,
):
    """Drive the legacy ``get_columns`` path with the row fetchers mocked.

    ``_fetch_table_describe_json`` is forced to ``None`` so the AS-JSON path is
    skipped (no extra ``connection.execute`` call) and the only executed SQL is
    the per-column complex-type DESCRIBE — which is what these tests assert on.

    Returns ``(columns, executed_sql_strings)`` where each executed string is
    the ``.text`` of the ``TextClause`` passed to ``connection.execute``.
    """
    monkeypatch.setattr(f"{_METADATA}._fetch_table_describe_json", lambda *a, **k: None)
    monkeypatch.setattr(f"{_METADATA}._get_column_rows", lambda *a, **k: rows)

    connection = MagicMock()
    connection.info = {}
    if describe_rows is not None:
        connection.execute.return_value.fetchall.return_value = describe_rows

    cols = get_columns(SimpleNamespace(), connection, table_name, schema, db_name=db_name)
    executed = [call.args[0].text for call in connection.execute.call_args_list]
    return cols, executed


# A complex column whose sub-DESCRIBE returns this row set so ``data_type`` is
# recovered and ``is_complex`` is set; ``array<primitive>`` is used for the
# escaping cases because its regex gate skips the nested-description fetch,
# leaving exactly one ``connection.execute`` call to assert on.
_FIELD_ROWS = [("col_name", "ignored"), ("data_type", "array<int>"), ("comment", "")]


class TestComplexColumnDescribeEscaping:
    """The per-column DESCRIBE must route every identifier through
    ``_quote_identifier`` so a backtick in any name part is doubled."""

    def test_plain_identifiers_are_backtick_quoted(self, monkeypatch):
        _, executed = _run_get_columns(
            monkeypatch,
            [("tags", "array<int>", None)],
            describe_rows=_FIELD_ROWS,
        )

        assert executed == ["DESCRIBE TABLE `db`.`sch`.`tbl` `tags`"]
        assert len(executed) == 1

    def test_backtick_in_column_name_is_doubled(self, monkeypatch):
        _, executed = _run_get_columns(
            monkeypatch,
            [("a`b", "array<int>", None)],
            db_name="db",
            describe_rows=_FIELD_ROWS,
        )

        assert executed == ["DESCRIBE TABLE `db`.`sch`.`tbl` `a``b`"]

    def test_backtick_in_schema_name_is_doubled(self, monkeypatch):
        _, executed = _run_get_columns(
            monkeypatch,
            [("tags", "array<int>", None)],
            schema="sch`x",
            describe_rows=_FIELD_ROWS,
        )

        assert executed == ["DESCRIBE TABLE `db`.`sch``x`.`tbl` `tags`"]

    def test_backtick_in_table_name_is_doubled(self, monkeypatch):
        _, executed = _run_get_columns(
            monkeypatch,
            [("tags", "array<int>", None)],
            table_name="tbl`y",
            describe_rows=_FIELD_ROWS,
        )

        assert executed == ["DESCRIBE TABLE `db`.`sch`.`tbl``y` `tags`"]

    def test_backtick_in_catalog_name_is_doubled(self, monkeypatch):
        _, executed = _run_get_columns(
            monkeypatch,
            [("tags", "array<int>", None)],
            db_name="db`z",
            describe_rows=_FIELD_ROWS,
        )

        assert executed == ["DESCRIBE TABLE `db``z`.`sch`.`tbl` `tags`"]

    def test_injection_payload_in_column_name_is_neutralised(self, monkeypatch):
        """Mirrors ``test_identifier_helpers_keep_catalog_names_inside_backticks``:
        the classic ```; DROP ...`` payload must stay inside the quoted
        identifier rather than breaking out into a statement of its own."""
        payload = "c`; DROP TABLE secret; --"
        _, executed = _run_get_columns(
            monkeypatch,
            [(payload, "array<int>", None)],
            describe_rows=_FIELD_ROWS,
        )

        assert executed == ["DESCRIBE TABLE `db`.`sch`.`tbl` `c``; DROP TABLE secret; --`"]
        # Exactly one statement is issued — the payload never escapes the
        # backtick-quoted column identifier.
        assert len(executed) == 1


class TestComplexColumnDescribeNoCatalog:
    """Older Hive-metastore path: ``db_name`` is falsy, so the table reference
    is built with ``_qualified_identifier(schema, table)`` (no catalog) — the
    same pattern ``get_table_type``'s fallback uses — and the column is quoted
    on its own. This branch must escape backticks too."""

    def test_no_catalog_uses_qualified_identifier_and_quotes_column(self, monkeypatch):
        _, executed = _run_get_columns(
            monkeypatch,
            [("tags", "array<int>", None)],
            db_name=None,
            describe_rows=_FIELD_ROWS,
        )

        assert executed == ["DESCRIBE TABLE `sch`.`tbl` `tags`"]

    def test_no_catalog_doubles_backticks_in_schema_table_and_column(self, monkeypatch):
        _, executed = _run_get_columns(
            monkeypatch,
            [("c`d", "array<int>", None)],
            db_name=None,
            schema="sch`x",
            table_name="tbl`y",
            describe_rows=[("col_name", "ignored"), ("data_type", "array<int>")],
        )

        assert executed == ["DESCRIBE TABLE `sch``x`.`tbl``y` `c``d`"]


class TestComplexColumnNotDegraded:
    """The bug's user-visible symptom: a complex column whose name contains a
    backtick lost its nested structure — ``is_complex`` was never set because
    the malformed DESCRIBE raised a swallowed ``DatabaseError`` before line
    ``col_info["is_complex"] = True``. With escaping in place the sub-DESCRIBE
    succeeds and the column is marked complex so ``sql_column_handler`` parses
    its children."""

    def test_backtick_column_is_marked_complex_with_recovered_type(self, monkeypatch):
        cols, _ = _run_get_columns(
            monkeypatch,
            [("a`b", "array<int>", None)],
            describe_rows=[("col_name", "a`b"), ("data_type", "array<int>"), ("comment", "")],
        )

        assert cols[0]["is_complex"] is True
        # system_data_type is overwritten with the sub-DESCRIBE's data_type,
        # proving the subquery path completed rather than being swallowed.
        assert cols[0]["system_data_type"] == "array<int>"

    def test_plain_complex_column_still_marked_complex(self, monkeypatch):
        """Regression: the happy path (no backtick) still sets is_complex and
        overwrites system_data_type from the sub-DESCRIBE."""
        cols, _ = _run_get_columns(
            monkeypatch,
            [("tags", "array<int>", None)],
            describe_rows=_FIELD_ROWS,
        )

        assert cols[0]["is_complex"] is True
        assert cols[0]["system_data_type"] == "array<int>"


class TestStructColumnNestedDescriptionFetch:
    """The query refactor must not break the struct/array<struct> lazy
    nested-description fetch that runs after the sub-DESCRIBE succeeds."""

    def test_struct_column_triggers_nested_description_fetch(self, monkeypatch):
        monkeypatch.setattr(f"{_METADATA}._get_column_rows", lambda *a, **k: [("info", "struct<a:int>", None)])
        monkeypatch.setattr(f"{_METADATA}._fetch_table_describe_json", lambda *a, **k: None)

        fetch_calls = []

        def fake_fetch(connection, db, schema, table):
            fetch_calls.append((db, schema, table))
            # ColumnDescriptions shape: {column_name: {path_tuple: comment}}.
            return {"info": {("a",): "a desc"}}

        monkeypatch.setattr(f"{_METADATA}._fetch_nested_descriptions_via_describe_json", fake_fetch)

        connection = MagicMock()
        connection.info = {}
        connection.execute.return_value.fetchall.return_value = [("data_type", "struct<a:int>")]

        cols = get_columns(SimpleNamespace(), connection, "tbl", "sch", db_name="db")

        assert cols[0]["is_complex"] is True
        assert cols[0]["nested_descriptions"] == {("a",): "a desc"}
        assert fetch_calls == [("db", "sch", "tbl")]
        # The sub-DESCRIBE used the escaped query path.
        assert connection.execute.call_args_list[0].args[0].text == "DESCRIBE TABLE `db`.`sch`.`tbl` `info`"

    def test_struct_column_with_backtick_name_still_fetches_nested_descriptions(self, monkeypatch):
        """End-to-end: a backtick in every name part must not prevent the
        nested-description fetch — the query that produced a childless struct
        before the fix now completes and the nested field description lands."""
        monkeypatch.setattr(f"{_METADATA}._get_column_rows", lambda *a, **k: [("a`b", "struct<x:int>", None)])
        monkeypatch.setattr(f"{_METADATA}._fetch_table_describe_json", lambda *a, **k: None)
        monkeypatch.setattr(
            f"{_METADATA}._fetch_nested_descriptions_via_describe_json",
            lambda connection, db, schema, table: {"a`b": {("x",): "x desc"}},
        )

        connection = MagicMock()
        connection.info = {}
        connection.execute.return_value.fetchall.return_value = [("data_type", "struct<x:int>")]

        cols = get_columns(SimpleNamespace(), connection, "tbl`y", "sch`x", db_name="db`z")

        assert cols[0]["is_complex"] is True
        assert cols[0]["nested_descriptions"] == {("x",): "x desc"}
        assert connection.execute.call_args_list[0].args[0].text == "DESCRIBE TABLE `db``z`.`sch``x`.`tbl``y` `a``b`"
