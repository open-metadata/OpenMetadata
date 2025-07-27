"""Data quality integration tests"""
import json
import sys
from pathlib import Path

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    List,
    TestSuiteConfigType,
)
from metadata.ingestion.ometa.routes import TestDefinition
from metadata.workflow.data_quality import TestSuiteWorkflow

if not sys.version_info >= (3, 9):
    pytest.skip(
        "requires python 3.9+ due to incompatibility with testcontainers",
        allow_module_level=True,
    )


def test_empty_test_suite(
    postgres_service: DatabaseService,
    run_workflow,
    ingest_postgres_metadata,
    patch_passwords_for_db_services,
    metadata,
    sink_config,
    workflow_config,
    cleanup_fqns,
):
    table = metadata.get_by_name(
        Table,
        f"{postgres_service.fullyQualifiedName.root}.dvdrental.public.customer",
        nullable=False,
    )
    workflow_config = {
        "source": {
            "type": "postgres",
            "serviceName": "MyTestSuite",
            "sourceConfig": {
                "config": {
                    "type": TestSuiteConfigType.TestSuite.value,
                    "entityFullyQualifiedName": table.fullyQualifiedName.root,
                }
            },
        },
        "processor": {
            "type": "orm-test-runner",
            "config": {"testCases": []},
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }
    run_workflow(TestSuiteWorkflow, workflow_config)


def test_all_definition_exists(metadata):
    """Test that all test definitions defined in json schema exist in the platform."""
    cwd = Path(__file__).resolve().parent
    test_definition_path = (
        cwd.parents[3] / "openmetadata-service/src/main/resources/json/data/tests"
    )
    test_difinitions_glob = test_definition_path.glob("*.json")

    test_definitions_names: List[str] = []
    for test_definition_file in test_difinitions_glob:
        with open(test_definition_file, encoding="utf-8") as fle:
            test_definitions_names.append(json.load(fle)["name"])
    assert len(test_definitions_names) > 0

    for name in test_definitions_names:
        test_definition = metadata.get_by_name(TestDefinition, name)
        assert test_definition is not None
