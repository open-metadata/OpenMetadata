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

"""Tests for nested-column comment extraction in the Databricks connector.

Spark's ``DESCRIBE TABLE`` and ``DataType.simpleString`` strip nested
``COMMENT '...'`` clauses from struct field types, so the only SQL path that
exposes nested comments is ``DESCRIBE TABLE EXTENDED <table> AS JSON``
(Databricks Runtime 16.4+). These tests cover the JSON walker that maps
``columns[].type.fields[].comment`` into per-column path-keyed dicts and the
applier that puts those descriptions onto the parsed Column tree. On older
runtimes the JSON query errors and the connector silently degrades to
top-level-only descriptions — covered by the malformed/missing payload cases.
"""

from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.type.basic import Markdown
from metadata.ingestion.source.database.databricks.metadata import (
    _apply_nested_descriptions,
    _build_column_descriptions_map,
    _fetch_nested_descriptions_via_describe_json,
    get_columns,
)

# Mirrors the shape of `DESCRIBE TABLE EXTENDED ... AS JSON` output for the
# CREATE TABLE in the bug report (customer_profiles).
_CUSTOMER_PROFILES_JSON = {
    "table_name": "customer_profiles",
    "columns": [
        {
            "name": "customer_id",
            "type": {"name": "string"},
            "comment": "Unique customer identifier",
        },
        {
            "name": "personal_info",
            "type": {
                "name": "struct",
                "fields": [
                    {
                        "name": "first_name",
                        "type": {"name": "string"},
                        "comment": "Customer first name",
                    },
                    {
                        "name": "last_name",
                        "type": {"name": "string"},
                        "comment": "Customer last name",
                    },
                    {
                        "name": "dob",
                        "type": {"name": "date"},
                        "comment": "Date of birth",
                    },
                    {
                        "name": "contact",
                        "type": {
                            "name": "struct",
                            "fields": [
                                {
                                    "name": "email",
                                    "type": {"name": "string"},
                                    "comment": "Primary email address",
                                },
                                {
                                    "name": "phone",
                                    "type": {"name": "string"},
                                    "comment": "Mobile number",
                                },
                            ],
                        },
                        "comment": "Contact details",
                    },
                ],
            },
            "comment": "Basic personal information",
        },
        {
            "name": "preferences",
            "type": {"name": "array", "element_type": {"name": "string"}},
            "comment": "Customer preferences list",
        },
        {
            "name": "metadata",
            "type": {
                "name": "map",
                "key_type": {"name": "string"},
                "value_type": {"name": "string"},
            },
            "comment": "Additional dynamic properties",
        },
    ],
}


class TestBuildColumnDescriptionsMap:
    """The JSON walker that turns DESCRIBE-AS-JSON payloads into per-column
    ``{field_path: comment}`` dicts."""

    def test_extracts_comments_for_nested_struct_fields(self):
        result = _build_column_descriptions_map(_CUSTOMER_PROFILES_JSON)

        assert result["personal_info"] == {
            ("first_name",): "Customer first name",
            ("last_name",): "Customer last name",
            ("dob",): "Date of birth",
            ("contact",): "Contact details",
            ("contact", "email"): "Primary email address",
            ("contact", "phone"): "Mobile number",
        }

    def test_top_level_columns_with_no_nested_fields_are_omitted(self):
        """Primitive columns and array<primitive>/map<...,...> have no nested
        struct fields, so they don't appear in the per-column map."""
        result = _build_column_descriptions_map(_CUSTOMER_PROFILES_JSON)

        assert "customer_id" not in result
        assert "preferences" not in result
        assert "metadata" not in result

    def test_array_of_struct_does_not_add_path_level(self):
        payload = {
            "columns": [
                {
                    "name": "events",
                    "type": {
                        "name": "array",
                        "element_type": {
                            "name": "struct",
                            "fields": [
                                {
                                    "name": "ts",
                                    "type": {"name": "timestamp"},
                                    "comment": "event timestamp",
                                }
                            ],
                        },
                    },
                }
            ]
        }
        result = _build_column_descriptions_map(payload)
        assert result == {"events": {("ts",): "event timestamp"}}

    def test_struct_field_without_comment_is_skipped(self):
        payload = {
            "columns": [
                {
                    "name": "s",
                    "type": {
                        "name": "struct",
                        "fields": [
                            {"name": "a", "type": {"name": "int"}},
                            {"name": "b", "type": {"name": "int"}, "comment": "b!"},
                        ],
                    },
                }
            ]
        }
        result = _build_column_descriptions_map(payload)
        assert result == {"s": {("b",): "b!"}}

    def test_map_value_struct_is_not_descended(self):
        """OM does not surface map values as named children, so we skip
        them — comments inside map<...> are dropped on purpose."""
        payload = {
            "columns": [
                {
                    "name": "m",
                    "type": {
                        "name": "map",
                        "key_type": {"name": "string"},
                        "value_type": {
                            "name": "struct",
                            "fields": [
                                {
                                    "name": "x",
                                    "type": {"name": "int"},
                                    "comment": "x desc",
                                }
                            ],
                        },
                    },
                }
            ]
        }
        result = _build_column_descriptions_map(payload)
        assert result == {}

    def test_empty_payload_returns_empty(self):
        assert _build_column_descriptions_map({}) == {}
        assert _build_column_descriptions_map({"columns": []}) == {}

    def test_non_dict_payload_returns_empty(self):
        """Defensive: if the JSON parses to a list or string for some reason,
        don't crash."""
        assert _build_column_descriptions_map([]) == {}
        assert _build_column_descriptions_map("not a dict") == {}


