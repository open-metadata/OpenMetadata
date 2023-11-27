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
from typing import Any, Iterable, List

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.services.connections.pipeline.gluePipelineConnection import (
    GluePipelineConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.models import Either, StackTraceError
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.time_utils import convert_timestamp_to_milliseconds

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

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.task_id_mapping = {}
        self.job_name_list = set()
        self.glue = self.connection

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: GluePipelineConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, GluePipelineConnection):
            raise InvalidSourceException(
                f"Expected GlueConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_pipelines_list(self) -> Iterable[dict]:
        for workflow in self.glue.list_workflows()["Workflows"]:
            jobs = self.glue.get_workflow(Name=workflow, IncludeGraph=True)["Workflow"]
            yield jobs

    def get_pipeline_name(self, pipeline_details: dict) -> str:
        return pipeline_details[NAME]

    def yield_pipeline(
        self, pipeline_details: Any
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """Method to Get Pipeline Entity"""
        source_url = (
            f"https://{self.service_connection.awsConfig.awsRegion}.console.aws.amazon.com/glue/home?"
            f"region={self.service_connection.awsConfig.awsRegion}#/v2/etl-configuration/"
            f"workflows/view/{pipeline_details[NAME]}"
        )
        self.job_name_list = set()
        pipeline_request = CreatePipelineRequest(
            name=pipeline_details[NAME],
            displayName=pipeline_details[NAME],
            tasks=self.get_tasks(pipeline_details),
            service=self.context.pipeline_service,
            sourceUrl=source_url,
        )
        yield Either(right=pipeline_request)
        self.register_record(pipeline_request=pipeline_request)

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
    ) -> Iterable[Either[OMetaPipelineStatus]]:
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
                            startTime=convert_timestamp_to_milliseconds(
                                attempt["StartedOn"].timestamp()
                            ),
                            endTime=convert_timestamp_to_milliseconds(
                                attempt["CompletedOn"].timestamp()
                            ),
                        )
                    )
                    pipeline_status = PipelineStatus(
                        taskStatus=task_status,
                        timestamp=convert_timestamp_to_milliseconds(
                            attempt["StartedOn"].timestamp()
                        ),
                        executionStatus=STATUS_MAP.get(
                            attempt["JobRunState"].lower(), StatusType.Pending
                        ).value,
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
                        stack_trace=traceback.format_exc(),
                    )
                )

    def yield_pipeline_lineage_details(
        self, pipeline_details: Any
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Get lineage between pipeline and data sources
        """
