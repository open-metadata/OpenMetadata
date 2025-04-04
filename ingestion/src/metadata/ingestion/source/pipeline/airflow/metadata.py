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
Airflow source to extract metadata from OM UI
"""
import traceback
from collections import Counter
from datetime import datetime
from enum import Enum
from typing import Dict, Iterable, List, Optional, cast

from airflow.models import BaseOperator, DagRun, DagTag, TaskInstance
from airflow.models.dag import DagModel
from airflow.models.serialized_dag import SerializedDagModel
from airflow.serialization.serialized_objects import SerializedDAG
from pydantic import BaseModel, ValidationError
from sqlalchemy import join
from sqlalchemy.orm import Session

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineState,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.services.connections.pipeline.airflowConnection import (
    AirflowConnection,
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
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.airflow.lineage_parser import (
    XLets,
    get_xlets_from_dag,
)
from metadata.ingestion.source.pipeline.airflow.models import (
    AirflowDag,
    AirflowDagDetails,
    AirflowTask,
)
from metadata.ingestion.source.pipeline.airflow.utils import get_schedule_interval
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.constants import ENTITY_REFERENCE_TYPE_MAP
from metadata.utils.helpers import clean_uri, datetime_to_ts
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels

logger = ingestion_logger()

AIRFLOW_TAG_CATEGORY = "AirflowTags"


class AirflowTaskStatus(Enum):
    SUCCESS = "success"
    FAILED = "failed"
    QUEUED = "queued"
    REMOVED = "removed"
    SKIPPED = "skipped"


STATUS_MAP = {
    AirflowTaskStatus.SUCCESS.value: StatusType.Successful.value,
    AirflowTaskStatus.FAILED.value: StatusType.Failed.value,
    AirflowTaskStatus.QUEUED.value: StatusType.Pending.value,
    AirflowTaskStatus.SKIPPED.value: StatusType.Skipped.value,
}


class OMTaskInstance(BaseModel):
    """
    Custom model we get from the Airflow db
    as a scoped SELECT from TaskInstance
    """

    task_id: str
    state: Optional[str]
    start_date: Optional[datetime]
    end_date: Optional[datetime]


class AirflowSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Airflow's metadata db
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.today = datetime.now().strftime("%Y-%m-%d")
        self._session = None

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ) -> "AirflowSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: AirflowConnection = config.serviceConnection.root.config
        if not isinstance(connection, AirflowConnection):
            raise InvalidSourceException(
                f"Expected AirflowConnection, but got {connection}"
            )
        return cls(config, metadata)

    @property
    def session(self) -> Session:
        """
        Return the SQLAlchemy session from the engine
        """
        if not self._session:
            self._session = create_and_bind_session(self.connection)

        return self._session

    @staticmethod
    def _extract_serialized_task(task: Dict) -> Dict:
        """
        Given the serialization changes introduced in Airflow 2.10,
        ensure compatibility with all versions.
        """
        if task.keys() == {"__var", "__type"}:
            return task["__var"]
        return task

    def get_all_tags(self, dag_id: str) -> List[str]:
        try:
            tag_query = (
                self.session.query(DagTag.name)
                .filter(DagTag.dag_id == dag_id)
                .distinct()
                .all()
            )
            return [tag[0] for tag in tag_query]
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not extract tags details due to {exc}")
        return []

    def yield_tag(
        self, pipeline_details: AirflowDagDetails
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        yield from get_ometa_tag_and_classification(
            tags=self.get_all_tags(dag_id=pipeline_details.dag_id),
            classification_name=AIRFLOW_TAG_CATEGORY,
            tag_description="Airflow Tag",
            classification_description="Tags associated with airflow entities.",
            include_tags=self.source_config.includeTags,
        )

    def get_pipeline_status(self, dag_id: str) -> List[DagRun]:
        """
        Return the DagRuns of given dag
        """
        dag_run_list = (
            self.session.query(
                DagRun.dag_id,
                DagRun.run_id,
                DagRun.queued_at,
                DagRun.execution_date,
                DagRun.start_date,
                DagRun.state,
            )
            .filter(DagRun.dag_id == dag_id)
            .order_by(DagRun.execution_date.desc())
            .limit(self.config.serviceConnection.root.config.numberOfStatus)
            .all()
        )

        dag_run_dict = [dict(elem) for elem in dag_run_list]

        # Build DagRun manually to not fall into new/old columns from
        # different Airflow versions
        return [
            DagRun(
                dag_id=elem.get("dag_id"),
                run_id=elem.get("run_id"),
                queued_at=elem.get("queued_at"),
                execution_date=elem.get("execution_date"),
                start_date=elem.get("start_date"),
                state=elem.get("state"),
            )
            for elem in dag_run_dict
        ]

    def get_task_instances(
        self, dag_id: str, run_id: str, serialized_tasks: List[AirflowTask]
    ) -> List[OMTaskInstance]:
        """
        We are building our own scoped TaskInstance
        class to only focus on core properties required
        by the metadata ingestion.

        This makes the versioning more flexible on which Airflow
        sources we support.
        """
        task_instance_list = None
        serialized_tasks_ids = {task.task_id for task in serialized_tasks}

        try:
            task_instance_list = (
                self.session.query(
                    TaskInstance.task_id,
                    TaskInstance.state,
                    TaskInstance.start_date,
                    TaskInstance.end_date,
                    TaskInstance.run_id,
                )
                .filter(
                    TaskInstance.dag_id == dag_id,
                    TaskInstance.run_id == run_id,
                    # updating old runs flag deleted tasks as `removed`
                    TaskInstance.state != AirflowTaskStatus.REMOVED.value,
                )
                .all()
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Tried to get TaskInstances with run_id. It might not be available in older Airflow versions - {exc}."
            )

        task_instance_dict = (
            [dict(elem) for elem in task_instance_list] if task_instance_list else []
        )

        return [
            OMTaskInstance(
                task_id=elem.get("task_id"),
                state=elem.get("state"),
                start_date=elem.get("start_date"),
                end_date=elem.get("end_date"),
            )
            for elem in task_instance_dict
            if elem.get("task_id") in serialized_tasks_ids
        ]

    def yield_pipeline_status(
        self, pipeline_details: AirflowDagDetails
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        try:
            dag_run_list = self.get_pipeline_status(pipeline_details.dag_id)

            for dag_run in dag_run_list:
                if (
                    dag_run.run_id and self.context.get().task_names
                ):  # Airflow dags can have old task which are turned off/commented out in code
                    tasks = self.get_task_instances(
                        dag_id=dag_run.dag_id,
                        run_id=dag_run.run_id,
                        serialized_tasks=pipeline_details.tasks,
                    )

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
                        )  # Log link might not be present in all Airflow versions
                        for task in tasks
                        if task.task_id in self.context.get().task_names
                    ]

                    timestamp = datetime_to_ts(dag_run.execution_date)
                    pipeline_status = PipelineStatus(
                        taskStatus=task_statuses,
                        executionStatus=STATUS_MAP.get(
                            dag_run.state, StatusType.Pending.value
                        ),
                        timestamp=Timestamp(timestamp) if timestamp else None,
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
                    name=f"{pipeline_details.dag_id} Pipeline Status",
                    error=f"Wild error trying to extract status from DAG {pipeline_details.dag_id} - {exc}.",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_pipelines_list(self) -> Iterable[AirflowDagDetails]:
        """
        List all DAGs from the metadata db.

        We are using the SerializedDagModel as it helps
        us retrieve all the task and inlets/outlets information
        """

        json_data_column = (
            SerializedDagModel._data  # For 2.3.0 onwards # pylint: disable=protected-access
            if hasattr(SerializedDagModel, "_data")
            else SerializedDagModel.data  # For 2.2.5 and 2.1.4
        )

        session_query = self.session.query(
            SerializedDagModel.dag_id,
            json_data_column,
            SerializedDagModel.fileloc,
        )
        if not self.source_config.includeUnDeployedPipelines:
            session_query = session_query.select_from(
                join(
                    SerializedDagModel,
                    DagModel,
                    SerializedDagModel.dag_id == DagModel.dag_id,
                )
            ).filter(
                DagModel.is_paused == False  # pylint: disable=singleton-comparison
            )
        limit = 100  # Number of records per batch
        offset = 0  # Start

        while True:
            paginated_query = session_query.limit(limit).offset(offset)
            results = paginated_query.all()
            if not results:
                break
            for serialized_dag in results:
                try:
                    dag_model = (
                        self.session.query(DagModel)
                        .filter(DagModel.dag_id == serialized_dag[0])
                        .one_or_none()
                    )
                    pipeline_state = (
                        PipelineState.Active.value
                        if dag_model and not dag_model.is_paused
                        else PipelineState.Inactive.value
                    )
                    data = serialized_dag[1]["dag"]
                    dag = AirflowDagDetails(
                        dag_id=serialized_dag[0],
                        fileloc=serialized_dag[2],
                        data=AirflowDag.model_validate(serialized_dag[1]),
                        max_active_runs=data.get("max_active_runs", None),
                        description=data.get("_description", None),
                        start_date=data.get("start_date", None),
                        state=pipeline_state,
                        tasks=list(
                            map(self._extract_serialized_task, data.get("tasks", []))
                        ),
                        schedule_interval=get_schedule_interval(data),
                        owner=self.fetch_dag_owners(data),
                    )

                    yield dag
                except ValidationError as err:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Error building pydantic model for {serialized_dag} - {err}"
                    )
                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.warning(f"Wild error yielding dag {serialized_dag} - {err}")

            offset += limit

    def fetch_dag_owners(self, data) -> Optional[str]:
        """
        In Airflow, ownership is defined as:
        - `default_args`: Applied to all tasks and available on the DAG payload
        - `owners`: Applied at the tasks. In Airflow's source code, DAG ownership is then a
          list joined with the owners of all the tasks.

        We will pick the owner from the tasks that appears in most tasks.
        """
        try:
            if self.source_config.includeOwners:
                task_owners = [
                    task.get("owner")
                    for task in data.get("tasks", [])
                    if task.get("owner") is not None
                ]
                if task_owners:
                    most_common_owner, _ = Counter(task_owners).most_common(1)[0]
                    return most_common_owner
        except Exception as exc:
            self.status.warning(
                data.get("dag_id"), f"Could not extract owner information due to {exc}"
            )
        return None

    def get_pipeline_name(self, pipeline_details: SerializedDAG) -> str:
        """
        Get Pipeline Name
        """
        return pipeline_details.dag_id

    def get_pipeline_state(
        self, pipeline_details: AirflowDagDetails
    ) -> Optional[PipelineState]:
        """
        Return the state of the DAG
        """
        return PipelineState[pipeline_details.state]

    def get_tasks_from_dag(self, dag: AirflowDagDetails, host_port: str) -> List[Task]:
        """
        Obtain the tasks from a SerializedDAG
        :param dag: AirflowDagDetails
        :param host_port: service host
        :return: List of tasks
        """
        return [
            Task(
                name=task.task_id,
                description=task.doc_md,
                sourceUrl=SourceUrl(
                    f"{clean_uri(host_port)}/taskinstance/list/"
                    f"?flt1_dag_id_equals={dag.dag_id}&_flt_3_task_id={task.task_id}"
                ),
                downstreamTasks=list(task.downstream_task_ids)
                if task.downstream_task_ids
                else [],
                startDate=task.start_date.isoformat() if task.start_date else None,
                endDate=task.end_date.isoformat() if task.end_date else None,
                taskType=task.task_type,
                owners=self.get_owner(task.owner),
            )
            for task in cast(Iterable[BaseOperator], dag.tasks)
        ]

    def get_owner(self, owner) -> Optional[EntityReferenceList]:
        """
        Fetching users by name via ES to keep things as fast as possible.

        We use the `owner` field since it's the onw used by Airflow to showcase
        the info in its UI. In other connectors we might use the mail (e.g., in Looker),
        but we use name here to be consistent with Airflow itself.

        If data is not indexed, we can live without this information
        until the next run.
        """
        try:
            return self.metadata.get_reference_by_name(name=owner, is_owner=True)
        except Exception as exc:
            logger.warning(f"Error while getting details of user {owner} - {exc}")
        return None

    def yield_pipeline(
        self, pipeline_details: AirflowDagDetails
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """
        Convert a DAG into a Pipeline Entity
        :param pipeline_details: SerializedDAG from airflow metadata DB
        :return: Create Pipeline request with tasks
        """

        try:
            # Airflow uses /dags/dag_id/grid to show pipeline / dag
            source_url = f"{clean_uri(self.service_connection.hostPort)}/dags/{pipeline_details.dag_id}/grid"
            pipeline_state = self.get_pipeline_state(pipeline_details)

            pipeline_request = CreatePipelineRequest(
                name=EntityName(pipeline_details.dag_id),
                description=Markdown(pipeline_details.description)
                if pipeline_details.description
                else None,
                sourceUrl=SourceUrl(source_url),
                state=pipeline_state,
                concurrency=pipeline_details.max_active_runs,
                pipelineLocation=pipeline_details.fileloc,
                startDate=pipeline_details.start_date.isoformat()
                if pipeline_details.start_date
                else None,
                tasks=self.get_tasks_from_dag(
                    pipeline_details, self.service_connection.hostPort
                ),
                service=FullyQualifiedEntityName(self.context.get().pipeline_service),
                owners=self.get_owner(pipeline_details.owner),
                scheduleInterval=pipeline_details.schedule_interval,
                tags=get_tag_labels(
                    metadata=self.metadata,
                    tags=pipeline_details.data.dag.tags,
                    classification_name=AIRFLOW_TAG_CATEGORY,
                    include_tags=self.source_config.includeTags,
                ),
            )
            yield Either(right=pipeline_request)
            self.register_record(pipeline_request=pipeline_request)
            self.context.get().task_names = {
                task.name for task in pipeline_request.tasks or []
            }
        except TypeError as err:
            self.context.get().task_names = set()
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.dag_id,
                    error=(
                        f"Error building DAG information from {pipeline_details}. There might be Airflow version"
                        f" incompatibilities - {err}"
                    ),
                    stackTrace=traceback.format_exc(),
                )
            )
        except ValidationError as err:
            self.context.get().task_names = set()
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.dag_id,
                    error=f"Error building pydantic model for {pipeline_details} - {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

        except Exception as err:
            self.context.get().task_names = set()
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.dag_id,
                    error=f"Wild error ingesting pipeline {pipeline_details} - {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_pipeline_lineage_details(
        self, pipeline_details: AirflowDagDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Parse xlets and add lineage between Pipelines and Tables
        :param pipeline_details: SerializedDAG from airflow metadata DB
        :return: Lineage from inlets and outlets
        """

        # If the context is not set because of an error upstream,
        # we don't want to continue the processing
        pipeline_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Pipeline,
            service_name=self.context.get().pipeline_service,
            pipeline_name=self.context.get().pipeline,
        )
        pipeline_entity = self.metadata.get_by_name(entity=Pipeline, fqn=pipeline_fqn)
        if not pipeline_entity:
            return

        lineage_details = LineageDetails(
            pipeline=EntityReference(
                id=pipeline_entity.id.root,
                type=ENTITY_REFERENCE_TYPE_MAP[Pipeline.__name__],
            ),
            source=LineageSource.PipelineLineage,
        )

        xlets: List[XLets] = (
            get_xlets_from_dag(dag=pipeline_details) if pipeline_details else []
        )
        for xlet in xlets:
            for from_xlet in xlet.inlets or []:
                from_entity = self.metadata.get_by_name(
                    entity=from_xlet.entity, fqn=from_xlet.fqn
                )
                if from_entity:
                    for to_xlet in xlet.outlets or []:
                        to_entity = self.metadata.get_by_name(
                            entity=to_xlet.entity, fqn=to_xlet.fqn
                        )
                        if to_entity:
                            lineage = AddLineageRequest(
                                edge=EntitiesEdge(
                                    fromEntity=EntityReference(
                                        id=from_entity.id,
                                        type=ENTITY_REFERENCE_TYPE_MAP[
                                            from_xlet.entity.__name__
                                        ],
                                    ),
                                    toEntity=EntityReference(
                                        id=to_entity.id,
                                        type=ENTITY_REFERENCE_TYPE_MAP[
                                            to_xlet.entity.__name__
                                        ],
                                    ),
                                    lineageDetails=lineage_details,
                                )
                            )
                            yield Either(right=lineage)
                        else:
                            logger.warning(
                                f"Could not find [{to_xlet.entity.__name__}] [{to_xlet.fqn}] from "
                                f"[{pipeline_entity.fullyQualifiedName.root}] outlets"
                            )
                else:
                    logger.warning(
                        f"Could not find [{from_xlet.entity.__name__}] [{from_xlet.fqn}] from "
                        f"[{pipeline_entity.fullyQualifiedName.root}] inlets"
                    )

    def close(self):
        self.metadata.compute_percentile(Pipeline, self.today)
        self.session.close()
