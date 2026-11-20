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
"""
Integration tests for Table Rule Library SQL Expression validator on PostgreSQL
"""

from dataclasses import dataclass

import pytest

from metadata.data_quality.api.models import TestCaseDefinition
from metadata.data_quality.validations.mixins.failed_row_sampler_mixin import (
    FAILED_ROW_SAMPLE_SIZE,
)
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuiteConfigType,
    TestSuitePipeline,
)
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import (
    EntityType,
    TestCaseParameterDefinition,
    TestDefinition,
    TestPlatform,
)
from metadata.generated.schema.type.basic import Markdown, SqlQuery, TestCaseEntityName
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.data_quality import TestSuiteWorkflow
from metadata.workflow.metadata import MetadataWorkflow

from ..integration_base import generate_name  # noqa: TID252


@pytest.fixture(scope="module")
def table_rule_library_test_definition(
    metadata: OpenMetadata,
) -> TestDefinition:
    """Create a table-level rule library test definition for SQL expression validation.

    This uses EntityType.TABLE and only supports {{ table_name }} parameter.
    """
    test_def_name = TestCaseEntityName(generate_name().root)
    test_def = metadata.create_or_update(
        CreateTestDefinitionRequest(
            name=test_def_name,
            description=Markdown(root="Table-level rule library test definition for custom SQL expression validation"),
            entityType=EntityType.TABLE,
            testPlatforms=[TestPlatform.OpenMetadata],
            parameterDefinition=[
                TestCaseParameterDefinition(
                    name="minCustomerId",
                    displayName="Minimum Customer ID",
                    dataType="INT",
                    description="Minimum customer ID for comparison",
                    required=False,
                ),
                TestCaseParameterDefinition(
                    name="threshold",
                    displayName="Failure Threshold",
                    dataType="NUMBER",
                    required=False,
                ),
                TestCaseParameterDefinition(
                    name="thresholdUnit",
                    displayName="Threshold Unit",
                    dataType="STRING",
                    required=False,
                    optionValues=["ABSOLUTE", "PERCENTAGE"],
                ),
            ],
            sqlExpression=SqlQuery(root="SELECT * FROM {{ table_name }} WHERE customer_id > {{ minCustomerId }}"),
            validatorClass="TableRuleLibrarySqlExpressionValidator",
        )
    )
    yield test_def
    metadata.delete(TestDefinition, test_def.id, hard_delete=True)


@pytest.fixture(scope="module")
def aggregate_rule_library_test_definition(metadata: OpenMetadata) -> TestDefinition:
    """A rule whose output is an aggregate, not the table's columns"""
    test_def = metadata.create_or_update(
        CreateTestDefinitionRequest(
            name=TestCaseEntityName(generate_name().root),
            description=Markdown(root="Customers per store"),
            entityType=EntityType.TABLE,
            testPlatforms=[TestPlatform.OpenMetadata],
            parameterDefinition=[],
            sqlExpression=SqlQuery(
                root="SELECT store_id, COUNT(*) AS customers FROM {{ table_name }} GROUP BY store_id"
            ),
            validatorClass="TableRuleLibrarySqlExpressionValidator",
        )
    )
    yield test_def
    metadata.delete(TestDefinition, test_def.id, hard_delete=True)


@pytest.fixture()
def get_table_rule_library_test_suite_config(workflow_config, sink_config):
    def inner(entity_fqn: str, test_case_definitions: list[TestCaseDefinition]):
        return {
            "source": {
                "type": "postgres",
                "serviceName": "TableRuleLibraryTestSuite",
                "sourceConfig": {
                    "config": TestSuitePipeline(
                        type=TestSuiteConfigType.TestSuite,
                        entityFullyQualifiedName=entity_fqn,
                    )
                },
            },
            "processor": {
                "type": "orm-test-runner",
                "config": {"testCases": [obj.model_dump() for obj in test_case_definitions]},
            },
            "sink": sink_config,
            "workflowConfig": workflow_config,
        }

    return inner


@dataclass
class TableRuleLibraryTestParameter:
    entity_fqn: str
    test_case_definition: TestCaseDefinition
    expected_status: TestCaseStatus
    # Rows in the stored failed rows sample, None when no sample is stored
    expected_sample_rows: int | None
    expected_inspection_query: SqlQuery | None


