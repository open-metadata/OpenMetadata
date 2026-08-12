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
Regression tests for Trino ROW/ARRAY reflection.

Every type string here is verbatim `SHOW COLUMNS` output captured from a live
Trino 483 instance. Trino quotes named ROW fields and allows the name to be
omitted entirely, neither of which the parser used to handle.
"""

from unittest.mock import MagicMock

import pytest
from sqlalchemy.sql import sqltypes

from metadata.ingestion.source.database.trino.metadata import (
    _get_columns,
    parse_row_data_type,
    split_row_field,
)


class TestSplitRowField:
    """Splitting a single ROW field into (name, type)."""

    @pytest.mark.parametrize(
        ("field", "position", "expected"),
        [
            # Trino always quotes a named field; the quotes must not leak into
            # the OpenMetadata child column name.
            ('"a" bigint', 1, ("a", "bigint")),
            ('"MyField" bigint', 1, ("MyField", "bigint")),
            ('"my col" bigint', 1, ("my col", "bigint")),
            # An embedded quote is escaped by doubling it.
            ('"we""ird" bigint', 1, ('we"ird', "bigint")),
            # Unnamed fields get a positional name matching Trino's 1-based
            # field access, so `s[2]` reads as `field2`.
            ("bigint", 1, ("field1", "bigint")),
            ("varchar(1)", 2, ("field2", "varchar(1)")),
            # Unnamed fields whose type itself contains spaces.
            ("timestamp(3) with time zone", 1, ("field1", "timestamp(3) with time zone")),
            ("interval day to second", 1, ("field1", "interval day to second")),
            ("double precision", 3, ("field3", "double precision")),
            # Named fields whose type contains spaces.
            ('"ts" timestamp(3) with time zone', 1, ("ts", "timestamp(3) with time zone")),
            ('"iv" interval day to second', 1, ("iv", "interval day to second")),
            # Legacy unquoted form, still parsed as a named field.
            ("a int", 1, ("a", "int")),
        ],
    )
    def test_split(self, field, position, expected):
        assert split_row_field(field, position) == expected


class TestParseRowDataType:
    """Full ROW type strings."""

    @pytest.mark.parametrize(
        ("type_str", "expected"),
        [
            ('row("a" bigint, "b" varchar)', "struct<a:bigint,b:varchar>"),
            ("row(integer, varchar(1))", "struct<field1:integer,field2:varchar(1)>"),
            # Trino allows a mix of named and unnamed fields in one ROW.
            ('row(bigint, "b" bigint)', "struct<field1:bigint,b:bigint>"),
            ('row("outer" row("inner" bigint))', "struct<outer:struct<inner:bigint>>"),
            (
                "row(row(integer, varchar(1)))",
                "struct<field1:struct<field1:integer,field2:varchar(1)>>",
            ),
            ('row("arr" array(row("a" bigint)))', "struct<arr:array<struct<a:bigint>>>"),
            ("row(array(row(integer)))", "struct<field1:array<struct<field1:integer>>>"),
            # Case of a quoted field name is preserved in dataTypeDisplay.
            ('row("MyField" bigint)', "struct<MyField:bigint>"),
        ],
    )
    def test_parse(self, type_str, expected):
        assert parse_row_data_type(type_str) == expected

    def test_anonymous_fields_do_not_raise(self):
        """Regression: this used to raise ValueError and drop every column."""
        assert parse_row_data_type("row(bigint, varchar(10))") == "struct<field1:bigint,field2:varchar(10)>"


def _record(column, type_):
    record = MagicMock()
    record.Column, record.Type, record.Extra, record.Comment = column, type_, "", ""
    return record


def _columns_for(*type_strings):
    connection = MagicMock()
    connection.dialect.identifier_preparer.quote.side_effect = lambda value: f'"{value}"'
    connection.execute.return_value = [_record(f"c{i}", t) for i, t in enumerate(type_strings)]
    return _get_columns(MagicMock(), connection, "t", "s")


class TestGetColumns:
    """The reflection entry point must never drop columns for an unparseable type."""

    def test_anonymous_row_still_yields_all_columns(self):
        """Regression: an unnamed ROW field used to abort reflection for the whole table."""
        columns = _columns_for("bigint", "row(integer, varchar(1))", "varchar")

        assert [c["name"] for c in columns] == ["c0", "c1", "c2"]
        assert columns[1]["system_data_type"] == "struct<field1:integer,field2:varchar(1)>"
        assert columns[1]["is_complex"] is True

    def test_unparseable_type_falls_back_to_nulltype(self):
        """The driver cannot build a ROW type with unnamed fields; reflection continues anyway."""
        columns = _columns_for("row(integer, varchar(1))")

        assert columns[0]["type"] is sqltypes.NULLTYPE

    def test_named_row_children_are_not_quoted(self):
        """Regression: children used to be named '"a"' rather than 'a'."""
        columns = _columns_for('row("a" bigint, "b" varchar)')

        assert columns[0]["system_data_type"] == "struct<a:bigint,b:varchar>"

    def test_quoted_field_name_case_is_preserved(self):
        columns = _columns_for('row("MyField" bigint)')

        assert columns[0]["system_data_type"] == "struct<MyField:bigint>"

    def test_simple_types_are_not_marked_complex(self):
        columns = _columns_for("bigint", "varchar(10)")

        assert all("is_complex" not in c for c in columns)
