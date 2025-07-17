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
OpenMetadata API test suite mixin test
"""
from datetime import datetime, timezone
from unittest import TestCase

from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.api.tests.createTestSuite import (
    CreateTestSuiteRequest,
    TestSuiteEntityName,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
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
from metadata.generated.schema.type.basic import (
    EntityLink,
    FullyQualifiedEntityName,
    Markdown,
    TestCaseEntityName,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.helpers import datetime_to_ts
from metadata.utils.time_utils import (
    get_beginning_of_day_timestamp_mill,
    get_end_of_day_timestamp_mill,
)


class OMetaTestSuiteTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    test_definition = metadata.create_or_update(
        CreateTestDefinitionRequest(
            name=TestCaseEntityName("testDefinitionForIntegration"),
            description=Markdown(
                root="this is a test definition for integration tests"
            ),
            entityType=EntityType.TABLE,
            testPlatforms=[TestPlatform.GreatExpectations],
            parameterDefinition=[TestCaseParameterDefinition(name="foo")],
        )
    )

    @classmethod
    def setUpClass(cls) -> None:
        """set up tests"""

        cls.test_suite: TestSuite = cls.metadata.create_or_update_executable_test_suite(
            CreateTestSuiteRequest(
                name=TestSuiteEntityName(
                    root="sample_data.ecommerce_db.shopify.dim_address.TestSuite"
                ),
                description=Markdown(
                    root="This is a test suite for the integration tests"
                ),
                basicEntityReference=FullyQualifiedEntityName(
                    "sample_data.ecommerce_db.shopify.dim_address"
                ),
            )
        )

        cls.metadata.create_or_update(
            CreateTestCaseRequest(
                name=TestCaseEntityName("testCaseForIntegration"),
                entityLink=EntityLink(
                    "<#E::table::sample_data.ecommerce_db.shopify.dim_address>"
                ),
                testDefinition=cls.test_definition.fullyQualifiedName,
                parameterValues=[TestCaseParameterValue(name="foo", value="10")],
            )
        )

        cls.metadata.add_test_case_results(
            test_results=TestCaseResult(
                timestamp=datetime_to_ts(datetime.now(timezone.utc)),
                testCaseStatus=TestCaseStatus.Success,
                result="Test Case Success",
                sampleData=None,
                testResultValue=[TestResultValue(name="foo", value="10")],
            ),
            test_case_fqn="sample_data.ecommerce_db.shopify.dim_address.testCaseForIntegration",
        )

    def test_get_or_create_test_suite(self):
        """test we get a test suite object"""
        test_suite = self.metadata.get_or_create_test_suite(
            "sample_data.ecommerce_db.shopify.dim_address.TestSuite"
        )
        assert (
            test_suite.name.root
            == "sample_data.ecommerce_db.shopify.dim_address.TestSuite"
        )
        assert isinstance(test_suite, TestSuite)

    def test_get_or_create_test_definition(self):
        """test we get a test definition object"""
        test_definition = self.metadata.get_or_create_test_definition(
            "testDefinitionForIntegration"
        )
        assert test_definition.name.root == "testDefinitionForIntegration"
        assert isinstance(test_definition, TestDefinition)

    def test_get_or_create_test_case(self):
        """test we get a test case object"""
        test_case = self.metadata.get_or_create_test_case(
            "sample_data.ecommerce_db.shopify.dim_address.testCaseForIntegration"
        )
        assert test_case.name.root == "testCaseForIntegration"
        assert isinstance(test_case, OMetaTestCase)

    def test_create_test_case(self):
        """test we get a create the test case object if it does not exists"""
        test_case_fqn = (
            "sample_data.ecommerce_db.shopify.dim_address.aNonExistingTestCase"
        )
        test_case = self.metadata.get_by_name(
            entity=OMetaTestCase, fqn=test_case_fqn, fields=["*"]
        )

        assert test_case is None

        test_case = self.metadata.get_or_create_test_case(
            test_case_fqn,
            test_definition_fqn="columnValuesToMatchRegex",
            entity_link="<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::last_name>",
            test_case_parameter_values=[
                TestCaseParameterValue(name="regex", value=".*")
            ],
        )
        assert test_case.name.root == "aNonExistingTestCase"
        assert isinstance(test_case, OMetaTestCase)

    def test_get_test_case_results(self):
        """test get test case result method"""
        res = self.metadata.get_test_case_results(
            "sample_data.ecommerce_db.shopify.dim_address.testCaseForIntegration",
            get_beginning_of_day_timestamp_mill(),
            get_end_of_day_timestamp_mill(),
        )

        assert res

    @classmethod
    def tearDownClass(cls) -> None:
        cls.metadata.delete_executable_test_suite(
            entity=TestSuite,
            entity_id=cls.test_suite.id,
            recursive=True,
            hard_delete=True,
        )
