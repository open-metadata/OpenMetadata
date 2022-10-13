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
Glue pipeline source to extract metadata
"""

import traceback
from typing import Any, Iterable, List, Optional

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
from metadata.generated.schema.entity.services.connections.pipeline.gluePipelineConnection import (
    GluePipelineConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

GRAPH = "Graph"
NODES = "Nodes"
NAME = "Name"
JOB_TYPE = "JOB"
STATUS_MAP = {
    "cancelled": StatusType.Failed,
    "succeeded": StatusType.Successful,
    "failed": StatusType.Failed,
    "running": StatusType.Pending,
    "incomplete": StatusType.Failed,
    "pending": StatusType.Pending,
}


class GluepipelineSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Glue Pipeline's metadata db
    """

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__(config, metadata_config)
        self.task_id_mapping = {}
        self.job_name_list = set()
        self.glue = self.connection.client

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: GluePipelineConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, GluePipelineConnection):
            raise InvalidSourceException(
                f"Expected GlueConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_pipelines_list(self) -> Iterable[dict]:
        """
        Get List of all pipelines
        """
        for workflow in self.glue.list_workflows()["Workflows"]:
            jobs = self.glue.get_workflow(Name=workflow, IncludeGraph=True)["Workflow"]
            yield jobs

    def get_pipeline_name(self, pipeline_details: dict) -> str:
        """
        Get Pipeline Name
        """
        return pipeline_details[NAME]

    def yield_pipeline(self, pipeline_details: Any) -> Iterable[CreatePipelineRequest]:
        """
        Method to Get Pipeline Entity
        """
        self.job_name_list = set()
        pipeline_ev = CreatePipelineRequest(
            name=pipeline_details[NAME],
            displayName=pipeline_details[NAME],
            description="",
            tasks=self.get_tasks(pipeline_details),
            service=EntityReference(
                id=self.context.pipeline_service.id.__root__, type="pipelineService"
            ),
        )
        yield pipeline_ev

    def get_tasks(self, pipeline_details: Any) -> List[Task]:
        task_list = []
        for task in pipeline_details["Graph"]["Nodes"]:
            self.task_id_mapping[task["UniqueId"]] = task["Name"][:128]
            if task["Type"] == JOB_TYPE:
                self.job_name_list.add(task[NAME])
        for task in pipeline_details[GRAPH][NODES]:
            task_list.append(
                Task(
                    name=task[NAME],
                    displayName=task[NAME],
                    taskType=task["Type"],
                    downstreamTasks=self.get_downstream_tasks(
                        task["UniqueId"], pipeline_details[GRAPH]
                    ),
                )
            )
        return task_list

    def get_downstream_tasks(self, task_unique_id, tasks):
        downstream_tasks = []
        for edges in tasks["Edges"]:
            if edges["SourceId"] == task_unique_id and self.task_id_mapping.get(
                edges["DestinationId"]
            ):
                downstream_tasks.append(self.task_id_mapping[edges["DestinationId"]])
        return downstream_tasks

    def yield_pipeline_status(
        self, pipeline_details: Any
    ) -> Iterable[OMetaPipelineStatus]:
        for job in self.job_name_list:
            try:
                runs = self.glue.get_job_runs(JobName=job)
                runs = runs.get("JobRuns", [])
                for attempt in runs:
                    task_status = []
                    task_status.append(
                        TaskStatus(
                            name=attempt["JobName"],
                            executionStatus=STATUS_MAP.get(
                                attempt["JobRunState"].lower(), StatusType.Pending
                            ).value,
                            startTime=attempt["StartedOn"].timestamp(),
                            endTime=attempt["CompletedOn"].timestamp(),
                        )
                    )
                    pipeline_status = PipelineStatus(
                        taskStatus=task_status,
                        timestamp=attempt["StartedOn"].timestamp(),
                        executionStatus=STATUS_MAP.get(
                            attempt["JobRunState"].lower(), StatusType.Pending
                        ).value,
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
