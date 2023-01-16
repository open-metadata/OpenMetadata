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

import sys
import traceback
from copy import deepcopy
from logging import Logger
from typing import List, Optional, Set, Tuple

from pydantic import ValidationError
from sqlalchemy import MetaData

from metadata.config.common import WorkflowExecutionError
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.entity.data.table import PartitionProfilerConfig, Table
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
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
from metadata.generated.schema.tests.testDefinition import TestDefinition
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.processor import ProcessorStatus
from metadata.ingestion.ometa.client_utils import create_ometa_client
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.datalake.metadata import ometa_to_dataframe
from metadata.interfaces.datalake.datalake_test_suite_interface import (
    DataLakeTestSuiteInterface,
)
from metadata.interfaces.sqalchemy.sqa_test_suite_interface import SQATestSuiteInterface
from metadata.orm_profiler.api.models import ProfileSampleConfig
from metadata.test_suite.api.models import TestCaseDefinition, TestSuiteProcessorConfig
from metadata.test_suite.runner.core import DataTestsRunner
from metadata.utils import entity_link
from metadata.utils.importer import get_sink
from metadata.utils.logger import test_suite_logger
from metadata.utils.partition import get_partition_details
from metadata.utils.workflow_output_handler import print_test_suite_status
from metadata.workflow.workflow_status_mixin import WorkflowStatusMixin

logger: Logger = test_suite_logger()


