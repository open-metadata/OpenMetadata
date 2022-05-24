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
Airflow source to extract metadata from OM UI
"""
import sys
import traceback
from dataclasses import dataclass, field
from typing import Iterable, List, cast

from airflow.models.serialized_dag import SerializedDagModel
from airflow.serialization.serialized_objects import (
    SerializedBaseOperator,
    SerializedDAG,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import Task
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.airflowConnection import (
    AirflowConnection,
)
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.metadataIngestion.pipelineServiceMetadataPipeline import (
    PipelineServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.connections import (
    create_and_bind_session,
    get_connection,
    test_connection,
)
from metadata.utils.filters import filter_by_pipeline
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


@dataclass
class AirflowSourceStatus(SourceStatus):
    pipelines_scanned: List[str] = field(default_factory=list)
    filtered: List[str] = field(default_factory=list)

    def pipeline_scanned(self, topic: str) -> None:
        self.pipelines_scanned.append(topic)

    def dropped(self, topic: str) -> None:
        self.filtered.append(topic)


class AirflowSource(Source[CreatePipelineRequest]):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Airflow's metadata db
    """

    config: WorkflowSource
    report: AirflowSourceStatus

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__()
        self.config = config
        self.source_config: PipelineServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.service_connection = self.config.serviceConnection.__root__.config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(self.metadata_config)
        self.status = AirflowSourceStatus()
        self.service = self.metadata.get_service_or_create(
            entity=PipelineService, config=config
        )

        # Create the connection to the database
        self._session = None
        self.engine: Engine = get_connection(self.service_connection.connection)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: AirflowConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, AirflowConnection):
            raise InvalidSourceException(
                f"Expected AirflowConnection, but got {connection}"
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

    def prepare(self):
        pass

    def list_dags(self) -> Iterable[SerializedDagModel]:
        """
        List all DAGs from the metadata db.

        We are using the SerializedDagModel as it helps
        us retrieve all the task and inlets/outlets information
        """
        for serialized_dag in self.session.query(SerializedDagModel).all():
            yield serialized_dag

    @staticmethod
    def get_tasks_from_dag(dag: SerializedDAG) -> List[Task]:
        """
        Obtain the tasks from a SerializedDAG
        :param dag: SerializedDAG
        :return: List of tasks
        """
        return [
            Task(
                name=task.task_id,
                description=task.doc_md,
                # Just the suffix
                taskUrl=f"/taskinstance/list/?flt1_dag_id_equals={dag.dag_id}&_flt_3_task_id={task.task_id}",
                downstreamTasks=list(task.downstream_task_ids),
                taskType=task.task_type,
                startDate=task.start_date.isoformat() if task.start_date else None,
                endDate=task.end_date.isoformat() if task.end_date else None,
            )
            for task in cast(Iterable[SerializedBaseOperator], dag.task)
        ]

    def fetch_pipeline(
        self, serialized_dag: SerializedDagModel
    ) -> Iterable[CreatePipelineRequest]:
        """
        Convert a DAG into a Pipeline Entity
        :param serialized_dag: SerializedDAG from airflow metadata DB
        :return: Create Pipeline request with tasks
        """
        dag: SerializedDAG = serialized_dag.dag

        yield CreatePipelineRequest(
            name=serialized_dag.dag_id,
            description=dag.description,
            pipelineUrl=f"/tree?dag_id={dag.dag_id}",  # Just the suffix
            concurrency=dag.concurrency,
            pipelineLocation=serialized_dag.fileloc,
            startDate=dag.start_date.isoformat() if dag.start_date else None,
            tasks=self.get_tasks_from_dag(dag),
            service=EntityReference(id=self.service.id, type="pipelineService"),
        )

    def fetch_lineage(
        self, serialized_dag: SerializedDagModel
    ) -> Iterable[AddLineageRequest]:
        """

        :param serialized_dag: SerializedDAG from airflow metadata DB
        :return: Lineage from inlets and outlets
        """
        pass

    def next_record(self) -> Iterable[Entity]:
        """
        Extract metadata information to create Pipelines with Tasks
        and lineage
        """
        for serialized_dag in self.list_dags():
            try:
                if not filter_by_pipeline(
                    self.source_config.pipelineFilterPattern, serialized_dag.dag_id
                ):
                    yield from self.fetch_pipeline(serialized_dag)

                    if self.source_config.includeLineage:
                        yield from self.fetch_lineage(serialized_dag)
                else:
                    self.status.dropped(serialized_dag.dag_id)

            except Exception as err:
                logger.error(repr(err))
                logger.debug(traceback.format_exc())
                logger.debug(sys.exc_info()[2])
                self.status.failure(serialized_dag.dag_id, repr(err))

    def get_status(self):
        return self.status

    def close(self):
        self.engine.close()
        self.session.close()

    def test_connection(self) -> None:
        test_connection(self.engine)
