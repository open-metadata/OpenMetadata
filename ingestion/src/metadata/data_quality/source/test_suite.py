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
Test Suite Workflow Source

The main goal is to get the configured table from the API.
"""
import itertools
import traceback
from typing import Dict, Iterable, List, Optional, cast

from metadata.data_quality.api.models import TableAndTests
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuitePipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.step import Step
from metadata.ingestion.api.steps import Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import entity_link, fqn
from metadata.utils.constants import CUSTOM_CONNECTOR_PREFIX
from metadata.utils.logger import test_suite_logger
from metadata.utils.service_spec.service_spec import import_source_class

logger = test_suite_logger()


class TestSuiteSource(Source):
    """
    Gets the ingredients required to run the tests
    """

    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        metadata: OpenMetadata,
    ):
        super().__init__()

        self.config = config
        self.metadata = metadata

        self.source_config: TestSuitePipeline = self.config.source.sourceConfig.config

        # Build at runtime - if not informed in the yaml - the service connection map
        self.service_connection_map: Dict[
            str, DatabaseConnection
        ] = self._load_yaml_service_connections()

        self.test_connection()

    @property
    def name(self) -> str:
        return "OpenMetadata"

    def _load_yaml_service_connections(self) -> Dict[str, DatabaseConnection]:
        """Load the service connections from the YAML file"""
        service_connections = self.source_config.serviceConnections
        if not service_connections:
            return {}
        return {
            conn.serviceName: cast(DatabaseConnection, conn.serviceConnection.root)
            for conn in service_connections
        }

    def _get_table_entity(self) -> Optional[Table]:
        """given an entity fqn return the table entity

        Args:
            entity_fqn: entity fqn for the test case
        """
        # Logical test suites don't have associated tables
        if self.source_config.entityFullyQualifiedName is None:
            logger.debug("No entity FQN provided, skipping table entity retrieval")
            return None

        logger.info(
            f"Retrieving table entity for FQN: {self.source_config.entityFullyQualifiedName.root}"
        )
        table: Table = self.metadata.get_by_name(
            entity=Table,
            fqn=self.source_config.entityFullyQualifiedName.root,
            fields=["tableProfilerConfig", "testSuite", "serviceType"],
        )
        if not table:
            logger.warning(
                f"Table not found for FQN: {self.source_config.entityFullyQualifiedName.root}. "
                "Please double check the entityFullyQualifiedName"
                "by copying it directly from the entity URL in the OpenMetadata UI. "
                "The FQN should be in the format: service_name.database_name.schema_name.table_name"
            )
        return table

    def _get_table_service_connection(self, table: Table) -> DatabaseConnection:
        """Get the service connection for the table"""
        service_name = table.service.name

        if service_name not in self.service_connection_map:
            try:
                service: DatabaseService = self.metadata.get_by_name(
                    DatabaseService, service_name
                )
                if not service:
                    raise ConnectionError(
                        f"Could not retrieve service with name `{service_name}`. "
                        "Typically caused by the `entityFullyQualifiedName` does not exists in OpenMetadata "
                        "or the JWT Token is invalid."
                    )
                if not service.connection:
                    raise ConnectionError(
                        f"Service with name `{service_name}` does not have a connection. "
                        "If the connection is not stored in OpenMetadata, please provide it in the YAML file."
                    )

                # TODO: Clean after https://github.com/open-metadata/OpenMetadata/issues/21259
                # We are forcing the secret evaluation to "ignore" null secrets down the line
                # Remove this when the issue above is fixed and empty secrets migrated
                source_config_class = type(service.connection)
                dumped_config = service.connection.model_dump()
                service_connection_clean = source_config_class.model_validate(
                    dumped_config
                )

                self.service_connection_map[service_name] = service_connection_clean

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error getting service connection for service name [{service_name}]"
                    f" using the secrets manager provider [{self.metadata.config.secretsManagerProvider}]: {exc}"
                )
                raise exc

        return self.service_connection_map[service_name]

    def _get_test_cases_from_test_suite(self, test_suite: TestSuite) -> List[TestCase]:
        """Return test cases if the test suite exists and has them"""
        test_cases = self.metadata.list_all_entities(
            entity=TestCase,
            fields=["testSuite", "entityLink", "testDefinition"],
            params={"testSuiteId": test_suite.id.root},
        )
        test_cases = cast(List[TestCase], test_cases)  # satisfy type checker
        if self.source_config.testCases is not None:
            test_cases = [
                t for t in test_cases if t.name in self.source_config.testCases
            ]
        return test_cases

    def prepare(self):
        """Nothing to prepare"""

    def test_connection(self) -> None:
        self.metadata.health_check()

    def _iter(self) -> Iterable[Either[TableAndTests]]:
        # Basic tests suites will have a table informed
        table: Table = self._get_table_entity()
        if table:
            source_type = table.serviceType.value.lower()
            if source_type.startswith(CUSTOM_CONNECTOR_PREFIX):
                logger.warning(
                    "Data quality tests might not work as expected with custom sources"
                )
            else:
                import_source_class(
                    service_type=ServiceType.Database, source_type=source_type
                )
            yield from self._process_table_suite(table)

        # Logical test suites won't have a table, we'll need to group the execution by tests
        else:
            yield from self._process_logical_suite()

    def _process_table_suite(self, table: Table) -> Iterable[Either[TableAndTests]]:
        """
        Check that the table has the proper test suite built in
        """
        try:
            service_connection: DatabaseConnection = self._get_table_service_connection(
                table
            )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name="Error getting service connection",
                    error=f"Error getting the service connection for table {table.name.root}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
            return
        # If there is no executable test suite yet for the table, we'll need to create one
        # Then, the suite won't have yet any tests
        if not table.testSuite or table.testSuite.id.root is None:
            logger.info(
                f"Creating new test suite for table {table.name.root} as no executable test suite exists"
            )
            executable_test_suite = CreateTestSuiteRequest(
                name=fqn.build(
                    None,
                    TestSuite,
                    table_fqn=self.source_config.entityFullyQualifiedName.root,
                ),
                displayName=f"{self.source_config.entityFullyQualifiedName.root} Test Suite",
                description="Test Suite created from YAML processor config file",
                owners=None,
                basicEntityReference=self.source_config.entityFullyQualifiedName.root,
            )
            yield Either(
                right=TableAndTests(
                    executable_test_suite=executable_test_suite,
                    service_type=service_connection.config.type.value,
                    service_connection=service_connection,
                )
            )
            test_suite_cases = []

        # Otherwise, we pick the tests already registered in the suite
        else:
            logger.info(f"Using existing test suite for table {table.name.root}")
            test_suite: Optional[TestSuite] = self.metadata.get_by_id(
                entity=TestSuite, entity_id=table.testSuite.id.root
            )
            if test_suite is None:
                yield Either(
                    left=StackTraceError(
                        name="Test Suite not found",
                        error=f"Test Suite with id {table.testSuite.id.root} not found",
                    )
                )
                return
            test_suite_cases = self._get_test_cases_from_test_suite(test_suite)

        yield Either(
            right=TableAndTests(
                table=table,
                test_cases=test_suite_cases,
                service_type=service_connection.config.type.value,
                service_connection=service_connection,
            )
        )

    def _process_logical_suite(self):
        """Process logical test suite, collect all test cases and yield them in batches by table"""
        logger.info(
            f"Processing logical test suite for service name: {self.config.source.serviceName}"
        )
        test_suite = self.metadata.get_by_name(
            entity=TestSuite, fqn=self.config.source.serviceName
        )
        if test_suite is None:
            yield Either(
                left=StackTraceError(
                    name="Test Suite not found",
                    error=f"Test Suite with name {self.config.source.serviceName} not found",
                )
            )
            # Return early if test suite not found in TestSuiteSource
            return

        logger.info(f"Found test suite: {test_suite.name.root}")
        test_cases: List[TestCase] = self._get_test_cases_from_test_suite(test_suite)
        grouped_by_table = itertools.groupby(
            test_cases, key=lambda t: entity_link.get_table_fqn(t.entityLink.root)
        )
        for table_fqn, group in grouped_by_table:
            table_entity: Table = self.metadata.get_by_name(
                Table, table_fqn, fields=["tableProfilerConfig"]
            )
            if table_entity is None:
                yield Either(
                    left=StackTraceError(
                        name="Table not found",
                        error=f"Table with fqn {table_fqn} not found for test suite {test_suite.name.root}",
                    )
                )
                continue

            try:
                service_connection: DatabaseConnection = (
                    self._get_table_service_connection(table_entity)
                )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name="Error getting service connection",
                        error=f"Error getting the service connection for table {table_entity.name.root}: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )
                continue

            yield Either(
                right=TableAndTests(
                    table=table_entity,
                    test_cases=list(group),
                    service_type=service_connection.config.type.value,
                    service_connection=service_connection,
                )
            )

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ) -> "Step":
        config = parse_workflow_config_gracefully(config_dict)
        return cls(config=config, metadata=metadata)

    def close(self) -> None:
        """Nothing to close"""
