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
Add methods to the workflows for updating the IngestionPipeline status
"""
import uuid
from datetime import datetime
from typing import Optional, Tuple

from metadata.config.common import WorkflowExecutionError
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
    PipelineState,
    PipelineStatus,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.step import Step
from metadata.ingestion.api.steps import Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata

SUCCESS_THRESHOLD_VALUE = 90


class WorkflowStatusMixin:
    """
    Helper methods to manage IngestionPipeline status
    and workflow run ID.

    To be inherited by the Base Workflow
    """

    config: OpenMetadataWorkflowConfig
    _run_id: Optional[str] = None
    metadata: OpenMetadata
    _start_ts: int
    ingestion_pipeline: Optional[IngestionPipeline]

    # All workflows require a source as a first step
    source: Source
    # All workflows execute a series of steps, aside from the source
    steps: Tuple[Step]

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

    def _raise_from_status_internal(self, raise_warnings=False):
        """
        Check the status of all steps
        """
        if (
            self.source.get_status().failures
            and self._get_source_success() < SUCCESS_THRESHOLD_VALUE
        ):
            raise WorkflowExecutionError(
                "Source reported errors", self.source.get_status()
            )

        for step in self.steps:
            if step.status.failures:
                raise WorkflowExecutionError(
                    f"{step.__class__.__name__} reported errors", step.get_status()
                )
            if raise_warnings and step.status.warnings:
                raise WorkflowExecutionError(
                    f"{step.__class__.__name__} reported warnings", step.get_status()
                )

    def _new_pipeline_status(self, state: PipelineState) -> PipelineStatus:
        """Create new Pipeline Status"""
        return PipelineStatus(
            runId=self.run_id,
            pipelineState=state,
            startDate=self._start_ts,
            timestamp=self._start_ts,
        )

    def set_ingestion_pipeline_status(
        self,
        state: PipelineState,
    ) -> None:
        """
        Method to set the pipeline status of current ingestion pipeline
        """

        # if we don't have a related Ingestion Pipeline FQN, no status is set.
        if self.config.ingestionPipelineFQN and self.ingestion_pipeline:
            if state in (PipelineState.queued, PipelineState.running):
                pipeline_status = self._new_pipeline_status(state)
            else:
                pipeline_status = self.metadata.get_pipeline_status(
                    self.config.ingestionPipelineFQN, self.run_id
                )
                if not pipeline_status:
                    pipeline_status = self._new_pipeline_status(state)
                # if workflow is ended then update the end date in status
                pipeline_status.endDate = datetime.now().timestamp() * 1000
                pipeline_status.pipelineState = state

            self.metadata.create_or_update_pipeline_status(
                self.config.ingestionPipelineFQN, pipeline_status
            )

    def update_ingestion_status_at_end(self):
        """
        Once the execute method is done, update the status
        as OK or KO depending on the success rate.
        """
        pipeline_state = PipelineState.success
        if SUCCESS_THRESHOLD_VALUE <= self._get_source_success() < 100:
            pipeline_state = PipelineState.partialSuccess
        self.set_ingestion_pipeline_status(pipeline_state)

    def _get_source_success(self):
        return self.source.get_status().calculate_success()

    def raise_from_status(self, raise_warnings=False):
        """
        Method to raise error if failed execution
        and updating Ingestion Pipeline Status
        """
        try:
            self._raise_from_status_internal(raise_warnings)
        except WorkflowExecutionError as err:
            self.set_ingestion_pipeline_status(PipelineState.failed)
            raise err

    def result_status(self) -> int:
        """
        Returns 1 if source status is failed, 0 otherwise.
        """
        if self.source.get_status().failures:
            return 1
        return 0
