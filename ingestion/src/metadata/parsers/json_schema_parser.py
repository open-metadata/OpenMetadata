#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Utils module to parse the jsonschema
"""

import json
import traceback
from enum import Enum
from typing import List, Optional, Tuple, Type

from pydantic import BaseModel

from metadata.generated.schema.type.schema import FieldModel
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class JsonSchemaDataTypes(Enum):
    """
    Enum for Json Schema Datatypes
    """

    STRING = "string"
    FLOAT = "number"
    INT = "integer"
    BOOLEAN = "boolean"
    NULL = "null"
    RECORD = "object"
    ARRAY = "array"
    UNKNOWN = "unknown"


def parse_json_schema(
    schema_text: str, cls: Type[BaseModel] = FieldModel
) -> Optional[List[FieldModel]]:
    """
    Method to parse the jsonschema
    """
    try:
        json_schema_data = json.loads(schema_text)
        field_models = [
            cls(
                name=json_schema_data.get("title", "default"),
                dataType=JsonSchemaDataTypes(json_schema_data.get("type")).name,
                description=json_schema_data.get("description"),
                children=get_json_schema_fields(
                    json_schema_data.get("properties", {}), cls=cls
                ),
            )
        ]
        return field_models
    except Exception as exc:  # pylint: disable=broad-except
        logger.debug(traceback.format_exc())
        logger.warning(f"Unable to parse the jsonschema: {exc}")
    return None


def get_child_models(key, value, field_models, cls: Type[BaseModel] = FieldModel):
    """
    Method to parse the child objects in the json schema
    """
    try:
        cls_obj = cls(
            name=key,
            displayName=value.get("title"),
            dataType=JsonSchemaDataTypes(value.get("type", "unknown")).name,
            description=value.get("description"),
        )
        children = None
        if value.get("type") == JsonSchemaDataTypes.RECORD.value:
            children = get_json_schema_fields(value.get("properties"), cls=cls)
        if value.get("type") == JsonSchemaDataTypes.ARRAY.value:
            datatype_display, children = get_json_schema_array_fields(
                value.get("items"), cls=cls
            )
            cls_obj.dataTypeDisplay = f"ARRAY<{datatype_display}>"
        cls_obj.children = children
        field_models.append(cls_obj)
    except Exception as exc:  # pylint: disable=broad-except
        logger.debug(traceback.format_exc())
        logger.warning(f"Unable to parse the json schema into models: {exc}")


def get_json_schema_array_fields(
    array_items, cls: Type[BaseModel] = FieldModel
) -> Optional[Tuple[str, List[FieldModel]]]:
    """
    Recursively convert the parsed array schema into required models
    """
    field_models = []
    if array_items.get("type") == JsonSchemaDataTypes.RECORD.value:
        for key, value in array_items.get("properties", {}).items():
            get_child_models(key, value, field_models, cls)

    return (
        JsonSchemaDataTypes(array_items.get("type", "unknown")).name,
        field_models or None,
    )


def get_json_schema_fields(
    properties, cls: Type[BaseModel] = FieldModel
) -> Optional[List[FieldModel]]:
    """
    Recursively convert the parsed schema into required models
    """
    field_models = []
    for key, value in properties.items():
        get_child_models(key, value, field_models, cls)

    return field_models
