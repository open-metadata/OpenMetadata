# Test cases for data quality workflow
import sys
from dataclasses import dataclass
from typing import List

import pytest

from _openmetadata_testutils.pydantic.test_utils import assert_equal_pydantic_objects
from metadata.data_quality.api.models import TestCaseDefinition
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    ServiceConnections,
    TestSuiteConfigType,
    TestSuitePipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
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
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.generated.schema.type.basic import ComponentConfig
from metadata.ingestion.api.status import TruncatedStackTraceError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.data_quality import TestSuiteWorkflow
from metadata.workflow.metadata import MetadataWorkflow

if not sys.version_info >= (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


@pytest.fixture(scope="module")
def run_data_quality_workflow(
    run_workflow,
    ingestion_config,
    db_service: DatabaseService,
    metadata: OpenMetadata,
    sink_config,
    workflow_config,
):
    run_workflow(MetadataWorkflow, ingestion_config)
    test_suite_config = OpenMetadataWorkflowConfig(
        source=Source(
            type="postgres",
            serviceName="MyTestSuite",
            sourceConfig=SourceConfig(
                config=TestSuitePipeline(
                    type=TestSuiteConfigType.TestSuite,
                    entityFullyQualifiedName=f"{db_service.fullyQualifiedName.root}.dvdrental.public.customer",
                    serviceConnections=[
                        ServiceConnections(
                            serviceName=db_service.name.root,
                            serviceConnection=db_service.connection,
                        )
                    ],
                )
            ),
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
                            "computePassedFailedRowCount": True,
                        },
                        {
                            "name": "first_name_includes_tom_and_jerry",
                            "testDefinitionName": "columnValuesToBeInSet",
                            "columnName": "first_name",
                            "parameterValues": [
                                {"name": "allowedValues", "value": "['Tom', 'Jerry']"},
                                {"name": "matchEnum", "value": "false"},
                            ],
                        },
                        {
                            "name": "first_name_is_tom_or_jerry",
                            "testDefinitionName": "columnValuesToBeInSet",
                            "columnName": "first_name",
                            "parameterValues": [
                                {"name": "allowedValues", "value": "['Tom', 'Jerry']"},
                                {"name": "matchEnum", "value": "true"},
                            ],
                        },
                        {
                            "name": "id_no_bounds",
                            "testDefinitionName": "columnValuesToBeBetween",
                            "columnName": "customer_id",
                            "parameterValues": [],
                        },
                        {
                            "name": "column_values_not_match_regex",
                            "testDefinitionName": "columnValuesToNotMatchRegex",
                            "columnName": "email",
                            "parameterValues": [
                                {"name": "forbiddenRegex", "value": ".*@example\\.com$"}
                            ],
                        },
                        {
                            "name": "table_column_count_between",
                            "testDefinitionName": "tableColumnCountToBeBetween",
                            "parameterValues": [
                                {"name": "minColValue", "value": "8"},
                                {"name": "maxColValue", "value": "12"},
                            ],
                        },
                        {
                            "name": "table_column_count_equal",
                            "testDefinitionName": "tableColumnCountToEqual",
                            "parameterValues": [{"name": "columnCount", "value": "11"}],
                        },
                        {
                            "name": "table_column_name_exists",
                            "testDefinitionName": "tableColumnNameToExist",
                            "parameterValues": [
                                {"name": "columnName", "value": "customer_id"}
                            ],
                        },
                        {
                            "name": "table_column_names_match_set",
                            "testDefinitionName": "tableColumnToMatchSet",
                            "parameterValues": [
                                {
                                    "name": "columnNames",
                                    "value": "customer_id, store_id, first_name, last_name, email, address_id, activebool, create_date, last_update, active, json_field",
                                },
                                {"name": "ordered", "value": "false"},
                            ],
                        },
                        {
                            "name": "custom_sql_query_count",
                            "testDefinitionName": "tableCustomSQLQuery",
                            "parameterValues": [
                                {
                                    "name": "sqlExpression",
                                    "value": "SELECT CASE WHEN COUNT(*) > 0 THEN 0 ELSE 1 END FROM customer WHERE active = 1",
                                },
                                {"name": "strategy", "value": "COUNT"},
                                {"name": "threshold", "value": "0"},
                            ],
                        },
                        {
                            "name": "custom_sql_query_rows",
                            "testDefinitionName": "tableCustomSQLQuery",
                            "parameterValues": [
                                {
                                    "name": "sqlExpression",
                                    "value": "SELECT * FROM customer WHERE active = 1",
                                },
                                {"name": "strategy", "value": "ROWS"},
                                {"name": "threshold", "value": "10"},
                            ],
                        },
                        {
                            "name": "table_row_count_between",
                            "testDefinitionName": "tableRowCountToBeBetween",
                            "parameterValues": [
                                {"name": "minValue", "value": "100"},
                                {"name": "maxValue", "value": "1000"},
                            ],
                        },
                        {
                            "name": "table_row_count_equal",
                            "testDefinitionName": "tableRowCountToEqual",
                            "parameterValues": [{"name": "value", "value": "599"}],
                        },
                        {
                            "name": "table_row_inserted_count_between_fail",
                            "testDefinitionName": "tableRowInsertedCountToBeBetween",
                            "parameterValues": [
                                {"name": "min", "value": "10"},
                                {"name": "max", "value": "50"},
                                {"name": "columnName", "value": "create_date"},
                                {"name": "rangeType", "value": "DAY"},
                                {"name": "rangeInterval", "value": "1"},
                            ],
                        },
                        {
                            "name": "table_row_inserted_count_between_success",
                            "testDefinitionName": "tableRowInsertedCountToBeBetween",
                            "parameterValues": [
                                {"name": "min", "value": "590"},
                                {"name": "max", "value": "600"},
                                {"name": "columnName", "value": "last_update"},
                                {"name": "rangeType", "value": "YEAR"},
                                {"name": "rangeInterval", "value": "50"},
                            ],
                        },
                    ],
                }
            ),
        ),
        sink=Sink.model_validate(sink_config),
        workflowConfig=WorkflowConfig.model_validate(workflow_config),
    )
    test_suite_processor = TestSuiteWorkflow.create(test_suite_config)
    test_suite_processor.execute()
    test_suite_processor.raise_from_status()
    yield
    test_suite: TestSuite = metadata.get_by_name(
        TestSuite, "MyTestSuite", nullable=True
    )
    if test_suite:
        metadata.delete(TestSuite, test_suite.id, recursive=True, hard_delete=True)


