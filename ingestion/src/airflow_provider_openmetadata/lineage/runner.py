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
OpenMetadata Airflow Provider Lineage Runner
"""
import logging
import os
from itertools import groupby
from typing import List, Optional
from urllib.parse import quote

from airflow.configuration import conf
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Version detection for Airflow 3.x compatibility
try:
    import airflow
    from packaging import version

    AIRFLOW_VERSION = version.parse(airflow.__version__)
    IS_AIRFLOW_3_OR_HIGHER = AIRFLOW_VERSION.major >= 3
except Exception:
    IS_AIRFLOW_3_OR_HIGHER = False

from airflow_provider_openmetadata.lineage.status import STATUS_MAP
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.services.createPipelineService import (
    CreatePipelineServiceRequest,
)
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.pipeline.airflowConnection import (
    AirflowConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.backendConnection import (
    BackendConnection,
)
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.patch_request import (
    ALLOWED_COMMON_PATCH_FIELDS,
    RESTRICT_UPDATE_LIST,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.airflow.lineage_parser import XLets
from metadata.utils import fqn
from metadata.utils.constants import ENTITY_REFERENCE_TYPE_MAP
from metadata.utils.helpers import clean_uri, datetime_to_ts
from metadata.utils.source_hash import generate_source_hash


class SimpleEdge(BaseModel):
    """
    Simple Edge representation with FQN and id
    """

    fqn: str
    id: str


class AirflowLineageRunner:
    """
    Given the OpenMetadata connection, a service name and a DAG:

    1. Create the Pipeline Service (if not exists)
    2. Create or update the Pipeline (DAG + tasks)
    3. Add the task status (Task Instances). We'll pick this up from the available information.
          This operator should run the last to have the complete view.
    4. Add Pipeline Lineage from xlets

    This Runner will be called either from:
    1. Lineage Backend
    2. Lineage Operator
    In both cases, this will run directly on an Airflow instance. Therefore,
    we'll use the airflow config data to populate entities' details.
    """

    def __init__(
        self,
        metadata: OpenMetadata,
        service_name: str,
        dag: "DAG",
        xlets: Optional[List[XLets]] = None,
        only_keep_dag_lineage: bool = False,
        max_status: int = 10,
    ):
        self.metadata = metadata
        self.service_name = service_name
        self.only_keep_dag_lineage = only_keep_dag_lineage
        self.max_status = max_status

        self.dag = dag
        self.xlets = xlets

        # Get base_url with fallback for Airflow 3.x ([api] section) and 2.x ([webserver] section)
        self.host_port = None
        try:
            if IS_AIRFLOW_3_OR_HIGHER:
                self.host_port = conf.get("api", "base_url")
            else:
                self.host_port = conf.get("webserver", "base_url")
        except Exception:
            # Fallback: try alternate section
            try:
                self.host_port = conf.get(
                    "webserver" if IS_AIRFLOW_3_OR_HIGHER else "api", "base_url"
                )
            except Exception:
                # If base_url is not configured in either section, use environment variable or default
                self.host_port = os.getenv(
                    "AIRFLOW_WEBSERVER_BASE_URL", "http://localhost:8080"
                )

    def get_or_create_pipeline_service(self) -> PipelineService:
        """
        Fetch the Pipeline Service from OM. If it does not exist,
        create it.
        """
        service_entity: PipelineService = self.metadata.get_by_name(
            entity=PipelineService, fqn=self.service_name
        )

        if service_entity:
            return service_entity

        pipeline_service: PipelineService = self.metadata.create_or_update(
            CreatePipelineServiceRequest(
                name=self.service_name,
                serviceType=PipelineServiceType.Airflow,
                connection=PipelineConnection(
                    config=AirflowConnection(
                        hostPort=self.host_port,
                        connection=BackendConnection(),
                    ),
                ),
            )
        )

        if pipeline_service is None:
            raise RuntimeError("Failed to create Airflow service.")

        return pipeline_service

    def get_task_url(self, task: "Operator"):
        if IS_AIRFLOW_3_OR_HIGHER:
            return f"{clean_uri(self.host_port)}/dags/{quote(self.dag.dag_id)}/tasks/{quote(task.task_id)}"
        return (
            f"{clean_uri(self.host_port)}/taskinstance/list/"
            f"?_flt_3_dag_id={quote(self.dag.dag_id)}&_flt_3_task_id={quote(task.task_id)}"
        )

    def get_om_tasks(self) -> List[Task]:
        """
        Get all tasks from the DAG and map them to
        OpenMetadata Task Entities
        """
        return [
            Task(
                name=task.task_id,
                description=getattr(task, "description", None),
                sourceUrl=self.get_task_url(task),
                taskType=task.task_type,
                startDate=task.start_date.isoformat() if task.start_date else None,
                endDate=task.end_date.isoformat() if task.end_date else None,
                downstreamTasks=list(task.downstream_task_ids)
                if task.downstream_task_ids
                else None,
            )
            for task in self.dag.tasks or []
        ]

    def create_or_update_pipeline_entity(
        self, pipeline_service: PipelineService
    ) -> Pipeline:
        """
        Create the Pipeline Entity if it does not exist, or PATCH it
        if there have been changes.
        """
        pipeline: Pipeline = self.metadata.get_by_name(
            entity=Pipeline,
            fqn=fqn.build(
                self.metadata,
                Pipeline,
                service_name=self.service_name,
                pipeline_name=self.dag.dag_id,
            ),
            fields=["*"],
        )

        pipeline_request = CreatePipelineRequest(
            name=self.dag.dag_id,
            description=self.dag.description,
            sourceUrl=f"{clean_uri(self.host_port)}/tree?dag_id={self.dag.dag_id}",
            concurrency=self.dag.max_active_tasks,
            pipelineLocation=self.dag.fileloc,
            startDate=self.dag.start_date.isoformat() if self.dag.start_date else None,
            tasks=self.get_om_tasks(),
            service=pipeline_service.fullyQualifiedName,
        )

        create_entity_request_hash = generate_source_hash(
            create_request=pipeline_request
        )
        pipeline_request.sourceHash = create_entity_request_hash

        if pipeline is None:
            logger.info("Creating Pipeline Entity from DAG...")
            return self.metadata.create_or_update(pipeline_request)

        if create_entity_request_hash != pipeline.sourceHash:
            logger.info("Updating Pipeline Entity from DAG...")
            return self.metadata.patch(
                entity=Pipeline,
                source=pipeline,
                destination=pipeline.model_copy(update=pipeline_request.__dict__),
                allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
                restrict_update_fields=RESTRICT_UPDATE_LIST,
            )

        logger.info("DAG has not changed since last run")
        return pipeline

    def get_pipeline_status_via_api(self) -> List[PipelineStatus]:
        """
        Collect pipeline status using Airflow REST API (for Airflow 3.x).
        This avoids the direct database access restriction.
        """
        logger.info("Attempting to collect pipeline status via Airflow REST API")
        try:
            from datetime import datetime

            import requests

            # Get authentication credentials from environment or config
            airflow_username = os.getenv("AIRFLOW_USERNAME", "admin")
            airflow_password = os.getenv("AIRFLOW_PASSWORD", "admin")
            logger.info(f"Using Airflow API URL: {self.host_port}")

            # Build API URL
            api_url = f"{self.host_port}/api/v2/dags/{self.dag.dag_id}/dagRuns"

            # Get JWT token for authentication (following the DAG file pattern)
            token_url = f"{self.host_port}/auth/token"
            jwt_token = None

            try:
                logger.info(f"Attempting JWT auth at: {token_url}")
                auth_response = requests.post(
                    token_url,
                    json={"username": airflow_username, "password": airflow_password},
                    timeout=5,
                )
                logger.info(f"JWT auth response status: {auth_response.status_code}")
                if auth_response.status_code in (200, 201):
                    token_data = auth_response.json()
                    jwt_token = token_data.get("access_token")
                    if jwt_token:
                        logger.info("Successfully obtained JWT token")
                    else:
                        logger.warning("JWT response did not contain access_token")
                else:
                    logger.warning(
                        f"Failed to get JWT token (status {auth_response.status_code})"
                    )
                    logger.warning(f"JWT response: {auth_response.text[:200]}")
            except Exception as auth_error:
                logger.warning(
                    f"JWT authentication failed with exception: {auth_error}"
                )
                import traceback

                logger.warning(f"Auth traceback: {traceback.format_exc()}")

            # Set headers based on whether we got a JWT token
            if jwt_token:
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {jwt_token}",
                }
                logger.info("Using JWT token for authentication")
            else:
                # Fallback to basic auth
                import base64

                credentials = base64.b64encode(
                    f"{airflow_username}:{airflow_password}".encode()
                ).decode()
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Basic {credentials}",
                }
                logger.info("Using Basic auth as fallback")

            # Fetch DAG runs
            # Airflow 3.x uses 'logical_date' instead of 'execution_date'
            logger.info(f"Fetching DAG runs from: {api_url}")
            logger.info(f"Params: limit={self.max_status}, order_by=-logical_date")
            response = requests.get(
                api_url,
                params={"limit": self.max_status, "order_by": "-logical_date"},
                headers=headers,
                timeout=10,
            )

            logger.info(f"DAG runs API response status: {response.status_code}")
            if response.status_code != 200:
                logger.error(
                    f"Failed to fetch DAG runs: {response.status_code} - {response.text[:500]}"
                )
                return []

            dag_runs_data = response.json().get("dag_runs", [])
            if not dag_runs_data:
                logger.warning("No DAG runs found via API")
                logger.warning(f"API response: {response.text[:500]}")
                return []

            logger.info(f"Found {len(dag_runs_data)} DAG runs via API")
            for dag_run in dag_runs_data:
                logger.info(
                    f"  - DAG run: {dag_run.get('dag_run_id')} state={dag_run.get('state')}"
                )

            pipeline_statuses = []

            for dag_run in dag_runs_data:
                dag_run_id = dag_run.get("dag_run_id")
                if not dag_run_id:
                    logger.warning("Skipping DAG run with no dag_run_id")
                    continue

                # Fetch task instances for this DAG run
                task_instances_url = f"{self.host_port}/api/v2/dags/{self.dag.dag_id}/dagRuns/{dag_run_id}/taskInstances"
                logger.info(f"Fetching task instances from: {task_instances_url}")
                ti_response = requests.get(
                    task_instances_url, headers=headers, timeout=10
                )

                logger.info(
                    f"Task instances API response status: {ti_response.status_code}"
                )
                if ti_response.status_code != 200:
                    logger.error(
                        f"Failed to fetch task instances for {dag_run_id}: {ti_response.status_code} - {ti_response.text[:300]}"
                    )
                    continue

                task_instances_data = ti_response.json().get("task_instances", [])
                if not task_instances_data:
                    logger.warning(f"No task instances found for DAG run {dag_run_id}")
                    continue

                logger.info(
                    f"Found {len(task_instances_data)} task instances for run {dag_run_id}"
                )

                # Build TaskStatus list from API response
                task_status_list = []
                for ti in task_instances_data:
                    task_state = ti.get("state", "pending")
                    execution_status = STATUS_MAP.get(
                        task_state, StatusType.Pending.value
                    )

                    # Parse timestamps
                    start_time = None
                    end_time = None
                    if ti.get("start_date"):
                        try:
                            start_dt = datetime.fromisoformat(
                                ti["start_date"].replace("Z", "+00:00")
                            )
                            start_time = datetime_to_ts(start_dt)
                        except Exception:
                            pass

                    if ti.get("end_date"):
                        try:
                            end_dt = datetime.fromisoformat(
                                ti["end_date"].replace("Z", "+00:00")
                            )
                            end_time = datetime_to_ts(end_dt)
                        except Exception:
                            pass

                    task_status_list.append(
                        TaskStatus(
                            name=ti.get("task_id", "unknown"),
                            executionStatus=execution_status,
                            startTime=start_time,
                            endTime=end_time,
                            logLink=ti.get("log_url"),
                        )
                    )

                # Determine overall DAG run status
                task_states = [ti.get("state") for ti in task_instances_data]
                if any(
                    s in ["pending", "queued", "scheduled", "running"]
                    for s in task_states
                ):
                    dag_status = StatusType.Pending.value
                elif any(s == "failed" for s in task_states):
                    dag_status = StatusType.Failed.value
                else:
                    dag_status = StatusType.Successful.value

                # Parse execution date
                execution_date_str = dag_run.get("logical_date") or dag_run.get(
                    "execution_date"
                )
                execution_timestamp = None
                if execution_date_str:
                    try:
                        exec_dt = datetime.fromisoformat(
                            execution_date_str.replace("Z", "+00:00")
                        )
                        execution_timestamp = datetime_to_ts(exec_dt)
                    except Exception:
                        pass

                pipeline_status = PipelineStatus(
                    timestamp=execution_timestamp,
                    executionStatus=dag_status,
                    taskStatus=task_status_list,
                )
                pipeline_statuses.append(pipeline_status)
                logger.info(
                    f"Created pipeline status for run {dag_run_id}: {len(task_status_list)} tasks, status={dag_status}"
                )

            logger.info(
                f"Successfully collected {len(pipeline_statuses)} pipeline statuses via REST API"
            )
            return pipeline_statuses

        except Exception as e:
            logger.error(f"Error collecting pipeline status via API: {e}")
            import traceback

            logger.error(f"Traceback: {traceback.format_exc()}")
            raise

    def get_all_pipeline_status(self) -> List[PipelineStatus]:
        """
        Iterate over the DAG's task instances and map
        them to PipelineStatus.

        In Airflow 2.x we can still hit the metadata DB, so we keep
        the original behaviour. In Airflow 3.x we use the REST API
        to fetch status information.
        """
        logger.info(
            f"get_all_pipeline_status called. IS_AIRFLOW_3_OR_HIGHER={IS_AIRFLOW_3_OR_HIGHER}"
        )

        if not IS_AIRFLOW_3_OR_HIGHER:
            # Airflow 2.x path - rely on get_task_instances()
            grouped_ti: List[List["TaskInstance"]] = [
                list(value)
                for _, value in groupby(
                    self.dag.get_task_instances(), key=lambda ti: ti.run_id
                )
            ]
            grouped_ti.reverse()

            return [
                self.get_pipeline_status(task_instances)
                for task_instances in grouped_ti[: self.max_status]
            ]

        # Airflow 3.x - try REST API first, fall back to DB access
        try:
            pipeline_statuses = self.get_pipeline_status_via_api()
            if pipeline_statuses:
                return pipeline_statuses
            logger.info(
                "REST API returned no statuses, trying direct DB access as fallback"
            )
        except Exception as e:
            logger.warning(
                f"Failed to get status via REST API: {e}, trying DB access as fallback"
            )

        # Fallback to direct DB access (will likely fail in Airflow 3.x)
        try:
            from airflow.models import DagRun

            dag_runs = DagRun.find(dag_id=self.dag.dag_id, state=None)
            if not dag_runs:
                logger.info("No DAG runs found for status collection")
                return []

            recent_runs = sorted(
                dag_runs, key=lambda r: r.execution_date, reverse=True
            )[: self.max_status]

            pipeline_statuses = []
            for dag_run in recent_runs:
                task_instances = dag_run.get_task_instances()
                if task_instances:
                    pipeline_statuses.append(self.get_pipeline_status(task_instances))

            return pipeline_statuses

        except RuntimeError as e:
            if "Direct database access" in str(e):
                logger.warning(
                    "Direct database access not allowed in Airflow 3.x. "
                    "Pipeline status collection skipped."
                )
                return []
            raise
        except Exception as e:
            logger.warning(f"Could not collect pipeline status: {e}")
            return []

    @staticmethod
    def get_dag_status_from_task_instances(task_instances: List["TaskInstance"]) -> str:
        """
        If any task is in pending state, then return pending.
        If any task is in failed state, return failed.
        Otherwise, return Success.
        """
        task_statuses = [
            STATUS_MAP.get(task_instance.state, StatusType.Pending.value)
            for task_instance in task_instances
        ]
        if any(status == StatusType.Pending.value for status in task_statuses):
            return StatusType.Pending.value
        if any(status == StatusType.Failed.value for status in task_statuses):
            return StatusType.Failed.value

        return StatusType.Successful.value

    def get_pipeline_status(
        self, task_instances: List["TaskInstance"]
    ) -> PipelineStatus:
        """
        Given the task instances for a run, prep the PipelineStatus
        """

        task_status = [
            TaskStatus(
                name=task_instance.task_id,
                executionStatus=STATUS_MAP.get(
                    task_instance.state, StatusType.Pending.value
                ),
                startTime=datetime_to_ts(task_instance.start_date),
                endTime=datetime_to_ts(task_instance.end_date),
                logLink=task_instance.log_url,
            )
            for task_instance in task_instances
        ]

        # Airflow 3.x uses logical_date instead of execution_date
        execution_date = (
            getattr(task_instances[0], "logical_date", None)
            or task_instances[0].execution_date
        )

        return PipelineStatus(
            # Use any of the task execution dates for the status execution date
            timestamp=datetime_to_ts(execution_date),
            executionStatus=self.get_dag_status_from_task_instances(task_instances),
            taskStatus=task_status,
        )

    def add_all_pipeline_status(self, pipeline: Pipeline) -> None:
        """
        Get the latest Pipeline Status from the DAG and send
        it to OM
        """
        pipeline_status_list = self.get_all_pipeline_status()

        for status in pipeline_status_list:
            self.metadata.add_pipeline_status(
                fqn=pipeline.fullyQualifiedName.root, status=status
            )

    def add_lineage(self, pipeline: Pipeline, xlets: XLets) -> None:
        """
        Add the lineage from inlets and outlets
        """

        lineage_details = LineageDetails(
            pipeline=EntityReference(
                id=pipeline.id, type=ENTITY_REFERENCE_TYPE_MAP[Pipeline.__name__]
            )
        )

        for from_xlet in xlets.inlets or []:
            from_entity: Optional[Table] = self.metadata.get_by_name(
                entity=from_xlet.entity, fqn=from_xlet.fqn
            )
            if from_entity:
                for to_xlet in xlets.outlets or []:
                    to_entity: Optional[Table] = self.metadata.get_by_name(
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
                        self.metadata.add_lineage(lineage)
                    else:
                        logger.warning(
                            f"Could not find [{to_xlet.entity.__name__}] [{to_xlet.fqn}] from "
                            f"[{pipeline.fullyQualifiedName.root}] outlets"
                        )
            else:
                logger.warning(
                    f"Could not find [{from_xlet.entity.__name__}] [{from_xlet.fqn}] from "
                    f"[{pipeline.fullyQualifiedName.root}] inlets"
                )

    def clean_lineage(self, pipeline: Pipeline, xlets: XLets):
        """
        Clean the lineage nodes that are not part of xlets.

        We'll only clean up table nodes
        """
        lineage_data = self.metadata.get_lineage_by_name(
            entity=Pipeline,
            fqn=pipeline.fullyQualifiedName.root,
            up_depth=1,
            down_depth=1,
        )

        upstream_edges = [
            next(
                (
                    SimpleEdge(fqn=node["fullyQualifiedName"], id=node["id"])
                    for node in lineage_data.get("nodes") or []
                    if node["id"] == upstream_edge["fromEntity"]
                    and node["type"] == "table"
                ),
                None,
            )
            for upstream_edge in lineage_data.get("upstreamEdges") or []
        ]
        downstream_edges = [
            next(
                (
                    SimpleEdge(fqn=node["fullyQualifiedName"], id=node["id"])
                    for node in lineage_data.get("nodes") or []
                    if node["id"] == downstream_edge["toEntity"]
                    and node["type"] == "table"
                ),
                None,
            )
            for downstream_edge in lineage_data.get("downstreamEdges") or []
        ]

        for edge in upstream_edges or []:
            if edge.fqn not in (inlet.fqn for inlet in xlets.inlets):
                logger.info(f"Removing upstream edge with {edge.fqn}")
                edge_to_remove = EntitiesEdge(
                    fromEntity=EntityReference(
                        id=edge.id, type=ENTITY_REFERENCE_TYPE_MAP[Table.__name__]
                    ),
                    toEntity=EntityReference(
                        id=pipeline.id,
                        type=ENTITY_REFERENCE_TYPE_MAP[Pipeline.__name__],
                    ),
                )
                self.metadata.delete_lineage_edge(edge=edge_to_remove)

        for edge in downstream_edges or []:
            if edge.fqn not in (outlet.fqn for outlet in xlets.outlets):
                logger.info(f"Removing downstream edge with {edge.fqn}")
                edge_to_remove = EntitiesEdge(
                    fromEntity=EntityReference(
                        id=pipeline.id,
                        type=ENTITY_REFERENCE_TYPE_MAP[Pipeline.__name__],
                    ),
                    toEntity=EntityReference(
                        id=edge.id, type=ENTITY_REFERENCE_TYPE_MAP[Table.__name__]
                    ),
                )
                self.metadata.delete_lineage_edge(edge=edge_to_remove)

    def execute(self):
        """
        Run the whole ingestion logic
        """
        logger.info("Executing Airflow Lineage Runner...")
        pipeline_service = self.get_or_create_pipeline_service()
        pipeline = self.create_or_update_pipeline_entity(pipeline_service)
        self.add_all_pipeline_status(pipeline)

        logger.info(f"Processing XLet data {self.xlets}")

        for xlet in self.xlets or []:
            logger.info(f"Got some xlet data. Processing lineage for {xlet}")
            self.add_lineage(pipeline, xlet)
            if self.only_keep_dag_lineage:
                logger.info(
                    "`only_keep_dag_lineage` is set to True. Cleaning lineage not in inlets or outlets..."
                )
                self.clean_lineage(pipeline, xlet)
