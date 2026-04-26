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
Microsoft Fabric Pipeline Source Module

Extracts metadata from Microsoft Fabric Data Factory pipelines.
"""
import traceback
from typing import Any, Dict, Iterable, List, Optional

from metadata.clients.microsoftfabric.models import FabricActivity, FabricPipeline
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.services.connections.pipeline.microsoftFabricPipelineConnection import (
    MicrosoftFabricPipelineConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    SourceUrl,
    Timestamp,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.helpers import datetime_to_ts
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Map Fabric pipeline run status to OpenMetadata status
STATUS_MAP = {
    "NotStarted": StatusType.Pending,
    "InProgress": StatusType.Pending,
    "Completed": StatusType.Successful,
    "Failed": StatusType.Failed,
    "Cancelled": StatusType.Skipped,
    "Deduped": StatusType.Skipped,
}

# Map Fabric activity run status to OpenMetadata status
ACTIVITY_STATUS_MAP = {
    "Succeeded": StatusType.Successful,
    "Failed": StatusType.Failed,
    "Skipped": StatusType.Skipped,
    "InProgress": StatusType.Pending,
    "Queued": StatusType.Pending,
    "Cancelled": StatusType.Skipped,
}


def get_tasks_from_activities(activities: List[FabricActivity]) -> List[Task]:
    """
    Convert Fabric pipeline activities to OpenMetadata tasks.

    Args:
        activities: List of FabricActivity objects from the pipeline definition

    Returns:
        List of Task objects with proper downstream task relationships
    """
    if not activities:
        return []

    # Build a map of activity name -> downstream activities
    downstream_map: Dict[str, List[str]] = {
        activity.name: [] for activity in activities
    }

    for activity in activities:
        if activity.depends_on:
            for dependency in activity.depends_on:
                # depends_on contains dicts like {"activity": "name", "dependencyConditions": [...]}
                upstream_name = (
                    dependency.get("activity") if isinstance(dependency, dict) else None
                )
                if upstream_name and upstream_name in downstream_map:
                    downstream_map[upstream_name].append(activity.name)

    tasks = []
    for activity in activities:
        task = Task(
            name=activity.name,
            displayName=activity.name,
            description=activity.description,
            taskType=activity.type,
            downstreamTasks=downstream_map.get(activity.name, []),
        )
        tasks.append(task)

    return tasks


class MicrosoftFabricPipelineSource(PipelineServiceSource):
    """
    Implements the necessary methods to extract
    Pipeline metadata from Microsoft Fabric Data Factory.
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: MicrosoftFabricPipelineConnection = (
            config.serviceConnection.root.config
        )
        if not isinstance(connection, MicrosoftFabricPipelineConnection):
            raise InvalidSourceException(
                f"Expected MicrosoftFabricPipelineConnection, but got {type(connection).__name__}"
            )
        return cls(config, metadata)

    def get_pipelines_list(self) -> Iterable[FabricPipeline]:
        """Get List of all pipelines in the workspace"""
        try:
            yield from self.client.get_pipelines()
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get pipeline list due to: {exc}")

    def get_pipeline_name(self, pipeline_details: FabricPipeline) -> str:
        """Get Pipeline Name"""
        return pipeline_details.display_name

    def _get_task_list(self, pipeline_id: str) -> Optional[List[Task]]:
        """
        Get list of tasks (activities) for a pipeline.

        In Fabric, pipeline activities are the actual tasks (Copy, Transform, etc.)
        """
        try:
            activities = self.client.get_pipeline_activities(pipeline_id)
            if activities:
                return get_tasks_from_activities(activities)
            # Return empty list instead of None to avoid null pointer exceptions
            return []
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to get tasks list due to: {exc}")
        # Return empty list instead of None
        return []

    def yield_pipeline(
        self, pipeline_details: FabricPipeline
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """Method to Get Pipeline Entity"""
        try:
            pipeline_request = CreatePipelineRequest(
                name=EntityName(pipeline_details.display_name),
                description=Markdown(pipeline_details.description)
                if pipeline_details.description
                else None,
                sourceUrl=SourceUrl(
                    self.client.get_pipeline_url(pipeline_id=pipeline_details.id)
                ),
                tasks=self._get_task_list(pipeline_id=pipeline_details.id),
                service=FullyQualifiedEntityName(self.context.get().pipeline_service),
            )
            yield Either(right=pipeline_request)
            self.register_record(pipeline_request=pipeline_request)

            # Store task names in context for filtering activity runs
            # This handles cases where pipeline definitions change over time
            self.context.get().task_names = {
                task.name for task in pipeline_request.tasks or []
            }
        except Exception as exc:
            # Set empty task names on error to prevent attribute errors
            self.context.get().task_names = set()
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.display_name,
                    error=f"Error ingesting pipeline {pipeline_details.display_name} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_pipeline_status(  # pylint: disable=too-many-locals,too-many-nested-blocks
        self, pipeline_details: FabricPipeline
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """
        Get Pipeline Status from run history with actual activity-level execution details.

        This method now fetches real activity run data from the Fabric API using the
        queryactivityruns endpoint, providing accurate task-level status, timing,
        and execution information.

        Note: Similar to Airflow, we filter activity runs to only include tasks that
        exist in the current pipeline definition. This handles cases where pipelines
        have evolved over time and old runs may contain tasks that no longer exist.
        """
        try:
            runs = self.client.get_pipeline_runs(pipeline_details.id)

            for run in runs or []:
                run_start = (
                    Timestamp(datetime_to_ts(run.start_time))
                    if run.start_time
                    else None
                )
                run_end = (
                    Timestamp(datetime_to_ts(run.end_time)) if run.end_time else None
                )

                execution_status = STATUS_MAP.get(run.status, StatusType.Pending)

                # Fetch actual activity-level execution details from Fabric API
                task_status = []
                if run.id and self.context.get().task_names:
                    # Microsoft Fabric pipelines can have old tasks that were removed/renamed
                    # We only include tasks that exist in the current pipeline definition
                    try:
                        activity_runs = self.client.get_pipeline_activity_runs(
                            run.id, run
                        )

                        for activity_run in activity_runs:
                            # Only include tasks that exist in current pipeline definition
                            if (
                                activity_run.activity_name
                                not in self.context.get().task_names
                            ):
                                logger.debug(
                                    f"Skipping task '{activity_run.activity_name}' from run {run.id} "
                                    f"as it no longer exists in current pipeline definition"
                                )
                                continue

                            # Map activity status to OpenMetadata status
                            activity_status = ACTIVITY_STATUS_MAP.get(
                                activity_run.status, StatusType.Pending
                            )

                            # Convert activity run times to timestamps
                            activity_start = (
                                Timestamp(
                                    datetime_to_ts(activity_run.activity_run_start)
                                )
                                if activity_run.activity_run_start
                                else None
                            )
                            activity_end = (
                                Timestamp(datetime_to_ts(activity_run.activity_run_end))
                                if activity_run.activity_run_end
                                else None
                            )

                            task_status.append(
                                TaskStatus(
                                    name=activity_run.activity_name,
                                    executionStatus=activity_status,
                                    startTime=activity_start,
                                    endTime=activity_end,
                                )
                            )
                    except Exception as activity_exc:
                        # If we can't fetch activity runs, log warning and continue
                        # This maintains backward compatibility if the API fails
                        logger.warning(
                            f"Could not fetch activity runs for pipeline run {run.id}: {activity_exc}"
                        )
                        logger.debug(traceback.format_exc())

                pipeline_status = PipelineStatus(
                    executionStatus=execution_status,
                    taskStatus=task_status,  # Now contains actual activity execution details
                    timestamp=run_start,
                    endTime=run_end,
                )

                pipeline_fqn = fqn.build(
                    metadata=self.metadata,
                    entity_type=Pipeline,
                    service_name=self.context.get().pipeline_service,
                    pipeline_name=self.context.get().pipeline,
                )
                yield Either(
                    right=OMetaPipelineStatus(
                        pipeline_fqn=pipeline_fqn,
                        pipeline_status=pipeline_status,
                    )
                )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.display_name,
                    error=f"Error ingesting pipeline status for {pipeline_details.display_name} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_pipeline_lineage_details(
        self, pipeline_details: Any
    ) -> Iterable[Either[AddLineageRequest]]:
        return
