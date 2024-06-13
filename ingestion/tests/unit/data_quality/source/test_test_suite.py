from dataclasses import dataclass
from unittest.mock import Mock
from uuid import UUID

import pytest

from metadata.data_quality.source.test_suite import TestSuiteSource
from metadata.generated.schema.entity.data.table import Table
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

TEST_SUITES = [
    TestSuite(id=UUID(int=0), name="table_test_suite", executable=True),
    TestSuite(id=UUID(int=1), name="logical_test_suite"),
]

TEST_CASES = [
    TestCase(
        name="test_case1",
        id=UUID(int=0),
        testSuite=MOCK_ENTITY_REFERENCE,
        testDefinition=MOCK_ENTITY_REFERENCE,
        testSuites=TEST_SUITES,
        entityLink="<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::some_column>",
    ),
    TestCase(
        name="test_case2",
        id=UUID(int=1),
        testSuite=MOCK_ENTITY_REFERENCE,
        testDefinition=MOCK_ENTITY_REFERENCE,
        testSuites=[TEST_SUITES[0]],
        entityLink="<#E::table::sample_data.ecommerce_db.shopify.dim_address>",
    ),
    TestCase(
        name="test_case3",
        id=UUID(int=2),
        testSuite=MOCK_ENTITY_REFERENCE,
        testDefinition=MOCK_ENTITY_REFERENCE,
        testSuites=[TEST_SUITES[1]],
        entityLink="<#E::table::sample_data.ecommerce_db.shopify.another_table>",
    ),
]

TABLES = [
    Table(
        id=UUID(int=0),
        name="dim_address",
        fullyQualifiedName="sample_data.ecommerce_db.shopify.dim_address",
        columns=[],
        testSuite=MOCK_ENTITY_REFERENCE,
    ),
    Table(
        id=UUID(int=1),
        name="dim_address",
        fullyQualifiedName="sample_data.ecommerce_db.shopify.another_table",
        columns=[],
        testSuite=MOCK_ENTITY_REFERENCE,
    ),
]


@pytest.fixture
def mock_metadata():
    mock_metadata = Mock(spec=OpenMetadata)

    def get_by_name_side_effect(entity, fqn, *_, **__):
        if entity == Table:
            try:
                return next(t for t in TABLES if t.fullyQualifiedName.root == fqn)
            except StopIteration:
                raise AssertionError(f"table with name={fqn} not found")
        if entity == TestSuite:
            try:
                return next(ts for ts in TEST_SUITES if ts.name.root == fqn)
            except StopIteration:
                raise AssertionError(f"test case with name={fqn} not found")
        raise AssertionError(
            f"unexpected call to get_by_name with entity={entity},name={fqn}"
        )

    mock_metadata.get_by_name.side_effect = get_by_name_side_effect

    def list_all_entities(entity, *args, params, **kwargs):
        if entity == TestCase:
            if params.get("testSuiteId"):
                return [
                    tc
                    for tc in TEST_CASES
                    if params["testSuiteId"] in [ts.id.root for ts in tc.testSuites]
                ]
            return TEST_CASES
        raise AssertionError(
            f"unexpected call to list_all_entities with entity={entity},args={args},params={params}"
        )

    mock_metadata.list_all_entities.side_effect = list_all_entities

    def get_by_id_side_effect(entity, entity_id):
        if entity == TestSuite:
            try:
                return next(ts for ts in TEST_SUITES if ts.id.root == entity_id)
            except StopIteration:
                raise AssertionError(f"test suite with id={entity_id} not found")
        raise AssertionError(
            f"unexpected call to get_by_id with entity={entity},entity_id={entity_id}"
        )

    mock_metadata.get_by_id.side_effect = get_by_id_side_effect

    return mock_metadata


@dataclass
class TestParameters:
    service_name: str
    source_config: dict


@pytest.mark.parametrize(
    "parameters,expected",
    [
        (
            TestParameters(
                "table_test_suite",
                {
                    "type": "TestSuite",
                    "entityFullyQualifiedName": "sample_data.ecommerce_db.shopify.dim_address",
                },
            ),
            [["test_case1", "test_case2"]],
        ),
        (
            TestParameters(
                "logical_test_suite",
                {
                    "type": "TestSuite",
                },
            ),
            [["test_case1"], ["test_case3"]],
        ),
    ],
)
def test_logical_test_suite(parameters, expected, monkeypatch, mock_metadata):
    workflow_config = {
        "source": {
            "type": "TestSuite",
            "serviceName": parameters.service_name,
            "sourceConfig": {"config": parameters.source_config},
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

    source = TestSuiteSource(
        OpenMetadataWorkflowConfig.parse_obj(workflow_config), mock_metadata
    )
    result = list(source._iter())
    for item in result:
        assert item.left is None
    results = [item.right for item in result]
    test_cases = [r.test_cases for r in results]
    by_name = [[tc.name.root for tc in t] for t in test_cases]
    assert sorted(map(sorted, by_name)) == sorted(map(sorted, expected))