@pytest.fixture(
    params=[
        TableRuleLibraryTestParameter(
            entity_fqn="{database_service_fqn}.dvdrental.public.customer",
            test_case_definition=TestCaseDefinition(
                name="table_rule_library_customers_greater_than_zero",
                testDefinitionName="{test_def_name}",
                computePassedFailedRowCount=True,
                parameterValues=[{"name": "minCustomerId", "value": "0"}],
            ),
            expected_status=TestCaseStatus.Failed,
            expected_sample_rows=FAILED_ROW_SAMPLE_SIZE,
            expected_inspection_query=SqlQuery(root="SELECT * FROM dvdrental.public.customer WHERE customer_id > '0'"),
        ),
        TableRuleLibraryTestParameter(
            entity_fqn="{database_service_fqn}.dvdrental.public.customer",
            test_case_definition=TestCaseDefinition(
                name="table_rule_library_customers_greater_than_max",
                testDefinitionName="{test_def_name}",
                computePassedFailedRowCount=True,
                parameterValues=[{"name": "minCustomerId", "value": "99999"}],
            ),
            expected_status=TestCaseStatus.Success,
            expected_sample_rows=None,
            expected_inspection_query=None,
        ),
        TableRuleLibraryTestParameter(
            entity_fqn="{database_service_fqn}.dvdrental.public.customer",
            test_case_definition=TestCaseDefinition(
                name="table_rule_library_customers_threshold_tolerated_as_percentage",
                testDefinitionName="{test_def_name}",
                computePassedFailedRowCount=True,
                parameterValues=[
                    {"name": "minCustomerId", "value": "0"},
                    {"name": "threshold", "value": "100"},
                    {"name": "thresholdUnit", "value": "PERCENTAGE"},
                ],
            ),
            expected_status=TestCaseStatus.Success,
            expected_sample_rows=FAILED_ROW_SAMPLE_SIZE,
            expected_inspection_query=SqlQuery(root="SELECT * FROM dvdrental.public.customer WHERE customer_id > '0'"),
        ),
        TableRuleLibraryTestParameter(
            entity_fqn="{database_service_fqn}.dvdrental.public.customer",
            test_case_definition=TestCaseDefinition(
                name="table_rule_library_customers_threshold_above_percentage",
                testDefinitionName="{test_def_name}",
                computePassedFailedRowCount=True,
                parameterValues=[
                    {"name": "minCustomerId", "value": "0"},
                    {"name": "threshold", "value": "99"},
                    {"name": "thresholdUnit", "value": "PERCENTAGE"},
                ],
            ),
            expected_status=TestCaseStatus.Failed,
            expected_sample_rows=FAILED_ROW_SAMPLE_SIZE,
            expected_inspection_query=SqlQuery(root="SELECT * FROM dvdrental.public.customer WHERE customer_id > '0'"),
        ),
        TableRuleLibraryTestParameter(
            entity_fqn="{database_service_fqn}.dvdrental.public.customer",
            test_case_definition=TestCaseDefinition(
                name="table_rule_library_customers_threshold_tolerated_as_absolute",
                testDefinitionName="{test_def_name}",
                computePassedFailedRowCount=True,
                parameterValues=[
                    {"name": "minCustomerId", "value": "0"},
                    {"name": "threshold", "value": "1000000"},
                    {"name": "thresholdUnit", "value": "ABSOLUTE"},
                ],
            ),
            expected_status=TestCaseStatus.Success,
            expected_sample_rows=FAILED_ROW_SAMPLE_SIZE,
            expected_inspection_query=SqlQuery(root="SELECT * FROM dvdrental.public.customer WHERE customer_id > '0'"),
        ),
        TableRuleLibraryTestParameter(
            entity_fqn="{database_service_fqn}.dvdrental.public.payment",
            test_case_definition=TestCaseDefinition(
                name="table_rule_library_payments_greater_than_zero",
                testDefinitionName="{test_def_name}",
                computePassedFailedRowCount=True,
                parameterValues=[{"name": "minCustomerId", "value": "0"}],
            ),
            expected_status=TestCaseStatus.Failed,
            # payment holds numeric amounts and timestamps, which the sample must serialize
            expected_sample_rows=FAILED_ROW_SAMPLE_SIZE,
            expected_inspection_query=SqlQuery(root="SELECT * FROM dvdrental.public.payment WHERE customer_id > '0'"),
        ),
    ],
    ids=lambda x: x.test_case_definition.name,
)
def table_rule_library_parameters(request, db_service, table_rule_library_test_definition):
    request.param.entity_fqn = request.param.entity_fqn.format(database_service_fqn=db_service.fullyQualifiedName.root)
    request.param.test_case_definition.testDefinitionName = table_rule_library_test_definition.name.root
    return request.param


