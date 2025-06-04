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
Validate workflow configs and filters
"""

import unittest
import uuid
from typing import List

from metadata.data_quality.api.models import TableAndTests
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.ingestion.api.models import Either
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.data_quality import TestSuiteWorkflow

sqlite_shared = "file:cachedb?mode=memory&cache=shared&check_same_thread=False"


def get_test_suite_config(service_name: str, table_name: str) -> dict:
    return {
        "source": {
            "type": "custom-database",
            "serviceName": service_name,
            "sourceConfig": {
                "config": {
                    "type": "TestSuite",
                    "entityFullyQualifiedName": table_name,
                }
            },
        },
        "processor": {"type": "orm-test-runner", "config": {}},
        "sink": {"type": "metadata-rest", "config": {}},
        "workflowConfig": {
            "openMetadataServerConfig": {
                "hostPort": "http://localhost:8585/api",
                "authProvider": "openmetadata",
                "securityConfig": {
                    "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
                },
            }
        },
    }


class TestSuiteWorkflowTests(unittest.TestCase):
    """Main test suite integration tests definition"""

    metadata = OpenMetadata(
        OpenMetadataConnection.model_validate(
            get_test_suite_config("", "")["workflowConfig"]["openMetadataServerConfig"]
        )
    )

    test_case_ids = []
    test_suite_ids = []

    @classmethod
    def setUpClass(cls) -> None:
        """Prepare ingredients"""
        service = CreateDatabaseServiceRequest(
            name=str(uuid.uuid4()),
            serviceType=DatabaseServiceType.Mysql,
            connection=DatabaseConnection(
                config=MysqlConnection(
                    username="username",
                    authType=BasicAuth(
                        password="password",
                    ),
                    hostPort="http://localhost:1234",
                )
            ),
        )
        cls.service_entity: DatabaseService = cls.metadata.create_or_update(
            data=service
        )

        create_db = CreateDatabaseRequest(
            name=str(uuid.uuid4()),
            service=cls.service_entity.fullyQualifiedName,
        )

        create_db_entity = cls.metadata.create_or_update(data=create_db)

        create_schema = CreateDatabaseSchemaRequest(
            name=str(uuid.uuid4()),
            database=create_db_entity.fullyQualifiedName,
        )

        cls.schema_entity = cls.metadata.create_or_update(data=create_schema)

        create_table = CreateTableRequest(
            name=str(uuid.uuid4()),
            databaseSchema=cls.schema_entity.fullyQualifiedName,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        cls.table_with_suite: Table = cls.metadata.create_or_update(create_table)

        cls.test_suite = cls.metadata.create_or_update_executable_test_suite(
            data=CreateTestSuiteRequest(
                name="test-suite",
                basicEntityReference=cls.table_with_suite.fullyQualifiedName.root,
            )
        )

        cls.metadata.create_or_update(
            CreateTestCaseRequest(
                name="testCaseForIntegration",
                entityLink=f"<#E::table::{cls.table_with_suite.fullyQualifiedName.root}>",
                testDefinition="tableRowCountToEqual",
                parameterValues=[TestCaseParameterValue(name="value", value="10")],
            )
        )

        create_table_2 = CreateTableRequest(
            name=str(uuid.uuid4()),
            databaseSchema=cls.schema_entity.fullyQualifiedName,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        cls.table: Table = cls.metadata.create_or_update(create_table_2)

    @classmethod
    def tearDownClass(cls) -> None:
        """Clean up"""
        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=cls.service_entity.id,
            recursive=True,
            hard_delete=True,
        )

    def test_create_workflow_object(self):
        """Test workflow object is correctly instantiated"""
        TestSuiteWorkflow.create(
            get_test_suite_config(
                service_name=self.service_entity.name.root,
                table_name=self.table_with_suite.fullyQualifiedName.root,
            )
        )

    def test_create_workflow_object_with_table_with_test_suite(self):
        """test workflow object is instantiated correctly from cli config"""
        workflow = TestSuiteWorkflow.create(
            get_test_suite_config(
                service_name=self.service_entity.name.root,
                table_name=self.table_with_suite.fullyQualifiedName.root,
            )
        )

        table: Table = workflow.source._get_table_entity()

        table_and_tests: TableAndTests = list(
            workflow.source._process_table_suite(table=table)
        )[0]

        # If the table already has a test suite, we won't be generating one
        self.assertIsNotNone(table.testSuite)
        self.assertIsNone(table_and_tests.right.executable_test_suite)

        self.assertTrue(len(table_and_tests.right.test_cases) >= 1)
        # We will pick up the tests from it
        self.assertTrue(
            next(
                (
                    test
                    for test in table_and_tests.right.test_cases
                    if test.name.root == "testCaseForIntegration"
                ),
                None,
            )
        )

    def test_create_workflow_config_with_table_without_suite(self):
        """We'll prepare the test suite creation payload"""

        workflow = TestSuiteWorkflow.create(
            get_test_suite_config(
                service_name=self.service_entity.name.root,
                table_name=self.table.fullyQualifiedName.root,
            )
        )

        # If the table does not have a test suite, we'll prepare the request to create one
        table: Table = workflow.source._get_table_entity()

        table_and_tests: Either[TableAndTests] = list(
            workflow.source._process_table_suite(table=table)
        )[0]

        self.assertIsNone(table.testSuite)
        self.assertEqual(
            table_and_tests.right.executable_test_suite.name.root,
            self.table.fullyQualifiedName.root + ".testSuite",
        )

    def test_create_workflow_config_with_tests(self):
        """We'll get the tests from the workflow YAML"""

        _test_suite_config = get_test_suite_config(
            service_name=self.service_entity.name.root,
            table_name=self.table_with_suite.fullyQualifiedName.root,
        )

        processor = {
            "processor": {
                "type": "orm-test-runner",
                "config": {
                    "testCases": [
                        {
                            "name": "my_test_case",
                            "testDefinitionName": "tableColumnCountToBeBetween",
                            "parameterValues": [
                                {"name": "minColValue", "value": "1"},
                                {"name": "maxColValue", "value": "5"},
                            ],
                        }
                    ]
                },
            }
        }

        _test_suite_config.update(processor)
        workflow = TestSuiteWorkflow.create(_test_suite_config)

        table: Table = workflow.source._get_table_entity()
        table_and_tests: Either[TableAndTests] = list(
            workflow.source._process_table_suite(table=table)
        )[0]

        test_cases: List[TestCase] = workflow.steps[0].get_test_cases(
            test_cases=table_and_tests.right.test_cases,
            table_fqn=self.table_with_suite.fullyQualifiedName.root,
        )

        # 1 defined test cases + the new one in the YAML
        self.assertTrue(len(table_and_tests.right.test_cases) >= 1)

        new_test_case = next(
            (test for test in test_cases if test.name.root == "my_test_case"), None
        )
        self.assertIsNotNone(new_test_case)

        # cleanup
        self.metadata.delete(
            entity=TestCase,
            entity_id=new_test_case.id,
            recursive=True,
            hard_delete=True,
        )

    def test_get_test_case_names_from_cli_config(self):
        """test we can get all test case names from cli config"""
        _test_suite_config = get_test_suite_config(
            service_name=self.service_entity.name.root,
            table_name=self.table_with_suite.fullyQualifiedName.root,
        )

        processor = {
            "processor": {
                "type": "orm-test-runner",
                "config": {
                    "testCases": [
                        {
                            "name": "my_test_case",
                            "testDefinitionName": "tableColumnCountToBeBetween",
                            "parameterValues": [
                                {"name": "minColValue", "value": "1"},
                                {"name": "maxColValue", "value": "5"},
                            ],
                        },
                        {
                            "name": "my_test_case_two",
                            "testDefinitionName": "tableColumnCountToBeBetween",
                            "parameterValues": [
                                {"name": "minColValue", "value": "1"},
                                {"name": "maxColValue", "value": "5"},
                            ],
                        },
                    ],
                },
            }
        }

        _test_suite_config.update(processor)

        workflow = TestSuiteWorkflow.create(_test_suite_config)
        test_cases_def = workflow.steps[0].get_test_case_from_cli_config()

        assert [test_case_def.name for test_case_def in test_cases_def] == [
            "my_test_case",
            "my_test_case_two",
        ]

    def test_compare_and_create_test_cases(self):
        """Test function creates the correct test case if they don't exists"""
        _test_suite_config = get_test_suite_config(
            service_name=self.service_entity.name.root,
            table_name=self.table_with_suite.fullyQualifiedName.root,
        )

        processor = {
            "processor": {
                "type": "orm-test-runner",
                "config": {
                    "testCases": [
                        {
                            "name": "my_test_case",
                            "testDefinitionName": "tableColumnCountToBeBetween",
                            "parameterValues": [
                                {"name": "minColValue", "value": "1"},
                                {"name": "maxColValue", "value": "5"},
                            ],
                        },
                        {
                            "name": "my_test_case_two",
                            "testDefinitionName": "columnValuesToBeBetween",
                            "columnName": "id",
                            "parameterValues": [
                                {"name": "minValue", "value": "1"},
                                {"name": "maxValue", "value": "5"},
                            ],
                        },
                    ],
                },
            }
        }

        _test_suite_config.update(processor)
        workflow = TestSuiteWorkflow.create(_test_suite_config)

        assert not self.metadata.get_by_name(
            entity=TestCase,
            fqn=f"{self.table_with_suite.fullyQualifiedName.root}.my_test_case",
        )

        assert not self.metadata.get_by_name(
            entity=TestCase,
            fqn=f"{self.table_with_suite.fullyQualifiedName.root}.my_test_case_two",
        )

        table: Table = workflow.source._get_table_entity()
        table_and_tests: Either[TableAndTests] = list(
            workflow.source._process_table_suite(table=table)
        )[0]

        config_test_cases_def = workflow.steps[0].get_test_case_from_cli_config()
        created_test_case = workflow.steps[0].compare_and_create_test_cases(
            cli_test_cases_definitions=config_test_cases_def,
            test_cases=table_and_tests.right.test_cases,
            table_fqn=self.table_with_suite.fullyQualifiedName.root,
        )

        # clean up test
        my_test_case = self.metadata.get_by_name(
            entity=TestCase,
            fqn=f"{self.table_with_suite.fullyQualifiedName.root}.my_test_case",
            fields=["testDefinition", "testSuite"],
        )
        my_test_case_two = self.metadata.get_by_name(
            entity=TestCase,
            fqn=f"{self.table_with_suite.fullyQualifiedName.root}.id.my_test_case_two",
            fields=["testDefinition", "testSuite"],
        )

        assert my_test_case
        assert my_test_case_two

        # We return the existing test & the 2 new ones
        assert len(created_test_case) >= 3

        self.metadata.delete(entity=TestCase, entity_id=my_test_case.id)
        self.metadata.delete(entity=TestCase, entity_id=my_test_case_two.id)
