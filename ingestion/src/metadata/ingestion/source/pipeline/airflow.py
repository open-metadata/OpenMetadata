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
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any, Iterable, List, Optional, cast

from airflow.models import BaseOperator, DagRun
from airflow.models.serialized_dag import SerializedDagModel
from airflow.models.taskinstance import TaskInstance
from airflow.serialization.serialized_objects import SerializedDAG
from sqlalchemy.engine import Engine
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
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
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


STATUS_MAP = {
    "success": StatusType.Successful.value,
    "failed": StatusType.Failed.value,
    "queued": StatusType.Pending.value,
}


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
        self.service: PipelineService = self.metadata.get_service_or_create(
            entity=PipelineService, config=config
        )
        self.numberOfStatus = (
            self.config.serviceConnection.__root__.config.numberOfStatus
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

    def get_pipeline_status(self, dag_id: str) -> DagRun:
        dag_run_list: DagRun = (
            self.session.query(DagRun)
            .filter(DagRun.dag_id == dag_id)
            .order_by(DagRun.execution_date.desc())
            .limit(self.numberOfStatus)
        )
        return dag_run_list

    def fetch_pipeline_status(
        self, serialized_dag: SerializedDAG, pipeline_fqn: str
    ) -> OMetaPipelineStatus:
        dag_run_list = self.get_pipeline_status(serialized_dag.dag_id)
        for dag in dag_run_list:
            if isinstance(dag.task_instances, Iterable):
                tasks = dag.task_instances
            else:
                tasks = [dag.task_instances]

            task_statuses = [
                TaskStatus(
                    name=task.task_id,
                    executionStatus=STATUS_MAP.get(
                        task.state, StatusType.Pending.value
                    ),
                )
                for task in tasks
            ]

            pipeline_status = PipelineStatus(
                taskStatus=task_statuses,
                executionStatus=STATUS_MAP.get(dag._state, StatusType.Pending.value),
                executionDate=dag.execution_date.timestamp(),
            )
            yield OMetaPipelineStatus(
                pipeline_fqn=pipeline_fqn, pipeline_status=pipeline_status
            )

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
            for task in cast(Iterable[BaseOperator], dag.tasks)
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

    @staticmethod
    def parse_xlets(xlet: List[Any]) -> Optional[List[str]]:
        """
        Parse airflow xlets for 2.1.4. E.g.,

        [{'__var': {'tables': ['sample_data.ecommerce_db.shopify.fact_order']},
        '__type': 'dict'}]

        :param xlet: airflow v2 xlet dict
        :return: table FQN list or None
        """
        if len(xlet) and isinstance(xlet[0], dict):
            tables = xlet[0].get("__var").get("tables")
            if tables and isinstance(tables, list):
                return tables

        return None

    def get_inlets(self, task: BaseOperator) -> Optional[List[str]]:
        """
        Get inlets from serialised operator
        :param task: SerializedBaseOperator
        :return: maybe an inlet list
        """
        inlets = task.get_inlet_defs()
        try:
            return self.parse_xlets(inlets)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warn(f"Error trying to parse inlets - {err}")
            return None

    def get_outlets(self, task: BaseOperator) -> Optional[List[str]]:
        """
        Get outlets from serialised operator
        :param task: SerializedBaseOperator
        :return: maybe an inlet list
        """
        outlets = task.get_outlet_defs()
        try:
            return self.parse_xlets(outlets)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warn(f"Error trying to parse outlets - {err}")
            return None

    def fetch_lineage(
        self, serialized_dag: SerializedDagModel, pipeline_entity: Pipeline
    ) -> Iterable[AddLineageRequest]:
        """
        Parse xlets and add lineage between Pipelines and Tables
        :param serialized_dag: SerializedDAG from airflow metadata DB
        :param pipeline_entity: Pipeline we just ingested
        :return: Lineage from inlets and outlets
        """
        dag: SerializedDAG = serialized_dag.dag

        for task in dag.tasks:
            for table_fqn in self.get_inlets(task) or []:
                table_entity: Table = self.metadata.get_by_name(
                    entity=Table, fqn=table_fqn
                )
                if table_entity:
                    yield AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=table_entity.id, type="table"
                            ),
                            toEntity=EntityReference(
                                id=pipeline_entity.id, type="pipeline"
                            ),
                        )
                    )
                else:
                    logger.warn(
                        f"Could not find Table [{table_fqn}] from "
                        f"[{pipeline_entity.fullyQualifiedName.__root__}] inlets"
                    )

            for table_fqn in self.get_outlets(task) or []:
                table_entity: Table = self.metadata.get_by_name(
                    entity=Table, fqn=table_fqn
                )
                if table_entity:
                    yield AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=pipeline_entity.id, type="pipeline"
                            ),
                            toEntity=EntityReference(id=table_entity.id, type="table"),
                        )
                    )
                else:
                    logger.warn(
                        f"Could not find Table [{table_fqn}] from "
                        f"[{pipeline_entity.fullyQualifiedName.__root__}] outlets"
                    )

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
                    pipeline_fqn = fqn.build(
                        self.metadata,
                        entity_type=Pipeline,
                        service_name=self.service.name.__root__,
                        pipeline_name=serialized_dag.dag_id,
                    )
                    yield from self.fetch_pipeline_status(serialized_dag, pipeline_fqn)
                    if self.source_config.includeLineage:
                        pipeline_entity: Pipeline = self.metadata.get_by_name(
                            entity=Pipeline,
                            fqn=pipeline_fqn,
                        )
                        yield from self.fetch_lineage(serialized_dag, pipeline_entity)
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
        self.session.close()

    def test_connection(self) -> None:
        test_connection(self.engine)
