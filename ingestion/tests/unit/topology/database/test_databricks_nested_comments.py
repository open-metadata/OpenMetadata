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

from unittest.mock import MagicMock

from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.type.basic import Markdown
from metadata.ingestion.source.database.databricks.metadata import (
    _apply_nested_descriptions,
    _build_column_descriptions_map,
    _fetch_nested_descriptions_via_describe_json,
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

        assert (
            _fetch_nested_descriptions_via_describe_json(
                connection, "db", "schema", "table"
            )
            == {}
        )

    def test_empty_result_returns_empty(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = None

        assert (
            _fetch_nested_descriptions_via_describe_json(
                connection, "db", "schema", "table"
            )
            == {}
        )

    def test_invalid_json_returns_empty(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = ("not valid json {",)

        assert (
            _fetch_nested_descriptions_via_describe_json(
                connection, "db", "schema", "table"
            )
            == {}
        )

    def test_valid_json_extracts_descriptions(self):
        import json as _json

        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = (
            _json.dumps(_CUSTOMER_PROFILES_JSON),
        )

        result = _fetch_nested_descriptions_via_describe_json(
            connection, "db", "schema", "customer_profiles"
        )
        assert ("first_name",) in result["personal_info"]
        assert result["personal_info"][("first_name",)] == "Customer first name"


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
        assert children_by_name["first_name"].description == Markdown(
            root="Customer first name"
        )
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
