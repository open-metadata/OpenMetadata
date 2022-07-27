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
import traceback
from typing import Any, Iterable, List, Optional, cast

from airflow.models import BaseOperator, DagRun
from airflow.models.serialized_dag import SerializedDagModel
from airflow.serialization.serialized_objects import SerializedDAG
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
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


class AirflowSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Airflow's metadata db
    """

    config: WorkflowSource

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        self._session = None
        self.service_connection = config.serviceConnection.__root__.config
        self.engine: Engine = get_connection(self.service_connection.connection)
        super().__init__(config, metadata_config)
        # Create the connection to the database

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

    def get_pipeline_status(self, dag_id: str) -> DagRun:
        dag_run_list: DagRun = (
            self.session.query(DagRun)
            .filter(DagRun.dag_id == dag_id)
            .order_by(DagRun.execution_date.desc())
            .limit(self.config.serviceConnection.__root__.config.numberOfStatus)
        )
        return dag_run_list

    def yield_pipeline_status(
        self, pipeline_details: SerializedDAG
    ) -> OMetaPipelineStatus:
        dag_run_list = self.get_pipeline_status(pipeline_details.dag_id)

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
                    startTime=datetime_to_ts(task.start_date),
                    endTime=datetime_to_ts(
                        task.end_date
                    ),  # Might be None for running tasks
                    logLink=task.log_url,
                )
                for task in tasks
            ]

            pipeline_status = PipelineStatus(
                taskStatus=task_statuses,
                executionStatus=STATUS_MAP.get(dag._state, StatusType.Pending.value),
                executionDate=dag.execution_date.timestamp(),
            )
            yield OMetaPipelineStatus(
                pipeline_fqn=self.context.pipeline.fullyQualifiedName.__root__,
                pipeline_status=pipeline_status,
            )

    def get_pipelines_list(self) -> Iterable[SerializedDagModel]:
        """
        List all DAGs from the metadata db.

        We are using the SerializedDagModel as it helps
        us retrieve all the task and inlets/outlets information
        """
        for serialized_dag in self.session.query(SerializedDagModel).all():
            yield serialized_dag

    def get_pipeline_name(self, pipeline_details: SerializedDAG) -> str:
        """
        Get Pipeline Name
        """
        return pipeline_details.dag_id

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

    def yield_pipeline(
        self, pipeline_details: SerializedDagModel
    ) -> Iterable[CreatePipelineRequest]:
        """
        Convert a DAG into a Pipeline Entity
        :param serialized_dag: SerializedDAG from airflow metadata DB
        :return: Create Pipeline request with tasks
        """
        dag: SerializedDAG = pipeline_details.dag
        yield CreatePipelineRequest(
            name=pipeline_details.dag_id,
            description=dag.description,
            pipelineUrl=f"/tree?dag_id={dag.dag_id}",  # Just the suffix
            concurrency=dag.concurrency,
            pipelineLocation=pipeline_details.fileloc,
            startDate=dag.start_date.isoformat() if dag.start_date else None,
            tasks=self.get_tasks_from_dag(dag),
            service=EntityReference(
                id=self.context.pipeline_service.id.__root__, type="pipelineService"
            ),
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

    def yield_pipeline_lineage_details(
        self, pipeline_details: SerializedDagModel
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Parse xlets and add lineage between Pipelines and Tables
        :param pipeline_details: SerializedDAG from airflow metadata DB
        :return: Lineage from inlets and outlets
        """
        dag: SerializedDAG = pipeline_details.dag

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
                                id=self.context.pipeline.id.__root__, type="pipeline"
                            ),
                        )
                    )
                else:
                    logger.warn(
                        f"Could not find Table [{table_fqn}] from "
                        f"[{self.context.pipeline.fullyQualifiedName.__root__}] inlets"
                    )

            for table_fqn in self.get_outlets(task) or []:
                table_entity: Table = self.metadata.get_by_name(
                    entity=Table, fqn=table_fqn
                )
                if table_entity:
                    yield AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=self.context.pipeline.id.__root__, type="pipeline"
                            ),
                            toEntity=EntityReference(id=table_entity.id, type="table"),
                        )
                    )
                else:
                    logger.warn(
                        f"Could not find Table [{table_fqn}] from "
                        f"[{self.context.pipeline.fullyQualifiedName.__root__}] outlets"
                    )

    def close(self):
        self.session.close()

    def test_connection(self) -> None:
        test_connection(self.engine)
