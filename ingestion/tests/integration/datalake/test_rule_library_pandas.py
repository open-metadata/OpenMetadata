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
Integration tests for Rule Library Pandas Expression validator on Datalake (S3/MinIO)
"""
from copy import deepcopy

import pytest

from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.entity.data.table import DataType
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import (
    EntityType,
    TestCaseParameterDefinition,
    TestDefinition,
    TestPlatform,
)
from metadata.generated.schema.type.basic import Markdown, SqlQuery, TestCaseEntityName
from metadata.workflow.data_quality import TestSuiteWorkflow

BUCKET_NAME = "my-bucket"

NUMERIC_DATA_TYPES = [
    DataType.INT,
    DataType.BIGINT,
    DataType.SMALLINT,
    DataType.TINYINT,
    DataType.NUMBER,
    DataType.FLOAT,
    DataType.DOUBLE,
    DataType.DECIMAL,
    DataType.NUMERIC,
]


@pytest.fixture(scope="class")
def rule_library_pandas_test_definition(metadata) -> TestDefinition:
    """Create a rule library test definition for pandas expression validation.

    For Pandas sources, the 'sqlExpression' field contains a pandas query()
    expression (e.g., 'column >= 100'), not actual SQL. Parameters are
    directly substituted via Jinja2.
    """
    test_def = metadata.create_or_update(
        CreateTestDefinitionRequest(
            name=TestCaseEntityName("columnRuleLibrarySqlExpressionValidator"),
            description=Markdown(
                root="Rule library test definition for pandas query expression validation"
            ),
            entityType=EntityType.COLUMN,
            testPlatforms=[TestPlatform.OpenMetadata],
            supportedDataTypes=NUMERIC_DATA_TYPES,
            parameterDefinition=[
                TestCaseParameterDefinition(
                    name="minValue",
                    displayName="Minimum Value",
                    dataType="INT",
                    description="Minimum value for comparison",
                    required=False,
                ),
            ],
            # Pandas query expression syntax (not SQL)
            sqlExpression=SqlQuery(root="{{ column_name }} > {{ minValue }}"),
            validatorClass="ColumnRuleLibrarySqlExpressionValidator",
        )
    )
    yield test_def
    # Clean up: delete associated test cases first, then the test definition
    try:
        test_cases = metadata.list_entities(
            TestCase, fields=["*"], skip_on_failure=True
        ).entities
        for tc in test_cases:
            if tc.testDefinition and tc.testDefinition.name == test_def.name:
                try:
                    metadata.delete(TestCase, tc.id, hard_delete=True)
                except Exception:
                    pass  # Ignore cleanup errors for individual test cases
        metadata.delete(TestDefinition, test_def.id, hard_delete=True, recursive=True)
    except Exception:
        pass  # Ignore cleanup errors - test definition may be used by other tests


RULE_LIBRARY_DATA_QUALITY_CONFIG = {
    "source": {
        "type": "testsuite",
        "serviceName": "datalake_for_integration_tests",
        "serviceConnection": {
            "config": {
                "type": "Datalake",
                "configSource": {
                    "securityConfig": {
                        "awsAccessKeyId": "fake_access_key",
                        "awsSecretAccessKey": "fake_secret_key",
                        "awsRegion": "us-west-1",
                    }
                },
                "bucketName": f"{BUCKET_NAME}",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "TestSuite",
                "entityFullyQualifiedName": f'datalake_for_integration_tests.default.{BUCKET_NAME}."users/users.csv"',
            }
        },
    },
    "processor": {
        "type": "orm-test-runner",
        "config": {"testCases": []},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "loggerLevel": "DEBUG",
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        },
    },
}


class TestRuleLibraryPandas:
    """Integration tests for Rule Library Pandas Expression validator."""

    @pytest.fixture(scope="class")
    def run_rule_library_test_suite(
        self,
        run_ingestion,
        ingestion_config,
        rule_library_pandas_test_definition,
    ):
        """Run the rule library test suite with pandas expression tests."""
        workflow_config = deepcopy(RULE_LIBRARY_DATA_QUALITY_CONFIG)
        service_name = ingestion_config["source"]["serviceName"]
        workflow_config["source"]["serviceName"] = service_name
        workflow_config["source"]["sourceConfig"]["config"][
            "entityFullyQualifiedName"
        ] = f'{service_name}.default.{BUCKET_NAME}."users/users.csv"'
        workflow_config["source"]["sourceConfig"]["config"]["serviceConnections"] = [
            {
                "serviceName": service_name,
                "serviceConnection": ingestion_config["source"]["serviceConnection"],
            }
        ]
        # Test cases using pandas query expression syntax
        workflow_config["processor"]["config"]["testCases"] = [
            {
                "name": "rule_library_age_greater_than_35",
                "testDefinitionName": "columnRuleLibrarySqlExpressionValidator",
                "columnName": "age",
                "parameterValues": [{"name": "minValue", "value": "35"}],
            },
            {
                "name": "rule_library_age_greater_than_100",
                "testDefinitionName": "columnRuleLibrarySqlExpressionValidator",
                "columnName": "age",
                "parameterValues": [{"name": "minValue", "value": "100"}],
            },
        ]

        ingestion_workflow = TestSuiteWorkflow.create(workflow_config)
        ingestion_workflow.execute()
        ingestion_workflow.raise_from_status()
        ingestion_workflow.stop()

    @pytest.mark.parametrize(
        "test_case_name,expected_status",
        [
            # age > 35 matches 2 rows (40, 39) -> Failed (rows found)
            ("rule_library_age_greater_than_35", TestCaseStatus.Failed),
            # age > 100 matches 0 rows -> Success (no violations)
            ("rule_library_age_greater_than_100", TestCaseStatus.Success),
        ],
    )
    def test_rule_library_pandas_expression(
        self,
        run_rule_library_test_suite,
        metadata,
        datalake_service_name,
        test_case_name,
        expected_status,
    ):
        """Test the Rule Library Pandas Expression validator.

        Tests validate that:
        1. The Jinja2 template compilation works correctly for pandas expressions
        2. Parameters are properly substituted
        3. The df.query() execution returns correct row counts
        4. Test case status is correctly determined based on row count (0 = success)
        """
        table_fqn = f'{datalake_service_name}.default.{BUCKET_NAME}."users/users.csv"'
        test_case: TestCase = metadata.get_by_name(
            TestCase,
            f"{table_fqn}.age.{test_case_name}",
            fields=["*"],
            nullable=False,
        )
        assert test_case.testCaseResult is not None, "Test case result is None"
        assert (
            test_case.testCaseResult.testCaseStatus == expected_status
        ), f"Expected {expected_status}, got {test_case.testCaseResult.testCaseStatus}"
