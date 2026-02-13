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
from collections import Counter, defaultdict
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Iterable, List, Optional, Tuple, cast

from airflow.models import BaseOperator, DagRun, DagTag, TaskInstance
from airflow.models.dag import DagModel
from airflow.models.serialized_dag import SerializedDagModel
from airflow.serialization.serialized_objects import SerializedDAG
from pydantic import BaseModel, ValidationError
from sqlalchemy import and_, column, func, inspect, join
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
from metadata.generated.schema.entity.data.table import Table
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
from metadata.generated.schema.type.pipelineObservability import PipelineObservability
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


# pylint: disable=too-many-locals,too-many-nested-blocks,too-many-boolean-expressions
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
        self.observability_cache: Dict[Tuple[str, str], Dict[str, Any]] = {}

        self._execution_date_column = None

    @property
    def execution_date_column(self):
        """
        Dynamically check which column to use for execution date.
        """
        if self._execution_date_column:
            return self._execution_date_column

        try:
            inspector = inspect(self.session.bind)
            columns = [col["name"] for col in inspector.get_columns("dag_run")]
            if "logical_date" in columns:
                self._execution_date_column = "logical_date"
            else:
                self._execution_date_column = "execution_date"
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to inspect dag_run table columns - {exc}. Fallback to execution_date"
            )
            self._execution_date_column = "execution_date"

        return self._execution_date_column

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
        try:
            # The Airflow SDK is always v3.x (which has logical_date on the ORM model),
            # but we may connect to Airflow 2.x databases (which have execution_date column).
            # Use column() to reference the actual database column name regardless of ORM.
            db_date_column = column(self.execution_date_column)

            dag_run_list = (
                self.session.query(
                    DagRun.dag_id,
                    DagRun.run_id,
                    DagRun.queued_at,
                    db_date_column.label("date_value"),
                    DagRun.start_date,
                    DagRun.state,
                )
                .filter(DagRun.dag_id == dag_id)
                .order_by(db_date_column.desc())
                .limit(self.config.serviceConnection.root.config.numberOfStatus)
                .all()
            )

            dag_run_dict = [dict(elem) for elem in dag_run_list]

            # Build DagRun manually to not fall into new/old columns from
            # different Airflow versions
            dag_runs = []
            for elem in dag_run_dict:
                date_value = elem.get("date_value")

                # Build kwargs - always use logical_date since SDK is Airflow 3.x
                kwargs = {
                    "dag_id": elem.get("dag_id"),
                    "run_id": elem.get("run_id"),
                    "queued_at": elem.get("queued_at"),
                    "start_date": elem.get("start_date"),
                    "state": elem.get("state"),
                    "logical_date": date_value,
                }

                dag_runs.append(DagRun(**kwargs))

            return dag_runs
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Could not get pipeline status for {dag_id}. "
                f"This might be due to Airflow version incompatibility - {exc}"
            )
            return []

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

                    # DagRun objects are built with logical_date (SDK is Airflow 3.x)
                    execution_date = dag_run.logical_date
                    timestamp = datetime_to_ts(execution_date)
                    pipeline_status = PipelineStatus(
                        executionId=dag_run.run_id,
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

        # Get the timestamp column for ordering (use last_updated if available, otherwise created_at)
        timestamp_column = (
            SerializedDagModel.last_updated
            if hasattr(SerializedDagModel, "last_updated")
            else SerializedDagModel.created_at
        )

        # Create subquery to get the latest timestamp for each DAG
        # This handles cases where multiple versions exist in serialized_dag table
        latest_dag_subquery = (
            self.session.query(
                SerializedDagModel.dag_id,
                func.max(timestamp_column).label("max_timestamp"),
            )
            .group_by(SerializedDagModel.dag_id)
            .subquery()
        )

        # In Airflow 3.x, fileloc is not available on SerializedDagModel
        # We need to get it from DagModel instead
        if hasattr(SerializedDagModel, "fileloc"):
            # Airflow 2.x: fileloc is on SerializedDagModel
            # Use tuple IN clause to get only the latest version of each DAG
            session_query = self.session.query(
                SerializedDagModel.dag_id,
                json_data_column,
                SerializedDagModel.fileloc,
            ).join(
                latest_dag_subquery,
                and_(
                    SerializedDagModel.dag_id == latest_dag_subquery.c.dag_id,
                    timestamp_column == latest_dag_subquery.c.max_timestamp,
                ),
            )
        else:
            # Airflow 3.x: fileloc is only on DagModel, we need to join
            session_query = (
                self.session.query(
                    SerializedDagModel.dag_id,
                    json_data_column,
                    DagModel.fileloc,
                )
                .join(
                    latest_dag_subquery,
                    and_(
                        SerializedDagModel.dag_id == latest_dag_subquery.c.dag_id,
                        timestamp_column == latest_dag_subquery.c.max_timestamp,
                    ),
                )
                .join(
                    DagModel,
                    SerializedDagModel.dag_id == DagModel.dag_id,
                )
            )

        if not self.source_config.includeUnDeployedPipelines:
            # If we haven't already joined with DagModel (Airflow 2.x case)
            if hasattr(SerializedDagModel, "fileloc"):
                session_query = session_query.select_from(
                    join(
                        SerializedDagModel,
                        DagModel,
                        SerializedDagModel.dag_id == DagModel.dag_id,
                    )
                )
            # Add the is_paused filter
            session_query = session_query.filter(
                DagModel.is_paused == False  # pylint: disable=singleton-comparison
            )
        limit = 100  # Number of records per batch
        offset = 0  # Start

        while True:
            paginated_query = (
                session_query.order_by(SerializedDagModel.dag_id.asc())
                .limit(limit)
                .offset(offset)
            )
            results = paginated_query.all()
            if not results:
                break
            for serialized_dag in results:
                try:
                    # Query only the is_paused column from DagModel
                    try:
                        is_paused_result = (
                            self.session.query(DagModel.is_paused)
                            .filter(DagModel.dag_id == serialized_dag[0])
                            .scalar()
                        )
                        pipeline_state = (
                            PipelineState.Active.value
                            if not is_paused_result
                            else PipelineState.Inactive.value
                        )
                    except Exception as exc:
                        logger.debug(traceback.format_exc())
                        logger.warning(
                            f"Could not query DagModel.is_paused for {serialized_dag[0]}. "
                            f"Using default pipeline state - {exc}"
                        )
                        # If we can't query is_paused, assume the pipeline is active
                        pipeline_state = PipelineState.Active.value

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

        We will pick the owner from the tasks that appears in most tasks,
        or fall back to the default_args owner if available.
        """
        try:
            if not self.source_config.includeOwners:
                return None

            tasks = data.get("tasks", [])
            task_owners = []

            # Handle default_args.owner (wrapped or not)
            default_args = data.get("default_args", {})
            if isinstance(default_args, dict) and "__var" in default_args:
                default_args = default_args["__var"]
            default_owner = default_args.get("owner")

            for task in tasks:
                # Flatten serialized task
                task_data = (
                    task.get("__var")
                    if isinstance(task, dict) and "__var" in task
                    else task
                )

                owner = task_data.get("owner") or default_owner

                if owner:
                    task_owners.append(owner)

            if task_owners:
                most_common_owner, _ = Counter(task_owners).most_common(1)[0]
                return most_common_owner

            return default_owner

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

        # Initialize context for observability tracking
        self.context.get().current_pipeline_entity = pipeline_entity
        self.context.get().current_table_fqns = []

        # Get dag runs for caching observability data
        dag_runs = self.get_pipeline_status(pipeline_details.dag_id)

        # Cache dag runs in context
        self.context.get().current_dag_runs = dag_runs
        self.context.get().latest_dag_run = dag_runs[0] if dag_runs else None

        xlets: List[XLets] = (
            get_xlets_from_dag(dag=pipeline_details) if pipeline_details else []
        )

        table_fqns = []
        for xlet in xlets:
            for from_xlet in xlet.inlets or []:
                from_entity = self.metadata.get_by_name(
                    entity=from_xlet.entity, fqn=from_xlet.fqn
                )
                if from_entity:
                    # Track table FQNs for observability
                    if from_xlet.entity == Table and from_xlet.fqn not in table_fqns:
                        table_fqns.append(from_xlet.fqn)

                    for to_xlet in xlet.outlets or []:
                        to_entity = self.metadata.get_by_name(
                            entity=to_xlet.entity, fqn=to_xlet.fqn
                        )
                        if to_entity:
                            # Track table FQNs for observability
                            if (
                                to_xlet.entity == Table
                                and to_xlet.fqn not in table_fqns
                            ):
                                table_fqns.append(to_xlet.fqn)

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
                                f"Lineage skipped: Outlet entity not found in OpenMetadata. "
                                f"Entity type: [{to_xlet.entity.__name__}], "
                                f"FQN: [{to_xlet.fqn}], "
                                f"Pipeline: [{pipeline_entity.fullyQualifiedName.root}]. "
                                f"Ensure the entity exists in OpenMetadata before running lineage ingestion."
                            )
                else:
                    logger.warning(
                        f"Lineage skipped: Inlet entity not found in OpenMetadata. "
                        f"Entity type: [{from_xlet.entity.__name__}], "
                        f"FQN: [{from_xlet.fqn}], "
                        f"Pipeline: [{pipeline_entity.fullyQualifiedName.root}]. "
                        f"Ensure the entity exists in OpenMetadata before running lineage ingestion."
                    )

        # Cache observability data for later use
        self.context.get().current_table_fqns = table_fqns

        # Cache for historical dag runs
        for dag_run in dag_runs:
            if dag_run.run_id:
                cache_key = (pipeline_details.dag_id, dag_run.run_id)
                self.observability_cache[cache_key] = {
                    "pipeline_entity": pipeline_entity,
                    "pipeline_details": pipeline_details,
                    "table_fqns": table_fqns,
                    "dag_run": dag_run,
                }

    def _build_observability_from_dag_run(
        self,
        dag_run: DagRun,
        pipeline_entity: Pipeline,
        schedule_interval: Optional[str] = None,
    ) -> PipelineObservability:
        """Build PipelineObservability object from DagRun data."""
        # DagRun objects are built with logical_date (SDK is Airflow 3.x)
        execution_date = dag_run.logical_date

        return PipelineObservability(
            pipeline=EntityReference(
                id=pipeline_entity.id.root
                if hasattr(pipeline_entity.id, "root")
                else pipeline_entity.id,
                type="pipeline",
                fullyQualifiedName=pipeline_entity.fullyQualifiedName.root
                if hasattr(pipeline_entity.fullyQualifiedName, "root")
                else str(pipeline_entity.fullyQualifiedName),
            ),
            scheduleInterval=schedule_interval,
            startTime=Timestamp(datetime_to_ts(dag_run.start_date))
            if dag_run.start_date
            else None,
            endTime=Timestamp(datetime_to_ts(execution_date))
            if execution_date
            else None,
            lastRunTime=Timestamp(datetime_to_ts(execution_date))
            if execution_date
            else None,
            lastRunStatus=STATUS_MAP.get(dag_run.state, StatusType.Pending.value),
        )

    def get_table_pipeline_observability(
        self, pipeline_details: AirflowDagDetails
    ) -> Iterable[Dict[str, List[PipelineObservability]]]:
        """
        Extract pipeline observability data from cached lineage artifacts.
        Uses context data first (current dag), falls back to cache for historical data.
        """
        try:
            table_pipeline_map: Dict[str, List[PipelineObservability]] = defaultdict(
                list
            )

            ctx = self.context.get()

            # Process current context data (current dag being processed)
            if (
                hasattr(ctx, "current_table_fqns")
                and hasattr(ctx, "current_dag_runs")
                and hasattr(ctx, "current_pipeline_entity")
                and ctx.current_dag_runs
                and ctx.current_pipeline_entity
                and ctx.current_table_fqns
            ):
                logger.debug(
                    f"Processing observability for current dag {pipeline_details.dag_id} with "
                    f"{len(ctx.current_table_fqns)} tables and {len(ctx.current_dag_runs)} runs"
                )

                # Process ALL dag runs (not just latest)
                for dag_run in ctx.current_dag_runs:
                    try:
                        observability = self._build_observability_from_dag_run(
                            dag_run=dag_run,
                            pipeline_entity=ctx.current_pipeline_entity,
                            schedule_interval=pipeline_details.schedule_interval,
                        )

                        # Add observability to all tables involved in this pipeline
                        for table_fqn in ctx.current_table_fqns:
                            table_pipeline_map[table_fqn].append(observability)

                    except Exception as exc:
                        logger.warning(
                            f"Failed to build observability for dag run {dag_run.run_id}: {exc}"
                        )
                        logger.debug(traceback.format_exc())
                        continue

            # Process cached observability data (historical dags)
            processed_cache_entries = 0
            failed_cache_entries = 0

            for cache_key, cached_data in self.observability_cache.items():
                try:
                    dag_id, _ = cache_key

                    # Skip current dag to avoid duplicates
                    if dag_id == pipeline_details.dag_id:
                        continue

                    # Validate cache structure
                    if not isinstance(cached_data, dict):
                        logger.warning(
                            f"Invalid cache structure for {cache_key}, skipping"
                        )
                        failed_cache_entries += 1
                        continue

                    pipeline_entity = cached_data.get("pipeline_entity")
                    table_fqns = cached_data.get("table_fqns", [])
                    dag_run = cached_data.get("dag_run")
                    cached_pipeline_details = cached_data.get("pipeline_details")

                    # Validate cache entry has required data
                    if not pipeline_entity or not table_fqns or not dag_run:
                        logger.debug(
                            f"Incomplete cache entry for {cache_key}, skipping"
                        )
                        continue

                    # Build observability for this cached run
                    schedule_interval = (
                        cached_pipeline_details.schedule_interval
                        if cached_pipeline_details
                        else None
                    )

                    observability = self._build_observability_from_dag_run(
                        dag_run=dag_run,
                        pipeline_entity=pipeline_entity,
                        schedule_interval=schedule_interval,
                    )

                    # Add to all tables produced by this pipeline
                    for table_fqn in table_fqns:
                        table_pipeline_map[table_fqn].append(observability)

                    processed_cache_entries += 1

                except Exception as exc:
                    logger.warning(f"Error processing cache entry {cache_key}: {exc}")
                    logger.debug(traceback.format_exc())
                    failed_cache_entries += 1
                    continue

            # Summary logging
            logger.info(
                f"Pipeline observability extraction complete for {pipeline_details.dag_id}: "
                f"{len(table_pipeline_map)} tables, {processed_cache_entries} cache entries processed, "
                f"{failed_cache_entries} cache entries failed"
            )

            yield table_pipeline_map

        except Exception as exc:
            logger.error(
                f"Failed to extract pipeline observability data for {pipeline_details.dag_id}: {exc}"
            )
            logger.debug(traceback.format_exc())

    def close(self):
        self.metadata.compute_percentile(Pipeline, self.today)
        self.session.close()
