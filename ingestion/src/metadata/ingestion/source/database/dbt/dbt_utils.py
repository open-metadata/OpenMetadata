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
from typing import Optional, Union

from metadata.generated.schema.entity.data.table import Table
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


def get_matched_column_name(table_entity: Table, dbt_node):
    """
    Method to fetch the matched column name from dbt
    """
    dbt_column_name = getattr(dbt_node, "column_name", None)
    if dbt_column_name:
        # Case-insensitive lookup to find the actual column name
        for col in getattr(table_entity, "columns", []) or []:
            if col.name.root.lower() == dbt_column_name.lower():
                return col.name.root
        logger.warning(f"No Matching Column found for {dbt_column_name}")
        # Fall back to the original DBT column name when no match is found
        return dbt_column_name
    return None


def generate_entity_link(dbt_test, table_entity: Optional[Table] = None):
    """
    Method returns entity link with case-matched column names.

    For databases like Snowflake that store unquoted identifiers in uppercase,
    this function matches DBT column names (typically lowercase) against the
    actual column names in the table entity to ensure correct entity links.

    Args:
        dbt_test: DBT test dictionary containing manifest node and upstream tables
        table_entity: Optional Table entity to match column names against

    Returns:
        List of entity link strings with correctly cased column names
    """
    manifest_node = dbt_test.get(DbtCommonEnum.MANIFEST_NODE.value)

    dbt_column_name = get_matched_column_name(table_entity, manifest_node)

    entity_link_list = [
        entity_link.get_entity_link(
            Table,
            fqn=table_fqn,
            column_name=dbt_column_name,
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
