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

"""
Unit tests for the Dremio SQLAlchemy dialect
"""

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import types
from sqlalchemy.dialects import registry
from sqlalchemy.engine import URL

from metadata.ingestion.source.database.dremio.dialect import (
    COLUMNS_CACHE_SIZE,
    DremioFlightDialect,
    as_number,
    get_column_type,
    is_nested,
    literal,
    quote_path,
    set_session_option_request,
    split_top_level,
    to_om_type,
)


def connection_returning(*rows) -> MagicMock:
    connection = MagicMock()
    result = connection.exec_driver_sql.return_value
    result.__iter__.side_effect = lambda: iter(rows)
    result.scalar.return_value = rows[0][0] if rows else None
    return connection


def connection_answering(**answers) -> MagicMock:
    """A connection that answers by what the statement contains, e.g. COLUMNS=[...]"""
    connection = MagicMock()

    def answer(statement):
        for key, rows in answers.items():
            if key in statement:
                return iter(rows)
        raise AssertionError(f"Unexpected statement: {statement}")

    connection.exec_driver_sql.side_effect = answer
    return connection


def executed_statements(connection: MagicMock) -> list:
    return [call.args[0] for call in connection.exec_driver_sql.call_args_list]


def executed_sql(connection: MagicMock) -> str:
    return connection.exec_driver_sql.call_args.args[0]


class TestQuoting:
    def test_literal_doubles_single_quotes(self):
        assert literal("o'brien") == "'o''brien'"

    def test_path_quotes_every_folder(self):
        assert quote_path("space.folder.sub", "table") == '"space"."folder"."sub"."table"'

    def test_path_without_schema_is_the_table(self):
        assert quote_path(None, "table") == '"table"'
        assert quote_path("", "table") == '"table"'

    def test_path_doubles_double_quotes(self):
        assert quote_path("space", 'my"table') == '"space"."my""table"'


class TestColumnType:
    @pytest.mark.parametrize(
        "data_type,expected",
        [
            ("BOOLEAN", types.BOOLEAN),
            ("INTEGER", types.INTEGER),
            ("BIGINT", types.BIGINT),
            ("FLOAT", types.FLOAT),
            ("DOUBLE", types.DOUBLE),
            ("DATE", types.DATE),
            ("TIME", types.TIME),
            ("TIMESTAMP", types.TIMESTAMP),
            ("BINARY VARYING", types.VARBINARY),
            ("CHARACTER VARYING", types.VARCHAR),
        ],
    )
    def test_dremio_types(self, data_type, expected):
        assert isinstance(get_column_type(data_type, None, None, None), expected)

    def test_types_are_case_insensitive(self):
        assert isinstance(get_column_type("bigint", None, None, None), types.BIGINT)

    def test_varchar_keeps_its_length(self):
        assert get_column_type("CHARACTER VARYING", 255, None, None).length == 255

    def test_decimal_accepts_the_floats_dremio_reports(self):
        column_type = get_column_type("DECIMAL", None, 38.0, 2.0)

        assert (column_type.precision, column_type.scale) == (38, 2)

    def test_a_missing_precision_and_scale_are_nan(self):
        nan = float("nan")

        assert get_column_type("DECIMAL", None, nan, nan).precision is None
        assert get_column_type("DECIMAL", None, 10.0, nan).scale == 0

    def test_decimal_without_scale(self):
        assert get_column_type("DECIMAL", None, 10.0, None).scale == 0

    def test_intervals(self):
        assert isinstance(get_column_type("INTERVAL DAY TO SECOND", None, None, None), types.Interval)

    def test_nested_types_are_not_reflected(self):
        assert isinstance(get_column_type("ROW", None, None, None), types.NullType)


