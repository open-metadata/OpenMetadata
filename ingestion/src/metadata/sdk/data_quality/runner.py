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

# pyright: reportCallIssue=false, reportRedeclaration=false

import uuid
from typing import Any, List, Optional, cast

from typing_extensions import Self

from metadata.data_quality.api.models import TestCaseResultResponse
from metadata.data_quality.runner.base_test_suite_source import BaseTestSuiteRunner
from metadata.data_quality.runner.core import DataTestsRunner
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
)
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuitePipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Processor,
    Sink,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import TestDefinition
from metadata.generated.schema.type.basic import EntityLink, FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata as OMeta
from metadata.sdk import OpenMetadata
from metadata.sdk import client as get_client
from metadata.sdk.data_quality.tests import BaseTest
from metadata.sdk.types import OMetaClient
from metadata.utils import entity_link


class TestRunner:
    """Simplified test runner for executing data quality tests on OpenMetadata tables.

    This class provides a fluent API for defining and executing data quality tests
    against tables in OpenMetadata. It handles test case creation, workflow configuration,
    and result collection.

    The runner automatically fetches table metadata and service connections from OpenMetadata,
    builds test cases from test definitions, and executes them using the appropriate runner.

    Attributes:
        table_fqn: Fully qualified name of the table to test
        test_definitions: List of test definitions to execute
        metadata: OpenMetadata API client
        table_entity: Table entity from OpenMetadata
        service_connection: Database connection from the service
        _runner: Internal test runner instance

    Example:
        >>> from metadata.sdk.data_quality import TestRunner, TableRowCountToBeBetween
        >>> runner = TestRunner.for_table("MySQL.default.db.table")
        >>> runner.add_test(TableRowCountToBeBetween(min_count=100, max_count=1000))
        >>> results = runner.run()
    """

    def __init__(
        self,
        table_fqn: str,
        metadata: Optional[OpenMetadata] = None,
    ):
        """Initialize TestRunner with table FQN and optional OpenMetadata client.

        Args:
            table_fqn: Fully qualified name of the table
            metadata: Optional OpenMetadata client (will create one if not provided)
        """
        self.table_fqn: str = table_fqn
        self.test_definitions: List[BaseTest] = []

        if metadata is None:
            metadata: OpenMetadata = get_client()

        self.metadata: OpenMetadata = metadata
        self.table_entity: Optional[Table] = None
        self.service_connection: Optional[DatabaseConnection] = None
        self._runner: Optional[Any] = None

    @property
    def client(self) -> OMetaClient:
        """Return the active OpenMetadata client."""
        return self.metadata.ometa

    @property
    def tables(self) -> OMeta[Table, Any]:
        """Convenience property for type-safe access to `Table` operations."""
        return cast(OMeta[Table, Any], self.client)

    @property
    def services(self) -> OMeta[DatabaseService, Any]:
        """Convenience property for type-safe access to `DatabaseService` operations."""
        return cast(OMeta[DatabaseService, Any], self.client)

    @property
    def tests(self) -> OMeta[TestDefinition, Any]:
        return cast(OMeta[TestDefinition, Any], self.client)

    @classmethod
    def for_table(
        cls,
        table_fqn: str,
        metadata: Optional[OpenMetadata] = None,
    ) -> Self:
        """Initialize runner for a specific table FQN.

        Args:
            table_fqn: Fully qualified name of the table (e.g., "MySQL.default.db.table")
            metadata: Optional OpenMetadata client (will create one if not provided)

        Returns:
            TestRunner instance

        Example:
            >>> from metadata.sdk.data_quality import TestRunner, TableColumnCountToBeBetween
            >>> runner = TestRunner.for_table("MySQL.default.db.table")
            >>> runner.add_test(TableColumnCountToBeBetween(min_count=10))
            >>> results = runner.run()
        """
        runner = cls(table_fqn, metadata=metadata)
        runner._initialize()
        return runner

    @classmethod
    def for_service(cls, table_fqn: str) -> Self:
        """Alias for for_table(). Initialize runner for a specific table FQN.

        Args:
            table_fqn: Fully qualified name of the table (e.g., "MySQL.default.db.table")

        Returns:
            TestRunner instance
        """
        return cls.for_table(table_fqn)

    def _initialize(self) -> None:
        """Fetch table entity and service connection from OpenMetadata.

        This method retrieves the table entity and associated database service connection
        from OpenMetadata. It validates that the table exists and has a properly configured
        service connection.

        Raises:
            ValueError: If table not found, service not found, or connection not configured
        """
        self.table_entity = self.tables.get_by_name(
            entity=Table,
            fqn=self.table_fqn,
            fields=[
                "tableProfilerConfig",
                "testSuite",
                "serviceType",
                "service",
                "database",
            ],
        )

        if self.table_entity is None:
            raise ValueError(
                f"Table '{self.table_fqn}' not found in OpenMetadata. "
                + "Please verify the FQN is correct (format: service.database.schema.table)"  # noqa: E501
            )
        assert (
            self.table_entity.service is not None
        ), f"Service not found for table '{self.table_fqn}'"

        service_id = self.table_entity.service.id
        service = self.services.get_by_id(DatabaseService, service_id)

        if service is None:
            raise ValueError(f"Service '{service_id}' not found in OpenMetadata")

        if service.connection is None:
            raise ValueError(
                f"Service '{service_id}' does not have a connection configured"
            )

        self.service_connection = service.connection

    def add_test(self, test_definition: BaseTest) -> Self:
        """Add a test definition to be executed.

        Args:
            test_definition: Test definition instance (e.g., TableColumnCountToBeBetween)

        Returns:
            Self for method chaining
        """
        self.test_definitions.append(test_definition)
        return self

    def add_tests(self, *test_definitions: BaseTest) -> Self:
        """Add multiple test definitions at once.

        Args:
            *test_definitions: Variable number of test definition instances

        Returns:
            Self for method chaining

        Example:
            >>> runner.add_tests(
            ...     TableRowCountToBeBetween(min_count=100),
            ...     ColumnValuesToBeNotNull(column="user_id")
            ... )
        """
        for test_definition in test_definitions:
            _ = self.add_test(test_definition)
        return self

    def _build_test_case(self, test_def: BaseTest) -> TestCase:
        """Convert TestDefinition to TestCase object.

        This method builds a TestCase entity from a TestDefinition, generating unique
        identifiers, constructing entity links, and setting up all required metadata.

        Args:
            test_def: Test definition to convert

        Returns:
            TestCase object ready for execution
        """
        if test_def.name is None:
            assert self.table_entity is not None
            test_def.name = f"{self.table_entity.name.root}_{test_def.test_definition_name}_{uuid.uuid4().hex[:8]}"  # type: ignore # noqa: E501

        column_name = getattr(test_def, "column_name", None)
        entity_link_str = (
            entity_link.get_entity_link(  # pyright: ignore[reportUnknownMemberType]
                Table,
                fqn=self.table_fqn,
                column_name=column_name,
            )
        )

        test_definition = self.tests.get_by_name(
            TestDefinition,
            fqn=test_def.test_definition_name,
            fields=["id", "fullyQualifiedName"],
        )

        if test_definition is None:
            raise ValueError(
                f"Test definition '{test_def.name}' not found in OpenMetadata"
            )

        test_definition_ref = EntityReference(
            id=test_definition.id,
            type="testDefinition",
            fullyQualifiedName=test_definition.fullyQualifiedName.root,  # pyright: ignore[reportOptionalMemberAccess]
        )

        test_suite_ref = EntityReference(
            id=uuid.uuid4(),
            type="testSuite",
        )

        test_case = TestCase(
            id=uuid.uuid4(),
            name=test_def.name,
            displayName=test_def.display_name,
            description=test_def.description,
            fullyQualifiedName=f"{self.table_fqn}.{test_def.name}",
            testDefinition=test_definition_ref,
            entityLink=EntityLink(entity_link_str),
            testSuite=test_suite_ref,
            parameterValues=test_def.parameters if test_def.parameters else None,
            computePassedFailedRowCount=test_def.compute_passed_failed_row_count,
        )

        return test_case

    def _build_workflow_config(self) -> OpenMetadataWorkflowConfig:
        """Build OpenMetadataWorkflowConfig for the test runner.

        This method constructs the workflow configuration required to execute tests,
        including source connection, processor type, and sink configuration.

        Returns:
            OpenMetadataWorkflowConfig object with all necessary settings
        """
        assert self.table_entity is not None
        assert self.table_entity.service is not None
        assert self.service_connection is not None
        assert self.table_entity.serviceType is not None

        test_suite_pipeline = TestSuitePipeline(
            entityFullyQualifiedName=FullyQualifiedEntityName(self.table_fqn),
            type="TestSuite",
        )

        source_config = SourceConfig(config=test_suite_pipeline)

        source = Source(
            type=self.table_entity.serviceType.value,  # type: ignore
            serviceName=self.table_entity.service.name,
            serviceConnection=ServiceConnection(root=self.service_connection),
            sourceConfig=source_config,
        )

        processor = Processor(type="orm-test-runner")

        sink = Sink(type="metadata-rest")

        workflow_config = WorkflowConfig(
            loggerLevel="INFO",
            openMetadataServerConfig=self.client.config,
        )

        config = OpenMetadataWorkflowConfig(
            source=source,
            processor=processor,
            sink=sink,
            workflowConfig=workflow_config,
            ingestionPipelineFQN=None,
            pipelineRunId=None,
        )

        return config

    def _get_runner(self) -> DataTestsRunner:
        """Get or create the BaseTestSuiteRunner.

        This method lazy-loads the test runner, creating it only when needed and
        caching it for subsequent test executions.

        Returns:
            Data quality runner instance
        """
        if self._runner is None:
            assert self.table_entity is not None
            config = self._build_workflow_config()
            base_runner = BaseTestSuiteRunner(
                config=config,
                ometa_client=self.client,
                entity=self.table_entity,
            )
            self._runner = base_runner.get_data_quality_runner()

        return self._runner

    def run(self) -> List[TestCaseResultResponse]:
        """Execute all added tests and return results.

        Returns:
            List of test case results

        Raises:
            ValueError: If no tests have been added
        """
        if not self.test_definitions:
            raise ValueError("No tests added. Use add_test() to add test definitions.")

        runner = self._get_runner()
        results: List[TestCaseResultResponse] = []

        for test_def in self.test_definitions:
            test_case = self._build_test_case(test_def)
            result = runner.run_and_handle(test_case)
            if result:
                results.append(result)

        return results
