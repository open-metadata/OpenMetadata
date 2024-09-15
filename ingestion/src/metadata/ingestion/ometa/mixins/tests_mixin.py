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

import traceback
from datetime import datetime
from typing import List, Optional, Type, Union
from uuid import UUID

from metadata.generated.schema.api.tests.createLogicalTestCases import (
    CreateLogicalTestCases,
)
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestCaseResolutionStatus import (
    CreateTestCaseResolutionStatus,
)
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.entity.data.table import Table, TableData
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.tests.testCaseResolutionStatus import (
    TestCaseResolutionStatus,
)
from metadata.generated.schema.tests.testDefinition import (
    EntityType,
    TestCaseParameterDefinition,
    TestDefinition,
    TestPlatform,
)
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import model_str, quote
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
            f"{self.get_suffix(TestCase)}/{quote(test_case_fqn)}/testCaseResult",
            test_results.model_dump_json(),
        )

        return resp

    def get_or_create_test_suite(
        self,
        test_suite_name: str,
        test_suite_description: Optional[
            str
        ] = f"Test Suite created on {datetime.now().strftime('%Y-%m-%d')}",
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
        test_case_parameter_values: Optional[List[TestCaseParameterValue]] = None,
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
                testSuite=test_suite_fqn,
                testDefinition=test_definition_fqn,
                parameterValues=test_case_parameter_values,
            )  # type: ignore
        )
        return test_case

    def get_or_create_executable_test_suite(
        self, entity_fqn: str
    ) -> Union[EntityReference, TestSuite]:
        """Given an entity fqn, retrieve the link test suite if it exists or create a new one

        Args:
            table_fqn (str): entity fully qualified name

        Returns:
            TestSuite:
        """
        table_entity = self.get_by_name(
            entity=Table, fqn=entity_fqn, fields=["testSuite"]
        )
        if not table_entity:
            raise RuntimeError(
                f"Unable to find table {entity_fqn} in OpenMetadata. "
                "This could be because the table has not been ingested yet or your JWT Token is expired or missing."
            )

        if table_entity.testSuite:
            return table_entity.testSuite

        create_test_suite = CreateTestSuiteRequest(
            name=f"{table_entity.fullyQualifiedName.root}.TestSuite",
            executableEntityReference=table_entity.fullyQualifiedName.root,
        )  # type: ignore
        test_suite = self.create_or_update_executable_test_suite(create_test_suite)
        return test_suite

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

        params = {
            "startTs": start_ts,
            "endTs": end_ts,
        }

        resp = self.client.get(
            f"/dataQuality/testCases/{test_case_fqn}/testCaseResult",
            params,
        )

        if resp:
            return [TestCaseResult.model_validate(entity) for entity in resp["data"]]
        return None

    def create_or_update_executable_test_suite(
        self, data: CreateTestSuiteRequest
    ) -> TestSuite:
        """Create or update an executable test suite

        Args:
            data (CreateTestSuiteRequest): test suite request

        Returns:
            TestSuite: test suite object
        """
        entity = data.__class__
        entity_class = self.get_entity_from_create(entity)
        path = self.get_suffix(entity) + "/executable"
        resp = self.client.put(path, data=data.model_dump_json())

        return entity_class.model_validate(resp)

    def delete_executable_test_suite(
        self,
        entity: Type[TestSuite],
        entity_id: Union[str, UUID],
        recursive: bool = False,
        hard_delete: bool = False,
    ) -> None:
        """Delete executable test suite

        Args:
            entity_id (str): test suite ID
            recursive (bool, optional): delete children if true
            hard_delete (bool, optional): hard delete if true
        """
        url = f"{self.get_suffix(entity)}/executable/{model_str(entity_id)}"
        url += f"?recursive={str(recursive).lower()}"
        url += f"&hardDelete={str(hard_delete).lower()}"
        self.client.delete(url)

    def add_logical_test_cases(self, data: CreateLogicalTestCases) -> None:
        """Add logical test cases to a test suite

        Args:
            data (CreateLogicalTestCases): logical test cases
        """
        path = self.get_suffix(TestCase) + "/logicalTestCases"
        self.client.put(path, data=data.model_dump_json())

    def create_test_case_resolution(
        self, data: CreateTestCaseResolutionStatus
    ) -> TestCaseResolutionStatus:
        """Create a test case resolution

        Args:
            data (CreateTestCaseResolutionStatus): test case resolution

        Returns:
            TestCaseResolutionStatus
        """
        path = self.get_suffix(TestCase) + "/testCaseIncidentStatus"
        response = self.client.post(path, data=data.model_dump_json())

        return TestCaseResolutionStatus(**response)

    def ingest_failed_rows_sample(
        self,
        test_case: TestCase,
        failed_rows: TableData,
        validate=True,
    ) -> Optional[TableData]:
        """
        PUT sample failed data for a test case.

        :param test_case: The test case that failed
        :param failed_rows: Data to add
        """
        resp = None
        try:
            params = "" if validate else "validate=false"
            resp = self.client.put(
                f"{self.get_suffix(TestCase)}/{test_case.id.root}/failedRowsSample?{params}",
                data=failed_rows.model_dump_json(),
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to PUT sample data for {test_case.fullyQualifiedName.root}: {exc}"
            )

        if resp:
            try:
                return TableData(**resp["failedRowsSample"])
            except UnicodeError as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Unicode Error parsing the sample data response from {test_case.fullyQualifiedName.root}: "
                    f"{err}"
                )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error trying to parse sample data results from {test_case.fullyQualifiedName.root}: {exc}"
                )

        return None

    def ingest_inspection_query(
        self, test_case: TestCase, inspection_query: str
    ) -> Optional[TestCase]:
        """
        PUT inspection query for a test case.

        :param test_case: The test case that failed
        :param inspection_query: SQL query to inspect the failed rows
        """
        resp = self.client.put(
            f"{self.get_suffix(TestCase)}/{test_case.id.root}/inspectionQuery",
            data=inspection_query,
        )
        return TestCase(**resp)
