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
Dagster source to extract metadata from OM UI
"""
import traceback
from typing import Dict, Iterable, List, Optional

from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.pipeline import (
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.dagsterConnection import (
    DagsterConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.pipeline.dagster.queries import (
    DAGSTER_PIPELINE_DETAILS_GRAPHQL,
    GRAPHQL_QUERY_FOR_JOBS,
    GRAPHQL_RUNS_QUERY,
)
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

STATUS_MAP = {
    "success": StatusType.Successful.value,
    "failure": StatusType.Failed.value,
    "queued": StatusType.Pending.value,
}


class DagsterSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Dagster's metadata db
    """

    config: WorkflowSource

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        self.service_connection = config.serviceConnection.__root__.config
        self.client = get_connection(self.service_connection)
        super().__init__(config, metadata_config)
        # Create the connection to the database

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: DagsterConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, DagsterConnection):
            raise InvalidSourceException(
                f"Expected DagsterConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_run_list(self):
        try:
            # pylint: disable=protected-access
            result = self.client._execute(DAGSTER_PIPELINE_DETAILS_GRAPHQL)
        except ConnectionError as conerr:
            logger.error(f"Cannot connect to dagster client {conerr}")
            logger.debug(f"Failed due to : {traceback.format_exc()}")

        return result["repositoriesOrError"]["nodes"]

    def get_tag_labels(
        self, tags: OMetaTagAndClassification
    ) -> Optional[List[TagLabel]]:

        return [
            TagLabel(
                tagFQN=fqn.build(
                    self.metadata,
                    Tag,
                    classification_name="DagsterTags",
                    tag_name=tags,
                ),
                labelType="Automated",
                state="Suggested",
                source="Tag",
            )
        ]

    def get_jobs(self, pipeline_name) -> Iterable[dict]:
        try:
            parameters = {
                "selector": {
                    "graphName": pipeline_name,
                    "repositoryName": self.context.repository_name,
                    "repositoryLocationName": self.context.repository_location,
                }
            }
            jobs = self.client._execute(  # pylint: disable=protected-access
                query=GRAPHQL_QUERY_FOR_JOBS, variables=parameters
            )
            return jobs["graphOrError"]
        except Exception as err:
            logger.error(f"Error while getting jobs {pipeline_name} - {err}")
            logger.debug(traceback.format_exc())

        return []

    def yield_pipeline(self, pipeline_details) -> Iterable[CreatePipelineRequest]:
        """
        Convert a DAG into a Pipeline Entity
        :param serialized_dag: SerializedDAG from dagster metadata DB
        :return: Create Pipeline request with tasks
        """
        jobs = self.get_jobs(pipeline_name=pipeline_details.get("name"))
        task_list: List[Task] = []
        for job in jobs["solidHandles"]:
            down_stream_task = []
            for tasks in job.get("solid")["inputs"]:
                for task in tasks["dependsOn"]:
                    down_stream_task.append(task["solid"]["name"])

            task = Task(
                name=job["handleID"],
                displayName=job["handleID"],
                downstreamTasks=down_stream_task,
            )

            task_list.append(task)

        yield CreatePipelineRequest(
            name=pipeline_details["id"].replace(":", ""),
            displayName=pipeline_details["name"],
            description=pipeline_details.get("description", ""),
            tasks=task_list,
            service=EntityReference(
                id=self.context.pipeline_service.id.__root__, type="pipelineService"
            ),
            tags=self.get_tag_labels(self.context.repository_name),
        )

    def yield_tag(self, *_, **__) -> OMetaTagAndClassification:
        classification = OMetaTagAndClassification(
            classification_request=CreateClassificationRequest(
                name="DagsterTags",
                description="Tags associated with dagster",
            ),
            tag_request=CreateTagRequest(
                classification="DagsterTags",
                name=self.context.repository_name,
                description="Dagster Tag",
            ),
        )

        yield classification

    def get_task_runs(self, job_id, pipeline_name):
        """
        To get all the runs details
        """
        try:
            parameters = {
                "handleID": job_id,
                "selector": {
                    "pipelineName": pipeline_name,
                    "repositoryName": self.context.repository_name,
                    "repositoryLocationName": self.context.repository_location,
                },
            }
            runs = self.client._execute(  # pylint: disable=protected-access
                query=GRAPHQL_RUNS_QUERY, variables=parameters
            )

            return runs["pipelineOrError"]
        except Exception as err:
            logger.error(
                f"Error while getting runs for {job_id} - {pipeline_name} - {err}"
            )
            logger.debug(traceback.format_exc())

        return []

    def yield_pipeline_status(self, pipeline_details) -> OMetaPipelineStatus:
        tasks = self.context.pipeline.tasks
        for task in tasks:
            runs = self.get_task_runs(
                task.name, pipeline_name=pipeline_details.get("name")
            )
            for run in runs["solidHandle"]["stepStats"].get("nodes") or []:
                task_status = TaskStatus(
                    name=task.name,
                    executionStatus=STATUS_MAP.get(
                        run["status"].lower(), StatusType.Pending.value
                    ),
                    startTime=round(run["startTime"]),
                    endTime=round(run["endTime"]),
                )

                pipeline_status = PipelineStatus(
                    taskStatus=[task_status],
                    executionStatus=STATUS_MAP.get(
                        run["status"].lower(), StatusType.Pending.value
                    ),
                    timestamp=round(run["endTime"]),
                )
                pipeline_status_yield = OMetaPipelineStatus(
                    pipeline_fqn=self.context.pipeline.fullyQualifiedName.__root__,
                    pipeline_status=pipeline_status,
                )
                yield pipeline_status_yield

    def yield_pipeline_lineage_details(
        self, pipeline_details
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Not implemented, as this connector does not create any lineage
        """

    def get_pipelines_list(self) -> Dict:
        results = self.get_run_list()
        for result in results:
            self.context.repository_location = result.get("location")["name"]
            self.context.repository_name = result["name"]
            for job in result.get("pipelines") or []:
                yield job

    def get_pipeline_name(self, pipeline_details) -> str:
        """
        Get Pipeline Name
        """
        return pipeline_details["name"]

    def test_connection(self) -> None:
        pass
