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
from typing import Optional

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def parse_json_schema(schema_text: str) -> Optional[dict]:
    """
    Method to parse the jsonschema
    """
    try:
        json_schema_data = json.loads(schema_text)
        properties = json_schema_data.get("properties")
        parsed_schema = {}
        parsed_schema["name"] = json_schema_data.get("title")
        parsed_schema["type"] = json_schema_data.get("type")
        parsed_schema["fields"] = []

        for key, value in properties.items():
            field = {
                "name": key,
                "type": value.get("type"),
                "description": value.get("description"),
            }
            parsed_schema["fields"].append(field)

        return parsed_schema
    except Exception as exc:  # pylint: disable=broad-except
        logger.debug(traceback.format_exc())
        logger.warning(f"Unable to parse the jsonschema: {exc}")
    return None
