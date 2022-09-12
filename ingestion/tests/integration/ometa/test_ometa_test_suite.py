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
OpenMetadata API test suite mixin test
"""
from unittest import TestCase

from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.tests.testCase import TestCase as OMetaTestCase
from metadata.generated.schema.tests.testCase import TestCaseParameterValue
from metadata.generated.schema.tests.testDefinition import (
    EntityType,
    TestCaseParameterDefinition,
    TestDefinition,
    TestPlatform,
)
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class OMetaTestSuiteTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    server_config = OpenMetadataConnection(hostPort="http://localhost:8585/api")
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    test_suite: TestSuite = metadata.create_or_update(
        CreateTestSuiteRequest(
            name="testSuiteForIntegrationTest",
            description="This is a test suite for the integration tests",
        )
    )

    test_definition = metadata.create_or_update(
        CreateTestDefinitionRequest(
            name="testDefinitionForIntegration",
            description="this is a test definition for integration tests",
            entityType=EntityType.TABLE,
            testPlatforms=[TestPlatform.GreatExpectations],
            parameterDefinition=[TestCaseParameterDefinition(name="foo")],
        )
    )

    @classmethod
    def setUpClass(cls) -> None:
        """set up tests"""

        cls.metadata.create_or_update(
            CreateTestCaseRequest(
                name="testCaseForIntegration",
                entityLink="<#E::table::sample_data.ecommerce_db.shopify.dim_address>",
                testSuite=cls.metadata.get_entity_reference(
                    entity=TestSuite,
                    fqn=cls.test_suite.fullyQualifiedName.__root__,
                ),
                testDefinition=cls.metadata.get_entity_reference(
                    entity=TestDefinition,
                    fqn=cls.test_definition.fullyQualifiedName.__root__,
                ),
                parameterValues=[TestCaseParameterValue(name="foo", value=10)],
            )
        )

    def test_get_or_create_test_suite(self):
        """test we get a test suite object"""
        test_suite = self.metadata.get_or_create_test_suite(
            "testSuiteForIntegrationTest"
        )
        assert test_suite.name.__root__ == "testSuiteForIntegrationTest"
        assert isinstance(test_suite, TestSuite)

    def test_get_or_create_test_definition(self):
        """test we get a test definition object"""
        test_definition = self.metadata.get_or_create_test_definition(
            "testDefinitionForIntegration"
        )
        assert test_definition.name.__root__ == "testDefinitionForIntegration"
        assert isinstance(test_definition, TestDefinition)

    def test_get_or_create_test_case(self):
        """test we get a test case object"""
        test_case = self.metadata.get_or_create_test_case(
            "sample_data.ecommerce_db.shopify.dim_address.testCaseForIntegration"
        )
        assert test_case.name.__root__ == "testCaseForIntegration"
        assert isinstance(test_case, OMetaTestCase)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.metadata.delete(
            entity=TestSuite,
            entity_id=cls.test_suite.id,
            recursive=True,
            hard_delete=True,
        )

        cls.metadata.delete(
            entity=TestDefinition,
            entity_id=cls.test_definition.id,
            recursive=True,
            hard_delete=True,
        )
