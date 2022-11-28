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

from datetime import datetime, timezone
from typing import List, Optional

from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import (
    EntityType,
    TestCaseParameterDefinition,
    TestDefinition,
    TestPlatform,
)
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.ingestion.ometa.client import REST
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class OMetaTestsMixin:
    """
    OpenMetadata API methods related to Tests.

    To be inherited by OpenMetadata
    """

    client: REST

    def add_test_case_results(
        self,
        test_results: TestCaseResult,
        test_case_fqn: str,
    ):
        """Add test case results to a test case

        Args:
            test_results (TestCaseResult): test case results to pass to the test case
            test_case_fqn (str): test case fqn

        Returns:
            _type_: _description_
        """
        resp = self.client.put(
            f"{self.get_suffix(TestCase)}/{test_case_fqn}/testCaseResult",
            test_results.json(),
        )

        return resp

    def get_or_create_test_suite(
        self,
        test_suite_name: str,
        test_suite_description: Optional[
            str
        ] = f"Test Suite created on {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
    ) -> TestSuite:
        """Get or create a TestSuite

        Args:
            test_suite_name (str): test suite name
            test_suite_description (Optional[str], optional): test suite description.
                Defaults to f"Test Suite created on {datetime.now(timezone.utc).strftime('%Y-%m-%d')}".

        Returns:
            TestSuite:
        """
        test_suite = self.get_by_name(
            entity=TestSuite,
            fqn=test_suite_name,
        )

        if test_suite:
            return test_suite

        logger.info(
            f"TestSuite {test_suite_name} not found. Creating new TestSuite: {test_suite_name}"
        )

        return self.create_or_update(
            CreateTestSuiteRequest(
                name=test_suite_name,
                description=test_suite_description,
            )
        )

    def get_or_create_test_definition(
        self,
        test_definition_fqn: str,
        test_definition_description: Optional[str] = None,
        entity_type: Optional[EntityType] = None,
        test_platforms: Optional[List[TestPlatform]] = None,
        test_case_parameter_definition: Optional[
            List[TestCaseParameterDefinition]
        ] = None,
    ) -> TestDefinition:
        """Get or create a test definition

        Args:
            test_definition_fqn (str): test definition fully qualified name
            test_definition_description (Optional[str], optional): description for the test definition.
                Defaults to None.
            entity_type (Optional[EntityType], optional): entity type (COLUMN or TABLE). Defaults to None.
            test_platforms (Optional[List[TestPlatform]], optional): test platforms. Defaults to None.
            test_case_parameter_definition (Optional[List[TestCaseParameterDefinition]], optional): parameters for the
                test case defintion. Defaults to None.

        Returns:
            TestDefinition: a test definition object
        """
        test_definition = self.get_by_name(
            entity=TestDefinition,
            fqn=test_definition_fqn,
        )

        if test_definition:
            return test_definition

        logger.info(
            f"TestDefinition {test_definition_fqn} not found. Creating new TestDefinition: {test_definition_fqn}"
        )

        return self.create_or_update(
            CreateTestDefinitionRequest(
                name=test_definition_fqn,
                description=test_definition_description,
                entityType=entity_type,
                testPlatforms=test_platforms,
                parameterDefinition=test_case_parameter_definition,
            )
        )

    def get_or_create_test_case(
        self,
        test_case_fqn: str,
        entity_link: Optional[str] = None,
        test_suite_fqn: Optional[str] = None,
        test_definition_fqn: Optional[str] = None,
        test_case_parameter_values: Optional[str] = None,
    ):
        """Get or create a test case

        Args:
            test_case_fqn (str): fully qualified name for the test
            entity_link (Optional[str], optional): _description_. Defaults to None.
            test_suite_fqn (Optional[str], optional): _description_. Defaults to None.
            test_definition_fqn (Optional[str], optional): _description_. Defaults to None.
            test_case_parameter_values (Optional[str], optional): _description_. Defaults to None.

        Returns:
            _type_: _description_
        """
        test_case = self.get_by_name(entity=TestCase, fqn=test_case_fqn, fields=["*"])

        if test_case:
            return test_case

        logger.info(
            f"TestCase {test_case_fqn} not found. Creating TestCase {test_case_fqn}"
        )

        test_case = self.create_or_update(
            CreateTestCaseRequest(
                name=test_case_fqn.split(".")[-1],
                entityLink=entity_link,
                testSuite=self.get_entity_reference(
                    entity=TestSuite,
                    fqn=test_suite_fqn,
                ),
                testDefinition=self.get_entity_reference(
                    entity=TestDefinition,
                    fqn=test_definition_fqn,
                ),
                parameterValues=test_case_parameter_values,
            )
        )
        return test_case

    def get_test_case_results(
        self,
        test_case_fqn: str,
        start_ts: int,
        end_ts: int,
    ) -> Optional[List[TestCaseResult]]:
        """Retrieve list of test cases

        Args:
            test_case_fqn (str): test_case_fqn
            start_ts (int): timestamp
            end_ts (int): timestamp
        """

        # timestamp should be changed to milliseconds in https://github.com/open-metadata/OpenMetadata/issues/8930
        params = {
            "startTs": start_ts // 1000,
            "endTs": end_ts // 1000,
        }

        resp = self.client.get(
            f"/testCase/{test_case_fqn}/testCaseResult",
            params,
        )

        if resp:
            return [TestCaseResult.parse_obj(entity) for entity in resp["data"]]
        return None
