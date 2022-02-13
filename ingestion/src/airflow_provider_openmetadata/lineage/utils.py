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
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Optional, Set, Tuple, Union

from airflow.configuration import conf

from airflow_provider_openmetadata.lineage.config import OpenMetadataLineageConfig
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
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.helpers import convert_epoch_to_iso

if TYPE_CHECKING:
    from airflow import DAG
    from airflow.models.baseoperator import BaseOperator

_ALLOWED_TASK_KEYS = {
    "_downstream_task_ids",
    "_inlets",
    "_outlets",
    "_task_type",
    "_task_module",
    "depends_on_past",
    "email",
    "label",
    "execution_timeout",
    "end_date",
    "start_date",
    "sla",
    "sql",
    "task_id",
    "trigger_rule",
    "wait_for_downstream",
}

_ALLOWED_FLOW_KEYS = {
    "_access_control",
    "_concurrency",
    "_default_view",
    "catchup",
    "fileloc",
    "is_paused_upon_creation",
    "start_date",
    "tags",
    "timezone",
    "_task_group",  # We can get children information from here
}

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
        from airflow.hooks.base import BaseHook

        return False
    except ModuleNotFoundError:
        from airflow.hooks.base_hook import BaseHook

        return True


def get_properties(
    obj: Union["DAG", "BaseOperator"], serializer: Callable, allowed_keys: Set[str]
) -> Dict[str, str]:
    """
    Given either a DAG or a BaseOperator, obtain its allowed properties
    :param obj: DAG or BaseOperator object
    :return: properties dict
    """

    props: Dict[str, str] = dict(serializer(obj).items())

    for key in obj.get_serialized_fields():
        if key not in props:
            props[key] = getattr(obj, key)

    return {key: value for (key, value) in props.items() if key in allowed_keys}


def get_xlets(
    operator: "BaseOperator", xlet_mode: str = "_inlets"
) -> Union[Optional[List[str]], Any]:
    """
    Given an Airflow DAG Task, obtain the tables
    set in inlets or outlets.

    We expect xlets to have the following structure:
    [{'tables': ['FQDN']}]

    :param operator: task to get xlets from
    :param xlet_mode: get inlet or outlet
    :return: list of tables FQDN
    """
    xlet = getattr(operator, xlet_mode)
    if is_airflow_version_1():
        return xlet

    if len(xlet) and isinstance(xlet[0], dict):
        tables = xlet[0].get("tables")
        if isinstance(tables, list) and len(tables):
            return tables

    operator.log.info(f"Not finding proper {xlet_mode} in task {operator.task_id}")
    return None


# pylint: disable=too-many-arguments
def iso_dag_start_date(props: Dict[str, Any]) -> Optional[str]:
    """
    Given a properties dict, return the start_date
    as an iso string if start_date is informed
    :param props: properties dict
    :return: iso start_date or None
    """

    # DAG start date comes as `float`
    if props.get("start_date"):
        return convert_epoch_to_iso(int(float(props["start_date"])))

    return None


def iso_task_start_end_date(
    props: Dict[str, Any]
) -> Tuple[Optional[str], Optional[str]]:
    """
    Given the attributes of a Task Instance, return
    the task start date and task end date as
    ISO format
    :param props: task instance attributes
    :return: task start and end date
    """

    task_start_date = (
        convert_epoch_to_iso(int(props["start_date"].timestamp()))
        if props.get("start_date")
        else None
    )
    task_end_date = (
        convert_epoch_to_iso(int(props["end_date"].timestamp()))
        if props.get("end_date")
        else None
    )

    return task_start_date, task_end_date


