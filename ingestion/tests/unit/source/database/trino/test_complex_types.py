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
    resolve_field_names,
    split_row_field,
)


class TestSplitRowField:
    """Splitting a single ROW field into (name, type); None name means unnamed."""

    @pytest.mark.parametrize(
        ("field", "expected"),
        [
            # Trino always quotes a named field; the quotes must not leak into
            # the OpenMetadata child column name.
            ('"a" bigint', ("a", "bigint")),
            ('"MyField" bigint', ("MyField", "bigint")),
            ('"my col" bigint', ("my col", "bigint")),
            # An embedded quote is escaped by doubling it.
            ('"we""ird" bigint', ('we"ird', "bigint")),
            # Unnamed fields.
            ("bigint", (None, "bigint")),
            ("varchar(1)", (None, "varchar(1)")),
            # Unnamed fields whose type itself contains spaces.
            ("timestamp(3) with time zone", (None, "timestamp(3) with time zone")),
            ("interval day to second", (None, "interval day to second")),
            ("double precision", (None, "double precision")),
            # Named fields whose type contains spaces.
            ('"ts" timestamp(3) with time zone', ("ts", "timestamp(3) with time zone")),
            ('"iv" interval day to second', ("iv", "interval day to second")),
            # Legacy unquoted form, still parsed as a named field.
            ("a int", ("a", "int")),
        ],
    )
    def test_split(self, field, expected):
        assert split_row_field(field) == expected


class TestResolveFieldNames:
    """Unnamed fields are named positionally, and never collide with a real name."""

    def test_unnamed_fields_get_positional_names(self):
        fields = [(None, "bigint"), ("b", "varchar"), (None, "int")]

        assert resolve_field_names(fields) == [
            ("field1", "bigint"),
            ("b", "varchar"),
            ("field3", "int"),
        ]

    @pytest.mark.parametrize(
        ("fields", "expected_names"),
        [
            # A field explicitly named `field1` alongside an unnamed field at
            # position 1 -- `row(bigint, "field1" varchar)` is valid Trino.
            ([(None, "bigint"), ("field1", "varchar")], ["field1_1", "field1"]),
            ([("field2", "varchar"), (None, "bigint")], ["field2", "field2_1"]),
            # Disambiguation must also dodge an explicit `fieldN_1`.
            (
                [(None, "bigint"), ("field1", "varchar"), ("field1_1", "varchar")],
                ["field1_2", "field1", "field1_1"],
            ),
        ],
    )
    def test_positional_names_never_collide(self, fields, expected_names):
        resolved = [name for name, _ in resolve_field_names(fields)]

        assert resolved == expected_names
        assert len(resolved) == len(set(resolved))


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

    @pytest.mark.parametrize(
        ("type_str", "expected"),
        [
            ('row(bigint, "field1" varchar)', "struct<field1_1:bigint,field1:varchar>"),
            ('row("field2" varchar, bigint)', "struct<field2:varchar,field2_1:bigint>"),
        ],
    )
    def test_positional_name_does_not_shadow_an_explicit_field(self, type_str, expected):
        """A struct must never end up with two children of the same name."""
        assert parse_row_data_type(type_str) == expected


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
