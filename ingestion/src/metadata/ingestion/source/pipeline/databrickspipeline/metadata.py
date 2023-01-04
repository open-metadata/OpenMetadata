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
from typing import Any, Iterable, List, Optional

from pydantic import ValidationError

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.databricksPipelineConnection import (
    DatabricksPipelineConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.database.databricks.client import DatabricksClient
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils.logger import ingestion_logger

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

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__(config, metadata_config)
        self.connection = self.config.serviceConnection.__root__.config
        self.client = DatabricksClient(self.connection)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: DatabricksPipelineConnection = (
            config.serviceConnection.__root__.config
        )
        if not isinstance(connection, DatabricksPipelineConnection):
            raise InvalidSourceException(
                f"Expected DatabricksPipelineConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_pipelines_list(self) -> Iterable[dict]:
        """
        Get List of all pipelines
        """
        for workflow in self.client.list_jobs():
            yield workflow

    def get_pipeline_name(self, pipeline_details: dict) -> str:
        """
        Get Pipeline Name
        """
        return pipeline_details["settings"]["name"]

    def yield_pipeline(self, pipeline_details: Any) -> Iterable[CreatePipelineRequest]:
        """
        Method to Get Pipeline Entity
        """
        self.context.job_id_list = []
        try:
            yield CreatePipelineRequest(
                name=pipeline_details["job_id"],
                displayName=pipeline_details["settings"]["name"],
                description=pipeline_details["settings"]["name"],
                tasks=self.get_tasks(pipeline_details),
                service=EntityReference(
                    id=self.context.pipeline_service.id.__root__, type="pipelineService"
                ),
            )

        except TypeError as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error building Databricks Pipeline information from {pipeline_details}."
                f" There might be Databricks Jobs API version incompatibilities - {err}"
            )
        except ValidationError as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error building pydantic model for {pipeline_details} - {err}"
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Wild error ingesting pipeline {pipeline_details} - {err}")

    def get_tasks(self, pipeline_details: dict) -> List[Task]:
        task_list = []
        self.append_context(key="job_id_list", value=pipeline_details["job_id"])

        downstream_tasks = self.get_downstream_tasks(
            pipeline_details["settings"]["tasks"]
        )
        for task in pipeline_details["settings"]["tasks"]:
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
        task_key_list = [task["task_key"] for task in workflow]

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

        for task in workflow:
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
                for attempt in runs:
                    for task_run in attempt["tasks"]:
                        task_status = []
                        task_status.append(
                            TaskStatus(
                                name=task_run["task_key"],
                                executionStatus=STATUS_MAP.get(
                                    task_run["state"].get("result_state"),
                                    StatusType.Failed,
                                ),
                                startTime=task_run["start_time"],
                                endTime=task_run["end_time"],
                                logLink=task_run["run_page_url"],
                            )
                        )
                        pipeline_status = PipelineStatus(
                            taskStatus=task_status,
                            timestamp=attempt["start_time"],
                            executionStatus=STATUS_MAP.get(
                                attempt["state"].get("result_state"),
                                StatusType.Failed,
                            ),
                        )
                        yield OMetaPipelineStatus(
                            pipeline_fqn=self.context.pipeline.fullyQualifiedName.__root__,
                            pipeline_status=pipeline_status,
                        )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(f"Failed to yield pipeline status: {exc}")

    def yield_pipeline_lineage_details(
        self, pipeline_details: Any
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Get lineage between pipeline and data sources
        """
        logger.info("Lineage is not yet supported on Databicks Pipelines")
