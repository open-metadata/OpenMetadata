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
Workflow definition for the test suite
"""

from __future__ import annotations

import traceback
from copy import deepcopy
from logging import Logger
from typing import List, Optional, cast

from pydantic import BaseModel, ValidationError

from metadata.config.common import WorkflowExecutionError
from metadata.data_quality.api.models import (
    TestCaseDefinition,
    TestSuiteProcessorConfig,
)
from metadata.data_quality.source.test_suite_source_factory import (
    test_suite_source_factory,
)
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineState,
)
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuitePipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import TestDefinition, TestPlatform
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.generated.schema.type.basic import EntityLink, FullyQualifiedEntityName
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.processor import ProcessorStatus
from metadata.ingestion.ometa.client_utils import create_ometa_client
from metadata.utils import entity_link
from metadata.utils.fqn import split
from metadata.utils.importer import get_sink
from metadata.utils.logger import test_suite_logger
from metadata.utils.workflow_output_handler import print_test_suite_status
from metadata.workflow.workflow_status_mixin import WorkflowStatusMixin

logger: Logger = test_suite_logger()


class TestCaseToCreate(BaseModel):
    """Test case to create"""

    test_suite_name: str
    test_case_name: str
    entity_link: str

    def __hash__(self):
        """make this base model hashable on unique_name"""
        return hash(f"{self.test_suite_name}.{self.test_case_name}")

    def __str__(self) -> str:
        """make this base model printable"""
        return f"{self.test_suite_name}.{self.test_case_name}"


class TestSuiteWorkflow(WorkflowStatusMixin):
    """workflow to run the test suite"""

    def __init__(self, config: OpenMetadataWorkflowConfig):
        """
        Instantiate test suite workflow class

        Args:
            config: OM workflow configuration object

        Attributes:
            config: OM workflow configuration object
        """
        self.config = config
        self.metadata_config: OpenMetadataConnection = (
            self.config.workflowConfig.openMetadataServerConfig
        )
        self.metadata = create_ometa_client(self.metadata_config)

        self.source_config: TestSuitePipeline = self.config.source.sourceConfig.config
        self.service: DatabaseService = self._retrieve_service()
        self._retrieve_service_connection()

        self.processor_config: TestSuiteProcessorConfig = (
            TestSuiteProcessorConfig.parse_obj(
                self.config.processor.dict().get("config")
            )
        )

        self.set_ingestion_pipeline_status(state=PipelineState.running)

        self.status = ProcessorStatus()

        self.table_entity: Optional[Table] = self._get_table_entity(
            self.source_config.entityFullyQualifiedName.__root__
        )

        if self.config.sink:
            self.sink = get_sink(
                sink_type=self.config.sink.type,
                sink_config=self.config.sink,
                metadata_config=self.metadata_config,
                from_="data_quality",
            )

    @classmethod
    def create(cls, config_dict) -> TestSuiteWorkflow:
        """
        Instantiate a TestSuiteWorkflow object form a yaml or json config file

        Args:
            config_dict: json or yaml configuration file
        Returns:
            a test suite workflow
        """
        try:
            config = parse_workflow_config_gracefully(config_dict)
            return cls(config)
        except ValidationError as err:
            logger.error(
                f"Error trying to parse the Profiler Workflow configuration: {err}"
            )
            raise err

    def _retrieve_service(self) -> DatabaseService:
        """Get service object from source config `entityFullyQualifiedName`"""
        fully_qualified_name = self.source_config.entityFullyQualifiedName.__root__
        try:
            service_name = split(fully_qualified_name)[0]
        except IndexError as exc:
            logger.debug(traceback.format_exc())
            raise IndexError(
                f"Could not retrieve service name from entity fully qualified name {fully_qualified_name}: {exc}"
            )
        try:
            service = self.metadata.get_by_name(DatabaseService, service_name)
            if not service:
                raise ConnectionError(
                    f"Could not retrieve service with name `{service_name}`. "
                    "Typically caused by the `entityFullyQualifiedName` does not exists in OpenMetadata "
                    "or the JWT Token is invalid."
                )
        except ConnectionError as exc:
            raise exc
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error getting service connection for service name [{service_name}]"
                f" using the secrets manager provider [{self.metadata.config.secretsManagerProvider}]: {exc}"
            )
        return service

    def _get_table_entity(self, entity_fqn: str) -> Optional[Table]:
        """given an entity fqn return the table entity

        Args:
            entity_fqn: entity fqn for the test case
        """
        return self.metadata.get_by_name(
            entity=Table,
            fqn=entity_fqn,
            fields=["tableProfilerConfig", "testSuite"],
        )

    def create_or_return_test_suite_entity(self) -> Optional[TestSuite]:
        """
        try to get test suite name from source.servicName.
        In the UI workflow we'll write the entity name (i.e. the test suite)
        to source.serviceName.
        """
        self.table_entity = cast(Table, self.table_entity)  # satisfy type checker
        test_suite = self.table_entity.testSuite
        if test_suite and not test_suite.executable:
            logger.debug(
                f"Test suite {test_suite.fullyQualifiedName.__root__} is not executable."
            )
            return None

        if self.processor_config.testCases and not test_suite:
            # This should cover scenarios where we are running the tests from the CLI workflow
            # and no corresponding tests suite exist in the platform. We, therefore, will need
            # to create the test suite first.
            logger.debug(
                "Test suite name not found in the platform. Creating the test suite from processor config."
            )
            test_suite = self.metadata.create_or_update_executable_test_suite(
                CreateTestSuiteRequest(
                    name=f"{self.source_config.entityFullyQualifiedName.__root__}.TestSuite",
                    displayName=f"{self.source_config.entityFullyQualifiedName.__root__} Test Suite",
                    description="Test Suite created from YAML processor config file",
                    owner=None,
                    executableEntityReference=self.source_config.entityFullyQualifiedName.__root__,
                )
            )

        return test_suite

    def get_test_cases_from_test_suite(
        self, test_suite: TestSuite
    ) -> Optional[List[TestCase]]:
        """
        Get test cases from test suite name

        Args:
            test_suite_name: the name of the test suite
        """
        test_cases = self.metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "entityLink", "testDefinition"],
            params={"testSuiteId": test_suite.id.__root__},
        ).entities
        test_cases = cast(List[TestCase], test_cases)  # satisfy type checker
        if self.processor_config.testCases is not None:
            cli_test_cases = self.get_test_case_from_cli_config()  # type: ignore
            cli_test_cases = cast(
                List[TestCaseDefinition], cli_test_cases
            )  # satisfy type checker
            test_cases = self.compare_and_create_test_cases(
                cli_test_cases, test_cases, test_suite
            )

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

    def get_test_case_from_cli_config(
        self,
    ) -> Optional[List[TestCaseDefinition]]:
        """Get all the test cases names defined in the CLI config file"""
        if self.processor_config.testCases is not None:
            return list(self.processor_config.testCases)
        return None

    def _update_test_cases(
        self, test_cases_to_update: List[TestCaseDefinition], test_cases: List[TestCase]
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
                        self.source_config.entityFullyQualifiedName.__root__,
                        test_case_definition.columnName,
                    ),
                    test_case_parameter_values=test_case_definition.parameterValues,
                )
                if updated_test_case:
                    test_cases.pop(indx)
                    test_cases.append(updated_test_case)

        return test_cases

    def compare_and_create_test_cases(
        self,
        cli_test_cases_definitions: Optional[List[TestCaseDefinition]],
        test_cases: List[TestCase],
        test_suite: TestSuite,
    ) -> Optional[List[TestCase]]:
        """
        compare test cases defined in CLI config workflow with test cases
        defined on the server

        Args:
            cli_test_cases_definitions: test cases defined in CLI workflow associated with its test suite
            test_cases: list of test cases entities fetch from the server using test suite names in the config file
        """
        if not cli_test_cases_definitions:
            return test_cases
        test_cases = deepcopy(test_cases)
        test_case_names = {test_case.name.__root__ for test_case in test_cases}

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
            test_cases = self._update_test_cases(test_cases_to_update, test_cases)

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
                                self.source_config.entityFullyQualifiedName.__root__,
                                test_case_to_create.columnName,
                            )
                        ),
                        testSuite=test_suite.fullyQualifiedName.__root__,
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
                    self.source_config.entityFullyQualifiedName.__root__,
                    error,
                    traceback.format_exc(),
                )

        return test_cases

    def run_test_suite(self):
        """Main logic to run the tests"""
        if not self.table_entity:
            logger.debug(traceback.format_exc())
            raise ValueError(
                f"Could not retrieve table entity for {self.source_config.entityFullyQualifiedName.__root__}. "
                "Make sure the table exists in OpenMetadata and/or the JWT Token provided is valid."
            )

        test_suite = self.create_or_return_test_suite_entity()
        if not test_suite:
            logger.debug(
                f"No test suite found for table {self.source_config.entityFullyQualifiedName.__root__} "
                "or test suite is not executable."
            )
            return

        test_cases = self.get_test_cases_from_test_suite(test_suite)
        if not test_cases:
            logger.debug(
                f"No test cases found for table {self.source_config.entityFullyQualifiedName.__root__}"
                f"and test suite {test_suite.fullyQualifiedName.__root__}"
            )
            return

        openmetadata_test_cases = self.filter_for_om_test_cases(test_cases)

        test_suite_runner = test_suite_source_factory.create(
            self.service.serviceType.value.lower(),
            self.config,
            self.metadata,
            self.table_entity,
        ).get_data_quality_runner()

        for test_case in openmetadata_test_cases:
            try:
                test_result = test_suite_runner.run_and_handle(test_case)
                if not test_result:
                    continue
                if hasattr(self, "sink"):
                    self.sink.write_record(test_result)
                logger.debug(f"Successfully ran test case {test_case.name.__root__}")
                self.status.processed(test_case.fullyQualifiedName.__root__)
            except Exception as exc:
                error = f"Could not run test case {test_case.name.__root__}: {exc}"
                logger.debug(traceback.format_exc())
                logger.error(error)
                self.status.failed(
                    test_case.name.__root__, error, traceback.format_exc()
                )

    def _retrieve_service_connection(self) -> None:
        """
        We override the current `serviceConnection` source config object if source workflow service already exists
        in OM. When it is configured, we retrieve the service connection from the secrets' manager. Otherwise, we get it
        from the service object itself through the default `SecretsManager`.
        """
        if (
            not self.config.source.serviceConnection
            and not self.metadata.config.forceEntityOverwriting
        ):
            self.config.source.serviceConnection = ServiceConnection(
                __root__=self.service.connection
            )

    def execute(self):
        """Execute test suite workflow"""
        try:
            self.run_test_suite()
            # At the end of the `execute`, update the associated Ingestion Pipeline status as success
            self.set_ingestion_pipeline_status(PipelineState.success)

        # Any unhandled exception breaking the workflow should update the status
        except Exception as err:
            logger.debug(traceback.format_exc())
            self.set_ingestion_pipeline_status(PipelineState.failed)
            raise err

    def print_status(self) -> None:
        """
        Print the workflow results with click
        """
        print_test_suite_status(self)

    def result_status(self) -> int:
        """
        Returns 1 if status is failed, 0 otherwise.
        """
        if self.status.failures or (
            hasattr(self, "sink") and self.sink.get_status().failures
        ):
            return 1
        return 0

    def _raise_from_status_internal(self, raise_warnings=False):
        """
        Check source, processor and sink status and raise if needed

        Our profiler source will never log any failure, only filters,
        as we are just picking up data from OM.
        """

        if self.status.failures:
            raise WorkflowExecutionError("Processor reported errors", self.status)
        if hasattr(self, "sink") and self.sink.get_status().failures:
            raise WorkflowExecutionError("Sink reported errors", self.sink.get_status())

        if raise_warnings:
            if self.status.warnings:
                raise WorkflowExecutionError("Processor reported warnings", self.status)
            if hasattr(self, "sink") and self.sink.get_status().warnings:
                raise WorkflowExecutionError(
                    "Sink reported warnings", self.sink.get_status()
                )

    def stop(self):
        """
        Close all connections
        """
        self.metadata.close()
