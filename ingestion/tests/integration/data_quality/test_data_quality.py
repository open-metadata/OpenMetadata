import sys
from unittest import TestSuite

import pytest
from pydantic import BaseModel
from sqlalchemy import VARBINARY
from sqlalchemy import Column as SQAColumn
from sqlalchemy import MetaData
from sqlalchemy import Table as SQATable
from sqlalchemy import create_engine
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine import Connection, make_url
from sqlalchemy.sql import sqltypes

from _openmetadata_testutils.postgres.conftest import postgres_container
from _openmetadata_testutils.pydantic.test_utils import assert_equal_pydantic_objects
from metadata.data_quality.api.models import TestCaseDefinition
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuiteConfigType,
    TestSuitePipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    LogLevels,
    OpenMetadataWorkflowConfig,
    Processor,
    Sink,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.data_quality import TestSuiteWorkflow
from metadata.workflow.metadata import MetadataWorkflow

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
    cleanup_fqns(
        TestSuite,
        f"{postgres_service.fullyQualifiedName.root}.dvdrental.public.customer.test_suite",
    )