class TestSuiteWorkflow(WorkflowStatusMixin):
    """workflow to run the test suite"""

    def __init__(self, config: OpenMetadataWorkflowConfig):
        """
        Instantiate test suite workflow class

        Args:
            config: OM workflow configuration object

        Attributes:
            config: OM workflow configuration object
            source_config: TestSuitePipeline object
        """
        self.config = config

        self.source_config: TestSuitePipeline = self.config.source.sourceConfig.config
        self.processor_config: TestSuiteProcessorConfig = (
            TestSuiteProcessorConfig.parse_obj(
                self.config.processor.dict().get("config")
            )
        )

        self.metadata_config: OpenMetadataConnection = (
            self.config.workflowConfig.openMetadataServerConfig
        )
        self.client = create_ometa_client(self.metadata_config)
        self.metadata = OpenMetadata(self.metadata_config)

        self.set_ingestion_pipeline_status(state=PipelineState.running)

        self.status = ProcessorStatus()

        if self.config.sink:
            self.sink = get_sink(
                sink_type=self.config.sink.type,
                sink_config=self.config.sink,
                metadata_config=self.metadata_config,
                from_="test_suite",
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

    def _filter_test_cases_for_entity(
        self, entity_fqn: str, test_cases: List[TestCase]
    ) -> list[TestCase]:
        """Filter test cases for specific entity"""
        return [
            test_case
            for test_case in test_cases
            if test_case.entityLink.__root__.split("::")[2].replace(">", "")
            == entity_fqn
        ]

    def _get_unique_entities_from_test_cases(self, test_cases: List[TestCase]) -> Set:
        """from a list of test cases extract unique table entities"""
        entity_fqns = [
            test_case.entityLink.__root__.split("::")[2].replace(">", "")
            for test_case in test_cases
        ]

        return set(entity_fqns)

    def _get_service_connection_from_test_case(self, entity_fqn: str):
        """given an entityLink return the service connection

        Args:
            entity_fqn: entity link for the test case
        """
        service: DatabaseService = self.metadata.get_by_name(
            entity=DatabaseService,
            fqn=entity_fqn.split(".")[0],
        )

        if service:
            service_connection_config = deepcopy(service.connection.config)
            if hasattr(service_connection_config, "supportsDatabase"):
                if (
                    hasattr(
                        service_connection_config,
                        "database",
                    )
                    and not service_connection_config.database
                ):
                    service_connection_config.database = entity_fqn.split(".")[1]
                if (
                    hasattr(
                        service_connection_config,
                        "catalog",
                    )
                    and not service_connection_config.catalog
                ):
                    service_connection_config.catalog = entity_fqn.split(".")[1]
            return service_connection_config

        logger.error(f"Could not retrive connection details for entity {entity_link}")
        raise ValueError()

    def _get_table_entity_from_test_case(self, entity_fqn: str):
        """given an entityLink return the table entity

        Args:
            entity_link: entity link for the test case
        """
        return self.metadata.get_by_name(
            entity=Table,
            fqn=entity_fqn,
            fields=["tableProfilerConfig"],
        )

    def _get_profile_sample(self, entity: Table) -> Optional[float]:
        """Get profile sample

        Args:
            entity: table entity
        """
        if (
            hasattr(entity, "tableProfilerConfig")
            and hasattr(entity.tableProfilerConfig, "profileSample")
            and entity.tableProfilerConfig.profileSample
        ):
            return ProfileSampleConfig(
                profile_sample=entity.tableProfilerConfig.profileSample,
                profile_sample_type=entity.tableProfilerConfig.profileSampleType,
            )

        return None

    def _get_profile_query(self, entity: Table) -> Optional[str]:
        """Get profile query

        Args:
            entity: table entity
        """
        if entity.tableProfilerConfig:
            return entity.tableProfilerConfig.profileQuery

        return None

    def _get_partition_details(
        self, entity: Table
    ) -> Optional[PartitionProfilerConfig]:
        """Get partition details

        Args:
            entity: table entity
        """
        return get_partition_details(entity)

    def _create_runner_interface(self, entity_fqn: str):
        """create the interface to execute test against sources"""
        table_entity = self._get_table_entity_from_test_case(entity_fqn)
        service_connection_config = self._get_service_connection_from_test_case(
            entity_fqn
        )
        table_partition_config = None
        profile_sample_config = None
        table_sample_query = (
            self._get_profile_query(table_entity)
            if not self._get_profile_sample(table_entity)
            else None
        )
        if not table_sample_query:
            profile_sample_config = self._get_profile_sample(table_entity)
            table_partition_config = self._get_partition_details(table_entity)

        if not isinstance(service_connection_config, DatalakeConnection):
            sqa_metadata_obj = MetaData()
            return SQATestSuiteInterface(
                service_connection_config=service_connection_config,
                ometa_client=self.client,
                sqa_metadata_obj=sqa_metadata_obj,
                table_entity=table_entity,
                profile_sample_config=profile_sample_config,
                table_sample_query=table_sample_query,
                table_partition_config=table_partition_config,
            )
        return DataLakeTestSuiteInterface(
            service_connection_config=service_connection_config,
            ometa_client=self.client,
            data_frame=ometa_to_dataframe(
                service_connection_config.configSource,
                get_connection(service_connection_config).client,
                table_entity,
            )[0],
            table_entity=table_entity,
        )

    def _create_data_tests_runner(self, sqa_interface):
        """create main object to run data test validation"""
        return DataTestsRunner(sqa_interface)

    def get_test_suite_entity_for_ui_workflow(self) -> Optional[List[TestSuite]]:
        """
        try to get test suite name from source.servicName.
        In the UI workflow we'll write the entity name (i.e. the test suite)
        to source.serviceName.
        """
        test_suite = self.metadata.get_by_name(
            entity=TestSuite,
            fqn=self.config.source.serviceName,
        )

        if test_suite:
            return [test_suite]
        return None

    def get_or_create_test_suite_entity_for_cli_workflow(
        self,
    ) -> List[TestSuite]:
        """
        Fro the CLI workflow we'll have n testSuite in the
        processor.config.testSuites
        """
        test_suite_entities = []
        test_suites = self.processor_config.testSuites or []

        for test_suite in test_suites:
            test_suite_entity = self.metadata.get_by_name(
                entity=TestSuite,
                fqn=test_suite.name,
            )
            if not test_suite_entity:
                test_suite_entity = self.metadata.create_or_update(
                    CreateTestSuiteRequest(
                        name=test_suite.name,
                        description=test_suite.description,
                    )
                )
            test_suite_entities.append(test_suite_entity)

        return test_suite_entities

    def get_test_cases_from_test_suite(
        self, test_suites: List[TestSuite]
    ) -> List[TestCase]:
        """
        Get test cases from test suite name

        Args:
            test_suite_name: the name of the test suite
        """

        test_cases_entity = []
        for test_suite in test_suites:
            test_case_entity_list = self.metadata.list_entities(
                entity=TestCase,
                fields=["testSuite", "entityLink", "testDefinition"],
                params={"testSuiteId": test_suite.id.__root__},
            )
            test_cases_entity.extend(test_case_entity_list.entities)

        return test_cases_entity

    def get_test_case_from_cli_config(self) -> List[str]:
        """Get all the test cases names defined in the CLI config file"""
        return [
            (test_case, test_suite)
            for test_suite in self.processor_config.testSuites
            for test_case in test_suite.testCases
        ]

    def compare_and_create_test_cases(
        self,
        cli_config_test_cases_def: List[Tuple[TestCaseDefinition, TestSuite]],
        test_cases: List[TestCase],
    ) -> Optional[List[TestCase]]:
        """
        compare test cases defined in CLI config workflow with test cases
        defined on the server

        Args:
            cli_config_test_case_name: test cases defined in CLI workflow associated with its test suite
            test_cases: list of test cases entities fetch from the server using test suite names in the config file
        """
        test_case_names_to_create = {
            test_case_def[0].name for test_case_def in cli_config_test_cases_def
        } - {test_case.name.__root__ for test_case in test_cases}

        if not test_case_names_to_create:
            return None

        created_test_case = []
        for test_case_name_to_create in test_case_names_to_create:
            logger.info(f"Creating test case with name {test_case_name_to_create}")
            test_case_to_create, test_suite = next(
                (
                    cli_config_test_case_def
                    for cli_config_test_case_def in cli_config_test_cases_def
                    if cli_config_test_case_def[0].name == test_case_name_to_create
                ),
                (None, None),
            )
            try:
                created_test_case.append(
                    self.metadata.create_or_update(
                        CreateTestCaseRequest(
                            name=test_case_to_create.name,
                            entityLink=test_case_to_create.entityLink,
                            testDefinition=self.metadata.get_entity_reference(
                                entity=TestDefinition,
                                fqn=test_case_to_create.testDefinitionName,
                            ),
                            testSuite=self.metadata.get_entity_reference(
                                entity=TestSuite, fqn=test_suite.name
                            ),
                            parameterValues=list(test_case_to_create.parameterValues)
                            if test_case_to_create.parameterValues
                            else None,
                        )
                    )
                )
            except Exception as exc:
                logger.warning(
                    f"Couldn't create test case name {test_case_name_to_create}: {exc}"
                )
                logger.debug(traceback.format_exc())
                self.status.failure(
                    test_case_to_create.entityLink.__root__.split("::")[2]
                )

        return created_test_case

    def add_test_cases_from_cli_config(self, test_cases: list) -> list:
        cli_config_test_cases_def = self.get_test_case_from_cli_config()
        runtime_created_test_cases = self.compare_and_create_test_cases(
            cli_config_test_cases_def, test_cases
        )
        if runtime_created_test_cases:
            return runtime_created_test_cases
        return []

    def run_test_suite(self):
        """
        Main running logic
        """
        test_suites = (
            self.get_test_suite_entity_for_ui_workflow()
            or self.get_or_create_test_suite_entity_for_cli_workflow()
        )
        if not test_suites:
            logger.warning("No testSuite found in configuration file. Exiting.")
            sys.exit(1)

        test_cases = self.get_test_cases_from_test_suite(test_suites)
        if self.processor_config.testSuites:
            test_cases.extend(self.add_test_cases_from_cli_config(test_cases))

        unique_entity_fqns = self._get_unique_entities_from_test_cases(test_cases)

        for entity_fqn in unique_entity_fqns:
            try:
                runner_interface = self._create_runner_interface(entity_fqn)
                data_test_runner = self._create_data_tests_runner(runner_interface)

                for test_case in self._filter_test_cases_for_entity(
                    entity_fqn, test_cases
                ):
                    try:
                        test_result = data_test_runner.run_and_handle(test_case)
                        if not test_result:
                            continue
                        if hasattr(self, "sink"):
                            self.sink.write_record(test_result)
                        logger.info(
                            f"Successfully ran test case {test_case.name.__root__}"
                        )
                        self.status.processed(test_case.fullyQualifiedName.__root__)
                    except Exception as exc:
                        logger.debug(traceback.format_exc())
                        logger.warning(
                            f"Could not run test case {test_case.name}: {exc}"
                        )
                        self.status.failure(entity_fqn)
            except TypeError as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Could not run test case for table {entity_fqn}: {exc}")
                self.status.failure(entity_fqn)

    def execute(self):
        """Execute test suite workflow"""
        try:
            self.run_test_suite()
            # At the end of the `execute`, update the associated Ingestion Pipeline status as success
            self.set_ingestion_pipeline_status(PipelineState.success)

        # Any unhandled exception breaking the workflow should update the status
        except Exception as err:
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