def test_table_rule_library_sql_expression_validator(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    db_service: DatabaseService,
    metadata: OpenMetadata,
    table_rule_library_parameters: TableRuleLibraryTestParameter,
    get_table_rule_library_test_suite_config,
    cleanup_fqns,
    table_rule_library_test_definition,
):
    """Test the Table Rule Library SQL Expression validator with various scenarios.

    Tests validate that:
    1. The Jinja2 template compilation works correctly with only table_name
    2. SQLAlchemy bind parameters are properly substituted
    3. The row count returns correct values
    4. Test case status is correctly determined based on row count (0 = success)
    """
    run_workflow(MetadataWorkflow, ingestion_config)

    test_suite_config = get_table_rule_library_test_suite_config(
        table_rule_library_parameters.entity_fqn,
        [table_rule_library_parameters.test_case_definition],
    )

    run_workflow(TestSuiteWorkflow, test_suite_config)

    test_case_fqn = (
        f"{table_rule_library_parameters.entity_fqn}.{table_rule_library_parameters.test_case_definition.name}"
    )

    test_case: TestCase = metadata.get_by_name(
        TestCase,
        test_case_fqn,
        fields=["*"],
        nullable=False,
    )

    cleanup_fqns(TestCase, test_case.fullyQualifiedName.root)

    assert test_case.testCaseResult is not None
    assert test_case.testCaseResult.testCaseStatus == table_rule_library_parameters.expected_status
    assert "Evaluated on the full table." in test_case.testCaseResult.result
    assert test_case.inspectionQuery == table_rule_library_parameters.expected_inspection_query

    failed_rows_sample = metadata.get_failed_rows_sample(test_case)
    if table_rule_library_parameters.expected_sample_rows is None:
        assert failed_rows_sample is None
        return
    table: Table = metadata.get_by_name(Table, table_rule_library_parameters.entity_fqn, nullable=False)
    assert failed_rows_sample is not None
    assert [column.root for column in failed_rows_sample.columns] == [column.name.root for column in table.columns]
    assert len(failed_rows_sample.rows) == table_rule_library_parameters.expected_sample_rows
    assert all(len(row) == len(table.columns) for row in failed_rows_sample.rows)


def test_aggregate_rule_output_is_not_stored_as_a_sample(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    db_service: DatabaseService,
    metadata: OpenMetadata,
    get_table_rule_library_test_suite_config,
    cleanup_fqns,
    aggregate_rule_library_test_definition,
):
    """The server masks a sample by column name, so output that names no column of the table is not stored"""
    run_workflow(MetadataWorkflow, ingestion_config)
    entity_fqn = f"{db_service.fullyQualifiedName.root}.dvdrental.public.customer"
    test_case_definition = TestCaseDefinition(
        name="table_rule_library_customers_per_store",
        testDefinitionName=aggregate_rule_library_test_definition.name.root,
        computePassedFailedRowCount=True,
    )

    run_workflow(TestSuiteWorkflow, get_table_rule_library_test_suite_config(entity_fqn, [test_case_definition]))

    test_case: TestCase = metadata.get_by_name(
        TestCase, f"{entity_fqn}.{test_case_definition.name}", fields=["*"], nullable=False
    )
    cleanup_fqns(TestCase, test_case.fullyQualifiedName.root)

    assert test_case.testCaseResult is not None
    assert test_case.testCaseResult.testCaseStatus == TestCaseStatus.Failed
    assert test_case.testCaseResult.testResultValue[0].value == "2"
    assert metadata.get_failed_rows_sample(test_case) is None
    assert test_case.inspectionQuery == SqlQuery(
        root="SELECT store_id, COUNT(*) AS customers FROM dvdrental.public.customer GROUP BY store_id"
    )
