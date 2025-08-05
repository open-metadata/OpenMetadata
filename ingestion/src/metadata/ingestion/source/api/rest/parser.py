#  Copyright 2024 Collate
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
OpenAPI schema parser for both JSON and YAML formats
"""
import json
from typing import Any, Dict, Optional

import yaml
from requests.models import Response

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class OpenAPIParseError(Exception):
    """
    Exception raised when OpenAPI schema cannot be parsed as either JSON or YAML
    """


def parse_openapi_schema(response: Response) -> Dict[str, Any]:
    """
    Parse OpenAPI schema from HTTP response.
    Supports both JSON and YAML formats.
    
    Args:
        response: HTTP response containing OpenAPI schema
        
    Returns:
        Parsed OpenAPI schema as dictionary
        
    Raises:
        OpenAPIParseError: If content cannot be parsed as either JSON or YAML
    """
    content = response.text
    content_type = response.headers.get('content-type', '').lower()
    
    # Try to determine format from content-type header
    if 'json' in content_type:
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse as JSON despite content-type: {e}")
    elif 'yaml' in content_type or 'yml' in content_type:
        try:
            return yaml.safe_load(content)
        except yaml.YAMLError as e:
            logger.warning(f"Failed to parse as YAML despite content-type: {e}")
    
    # If content-type is not definitive or parsing failed, try both formats
    
    # First try JSON (backward compatibility)
    try:
        parsed = json.loads(content)
        logger.debug("Successfully parsed OpenAPI schema as JSON")
        return parsed
    except json.JSONDecodeError:
        logger.debug("Content is not valid JSON, trying YAML")
    
    # Then try YAML
    try:
        parsed = yaml.safe_load(content)
        if parsed is None:
            raise OpenAPIParseError("YAML parsing returned None")
        logger.debug("Successfully parsed OpenAPI schema as YAML")
        return parsed
    except yaml.YAMLError as e:
        logger.error(f"Failed to parse as YAML: {e}")
    
    # If both formats fail, raise an error
    raise OpenAPIParseError(
        "Failed to parse OpenAPI schema as either JSON or YAML. "
        "Please ensure the schema is valid OpenAPI specification."
    )


def validate_openapi_schema(schema: Dict[str, Any]) -> bool:
    """
    Validate that the parsed schema is a valid OpenAPI specification.
    
    Args:
        schema: Parsed schema dictionary
        
    Returns:
        True if schema appears to be valid OpenAPI, False otherwise
    """
    # Check for required OpenAPI fields
    if not isinstance(schema, dict):
        return False
    
    # OpenAPI 3.x uses "openapi" field, OpenAPI 2.x uses "swagger" field
    return schema.get("openapi") is not None or schema.get("swagger") is not None