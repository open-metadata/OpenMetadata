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
Mixin class containing Tests specific methods

To be used by OpenMetadata class
"""

from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import TestDefinition
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.ingestion.ometa.client import REST


class OMetaTestsMixin:
    """
    OpenMetadata API methods related to Tests.

    To be inherited by OpenMetadata
    """

    client: REST

    def add_test_case_results(
        self,
        test_results: TestCaseResult,
        test_case_name: str,
    ):
        """Create test definition"""
        resp = self.client.put(
            f"{self.get_suffix(TestCase)}/{test_case_name}/testCaseResult",
            test_results.json(),
        )

        return resp
