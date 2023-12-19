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
This Processor is in charge of executing the test cases
"""
import traceback
from copy import deepcopy
from typing import List, Optional, cast

from metadata.data_quality.api.models import (
    TableAndTests,
    TestCaseDefinition,
    TestCaseResultResponse,
    TestCaseResults,
    TestSuiteProcessorConfig,
)
from metadata.data_quality.runner.core import DataTestsRunner
from metadata.data_quality.runner.test_suite_source_factory import (
    test_suite_source_factory,
)
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import TestDefinition, TestPlatform
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.generated.schema.type.basic import EntityLink, FullyQualifiedEntityName
from metadata.ingestion.api.models import Either
from metadata.generated.schema.entity.services.ingestionPipelines.status import StackTraceError
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.step import Step
from metadata.ingestion.api.steps import Processor
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import entity_link, fqn
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class TestCaseRunner(Processor):
    """Execute the test suite tests and create test cases from the YAML config"""

    def __init__(self, config: OpenMetadataWorkflowConfig, metadata: OpenMetadata):

        super().__init__()

        self.config = config
        self.metadata = metadata

        self.processor_config: TestSuiteProcessorConfig = (
            TestSuiteProcessorConfig.parse_obj(
                self.config.processor.dict().get("config")
            )
        )

    def _run(self, record: TableAndTests) -> Either:
        # First, create the executable test suite if it does not exist yet
        # This could happen if the process is executed from YAML and not the UI
        if record.executable_test_suite:
            # We pass the test suite request to the sink
            return Either(right=record.executable_test_suite)

        # Add the test cases from the YAML file, if any
        test_cases = self.get_test_cases(
            test_cases=record.test_cases,
            test_suite_fqn=fqn.build(
                None,
                TestSuite,
                table_fqn=record.table.fullyQualifiedName.__root__,
            ),
            table_fqn=record.table.fullyQualifiedName.__root__,
        )

        if not test_cases:
            return Either(
                left=StackTraceError(
                    name="No test Cases",
                    error=f"No tests cases found for table {record.table.fullyQualifiedName.__root__}",
                )
            )

        openmetadata_test_cases = self.filter_for_om_test_cases(test_cases)

        test_suite_runner = test_suite_source_factory.create(
            record.service_type.lower(),
            self.config,
            self.metadata,
            record.table,
        ).get_data_quality_runner()

        test_results = [
            test_case_result
            for test_case in openmetadata_test_cases
            if (test_case_result := self._run_test_case(test_case, test_suite_runner))
        ]

        return Either(right=TestCaseResults(test_results=test_results))

    def get_test_cases(
        self, test_cases: Optional[List[TestCase]], test_suite_fqn: str, table_fqn: str
    ) -> List[TestCase]:
        """
        Based on the test suite test cases that we already know, pick up
        the rest from the YAML config, compare and create the new ones
        """
        if self.processor_config.testCases is not None:
            cli_test_cases = self.get_test_case_from_cli_config()  # type: ignore
            cli_test_cases = cast(
                List[TestCaseDefinition], cli_test_cases
            )  # satisfy type checker
            return self.compare_and_create_test_cases(
                cli_test_cases_definitions=cli_test_cases,
                test_cases=test_cases,
                test_suite_fqn=test_suite_fqn,
                table_fqn=table_fqn,
            )

        return test_cases

    def get_test_case_from_cli_config(
        self,
    ) -> Optional[List[TestCaseDefinition]]:
        """Get all the test cases names defined in the CLI config file"""
        if self.processor_config.testCases is not None:
            return list(self.processor_config.testCases)
        return None

    def compare_and_create_test_cases(
        self,
        cli_test_cases_definitions: Optional[List[TestCaseDefinition]],
        test_cases: List[TestCase],
        table_fqn: str,
        test_suite_fqn: str,
    ) -> List[TestCase]:
        """
        compare test cases defined in CLI config workflow with test cases
        defined on the server

        Args:
            cli_test_cases_definitions: test cases defined in CLI workflow associated with its test suite
            test_cases: list of test cases entities fetch from the server using test suite names in the config file
            table_fqn: table being tested
            test_suite_fqn: FQN of the table + .testSuite
        """
        if not cli_test_cases_definitions:
            return test_cases
        test_cases = deepcopy(test_cases) or []
        test_case_names = (
            {test_case.name.__root__ for test_case in test_cases}
            if test_cases
            else set()
        )

        # we'll check the test cases defined in the CLI config file and not present in the platform
        test_cases_to_create = [
            cli_test_case_definition
            for cli_test_case_definition in cli_test_cases_definitions
            if cli_test_case_definition.name not in test_case_names
        ]

        if self.processor_config and self.processor_config.forceUpdate:
            test_cases_to_update = [
                cli_test_case_definition
                for cli_test_case_definition in cli_test_cases_definitions
                if cli_test_case_definition.name in test_case_names
            ]
            test_cases = self._update_test_cases(
                test_cases_to_update, test_cases, table_fqn
            )

        if not test_cases_to_create:
            return test_cases

        for test_case_to_create in test_cases_to_create:
            logger.debug(f"Creating test case with name {test_case_to_create.name}")
            try:
                test_case = self.metadata.create_or_update(
                    CreateTestCaseRequest(
                        name=test_case_to_create.name,
                        description=test_case_to_create.description,
                        displayName=test_case_to_create.displayName,
                        testDefinition=FullyQualifiedEntityName(
                            __root__=test_case_to_create.testDefinitionName
                        ),
                        entityLink=EntityLink(
                            __root__=entity_link.get_entity_link(
                                table_fqn,
                                test_case_to_create.columnName,
                            )
                        ),
                        testSuite=test_suite_fqn,
                        parameterValues=list(test_case_to_create.parameterValues)
                        if test_case_to_create.parameterValues
                        else None,
                        owner=None,
                    )
                )
                test_cases.append(test_case)
            except Exception as exc:
                error = (
                    f"Couldn't create test case name {test_case_to_create.name}: {exc}"
                )
                logger.error(error)
                logger.debug(traceback.format_exc())
                self.status.failed(
                    StackTraceError(
                        name=table_fqn,
                        error=error,
                        stackTrace=traceback.format_exc(),
                    )
                )

        return test_cases

    def _update_test_cases(
        self,
        test_cases_to_update: List[TestCaseDefinition],
        test_cases: List[TestCase],
        table_fqn: str,
    ):
        """Given a list of CLI test definition patch test cases in the platform

        Args:
            test_cases_to_update (List[TestCaseDefinition]): list of test case definitions
        """
        test_cases_to_update_names = {
            test_case_to_update.name for test_case_to_update in test_cases_to_update
        }
        for indx, test_case in enumerate(deepcopy(test_cases)):
            if test_case.name.__root__ in test_cases_to_update_names:
                test_case_definition = next(
                    test_case_to_update
                    for test_case_to_update in test_cases_to_update
                    if test_case_to_update.name == test_case.name.__root__
                )
                updated_test_case = self.metadata.patch_test_case_definition(
                    source=test_case,
                    entity_link=entity_link.get_entity_link(
                        table_fqn,
                        test_case_definition.columnName,
                    ),
                    test_case_parameter_values=test_case_definition.parameterValues,
                )
                if updated_test_case:
                    test_cases.pop(indx)
                    test_cases.append(updated_test_case)

        return test_cases

    def filter_for_om_test_cases(self, test_cases: List[TestCase]) -> List[TestCase]:
        """
        Filter test cases for OM test cases only. This will prevent us from running non OM test cases

        Args:
            test_cases: list of test cases
        """
        om_test_cases: List[TestCase] = []
        for test_case in test_cases:
            test_definition: TestDefinition = self.metadata.get_by_id(
                TestDefinition, test_case.testDefinition.id
            )
            if TestPlatform.OpenMetadata not in test_definition.testPlatforms:
                logger.debug(
                    f"Test case {test_case.name.__root__} is not an OpenMetadata test case."
                )
                continue
            om_test_cases.append(test_case)

        return om_test_cases

    def _run_test_case(
        self, test_case: TestCase, test_suite_runner: DataTestsRunner
    ) -> Optional[TestCaseResultResponse]:
        """Execute the test case and return the result, if any"""
        try:
            test_result = test_suite_runner.run_and_handle(test_case)
            self.status.scanned(test_case.fullyQualifiedName.__root__)
            return test_result
        except Exception as exc:
            error = f"Could not run test case {test_case.name.__root__}: {exc}"
            logger.debug(traceback.format_exc())
            logger.error(error)
            self.status.failed(
                StackTraceError(
                    name=test_case.name.__root__,
                    error=error,
                    stackTrace=traceback.format_exc(),
                )
            )
        return None

    @classmethod
    def create(cls, config_dict: dict, metadata: OpenMetadata) -> "Step":
        config = parse_workflow_config_gracefully(config_dict)
        return cls(config=config, metadata=metadata)

    def close(self) -> None:
        """Nothing to close"""
