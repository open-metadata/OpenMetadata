from unittest.mock import Mock
from uuid import UUID

import pytest

from metadata.data_quality.source.test_suite import TestSuiteSource
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata

MOCK_ENTITY_REFERENCE = EntityReference(
    id=str(UUID(int=0)), type="test_suite", name="test_suite"
)


@pytest.mark.parametrize(
    "parameters,expected",
    [
        (
            {
                "type": "TestSuite",
                "entityFullyQualifiedName": "MyTestSuite",
            },
            ["test_case1", "test_case2"],
        ),
        (
            {
                "type": "TestSuite",
                "entityFullyQualifiedName": "MyTestSuite",
                "testCases": [
                    "test_case1",
                ],
            },
            ["test_case1"],
        ),
        (
            {
                "type": "TestSuite",
                "entityFullyQualifiedName": "MyTestSuite",
                "testCases": [],
            },
            [],
        ),
    ],
)
def test_source_config(parameters, expected, monkeypatch):
    workflow_config = {
        "source": {
            "type": "TestSuite",
            "serviceName": "MyTestSuite",
            "sourceConfig": {"config": parameters},
            "serviceConnection": {
                "config": {
                    "type": "Mysql",
                    "hostPort": "localhost:3306",
                    "username": "root",
                }
            },
        },
        "workflowConfig": {
            "openMetadataServerConfig": {
                "hostPort": "localhost:8585",
            }
        },
    }
    monkeypatch.setattr(TestSuiteSource, "test_connection", Mock())
    monkeypatch.setattr(
        TestSuiteSource,
        "_get_table_service_connection",
        Mock(
            return_value=DatabaseConnection(
                config=PostgresConnection(
                    username="foo",
                    hostPort="localhost:5432",
                    database="postgres",
                )
            )
        ),
    )

    mock_metadata = Mock(spec=OpenMetadata)
    mock_metadata.get_by_name.return_value = Table(
        id=UUID(int=0),
        name="test_table",
        columns=[],
        testSuite=MOCK_ENTITY_REFERENCE,
        serviceType=DatabaseServiceType.Postgres,
    )
    mock_metadata.list_all_entities.return_value = [
        TestCase(
            name="test_case1",
            id=UUID(int=0),
            testDefinition=MOCK_ENTITY_REFERENCE,
            testSuite=MOCK_ENTITY_REFERENCE,
            entityLink="<#E::some::link>",
        ),
        TestCase(
            name="test_case2",
            id=UUID(int=0),
            testDefinition=MOCK_ENTITY_REFERENCE,
            testSuite=MOCK_ENTITY_REFERENCE,
            entityLink="<#E::some::link>",
        ),
    ]
    mock_metadata.get_by_id.return_value = TestSuite(
        name="test_suite", basic=True, id=UUID(int=0)
    )

    source = TestSuiteSource(
        OpenMetadataWorkflowConfig.model_validate(workflow_config), mock_metadata
    )
    test_cases = list(source._iter())[0].right.test_cases
    assert [t.name.root for t in test_cases] == expected
