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
Base workflow definition.

To be extended by any other workflow:
- ingestion
- lineage
- usage
- profiler
- test suite
- data insights
"""
import traceback
import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional, Tuple, TypeVar, cast

from metadata.generated.schema.api.services.ingestionPipelines.createIngestionPipeline import (
    CreateIngestionPipelineRequest,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    AirflowConfig,
    IngestionPipeline,
    PipelineState,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.tests.testSuite import ServiceType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.step import Step
from metadata.ingestion.api.steps import BulkSink, Processor, Sink, Source, Stage
from metadata.ingestion.models.custom_types import ServiceWithConnectionType
from metadata.ingestion.ometa.client_utils import create_ometa_client
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.timer.repeated_timer import RepeatedTimer
from metadata.utils import fqn
from metadata.utils.class_helper import (
    get_pipeline_type_from_source_config,
    get_reference_type_from_service_type,
    get_service_class_from_service_type,
    get_service_type_from_source_type,
)
from metadata.utils.helpers import datetime_to_ts
from metadata.utils.logger import ingestion_logger, set_loggers_level
from metadata.workflow.workflow_output_handler import get_ingestion_status_timer
from metadata.workflow.workflow_status_mixin import WorkflowStatusMixin

logger = ingestion_logger()

T = TypeVar("T")

REPORTS_INTERVAL_SECONDS = 60


class InvalidWorkflowJSONException(Exception):
    """
    Raised when we cannot properly parse the workflow
    """


class BaseWorkflow(ABC, WorkflowStatusMixin):
    """
    Base workflow implementation
    """

    config: OpenMetadataWorkflowConfig
    _run_id: Optional[str] = None
    service_type: ServiceType
    metadata_config: OpenMetadataConnection
    metadata: OpenMetadata

    # All workflows require a source as a first step
    source: Source
    # All workflows execute a series of steps, aside from the source
    steps: Tuple[Step]

    def __init__(self, config: OpenMetadataWorkflowConfig):
        """
        Disabling pylint to wait for workflow reimplementation as a topology
        """
        self.config = config
        self._timer: Optional[RepeatedTimer] = None
        self._ingestion_pipeline: Optional[IngestionPipeline] = None
        self._start_ts = datetime_to_ts(datetime.now())

        set_loggers_level(config.workflowConfig.loggerLevel.value)

        self.service_type: ServiceType = get_service_type_from_source_type(
            self.config.source.type
        )

        self.metadata_config: OpenMetadataConnection = (
            self.config.workflowConfig.openMetadataServerConfig
        )

        # We create the ometa client at the workflow level and pass it to the steps
        self.metadata = create_ometa_client(self.metadata_config)

        self.set_ingestion_pipeline_status(state=PipelineState.running)

        # Pick up the service connection from the API if needed
        self._retrieve_service_connection_if_needed(self.service_type)

        # Informs the `source` and the rest of `steps` to execute
        self.set_steps()

    @property
    def ingestion_pipeline(self):
        """Get or create the Ingestion Pipeline from the configuration"""
        if not self._ingestion_pipeline:
            self._ingestion_pipeline = self.get_or_create_ingestion_pipeline()

        return self._ingestion_pipeline

    @abstractmethod
    def set_steps(self):
        """
        initialize the tuple of steps to run for each workflow
        and the source
        """

    def _execute_internal(self):
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

    def execute(self) -> None:
        """
        Main entrypoint
        """
        self.timer.trigger()
        try:
            self._execute_internal()

            # If we reach this point, compute the success % and update the associated Ingestion Pipeline status
            self.update_ingestion_status_at_end()

        # Any unhandled exception breaking the workflow should update the status
        except Exception as err:
            self.set_ingestion_pipeline_status(PipelineState.failed)
            raise err

        # Force resource closing. Required for killing the threading
        finally:
            self.stop()

    def stop(self) -> None:
        """
        Main stopping logic
        """
        # Stop the timer first. This runs in a separate thread and if not properly closed
        # it can hung the workflow
        self.timer.stop()
        self.metadata.close()

        for step in self.steps:
            try:
                step.close()
            except Exception as exc:
                logger.warning(f"Error trying to close the step {step} due to [{exc}]")

        self.source.close()

    @property
    def timer(self) -> RepeatedTimer:
        """
        Status timer: It will print the source & sink status every `interval` seconds.
        """
        if not self._timer:
            self._timer = get_ingestion_status_timer(
                interval=REPORTS_INTERVAL_SECONDS, logger=logger, workflow=self
            )

        return self._timer

    @classmethod
    def create(cls, config_dict: dict) -> "BaseWorkflow":
        config = parse_workflow_config_gracefully(config_dict)
        return cls(config)

    @property
    def run_id(self) -> str:
        """
        If the config does not have an informed run id, we'll
        generate and assign one here.
        """
        if not self._run_id:
            if self.config.pipelineRunId:
                self._run_id = str(self.config.pipelineRunId.__root__)
            else:
                self._run_id = str(uuid.uuid4())

        return self._run_id

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
                        __root__=service.connection
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

    def get_or_create_ingestion_pipeline(self) -> Optional[IngestionPipeline]:
        """
        If we get the `ingestionPipelineFqn` from the `workflowConfig`, it means we want to
        keep track of the status.
        - During the UI deployment, the IngestionPipeline is already created from the UI.
        - From external deployments, we might need to create the Ingestion Pipeline the first time
          the YAML is executed.
        If the Ingestion Pipeline is not created, create it now to update the status.

        Note that during the very first run, the service might not even be created yet. In that case,
        we won't be able to flag the RUNNING status. We'll wait until the metadata ingestion
        workflow has prepared the necessary components, and we will update the SUCCESS/FAILED
        status at the end of the flow.
        """
        try:
            maybe_pipeline: Optional[IngestionPipeline] = self.metadata.get_by_name(
                entity=IngestionPipeline, fqn=self.config.ingestionPipelineFQN
            )

            if maybe_pipeline:
                return maybe_pipeline

            # Get the name from <service>.<name> or, for test suites, <tableFQN>.testSuite
            *_, pipeline_name = fqn.split(self.config.ingestionPipelineFQN)

            service = self._get_ingestion_pipeline_service()

            if service is not None:

                return self.metadata.create_or_update(
                    CreateIngestionPipelineRequest(
                        name=pipeline_name,
                        service=EntityReference(
                            id=service.id,
                            type=get_reference_type_from_service_type(
                                self.service_type
                            ),
                        ),
                        pipelineType=get_pipeline_type_from_source_config(
                            self.config.source.sourceConfig.config
                        ),
                        sourceConfig=self.config.source.sourceConfig,
                        airflowConfig=AirflowConfig(),
                    )
                )

            return maybe_pipeline

        except Exception as exc:
            logger.error(
                f"Error trying to get or create the Ingestion Pipeline due to [{exc}]"
            )
            return None

    def _get_ingestion_pipeline_service(self) -> Optional[T]:
        """
        Ingestion Pipelines are linked to either an EntityService (DatabaseService, MessagingService,...)
        or a Test Suite.

        Depending on the Source Config Type, we'll need to GET one or the other to create
        the Ingestion Pipeline
        """

        return self.metadata.get_by_name(
            entity=get_service_class_from_service_type(self.service_type),
            fqn=self.config.source.serviceName,
        )
