import sys
from typing import List

import pytest

from _openmetadata_testutils.pydantic.test_utils import assert_equal_pydantic_objects
from metadata.data_quality.api.models import TestCaseDefinition
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuiteConfigType,
    TestSuitePipeline,
)
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.data_quality import TestSuiteWorkflow
from metadata.workflow.metadata import MetadataWorkflow

if not sys.version_info >= (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


@pytest.fixture()
def get_test_suite_config(workflow_config, sink_config):
    def inner(entity_fqn: str, test_case_definitions: List[TestCaseDefinition]):
        return {
            "source": {
                "type": TestSuiteConfigType.TestSuite.value,
                "serviceName": "MyTestSuite",
                "sourceConfig": {
                    "config": TestSuitePipeline(
                        type=TestSuiteConfigType.TestSuite,
                        entityFullyQualifiedName=entity_fqn,
                    )
                },
            },
            "processor": {
                "type": "orm-test-runner",
                "config": {
                    "testCases": [obj.model_dump() for obj in test_case_definitions]
                },
            },
            "sink": sink_config,
            "workflowConfig": workflow_config,
        }

    return inner


@pytest.mark.parametrize(
    "test_case_definition,expected_result",
    [
        (
            TestCaseDefinition(
                name="first_name_includes_tom_and_jerry_wo_enum",
                testDefinitionName="columnValuesToBeInSet",
                computePassedFailedRowCount=True,
                columnName="first_name",
                parameterValues=[
                    {"name": "allowedValues", "value": "['Tom', 'Jerry']"}
                ],
            ),
            TestCaseResult(
                testCaseStatus=TestCaseStatus.Failed,
            ),
        ),
        (
            TestCaseDefinition(
                name="value_lengths_between_3_and_5",
                testDefinitionName="columnValueLengthsToBeBetween",
                computePassedFailedRowCount=True,
                columnName="first_name",
                parameterValues=[
                    {"name": "minLength", "value": "3"},
                    {"name": "maxLength", "value": "5"},
                ],
            ),
            TestCaseResult(
                testCaseStatus=TestCaseStatus.Failed,
            ),
        ),
        (
            TestCaseDefinition(
                name="value_lengths_at_most_5",
                testDefinitionName="columnValueLengthsToBeBetween",
                columnName="first_name",
                computePassedFailedRowCount=True,
                parameterValues=[
                    {"name": "maxLength", "value": "5"},
                ],
            ),
            TestCaseResult(
                testCaseStatus=TestCaseStatus.Failed,
            ),
        ),
        (
            TestCaseDefinition(
                name="value_lengths_at_least_3",
                testDefinitionName="columnValueLengthsToBeBetween",
                columnName="first_name",
                computePassedFailedRowCount=True,
                parameterValues=[
                    {"name": "minLength", "value": "3"},
                ],
            ),
            TestCaseResult(
                testCaseStatus=TestCaseStatus.Success,
            ),
        ),
        (
            TestCaseDefinition(
                name="id_at_least_0",
                testDefinitionName="columnValuesToBeBetween",
                columnName="emp_no",
                computePassedFailedRowCount=True,
                parameterValues=[
                    {"name": "minValue", "value": "0"},
                ],
            ),
            TestCaseResult(
                testCaseStatus=TestCaseStatus.Success,
            ),
        ),
        (
            TestCaseDefinition(
                name="id_no_bounds",
                testDefinitionName="columnValuesToBeBetween",
                columnName="emp_no",
                computePassedFailedRowCount=True,
                parameterValues=[],
            ),
            TestCaseResult(
                testCaseStatus=TestCaseStatus.Success,
            ),
        ),
    ],
    ids=lambda x: (
        x.name if isinstance(x, TestCaseDefinition) else x.testCaseStatus.value
    ),
)
def test_column_test_cases(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    db_service: DatabaseService,
    metadata: OpenMetadata,
    test_case_definition: TestCaseDefinition,
    expected_result: TestCaseResult,
    get_test_suite_config,
    cleanup_fqns,
):
    run_workflow(MetadataWorkflow, ingestion_config)
    table: Table = metadata.get_by_name(
        Table,
        ".".join(
            [
                db_service.fullyQualifiedName.root,
                "default",
                "employees",
                "employees",
            ]
        ),
        nullable=False,
    )
    test_suite_config = get_test_suite_config(
        table.fullyQualifiedName.root,
        [test_case_definition],
    )
    run_workflow(TestSuiteWorkflow, test_suite_config)
    test_case: TestCase = metadata.get_by_name(
        TestCase,
        f"{table.fullyQualifiedName.root}.{test_case_definition.columnName}.{test_case_definition.name}",
        fields=["*"],
        nullable=False,
    )
    cleanup_fqns(TestCase, test_case.fullyQualifiedName.root)
    assert_equal_pydantic_objects(
        expected_result,
        test_case.testCaseResult,
    )
