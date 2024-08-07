import sys

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuiteConfigType,
)
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
            "type": TestSuiteConfigType.TestSuite.value,
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
