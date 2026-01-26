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
Utility module to extract JSON schema from sampled JSON data.
"""
import json
import traceback
from typing import Any, Dict, List, Optional, Tuple, Union

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.ingestion.source.database.column_helpers import truncate_column_name
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Maximum size of a single JSON value to process (1MB)
MAX_JSON_VALUE_SIZE = 1024 * 1024

# Mapping from Python types to OpenMetadata DataTypes
_PYTHON_TYPE_TO_DATA_TYPE = {
    "str": DataType.STRING,
    "int": DataType.INT,
    "float": DataType.FLOAT,
    "bool": DataType.BOOLEAN,
    "NoneType": DataType.NULL,
    "dict": DataType.JSON,
    "list": DataType.ARRAY,
}

# Mapping from Python types to JSON Schema types
_PYTHON_TYPE_TO_JSON_SCHEMA = {
    "str": "string",
    "int": "integer",
    "float": "number",
    "bool": "boolean",
    "NoneType": "null",
    "dict": "object",
    "list": "array",
}


def infer_json_schema_from_sample(
    json_values: List[Any],
) -> Tuple[Optional[str], Optional[List[Column]]]:
    """
    Infer JSON schema from a list of JSON values (sampled from a column).

    Args:
        json_values: List of JSON values (can be dicts, strings that parse to JSON, or None)

    Returns:
        Tuple of (json_schema_string, list_of_child_columns)
        Returns (None, None) if schema cannot be inferred
    """
    if not json_values:
        return None, None

    try:
        parsed_values = _parse_json_values(json_values)
        if not parsed_values:
            return None, None

        merged_structure = _merge_json_structures(parsed_values)

        json_schema = _build_json_schema(merged_structure)
        children = _build_column_children(merged_structure)

        json_schema_str = json.dumps(json_schema) if json_schema else None
        return json_schema_str, children if children else None

    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Failed to infer JSON schema from sample data: {exc}")
        return None, None


def _parse_json_values(json_values: List[Any]) -> List[Dict]:
    """
    Parse JSON values into Python dicts.
    Handles both string JSON and already-parsed dicts.
    Filters out None, non-dict values, and oversized values.
    """
    parsed = []
    for value in json_values:
        if value is None:
            continue

        try:
            if isinstance(value, str):
                if len(value) > MAX_JSON_VALUE_SIZE:
                    logger.debug(
                        f"Skipping JSON value exceeding size limit: {len(value)} bytes"
                    )
                    continue
                parsed_value = json.loads(value)
            elif isinstance(value, dict):
                parsed_value = value
            else:
                continue

            if isinstance(parsed_value, dict):
                parsed.append(parsed_value)
        except (json.JSONDecodeError, TypeError):
            continue

    return parsed


def _merge_json_structures(dicts: List[Dict]) -> Dict:
    """
    Merge multiple JSON objects to create a unified structure
    that captures all unique keys and their types.

    For conflicting types, the last seen type wins, except:
    - If we see both dict and non-dict, dict takes precedence
    - Arrays capture the merged structure of their items
    """
    result = {}

    for dict_ in dicts:
        _merge_single_dict(result, dict_)

    return result


def _merge_single_dict(result: Dict, source: Dict) -> None:
    """Merge a single dict into the result structure."""
    for key, value in source.items():
        if value is None:
            if key not in result:
                result[key] = None
            continue

        if isinstance(value, dict):
            existing = result.get(key)
            if isinstance(existing, dict):
                _merge_single_dict(existing, value)
            else:
                result[key] = {}
                _merge_single_dict(result[key], value)

        elif isinstance(value, list):
            existing = result.get(key)
            if isinstance(existing, list):
                result[key] = _merge_array_items(existing, value)
            else:
                result[key] = _merge_array_items([], value)

        else:
            if key not in result or not isinstance(result.get(key), dict):
                result[key] = value


def _merge_array_items(existing_items: List, new_items: List) -> List:
    """
    Merge array items to capture the unified structure of array elements.
    Returns a list with a single representative item that captures all seen types.
    """
    all_items = existing_items + new_items

    dict_items = [item for item in all_items if isinstance(item, dict)]
    if dict_items:
        merged_dict = {}
        for item in dict_items:
            _merge_single_dict(merged_dict, item)
        return [merged_dict]

    for item in all_items:
        if item is not None:
            return [item]

    return []


def _build_json_schema(structure: Union[Dict, Any]) -> Dict:
    """
    Build a JSON Schema representation from the merged structure.
    """
    if isinstance(structure, dict):
        properties = {}
        for key, value in structure.items():
            properties[key] = _build_json_schema(value)

        return {
            "type": "object",
            "properties": properties,
        }

    elif isinstance(structure, list):
        if structure:
            items_schema = _build_json_schema(structure[0])
            return {
                "type": "array",
                "items": items_schema,
            }
        return {"type": "array", "items": {}}

    else:
        type_name = type(structure).__name__
        json_type = _PYTHON_TYPE_TO_JSON_SCHEMA.get(type_name, "string")
        return {"type": json_type}


def _build_column_children(
    structure: Dict, parent_name: Optional[str] = None
) -> Optional[List[Column]]:
    """
    Build Column children from the merged JSON structure.
    This creates a hierarchical representation suitable for the UI.
    """
    if not isinstance(structure, dict):
        return None

    children = []
    for key, value in structure.items():
        child = _create_child_column(key, value)
        if child:
            children.append(child)

    return children if children else None


def _create_child_column(key: str, value: Any) -> Optional[Column]:
    """Create a Column object for a JSON field."""
    try:
        type_name = type(value).__name__
        data_type = _PYTHON_TYPE_TO_DATA_TYPE.get(type_name, DataType.STRING)

        column_dict = {
            "name": truncate_column_name(key),
            "displayName": key,
            "dataType": data_type,
            "dataTypeDisplay": data_type.value.lower(),
        }

        if isinstance(value, dict):
            column_dict["dataType"] = DataType.JSON
            column_dict["dataTypeDisplay"] = "json"
            nested_children = _build_column_children(value)
            if nested_children:
                column_dict["children"] = nested_children

        elif isinstance(value, list):
            column_dict["dataType"] = DataType.ARRAY
            column_dict["dataTypeDisplay"] = "array"
            if value:
                first_item = value[0]
                item_type_name = type(first_item).__name__
                array_data_type = _PYTHON_TYPE_TO_DATA_TYPE.get(
                    item_type_name, DataType.STRING
                )
                column_dict["arrayDataType"] = array_data_type

                if isinstance(first_item, dict):
                    column_dict["arrayDataType"] = DataType.JSON
                    nested_children = _build_column_children(first_item)
                    if nested_children:
                        column_dict["children"] = nested_children

        return Column(**column_dict)

    except Exception as exc:
        logger.debug(f"Failed to create child column for key '{key}': {exc}")
        return None
