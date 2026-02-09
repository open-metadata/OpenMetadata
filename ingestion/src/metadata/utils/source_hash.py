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
Source hash utils module

This module provides utilities for generating stable, deterministic hashes
from create request models. The hash is used to detect changes in metadata
between ingestion runs.

To ensure hash stability, this module:
1. Sorts lists by deterministic keys (e.g., columns by ordinalPosition or name)
2. Excludes volatile fields that may change between runs (e.g., href, deleted, inherited)
3. Normalizes DDL/SQL whitespace in schemaDefinition
"""

import hashlib
import json
import re
import traceback
from typing import Any, Dict, List, Optional, Union

from metadata.ingestion.ometa.ometa_api import C
from metadata.utils.logger import utils_logger

logger = utils_logger()


SOURCE_HASH_EXCLUDE_FIELDS = {
    "sourceHash": True,
}

VOLATILE_ENTITY_REFERENCE_FIELDS = {"href", "deleted", "inherited"}


def _normalize_whitespace(text: Optional[str]) -> Optional[str]:
    """
    Normalize whitespace in SQL/DDL text to ensure consistent hashing.
    - Collapses multiple whitespace characters into a single space
    - Trims leading/trailing whitespace
    """
    if text is None:
        return None
    return re.sub(r"\s+", " ", text.strip())


def _get_column_sort_key(column: Dict[str, Any]) -> tuple:
    """
    Get a sort key for a column dict.
    Prioritizes ordinalPosition if present, otherwise uses name.
    """
    ordinal = column.get("ordinalPosition")
    name = column.get("name", "")
    if isinstance(name, dict):
        name = name.get("root", name.get("__root__", ""))
    return (ordinal if ordinal is not None else float("inf"), str(name))


def _get_tag_sort_key(tag: Dict[str, Any]) -> str:
    """Get a sort key for a tag dict based on tagFQN."""
    tag_fqn = tag.get("tagFQN", "")
    if isinstance(tag_fqn, dict):
        tag_fqn = tag_fqn.get("root", tag_fqn.get("__root__", ""))
    return str(tag_fqn)


def _get_constraint_sort_key(constraint: Dict[str, Any]) -> tuple:
    """Get a sort key for a table constraint dict."""
    constraint_type = constraint.get("constraintType", "")
    columns = constraint.get("columns", [])
    columns_str = ",".join(sorted(columns)) if columns else ""
    return (str(constraint_type), columns_str)


def _get_entity_reference_sort_key(ref: Dict[str, Any]) -> str:
    """Get a sort key for an entity reference dict."""
    return str(ref.get("fullyQualifiedName") or ref.get("name") or ref.get("id") or "")


def _remove_volatile_fields(obj: Union[Dict, List, Any]) -> Union[Dict, List, Any]:
    """
    Recursively remove volatile fields from entity references and normalize data.
    This ensures that fields like href, deleted, inherited don't affect the hash.
    """
    if isinstance(obj, dict):  # pylint: disable=no-else-return
        result = {}
        for key, value in obj.items():
            if key in VOLATILE_ENTITY_REFERENCE_FIELDS:
                continue
            result[key] = _remove_volatile_fields(value)
        return result
    elif isinstance(obj, list):
        return [_remove_volatile_fields(item) for item in obj]
    return obj


def _sort_columns(columns: List[Any]) -> List[Any]:
    """
    Sort columns by ordinalPosition (if present) then by name.
    Also recursively sorts nested children columns.

    Handles both Column dict structures and simple string lists for backward compatibility.
    """
    if not columns:
        return columns

    if not isinstance(columns[0], dict):
        return sorted(columns, key=str)

    sorted_columns = sorted(columns, key=_get_column_sort_key)
    for col in sorted_columns:
        if col.get("children"):
            col["children"] = _sort_columns(col["children"])
        if col.get("tags"):
            col["tags"] = sorted(col["tags"], key=_get_tag_sort_key)
    return sorted_columns


def _normalize_for_hash(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize a create request dict to ensure deterministic hashing.

    This function:
    1. Sorts columns by ordinalPosition/name
    2. Sorts tags by tagFQN
    3. Sorts tableConstraints by type and columns
    4. Sorts owners by FQN/name/id
    5. Removes volatile EntityReference fields (href, deleted, inherited)
    6. Normalizes schemaDefinition whitespace
    """
    result = _remove_volatile_fields(data)

    if "columns" in result and isinstance(result["columns"], list):
        result["columns"] = _sort_columns(result["columns"])

    if "tags" in result and isinstance(result["tags"], list):
        result["tags"] = sorted(result["tags"], key=_get_tag_sort_key)

    if "tableConstraints" in result and isinstance(result["tableConstraints"], list):
        result["tableConstraints"] = sorted(
            result["tableConstraints"], key=_get_constraint_sort_key
        )

    if "owners" in result and isinstance(result["owners"], list):
        result["owners"] = sorted(result["owners"], key=_get_entity_reference_sort_key)

    if "schemaDefinition" in result and result["schemaDefinition"]:
        result["schemaDefinition"] = _normalize_whitespace(result["schemaDefinition"])

    return result


def generate_source_hash(
    create_request: C, exclude_fields: Optional[Dict] = None
) -> Optional[str]:
    """
    Given a create_request model convert it to a normalized json string
    and generate a stable hash value.

    The normalization process ensures hash stability by:
    - Sorting lists (columns, tags, constraints, owners) by deterministic keys
    - Removing volatile fields (href, deleted, inherited) from entity references
    - Normalizing whitespace in DDL/SQL definitions
    """
    try:
        final_exclude = dict(SOURCE_HASH_EXCLUDE_FIELDS)
        if exclude_fields:
            final_exclude.update(exclude_fields)

        request_dict = create_request.model_dump(exclude=final_exclude)

        normalized_dict = _normalize_for_hash(request_dict)

        normalized_json = json.dumps(normalized_dict, sort_keys=True, default=str)

        json_bytes = normalized_json.encode("utf-8")
        return hashlib.md5(json_bytes).hexdigest()

    except Exception as exc:
        logger.warning(f"Failed to generate source hash due to - {exc}")
        logger.debug(traceback.format_exc())
    return None
