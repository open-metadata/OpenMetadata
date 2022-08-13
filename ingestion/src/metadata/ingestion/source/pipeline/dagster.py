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
import json
from collections.abc import Iterable
from typing import Dict, Iterable, Optional

from sqlalchemy import text
from sqlalchemy.engine.base import Engine
from sqlalchemy.orm import Session

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.dagsterConnection import (
    DagsterConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils.connections import (
    create_and_bind_session,
    get_connection,
    test_connection,
)
from metadata.utils.helpers import datetime_to_ts
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

STATUS_MAP = {
    "success": StatusType.Successful.value,
    "failed": StatusType.Failed.value,
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
        self._session = None
        self.service_connection = config.serviceConnection.__root__.config
        self.engine: Engine = get_connection(self.service_connection.dbConnection)
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

    @property
    def session(self) -> Session:
        """
        Return the SQLAlchemy session from the engine
        """
        if not self._session:
            self._session = create_and_bind_session(self.engine)

        return self._session

    def get_run_list(self):

        run_list = self.session.execute("select * from runs")
        return run_list

    def yield_pipeline(self, pipeline_details) -> Iterable[CreatePipelineRequest]:
        """
        Convert a DAG into a Pipeline Entity
        :param serialized_dag: SerializedDAG from dagster metadata DB
        :return: Create Pipeline request with tasks
        """

        task_list = [{"name": row["pipeline_name"]} for row in self.get_run_list()]
        run_body = json.loads(pipeline_details["run_body"])
        location_name = run_body["external_pipeline_origin"][
            "external_repository_origin"
        ]["repository_location_origin"]["location_name"]
        repository_name = run_body["external_pipeline_origin"][
            "external_repository_origin"
        ]["repository_name"]
        pipeline_url = f"/workspace/{repository_name}@{location_name}/jobs/{pipeline_details.pipeline_name}/"
        yield CreatePipelineRequest(
            name=pipeline_details.pipeline_name,
            description=pipeline_details.pipeline_name,
            pipelineUrl=pipeline_url,
            pipelineLocation=location_name,
            startDate=pipeline_details.create_timestamp,
            tasks=task_list,
            service=EntityReference(
                id=self.context.pipeline_service.id.__root__, type="pipelineService"
            ),
        )

    def yield_pipeline_status(self, pipeline_details) -> OMetaPipelineStatus:
        run_list = self.get_run_list()
        for run in run_list:
            log_link = f"{self.service_connection.hostPort}/instance/runs/{run.run_id}"
            task_status = TaskStatus(
                name=run["pipeline_name"],
                executionStatus=STATUS_MAP.get(
                    run["status"].lower(), StatusType.Pending.value
                ),
                startTime=datetime_to_ts(run[9]),
                endTime=datetime_to_ts(run[10]),
                logLink=log_link,
            )
            pipeline_status = PipelineStatus(
                taskStatus=[task_status],
                executionStatus=STATUS_MAP.get(
                    run["status"].lower(), StatusType.Pending.value
                ),
                timestamp=run[10].timestamp(),
            )
            yield OMetaPipelineStatus(
                pipeline_fqn=self.context.pipeline.fullyQualifiedName.__root__,
                pipeline_status=pipeline_status,
            )

    def yield_pipeline_lineage_details(
        self, pipeline_details
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Not implemented, as this connector does not create any lineage
        """

    def close(self):
        self.session.close()

    def test_connection(self) -> None:
        test_connection(self.engine)

    def get_pipelines_list(self) -> Dict:

        results = self.engine.execute(text("SELECT * from runs"))
        for result in results:
            yield result

    def get_pipeline_name(self, pipeline_details) -> str:
        """
        Get Pipeline Name
        """
        return pipeline_details["pipeline_name"]
