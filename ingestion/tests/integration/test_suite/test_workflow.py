#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Validate workflow configs and filters
"""

import unittest
from collections.abc import MutableSequence
from copy import deepcopy

from metadata.data_quality.api.workflow import TestSuiteWorkflow
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.ingestion.ometa.ometa_api import OpenMetadata

sqlite_shared = "file:cachedb?mode=memory&cache=shared&check_same_thread=False"


test_suite_config = {
    "source": {
        "type": "custom-database",
        "serviceName": "sample_data",
        "sourceConfig": {
            "config": {
                "type": "TestSuite",
                "entityFullyQualifiedName": "sample_data.ecommerce_db.shopify.dim_address",
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
        OpenMetadataConnection.parse_obj(
            test_suite_config["workflowConfig"]["openMetadataServerConfig"]
        )
    )

    test_case_ids = []
    test_suite_ids = []

    def tearDown(self) -> None:
        for test_case_id in self.test_case_ids:
            self.metadata.delete(
                entity=TestCase,
                entity_id=test_case_id,
                recursive=True,
                hard_delete=True,
            )
        for test_suite_id in self.test_suite_ids:
            self.metadata.delete_executable_test_suite(
                entity=TestSuite,
                entity_id=test_suite_id,
                recursive=True,
                hard_delete=True,
            )

        self.test_case_ids = []
        self.test_suite_ids = []

    def test_create_workflow_object(self):
        """Test workflow object is correctly instantiated"""
        TestSuiteWorkflow.create(test_suite_config)
        assert True

    def test_create_workflow_object_from_cli_config(self):
        """test workflow object is instantiated correctly from cli config"""
        _test_suite_config = deepcopy(test_suite_config)

        processor = {
            "processor": {
                "type": "orm-test-runner",
                "config": {
                    "testCases": [
                        {
                            "name": "my_test_case",
                            "testDefinitionName": "tableColumnCountToBeBetween",
                            "parameterValues": [
                                {"name": "minColValue", "value": 1},
                                {"name": "maxColValue", "value": 5},
                            ],
                        }
                    ]
                },
            }
        }

        _test_suite_config.update(processor)

        workflow = TestSuiteWorkflow.create(_test_suite_config)
        workflow_test_suite = workflow.create_or_return_test_suite_entity()

        test_suite = self.metadata.get_by_name(
            entity=TestSuite,
            fqn="sample_data.ecommerce_db.shopify.dim_address.TestSuite",
        )

        assert workflow_test_suite.id == test_suite.id
        self.test_suite_ids = [test_suite.id]

    def test_create_or_return_test_suite_entity(self):
        """test we can correctly retrieve a test suite"""
        _test_suite_config = deepcopy(test_suite_config)

        workflow = TestSuiteWorkflow.create(_test_suite_config)
        test_suite = workflow.create_or_return_test_suite_entity()

        expected_test_suite = self.metadata.get_by_name(
            entity=TestSuite, fqn="critical_metrics_suite"
        )

        assert test_suite

    def test_get_test_cases_from_test_suite(self):
        """test test cases are correctly returned for specific test suite"""
        _test_suite_config = deepcopy(test_suite_config)

        processor = {
            "processor": {
                "type": "orm-test-runner",
                "config": {
                    "testCases": [
                        {
                            "name": "my_test_case",
                            "testDefinitionName": "tableColumnCountToBeBetween",
                            "parameterValues": [
                                {"name": "minColValue", "value": 1},
                                {"name": "maxColValue", "value": 5},
                            ],
                        }
                    ]
                },
            }
        }

        _test_suite_config.update(processor)

        workflow = TestSuiteWorkflow.create(_test_suite_config)
        test_suite = workflow.create_or_return_test_suite_entity()
        test_cases = workflow.get_test_cases_from_test_suite(test_suite)

        assert isinstance(test_cases, MutableSequence)
        assert isinstance(test_cases[0], TestCase)
        assert {"my_test_case"}.intersection(
            {test_case.name.__root__ for test_case in test_cases}
        )

        for test_case in test_cases:
            self.metadata.delete(entity=TestCase, entity_id=test_case.id)

    def test_get_test_case_names_from_cli_config(self):
        """test we can get all test case names from cli config"""
        _test_suite_config = deepcopy(test_suite_config)

        processor = {
            "processor": {
                "type": "orm-test-runner",
                "config": {
                    "testCases": [
                        {
                            "name": "my_test_case",
                            "testDefinitionName": "tableColumnCountToBeBetween",
                            "parameterValues": [
                                {"name": "minColValue", "value": 1},
                                {"name": "maxColValue", "value": 5},
                            ],
                        },
                        {
                            "name": "my_test_case_two",
                            "testDefinitionName": "tableColumnCountToBeBetween",
                            "parameterValues": [
                                {"name": "minColValue", "value": 1},
                                {"name": "maxColValue", "value": 5},
                            ],
                        },
                    ],
                },
            }
        }

        _test_suite_config.update(processor)

        workflow = TestSuiteWorkflow.create(_test_suite_config)
        test_cases_def = workflow.get_test_case_from_cli_config()

        assert [test_case_def.name for test_case_def in test_cases_def] == [
            "my_test_case",
            "my_test_case_two",
        ]

    def test_compare_and_create_test_cases(self):
        """Test function creates the correct test case if they don't exists"""
        _test_suite_config = deepcopy(test_suite_config)

        processor = {
            "processor": {
                "type": "orm-test-runner",
                "config": {
                    "testCases": [
                        {
                            "name": "my_test_case",
                            "testDefinitionName": "tableColumnCountToBeBetween",
                            "parameterValues": [
                                {"name": "minColValue", "value": 1},
                                {"name": "maxColValue", "value": 5},
                            ],
                        },
                        {
                            "name": "my_test_case_two",
                            "testDefinitionName": "columnValuesToBeBetween",
                            "columnName": "address_id",
                            "parameterValues": [
                                {"name": "minValue", "value": 1},
                                {"name": "maxValue", "value": 5},
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
            fqn="sample_data.ecommerce_db.shopify.dim_address.my_test_case",
        )

        assert not self.metadata.get_by_name(
            entity=TestCase,
            fqn="sample_data.ecommerce_db.shopify.dim_address.address_id.my_test_case_two",
        )

        test_suite = workflow.create_or_return_test_suite_entity()
        test_cases = self.metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "entityLink", "testDefinition"],
            params={"testSuiteId": test_suite.id.__root__},
        ).entities
        config_test_cases_def = workflow.get_test_case_from_cli_config()
        created_test_case = workflow.compare_and_create_test_cases(
            config_test_cases_def, test_cases, test_suite
        )

        # clean up test
        my_test_case = self.metadata.get_by_name(
            entity=TestCase,
            fqn="sample_data.ecommerce_db.shopify.dim_address.my_test_case",
            fields=["testDefinition", "testSuite"],
        )
        my_test_case_two = self.metadata.get_by_name(
            entity=TestCase,
            fqn="sample_data.ecommerce_db.shopify.dim_address.address_id.my_test_case_two",
            fields=["testDefinition", "testSuite"],
        )

        assert my_test_case
        assert my_test_case_two

        assert len(created_test_case) == 2

        self.metadata.delete(entity=TestCase, entity_id=my_test_case.id)
        self.metadata.delete(entity=TestCase, entity_id=my_test_case_two.id)

    def test_get_table_entity(self):
        """test get service connection returns correct info"""
        workflow = TestSuiteWorkflow.create(test_suite_config)
        service_connection = workflow._get_table_entity(
            "sample_data.ecommerce_db.shopify.dim_address"
        )

        assert isinstance(service_connection, Table)

    # def test_filter_for_om_test_cases(self):
    #     """test filter for OM test cases method"""
    #     om_test_case_1 = TestCase(
    #         name="om_test_case_1",
    #         testDefinition=self.metadata.get_entity_reference(
    #             TestDefinition,
    #             "columnValuesToMatchRegex"
    #         ),
    #         entityLink="<entityLink>",
    #         testSuite=self.metadata.get_entity_reference("sample_data.ecommerce_db.shopify.dim_address.TestSuite"),
    #     )
