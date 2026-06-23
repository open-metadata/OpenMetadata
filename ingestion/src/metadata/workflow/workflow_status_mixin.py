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
Add methods to the workflows for updating the IngestionPipeline status
"""

import traceback
import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional, Tuple  # noqa: UP035

if TYPE_CHECKING:
    from metadata.utils.progress_registry import ProgressNodeSnapshot

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
    PipelineState,
    PipelineStatus,
)
from metadata.generated.schema.entity.services.ingestionPipelines.progressUpdate import (
    ProgressUpdate,
    ProgressUpdateType,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    IngestionStatus,
    StepSummary,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import Map, Timestamp
from metadata.ingestion.api.step import Step, Summary
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ometa_logger
from metadata.workflow.context.context_manager import ContextManager
from metadata.workflow.progress_render import snapshot_to_progress_payload

logger = ometa_logger()


class WorkflowResultStatus(Enum):
    SUCCESS = 0
    FAILURE = 1


class WorkflowStatusMixin:
    """
    Helper methods to manage IngestionPipeline status
    and workflow run ID.

    To be inherited by the Base Workflow
    """

    config: OpenMetadataWorkflowConfig
    _run_id: Optional[str] = None  # noqa: UP045
    metadata: OpenMetadata
    _start_ts: int
    ingestion_pipeline: Optional[IngestionPipeline]  # noqa: UP045

    # All workflows execute a series of steps, aside from the source
    steps: Tuple[Step]  # noqa: UP006

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
                self._run_id = str(uuid.uuid4())  # pylint: disable=no-member

        return self._run_id

    def _new_pipeline_status(self, state: PipelineState) -> PipelineStatus:
        """Create new Pipeline Status"""
        return PipelineStatus(
            runId=self.run_id,
            pipelineState=state,
            startDate=Timestamp(self._start_ts),
            timestamp=Timestamp(self._start_ts),
        )  # type: ignore

    def update_pipeline_status_metadata(self, pipeline_status: PipelineStatus) -> PipelineStatus:
        """
        Update the pipeline status metadata with the context manager data.
        """
        metadata = ContextManager.dump_contexts()
        if metadata:
            pipeline_status.metadata = Map(**metadata)
        else:
            pipeline_status.metadata = None
        return pipeline_status

    def set_ingestion_pipeline_status(
        self,
        state: PipelineState,
        ingestion_status: Optional[IngestionStatus] = None,  # noqa: UP045
    ) -> None:
        """
        Method to set the pipeline status of current ingestion pipeline
        """

        try:
            # if we don't have a related Ingestion Pipeline FQN, no status is set.
            if (
                self.config.ingestionPipelineFQN
                and self.ingestion_pipeline
                and self.ingestion_pipeline.fullyQualifiedName
            ):
                pipeline_status = self.metadata.get_pipeline_status(
                    self.ingestion_pipeline.fullyQualifiedName.root, self.run_id
                )
                if not pipeline_status:
                    # We need to crete the status
                    pipeline_status = self._new_pipeline_status(state)
                else:
                    # if workflow is ended then update the end date in status
                    pipeline_status.endDate = Timestamp(int(datetime.now().timestamp() * 1000))
                    pipeline_status.pipelineState = state

                pipeline_status.status = ingestion_status if ingestion_status else pipeline_status.status
                # committing configurations can be a burden on resources,
                # we dump a subset to be mindful of the payload size
                pipeline_status.config = Map(
                    **self.config.model_dump(
                        include={"appConfig"},
                        mask_secrets=True,
                    )
                )

                pipeline_status = self.update_pipeline_status_metadata(pipeline_status)

                self.metadata.create_or_update_pipeline_status(
                    self.ingestion_pipeline.fullyQualifiedName.root, pipeline_status
                )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Unhandled error trying to update Ingestion Pipeline status [{err}]")

    def raise_from_status(self, raise_warnings=False):
        """
        Method to raise error if failed execution
        """
        self.raise_from_status_internal(raise_warnings)  # type: ignore

    def result_status(self) -> WorkflowResultStatus:
        """
        Returns 1 if source status is failed, 0 otherwise.
        """
        if self.get_failures():  # type: ignore
            return WorkflowResultStatus.FAILURE
        return WorkflowResultStatus.SUCCESS

    def build_ingestion_status(self) -> Optional[IngestionStatus]:  # noqa: UP045
        """
        Get the results from the steps and prep the payload
        we'll send to the API
        """

        return IngestionStatus(
            [
                StepSummary.model_validate(Summary.from_step(step).model_dump())
                for step in self.workflow_steps()  # type: ignore
            ]
        )

    def _collect_progress_snapshot(self) -> Optional["ProgressNodeSnapshot"]:
        """Snapshot the first workflow step that owns a progress registry.

        Reads the backing attribute (not the `progress` property) so we never
        create an empty registry on a step that never ran a topology walk.
        """
        snapshot = None
        for step in self.workflow_steps():
            registry = getattr(step, "_progress_registry", None)
            if registry is not None:
                snapshot_fn = getattr(step, "progress_snapshot", None)
                snapshot = snapshot_fn() if snapshot_fn is not None else registry.snapshot()
                break
        return snapshot

    def send_progress_update(self, update_type: ProgressUpdateType = ProgressUpdateType.PROCESSING) -> None:
        """
        Send a progress update to the OpenMetadata server via SSE endpoint.
        Called periodically during workflow execution.
        """
        try:
            if (
                self.config.ingestionPipelineFQN
                and self.ingestion_pipeline
                and self.ingestion_pipeline.fullyQualifiedName
            ):
                progress_data = snapshot_to_progress_payload(self._collect_progress_snapshot())

                progress_update = ProgressUpdate(
                    runId=self.run_id,
                    timestamp=Timestamp(int(datetime.now().timestamp() * 1000)),
                    updateType=update_type,
                    progress=progress_data if progress_data else None,
                )

                self.metadata.send_progress_update(
                    self.ingestion_pipeline.fullyQualifiedName.root,
                    self.run_id,
                    progress_update,
                )
        except Exception as err:
            logger.debug(f"Failed to send progress update: {err}")
