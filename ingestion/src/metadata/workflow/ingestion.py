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
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
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
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.step import Step, Summary
from metadata.ingestion.api.steps import BulkSink, Processor, Sink, Source, Stage
from metadata.ingestion.models.custom_types import ServiceWithConnectionType
from metadata.profiler.api.models import ProfilerProcessorConfig
from metadata.utils.class_helper import (
    get_service_class_from_service_type,
    get_service_type_from_source_type,
)
from metadata.utils.constants import CUSTOM_CONNECTOR_PREFIX
from metadata.utils.importer import (
    DynamicImportException,
    MissingPluginException,
    import_from_module,
    import_source_class,
)
from metadata.utils.logger import ingestion_logger
from metadata.workflow.base import BaseWorkflow, InvalidWorkflowJSONException
from metadata.workflow.workflow_status_mixin import SUCCESS_THRESHOLD_VALUE

logger = ingestion_logger()


class IngestionWorkflow(BaseWorkflow, ABC):
    """
    Base Ingestion Workflow implementation
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

        metadata_config: OpenMetadataConnection = (
            self.config.workflowConfig.openMetadataServerConfig
        )

        super().__init__(
            config=config,
            log_level=config.workflowConfig.loggerLevel,
            metadata_config=metadata_config,
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

    def calculate_success(self) -> float:
        return self.source.get_status().calculate_success()

    def get_failures(self) -> List[StackTraceError]:
        return self.source.get_status().failures

    def workflow_steps(self) -> List[Step]:
        return [self.source] + list(self.steps)

    def raise_from_status_internal(self, raise_warnings=False):
        """
        Check the status of all steps
        """
        if (
            self.source.get_status().failures
            and self.calculate_success() < SUCCESS_THRESHOLD_VALUE
        ):
            raise WorkflowExecutionError(
                f"{self.source.name} reported errors: {Summary.from_step(self.source)}"
            )

        for step in self.steps:
            if step.status.failures:
                raise WorkflowExecutionError(
                    f"{step.name} reported errors: {Summary.from_step(step)}"
                )
            if raise_warnings and step.status.warnings:
                raise WorkflowExecutionError(
                    f"{step.name} reported warnings: {Summary.from_step(step)}"
                )

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

    def validate(self):
        try:
            if not self.config.source.serviceConnection.root.config.supportsProfiler:
                raise AttributeError()
        except AttributeError:
            if ProfilerProcessorConfig.model_validate(
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
