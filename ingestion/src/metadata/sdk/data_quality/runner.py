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

"""Class that allows running data quality checks by code"""
# pyright: reportCallIssue=false, reportRedeclaration=false

from typing import Any, List, Optional, Type, TypeVar, cast

import yaml
from typing_extensions import Self

from metadata.data_quality.api.models import (
    TestCaseDefinition,
    TestCaseResultResponse,
    TestSuiteProcessorConfig,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
)
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuiteConfigType,
    TestSuitePipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata as OMeta
from metadata.sdk import OpenMetadata
from metadata.sdk import client as get_client
from metadata.sdk.data_quality.result_capturing_processor import (
    ResultCapturingProcessor,
)
from metadata.sdk.data_quality.tests import BaseTest
from metadata.sdk.data_quality.workflow_config_builder import WorkflowConfigBuilder
from metadata.workflow.data_quality import TestSuiteWorkflow

T = TypeVar("T", bound=BaseModel)


class TestRunner:
    """Simplified test runner for executing data quality tests on OpenMetadata tables.

    This class provides a fluent API for defining and executing data quality tests
    against tables in OpenMetadata. It handles test case creation, workflow configuration,
    and result collection.

    The runner automatically fetches table metadata and service connections from OpenMetadata,
    builds test cases from test definitions, and executes them using the TestSuiteWorkflow.

    Attributes:
        table_fqn: Fully qualified name of the table to test
        test_definitions: List of test definitions to execute
        client: OpenMetadata API client
        table: Table entity from OpenMetadata
        service_connection: Database connection from the service

    Example:
        >>> from metadata.sdk.data_quality import TestRunner, TableRowCountToBeBetween
        >>> runner = TestRunner.for_table("MySQL.default.db.table")
        >>> runner.add_test(TableRowCountToBeBetween(min_count=100, max_count=1000))
        >>> results = runner.run()
    """

    def __init__(
        self,
        table_fqn: str,
        client: Optional[OMeta[Any, Any]] = None,
    ):
        """Initialize TestRunner with table FQN and optional OpenMetadata client.

        Args:
            table_fqn: Fully qualified name of the table
            client: Optional OpenMetadata client (will create one if not provided)
        """
        self.table_fqn: str = table_fqn
        self.test_definitions: List[TestCaseDefinition] = []

        if client is None:
            metadata: OpenMetadata = get_client()
            client: OMeta[Any, Any] = metadata.ometa

        self.client: OMeta[Any, Any] = client
        self.table: Optional[Table] = None
        self.service_connection: Optional[DatabaseConnection] = None

    @staticmethod
    def _convert_ometa_exception(
        entity: Type[T], identifier: str | Uuid, e: Exception
    ) -> Exception:
        """Handle OpenMetadata exceptions."""
        if not isinstance(e, APIError):
            return e

        status_code = cast(int, e.status_code)
        if status_code == 404:
            return ValueError(
                f"{entity.__name__} '{identifier}' not found in OpenMetadata."
            )

        if status_code in (401, 403):
            return ValueError(
                f"Could not fetch {entity.__name__} from OpenMetadata. "
                + "Request was unauthorized or it couldn't be authenticated."
            )

        return e

    def _safe_get_by_name(
        self, entity_type: Type[T], fqn: str, fields: Optional[List[str]] = None
    ) -> T:
        """Safely fetch entity by name with exception handling.

        Args:
            entity_type: Entity class to fetch
            fqn: Fully qualified name
            fields: Optional list of fields to fetch

        Returns:
            Entity instance of type T

        Raises:
            ValueError: If entity not found or fetch fails
        """
        try:
            typed_client = cast(OMeta[T, Any], self.client)
            entity = typed_client.get_by_name(
                entity=entity_type,
                fqn=fqn,
                fields=fields,
                nullable=False,
            )
            return cast(T, entity)
        except Exception as exc:
            raise self._convert_ometa_exception(entity_type, fqn, exc)

    def _safe_get_by_id(self, entity_type: Type[T], entity_id: str | Uuid) -> T:
        """Safely fetch entity by ID with exception handling.

        Args:
            entity_type: Entity class to fetch
            entity_id: Entity UUID

        Returns:
            Entity instance of type T

        Raises:
            ValueError: If entity not found or fetch fails
        """
        try:
            typed_client = cast(OMeta[T, Any], self.client)
            entity = typed_client.get_by_id(entity_type, entity_id, nullable=False)
            return cast(T, entity)
        except Exception as exc:
            raise self._convert_ometa_exception(entity_type, entity_id, exc)

    @classmethod
    def for_table(
        cls,
        table_fqn: str,
        client: Optional[OMeta[Any, Any]] = None,
    ) -> Self:
        """Initialize runner for a specific table FQN.

        Args:
            table_fqn: Fully qualified name of the table (e.g., "MySQL.default.db.table")
            client: Optional OpenMetadata client (will create one if not provided)

        Returns:
            TestRunner instance

        Example:
            >>> from metadata.sdk.data_quality import TestRunner, TableColumnCountToBeBetween
            >>> runner = TestRunner.for_table("MySQL.default.db.table")
            >>> runner.add_test(TableColumnCountToBeBetween(min_count=10))
            >>> results = runner.run()
        """
        runner = cls(table_fqn, client=client)
        runner._initialize()
        return runner

    @classmethod
    def from_yaml(
        cls,
        *,
        yaml_string: Optional[str] = None,
        file_path: Optional[str] = None,
        use_connection_from_yaml: bool = False,
        client: Optional[OMeta[Any, Any]] = None,
    ) -> Self:
        """Build TestRunner from a YAML workflow string."""

        assert (
            yaml_string is not None or file_path is not None
        ), "`TestRunner.from_yaml` expects either `yaml_string` or `file_path` to be provided."

        if file_path is not None:
            with open(file_path, "r", encoding="utf-8") as stream:
                yaml_string = stream.read()

        data = yaml.safe_load(cast(str, yaml_string))

        config = OpenMetadataWorkflowConfig(**data)
        source = config.source

        assert (
            source.type == TestSuiteConfigType.TestSuite.value
        ), f"Can't create test suite for source type: {source.type}"

        source_config = source.sourceConfig.config
        assert isinstance(
            source_config, TestSuitePipeline
        ), f"Can't create test suite for source config type: {type(source.sourceConfig.config)}"
        assert (
            source_config.entityFullyQualifiedName is not None
        ), "TestSuitePipeline config must have entity fully qualified name"

        if use_connection_from_yaml:
            client = OMeta(config=config.workflowConfig.openMetadataServerConfig)

        runner = cls.for_table(
            source_config.entityFullyQualifiedName.root, client=client
        )

        processor: Optional[TestSuiteProcessorConfig] = None
        if config.processor and config.processor.config:
            processor = TestSuiteProcessorConfig(**config.processor.config.model_dump())

        if processor is None:
            return runner

        if tests_definitions := processor.testCases:
            runner.test_definitions = tests_definitions

        return runner

    def _initialize(self) -> None:
        """Fetch table entity and service connection from OpenMetadata.

        This method retrieves the table entity and associated database service connection
        from OpenMetadata. It validates that the table exists and has a properly configured
        service connection.

        Raises:
            ValueError: If table not found, service not found, or connection not configured
        """
        self.table = self._safe_get_by_name(
            Table,
            self.table_fqn,
            fields=[
                "tableProfilerConfig",
                "testSuite",
                "serviceType",
                "service",
                "database",
            ],
        )

        service_id = cast(EntityReference, self.table.service).id
        service = self._safe_get_by_id(DatabaseService, service_id)

        self.service_connection = cast(DatabaseConnection, service.connection)

    def add_test(self, test_definition: BaseTest) -> None:
        """Add a test definition to be executed.

        Args:
            test_definition: Test definition instance (e.g., TableColumnCountToBeBetween)

        Returns:
            Self for method chaining
        """
        self.test_definitions.append(test_definition.to_test_case_definition())

    def add_tests(self, *test_definitions: BaseTest) -> None:
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
            self.add_test(test_definition)

    def run(self) -> List[TestCaseResultResponse]:
        """Execute all added tests and return results.

        Returns:
            List of test case results

        Raises:
            ValueError: If no tests have been added
        """
        if not self.test_definitions:
            raise ValueError("No tests added. Use add_test() to add test definitions.")

        assert self.table is not None
        assert self.service_connection is not None

        config_builder = WorkflowConfigBuilder(
            table=self.table,
            service_connection=self.service_connection,
            ometa_config=self.client.config,
        )
        config_builder.add_test_definitions(self.test_definitions)
        config = config_builder.build()

        workflow = TestSuiteWorkflow.create(config.model_dump())

        original_processor = workflow.steps[0]
        result_capturer = ResultCapturingProcessor(original_processor)
        workflow.steps = (result_capturer,) + workflow.steps[1:]

        workflow.execute()

        return result_capturer.get_results()
