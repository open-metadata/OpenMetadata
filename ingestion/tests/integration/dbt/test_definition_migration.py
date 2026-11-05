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
"""Exercise dbt case reassignment and hard deletion against the REST server."""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from tests.integration.integration_base import get_create_entity, get_create_service

from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestDefinition import CreateTestDefinitionRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import TestDefinition
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.dbt.constants import DbtCommonEnum
from metadata.ingestion.source.database.dbt.metadata import DbtSource
from metadata.ingestion.source.database.dbt.test_definition_migration import migrate_test_definition


@pytest.fixture
def dbt_catalog(metadata):
    service = metadata.create_or_update(get_create_service(DatabaseService, name=f"dbt_migration_{uuid4().hex}"))
    definitions = []
    try:
        db = metadata.create_or_update(get_create_entity(Database, service.fullyQualifiedName))
        schema = metadata.create_or_update(get_create_entity(DatabaseSchema, db.fullyQualifiedName))
        tables = [metadata.create_or_update(get_create_entity(Table, schema.fullyQualifiedName)) for _ in range(2)]
        yield tables, definitions
    finally:
        metadata.delete(DatabaseService, service.id, recursive=True, hard_delete=True)
        for definition in definitions:
            if metadata.get_by_id(TestDefinition, definition.id):
                metadata.delete(TestDefinition, definition.id, recursive=False, hard_delete=True)


def seed_cases(metadata, dbt_catalog, column_level):
    tables, definitions = dbt_catalog
    test_type = f"generic_{uuid4().hex}"
    node = SimpleNamespace(
        name=f"{test_type}_legacy",
        column_name="id" if column_level else None,
        description="dbt uniqueness check",
        meta={},
        test_metadata=SimpleNamespace(name=test_type, kwargs={}),
    )
    target_name = test_type if column_level else f"{test_type}_table"
    for name in (node.name, target_name):
        definitions.append(
            metadata.create_or_update(
                CreateTestDefinitionRequest(
                    name=name,
                    description=node.description,
                    entityType="COLUMN" if column_level else "TABLE",
                    testPlatforms=["dbt"],
                    parameterDefinition=[{"name": test_type, "displayName": test_type}],
                )
            )
        )
    cases = []
    for table in tables:
        link = f"<#E::table::{model_str(table.fullyQualifiedName)}"
        link += "::columns::id>" if column_level else ">"
        cases.append(
            metadata.create_or_update(
                CreateTestCaseRequest(
                    name=node.name,
                    description=node.description,
                    entityLink=link,
                    testDefinition=node.name,
                    parameterValues=[{"name": test_type, "value": ""}],
                )
            )
        )
    return node, definitions[0], definitions[1], cases


@pytest.mark.parametrize("column_level", [True, False])
def test_ingestion_reassigns_in_place_preserves_history_and_retries_cleanup(metadata, dbt_catalog, column_level):
    node, legacy, target, cases = seed_cases(metadata, dbt_catalog, column_level)
    timestamp = 1793836800000
    for case in cases:
        metadata.add_test_case_results(
            TestCaseResult(timestamp=timestamp, testCaseStatus=TestCaseStatus.Failed, result="Historical dbt result"),
            model_str(case.fullyQualifiedName),
        )
    source = DbtSource.__new__(DbtSource)
    source.metadata = metadata
    source.source_config = SimpleNamespace(dbtUpdateDescriptions=False)
    for index, (table, case) in enumerate(zip(dbt_catalog[0], cases, strict=True)):
        # The real ingestion stage must invoke migration for an existing case.
        records = list(
            source.create_dbt_test_case(
                {
                    DbtCommonEnum.MANIFEST_NODE.value: node,
                    DbtCommonEnum.UPSTREAM.value: [model_str(table.fullyQualifiedName)],
                }
            )
        )
        assert not records, records
        actual = metadata.get_by_id(TestCase, case.id, fields=["testDefinition", "testSuite"])
        assert actual.testDefinition.id == target.id
        assert actual.fullyQualifiedName == case.fullyQualifiedName
        assert actual.testSuite.id == case.testSuite.id
        assert actual.parameterValues == case.parameterValues
        history = metadata.get_test_case_results(model_str(case.fullyQualifiedName), timestamp - 1, timestamp + 1)
        assert len(history) == 1
        assert history[0].result == "Historical dbt result"
        if index == 0:
            assert metadata.get_by_id(TestDefinition, legacy.id) is not None
        assert migrate_test_definition(metadata, actual, node).id == case.id
    # include=all distinguishes a hard deletion from a soft deletion.
    assert metadata.get_by_name(TestDefinition, node.name, include="all") is None


def test_soft_deleted_case_still_prevents_definition_cleanup(metadata, dbt_catalog):
    node, legacy, target, cases = seed_cases(metadata, dbt_catalog, True)
    metadata.delete(TestCase, cases[1].id, recursive=False, hard_delete=False)
    migrated = migrate_test_definition(metadata, cases[0], node)
    assert migrated.testDefinition.id == target.id
    assert metadata.get_by_id(TestDefinition, legacy.id) is not None