def create_or_update_pipeline(  # pylint: disable=too-many-locals
    dag_properties: Dict[str, Any],
    task_properties: Dict[str, Any],
    operator: "BaseOperator",
    dag: "DAG",
    airflow_service_entity: PipelineService,
    client: OpenMetadata,
) -> Pipeline:
    """
    Prepare the upsert of pipeline entity with the given task

    We will:
    - Create the pipeline Entity
    - Append the task being processed
    - Clean deleted tasks based on the DAG children information

    :param dag_properties: attributes of the dag object
    :param task_properties: attributes of the task object
    :param operator: task being examined by lineage
    :param dag: airflow dag
    :param airflow_service_entity: PipelineService
    :param client: OpenMetadata API client
    :return: PipelineEntity
    """
    pipeline_service_url = conf.get("webserver", "base_url")
    dag_url = f"{pipeline_service_url}/tree?dag_id={dag.dag_id}"
    task_url = (
        f"{pipeline_service_url}/taskinstance/list/"
        + f"?flt1_dag_id_equals={dag.dag_id}&_flt_3_task_id={operator.task_id}"
    )
    dag_start_date = iso_dag_start_date(dag_properties)
    task_start_date, task_end_date = iso_task_start_end_date(task_properties)

    downstream_tasks = []
    if task_properties.get("_downstream_task_ids"):
        downstream_tasks = task_properties["_downstream_task_ids"]

    operator.log.info(f"downstream tasks {downstream_tasks}")

    task = Task(
        name=task_properties["task_id"],
        displayName=task_properties.get("label"),  # v1.10.15 does not have label
        taskUrl=task_url,
        taskType=task_properties["_task_type"],
        startDate=task_start_date,
        endDate=task_end_date,
        downstreamTasks=downstream_tasks,
    )

    # Check if the pipeline already exists
    current_pipeline: Pipeline = client.get_by_name(
        entity=Pipeline,
        fqdn=f"{airflow_service_entity.name}.{dag.dag_id}",
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
    pipeline = client.create_or_update(pipeline_request)

    # Add the task we are processing in the lineage backend
    operator.log.info("Adding tasks to pipeline...")
    updated_pipeline = client.add_task_to_pipeline(pipeline, task)

    # Clean pipeline
    try:
        operator.log.info("Cleaning pipeline tasks...")
        children = dag_properties.get("_task_group").get("children")
        dag_tasks = [Task(name=name) for name in children.keys()]
        updated_pipeline = client.clean_pipeline_tasks(updated_pipeline, dag_tasks)
    except Exception as exc:  # pylint: disable=broad-except
        operator.log.warning(f"Error cleaning pipeline tasks {exc}")

    return updated_pipeline


def get_context_properties(
    operator: "BaseOperator", dag: "DAG"
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Prepare DAG and Task properties based on attributes
    and serializers
    """
    # Move this import to avoid circular import error when airflow parses the config
    # pylint: disable=import-outside-toplevel
    from airflow.serialization.serialized_objects import (
        SerializedBaseOperator,
        SerializedDAG,
    )

    dag_properties = get_properties(
        dag, SerializedDAG.serialize_dag, _ALLOWED_FLOW_KEYS
    )
    task_properties = get_properties(
        operator, SerializedBaseOperator.serialize_operator, _ALLOWED_TASK_KEYS
    )

    operator.log.info(f"Task Properties {task_properties}")
    operator.log.info(f"DAG properties {dag_properties}")

    return dag_properties, task_properties


def get_dag_status(dag_properties: Dict[str, Any], task_status: List[TaskStatus]):
    """
    Based on the task information and the total DAG tasks, cook the
    DAG status.
    We are not directly using `context["dag_run"]._state` as it always
    gets flagged as "running" during the callbacks.
    """

    children = dag_properties.get("_task_group").get("children")

    if len(children) < len(task_status):
        raise ValueError(
            "We have more status than children:"
            + f"children {children} vs. status {task_status}"
        )

    # We are still processing tasks...
    if len(children) > len(task_status):
        return StatusType.Pending

    # Check for any failure if all tasks have been processed
    if len(children) == len(task_status) and StatusType.Failed in {
        task.executionStatus for task in task_status
    }:
        return StatusType.Failed

    return StatusType.Successful


def add_status(
    operator: "BaseOperator",
    pipeline: Pipeline,
    client: OpenMetadata,
    context: Dict,
) -> None:
    """
    Add status information for this execution date
    """

    dag: "DAG" = context["dag"]
    dag_properties, task_properties = get_context_properties(operator, dag)

    # Let this fail if we cannot properly extract & cast the start_date
    execution_date = int(dag_properties.get("start_date"))
    operator.log.info(f"Logging pipeline status for execution {execution_date}")

    # Check if we already have a pipelineStatus for
    # our execution_date that we should update
    pipeline_status: List[PipelineStatus] = client.get_by_id(
        entity=Pipeline, entity_id=pipeline.id, fields=["pipelineStatus"]
    ).pipelineStatus

    task_status = []
    # We will append based on the current registered status
    if pipeline_status and pipeline_status[0].executionDate.__root__ == execution_date:
        # If we are clearing a task, use the status of the new execution
        task_status = [
            task
            for task in pipeline_status[0].taskStatus
            if task.name != task_properties["task_id"]
        ]

    # Prepare the new task status information based on the tasks already
    # visited and the current task
    updated_task_status = [
        TaskStatus(
            name=task_properties["task_id"],
            executionStatus=_STATUS_MAP.get(context["task_instance"].state),
        ),
        *task_status,
    ]

    updated_status = PipelineStatus(
        executionDate=execution_date,
        executionStatus=get_dag_status(
            dag_properties=dag_properties, task_status=updated_task_status
        ),
        taskStatus=updated_task_status,
    )

    operator.log.info(f"Added status to DAG {updated_status}")
    client.add_pipeline_status(pipeline=pipeline, status=updated_status)


# pylint: disable=too-many-arguments,too-many-locals
def parse_lineage(
    config: OpenMetadataLineageConfig,
    context: Dict,
    operator: "BaseOperator",
    inlets: List,
    outlets: List,
    client: OpenMetadata,
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
    :param client: OpenMetadata client
    """
    operator.log.info("Parsing Lineage for OpenMetadata")

    dag: "DAG" = context["dag"]
    dag_properties, task_properties = get_context_properties(operator, dag)

    try:

        airflow_service_entity = get_or_create_pipeline_service(
            operator, client, config
        )
        pipeline = create_or_update_pipeline(
            dag_properties=dag_properties,
            task_properties=task_properties,
            operator=operator,
            dag=dag,
            airflow_service_entity=airflow_service_entity,
            client=client,
        )

        operator.log.info("Parsing Lineage")
        for table in inlets if inlets else []:
            table_entity = client.get_by_name(entity=Table, fqdn=table)
            operator.log.debug(f"from entity {table_entity}")
            lineage = AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=table_entity.id, type="table"),
                    toEntity=EntityReference(id=pipeline.id, type="pipeline"),
                )
            )
            operator.log.debug(f"From lineage {lineage}")
            client.add_lineage(lineage)

        for table in outlets if outlets else []:
            table_entity = client.get_by_name(entity=Table, fqdn=table)
            operator.log.debug(f"To entity {table_entity}")
            lineage = AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=pipeline.id, type="pipeline"),
                    toEntity=EntityReference(id=table_entity.id, type="table"),
                )
            )
            operator.log.debug(f"To lineage {lineage}")
            client.add_lineage(lineage)

        return pipeline

    except Exception as exc:  # pylint: disable=broad-except
        operator.log.error(
            f"Failed to parse Airflow DAG task and publish to OpenMetadata due to {exc}"
        )
        operator.log.error(traceback.format_exc())

        return None


def get_or_create_pipeline_service(
    operator: "BaseOperator", client: OpenMetadata, config: OpenMetadataLineageConfig
) -> PipelineService:
    """
    Check if we already have the airflow instance as a PipelineService,
    otherwise create it.

    :param operator: task from which we extract the lineage
    :param client: OpenMetadata API wrapper
    :param config: lineage config
    :return: PipelineService
    """
    operator.log.info("Get Airflow Service ID")
    airflow_service_entity = client.get_by_name(
        entity=PipelineService, fqdn=config.airflow_service_name
    )

    if airflow_service_entity is None:
        pipeline_service = CreatePipelineServiceRequest(
            name=config.airflow_service_name,
            serviceType=PipelineServiceType.Airflow,
            pipelineUrl=conf.get("webserver", "base_url"),
        )
        airflow_service_entity = client.create_or_update(pipeline_service)
        operator.log.info("Created airflow service entity {}", airflow_service_entity)

    return airflow_service_entity
