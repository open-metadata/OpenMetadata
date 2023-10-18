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
Test Suite Workflow Source

The main goal is to get the configured table from the API.
"""
import traceback
from typing import Iterable, List, Optional, cast

from metadata.data_quality.api.models import TableAndTests
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuitePipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.ingestion.api.models import Either, StackTraceError
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.step import Step
from metadata.ingestion.api.steps import Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.fqn import split
from metadata.utils.logger import test_suite_logger

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

        self.test_connection()

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

            return service

        except ConnectionError as exc:
            raise exc
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error getting service connection for service name [{service_name}]"
                f" using the secrets manager provider [{self.metadata.config.secretsManagerProvider}]: {exc}"
            )
            raise exc

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

    def _get_table_entity(self) -> Optional[Table]:
        """given an entity fqn return the table entity

        Args:
            entity_fqn: entity fqn for the test case
        """
        table: Table = self.metadata.get_by_name(
            entity=Table,
            fqn=self.source_config.entityFullyQualifiedName.__root__,
            fields=["tableProfilerConfig", "testSuite"],
        )

        return table

    def _get_test_cases_from_test_suite(
        self, test_suite: Optional[TestSuite]
    ) -> Optional[List[TestCase]]:
        """Return test cases if the test suite exists and has them"""
        if test_suite:
            test_cases = self.metadata.list_entities(
                entity=TestCase,
                fields=["testSuite", "entityLink", "testDefinition"],
                params={"testSuiteId": test_suite.id.__root__},
            ).entities
            test_cases = cast(List[TestCase], test_cases)  # satisfy type checker

            return test_cases

        return None

    def prepare(self):
        """Nothing to prepare"""

    def test_connection(self) -> None:
        self.metadata.health_check()

    def _iter(self) -> Iterable[Either[TableAndTests]]:
        table: Table = self._get_table_entity()

        if table:
            yield from self._process_table_suite(table)

        else:
            yield Either(
                left=StackTraceError(
                    name="Missing Table",
                    error=f"Could not retrieve table entity for {self.source_config.entityFullyQualifiedName.__root__}."
                    " Make sure the table exists in OpenMetadata and/or the JWT Token provided is valid.",
                )
            )

    def _process_table_suite(self, table: Table) -> Iterable[Either[TableAndTests]]:
        """
        Check that the table has the proper test suite built in
        """
        # If there is no executable test suite yet for the table, we'll need to create one
        if not table.testSuite:
            executable_test_suite = CreateTestSuiteRequest(
                name=fqn.build(
                    None,
                    TestSuite,
                    table_fqn=self.source_config.entityFullyQualifiedName.__root__,
                ),
                displayName=f"{self.source_config.entityFullyQualifiedName.__root__} Test Suite",
                description="Test Suite created from YAML processor config file",
                owner=None,
                executableEntityReference=self.source_config.entityFullyQualifiedName.__root__,
            )
            yield Either(
                right=TableAndTests(
                    executable_test_suite=executable_test_suite,
                    service_type=self.config.source.serviceConnection.__root__.config.type.value,
                )
            )

        if table.testSuite and not table.testSuite.executable:
            yield Either(
                left=StackTraceError(
                    name="Non-executable Test Suite",
                    error=f"The table {self.source_config.entityFullyQualifiedName.__root__} "
                    "has a test suite that is not executable.",
                )
            )

        else:

            test_suite_cases = self._get_test_cases_from_test_suite(table.testSuite)

            yield Either(
                right=TableAndTests(
                    table=table,
                    test_cases=test_suite_cases,
                    service_type=self.config.source.serviceConnection.__root__.config.type.value,
                )
            )

    @classmethod
    def create(cls, config_dict: dict, metadata: OpenMetadata) -> "Step":
        config = parse_workflow_config_gracefully(config_dict)
        return cls(config=config, metadata=metadata)

    def close(self) -> None:
        """Nothing to close"""
