import sys
from typing import List

import pytest

from metadata.generated.schema.entity.services.databaseService import DatabaseService
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
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.basic import ComponentConfig
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.data_quality import TestSuiteWorkflow

if not sys.version_info >= (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


@pytest.fixture(scope="module")
def run_data_quality_workflow(
    ingest_metadata, db_service: DatabaseService, metadata: OpenMetadata
):
    workflow_config = OpenMetadataWorkflowConfig(
        source=Source(
            type=TestSuiteConfigType.TestSuite.value,
            serviceName="MyTestSuite",
            sourceConfig=SourceConfig(
                config=TestSuitePipeline(
                    type=TestSuiteConfigType.TestSuite,
                    entityFullyQualifiedName=f"{db_service.fullyQualifiedName.root}.dvdrental.public.customer",
                )
            ),
            serviceConnection=db_service.connection,
        ),
        processor=Processor(
            type="orm-test-runner",
            config=ComponentConfig(
                {
                    "testCases": [
                        {
                            "name": "first_name_includes_tom_and_jerry_wo_enum",
                            "testDefinitionName": "columnValuesToBeInSet",
                            "columnName": "first_name",
                            "parameterValues": [
                                {"name": "allowedValues", "value": "['Tom', 'Jerry']"}
                            ],
                        },
                        {
                            "name": "first_name_includes_tom_and_jerry",
                            "testDefinitionName": "columnValuesToBeInSet",
                            "columnName": "first_name",
                            "parameterValues": [
                                {"name": "allowedValues", "value": "['Tom', 'Jerry']"},
                                {"name": "matchEnum", "value": ""},
                            ],
                        },
                        {
                            "name": "first_name_is_tom_or_jerry",
                            "testDefinitionName": "columnValuesToBeInSet",
                            "columnName": "first_name",
                            "parameterValues": [
                                {"name": "allowedValues", "value": "['Tom', 'Jerry']"},
                                {"name": "matchEnum", "value": "True"},
                            ],
                        },
                    ],
                }
            ),
        ),
        sink=Sink(
            type="metadata-rest",
            config={},
        ),
        workflowConfig=WorkflowConfig(
            loggerLevel=LogLevels.DEBUG, openMetadataServerConfig=metadata.config
        ),
    )
    test_suite_procesor = TestSuiteWorkflow.create(workflow_config)
    test_suite_procesor.execute()
    test_suite_procesor.raise_from_status()


@pytest.mark.parametrize(
    "test_case_name,expected_status",
    [
        ("first_name_includes_tom_and_jerry_wo_enum", TestCaseStatus.Success),
        ("first_name_includes_tom_and_jerry", TestCaseStatus.Success),
        ("first_name_is_tom_or_jerry", TestCaseStatus.Failed),
    ],
)
def test_data_quality(
    run_data_quality_workflow, metadata: OpenMetadata, test_case_name, expected_status
):
    test_cases: List[TestCase] = metadata.list_entities(
        TestCase, fields=["*"], skip_on_failure=True
    ).entities
    test_case: TestCase = next(
        (t for t in test_cases if t.name.root == test_case_name), None
    )
    assert test_case is not None
    assert test_case.testCaseResult.testCaseStatus == expected_status