class TestFetchNestedDescriptionsViaDescribeJson:
    """The query wrapper, which must swallow every error path so older
    Databricks Runtimes (no AS JSON support) silently fall through."""

    def test_query_failure_returns_empty(self):
        connection = MagicMock()
        connection.execute.side_effect = Exception("syntax error: AS JSON unsupported")

        assert _fetch_nested_descriptions_via_describe_json(connection, "db", "schema", "table") == {}

    def test_empty_result_returns_empty(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = None

        assert _fetch_nested_descriptions_via_describe_json(connection, "db", "schema", "table") == {}

    def test_invalid_json_returns_empty(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = ("not valid json {",)

        assert _fetch_nested_descriptions_via_describe_json(connection, "db", "schema", "table") == {}

    def test_valid_json_extracts_descriptions(self):
        import json as _json

        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = (_json.dumps(_CUSTOMER_PROFILES_JSON),)

        result = _fetch_nested_descriptions_via_describe_json(connection, "db", "schema", "customer_profiles")
        assert ("first_name",) in result["personal_info"]
        assert result["personal_info"][("first_name",)] == "Customer first name"

    @pytest.mark.parametrize(
        "db_name,schema",
        [(None, "schema"), ("", "schema"), ("db", None), ("db", "")],
    )
    def test_missing_db_or_schema_returns_empty_without_query(self, db_name, schema):
        """The early-return guard must short-circuit before ``connection.execute``
        runs — otherwise we'd build a SQL string with literal ``None``/empty
        identifiers and rely on the except block to swallow the error."""
        connection = MagicMock()

        assert _fetch_nested_descriptions_via_describe_json(connection, db_name, schema, "table") == {}
        connection.execute.assert_not_called()


class TestApplyNestedDescriptions:
    """Walks a parsed Column tree and assigns descriptions from the
    path-keyed map."""

    def _build_struct_column(self, fields):
        return Column(
            name="parent",
            dataType="STRUCT",
            children=[Column(name=name, dataType=dtype) for name, dtype in fields],
        )

    def test_top_level_descriptions(self):
        col = self._build_struct_column([("first_name", "STRING"), ("dob", "DATE")])
        descs = {("first_name",): "Customer first name", ("dob",): "Date of birth"}

        _apply_nested_descriptions(col, descs, ())

        children_by_name = {c.name.root: c for c in col.children}
        assert children_by_name["first_name"].description == Markdown(root="Customer first name")
        assert children_by_name["dob"].description == Markdown(root="Date of birth")

    def test_nested_struct_descriptions(self):
        contact = Column(
            name="contact",
            dataType="STRUCT",
            children=[
                Column(name="email", dataType="STRING"),
                Column(name="phone", dataType="STRING"),
            ],
        )
        col = Column(name="personal_info", dataType="STRUCT", children=[contact])
        descs = {
            ("contact",): "Contact details",
            ("contact", "email"): "Primary email address",
            ("contact", "phone"): "Mobile number",
        }

        _apply_nested_descriptions(col, descs, ())

        assert col.children[0].description == Markdown(root="Contact details")
        email = col.children[0].children[0]
        phone = col.children[0].children[1]
        assert email.description == Markdown(root="Primary email address")
        assert phone.description == Markdown(root="Mobile number")

    def test_existing_description_is_not_overwritten(self):
        col = self._build_struct_column([("a", "STRING")])
        col.children[0].description = Markdown(root="user override")

        _apply_nested_descriptions(col, {("a",): "from databricks"}, ())

        assert col.children[0].description == Markdown(root="user override")

    def test_no_descriptions_is_a_noop(self):
        col = self._build_struct_column([("a", "STRING"), ("b", "INT")])
        _apply_nested_descriptions(col, {}, ())
        assert all(c.description is None for c in col.children)

    def test_column_with_no_children_is_safe(self):
        col = Column(name="x", dataType="STRING")
        _apply_nested_descriptions(col, {("a",): "desc"}, ())
        assert col.description is None


@patch("metadata.ingestion.source.database.databricks.metadata._fetch_nested_descriptions_via_describe_json")
@patch("metadata.ingestion.source.database.databricks.metadata._get_column_rows")
class TestDescribeJsonLazyFetch:
    """The ``DESCRIBE TABLE EXTENDED ... AS JSON`` round-trip is fired only
    when a complex column is encountered, and at most once per table. This
    avoids doubling the DESCRIBE traffic on catalogs of mostly primitive-
    typed tables — see review feedback on PR #27766."""

    def _run(self, mock_connection):
        return get_columns(
            MagicMock(),  # self (dialect)
            mock_connection,
            "tbl",
            "schema",
            db_name="db",
        )

    def test_skipped_when_table_has_no_complex_columns(self, mock_rows, mock_fetch_json):
        """Primitive-only table → AS JSON query never runs."""
        mock_rows.return_value = [
            ("id", "bigint", None),
            ("name", "string", None),
            ("created_at", "timestamp", None),
        ]
        connection = MagicMock()

        self._run(connection)

        mock_fetch_json.assert_not_called()

    def _connection_with_describe_rows(self):
        """Mock a connection whose per-column ``DESCRIBE TABLE`` returns a
        valid ``data_type`` row so the lazy fetch is reached."""
        connection = MagicMock()
        connection.execute.return_value.fetchall.return_value = [
            ("col_name", "irrelevant"),
            ("data_type", "struct<a:int>"),
            ("comment", ""),
        ]
        return connection

    def test_called_once_for_table_with_one_complex_column(self, mock_rows, mock_fetch_json):
        mock_rows.return_value = [
            ("id", "bigint", None),
            ("info", "struct<a:int>", None),
            ("name", "string", None),
        ]
        mock_fetch_json.return_value = {}
        connection = self._connection_with_describe_rows()

        self._run(connection)

        mock_fetch_json.assert_called_once_with(connection, "db", "schema", "tbl")

    def test_called_once_for_table_with_multiple_complex_columns(self, mock_rows, mock_fetch_json):
        """Cached after first complex column — second/third columns reuse
        the result instead of triggering another round-trip."""
        mock_rows.return_value = [
            ("personal_info", "struct<a:int>", None),
            ("address", "struct<b:int>", None),
            ("preferences", "array<string>", None),
        ]
        mock_fetch_json.return_value = {}
        connection = self._connection_with_describe_rows()

        self._run(connection)

        assert mock_fetch_json.call_count == 1

    def test_array_of_struct_triggers_lazy_fetch(self, mock_rows, mock_fetch_json):
        """``array<struct<...>>`` columns must trigger the AS JSON fetch — the
        regex gate (``^array\\s*<\\s*struct\\b``) is what protects this path."""
        mock_rows.return_value = [
            ("orders", "array<struct<id:int,total:double>>", None),
        ]
        mock_fetch_json.return_value = {}
        connection = MagicMock()
        connection.execute.return_value.fetchall.return_value = [
            ("col_name", "orders"),
            ("data_type", "array<struct<id:int,total:double>>"),
            ("comment", ""),
        ]

        self._run(connection)

        mock_fetch_json.assert_called_once_with(connection, "db", "schema", "tbl")

    def test_array_of_primitive_does_not_trigger_lazy_fetch(self, mock_rows, mock_fetch_json):
        """``array<primitive>`` carries no nested struct fields, so the regex
        gate must skip the AS JSON round-trip."""
        mock_rows.return_value = [
            ("tags", "array<string>", None),
        ]
        connection = self._connection_with_describe_rows()

        self._run(connection)

        mock_fetch_json.assert_not_called()

    def test_map_does_not_trigger_lazy_fetch(self, mock_rows, mock_fetch_json):
        """``map<...>`` exposes no named children in OM, so the regex gate
        must skip the AS JSON round-trip even though map is in the
        outer ``if col_type in {"array", "struct", "map"}`` branch."""
        mock_rows.return_value = [
            ("attrs", "map<string,string>", None),
        ]
        connection = self._connection_with_describe_rows()

        self._run(connection)

        mock_fetch_json.assert_not_called()


class _SqlAlchemy2Row(tuple):
    """Simulates a SQLAlchemy 2.x ``Row``: tuple-iterable, but ``.values()``
    raises (it was removed in SA 2.x and attribute access falls back to column
    lookup, which is the bug this PR fixes)."""

    def values(self):
        raise AttributeError("Row.values() removed in SQLAlchemy 2.x")


class TestSqlAlchemy2RowCompat:
    """``get_table_comment`` / ``get_schema_description`` / ``get_table_description``
    use ``data = tuple(result)`` instead of ``result.values()`` so they work
    on both SA 1.x and SA 2.x. These tests guard against any future revert
    that would silently drop schema/table descriptions on SA 2.x."""

    def test_get_table_comment_handles_sa2_row(self):
        from metadata.ingestion.source.database.databricks.metadata import (
            get_table_comment,
        )

        mock_self = MagicMock()
        mock_self.context.get().database = "db"
        mock_self.get_table_comment_result.return_value = [
            _SqlAlchemy2Row(("Comment", "Customer table description")),
        ]

        result = get_table_comment(mock_self, MagicMock(), "customers", "sales")

        assert result == {"text": "Customer table description"}

    def test_get_table_comment_returns_none_text_when_no_comment_row(self):
        """A SA 2.x cursor with rows that aren't ``Comment`` rows must still
        return ``{"text": None}`` and never crash on ``.values()``."""
        from metadata.ingestion.source.database.databricks.metadata import (
            get_table_comment,
        )

        mock_self = MagicMock()
        mock_self.context.get().database = "db"
        mock_self.get_table_comment_result.return_value = [
            _SqlAlchemy2Row(("Location", "/some/path")),
            _SqlAlchemy2Row(("Provider", "delta")),
        ]

        result = get_table_comment(mock_self, MagicMock(), "customers", "sales")

        assert result == {"text": None}

    def test_get_schema_description_handles_sa2_row(self):
        from metadata.ingestion.source.database.databricks.metadata import (
            DatabricksSource,
        )

        mock_self = MagicMock()
        mock_self.context.get().database = "db"
        mock_self.inspector.dialect.get_schema_comment_result.return_value = [
            _SqlAlchemy2Row(("Comment", "My schema description")),
        ]

        result = DatabricksSource.get_schema_description(mock_self, "my_schema")

        assert result == "My schema description"

    def test_get_schema_description_returns_none_when_no_comment_row(self):
        from metadata.ingestion.source.database.databricks.metadata import (
            DatabricksSource,
        )

        mock_self = MagicMock()
        mock_self.context.get().database = "db"
        mock_self.inspector.dialect.get_schema_comment_result.return_value = [
            _SqlAlchemy2Row(("Owner", "admin")),
        ]

        result = DatabricksSource.get_schema_description(mock_self, "my_schema")

        assert result is None

    def test_get_table_description_handles_sa2_row(self):
        from metadata.ingestion.source.database.databricks.metadata import (
            DatabricksSource,
        )

        mock_self = MagicMock()
        mock_self.context.get().database = "db"
        mock_self.external_location_map = {}
        mock_inspector = MagicMock()
        mock_inspector.dialect.get_table_comment_result.return_value = [
            _SqlAlchemy2Row(("Comment", "My table description")),
        ]

        result = DatabricksSource.get_table_description(mock_self, "my_schema", "my_table", mock_inspector)

        assert result == "My table description"

    def test_get_table_description_returns_none_when_no_comment_row(self):
        from metadata.ingestion.source.database.databricks.metadata import (
            DatabricksSource,
        )

        mock_self = MagicMock()
        mock_self.context.get().database = "db"
        mock_self.external_location_map = {}
        mock_inspector = MagicMock()
        mock_inspector.dialect.get_table_comment_result.return_value = [
            _SqlAlchemy2Row(("Location", "/external/path")),
        ]

        result = DatabricksSource.get_table_description(mock_self, "my_schema", "my_table", mock_inspector)

        assert result is None
