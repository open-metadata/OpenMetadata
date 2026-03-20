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
import re
from pathlib import Path
from typing import Any, Dict, Union
from urllib.parse import urlparse

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
    content_type = response.headers.get("content-type", "").lower()

    # Try to determine format from content-type header
    if "json" in content_type:
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse as JSON despite content-type: {e}")
    elif "yaml" in content_type or "yml" in content_type:
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


def parse_openapi_schema_from_file(file_path: Union[str, Path]) -> Dict[str, Any]:
    """
    Parse OpenAPI schema from a local file.
    Supports both JSON and YAML formats.
    """
    path = Path(file_path)
    if not path.exists():
        raise OpenAPIParseError(f"File not found: {file_path}")
    if not path.is_file():
        raise OpenAPIParseError(f"Path is not a file: {file_path}")

    content = path.read_text(encoding="utf-8")
    suffix = path.suffix.lower()

    if suffix in (".json",):
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            raise OpenAPIParseError(f"Failed to parse JSON file: {e}") from e

    if suffix in (".yaml", ".yml"):
        try:
            parsed = yaml.safe_load(content)
            if parsed is None:
                raise OpenAPIParseError("YAML parsing returned None")
            return parsed
        except yaml.YAMLError as e:
            raise OpenAPIParseError(f"Failed to parse YAML file: {e}") from e

    # Unknown extension — try JSON first, then YAML
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    try:
        parsed = yaml.safe_load(content)
        if parsed is None:
            raise OpenAPIParseError("YAML parsing returned None")
        return parsed
    except yaml.YAMLError:
        pass

    raise OpenAPIParseError(f"Failed to parse '{file_path}' as either JSON or YAML.")


def _parse_s3_url(s3_url: str) -> tuple:
    """
    Parse an S3 URL into bucket and key.
    Supports both virtual-hosted and path-style URLs:
      - https://bucket.s3.amazonaws.com/key
      - https://bucket.s3.region.amazonaws.com/key
      - https://s3.amazonaws.com/bucket/key
      - https://s3.region.amazonaws.com/bucket/key
    """
    parsed = urlparse(s3_url)
    host = parsed.hostname or ""

    # Virtual-hosted style: bucket.s3[.region].amazonaws.com
    virtual_match = re.match(r"^(.+)\.s3(?:[.\-](.+))?\.amazonaws\.com$", host)
    if virtual_match:
        bucket = virtual_match.group(1)
        key = parsed.path.lstrip("/")
        if not key:
            raise OpenAPIParseError(
                f"S3 URL '{s3_url}' is missing the object key. "
                "Expected format: https://bucket.s3.amazonaws.com/path/to/file"
            )
        return bucket, key

    # Path-style: s3[.region].amazonaws.com/bucket/key
    path_match = re.match(r"^s3(?:[.\-](.+))?\.amazonaws\.com$", host)
    if path_match:
        parts = parsed.path.lstrip("/").split("/", 1)
        if len(parts) == 2:
            return parts[0], parts[1]
        raise OpenAPIParseError(
            f"S3 URL '{s3_url}' is missing the object key. "
            "Expected format: https://s3.amazonaws.com/bucket/path/to/file"
        )

    raise OpenAPIParseError(
        f"Unable to parse S3 URL '{s3_url}'. "
        "Expected format: https://bucket.s3.amazonaws.com/path/to/file"
    )


def parse_openapi_schema_from_s3(
    s3_url: str,
    aws_credentials: "AWSCredentials",
) -> Dict[str, Any]:
    """
    Download and parse an OpenAPI schema file from S3.
    Supports both JSON and YAML formats.
    """
    from metadata.clients.aws_client import AWSClient

    bucket, key = _parse_s3_url(s3_url)

    client = AWSClient(aws_credentials)
    s3_client = client.get_s3_client()

    try:
        response = s3_client.get_object(Bucket=bucket, Key=key)
        content = response["Body"].read().decode("utf-8")
    except Exception as e:
        raise OpenAPIParseError(
            f"Failed to download S3 object s3://{bucket}/{key}: {e}"
        ) from e

    suffix = Path(key).suffix.lower()

    if suffix in (".json",):
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            raise OpenAPIParseError(f"Failed to parse S3 JSON file: {e}") from e

    if suffix in (".yaml", ".yml"):
        try:
            parsed = yaml.safe_load(content)
            if parsed is None:
                raise OpenAPIParseError("YAML parsing returned None")
            return parsed
        except yaml.YAMLError as e:
            raise OpenAPIParseError(f"Failed to parse S3 YAML file: {e}") from e

    # Unknown extension — try JSON first, then YAML
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    try:
        parsed = yaml.safe_load(content)
        if parsed is None:
            raise OpenAPIParseError("YAML parsing returned None")
        return parsed
    except yaml.YAMLError:
        pass

    raise OpenAPIParseError(f"Failed to parse S3 file '{key}' as either JSON or YAML.")
