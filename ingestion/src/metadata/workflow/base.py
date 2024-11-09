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
"""

import traceback
import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from statistics import mean
from typing import Any, Dict, List, Optional, TypeVar, Union

from metadata.config.common import WorkflowExecutionError
from metadata.generated.schema.api.services.ingestionPipelines.createIngestionPipeline import (
    CreateIngestionPipelineRequest,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    AirflowConfig,
    IngestionPipeline,
    PipelineState,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    LogLevels,
    WorkflowConfig,
)
from metadata.generated.schema.tests.testSuite import ServiceType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.step import Step, Summary
from metadata.ingestion.ometa.client_utils import create_ometa_client
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.timer.repeated_timer import RepeatedTimer
from metadata.utils import fqn
from metadata.utils.class_helper import (
    get_pipeline_type_from_source_config,
    get_reference_type_from_service_type,
    get_service_class_from_service_type,
)
from metadata.utils.execution_time_tracker import ExecutionTimeTracker
from metadata.utils.helpers import datetime_to_ts
from metadata.utils.logger import ingestion_logger, set_loggers_level
from metadata.workflow.workflow_output_handler import WorkflowOutputHandler
from metadata.workflow.workflow_status_mixin import WorkflowStatusMixin

logger = ingestion_logger()

# Type of service linked to the Ingestion Pipeline
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

    config: Union[Any, Dict]
    _run_id: Optional[str] = None
    metadata: OpenMetadata
    metadata_config: OpenMetadataConnection
    service_type: ServiceType

    def __init__(
        self,
        config: Union[Any, Dict],
        workflow_config: WorkflowConfig,
        service_type: ServiceType,
        output_handler: WorkflowOutputHandler = WorkflowOutputHandler(),
    ):
        """
        Disabling pylint to wait for workflow reimplementation as a topology
        """
        self.output_handler = output_handler
        self.config = config
        self.workflow_config = workflow_config
        self.service_type = service_type
        self._timer: Optional[RepeatedTimer] = None
        self._ingestion_pipeline: Optional[IngestionPipeline] = None
        self._start_ts = datetime_to_ts(datetime.now())

        self._execution_time_tracker = ExecutionTimeTracker(
            self.workflow_config.loggerLevel == LogLevels.DEBUG
        )

        set_loggers_level(self.workflow_config.loggerLevel.value)

        # We create the ometa client at the workflow level and pass it to the steps
        self.metadata = create_ometa_client(
            self.workflow_config.openMetadataServerConfig
        )
        self.set_ingestion_pipeline_status(state=PipelineState.running)

        self.post_init()

    @property
    def ingestion_pipeline(self) -> Optional[IngestionPipeline]:
        """Get or create the Ingestion Pipeline from the configuration"""
        if not self._ingestion_pipeline and self.config.ingestionPipelineFQN:
            self._ingestion_pipeline = self.get_or_create_ingestion_pipeline()

        return self._ingestion_pipeline

    def stop(self) -> None:
        """
        Main stopping logic
        """
        # Stop the timer first. This runs in a separate thread and if not properly closed
        # it can hung the workflow
        self.timer.stop()
        self.metadata.close()

        for step in self.workflow_steps():
            try:
                step.close()
            except Exception as exc:
                logger.warning(f"Error trying to close the step {step} due to [{exc}]")

    @property
    def timer(self) -> RepeatedTimer:
        """
        Status timer: It will print the source & sink status every `interval` seconds.
        """
        if not self._timer:
            self._timer = RepeatedTimer(
                REPORTS_INTERVAL_SECONDS, self._report_ingestion_status
            )

        return self._timer

    @classmethod
    @abstractmethod
    def create(cls, config_dict: dict):
        """Single function to execute to create a Workflow instance"""

    @abstractmethod
    def post_init(self) -> None:
        """Method to execute after we have initialized all the internals"""

    @abstractmethod
    def execute_internal(self) -> None:
        """Workflow-specific logic to execute safely"""

    def calculate_success(self) -> Optional[float]:
        """
        Get the success % of the internal execution.
        Since we'll use this to get a single success % from multiple steps, we'll take
        the minimum success % from all the steps. This way, we can have a proper
        workflow status.
        E.g., if we have no errors on the source but a bunch of them on the sink,
        we still want the flow to be marked as a failure or partial success.
        """
        if not self.workflow_steps():
            logger.warning("No steps to calculate success")
            return None

        return mean(
            [step.get_status().calculate_success() for step in self.workflow_steps()]
        )

    @abstractmethod
    def get_failures(self) -> List[StackTraceError]:
        """Get the failures to flag whether if the workflow succeeded or not"""

    @abstractmethod
    def workflow_steps(self) -> List[Step]:
        """Steps to report status from"""

    def raise_from_status_internal(self, raise_warnings=False) -> None:
        """Based on the internal workflow status, raise a WorkflowExecutionError"""
        for step in self.workflow_steps():
            if (
                step.get_status().failures
                and step.get_status().calculate_success()
                < self.workflow_config.successThreshold
            ):
                raise WorkflowExecutionError(
                    f"{step.name} reported errors: {Summary.from_step(step)}"
                )

            if raise_warnings and step.status.warnings:
                raise WorkflowExecutionError(
                    f"{step.name} reported warning: {Summary.from_step(step)}"
                )

    def execute(self) -> None:
        """
        Main entrypoint:
        1. Start logging timer. It will be closed at `stop`
        2. Execute the workflow
        3. Validate the pipeline status
        4. Update the pipeline status at the end
        """
        pipeline_state = PipelineState.success
        self.timer.trigger()
        try:
            self.execute_internal()

            if self.workflow_config.successThreshold <= self.calculate_success() < 100:
                pipeline_state = PipelineState.partialSuccess

        # Any unhandled exception breaking the workflow should update the status
        except Exception as err:
            pipeline_state = PipelineState.failed
            raise err

        # Force resource closing. Required for killing the threading
        finally:
            ingestion_status = self.build_ingestion_status()
            self.set_ingestion_pipeline_status(pipeline_state, ingestion_status)
            self.stop()

    @property
    def run_id(self) -> str:
        """
        If the config does not have an informed run id, we'll
        generate and assign one here.
        """
        if not self._run_id:
            if self.config.pipelineRunId:
                self._run_id = str(self.config.pipelineRunId.root)
            else:
                self._run_id = str(uuid.uuid4())

        return self._run_id

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
                            self.config.source.sourceConfig
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

    def _report_ingestion_status(self):
        """
        Given a logger, use it to INFO the workflow status
        """
        try:
            for step in self.workflow_steps():
                logger.info(
                    f"{step.name}: Processed {len(step.status.records)} records,"
                    f" updated {len(step.status.updated_records)} records,"
                    f" filtered {len(step.status.filtered)} records,"
                    f" found {len(step.status.failures)} errors"
                )

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Wild exception reporting status - {exc}")

    def _is_debug_enabled(self) -> bool:
        return (
            hasattr(self, "config")
            and hasattr(self.config, "workflowConfig")
            and hasattr(self.config.workflowConfig, "loggerLevel")
            and self.config.workflowConfig.loggerLevel is LogLevels.DEBUG
        )

    def print_status(self):
        start_time = self.workflow_steps()[0].get_status().source_start_time

        self.output_handler.print_status(
            self.result_status(),
            self.workflow_steps(),
            start_time,
            self._is_debug_enabled(),
        )
