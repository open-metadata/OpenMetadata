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
Integration tests for Table Rule Library SQL Expression validator on MySQL
"""
from dataclasses import dataclass
from typing import List

import pytest

from metadata.data_quality.api.models import TestCaseDefinition
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
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

from ..integration_base import generate_name


@pytest.fixture(scope="module")
def mysql_table_rule_library_test_definition(
    metadata: OpenMetadata,
) -> TestDefinition:
    """Create a table-level rule library test definition for MySQL SQL expression validation.

    This uses EntityType.TABLE and only supports {{ table_name }} parameter.
    """
    test_def_name = TestCaseEntityName(generate_name().root)
    test_def = metadata.create_or_update(
        CreateTestDefinitionRequest(
            name=test_def_name,
            description=Markdown(
                root="Table-level rule library test definition for custom SQL expression validation"
            ),
            entityType=EntityType.TABLE,
            testPlatforms=[TestPlatform.OpenMetadata],
            parameterDefinition=[
                TestCaseParameterDefinition(
                    name="minEmpNo",
                    displayName="Minimum Employee Number",
                    dataType="INT",
                    description="Minimum employee number for comparison",
                    required=False,
                ),
            ],
            sqlExpression=SqlQuery(
                root="SELECT * FROM {{ table_name }} WHERE emp_no > {{ minEmpNo }}"
            ),
            validatorClass="TableRuleLibrarySqlExpressionValidator",
        )
    )
    yield test_def
    metadata.delete(TestDefinition, test_def.id, hard_delete=True)


@pytest.fixture()
def get_mysql_table_rule_library_test_suite_config(workflow_config, sink_config):
    def inner(entity_fqn: str, test_case_definitions: List[TestCaseDefinition]):
        return {
            "source": {
                "type": "mysql",
                "serviceName": "MySQLTableRuleLibraryTestSuite",
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


@dataclass
class MySQLTableRuleLibraryTestParameter:
    entity_fqn: str
    test_case_definition: TestCaseDefinition
    expected_status: TestCaseStatus


@pytest.fixture(
    params=[
        MySQLTableRuleLibraryTestParameter(
            entity_fqn="{database_service_fqn}.default.employees.employees",
            test_case_definition=TestCaseDefinition(
                name="mysql_table_rule_library_emp_no_greater_than_zero",
                testDefinitionName="{test_def_name}",
                parameterValues=[{"name": "minEmpNo", "value": "0"}],
            ),
            expected_status=TestCaseStatus.Failed,
        ),
        MySQLTableRuleLibraryTestParameter(
            entity_fqn="{database_service_fqn}.default.employees.employees",
            test_case_definition=TestCaseDefinition(
                name="mysql_table_rule_library_emp_no_greater_than_max",
                testDefinitionName="{test_def_name}",
                parameterValues=[{"name": "minEmpNo", "value": "99999999"}],
            ),
            expected_status=TestCaseStatus.Success,
        ),
    ],
    ids=lambda x: x.test_case_definition.name,
)
def mysql_table_rule_library_parameters(
    request, db_service, mysql_table_rule_library_test_definition
):
    request.param.entity_fqn = request.param.entity_fqn.format(
        database_service_fqn=db_service.fullyQualifiedName.root
    )
    request.param.test_case_definition.testDefinitionName = (
        mysql_table_rule_library_test_definition.name.root
    )
    return request.param


def test_mysql_table_rule_library_sql_expression_validator(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    db_service: DatabaseService,
    metadata: OpenMetadata,
    mysql_table_rule_library_parameters: MySQLTableRuleLibraryTestParameter,
    get_mysql_table_rule_library_test_suite_config,
    cleanup_fqns,
    mysql_table_rule_library_test_definition,
):
    """Test the Table Rule Library SQL Expression validator on MySQL with various scenarios.

    Tests validate that:
    1. The Jinja2 template compilation works correctly with only table_name
    2. SQLAlchemy bind parameters are properly substituted
    3. The row count returns correct values
    4. Test case status is correctly determined based on row count (0 = success)
    """
    run_workflow(MetadataWorkflow, ingestion_config)

    test_suite_config = get_mysql_table_rule_library_test_suite_config(
        mysql_table_rule_library_parameters.entity_fqn,
        [mysql_table_rule_library_parameters.test_case_definition],
    )

    run_workflow(TestSuiteWorkflow, test_suite_config)

    test_case_fqn = (
        f"{mysql_table_rule_library_parameters.entity_fqn}."
        f"{mysql_table_rule_library_parameters.test_case_definition.name}"
    )

    test_case: TestCase = metadata.get_by_name(
        TestCase,
        test_case_fqn,
        fields=["*"],
        nullable=False,
    )

    cleanup_fqns(TestCase, test_case.fullyQualifiedName.root)

    assert test_case.testCaseResult is not None
    assert (
        test_case.testCaseResult.testCaseStatus
        == mysql_table_rule_library_parameters.expected_status
    )
