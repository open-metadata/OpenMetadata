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
Databricks pipeline source to extract metadata
"""

import traceback
from typing import Any, Iterable, List

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
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
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
    def create(cls, config_dict, metadata: OpenMetadata):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: DatabricksPipelineConnection = (
            config.serviceConnection.__root__.config
        )
        if not isinstance(connection, DatabricksPipelineConnection):
            raise InvalidSourceException(
                f"Expected DatabricksPipelineConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_pipelines_list(self) -> Iterable[dict]:
        for workflow in self.client.list_jobs() or []:
            yield workflow

    def get_pipeline_name(self, pipeline_details: dict) -> str:
        return pipeline_details["settings"].get("name")

    def yield_pipeline(
        self, pipeline_details: Any
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """Method to Get Pipeline Entity"""
        self.context.job_id_list = []
        try:
            pipeline_request = CreatePipelineRequest(
                name=pipeline_details["job_id"],
                displayName=pipeline_details["settings"].get("name"),
                description=pipeline_details["settings"].get("name"),
                tasks=self.get_tasks(pipeline_details),
                service=self.context.pipeline_service,
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

    def get_tasks(self, pipeline_details: dict) -> List[Task]:
        task_list = []
        self.context.append(key="job_id_list", value=pipeline_details["job_id"])

        downstream_tasks = self.get_downstream_tasks(
            pipeline_details["settings"].get("tasks")
        )
        for task in pipeline_details["settings"].get("tasks", []):
            task_list.append(
                Task(
                    name=task["task_key"],
                    displayName=task["task_key"],
                    taskType=self.get_task_type(task),
                    downstreamTasks=downstream_tasks.get(task["task_key"], []),
                )
            )

        return task_list

    def get_task_type(self, task):
        task_key = "undefined_task_type"
        for key in task.keys():
            if key.endswith("_task"):
                task_key = key

        return task_key

    def get_downstream_tasks(self, workflow):
        task_key_list = [task["task_key"] for task in workflow or []]

        dependent_tasks = self.get_dependent_tasks(workflow)

        downstream_tasks = {}

        for task_key, task_depend_ons in dependent_tasks.items():
            if task_depend_ons:
                for task in task_depend_ons:
                    if task in downstream_tasks:
                        downstream_tasks[task].append(task_key)
                    else:
                        downstream_tasks[task] = [task_key]

        for task in task_key_list:
            if task not in downstream_tasks:
                downstream_tasks[task] = []

        return downstream_tasks

    def get_dependent_tasks(self, workflow):
        dependent_tasks = {}

        for task in workflow or []:
            depends_on = task.get("depends_on")
            if depends_on:
                dependent_tasks[task["task_key"]] = [v["task_key"] for v in depends_on]
            else:
                dependent_tasks[task["task_key"]] = None

        return dependent_tasks

    def yield_pipeline_status(self, pipeline_details) -> Iterable[OMetaPipelineStatus]:
        for job_id in self.context.job_id_list:
            try:
                runs = self.client.get_job_runs(job_id=job_id)
                for attempt in runs or []:
                    for task_run in attempt["tasks"]:
                        task_status = []
                        task_status.append(
                            TaskStatus(
                                name=task_run["task_key"],
                                executionStatus=STATUS_MAP.get(
                                    task_run["state"].get("result_state"),
                                    StatusType.Failed,
                                ),
                                startTime=convert_timestamp_to_milliseconds(
                                    task_run["start_time"]
                                ),
                                endTime=convert_timestamp_to_milliseconds(
                                    task_run["end_time"]
                                ),
                                logLink=task_run["run_page_url"],
                            )
                        )
                        pipeline_status = PipelineStatus(
                            taskStatus=task_status,
                            timestamp=convert_timestamp_to_milliseconds(
                                attempt["start_time"]
                            ),
                            executionStatus=STATUS_MAP.get(
                                attempt["state"].get("result_state"),
                                StatusType.Failed,
                            ),
                        )
                        pipeline_fqn = fqn.build(
                            metadata=self.metadata,
                            entity_type=Pipeline,
                            service_name=self.context.pipeline_service,
                            pipeline_name=self.context.pipeline,
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
        self, pipeline_details: Any
    ) -> Iterable[Either[AddLineageRequest]]:
        """Get lineage between pipeline and data sources. Not Implemented."""
