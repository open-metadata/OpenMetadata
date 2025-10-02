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
DBT utils methods.
"""
import re
import traceback
from datetime import datetime
from typing import Any, Dict, Optional, Tuple, Union

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.domains.domain import Domain
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.dbt.constants import (
    NONE_KEYWORDS_LIST,
    CompiledQueriesEnum,
    DbtCommonEnum,
    RawQueriesEnum,
)
from metadata.utils import entity_link
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def convert_java_to_python_format(java_format: str) -> str:
    """
    Convert Java date/time format pattern to Python strptime format.

    Args:
        java_format: Java format like "yyyy-MM-dd HH:mm:ss"

    Returns:
        Python format like "%Y-%m-%d %H:%M:%S"
    """
    mappings = {
        "yyyy": "%Y",
        "MM": "%m",
        "dd": "%d",
        "HH": "%H",
        "mm": "%M",
        "ss": "%S",
        "SSS": "%f",
        "SSSSSS": "%f",
        "DDD": "%j",
        "MMM": "%b",
        "MMMM": "%B",
    }

    python_format = java_format
    # Sort by length descending to replace longer patterns first
    for java_pat, python_pat in sorted(
        mappings.items(), key=lambda x: len(x[0]), reverse=True
    ):
        python_format = python_format.replace(java_pat, python_pat)

    return python_format


def validate_email_format(email: str) -> bool:
    """
    Validate email format using the same pattern as OpenMetadata backend.

    Args:
        email: Email address to validate

    Returns:
        True if valid email format
    """
    # Pattern from OpenMetadata basic.json schema
    pattern = r"^[\S.!#$%&\'*+/=?^_`{|}~-]+@\S+\.\S+$"
    return bool(re.match(pattern, email))


def validate_date_time_format(
    value: str, format_pattern: str, field_type: str
) -> Tuple[bool, Optional[str]]:
    """
    Validate date/time value against configured format pattern.

    Args:
        value: Date/time string to validate
        format_pattern: Java format pattern (e.g., "yyyy-MM-dd")
        field_type: Type of field ("date-cp", "dateTime-cp", or "time-cp")

    Returns:
        Tuple[bool, Optional[str]]: (is_valid, error_message)
    """
    try:
        python_format = convert_java_to_python_format(format_pattern)
        datetime.strptime(value, python_format)
        return True, None
    except ValueError as exc:
        return (
            False,
            f"Invalid format. Expected '{format_pattern}', example: '2024-01-15'. Error: {str(exc)}",
        )
    except Exception as exc:
        return False, f"Validation error: {str(exc)}"


def validate_enum_value(
    value: Any, config: Optional[Dict]
) -> Tuple[bool, Optional[str], Optional[Any]]:
    """
    Validate enum value against configured allowed values.

    For multi-select enums with invalid values, filters out invalid values
    and returns valid ones with a warning message.

    Args:
        value: Single value or list of values
        config: Enum configuration with "values" and "multiSelect" keys

    Returns:
        Tuple[bool, Optional[str], Optional[Any]]: (is_valid, error_message, filtered_value)
            - is_valid: True if validation passed (has at least some valid values)
            - error_message: Warning or error message, None if no issues
            - filtered_value: The value after filtering invalid entries (for multi-select)
    """
    if not config or "values" not in config:
        return False, "No enum configuration or allowed values found", None

    allowed_values = config.get("values", [])
    multi_select = config.get("multiSelect", False)

    if isinstance(value, list):
        if not multi_select:
            return (
                False,
                f"Multi-select not allowed. Use single value from: {allowed_values}",
                None,
            )

        invalid_values = [v for v in value if v not in allowed_values]
        if invalid_values:
            # For multi-select, log warning but accept valid values
            valid_values = [v for v in value if v in allowed_values]
            if not valid_values:
                # All values are invalid - reject completely
                return (
                    False,
                    f"All values are invalid: {invalid_values}. Allowed values: {allowed_values}",
                    None,
                )
            # Some values are valid - accept with warning and return filtered list
            warning = f"Skipped invalid values: {invalid_values}. Allowed values: {allowed_values}"
            logger.warning(warning)
            return True, warning, valid_values  # ← Return filtered values
        return True, None, value  # All valid
    else:
        if value not in allowed_values:
            return (
                False,
                f"Invalid value '{value}'. Allowed values: {allowed_values}",
                None,
            )
        return True, None, value  # Valid single value


def validate_table_structure(
    value: Any, config: Optional[Dict]
) -> Tuple[bool, Optional[str]]:
    """
    Validate table-cp structure against configuration.

    Args:
        value: Table object with columns and rows
        config: Table configuration with required columns

    Returns:
        Tuple[bool, Optional[str]]: (is_valid, error_message)
    """
    if "columns" not in value:
        return False, "Missing required 'columns' field"

    if not config or "columns" not in config:
        return False, "No table configuration found"

    defined_columns = set(config.get("columns", []))
    provided_columns = set(value.get("columns", []))

    # Check if columns match exactly
    if provided_columns != defined_columns:
        extra_cols = provided_columns - defined_columns
        missing_cols = defined_columns - provided_columns
        error_parts = []
        if extra_cols:
            error_parts.append(f"Extra columns: {list(extra_cols)}")
        if missing_cols:
            error_parts.append(f"Missing columns: {list(missing_cols)}")
        return (
            False,
            f"Column mismatch. {', '.join(error_parts)}. Required columns: {list(defined_columns)}",
        )

    # Validate rows structure if present
    if "rows" in value:
        for idx, row in enumerate(value["rows"]):
            if not isinstance(row, dict):
                return False, f"Row {idx} must be a dictionary"

            row_keys = set(row.keys())
            if not row_keys.issubset(provided_columns):
                extra_keys = row_keys - provided_columns
                return False, f"Row {idx} contains invalid columns: {list(extra_keys)}"

    return True, None


def validate_time_interval(
    value: Any, config: Optional[Any] = None, metadata: Optional[OpenMetadata] = None
) -> Tuple[bool, Optional[str], Any]:
    """
    Validate and convert timeInterval structure.

    Args:
        value: TimeInterval object with start and end
        config: Optional configuration (not used for timeInterval)
        metadata: Optional OpenMetadata client (not used for timeInterval)

    Returns:
        Tuple[bool, Optional[str], Any]: (is_valid, error_message, converted_value)
    """
    if not isinstance(value, dict):
        return (
            False,
            f"Expected dictionary with 'start' and 'end', got {type(value).__name__}",
            None,
        )

    if "start" not in value or "end" not in value:
        return False, "Missing required 'start' and/or 'end' fields", None

    try:
        start = int(value["start"])
        end = int(value["end"])

        if start > end:
            return (
                False,
                f"Start time ({start}) must be before or equal to end time ({end})",
                None,
            )

        return True, None, value
    except (ValueError, TypeError) as exc:
        return (
            False,
            f"Invalid timestamp values. Both 'start' and 'end' must be integers: {str(exc)}",
            None,
        )


def format_validation_error_message(
    field_name: str, property_type: str, value: Any, error_detail: Optional[str] = None
) -> str:
    """
    Generate helpful error message for validation failures.

    Args:
        field_name: Name of the custom property
        property_type: OpenMetadata type name
        value: The value that failed validation
        error_detail: Specific error details

    Returns:
        Formatted error message
    """
    base_msg = (
        f"Validation failed for custom property '{field_name}' (type: {property_type})"
    )

    if error_detail:
        return f"{base_msg}: {error_detail}. Provided value: {value}"
    else:
        return f"{base_msg}. Provided value: {value} (type: {type(value).__name__})"


def _validate_email_type(
    value: Any, config: Optional[Any], metadata: Optional[OpenMetadata] = None
) -> Tuple[bool, Optional[str], Any]:
    """Validate and convert email type"""
    if not isinstance(value, str):
        return False, f"Expected email string, got {type(value).__name__}", None
    if not validate_email_format(value):
        return False, "Invalid email format. Expected format: user@domain.com", None
    return True, None, str(value)


def _validate_date_time_type(
    value: Any, config: Optional[Any], metadata: Optional[OpenMetadata] = None
) -> Tuple[bool, Optional[str], Any]:
    """Validate and convert date/time types"""
    if not isinstance(value, str):
        return False, f"Expected date/time string, got {type(value).__name__}", None
    if config and isinstance(config, str):
        is_valid, error_msg = validate_date_time_format(value, config, "date/time")
        return is_valid, error_msg, str(value) if is_valid else None
    return True, None, str(value)


def _validate_timestamp_type(
    value: Any, config: Optional[Any], metadata: Optional[OpenMetadata] = None
) -> Tuple[bool, Optional[str], Any]:
    """Validate and convert timestamp type"""
    if not isinstance(value, int):
        return (
            False,
            f"Expected integer timestamp (milliseconds), got {type(value).__name__}",
            None,
        )
    if value < 0:
        return False, "Timestamp cannot be negative", None
    return True, None, int(value)


def _validate_duration_type(
    value: Any, config: Optional[Any], metadata: Optional[OpenMetadata] = None
) -> Tuple[bool, Optional[str], Any]:
    """Validate and convert ISO 8601 duration format"""
    if not isinstance(value, str):
        return (
            False,
            f"Expected ISO 8601 duration string, got {type(value).__name__}",
            None,
        )
    if not value.startswith("P"):
        return (
            False,
            "Invalid duration format. Expected ISO 8601 format (e.g., 'P23DT23H')",
            None,
        )
    return True, None, str(value)


def _validate_enum_type(
    value: Any, config: Optional[Any], metadata: Optional[OpenMetadata] = None
) -> Tuple[bool, Optional[str], Optional[Any]]:
    """Validate and convert enum with allowed values"""
    if config and isinstance(config, dict):
        is_valid, error_msg, filtered_value = validate_enum_value(value, config)
        if is_valid:
            converted_value = (
                filtered_value
                if isinstance(filtered_value, list)
                else [str(filtered_value)]
            )
            return True, error_msg, converted_value
        return False, error_msg, None
    # Fallback without config
    if not isinstance(value, (str, list)):
        return (
            False,
            f"Expected string or list for enum, got {type(value).__name__}",
            None,
        )
    converted_value = value if isinstance(value, list) else [str(value)]
    return True, None, converted_value


def _validate_table_type(
    value: Any, config: Optional[Any], metadata: Optional[OpenMetadata] = None
) -> Tuple[bool, Optional[str], Any]:
    """Validate and convert table-cp structure"""
    if not isinstance(value, dict):
        return (
            False,
            f"Expected dictionary with 'columns' field, got {type(value).__name__}",
            None,
        )
    if "columns" not in value:
        return False, "Missing required 'columns' field in table structure", None
    if config and isinstance(config, dict):
        is_valid, error_msg = validate_table_structure(value, config)
        return is_valid, error_msg, value if is_valid else None
    return True, None, value


def _validate_entity_reference_type(
    value: Any, config: Optional[Any], metadata: Optional[OpenMetadata] = None
) -> Tuple[bool, Optional[str], Any]:
    """
    Validate and convert entity reference format and type.

    Requires object format: {"type": "table", "fqn": "service.db.schema.table"}

    Args:
        value: Entity reference value
        config: List of allowed entity types (e.g., ["table", "databaseSchema", "user"])
        metadata: OpenMetadata client for fetching entity
    """
    if not isinstance(value, dict):
        return (
            False,
            f"Expected dict with 'type' and 'fqn' fields for entity reference, got {type(value).__name__}. "
            f"Example: {{'type': 'user', 'fqn': 'username'}}",
            None,
        )

    if "type" not in value or "fqn" not in value:
        return (
            False,
            "Entity reference object must have 'type' and 'fqn' fields. "
            "Example: {'type': 'table', 'fqn': 'service.db.schema.table'}",
            None,
        )

    entity_type = value.get("type")
    entity_fqn = value.get("fqn")

    if not isinstance(entity_type, str) or not isinstance(entity_fqn, str):
        return False, "Both 'type' and 'fqn' must be strings", None

    if config and isinstance(config, list):
        if entity_type not in config:
            return (
                False,
                f"Entity type '{entity_type}' is not allowed. Allowed types: {config}",
                None,
            )

    # Convert: fetch entity from OpenMetadata
    if metadata:
        entity = find_entity_by_type_and_fqn(metadata, entity_type, entity_fqn)
        if entity:
            converted = format_entity_reference(entity, entity_type)
            return True, None, converted
        else:
            logger.warning(f"Entity not found: type={entity_type}, fqn={entity_fqn}")
            return (
                False,
                f"Entity not found: type={entity_type}, fqn={entity_fqn}",
                None,
            )

    # Validation passed but no metadata to convert
    return True, None, value


def _validate_entity_reference_list_type(
    value: Any, config: Optional[Any], metadata: Optional[OpenMetadata] = None
) -> Tuple[bool, Optional[str], Any]:
    """
    Validate and convert entity reference list format and types.

    Args:
        value: List of entity references
        config: List of allowed entity types
        metadata: OpenMetadata client for fetching entities
    """
    if not isinstance(value, list):
        return (
            False,
            f"Expected list of entity references, got {type(value).__name__}",
            None,
        )
    if not value:  # Empty list is valid
        return True, None, []

    # Validate and convert each item in the list
    converted_list = []
    for idx, item in enumerate(value):
        is_valid, error_msg, converted_item = _validate_entity_reference_type(
            item, config, metadata
        )
        if not is_valid:
            return False, f"Item {idx}: {error_msg}", None
        if converted_item:
            converted_list.append(converted_item)

    return True, None, converted_list if converted_list else None


# Dictionary mapping of validators for each custom property type
CUSTOM_PROPERTY_TYPE_VALIDATORS = {
    # Basic types - simple type checking with conversion
    "string": lambda v, c, m=None: (True, None, str(v))
    if isinstance(v, str)
    else (False, f"Expected string, got {type(v).__name__}", None),
    "integer": lambda v, c, m=None: (True, None, int(v))
    if isinstance(v, int) and not isinstance(v, bool)
    else (False, f"Expected integer, got {type(v).__name__}", None),
    "number": lambda v, c, m=None: (True, None, float(v))
    if isinstance(v, (int, float)) and not isinstance(v, bool)
    else (False, f"Expected number, got {type(v).__name__}", None),
    "markdown": lambda v, c, m=None: (True, None, str(v))
    if isinstance(v, str)
    else (False, f"Expected markdown string, got {type(v).__name__}", None),
    "sqlQuery": lambda v, c, m=None: (True, None, str(v))
    if isinstance(v, str)
    else (False, f"Expected SQL query string, got {type(v).__name__}", None),
    # Types with format validation
    "email": _validate_email_type,
    "date-cp": _validate_date_time_type,
    "dateTime-cp": _validate_date_time_type,
    "time-cp": _validate_date_time_type,
    "timestamp": _validate_timestamp_type,
    "duration": _validate_duration_type,
    "timeInterval": validate_time_interval,
    # Types with configuration-based validation
    "enum": _validate_enum_type,
    "table-cp": _validate_table_type,
    # Entity reference types
    "entityReference": _validate_entity_reference_type,
    "entityReferenceList": _validate_entity_reference_list_type,
}


def validate_custom_property_value(
    property_name: str,
    property_type: str,
    property_config: Optional[Any],
    value: Any,
    metadata: Optional[OpenMetadata] = None,
) -> Tuple[bool, Optional[str], Any]:
    """
    Comprehensive validation and conversion of custom property value.

    This function validates type compatibility, format constraints, and converts
    values to the format expected by OpenMetadata API for all 16 custom property types.

    For enum types with multi-select, automatically filters out invalid values.
    For entity references, fetches and converts entities from OpenMetadata.

    Args:
        property_name: Name of the custom property
        property_type: OpenMetadata type name (e.g., "string", "date-cp", "email")
        property_config: Configuration for the property (format, enum values, etc.)
        value: The value to validate and convert
        metadata: OpenMetadata client (required for entityReference types)

    Returns:
        Tuple[bool, Optional[str], Any]: (is_valid, error_message, converted_value)
            - is_valid: True if validation passed
            - error_message: Detailed error message if validation failed, None if passed
            - converted_value: The converted value ready for OpenMetadata API
    """
    # Handle None values
    if value is None:
        return False, "Value cannot be None", None

    # Get validator for the property type
    validator = CUSTOM_PROPERTY_TYPE_VALIDATORS.get(property_type)

    if not validator:
        logger.warning(f"Unknown custom property type: {property_type}")
        return False, f"Unknown property type: {property_type}", None

    # Run validation and conversion
    try:
        # All validators now return 3 values: (is_valid, error_msg, converted_value)
        is_valid, error_msg, converted_value = validator(
            value, property_config, metadata
        )
        return is_valid, error_msg, converted_value
    except Exception as exc:
        logger.debug(f"Validation exception for {property_name}: {exc}")
        logger.debug(traceback.format_exc())
        return False, f"Validation error: {str(exc)}", None


def create_test_case_parameter_definitions(dbt_test):
    """
    Method to create test case parameter definitions
    """
    try:
        if hasattr(dbt_test, "test_metadata"):
            test_case_param_definition = [
                {
                    "name": dbt_test.test_metadata.name,
                    "displayName": dbt_test.test_metadata.name,
                    "required": False,
                }
            ]
            return test_case_param_definition
        if hasattr(dbt_test, "freshness"):
            test_case_param_definition = [
                {
                    "name": "warn_after",
                    "displayName": "warn_after",
                    "required": False,
                },
                {
                    "name": "error_after",
                    "displayName": "error_after",
                    "required": False,
                },
            ]
            return test_case_param_definition
    except Exception as err:  # pylint: disable=broad-except
        logger.debug(traceback.format_exc())
        logger.error(
            f"Failed to capture tests case parameter definitions for node: {dbt_test} {err}"
        )
    return None


def create_test_case_parameter_values(dbt_test):
    """
    Method to create test case parameter values
    """
    try:
        manifest_node = dbt_test.get(DbtCommonEnum.MANIFEST_NODE.value)
        if hasattr(manifest_node, "test_metadata"):
            values = manifest_node.test_metadata.kwargs.get("values")
            dbt_test_values = ""
            if values:
                dbt_test_values = ",".join(str(value) for value in values)
            test_case_param_values = [
                {"name": manifest_node.test_metadata.name, "value": dbt_test_values}
            ]
            return test_case_param_values
        if hasattr(manifest_node, "freshness"):
            warn_after = manifest_node.freshness.warn_after
            error_after = manifest_node.freshness.error_after

            test_case_param_values = [
                {
                    "name": "error_after",
                    "value": f"{error_after.count} {error_after.period.value}",
                },
                {
                    "name": "warn_after",
                    "value": f"{warn_after.count} {warn_after.period.value}",
                },
            ]
            return test_case_param_values
    except Exception as err:  # pylint: disable=broad-except
        logger.debug(traceback.format_exc())
        logger.error(
            f"Failed to capture tests case parameter values for node: {dbt_test} {err}"
        )
    return None


def generate_entity_link(dbt_test):
    """
    Method returns entity link
    """
    manifest_node = dbt_test.get(DbtCommonEnum.MANIFEST_NODE.value)
    entity_link_list = [
        entity_link.get_entity_link(
            Table,
            fqn=table_fqn,
            column_name=manifest_node.column_name
            if hasattr(manifest_node, "column_name")
            else None,
        )
        for table_fqn in dbt_test[DbtCommonEnum.UPSTREAM.value]
    ]
    return entity_link_list


def get_dbt_compiled_query(mnode) -> Optional[str]:
    """
    Method to get dbt compiled query
    """
    if hasattr(mnode, CompiledQueriesEnum.COMPILED_CODE.value) and mnode.compiled_code:
        return mnode.compiled_code
    if hasattr(mnode, CompiledQueriesEnum.COMPILED_SQL.value) and mnode.compiled_sql:
        return mnode.compiled_sql
    logger.debug(f"Unable to get DBT compiled query for node - {mnode.name}")
    return None


def get_dbt_raw_query(mnode) -> Optional[str]:
    """
    Method to get dbt raw query
    """
    if hasattr(mnode, RawQueriesEnum.RAW_CODE.value) and mnode.raw_code:
        return mnode.raw_code
    if hasattr(mnode, RawQueriesEnum.RAW_SQL.value) and mnode.raw_sql:
        return mnode.raw_sql
    logger.debug(f"Unable to get DBT raw query for node - {mnode.name}")
    return None


def check_or_create_test_suite(
    metadata: OpenMetadata, test_entity_link: str
) -> Union[TestSuite, EntityReference]:
    """Check if test suite exists, if not create it

    Args:
        entity_link (str): entity link

    Returns:
        TestSuite:
    """
    table_fqn = entity_link.get_table_fqn(test_entity_link)
    return metadata.get_or_create_executable_test_suite(table_fqn)


def check_ephemeral_node(manifest_node) -> bool:
    """
    Check if the manifest node is an ephemeral node
    """
    if (
        hasattr(manifest_node, "config")
        and manifest_node.config
        and hasattr(manifest_node.config, "materialized")
        and manifest_node.config.materialized == "ephemeral"
    ):
        return True
    return False


def get_dbt_model_name(manifest_node) -> str:
    """
    Get the alias or name of the manifest node
    """
    return (
        manifest_node.alias
        if hasattr(manifest_node, "alias") and manifest_node.alias
        else manifest_node.name
    )


def get_corrected_name(name: Optional[str]):
    """
    Method to fetch correct name
    """
    correct_name = None
    if name:
        correct_name = None if name.lower() in NONE_KEYWORDS_LIST else name
    return correct_name


def get_data_model_path(manifest_node):
    """
    Method to get data model path
    """
    datamodel_path = None
    if manifest_node.original_file_path:
        if hasattr(manifest_node, "root_path") and manifest_node.root_path:
            datamodel_path = (
                f"{manifest_node.root_path}/{manifest_node.original_file_path}"
            )
        else:
            datamodel_path = manifest_node.original_file_path
    return datamodel_path


def find_entity_by_type_and_fqn(
    metadata: OpenMetadata, entity_type: str, entity_fqn: str
) -> Optional[Any]:
    """
    Search for entity by type and FQN.

    NOTE: This assumes entity_type has already been validated against allowed types.
    Validation happens in _validate_entity_reference_type() before calling this.

    Args:
        metadata: OpenMetadata client
        entity_type: Entity type (e.g., "table", "databaseSchema", "user")
        entity_fqn: Fully qualified name of the entity

    Returns:
        Entity object if found, None otherwise
    """
    from metadata.generated.schema.entity.classification.tag import Tag
    from metadata.generated.schema.entity.data.container import Container
    from metadata.generated.schema.entity.data.dashboard import Dashboard
    from metadata.generated.schema.entity.data.dashboardDataModel import (
        DashboardDataModel,
    )
    from metadata.generated.schema.entity.data.database import Database
    from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
    from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
    from metadata.generated.schema.entity.data.metric import Metric
    from metadata.generated.schema.entity.data.mlmodel import MlModel
    from metadata.generated.schema.entity.data.pipeline import Pipeline
    from metadata.generated.schema.entity.data.searchIndex import SearchIndex
    from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
    from metadata.generated.schema.entity.data.table import Table
    from metadata.generated.schema.entity.data.topic import Topic

    # Map entity type names to Python classes
    ENTITY_TYPE_MAP = {
        "table": Table,
        "storedProcedure": StoredProcedure,
        "databaseSchema": DatabaseSchema,
        "database": Database,
        "dashboard": Dashboard,
        "dashboardDataModel": DashboardDataModel,
        "pipeline": Pipeline,
        "topic": Topic,
        "container": Container,
        "searchIndex": SearchIndex,
        "mlmodel": MlModel,
        "glossaryTerm": GlossaryTerm,
        "tag": Tag,
        "user": User,
        "team": Team,
        "metric": Metric,
    }

    # Get entity class
    entity_class = ENTITY_TYPE_MAP.get(entity_type)
    if not entity_class:
        logger.warning(f"Unknown entity type: {entity_type}")
        return None

    try:
        # Fetch entity from OpenMetadata by FQN
        entity = metadata.get_by_name(entity=entity_class, fqn=entity_fqn)
        if entity:
            logger.debug(f"Found {entity_type} entity: {entity_fqn}")
            return entity
        else:
            logger.warning(f"{entity_type} entity not found: {entity_fqn}")
            return None
    except Exception as exc:
        logger.warning(f"Error finding {entity_type} entity '{entity_fqn}': {exc}")
        logger.debug(traceback.format_exc())
        return None


def format_entity_reference(
    entity: Any, entity_type: Optional[str] = None
) -> Dict[str, Any]:
    """
    Formats entity into entityReference structure for OpenMetadata.
    Extracts all Pydantic .root values to ensure JSON serializability.

    Args:
        entity: Entity object from OpenMetadata
        entity_type: Entity type string (e.g., "table", "databaseSchema").
                     If provided, uses this instead of entity.type

    Returns:
        EntityReference dict with all fields as strings/primitives
    """
    # Extract ID (ensure string)
    if hasattr(entity, "id"):
        entity_id = (
            str(entity.id.root) if hasattr(entity.id, "root") else str(entity.id)
        )
    else:
        entity_id = str(entity.get("id", ""))

    # Extract FQN
    if hasattr(entity, "fullyQualifiedName"):
        if hasattr(entity.fullyQualifiedName, "root"):
            entity_fqn = str(entity.fullyQualifiedName.root)
        else:
            entity_fqn = str(entity.fullyQualifiedName)
    else:
        entity_fqn = str(getattr(entity, "name", "Unknown"))

    # Extract name (handle EntityName Pydantic model)
    if hasattr(entity, "name"):
        if hasattr(entity.name, "root"):
            entity_name = str(entity.name.root)
        else:
            entity_name = str(entity.name)
    else:
        entity_name = "Unknown"

    # Extract display name
    if hasattr(entity, "displayName"):
        if hasattr(entity.displayName, "root"):
            display_name = str(entity.displayName.root)
        elif entity.displayName:
            display_name = str(entity.displayName)
        else:
            display_name = entity_name
    else:
        display_name = entity_name

    # Extract description
    description = ""
    if hasattr(entity, "description"):
        if hasattr(entity.description, "root"):
            description = (
                str(entity.description.root) if entity.description.root else ""
            )
        elif entity.description:
            description = str(entity.description)

    # Use provided entity_type, or fall back to entity.type
    if entity_type:
        final_type = entity_type
    else:
        final_type = str(getattr(entity, "type", "unknown"))

    return {
        "id": entity_id,
        "type": final_type,
        "name": entity_name,
        "fullyQualifiedName": entity_fqn,
        "deleted": False,
        "description": description,
        "displayName": display_name,
    }


def find_domain_by_name(metadata: OpenMetadata, domain_name: str) -> Optional[Any]:
    """
    Search domain by name
    """
    try:
        domain_entity = metadata.get_by_name(entity=Domain, fqn=domain_name)
        return domain_entity
    except Exception as exc:
        logger.warning(f"Error finding domain {domain_name}: {exc}")
        logger.debug(traceback.format_exc())
        return None


def format_domain_reference(domain_entity: Any) -> Optional[Dict[str, Any]]:
    """
    Formats domain into EntityReference structure
    """
    try:
        domain_id = (
            domain_entity.id.root
            if hasattr(domain_entity.id, "root")
            else str(domain_entity.id)
        )
        domain_name = (
            domain_entity.name.root
            if hasattr(domain_entity.name, "root")
            else str(domain_entity.name)
        )
        domain_fqn = (
            domain_entity.fullyQualifiedName.root
            if hasattr(domain_entity.fullyQualifiedName, "root")
            else str(domain_entity.fullyQualifiedName)
        )

        return {
            "id": domain_id,
            "type": "domain",
            "name": domain_name,
            "fullyQualifiedName": domain_fqn,
        }
    except Exception as exc:
        logger.warning(f"Error formatting domain reference: {exc}")
        return None
