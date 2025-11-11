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
Generic Workflow entrypoint to execute Ingestions

To be extended by any other workflow:
- metadata
- lineage
- usage
- profiler
- test suite
- data insights
"""
import traceback
from abc import ABC, abstractmethod
from typing import List, Tuple, Type, cast

from metadata.config.common import WorkflowExecutionError
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.distributed import DiscoverableSource, ExecutionMode
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.step import Step
from metadata.ingestion.api.steps import BulkSink, Processor, Sink, Source, Stage
from metadata.ingestion.models.custom_types import ServiceWithConnectionType
from metadata.profiler.api.models import ProfilerProcessorConfig
from metadata.utils.class_helper import (
    get_service_class_from_service_type,
    get_service_type_from_source_type,
)
from metadata.utils.constants import CUSTOM_CONNECTOR_PREFIX
from metadata.utils.dependency_injector.dependency_injector import (
    DependencyNotFoundError,
    Inject,
    inject,
)
from metadata.utils.importer import (
    DynamicImportException,
    MissingPluginException,
    import_from_module,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.service_spec.service_spec import import_source_class
from metadata.workflow.base import BaseWorkflow, InvalidWorkflowJSONException

logger = ingestion_logger()


class IngestionWorkflow(BaseWorkflow, ABC):
    """
    Base Ingestion Workflow implementation. This is used for all
    workflows minus the application one, which directly inherits the
    BaseWorkflow.
    """

    config: OpenMetadataWorkflowConfig

    # All workflows require a source as a first step
    source: Source
    # All workflows execute a series of steps, aside from the source
    steps: Tuple[Step]

    def __init__(self, config: OpenMetadataWorkflowConfig):
        self.config = config

        self.service_type: ServiceType = get_service_type_from_source_type(
            self.config.source.type
        )

        super().__init__(
            config=config,
            workflow_config=config.workflowConfig,
            service_type=self.service_type,
        )

    @abstractmethod
    def set_steps(self):
        """
        initialize the tuple of steps to run for each workflow
        and the source
        """

    def post_init(self) -> None:
        # Pick up the service connection from the API if needed
        self._retrieve_service_connection_if_needed(self.service_type)

        # Informs the `source` and the rest of `steps` to execute
        self.set_steps()

    @classmethod
    def create(cls, config_dict: dict):
        config = parse_workflow_config_gracefully(config_dict)
        return cls(config)

    def execute_internal(self):
        """
        Internal execution that needs to be filled
        by each ingestion workflow.

        Pass each record from the source down the pipeline:
        Source -> (Processor) -> Sink
        or Source -> (Processor) -> Stage -> BulkSink

        Note how the Source class needs to be an Iterator. Specifically,
        we are defining Sources as Generators.

        Supports two execution modes:
        1. SEQUENTIAL (default): Single-threaded pipeline execution
        2. DISTRIBUTED: Parallel execution across multiple pods via Argo Workflows
        """
        execution_mode = self._get_execution_mode()

        if execution_mode == ExecutionMode.DISTRIBUTED:
            logger.info("Executing workflow in DISTRIBUTED mode via Argo Workflows")
            return self._execute_distributed()
        else:
            logger.info("Executing workflow in SEQUENTIAL mode")
            return self._execute_sequential()

    def _get_execution_mode(self) -> ExecutionMode:
        """
        Determine execution mode based on configuration and source capabilities.

        Returns:
            ExecutionMode.DISTRIBUTED if configured and source supports it
            ExecutionMode.SEQUENTIAL otherwise
        """
        distributed_config = None
        if hasattr(self.config, "workflowConfig") and self.config.workflowConfig:
            distributed_config = getattr(
                self.config.workflowConfig, "distributedExecution", None
            )

        if distributed_config and distributed_config.enabled:
            if isinstance(self.source, DiscoverableSource):
                logger.info(
                    f"Source {self.source.__class__.__name__} supports distributed execution"
                )
                return ExecutionMode.DISTRIBUTED
            else:
                logger.warning(
                    f"Source {self.source.__class__.__name__} does not support "
                    f"distributed execution (must implement DiscoverableSource). "
                    f"Falling back to sequential mode."
                )

        return ExecutionMode.SEQUENTIAL

    def _execute_sequential(self):
        """
        Execute workflow in sequential mode (original implementation).

        This is the default mode that processes entities one-by-one in a single thread.
        """
        for record in self.source.run():
            processed_record = record
            for step in self.steps:
                # We only process the records for these Step types
                if processed_record is not None and isinstance(
                    step, (Processor, Stage, Sink)
                ):
                    processed_record = step.run(processed_record)

        # Try to pick up the BulkSink and execute it, if needed
        bulk_sink = next(
            (step for step in self.steps if isinstance(step, BulkSink)), None
        )
        if bulk_sink:
            bulk_sink.run()

    def _execute_distributed(self):
        """
        Execute workflow in distributed mode.

        Supports two modes:
        1. Argo Workflows (production) - For Kubernetes deployments
        2. Local threads (testing) - For local development/testing

        Mode is determined by orchestrator config.
        """
        distributed_config = self.config.workflowConfig.distributedExecution
        orchestrator = getattr(distributed_config, "orchestrator", "argo")

        # Handle both string and Enum values for orchestrator
        orchestrator_str = (
            str(orchestrator).lower()
            if hasattr(orchestrator, "value")
            else str(orchestrator).lower()
        )
        if "local" in orchestrator_str:
            logger.info("Using LOCAL thread-based distributed execution")
            return self._execute_distributed_local()

        # Argo mode for production Kubernetes deployment
        try:
            from metadata.distributed.argo_client import ArgoWorkflowClient

            client = ArgoWorkflowClient(
                namespace=distributed_config.namespace or "default",
                service_account=distributed_config.serviceAccount,
                image=distributed_config.image or "openmetadata/ingestion:latest",
            )

            workflow_id = client.submit_workflow(
                workflow_config=self.config.dict(),
                source=self.source,
                parallelism=distributed_config.parallelism or 50,
                retry_limit=distributed_config.retryPolicy.maxAttempts
                if distributed_config.retryPolicy
                else 3,
            )

            logger.info(f"Submitted Argo Workflow: {workflow_id}")
            logger.info(
                f"Monitor workflow at Argo UI: /workflows/{distributed_config.namespace}/{workflow_id}"
            )

            if distributed_config.waitForCompletion:
                logger.info("Waiting for workflow completion...")
                result = client.wait_for_completion(
                    workflow_id, timeout=distributed_config.timeoutSeconds or 86400
                )
                logger.info(f"Workflow completed with status: {result.status}")

                if result.status == "Failed":
                    raise WorkflowExecutionError(
                        f"Distributed workflow {workflow_id} failed"
                    )

            return workflow_id

        except ImportError as exc:
            logger.warning(
                f"Argo Workflows client not available: {exc}. "
                f"Falling back to local thread-based execution."
            )
            return self._execute_distributed_local()
        except Exception as exc:
            logger.error(
                f"Failed to execute Argo workflow: {exc}. "
                f"Attempting local execution...",
                exc_info=True,
            )
            try:
                return self._execute_distributed_local()
            except Exception as local_exc:
                logger.error(
                    f"Local execution also failed: {local_exc}",
                    exc_info=True,
                )
                raise WorkflowExecutionError(
                    f"All distributed execution modes failed. "
                    f"Argo error: {exc}, Local error: {local_exc}"
                ) from exc

    def _execute_distributed_local(self):
        """
        Execute distributed workflow using local threads.

        This simulates distributed execution on a local machine
        without requiring Kubernetes/Argo.
        """
        from metadata.distributed.local_executor import LocalDistributedExecutor

        distributed_config = self.config.workflowConfig.distributedExecution
        parallelism = distributed_config.parallelism or 10

        logger.info(f"Starting local distributed execution with {parallelism} threads")

        executor = LocalDistributedExecutor(parallelism=parallelism)

        # Get sink from workflow steps
        sink = next((step for step in self.steps if isinstance(step, Sink)), None)
        if not sink:
            raise WorkflowExecutionError("No sink found in workflow steps")

        # First, create database and schema hierarchy (sequential)
        logger.info("Creating database and schema hierarchy...")
        self._create_database_schema_hierarchy()

        # Execute distributed processing
        result = executor.execute(source=self.source, sink=sink)

        logger.info(f"Local distributed execution completed: {result['status']}")

        return result

    def _create_database_schema_hierarchy(self):
        """
        Create database service, databases, and schemas before distributed processing.

        This ensures the hierarchy exists in OpenMetadata before workers
        try to create tables/entities.

        We temporarily modify the topology to skip table processing, then restore it.
        """
        from metadata.ingestion.source.database.database_service import (
            DatabaseServiceSource,
        )

        if not isinstance(self.source, DatabaseServiceSource):
            logger.debug(
                "Source is not a DatabaseServiceSource, skipping hierarchy creation"
            )
            return

        logger.info("Creating database service, databases, and schemas...")

        # Store original children of databaseSchema node
        original_children = self.source.topology.databaseSchema.children

        try:
            # Temporarily remove table and stored_procedure from schema's children
            # This prevents the topology runner from processing tables
            self.source.topology.databaseSchema.children = []

            # Process the topology up to schema level using the topology runner
            # This handles all context management automatically
            for record in self.source.run():
                # Process each record through pipeline steps (processors and sink)
                processed_record = record
                for step in self.steps:
                    if processed_record is not None and isinstance(
                        step, (Processor, Stage, Sink)
                    ):
                        processed_record = step.run(processed_record)

        except Exception as exc:
            logger.warning(
                f"Failed to create hierarchy: {exc}",
                exc_info=True,
            )
        finally:
            # Restore original children
            self.source.topology.databaseSchema.children = original_children

        logger.info("Database and schema hierarchy created")

    def get_failures(self) -> List[StackTraceError]:
        return self.source.get_status().failures

    def workflow_steps(self) -> List[Step]:
        return [self.source] + list(self.steps)

    def _retrieve_service_connection_if_needed(self, service_type: ServiceType) -> None:
        """
        We override the current `serviceConnection` source config object if source workflow service already exists
        in OM. When secrets' manager is configured, we retrieve the service connection from the secrets' manager.
        Otherwise, we get the service connection from the service object itself through the default `SecretsManager`.

        :param service_type: source workflow service type
        :return:
        """
        if (
            not self.config.source.serviceConnection
            and not self.metadata.config.forceEntityOverwriting
        ):
            service_name = self.config.source.serviceName
            try:
                service: ServiceWithConnectionType = cast(
                    ServiceWithConnectionType,
                    self.metadata.get_by_name(
                        get_service_class_from_service_type(service_type),
                        service_name,
                    ),
                )
                if service:
                    self.config.source.serviceConnection = ServiceConnection(
                        service.connection
                    )
                else:
                    raise InvalidWorkflowJSONException(
                        f"Error getting the service [{service_name}] from the API. If it exists in OpenMetadata,"
                        " make sure the ingestion-bot JWT token is valid and that the Workflow is deployed"
                        " with the latest one. If this error persists, recreate the JWT token and"
                        " redeploy the Workflow."
                    )
            except InvalidWorkflowJSONException as exc:
                raise exc
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Unknown error getting service connection for service name [{service_name}]"
                    f" using the secrets manager provider [{self.metadata.config.secretsManagerProvider}]: {exc}"
                )

    @inject
    def validate(
        self, profiler_config_class: Inject[Type[ProfilerProcessorConfig]] = None
    ):
        if profiler_config_class is None:
            raise DependencyNotFoundError(
                "ProfilerProcessorConfig class not found. Please ensure the ProfilerProcessorConfig is properly registered."
            )

        try:
            if not self.config.source.serviceConnection.root.config.supportsProfiler:
                raise AttributeError()
        except AttributeError:
            if profiler_config_class.model_validate(
                self.config.processor.model_dump().get("config")
            ).ignoreValidation:
                logger.debug(
                    f"Profiler is not supported for the service connection: {self.config.source.serviceConnection}"
                )
                return
            raise WorkflowExecutionError(
                f"Profiler is not supported for the service connection: {self.config.source.serviceConnection}"
            )

    def import_source_class(self) -> Type[Source]:
        source_type = self.config.source.type.lower()
        try:
            return (
                import_from_module(
                    self.config.source.serviceConnection.root.config.sourcePythonClass
                )
                if source_type.startswith(CUSTOM_CONNECTOR_PREFIX)
                else import_source_class(
                    service_type=self.service_type, source_type=source_type
                )
            )
        except DynamicImportException as e:
            if source_type.startswith(CUSTOM_CONNECTOR_PREFIX):
                raise e
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to import source of type '{source_type}'")
            raise MissingPluginException(source_type)
