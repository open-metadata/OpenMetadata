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

"""Builder for creating OpenMetadata workflow configurations for test suite execution."""
# pyright: reportOptionalMemberAccess=false

from typing import Any, List, Optional, Type, TypeVar, cast

from typing_extensions import Self

from metadata.data_quality.api.models import (
    TestCaseDefinition,
    TestSuiteProcessorConfig,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
)
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuiteConfigType,
    TestSuitePipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    LogLevels,
    OpenMetadataWorkflowConfig,
    Processor,
    Sink,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.generated.schema.type.basic import (
    ComponentConfig,
    FullyQualifiedEntityName,
    Uuid,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata as OMeta

T = TypeVar("T", bound=BaseModel)


class WorkflowConfigBuilder:
    """Builds OpenMetadataWorkflowConfig for test suite execution.

    This builder encapsulates the logic for creating a complete workflow configuration
    required to execute data quality tests against a table. It constructs the source,
    processor, sink, and workflow configurations based on the provided table entity,
    service connection, and test definitions.

    Attributes:
        table: Table entity to run tests against
        service_connection: Database service connection for the table
        ometa_config: OpenMetadata server configuration
        test_definitions: List of test case definitions to execute
    """

    def __init__(
        self,
        client: OMeta[Any, Any],
    ):
        """Initialize the workflow config builder.

        Args:
            client: OpenMetadata client
        """
        self.client: OMeta[Any, Any] = client

        self.table: Optional[Table] = None
        self.service_connection: Optional[DatabaseConnection] = None
        self.test_definitions: List[TestCaseDefinition] = []
        self.force_test_update: bool = True
        self.log_level: LogLevels = LogLevels.INFO
        self.raise_on_error: bool = False
        self.success_threshold: int = 90
        self.enable_streamable_logs: bool = False

    def add_test_definition(self, test_definition: TestCaseDefinition) -> Self:
        """Add test definition to workflow config
        Args:
            test_definition: Test case definition to add

        Returns:
            Self
        """
        self.test_definitions.append(test_definition)
        return self

    def add_test_definitions(self, test_definitions: List[TestCaseDefinition]) -> Self:
        """Add test definitions to the workflow configuration.

        Args:
            test_definitions: List of test case definitions to add

        Returns:
            Self for method chaining
        """
        self.test_definitions.extend(test_definitions)
        return self

    def with_table(self, table_fqn: str) -> Self:
        self.table = self._safe_get_by_name(
            Table,
            table_fqn,
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
        return self

    def with_force_test_update(self, force_test_update: bool) -> Self:
        self.force_test_update = force_test_update
        return self

    def with_log_level(self, log_level: LogLevels) -> Self:
        self.log_level = log_level
        return self

    def with_raise_on_error(self, raise_on_error: bool) -> Self:
        self.raise_on_error = raise_on_error
        return self

    def with_success_threshold(self, success_threshold: int) -> Self:
        self.success_threshold = success_threshold
        return self

    def with_enable_streamable_logs(self, enable: bool) -> Self:
        self.enable_streamable_logs = enable
        return self

    def build(self) -> OpenMetadataWorkflowConfig:
        """Build the complete OpenMetadata workflow configuration.

        This method constructs all components of the workflow configuration:
        - Source: TestSuite source with table FQN and service connection
        - Processor: Test case runner with test definitions
        - Sink: Metadata REST sink for persisting results
        - WorkflowConfig: Logger and server settings

        Returns:
            Complete OpenMetadataWorkflowConfig ready for execution
        """
        assert (
            self.table is not None
        ), "Table entity not provided. Call `WorkflowConfigBuilder.add_table()` first.`"
        assert (
            self.service_connection is not None
        ), "DatabaseConnection entity not provided. Call `WorkflowConfigBuilder.add_table()` first.`"

        test_suite_pipeline = TestSuitePipeline(
            entityFullyQualifiedName=FullyQualifiedEntityName(
                root=self.table.fullyQualifiedName.root
            ),
            type=TestSuiteConfigType.TestSuite,
            serviceConnections=None,
            profileSample=None,
            profileSampleType=None,
            samplingMethodType=None,
            testCases=None,
        )

        source_config = SourceConfig(config=test_suite_pipeline)

        source = Source(
            type=self.table.serviceType.value,
            serviceName=self.table.service.name,
            serviceConnection=ServiceConnection(root=self.service_connection),
            sourceConfig=source_config,
        )

        processor_config = TestSuiteProcessorConfig(
            testCases=self.test_definitions,
            forceUpdate=self.force_test_update,
        )

        processor = Processor(
            type="orm-test-runner",
            config=ComponentConfig(
                root=processor_config.model_dump()  # pyright: ignore[reportUnknownMemberType]
            ),
        )

        sink = Sink(type="metadata-rest", config=ComponentConfig(root={}))

        workflow_config = WorkflowConfig(
            loggerLevel=self.log_level,
            openMetadataServerConfig=self.client.config,
            raiseOnError=self.raise_on_error,
            successThreshold=self.success_threshold,
        )

        config = OpenMetadataWorkflowConfig(
            source=source,
            processor=processor,
            sink=sink,
            workflowConfig=workflow_config,
            ingestionPipelineFQN=None,
            pipelineRunId=None,
            enableStreamableLogs=self.enable_streamable_logs,
        )

        return config

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
