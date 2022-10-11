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
OpenMetadata Airflow Lineage Backend
"""

import traceback
from typing import TYPE_CHECKING, Dict, List, Optional

from airflow.configuration import conf

from airflow_provider_openmetadata.lineage.config.loader import AirflowLineageConfig
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
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.helpers import datetime_to_ts

if TYPE_CHECKING:
    from airflow import DAG
    from airflow.models.baseoperator import BaseOperator
    from airflow.models.dagrun import DagRun
    from airflow.models.taskinstance import TaskInstance


_STATUS_MAP = {
    "running": StatusType.Pending,
    "success": StatusType.Successful,
    "failed": StatusType.Failed,
}


def is_airflow_version_1() -> bool:
    """
    Check varying imports between Airflow v1 & v2
    """
    # pylint: disable=unused-import,import-outside-toplevel
    try:

        return False
    except ModuleNotFoundError:

        return True


def parse_v1_xlets(xlet: dict) -> Optional[List[str]]:
    """
    Parse airflow xlets for V1
    :param xlet: airflow v1 xlet dict
    :return: table list or None
    """
    if isinstance(xlet, dict):
        tables = xlet.get("tables")
        if tables and isinstance(tables, list):
            return tables

    return None


def parse_xlets(xlet: List[dict]) -> Optional[List[str]]:
    """
    Parse airflow xlets for V1
    :param xlet: airflow v2 xlet dict
    :return: table list or None
    """
    if len(xlet) and isinstance(xlet[0], dict):
        tables = xlet[0].get("tables")
        if tables and isinstance(tables, list):
            return tables

    return None


def get_xlets(
    operator: "BaseOperator", xlet_mode: str = "_inlets"
) -> Optional[List[str]]:
    """
    Given an Airflow DAG Task, obtain the tables
    set in inlets or outlets.

    We expect xlets to have the following structure:
    [{'tables': ['FQN']}]

    :param operator: task to get xlets from
    :param xlet_mode: get inlet or outlet
    :return: list of tables FQN
    """
    xlet = getattr(operator, xlet_mode)
    if is_airflow_version_1():
        tables = parse_v1_xlets(xlet)

    else:
        tables = parse_xlets(xlet)

    if not tables:
        operator.log.info(f"Not finding proper {xlet_mode} in task {operator.task_id}")

    return tables


def create_or_update_pipeline(  # pylint: disable=too-many-locals
    task_instance: "TaskInstance",
    operator: "BaseOperator",
    dag: "DAG",
    airflow_service_entity: PipelineService,
    metadata: OpenMetadata,
) -> Pipeline:
    """
    Prepare the upsert of pipeline entity with the given task

    We will:
    - Create the pipeline Entity
    - Append the task being processed
    - Clean deleted tasks based on the DAG children information

    :param task_instance: task run being processed
    :param dag_run: DAG run being processed
    :param operator: task being examined by lineage
    :param dag: airflow dag
    :param airflow_service_entity: PipelineService
    :param metadata: OpenMetadata API client
    :return: PipelineEntity
    """
    dag_url = f"/tree?dag_id={dag.dag_id}"
    task_url = f"/taskinstance/list/?flt1_dag_id_equals={dag.dag_id}&_flt_3_task_id={operator.task_id}"

    dag_start_date = dag.start_date.isoformat() if dag.start_date else None
    task_start_date = (
        task_instance.start_date.isoformat() if task_instance.start_date else None
    )
    task_end_date = (
        task_instance.end_date.isoformat() if task_instance.end_date else None
    )

    downstream_tasks = []
    if getattr(operator, "downstream_task_ids", None):
        downstream_tasks = operator.downstream_task_ids

    operator.log.info(f"downstream tasks {downstream_tasks}")

    task = Task(
        name=operator.task_id,
        displayName=operator.task_id,
        taskUrl=task_url,
        taskType=operator.task_type,
        startDate=task_start_date,
        endDate=task_end_date,
        downstreamTasks=downstream_tasks,
    )

    # Check if the pipeline already exists
    operator.log.info(
        f"Checking if the pipeline {airflow_service_entity.name.__root__}.{dag.dag_id} exists. If not, we will create it."
    )
    current_pipeline: Pipeline = metadata.get_by_name(
        entity=Pipeline,
        fqn=f"{airflow_service_entity.name.__root__}.{dag.dag_id}",
        fields=["tasks"],
    )

    # Create pipeline if not exists or update its properties
    pipeline_request = CreatePipelineRequest(
        name=dag.dag_id,
        displayName=dag.dag_id,
        description=dag.description,
        pipelineUrl=dag_url,
        concurrency=current_pipeline.concurrency if current_pipeline else None,
        pipelineLocation=current_pipeline.pipelineLocation
        if current_pipeline
        else None,
        startDate=dag_start_date,
        tasks=current_pipeline.tasks
        if current_pipeline
        else None,  # use the current tasks, if any
        service=EntityReference(id=airflow_service_entity.id, type="pipelineService"),
        owner=current_pipeline.owner if current_pipeline else None,
        tags=current_pipeline.tags if current_pipeline else None,
    )
    pipeline: Pipeline = metadata.create_or_update(pipeline_request)

    # Add the task we are processing in the lineage backend
    operator.log.info("Adding tasks to pipeline...")
    updated_pipeline = metadata.add_task_to_pipeline(pipeline, task)

    # Clean pipeline
    try:
        operator.log.info("Cleaning pipeline tasks...")
        updated_pipeline = metadata.clean_pipeline_tasks(updated_pipeline, dag.task_ids)
    except Exception as exc:  # pylint: disable=broad-except
        operator.log.warning(f"Error cleaning pipeline tasks {exc}")

    return updated_pipeline


def get_dag_status(all_tasks: List[str], task_status: List[TaskStatus]):
    """
    Based on the task information and the total DAG tasks, cook the
    DAG status.
    We are not directly using `context["dag_run"]._state` as it always
    gets flagged as "running" during the callbacks.
    """

    if len(all_tasks) < len(task_status):
        raise ValueError(
            "We have more status than children:"
            + f"children {all_tasks} vs. status {task_status}"
        )

    # We are still processing tasks...
    if len(all_tasks) > len(task_status):
        return StatusType.Pending

    # Check for any failure if all tasks have been processed
    if len(all_tasks) == len(task_status) and StatusType.Failed in {
        task.executionStatus for task in task_status
    }:
        return StatusType.Failed

    return StatusType.Successful


def add_status(
    operator: "BaseOperator",
    pipeline: Pipeline,
    metadata: OpenMetadata,
    context: Dict,
) -> None:
    """
    Add status information for this execution date
    """

    dag: "DAG" = context["dag"]
    dag_run: "DagRun" = context["dag_run"]
    task_instance: "TaskInstance" = context["task_instance"]

    # Let this fail if we cannot properly extract & cast the start_date
    execution_date = datetime_to_ts(dag_run.execution_date)
    operator.log.info(f"Logging pipeline status for execution {execution_date}")

    # Check if we already have a pipelineStatus for
    # our execution_date that we should update
    pipeline_status: List[PipelineStatus] = metadata.get_by_id(
        entity=Pipeline, entity_id=pipeline.id, fields=["pipelineStatus"]
    ).pipelineStatus

    task_status = []
    # We will append based on the current registered status
    if pipeline_status and pipeline_status[0].executionDate.__root__ == execution_date:
        # If we are clearing a task, use the status of the new execution
        task_status = [
            task
            for task in pipeline_status[0].taskStatus
            if task.name != task_instance.task_id
        ]

    # Prepare the new task status information based on the tasks already
    # visited and the current task
    updated_task_status = [
        TaskStatus(
            name=task_instance.task_id,
            executionStatus=_STATUS_MAP.get(task_instance.state),
            startTime=datetime_to_ts(task_instance.start_date),
            endTime=datetime_to_ts(task_instance.end_date),
            logLink=task_instance.log_url,
        ),
        *task_status,
    ]

    updated_status = PipelineStatus(
        timestamp=execution_date,
        executionStatus=get_dag_status(
            all_tasks=dag.task_ids,
            task_status=updated_task_status,
        ),
        taskStatus=updated_task_status,
    )

    operator.log.info(f"Added status to DAG {updated_status}")
    metadata.add_pipeline_status(
        fqn=pipeline.fullyQualifiedName.__root__, status=updated_status
    )


# pylint: disable=too-many-arguments,too-many-locals
def parse_lineage(
    config: AirflowLineageConfig,
    context: Dict,
    operator: "BaseOperator",
    inlets: List,
    outlets: List,
    metadata: OpenMetadata,
) -> Optional[Pipeline]:
    """
    Main logic to extract properties from DAG and the
    triggered operator to ingest lineage data into
    OpenMetadata

    :param config: lineage configuration
    :param context: airflow runtime context
    :param operator: task being executed
    :param inlets: list of upstream tables
    :param outlets: list of downstream tables
    :param metadata: OpenMetadata client
    """
    operator.log.info("Parsing Lineage for OpenMetadata")

    dag: "DAG" = context["dag"]
    task_instance: "TaskInstance" = context["task_instance"]

    try:

        airflow_service_entity = get_or_create_pipeline_service(
            operator, metadata, config
        )
        pipeline = create_or_update_pipeline(
            task_instance=task_instance,
            operator=operator,
            dag=dag,
            airflow_service_entity=airflow_service_entity,
            metadata=metadata,
        )

        operator.log.info("Parsing Lineage")
        for table in inlets if inlets else []:
            table_entity = metadata.get_by_name(entity=Table, fqn=table)
            operator.log.debug(f"from entity {table_entity}")
            lineage = AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=table_entity.id, type="table"),
                    toEntity=EntityReference(id=pipeline.id, type="pipeline"),
                )
            )
            operator.log.debug(f"From lineage {lineage}")
            metadata.add_lineage(lineage)

        for table in outlets if outlets else []:
            table_entity = metadata.get_by_name(entity=Table, fqn=table)
            operator.log.debug(f"To entity {table_entity}")
            lineage = AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=pipeline.id, type="pipeline"),
                    toEntity=EntityReference(id=table_entity.id, type="table"),
                )
            )
            operator.log.debug(f"To lineage {lineage}")
            metadata.add_lineage(lineage)

        return pipeline

    except Exception as exc:  # pylint: disable=broad-except
        operator.log.error(
            f"Failed to parse Airflow DAG task and publish to OpenMetadata due to {exc}"
        )
        operator.log.error(traceback.format_exc())

        return None


def get_or_create_pipeline_service(
    operator: "BaseOperator", metadata: OpenMetadata, config: AirflowLineageConfig
) -> PipelineService:
    """
    Check if we already have the airflow instance as a PipelineService,
    otherwise create it.

    :param operator: task from which we extract the lineage
    :param metadata: OpenMetadata API wrapper
    :param config: lineage config
    :return: PipelineService
    """
    operator.log.info("Get Airflow Service ID")
    airflow_service_entity = metadata.get_by_name(
        entity=PipelineService, fqn=config.airflow_service_name
    )

    if airflow_service_entity is None:
        pipeline_service = CreatePipelineServiceRequest(
            name=config.airflow_service_name,
            serviceType=PipelineServiceType.Airflow,
            connection=PipelineConnection(
                config=AirflowConnection(
                    hostPort=conf.get("webserver", "base_url"),
                    connection=BackendConnection(),
                ),
            ),
        )
        airflow_service_entity = metadata.create_or_update(pipeline_service)
        if airflow_service_entity:
            operator.log.info(
                f"Created airflow service entity - {airflow_service_entity.fullyQualifiedName.__root__}"
            )
        else:
            operator.log.error("Failed to create airflow service entity")

    return airflow_service_entity