class TestReflection:
    dialect = DremioFlightDialect()

    def test_columns_of_a_schema_are_read_with_one_statement(self):
        connection = connection_answering(
            COLUMNS=[
                ("sales", "region", "CHARACTER VARYING", "YES", None, None),
                ("sales", "amount", "DECIMAL", "NO", 12.0, 2.0),
                ("events", "id", "BIGINT", "YES", None, None),
            ]
        )
        dialect = DremioFlightDialect()

        sales_columns = dialect.get_columns(connection, "sales", "polaris.demo")
        events_columns = dialect.get_columns(connection, "events", "polaris.demo")

        assert len(executed_statements(connection)) == 1
        assert "TABLE_SCHEMA = 'polaris.demo'" in executed_statements(connection)[0]
        assert [(c["name"], c["nullable"]) for c in sales_columns] == [("region", True), ("amount", False)]
        assert isinstance(sales_columns[0]["type"], types.VARCHAR)
        assert (sales_columns[1]["type"].precision, sales_columns[1]["type"].scale) == (12, 2)
        assert [c["name"] for c in events_columns] == ["id"]

    def test_the_columns_of_a_schema_are_read_once_per_dialect(self):
        connection = connection_answering(COLUMNS=[("a", "x", "BIGINT", "YES", None, None)])
        dialect = DremioFlightDialect()

        dialect.get_columns(connection, "a", "s")
        dialect.get_columns(connection, "a", "s")
        dialect.get_columns(connection, "a", "other")

        assert len(executed_statements(connection)) == 2  # s once, other once

    def test_a_table_dremio_has_not_loaded_is_described(self):
        # The columns of a lakehouse table stay out of INFORMATION_SCHEMA until it has been read
        connection = connection_answering(
            COLUMNS=[("loaded", "id", "BIGINT", "YES", None, None)],
            DESCRIBE=[("region", "CHARACTER VARYING", "YES", None, None), ("amount", "DOUBLE", "NO", 53.0, None)],
        )

        columns = DremioFlightDialect().get_columns(connection, "lazy", "polaris.demo")

        assert executed_statements(connection)[-1] == 'DESCRIBE "polaris"."demo"."lazy"'
        assert [(c["name"], c["nullable"]) for c in columns] == [("region", True), ("amount", False)]

    def test_describe_extra_columns_are_ignored(self):
        connection = connection_answering(
            COLUMNS=[],
            DESCRIBE=[("id", "BIGINT", "YES", None, None, "[]", None, None)],
        )

        assert DremioFlightDialect().get_columns(connection, "t", "s")[0]["name"] == "id"

    def test_view_definition_is_read_from_the_catalog(self):
        connection = connection_returning(("SELECT 1",))

        definition = self.dialect.get_view_definition(connection, "v", "space.folder")

        assert definition == "SELECT 1"
        assert 'INFORMATION_SCHEMA."VIEWS"' in executed_sql(connection)
        assert "TABLE_SCHEMA = 'space.folder'" in executed_sql(connection)
        assert "TABLE_NAME = 'v'" in executed_sql(connection)

    def test_names_with_quotes_cannot_break_out_of_the_statement(self):
        connection = connection_returning(("SELECT 1",))

        self.dialect.get_view_definition(connection, "v' OR '1'='1", "s")

        assert "TABLE_NAME = 'v'' OR ''1''=''1'" in executed_sql(connection)

    def test_names_with_a_colon_are_not_read_as_bind_parameters(self):
        connection = connection_returning(("SELECT 1",))

        self.dialect.get_view_definition(connection, "a:b", "s")

        connection.exec_driver_sql.assert_called_once()
        connection.execute.assert_not_called()

    def test_schema_names(self):
        connection = connection_returning(("space",), ("space.folder",))

        assert self.dialect.get_schema_names(connection) == ["space", "space.folder"]

    def test_table_names(self):
        connection = connection_returning(("a",), ("b",))

        assert self.dialect.get_table_names(connection, "space.folder") == ["a", "b"]
        assert "TABLE_SCHEMA = 'space.folder'" in executed_sql(connection)

    def test_has_table(self):
        assert self.dialect.has_table(connection_returning((1,)), "t", "s") is True
        assert self.dialect.has_table(connection_returning((0,)), "t", "s") is False


def test_dialect_replaces_the_one_of_the_driver():
    assert registry.load("dremio.flight") is DremioFlightDialect


class TestNumbers:
    def test_nan_is_no_number(self):
        assert as_number(float("nan")) is None

    def test_none_and_numbers_are_kept(self):
        assert as_number(None) is None
        assert as_number(0.0) == 0.0
        assert as_number(38.0) == 38.0


class TestNestedTypes:
    @pytest.mark.parametrize(
        "data_type,expected",
        [
            ("ROW(a VARCHAR, b BIGINT)", True),
            ("row(a VARCHAR)", True),
            ("ARRAY(VARCHAR)", True),
            ("MAP(VARCHAR, INTEGER)", True),
            ("ROW", True),
            ("CHARACTER VARYING", False),
            ("DECIMAL", False),
            (None, False),
        ],
    )
    def test_nested_types_are_recognised(self, data_type, expected):
        assert is_nested(data_type) is expected

    def test_a_row_is_written_as_a_struct(self):
        data_type = "ROW(data_path VARCHAR, data_size_bytes BIGINT, data_format VARCHAR)"

        assert to_om_type(data_type) == "struct<data_path:varchar,data_size_bytes:bigint,data_format:varchar>"

    def test_dremio_names_are_translated(self):
        assert (
            to_om_type("ROW(a CHARACTER VARYING, b INTEGER, c BINARY VARYING)") == "struct<a:varchar,b:int,c:varbinary>"
        )

    def test_rows_nest(self):
        assert to_om_type("ROW(a VARCHAR, b ROW(c INTEGER, d ARRAY(VARCHAR)))") == (
            "struct<a:varchar,b:struct<c:int,d:array<varchar>>>"
        )

    def test_a_decimal_loses_its_precision(self):
        assert to_om_type("ROW(amount DECIMAL(38, 2), id BIGINT)") == "struct<amount:decimal,id:bigint>"

    def test_a_quoted_field_name_may_hold_a_space(self):
        assert to_om_type('ROW("first name" VARCHAR, age INTEGER)') == "struct<first name:varchar,age:int>"

    def test_maps_and_arrays(self):
        assert to_om_type("MAP(VARCHAR, ARRAY(INTEGER))") == "map<varchar,array<int>>"
        assert to_om_type("LIST(VARCHAR)") == "array<varchar>"

    def test_commas_inside_parentheses_do_not_split(self):
        assert split_top_level("a DECIMAL(38, 2), b ROW(c INTEGER, d INTEGER), e VARCHAR") == [
            "a DECIMAL(38, 2)",
            "b ROW(c INTEGER, d INTEGER)",
            "e VARCHAR",
        ]