@pytest.mark.parametrize(
    "test_case_name,expected_status",
    [
        (
            "first_name_includes_tom_and_jerry_wo_enum",
            TestCaseResult(
                timestamp=0,
                testCaseStatus=TestCaseStatus.Success,
                passedRows=2,
                failedRows=597,
            ),
        ),
        (
            "first_name_includes_tom_and_jerry",
            TestCaseResult(timestamp=0, testCaseStatus=TestCaseStatus.Success),
        ),
        (
            "first_name_is_tom_or_jerry",
            TestCaseResult(timestamp=0, testCaseStatus=TestCaseStatus.Failed),
        ),
        (
            "id_no_bounds",
            TestCaseResult(timestamp=0, testCaseStatus=TestCaseStatus.Success),
        ),
        (
            "column_values_not_match_regex",
            TestCaseResult(timestamp=0, testCaseStatus=TestCaseStatus.Success),
        ),
        (
            "table_column_count_between",
            TestCaseResult(
                timestamp=0,
                testCaseStatus=TestCaseStatus.Success,
                testResultValue=[TestResultValue(name="columnCount", value="11")],
            ),
        ),
        (
            "table_column_count_equal",
            TestCaseResult(
                timestamp=0,
                testCaseStatus=TestCaseStatus.Success,
                testResultValue=[TestResultValue(name="columnCount", value="11")],
            ),
        ),
        (
            "table_column_name_exists",
            TestCaseResult(timestamp=0, testCaseStatus=TestCaseStatus.Success),
        ),
        (
            "table_column_names_match_set",
            TestCaseResult(timestamp=0, testCaseStatus=TestCaseStatus.Success),
        ),
        (
            "custom_sql_query_count",
            TestCaseResult(timestamp=0, testCaseStatus=TestCaseStatus.Success),
        ),
        (
            "custom_sql_query_rows",
            TestCaseResult(
                timestamp=0,
                testCaseStatus=TestCaseStatus.Failed,
                testResultValues=[{"name": "resultRowCount", "value": "599"}],
            ),
        ),
        (
            "table_row_count_between",
            TestCaseResult(
                timestamp=0,
                testCaseStatus=TestCaseStatus.Success,
                testResultValue=[TestResultValue(name="rowCount", value="599")],
            ),
        ),
        (
            "table_row_count_equal",
            TestCaseResult(timestamp=0, testCaseStatus=TestCaseStatus.Success),
        ),
        (
            "table_row_inserted_count_between_fail",
            TestCaseResult(timestamp=0, testCaseStatus=TestCaseStatus.Failed),
        ),
        (
            "table_row_inserted_count_between_success",
            TestCaseResult(timestamp=0, testCaseStatus=TestCaseStatus.Success),
        ),
    ],
    ids=lambda *x: x[0],
)
def test_data_quality(
    run_data_quality_workflow,
    metadata: OpenMetadata,
    test_case_name,
    expected_status,
    db_service,
):
    test_cases: List[TestCase] = metadata.list_entities(
        TestCase, fields=["*"], skip_on_failure=True
    ).entities
    test_case: TestCase = next(
        (
            t
            for t in test_cases
            if t.name.root == test_case_name
            and "dvdrental.public.customer" in t.entityFQN
        ),
        None,
    )
    assert test_case is not None
    assert_equal_pydantic_objects(
        expected_status.model_copy(
            update={"timestamp": test_case.testCaseResult.timestamp}
        ),
        test_case.testCaseResult,
    )


