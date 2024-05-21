import sys
from typing import Collection, List, Tuple

import pytest

from metadata.data_quality.api.models import (
    TestCaseDefinition,
    TestCaseParameterValue,
    TestSuiteProcessorConfig,
)
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
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.data_quality import TestSuiteWorkflow

if not sys.version_info >= (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


def parameteres_from_tuples(
    tup: Collection[Tuple[str, str]]
) -> List[TestCaseParameterValue]:
    return [TestCaseParameterValue(name=v[0], value=v[1]) for v in tup]


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
                    entityFullyQualifiedName=f"{db_service.fullyQualifiedName.__root__}.dvdrental.public.customer",
                )
            ),
            serviceConnection=db_service.connection,
        ),
        processor=Processor(
            type="orm-test-runner",
            config=TestSuiteProcessorConfig(
                testCases=[
                    TestCaseDefinition(
                        name="first_name_includes_tom_and_jerry_wo_enum",
                        testDefinitionName="columnValuesToBeInSet",
                        columnName="first_name",
                        parameterValues=parameteres_from_tuples(
                            [
                                ("allowedValues", "['Tom', 'Jerry']"),
                            ]
                        ),
                    ),
                    TestCaseDefinition(
                        name="first_name_includes_tom_and_jerry",
                        testDefinitionName="columnValuesToBeInSet",
                        columnName="first_name",
                        parameterValues=parameteres_from_tuples(
                            [
                                ("allowedValues", "['Tom', 'Jerry']"),
                                ("matchEnum", ""),
                            ]
                        ),
                    ),
                    TestCaseDefinition(
                        name="first_name_is_tom_or_jerry",
                        testDefinitionName="columnValuesToBeInSet",
                        columnName="first_name",
                        parameterValues=parameteres_from_tuples(
                            [
                                ("allowedValues", "['Tom', 'Jerry']"),
                                ("matchEnum", "True"),
                            ]
                        ),
                    ),
                ]
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
        (t for t in test_cases if t.name.__root__ == test_case_name), None
    )
    assert test_case is not None
    assert test_case.testCaseResult.testCaseStatus == expected_status
