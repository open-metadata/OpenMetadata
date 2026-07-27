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
from typing import List, Optional, Tuple, Type, cast  # noqa: UP035

from metadata.__version__ import get_client_version
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
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.step import Step
from metadata.ingestion.api.steps import BulkSink, Processor, Sink, Source, Stage
from metadata.ingestion.models.custom_types import ServiceWithConnectionType
from metadata.ingestion.ometa.utils import sanitize_user_agent
from metadata.profiler.api.models import ProfilerProcessorConfig
from metadata.utils.class_helper import (
    get_pipeline_type_from_source_config,
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
    steps: Tuple[Step, ...]  # noqa: UP006

    def __init__(self, config: OpenMetadataWorkflowConfig):
        self.config = config

        self.service_type: ServiceType = get_service_type_from_source_type(self.config.source.type)

        super().__init__(
            config=config,
            workflow_config=config.workflowConfig,
            service_type=self.service_type,
        )

    def _build_user_agent(self) -> Optional[str]:  # noqa: UP045
        """
        HTTP User-Agent identifying the connector, workflow type and service to the
        OpenMetadata server, e.g. ``snowflake_metadata (service: prod-snowflake; v1.10.0.0)``.
        Every part is best-effort: anything that cannot be resolved is left out, and on
        any unexpected error we return ``None`` so the client keeps its default agent.
        """
        try:
            connector = self.config.source.type
            if not connector:
                return None
            workflow_type = self._resolve_workflow_type()
            agent = f"{connector}_{workflow_type}" if workflow_type else connector
            context = self._user_agent_context()
        except Exception as exc:
            logger.debug(f"Could not build the connector User-Agent header: {exc}")
            return None
        return f"{agent} ({context})" if context else agent

    def _resolve_workflow_type(self) -> Optional[str]:  # noqa: UP045
        """
        Clean workflow type token (metadata/lineage/usage/...), falling back to the raw
        source-config discriminator (e.g. ``AutoClassification``) when the pipeline type
        is not mapped, and to ``None`` if even that is unavailable.
        """
        source_config = self.config.source.sourceConfig
        try:
            return get_pipeline_type_from_source_config(source_config).value
        except Exception as exc:
            logger.debug(f"Using the raw source-config type for the User-Agent: {exc}")
            return getattr(getattr(source_config.config, "type", None), "value", None)

    def _user_agent_context(self) -> str:
        """Best-effort ``service: ...; v...`` detail, omitting any unavailable part."""
        parts = []
        service_name = sanitize_user_agent(self.config.source.serviceName)
        if service_name:
            parts.append(f"service: {service_name}")
        try:
            parts.append(f"v{get_client_version()}")
        except Exception as exc:
            logger.debug(f"Could not resolve the ingestion client version: {exc}")
        return "; ".join(parts)

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
                if processed_record is not None and isinstance(step, (Processor, Stage, Sink)):
                    processed_record = step.run(processed_record)

        # Try to pick up the BulkSink and execute it, if needed
        bulk_sink = next((step for step in self.steps if isinstance(step, BulkSink)), None)
        if bulk_sink:
            bulk_sink.run()

    def get_failures(self) -> List[StackTraceError]:  # noqa: UP006
        return self.source.get_status().failures

    def workflow_steps(self) -> List[Step]:  # noqa: UP006
        return [self.source] + list(self.steps)

    def _retrieve_service_connection_if_needed(self, service_type: ServiceType) -> None:
        """
        We override the current `serviceConnection` source config object if source workflow service already exists
        in OM. When secrets' manager is configured, we retrieve the service connection from the secrets' manager.
        Otherwise, we get the service connection from the service object itself through the default `SecretsManager`.

        :param service_type: source workflow service type
        :return:
        """
        if not self.config.source.serviceConnection and not self.metadata.config.forceEntityOverwriting:
            service_name = self.config.source.serviceName
            try:
                service: ServiceWithConnectionType = cast(
                    ServiceWithConnectionType,  # noqa: TC006
                    self.metadata.get_by_name(
                        get_service_class_from_service_type(service_type),
                        service_name,
                    ),
                )
                if service:
                    self.config.source.serviceConnection = ServiceConnection(service.connection)
                else:
                    raise InvalidWorkflowJSONException(  # noqa: TRY301
                        f"Error getting the service [{service_name}] from the API. If it exists in OpenMetadata,"
                        " make sure the ingestion-bot JWT token is valid and that the Workflow is deployed"
                        " with the latest one. If this error persists, recreate the JWT token and"
                        " redeploy the Workflow."
                    )
            except InvalidWorkflowJSONException as exc:
                raise exc  # noqa: TRY201
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Unknown error getting service connection for service name [{service_name}]"
                    f" using the secrets manager provider [{self.metadata.config.secretsManagerProvider}]: {exc}"
                )

    @inject
    def validate(self, profiler_config_class: Inject[Type[ProfilerProcessorConfig]] = None):  # noqa: UP006
        if profiler_config_class is None:
            raise DependencyNotFoundError(
                "ProfilerProcessorConfig class not found. Please ensure the ProfilerProcessorConfig is properly registered."
            )

        try:
            if not self.config.source.serviceConnection.root.config.supportsProfiler:  # pyright: ignore[reportAttributeAccessIssue]
                raise AttributeError()  # noqa: TRY301
        except AttributeError:
            if profiler_config_class.model_validate(self.config.processor.model_dump().get("config")).ignoreValidation:
                logger.debug(
                    f"Profiler is not supported for the service connection: {self.config.source.serviceConnection}"
                )
                return
            raise WorkflowExecutionError(  # noqa: B904
                f"Profiler is not supported for the service connection: {self.config.source.serviceConnection}"
            )

    def import_source_class(self) -> Type[Source]:  # noqa: UP006
        source_type = self.config.source.type.lower()
        try:
            return (
                import_from_module(self.config.source.serviceConnection.root.config.sourcePythonClass)  # pyright: ignore[reportAttributeAccessIssue]
                if source_type.startswith(CUSTOM_CONNECTOR_PREFIX)
                else import_source_class(service_type=self.service_type, source_type=source_type)
            )
        except DynamicImportException as e:
            if source_type.startswith(CUSTOM_CONNECTOR_PREFIX):
                raise e  # noqa: TRY201
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to import source of type '{source_type}'")
            raise MissingPluginException(source_type)  # noqa: B904