@pytest.fixture()
def get_incompatible_column_type_config(workflow_config, sink_config):
    def inner(entity_fqn: str, incompatible_test_case: TestCaseDefinition):
        return {
            "source": {
                "type": "postgres",
                "serviceName": "MyTestSuite",
                "sourceConfig": {
                    "config": {
                        "type": "TestSuite",
                        "entityFullyQualifiedName": entity_fqn,
                    }
                },
            },
            "processor": {
                "type": "orm-test-runner",
                "config": {
                    "testCases": [
                        incompatible_test_case.model_dump(),
                        {
                            "name": "compatible_test",
                            "testDefinitionName": "columnValueMaxToBeBetween",
                            "columnName": "customer_id",
                            "parameterValues": [
                                {"name": "minValueForMaxInCol", "value": "0"},
                                {"name": "maxValueForMaxInCol", "value": "10"},
                            ],
                        },
                    ]
                },
            },
            "sink": sink_config,
            "workflowConfig": workflow_config,
        }

    return inner


@dataclass
class IncompatibleTypeParameter:
    entity_fqn: str
    test_case: TestCaseDefinition
    expected_failure: TruncatedStackTraceError


@pytest.fixture(
    params=[
        IncompatibleTypeParameter(
            entity_fqn="{database_service}.dvdrental.public.customer",
            test_case=TestCaseDefinition(
                name="string_max_between",
                testDefinitionName="columnValueMaxToBeBetween",
                columnName="first_name",
                parameterValues=[
                    {"name": "minValueForMaxInCol", "value": "0"},
                    {"name": "maxValueForMaxInCol", "value": "10"},
                ],
            ),
            expected_failure=TruncatedStackTraceError(
                name="Incompatible Column for Test Case",
                error="Test case string_max_between of type columnValueMaxToBeBetween "
                "is not compatible with column first_name of type VARCHAR",
            ),
        ),
        IncompatibleTypeParameter(
            entity_fqn="{database_service}.dvdrental.public.customer",
            test_case=TestCaseDefinition(
                name="unique_json_column",
                testDefinitionName="columnValuesToBeUnique",
                columnName="json_field",
            ),
            expected_failure=TruncatedStackTraceError(
                name="Incompatible Column for Test Case",
                error="Test case unique_json_column of type columnValuesToBeUnique "
                "is not compatible with column json_field of type JSON",
            ),
        ),
    ],
    ids=lambda x: x.test_case.name,
)
def parameters(request, db_service):
    request.param.entity_fqn = request.param.entity_fqn.format(
        database_service=db_service.fullyQualifiedName.root
    )
    return request.param


def test_incompatible_column_type(
    parameters: IncompatibleTypeParameter,
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    get_incompatible_column_type_config,
    metadata: OpenMetadata,
    db_service,
    cleanup_fqns,
):
    run_workflow(MetadataWorkflow, ingestion_config)
    test_suite_processor = run_workflow(
        TestSuiteWorkflow,
        get_incompatible_column_type_config(
            parameters.entity_fqn, parameters.test_case
        ),
        raise_from_status=False,
    )
    cleanup_fqns(
        TestCase,
        f"{parameters.entity_fqn}.{parameters.test_case.columnName}.{parameters.test_case.name}",
    )
    assert_equal_pydantic_objects(
        parameters.expected_failure,
        test_suite_processor.steps[0].get_status().failures[0],
    )
    assert (
        f"{db_service.fullyQualifiedName.root}.dvdrental.public.customer.customer_id.compatible_test"
        in test_suite_processor.steps[1].get_status().records
    ), "Test case compatible_test should pass"
