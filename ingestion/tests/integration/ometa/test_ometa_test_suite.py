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

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.tests.testCase import TestCase as OMetaTestCase
from metadata.generated.schema.tests.testDefinition import TestDefinition
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

    def test_get_or_create_test_suite(self):
        """test we get a test suite object"""
        test_suite = self.metadata.get_or_create_test_suite("critical_test_suite")
        assert test_suite.name.__root__ == "critical_test_suite"
        assert isinstance(test_suite, TestSuite)

    def test_get_or_create_test_definition(self):
        """test we get a test definition object"""
        test_definition = self.metadata.get_or_create_test_definition(
            "columnValueLengthsToBeBetween"
        )
        assert test_definition.name.__root__ == "columnValueLengthsToBeBetween"
        assert isinstance(test_definition, TestDefinition)

    def test_get_or_create_test_case(self):
        """test we get a test case object"""
        test_case = self.metadata.get_or_create_test_case(
            "sample_data.ecommerce_db.shopify.dim_address.dim_address_TableRowCountToBeBetween"
        )
        assert test_case.name.__root__ == "dim_address_TableRowCountToBeBetween"
        assert isinstance(test_case, OMetaTestCase)
