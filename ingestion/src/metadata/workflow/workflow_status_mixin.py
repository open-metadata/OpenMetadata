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
from typing import Optional

from metadata.config.common import WorkflowExecutionError
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineState,
    PipelineStatus,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class WorkflowStatusMixin:
    """
    Helper methods to manage IngestionPipeline status
    and workflow run ID
    """

    config: OpenMetadataWorkflowConfig
    _run_id: Optional[str] = None
    metadata: OpenMetadata

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

    def set_ingestion_pipeline_status(
        self,
        state: PipelineState,
    ) -> None:
        """
        Method to set the pipeline status of current ingestion pipeline
        """

        # if we don't have a related Ingestion Pipeline FQN, no status is set.
        if self.config.ingestionPipelineFQN:

            if state in (PipelineState.queued, PipelineState.running):
                pipeline_status = PipelineStatus(
                    runId=self.run_id,
                    pipelineState=state,
                    startDate=datetime.now().timestamp() * 1000,
                    timestamp=datetime.now().timestamp() * 1000,
                )
            else:
                pipeline_status = self.metadata.get_pipeline_status(
                    self.config.ingestionPipelineFQN, self.run_id
                )
                # if workflow is ended then update the end date in status
                pipeline_status.endDate = datetime.now().timestamp() * 1000
                pipeline_status.pipelineState = state

            self.metadata.create_or_update_pipeline_status(
                self.config.ingestionPipelineFQN, pipeline_status
            )

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
