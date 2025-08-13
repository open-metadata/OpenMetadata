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
import traceback
from typing import Any, Dict, List, Optional, Union

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


def extract_meta_fields_from_node(node: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extracts customProperties fields from dbt manifest node from meta.openmetadata.customProperties
    """
    try:
        if hasattr(node, "meta"):
            meta_fields = node.meta if node.meta else {}
        else:
            meta_fields = node.get("meta", {})

        openmetadata = meta_fields.get("openmetadata", {})

        custom_properties = openmetadata.get("custom_properties", {})

        if not isinstance(custom_properties, dict):
            logger.warning(f"custom_properties is not a dictionary: {type(custom_properties)}")
            return {}

        if custom_properties:
            logger.debug(f"Found custom_properties for node: {custom_properties}")
        else:
            logger.debug("No custom_properties found in meta.openmetadata")

        return custom_properties
    except Exception as exc:
        logger.warning(f"Error extracting custom_properties from meta.openmetadata: {exc}")
        return {}


def get_expected_type_for_value(value: Any) -> str:
    """
    Determines expected type for value from dbt meta
    """
    if isinstance(value, bool):
        return "boolean"
    elif isinstance(value, int):
        return "integer"
    elif isinstance(value, float):
        return "number"
    elif isinstance(value, list):
        return "array"
    elif isinstance(value, dict):
        return "object"
    else:
        return "string"


def validate_custom_property_match(custom_property_type: str, value: Any) -> bool:
    """
    Validates value type compatibility with custom property type
    """
    # Type validation mapping
    type_validators = {
        # String types
        "string": lambda v: isinstance(v, str),
        "markdown": lambda v: isinstance(v, str),
        "email": lambda v: isinstance(v, str),
        "sql": lambda v: isinstance(v, str),
        "enum": lambda v: isinstance(v, str),
        "date": lambda v: isinstance(v, str),
        "dateTime": lambda v: isinstance(v, str),
        "time": lambda v: isinstance(v, str),
        "duration": lambda v: isinstance(v, str),
        # Numeric types
        "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
        "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
        # Other types
        "boolean": lambda v: isinstance(v, bool),
        "array": lambda v: isinstance(v, list),
        "object": lambda v: isinstance(v, dict),
        # Entity references
        "entityReference": lambda v: isinstance(v, str),
        "entityReferenceList": lambda v: isinstance(v, list)
        and all(isinstance(item, str) for item in v),
    }

    validator = type_validators.get(custom_property_type)
    if validator:
        return validator(value)

    # Fallback for unknown types
    logger.warning(f"Unknown custom property type: {custom_property_type}")
    return False


def find_entity_by_name(metadata: OpenMetadata, entity_name: str) -> Optional[Any]:
    """
    Universal entity search by name using different methods
    """
    entity_ref = metadata.get_reference_by_name(name=entity_name)
    if entity_ref and entity_ref.root:
        return entity_ref.root[0]

    entity_ref = metadata.get_reference_by_email(email=entity_name)
    if entity_ref and entity_ref.root:
        return entity_ref.root[0]

    try:
        team_entity = metadata.get_by_name(entity=Team, fqn=entity_name)
        if team_entity:
            return team_entity
    except Exception:
        pass

    try:
        user_entity = metadata.get_by_name(entity=User, fqn=entity_name)
        if user_entity:
            return user_entity
    except Exception:
        pass

    return None


def format_entity_reference(entity: Any) -> Dict[str, Any]:
    """
    Formats entity into entityReference structure for OpenMetadata
    """
    entity_id = entity.id.root if hasattr(entity.id, "root") else str(entity.id)

    if hasattr(entity, "fullyQualifiedName"):
        if hasattr(entity.fullyQualifiedName, "root"):
            entity_fqn = entity.fullyQualifiedName.root
        else:
            entity_fqn = str(entity.fullyQualifiedName)
    else:
        entity_fqn = getattr(entity, "name", "Unknown")

    return {
        "id": entity_id,
        "type": getattr(entity, "type", "user"),
        "name": entity.name,
        "fullyQualifiedName": entity_fqn,
        "deleted": False,
        "description": getattr(entity, "description", "") or "",
        "displayName": getattr(entity, "displayName", entity.name) or entity.name,
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


def convert_entity_reference(
    metadata: OpenMetadata, value: Any
) -> Optional[Dict[str, Any]]:
    """
    Universal converter for entityReference fields
    """
    if not isinstance(value, str):
        return None

    try:
        entity = find_entity_by_name(metadata, value)

        if entity:
            return format_entity_reference(entity)
        else:
            logger.warning(f"Entity not found for reference: {value}")
            return None

    except Exception as exc:
        logger.warning(f"Error converting entityReference {value}: {exc}")
        return None


def convert_entity_reference_list(
    metadata: OpenMetadata, value: Any
) -> Optional[List[Dict[str, Any]]]:
    """
    Universal converter for entityReferenceList fields
    """
    if not isinstance(value, list):
        return None

    try:
        converted_list = []
        for item in value:
            converted_item = convert_entity_reference(metadata, item)
            if converted_item:
                converted_list.append(converted_item)
        return converted_list if converted_list else None

    except Exception as exc:
        logger.warning(f"Error converting entityReferenceList {value}: {exc}")
        return None


def get_custom_property_type_handlers():
    """
    Returns map of handlers for different custom property types
    """
    return {
        "string": lambda metadata, value: str(value),
        "integer": lambda metadata, value: int(value),
        "number": lambda metadata, value: float(value),
        "boolean": lambda metadata, value: bool(value),
        "entityReference": convert_entity_reference,
        "entityReferenceList": convert_entity_reference_list,
        "enum": lambda metadata, value: str(value),
        "date": lambda metadata, value: str(value),
        "dateTime": lambda metadata, value: str(value),
        "email": lambda metadata, value: str(value),
        "markdown": lambda metadata, value: str(value),
        "sql": lambda metadata, value: str(value),
    }


def convert_value_for_custom_property(
    metadata: OpenMetadata, custom_property_type: str, value: Any
) -> Any:
    """
    Main function for converting values by custom property type
    """
    handlers = get_custom_property_type_handlers()
    handler = handlers.get(custom_property_type)

    if handler:
        try:
            return handler(metadata, value)
        except Exception as exc:
            logger.warning(
                f"Error converting {custom_property_type} value {value}: {exc}"
            )
            return None
    else:
        logger.warning(f"Unknown custom property type: {custom_property_type}")
        return value
