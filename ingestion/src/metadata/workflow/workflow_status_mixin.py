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
from time import sleep
from typing import Callable, TypeVar

from requests.exceptions import HTTPError

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
from metadata.ingestion.ometa.client import APIError, RestTransportError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.progress.registry import ProgressRegistry
from metadata.utils.logger import ometa_logger
from metadata.workflow.context.context_manager import ContextManager

logger = ometa_logger()

TERMINAL_STATUS_WRITE_ATTEMPTS = 3
TERMINAL_STATUS_WRITE_RETRY_DELAY = 0.25
RETRYABLE_STATUS_HTTP_CODES = {500, 502, 503, 504}

_StatusResponse = TypeVar("_StatusResponse")


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
    _run_id: str | None = None
    metadata: OpenMetadata
    _start_ts: int
    ingestion_pipeline: IngestionPipeline | None

    # All workflows execute a series of steps, aside from the source
    steps: tuple[Step, ...]

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

    def _run_pipeline_status_request(
        self, request: Callable[[], _StatusResponse], terminal: bool
    ) -> _StatusResponse:
        """Retry the terminal read and write separately on short transient failures.

        Terminal callers disable the REST client's HTTP retry loop per call, so
        mixed gateway and transport failures share this budget. HTTPError also
        covers gateways returning plain HTML or empty 5xx.
        """
        attempts = TERMINAL_STATUS_WRITE_ATTEMPTS if terminal else 1
        for attempt in range(attempts):
            try:
                return request()
            except (APIError, RestTransportError, HTTPError) as exc:
                http_status = (
                    exc.status_code
                    if isinstance(exc, APIError)
                    else getattr(getattr(exc, "response", None), "status_code", None)
                )
                retryable = (
                    isinstance(exc, RestTransportError)
                    or http_status in RETRYABLE_STATUS_HTTP_CODES
                )
                if not retryable or attempt == attempts - 1:
                    raise
                logger.warning(
                    "Transient terminal pipeline status request failure (attempt %s/%s): %s",
                    attempt + 1,
                    attempts,
                    exc,
                )
                sleep(TERMINAL_STATUS_WRITE_RETRY_DELAY * (attempt + 1))
        raise RuntimeError("Terminal pipeline status retry loop did not complete")

    def _write_pipeline_status(
        self, fqn: str, status: PipelineStatus, terminal: bool
    ) -> None:
        """Repeat an idempotent final status PUT without changing the run's outcome."""
        self._run_pipeline_status_request(
            lambda: self.metadata.create_or_update_pipeline_status(
                fqn, status, **({"retries": 0} if terminal else {})
            ),
            terminal=terminal,
        )

    def _read_pipeline_status(
        self, fqn: str, run_id: str, terminal: bool
    ) -> PipelineStatus | None:
        """Do not abandon a terminal status because its preceding GET times out."""
        return self._run_pipeline_status_request(
            lambda: self.metadata.get_pipeline_status(
                fqn, run_id, **({"retries": 0} if terminal else {})
            ),
            terminal=terminal,
        )

    def set_ingestion_pipeline_status(
        self,
        state: PipelineState,
        ingestion_status: IngestionStatus | None = None,
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
                pipeline_status = self._read_pipeline_status(
                    self.ingestion_pipeline.fullyQualifiedName.root,
                    self.run_id,
                    terminal=state is not PipelineState.running,
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

                self._write_pipeline_status(
                    self.ingestion_pipeline.fullyQualifiedName.root,
                    pipeline_status,
                    terminal=state is not PipelineState.running,
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

    def build_ingestion_status(self) -> IngestionStatus:
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

    def _find_progress_registry(self) -> ProgressRegistry | None:
        """Registry of the first workflow step that tracked progress. Reads the
        backing attribute so we never create an empty registry on a step that
        never tracked progress."""
        result = None
        for step in self.workflow_steps():  # pyright: ignore[reportAttributeAccessIssue]
            tracking = getattr(step, "_progress_tracking", None)
            if tracking is not None:
                result = tracking.registry
                break
        return result

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
                registry = self._find_progress_registry()
                progress_data = registry.sse_payload() if registry is not None else None
                counters = registry.global_counters() if registry is not None else []
                eta_seconds = registry.eta_seconds() if registry is not None else None
                total_assets = registry.assets_ingested() if registry is not None else None

                progress_update = ProgressUpdate(
                    runId=self.run_id,
                    timestamp=Timestamp(int(datetime.now().timestamp() * 1000)),
                    updateType=update_type,
                    progress=progress_data if progress_data else None,  # pyright: ignore[reportArgumentType]
                    globalCounters=[  # pyright: ignore[reportArgumentType]
                        {"entityType": type_, "done": done, "total": total} for type_, done, total in counters
                    ],
                    estimatedSecondsRemaining=eta_seconds,
                    totalAssetsIngested=total_assets,
                    stepName=None,
                    currentEntity=None,
                    message=None,
                )

                self.metadata.send_progress_update(
                    self.ingestion_pipeline.fullyQualifiedName.root,
                    self.run_id,
                    progress_update,
                )
        except Exception as err:
            logger.debug(f"Failed to send progress update: {err}")

    def terminal_progress_update_type(self, pipeline_state: PipelineState) -> ProgressUpdateType:
        if pipeline_state is PipelineState.failed:
            return ProgressUpdateType.ERROR

        return ProgressUpdateType.PIPELINE_COMPLETE