class TestNestedColumns:
    def test_a_row_column_is_a_complex_column(self):
        connection = connection_answering(
            COLUMNS=[("t", "file", "ROW", "YES", None, None), ("t", "id", "BIGINT", "YES", None, None)],
            DESCRIBE=[
                ("file", "ROW(path VARCHAR, size BIGINT)", "YES", None, None),
                ("id", "BIGINT", "YES", None, None),
            ],
        )

        columns = DremioFlightDialect().get_columns(connection, "t", "s")

        assert columns[0]["is_complex"] is True
        assert columns[0]["system_data_type"] == "struct<path:varchar,size:bigint>"
        assert "is_complex" not in columns[1]

    def test_a_table_with_a_row_is_described_for_its_fields(self):
        connection = connection_answering(
            COLUMNS=[("t", "file", "ROW", "YES", None, None)],
            DESCRIBE=[("file", "ROW(path VARCHAR)", "YES", None, None)],
        )

        DremioFlightDialect().get_columns(connection, "t", "s")

        assert executed_statements(connection)[-1] == 'DESCRIBE "s"."t"'

    def test_the_columns_of_a_table_without_nested_types_come_from_the_batch(self):
        connection = connection_answering(COLUMNS=[("t", "id", "BIGINT", "YES", None, None)])

        DremioFlightDialect().get_columns(connection, "t", "s")

        assert len(executed_statements(connection)) == 1


class TestProject:
    """Dremio Cloud queries the default project of the token unless the session names one"""

    def url(self, **query) -> URL:
        return URL.create("dremio+flight", host="data.eu.dremio.cloud", port=443, query={"Token": "pat", **query})

    def test_request_is_the_protocol_buffers_message_of_one_string_option(self):
        # session_options (1) -> entry: key (1) "project_id", value (2) -> string_value (1) "abc"
        entry = b"\x0a\x0aproject_id" + b"\x12\x05\x0a\x03abc"
        assert set_session_option_request("project_id", "abc") == b"\x0a" + bytes([len(entry)]) + entry

    def test_long_values_use_a_multi_byte_length(self):
        request = set_session_option_request("project_id", "x" * 200)

        assert request.endswith(b"x" * 200)
        assert request[1] & 0x80  # the length of the entry does not fit in one byte

    def test_project_travels_at_the_end_of_the_connection_string(self):
        args, _ = DremioFlightDialect().create_connect_args(self.url(project_id="abc"))

        assert args[0].endswith(";project_id=abc")

    def test_without_project_the_connection_string_is_the_one_of_the_driver(self):
        args, _ = DremioFlightDialect().create_connect_args(self.url())

        assert "project_id" not in args[0]

    def test_project_is_set_once_on_the_new_connection(self):
        dialect = DremioFlightDialect()
        args, _ = dialect.create_connect_args(self.url(project_id="abc"))
        connection = MagicMock()
        with patch("sqlalchemy_dremio.flight.DremioDialect_flight.connect", return_value=connection):
            assert dialect.connect(*args) is connection

        action, options = connection.flightclient.do_action.call_args.args
        assert action.type == "SetSessionOptions"
        assert action.body.to_pybytes() == set_session_option_request("project_id", "abc")
        assert options is connection.options
        connection.flightclient.do_action.assert_called_once()

    def test_nothing_is_sent_without_project(self):
        dialect = DremioFlightDialect()
        args, _ = dialect.create_connect_args(self.url())
        connection = MagicMock()
        with patch("sqlalchemy_dremio.flight.DremioDialect_flight.connect", return_value=connection):
            dialect.connect(*args)

        connection.flightclient.do_action.assert_not_called()


class TestColumnsCache:
    """The columns of a schema are read with one query, and only the last few schemas are kept"""

    def test_a_schema_is_read_once(self):
        connection = connection_returning(("orders", "amount", "YES", None, None, None))
        dialect = DremioFlightDialect()

        first = dialect._get_schema_columns(connection, "lake.retail")
        second = dialect._get_schema_columns(connection, "lake.retail")

        assert first is second
        connection.exec_driver_sql.assert_called_once()

    def test_the_cache_is_bounded(self):
        connection = connection_returning(("orders", "amount", "YES", None, None, None))
        dialect = DremioFlightDialect()

        for number in range(COLUMNS_CACHE_SIZE * 3):
            dialect._get_schema_columns(connection, f"lake.schema{number}")

        assert len(dialect._columns_by_schema) == COLUMNS_CACHE_SIZE
