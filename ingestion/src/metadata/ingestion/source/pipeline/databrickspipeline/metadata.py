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
Databricks pipeline source to extract metadata
"""

import traceback
from typing import Iterable, List, Optional

from pydantic import ValidationError

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.services.connections.pipeline.databricksPipelineConnection import (
    DatabricksPipelineConnection,
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
from metadata.ingestion.source.pipeline.databrickspipeline.models import (
    DataBrickPipelineDetails,
    DBRun,
)
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.time_utils import convert_timestamp_to_milliseconds

logger = ingestion_logger()


STATUS_MAP = {
    "SUCCESS": StatusType.Successful,
    "FAILED": StatusType.Failed,
    "TIMEOUT": StatusType.Failed,
    "CANCELED": StatusType.Failed,
    "PENDING": StatusType.Pending,
    "RUNNING": StatusType.Pending,
    "TERMINATING": StatusType.Pending,
    "SKIPPED": StatusType.Failed,
    "INTERNAL_ERROR": StatusType.Failed,
}


class DatabrickspipelineSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Databricks Jobs API
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: DatabricksPipelineConnection = config.serviceConnection.root.config
        if not isinstance(connection, DatabricksPipelineConnection):
            raise InvalidSourceException(
                f"Expected DatabricksPipelineConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_pipelines_list(self) -> Iterable[DataBrickPipelineDetails]:
        try:
            for workflow in self.client.list_jobs() or []:
                yield DataBrickPipelineDetails(**workflow)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get pipeline list due to : {exc}")
        return None

    def get_pipeline_name(
        self, pipeline_details: DataBrickPipelineDetails
    ) -> Optional[str]:
        try:
            return pipeline_details.settings.name
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get pipeline name due to : {exc}")

        return None

    def yield_pipeline(
        self, pipeline_details: DataBrickPipelineDetails
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """Method to Get Pipeline Entity"""
        try:
            description = pipeline_details.settings.description
            pipeline_request = CreatePipelineRequest(
                name=EntityName(str(pipeline_details.job_id)),
                displayName=pipeline_details.settings.name,
                description=Markdown(description) if description else None,
                tasks=self.get_tasks(pipeline_details),
                scheduleInterval=str(pipeline_details.settings.schedule.cron)
                if pipeline_details.settings.schedule
                else None,
                service=FullyQualifiedEntityName(self.context.get().pipeline_service),
            )
            yield Either(right=pipeline_request)
            self.register_record(pipeline_request=pipeline_request)

        except TypeError as err:
            yield Either(
                left=StackTraceError(
                    name="Pipeline",
                    error=(
                        f"Error building Databricks Pipeline information from {pipeline_details}."
                        f" There might be Databricks Jobs API version incompatibilities - {err}"
                    ),
                    stackTrace=traceback.format_exc(),
                )
            )
        except ValidationError as err:
            yield Either(
                left=StackTraceError(
                    name="Pipeline",
                    error=f"Error building pydantic model for {pipeline_details} - {err}",
                    stackTrace=traceback.format_exc(),
                )
            )
        except Exception as err:
            yield Either(
                left=StackTraceError(
                    name="Pipeline",
                    error=f"Wild error ingesting pipeline {pipeline_details} - {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_tasks(self, pipeline_details: DataBrickPipelineDetails) -> List[Task]:
        try:
            task_list = []
            for run in self.client.get_job_runs(job_id=pipeline_details.job_id) or []:
                run = DBRun(**run)
                task_list.extend(
                    [
                        Task(
                            name=str(task.name),
                            taskType=pipeline_details.settings.task_type,
                            sourceUrl=SourceUrl(run.run_page_url)
                            if run.run_page_url
                            else None,
                            description=Markdown(task.description)
                            if task.description
                            else None,
                            downstreamTasks=[
                                depend_task.name
                                for depend_task in task.depends_on or []
                            ],
                        )
                        for task in run.tasks or []
                    ]
                )
            return task_list
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to get tasks list due to : {exc}")
        return None

    def yield_pipeline_status(
        self, pipeline_details: DataBrickPipelineDetails
    ) -> Iterable[OMetaPipelineStatus]:
        try:
            for run in self.client.get_job_runs(job_id=pipeline_details.job_id) or []:
                run = DBRun(**run)
                task_status = [
                    TaskStatus(
                        name=str(task.name),
                        executionStatus=STATUS_MAP.get(
                            run.state.result_state, StatusType.Failed
                        ),
                        startTime=Timestamp(
                            convert_timestamp_to_milliseconds(run.start_time)
                        ),
                        endTime=Timestamp(
                            convert_timestamp_to_milliseconds(run.end_time)
                        ),
                        logLink=run.run_page_url,
                    )
                    for task in run.tasks or []
                ]
                pipeline_status = PipelineStatus(
                    taskStatus=task_status,
                    timestamp=Timestamp(
                        convert_timestamp_to_milliseconds(run.start_time)
                    ),
                    executionStatus=STATUS_MAP.get(
                        run.state.result_state,
                        StatusType.Failed,
                    ),
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
                    name=pipeline_fqn,
                    error=f"Failed to yield pipeline status: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_pipeline_lineage_details(
        self, pipeline_details: DataBrickPipelineDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """Get lineage between pipeline and data sources. Not Implemented."""
