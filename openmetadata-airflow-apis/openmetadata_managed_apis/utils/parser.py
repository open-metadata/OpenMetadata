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
Module to parse source connecetion config, to handle validation error
"""

from pydantic import ValidationError

from metadata.ingestion.api.parser import (
    HAS_INNER_CONNECTION,
    InvalidWorkflowException,
    _unsafe_parse_config,
    get_connection_class,
    get_service_type,
)
from openmetadata_managed_apis.utils.logger import utils_logger

logger = utils_logger()


def parse_validation_err(validation_error: ValidationError) -> str:
    """Render validation field locations without input values."""
    error_details = validation_error.errors()
    extra_error_types = {"extra_forbidden", "value_error.extra"}
    missing_error_types = {"missing", "value_error.missing"}

    extra_fields = [
        f"Extra parameter '{err.get('loc')[0]}'" if len(err.get("loc")) == 1 else f"Extra parameter in {err.get('loc')}"
        for err in error_details
        if err.get("type") in extra_error_types
    ]

    missing_fields = [
        f"Missing parameter '{err.get('loc')[0]}'"
        if len(err.get("loc")) == 1
        else f"Missing parameter in {err.get('loc')}"
        for err in error_details
        if err.get("type") in missing_error_types
    ]

    invalid_fields = [
        f"Invalid parameter value for '{err.get('loc')[0]}'"
        if len(err.get("loc")) == 1
        else f"Invalid parameter value for {err.get('loc')}"
        for err in error_details
        if err.get("type") not in extra_error_types | missing_error_types
    ]

    return "\n".join(extra_fields + missing_fields + invalid_fields)


def _parse_inner_connection(connection_dict: dict) -> None:
    """
    Parse the inner connection of the flagged connectors

    :param config_dict: JSON configuration
    """
    inner_source_type = connection_dict["connection"]["config"]["connection"]["type"]
    inner_service_type = get_service_type(inner_source_type)
    inner_connection_class = get_connection_class(inner_source_type, inner_service_type)
    _unsafe_parse_config(
        config=connection_dict["connection"]["config"]["connection"],
        cls=inner_connection_class,
        message="Error parsing the inner service connection",
    )


def parse_service_connection(connection_dict: dict) -> None:
    """
    Parse the service connection and raise any scoped
    errors during the validation process

    :param connection_dict: JSON configuration
    """
    # Unsafe access to the keys. Allow a KeyError if the config is not well formatted
    source_type = connection_dict["connection"]["config"].get("type")
    if source_type is None:
        raise InvalidWorkflowException("Missing type in the serviceConnection config")

    service_type = get_service_type(source_type)
    connection_class = get_connection_class(source_type, service_type)
    logger.debug("Parsing workflow configuration with %s", connection_class.__name__)

    if source_type in HAS_INNER_CONNECTION:
        # We will first parse the inner `connection` configuration
        _parse_inner_connection(connection_dict)

    # Parse the service connection dictionary with the scoped class
    _unsafe_parse_config(
        config=connection_dict["connection"]["config"],
        cls=connection_class,
        message="Error parsing the service connection",
    )
