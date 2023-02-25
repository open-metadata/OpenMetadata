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
from typing import List, Optional

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


def parse_json_schema(schema_text: str) -> Optional[List[FieldModel]]:
    """
    Method to parse the jsonschema
    """
    try:
        json_schema_data = json.loads(schema_text)
        field_models = get_json_schema_fields(json_schema_data.get("properties"))
        return field_models
    except Exception as exc:  # pylint: disable=broad-except
        logger.debug(traceback.format_exc())
        logger.warning(f"Unable to parse the jsonschema: {exc}")
    return None


def get_json_schema_fields(properties) -> Optional[List[FieldModel]]:
    """
    Recursively convert the parsed schema into required models
    """
    field_models = []
    for key, value in properties.items():
        try:
            field_models.append(
                FieldModel(
                    name=value.get("title", key),
                    dataType=JsonSchemaDataTypes(value.get("type")).name,
                    description=value.get("description"),
                    children=get_json_schema_fields(value.get("properties"))
                    if value.get("type") == "object"
                    else None,
                )
            )
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to parse the json schema into models: {exc}")

    return field_models
