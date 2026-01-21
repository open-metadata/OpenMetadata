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
