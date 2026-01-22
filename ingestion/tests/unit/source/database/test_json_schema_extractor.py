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
Unit tests for JSON schema extraction from sampled data.
"""
import json

from metadata.generated.schema.entity.data.table import DataType
from metadata.ingestion.source.database.json_schema_extractor import (
    _build_column_children,
    _build_json_schema,
    _merge_json_structures,
    _parse_json_values,
    infer_json_schema_from_sample,
)


class TestParseJsonValues:
    """Tests for _parse_json_values function."""

    def test_parse_dict_values(self):
        """Test parsing already-parsed dict values."""
        values = [{"name": "John"}, {"name": "Jane"}]
        result = _parse_json_values(values)
        assert len(result) == 2
        assert result[0] == {"name": "John"}
        assert result[1] == {"name": "Jane"}

    def test_parse_string_json_values(self):
        """Test parsing JSON string values."""
        values = ['{"name": "John"}', '{"name": "Jane"}']
        result = _parse_json_values(values)
        assert len(result) == 2
        assert result[0] == {"name": "John"}
        assert result[1] == {"name": "Jane"}

    def test_parse_mixed_values(self):
        """Test parsing mixed dict and string values."""
        values = [{"name": "John"}, '{"name": "Jane"}']
        result = _parse_json_values(values)
        assert len(result) == 2

    def test_filter_none_values(self):
        """Test that None values are filtered out."""
        values = [{"name": "John"}, None, {"name": "Jane"}]
        result = _parse_json_values(values)
        assert len(result) == 2

    def test_filter_non_dict_values(self):
        """Test that non-dict JSON values are filtered out."""
        values = [{"name": "John"}, '"just a string"', "[1, 2, 3]"]
        result = _parse_json_values(values)
        assert len(result) == 1
        assert result[0] == {"name": "John"}

    def test_handle_invalid_json(self):
        """Test that invalid JSON strings are filtered out."""
        values = [{"name": "John"}, "not valid json", '{"name": "Jane"}']
        result = _parse_json_values(values)
        assert len(result) == 2

    def test_empty_list(self):
        """Test handling empty list."""
        result = _parse_json_values([])
        assert result == []


class TestMergeJsonStructures:
    """Tests for _merge_json_structures function."""

    def test_merge_simple_objects(self):
        """Test merging simple objects with same keys."""
        dicts = [{"name": "John", "age": 30}, {"name": "Jane", "age": 25}]
        result = _merge_json_structures(dicts)
        assert "name" in result
        assert "age" in result

    def test_merge_objects_with_different_keys(self):
        """Test merging objects with different keys."""
        dicts = [{"name": "John"}, {"age": 30}, {"city": "NYC"}]
        result = _merge_json_structures(dicts)
        assert "name" in result
        assert "age" in result
        assert "city" in result

    def test_merge_nested_objects(self):
        """Test merging nested objects."""
        dicts = [
            {"user": {"name": "John"}},
            {"user": {"age": 30}},
        ]
        result = _merge_json_structures(dicts)
        assert "user" in result
        assert isinstance(result["user"], dict)
        assert "name" in result["user"]
        assert "age" in result["user"]

    def test_merge_with_arrays(self):
        """Test merging objects containing arrays."""
        dicts = [
            {"tags": ["python", "java"]},
            {"tags": ["javascript"]},
        ]
        result = _merge_json_structures(dicts)
        assert "tags" in result
        assert isinstance(result["tags"], list)

    def test_merge_array_of_objects(self):
        """Test merging arrays containing objects."""
        dicts = [
            {"items": [{"id": 1}]},
            {"items": [{"name": "Item 2"}]},
        ]
        result = _merge_json_structures(dicts)
        assert "items" in result
        assert isinstance(result["items"], list)
        assert len(result["items"]) == 1
        assert "id" in result["items"][0]
        assert "name" in result["items"][0]

    def test_dict_takes_precedence_over_scalar(self):
        """Test that dict value takes precedence over scalar."""
        dicts = [
            {"field": "string_value"},
            {"field": {"nested": "value"}},
        ]
        result = _merge_json_structures(dicts)
        assert isinstance(result["field"], dict)
        assert result["field"]["nested"] == "value"

    def test_handle_null_values(self):
        """Test handling null values in objects."""
        dicts = [
            {"name": "John", "email": None},
            {"name": "Jane", "email": "jane@example.com"},
        ]
        result = _merge_json_structures(dicts)
        assert "email" in result
        assert result["email"] == "jane@example.com"


class TestBuildJsonSchema:
    """Tests for _build_json_schema function."""

    def test_build_simple_object_schema(self):
        """Test building schema for simple object."""
        structure = {"name": "John", "age": 30}
        schema = _build_json_schema(structure)
        assert schema["type"] == "object"
        assert "properties" in schema
        assert schema["properties"]["name"]["type"] == "string"
        assert schema["properties"]["age"]["type"] == "integer"

    def test_build_nested_object_schema(self):
        """Test building schema for nested object."""
        structure = {"user": {"name": "John"}}
        schema = _build_json_schema(structure)
        assert schema["type"] == "object"
        assert schema["properties"]["user"]["type"] == "object"
        assert schema["properties"]["user"]["properties"]["name"]["type"] == "string"

    def test_build_array_schema(self):
        """Test building schema for array."""
        structure = {"tags": ["python"]}
        schema = _build_json_schema(structure)
        assert schema["properties"]["tags"]["type"] == "array"
        assert schema["properties"]["tags"]["items"]["type"] == "string"

    def test_build_array_of_objects_schema(self):
        """Test building schema for array of objects."""
        structure = {"items": [{"id": 1, "name": "test"}]}
        schema = _build_json_schema(structure)
        assert schema["properties"]["items"]["type"] == "array"
        assert schema["properties"]["items"]["items"]["type"] == "object"
        assert "id" in schema["properties"]["items"]["items"]["properties"]

    def test_build_schema_with_boolean(self):
        """Test building schema with boolean type."""
        structure = {"active": True}
        schema = _build_json_schema(structure)
        assert schema["properties"]["active"]["type"] == "boolean"

    def test_build_schema_with_float(self):
        """Test building schema with float type."""
        structure = {"price": 19.99}
        schema = _build_json_schema(structure)
        assert schema["properties"]["price"]["type"] == "number"

    def test_build_schema_with_null(self):
        """Test building schema with null type."""
        structure = {"value": None}
        schema = _build_json_schema(structure)
        assert schema["properties"]["value"]["type"] == "null"


class TestBuildColumnChildren:
    """Tests for _build_column_children function."""

    def test_build_simple_children(self):
        """Test building children for simple structure."""
        structure = {"name": "John", "age": 30}
        children = _build_column_children(structure)
        assert children is not None
        assert len(children) == 2

        names = {child.name.root for child in children}
        assert "name" in names
        assert "age" in names

    def test_build_nested_children(self):
        """Test building children with nested objects."""
        structure = {"user": {"name": "John", "email": "john@example.com"}}
        children = _build_column_children(structure)
        assert children is not None
        assert len(children) == 1

        user_child = children[0]
        assert user_child.name.root == "user"
        assert user_child.dataType == DataType.JSON
        assert user_child.children is not None
        assert len(user_child.children) == 2

    def test_build_array_children(self):
        """Test building children with array type."""
        structure = {"tags": ["python", "java"]}
        children = _build_column_children(structure)
        assert children is not None

        tags_child = children[0]
        assert tags_child.name.root == "tags"
        assert tags_child.dataType == DataType.ARRAY
        assert tags_child.arrayDataType == DataType.STRING

    def test_build_array_of_objects_children(self):
        """Test building children for array of objects."""
        structure = {"items": [{"id": 1, "name": "test"}]}
        children = _build_column_children(structure)
        assert children is not None

        items_child = children[0]
        assert items_child.name.root == "items"
        assert items_child.dataType == DataType.ARRAY
        assert items_child.arrayDataType == DataType.JSON
        assert items_child.children is not None
        assert len(items_child.children) == 2

    def test_returns_none_for_non_dict(self):
        """Test that non-dict input returns None."""
        result = _build_column_children("not a dict")
        assert result is None


class TestInferJsonSchemaFromSample:
    """Tests for the main infer_json_schema_from_sample function."""

    def test_infer_schema_basic(self):
        """Test basic schema inference."""
        json_values = [
            {"name": "John", "age": 30},
            {"name": "Jane", "age": 25},
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert schema["type"] == "object"
        assert "name" in schema["properties"]
        assert "age" in schema["properties"]

        assert children is not None
        assert len(children) == 2

    def test_infer_schema_from_json_strings(self):
        """Test schema inference from JSON strings."""
        json_values = [
            '{"product": "laptop", "price": 999.99}',
            '{"product": "mouse", "price": 29.99}',
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        assert children is not None

        schema = json.loads(schema_str)
        assert schema["properties"]["product"]["type"] == "string"
        assert schema["properties"]["price"]["type"] == "number"

    def test_infer_schema_nested_structure(self):
        """Test schema inference for nested structures."""
        json_values = [
            {
                "user": {"name": "John", "email": "john@example.com"},
                "active": True,
            }
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert schema["properties"]["user"]["type"] == "object"
        assert "name" in schema["properties"]["user"]["properties"]

    def test_infer_schema_with_arrays(self):
        """Test schema inference for arrays."""
        json_values = [
            {"tags": ["python", "data"], "scores": [85, 90, 95]},
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert schema["properties"]["tags"]["type"] == "array"
        assert schema["properties"]["scores"]["type"] == "array"

    def test_infer_schema_empty_list(self):
        """Test that empty list returns None."""
        schema_str, children = infer_json_schema_from_sample([])
        assert schema_str is None
        assert children is None

    def test_infer_schema_all_none(self):
        """Test that list of all None values returns None."""
        schema_str, children = infer_json_schema_from_sample([None, None])
        assert schema_str is None
        assert children is None

    def test_infer_schema_all_invalid(self):
        """Test that list of all invalid JSON returns None."""
        json_values = ["not json", "also not json"]
        schema_str, children = infer_json_schema_from_sample(json_values)
        assert schema_str is None
        assert children is None

    def test_infer_schema_handles_mixed_valid_invalid(self):
        """Test that valid values are processed even with some invalid ones."""
        json_values = [
            {"name": "John"},
            "invalid json",
            None,
            {"name": "Jane", "age": 25},
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert "name" in schema["properties"]
        assert "age" in schema["properties"]

    def test_infer_schema_real_world_event_data(self):
        """Test with realistic event data structure."""
        json_values = [
            {
                "ab_test_group": "group_1",
                "campaign_id": "cmp_01",
                "user_agent": "Mozilla/5.0",
            },
            {
                "ab_test_group": "group_2",
                "campaign_id": "cmp_02",
                "amount_cents": 5000,
            },
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert "ab_test_group" in schema["properties"]
        assert "campaign_id" in schema["properties"]
        assert "user_agent" in schema["properties"]
        assert "amount_cents" in schema["properties"]

    def test_infer_schema_deeply_nested(self):
        """Test with deeply nested structure."""
        json_values = [{"level1": {"level2": {"level3": {"value": "deep"}}}}]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert schema["properties"]["level1"]["type"] == "object"
        level2_props = schema["properties"]["level1"]["properties"]["level2"]
        assert level2_props["type"] == "object"
        level3_props = level2_props["properties"]["level3"]
        assert level3_props["type"] == "object"
        assert level3_props["properties"]["value"]["type"] == "string"


class TestJsonSchemaExtractionEdgeCases:
    """Edge case tests for JSON schema extraction."""

    def test_empty_object(self):
        """Test handling empty JSON objects."""
        json_values = [{}]
        schema_str, children = infer_json_schema_from_sample(json_values)
        assert schema_str is not None
        schema = json.loads(schema_str)
        assert schema["type"] == "object"
        assert schema["properties"] == {}

    def test_special_characters_in_keys(self):
        """Test handling special characters in JSON keys."""
        json_values = [{"user-name": "John", "email@domain": "test@test.com"}]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        assert children is not None

    def test_unicode_values(self):
        """Test handling unicode values."""
        json_values = [{"name": "日本語", "emoji": "🎉"}]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        assert children is not None

    def test_large_numbers(self):
        """Test handling large numbers."""
        json_values = [
            {"big_int": 9999999999999999, "big_float": 1.7976931348623157e308}
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None


class TestJsonColumnTypeDetection:
    """Tests for JSON schema extraction with different column types."""

    def test_json_column_type_json_datatype(self):
        """Test JSON schema extraction for DataType.JSON columns."""
        json_values = [
            {"user_id": 123, "preferences": {"theme": "dark"}},
            {"user_id": 456, "preferences": {"theme": "light", "language": "en"}},
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert schema["type"] == "object"
        assert "user_id" in schema["properties"]
        assert "preferences" in schema["properties"]
        assert schema["properties"]["preferences"]["type"] == "object"

        assert children is not None
        child_names = {child.name.root for child in children}
        assert "user_id" in child_names
        assert "preferences" in child_names

    def test_json_column_type_jsonb(self):
        """Test JSON schema extraction for JSONB columns (PostgreSQL)."""
        json_values = [
            {"metadata": {"created_at": "2024-01-01", "updated_at": "2024-01-02"}},
            {"metadata": {"created_at": "2024-02-01", "version": 2}},
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert "metadata" in schema["properties"]
        assert children is not None

    def test_json_column_type_variant(self):
        """Test JSON schema extraction for VARIANT columns (Snowflake)."""
        json_values = [
            {"event_type": "click", "payload": {"x": 100, "y": 200}},
            {"event_type": "scroll", "payload": {"direction": "down", "amount": 50}},
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert "event_type" in schema["properties"]
        assert "payload" in schema["properties"]
        assert children is not None

    def test_json_column_type_object(self):
        """Test JSON schema extraction for OBJECT columns (Snowflake/Databricks)."""
        json_values = [
            {"config": {"enabled": True, "max_retries": 3}},
            {"config": {"enabled": False, "timeout": 30}},
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert "config" in schema["properties"]
        assert children is not None


class TestStringColumnTypeAsJson:
    """Tests for JSON schema extraction from STRING type columns containing JSON data."""

    def test_string_column_with_json_data(self):
        """Test JSON schema extraction from STRING columns containing JSON."""
        json_values = [
            '{"name": "Alice", "score": 95}',
            '{"name": "Bob", "score": 87}',
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert schema["type"] == "object"
        assert "name" in schema["properties"]
        assert "score" in schema["properties"]
        assert schema["properties"]["name"]["type"] == "string"
        assert schema["properties"]["score"]["type"] == "integer"

        assert children is not None
        child_names = {child.name.root for child in children}
        assert "name" in child_names
        assert "score" in child_names

    def test_varchar_column_with_json_data(self):
        """Test JSON schema extraction from VARCHAR columns containing JSON."""
        json_values = [
            '{"product": "laptop", "price": 999.99, "in_stock": true}',
            '{"product": "mouse", "price": 29.99, "in_stock": false}',
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert "product" in schema["properties"]
        assert "price" in schema["properties"]
        assert "in_stock" in schema["properties"]
        assert schema["properties"]["price"]["type"] == "number"
        assert schema["properties"]["in_stock"]["type"] == "boolean"

    def test_text_column_with_json_data(self):
        """Test JSON schema extraction from TEXT columns containing JSON."""
        json_values = [
            '{"log_level": "INFO", "message": "Application started", "timestamp": 1704067200}',
            '{"log_level": "ERROR", "message": "Connection failed", "details": {"code": 500}}',
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert "log_level" in schema["properties"]
        assert "message" in schema["properties"]
        assert "details" in schema["properties"]

        assert children is not None

    def test_string_column_with_nested_json(self):
        """Test JSON schema extraction from STRING columns with deeply nested JSON."""
        json_values = [
            '{"user": {"profile": {"address": {"city": "NYC", "zip": "10001"}}}}',
            '{"user": {"profile": {"address": {"city": "LA", "state": "CA"}}}}',
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert "user" in schema["properties"]
        user_props = schema["properties"]["user"]
        assert user_props["type"] == "object"
        assert "profile" in user_props["properties"]

        assert children is not None
        user_child = next(c for c in children if c.name.root == "user")
        assert user_child.dataType == DataType.JSON
        assert user_child.children is not None

    def test_string_column_with_array_json(self):
        """Test JSON schema extraction from STRING columns with JSON arrays."""
        json_values = [
            '{"items": [{"id": 1, "name": "Item 1"}, {"id": 2, "name": "Item 2"}]}',
            '{"items": [{"id": 3, "name": "Item 3", "price": 10.99}]}',
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert "items" in schema["properties"]
        items_schema = schema["properties"]["items"]
        assert items_schema["type"] == "array"
        assert items_schema["items"]["type"] == "object"

        assert children is not None
        items_child = next(c for c in children if c.name.root == "items")
        assert items_child.dataType == DataType.ARRAY
        assert items_child.arrayDataType == DataType.JSON

    def test_string_column_with_mixed_valid_invalid_json(self):
        """Test STRING column where some values are valid JSON and some are not."""
        json_values = [
            '{"valid": true}',
            "plain text not json",
            '{"also_valid": 123}',
            None,
            "",
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert "valid" in schema["properties"]
        assert "also_valid" in schema["properties"]

    def test_string_column_all_invalid_json(self):
        """Test STRING column where all values are invalid JSON."""
        json_values = [
            "plain text",
            "another plain text",
            "not json at all",
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is None
        assert children is None

    def test_string_column_with_json_primitives(self):
        """Test STRING column with JSON primitives (not objects) - should be filtered."""
        json_values = [
            '"just a string"',
            "123",
            "true",
            "[1, 2, 3]",
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is None
        assert children is None


class TestAllJsonColumnTypes:
    """Comprehensive tests covering all JSON_COLUMN_TYPES defined in sql_column_handler.py."""

    def test_all_json_types_with_complex_structure(self):
        """Test that all JSON column types can handle complex nested structures."""
        complex_json = [
            {
                "id": 1,
                "name": "Test",
                "attributes": {
                    "color": "red",
                    "size": "large",
                    "tags": ["tag1", "tag2"],
                },
                "measurements": [
                    {"width": 10, "height": 20},
                    {"width": 15, "height": 25},
                ],
                "metadata": {
                    "created": "2024-01-01",
                    "nested": {"level1": {"level2": {"value": 42}}},
                },
                "active": True,
                "score": 98.5,
                "nullable_field": None,
            }
        ]
        schema_str, children = infer_json_schema_from_sample(complex_json)

        assert schema_str is not None
        schema = json.loads(schema_str)

        assert schema["properties"]["id"]["type"] == "integer"
        assert schema["properties"]["name"]["type"] == "string"
        assert schema["properties"]["attributes"]["type"] == "object"
        assert schema["properties"]["measurements"]["type"] == "array"
        assert schema["properties"]["metadata"]["type"] == "object"
        assert schema["properties"]["active"]["type"] == "boolean"
        assert schema["properties"]["score"]["type"] == "number"
        assert schema["properties"]["nullable_field"]["type"] == "null"

        assert children is not None
        child_names = {c.name.root for c in children}
        assert child_names == {
            "id",
            "name",
            "attributes",
            "measurements",
            "metadata",
            "active",
            "score",
            "nullable_field",
        }

    def test_json_type_with_empty_objects_and_arrays(self):
        """Test JSON columns with empty objects and arrays."""
        json_values = [
            {"empty_obj": {}, "empty_arr": [], "normal": "value"},
            {"empty_obj": {"key": "value"}, "empty_arr": [1, 2], "normal": "other"},
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert "empty_obj" in schema["properties"]
        assert "empty_arr" in schema["properties"]
        assert "normal" in schema["properties"]

    def test_jsonb_type_with_special_postgres_patterns(self):
        """Test JSONB columns with patterns common in PostgreSQL."""
        json_values = [
            {
                "audit_log": {
                    "action": "UPDATE",
                    "old_values": {"status": "pending"},
                    "new_values": {"status": "completed"},
                    "changed_by": "user_123",
                }
            },
            {
                "audit_log": {
                    "action": "INSERT",
                    "new_values": {"id": 456, "name": "New Record"},
                    "changed_by": "system",
                }
            },
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        audit_props = schema["properties"]["audit_log"]["properties"]
        assert "action" in audit_props
        assert "old_values" in audit_props
        assert "new_values" in audit_props
        assert "changed_by" in audit_props

    def test_variant_type_with_semi_structured_data(self):
        """Test VARIANT columns with semi-structured data (Snowflake pattern)."""
        json_values = [
            {
                "raw_event": {
                    "event_id": "evt_001",
                    "timestamp": "2024-01-15T10:30:00Z",
                    "properties": {"source": "web", "browser": "Chrome"},
                }
            },
            {
                "raw_event": {
                    "event_id": "evt_002",
                    "timestamp": "2024-01-15T10:31:00Z",
                    "properties": {"source": "mobile", "os": "iOS", "version": "17.0"},
                }
            },
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        event_props = schema["properties"]["raw_event"]["properties"]
        assert "event_id" in event_props
        assert "timestamp" in event_props
        assert "properties" in event_props

    def test_object_type_with_nested_structures(self):
        """Test OBJECT columns with nested structures (Databricks/Snowflake pattern)."""
        json_values = [
            {
                "customer": {
                    "id": 1001,
                    "details": {
                        "first_name": "John",
                        "last_name": "Doe",
                        "contacts": {
                            "email": "john@example.com",
                            "phones": ["+1-555-0100", "+1-555-0101"],
                        },
                    },
                }
            },
            {
                "customer": {
                    "id": 1002,
                    "details": {
                        "first_name": "Jane",
                        "last_name": "Smith",
                        "contacts": {"email": "jane@example.com"},
                    },
                }
            },
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        customer_schema = schema["properties"]["customer"]
        assert customer_schema["type"] == "object"
        details_schema = customer_schema["properties"]["details"]
        assert "first_name" in details_schema["properties"]
        assert "contacts" in details_schema["properties"]


class TestAllStringColumnTypes:
    """Comprehensive tests covering all STRING_COLUMN_TYPES defined in sql_column_handler.py."""

    def test_string_datatype_value(self):
        """Test DataType.STRING.value column with JSON data."""
        json_values = [
            {"field1": "value1", "field2": 100},
            {"field1": "value2", "field2": 200, "field3": True},
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert "field1" in schema["properties"]
        assert "field2" in schema["properties"]
        assert "field3" in schema["properties"]

    def test_string_literal_type(self):
        """Test literal 'STRING' type column with JSON data."""
        json_values = [
            '{"api_response": {"status": 200, "data": {"items": [1, 2, 3]}}}',
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert "api_response" in schema["properties"]
        api_response = schema["properties"]["api_response"]
        assert "status" in api_response["properties"]
        assert "data" in api_response["properties"]

    def test_varchar_type_with_various_lengths(self):
        """Test VARCHAR type columns with JSON of various complexities."""
        short_json = [{"a": 1}]
        schema_str, children = infer_json_schema_from_sample(short_json)
        assert schema_str is not None

        long_json = [
            {
                "very_long_key_name_that_might_be_stored_in_varchar": {
                    "nested": {"deeply": {"structured": {"data": "value"}}}
                }
            }
        ]
        schema_str, children = infer_json_schema_from_sample(long_json)
        assert schema_str is not None
        schema = json.loads(schema_str)
        assert (
            "very_long_key_name_that_might_be_stored_in_varchar" in schema["properties"]
        )

    def test_text_type_with_large_json(self):
        """Test TEXT type columns that might store large JSON documents."""
        large_json = [
            {
                "document": {
                    "sections": [
                        {"title": f"Section {i}", "content": f"Content for section {i}"}
                        for i in range(10)
                    ],
                    "metadata": {
                        "author": "Test Author",
                        "created": "2024-01-01",
                        "tags": ["tag1", "tag2", "tag3"],
                    },
                }
            }
        ]
        schema_str, children = infer_json_schema_from_sample(large_json)

        assert schema_str is not None
        schema = json.loads(schema_str)
        doc_schema = schema["properties"]["document"]
        assert "sections" in doc_schema["properties"]
        assert "metadata" in doc_schema["properties"]

    def test_string_types_with_unicode_json(self):
        """Test STRING types with JSON containing unicode characters."""
        json_values = [
            {"name": "日本語テスト", "emoji": "🎉🚀", "special": "café résumé naïve"},
            {"name": "中文测试", "emoji": "✨💻", "special": "über straße"},
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        assert children is not None

    def test_string_types_with_escaped_json(self):
        """Test STRING types with JSON containing escaped characters."""
        json_values = [
            '{"path": "C:\\\\Users\\\\test", "quote": "\\"quoted\\"", "newline": "line1\\nline2"}',
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert "path" in schema["properties"]
        assert "quote" in schema["properties"]
        assert "newline" in schema["properties"]

    def test_string_types_with_numeric_keys(self):
        """Test STRING types with JSON containing numeric-like keys."""
        json_values = [
            {"123": "numeric key", "456abc": "mixed key", "normal_key": "value"},
        ]
        schema_str, children = infer_json_schema_from_sample(json_values)

        assert schema_str is not None
        schema = json.loads(schema_str)
        assert "123" in schema["properties"]
        assert "456abc" in schema["properties"]
        assert "normal_key" in schema["properties"]
