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
"""Migrate legacy per-instance dbt definitions without recreating test cases."""

from typing import Any

from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import (
    EntityType,
    TestCaseParameterDefinition,
    TestDefinition,
    TestPlatform,
)
from metadata.generated.schema.type.basic import ProviderType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.mixins.patch_mixin import _entity_etag
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.dbt.dbt_utils import (
    create_test_case_parameter_definitions,
    get_dbt_test_definition_name,
    get_dbt_test_description,
    get_manifest_column_name,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def _matches_dbt_definition(definition: TestDefinition, manifest_node: Any, entity_type: EntityType) -> bool:
    expected_parameters = [
        TestCaseParameterDefinition.model_validate(parameter)
        for parameter in create_test_case_parameter_definitions(manifest_node) or []
    ]
    return (
        definition.testPlatforms == [TestPlatform.dbt]
        and definition.entityType == entity_type
        and (definition.parameterDefinition or []) == expected_parameters
        and definition.enabled is not False
        and not definition.deleted
    )


def _is_unmodified_legacy(definition: TestDefinition, test_case: TestCase, manifest_node: Any) -> bool:
    descriptions = {
        get_dbt_test_description(manifest_node),
        model_str(test_case.description) if test_case.description else None,
    }
    return (
        definition.provider != ProviderType.system
        and (not definition.description or model_str(definition.description) in descriptions)
        and not any(
            (
                definition.displayName,
                definition.owners.root if definition.owners else None,
                definition.domains.root if definition.domains else None,
                definition.dataQualityDimension,
                definition.supportedDataTypes,
                definition.supportedServices,
                definition.sqlExpression,
                definition.validatorClass,
                definition.supportsDynamicAssertion,
                definition.supportsRowLevelPassedFailed,
            )
        )
    )


def migrate_test_definition(metadata: OpenMetadata, test_case: TestCase, manifest_node: Any) -> TestCase:
    """Reassign a recognized legacy case and hard-delete only an unused definition.

    Cleanup also runs for cases already reassigned, so a denied deletion can be
    retried on the next ingestion without retaining migration state in memory.
    """
    test_metadata = getattr(manifest_node, "test_metadata", None)
    if not getattr(test_metadata, "name", None) or not test_case.testDefinition:
        return test_case

    entity_type = EntityType.COLUMN if get_manifest_column_name(manifest_node) else EntityType.TABLE
    target_name = get_dbt_test_definition_name(manifest_node, entity_type)
    legacy_name = manifest_node.name
    current_name = test_case.testDefinition.name
    if target_name == legacy_name or current_name not in (legacy_name, target_name):
        return test_case

    legacy = metadata.get_by_name(TestDefinition, legacy_name, fields=["owners", "domains"])
    if not legacy:
        return test_case
    if not _matches_dbt_definition(legacy, manifest_node, entity_type) or not _is_unmodified_legacy(
        legacy, test_case, manifest_node
    ):
        logger.warning("Preserving customized or incompatible dbt test definition %s", legacy_name)
        return test_case

    target = metadata.get_by_name(TestDefinition, target_name)
    if not target or not _matches_dbt_definition(target, manifest_node, entity_type):
        logger.warning(
            "Cannot migrate dbt test %s: shared definition %s is missing or incompatible", legacy_name, target_name
        )
        return test_case

    if test_case.testDefinition.id == legacy.id:
        destination = test_case.model_copy(deep=True)
        destination.testDefinition = EntityReference(id=target.id, type="testDefinition", name=target_name)
        updated = metadata.patch(
            entity=TestCase,
            source=test_case,
            destination=destination,
            if_match=_entity_etag(test_case),
            skip_on_failure=False,
        )
        if (
            not updated
            or not updated.testDefinition
            or updated.testDefinition.id != target.id
            or updated.id != test_case.id
        ):
            raise ValueError(f"Could not confirm reassignment of dbt test {model_str(test_case.fullyQualifiedName)}")
        test_case = updated
    elif test_case.testDefinition.id != target.id:
        return test_case

    try:
        # The server checks all remaining relationships, including soft-deleted
        # cases. Never recurse: doing so would delete those cases and their history.
        etag = _entity_etag(legacy)
        if not etag:
            logger.warning("Retaining legacy dbt definition %s: no version for conditional deletion", legacy_name)
            return test_case
        metadata.client.delete(
            f"{metadata.get_suffix(TestDefinition)}/{model_str(legacy.id)}/unused",
            headers={"If-Match": etag},
        )
    except APIError as exc:
        logger.warning(
            "Retaining legacy dbt definition %s; cleanup will retry on the next ingestion: %s", legacy_name, exc
        )
    return test_case
