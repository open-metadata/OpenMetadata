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
from metadata.generated.schema.api.data.createPipeline import (
    CreatePipelineEntityRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineage
from metadata.generated.schema.api.services.createPipelineService import (
    CreatePipelineServiceEntityRequest,
)
from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
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

ALLOWED_TASK_KEYS = {
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

ALLOWED_FLOW_KEYS = {
    "_access_control",
    "_concurrency",
    "_default_view",
    "catchup",
    "fileloc",
    "is_paused_upon_creation",
    "start_date",
    "tags",
    "timezone",
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

    props: Dict[str, str] = {key: value for (key, value) in serializer(obj).items()}

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


def create_pipeline_entity(
    dag_properties: Dict[str, str],
    task_properties: Dict[str, str],
    operator: "BaseOperator",
    dag: "DAG",
    airflow_service_entity: PipelineService,
    client: OpenMetadata,
) -> Pipeline:
    """
    Prepare the upsert the pipeline entity with the given task

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
    create_pipeline = CreatePipelineEntityRequest(
        name=dag.dag_id,
        displayName=dag.dag_id,
        description=dag.description,
        pipelineUrl=dag_url,
        startDate=dag_start_date,
        tasks=[task],  # TODO: should we GET + append?
        service=EntityReference(id=airflow_service_entity.id, type="pipelineService"),
    )

    return client.create_or_update(create_pipeline)


def parse_lineage_to_openmetadata(
    config: OpenMetadataLineageConfig,
    context: Dict,
    operator: "BaseOperator",
    inlets: List,
    outlets: List,
    client: OpenMetadata,
) -> None:
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
    # Move this import to avoid circular import error when airflow parses the config
    # pylint: disable=import-outside-toplevel
    from airflow.serialization.serialized_objects import (
        SerializedBaseOperator,
        SerializedDAG,
    )

    operator.log.info("Parsing Lineage for OpenMetadata")
    dag: "DAG" = context["dag"]

    dag_properties = get_properties(dag, SerializedDAG.serialize_dag, ALLOWED_FLOW_KEYS)
    task_properties = get_properties(
        operator, SerializedBaseOperator.serialize_operator, ALLOWED_TASK_KEYS
    )

    operator.log.info(f"Task Properties {task_properties}")
    operator.log.info(f"DAG properties {dag_properties}")

    try:

        airflow_service_entity = get_or_create_pipeline_service(
            operator, client, config
        )
        pipeline = create_pipeline_entity(
            dag_properties,
            task_properties,
            operator,
            dag,
            airflow_service_entity,
            client,
        )

        operator.log.info("Parsing Lineage")
        for table in inlets if inlets else []:
            table_entity = client.get_by_name(entity=Table, fqdn=table)
            operator.log.debug(f"from entity {table_entity}")
            lineage = AddLineage(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=table_entity.id, type="table"),
                    toEntity=EntityReference(id=pipeline.id, type="pipeline"),
                )
            )
            operator.log.debug(f"from lineage {lineage}")
            client.add_lineage(lineage)

        for table in outlets if outlets else []:
            table_entity = client.get_by_name(entity=Table, fqdn=table)
            operator.log.debug(f"to entity {table_entity}")
            lineage = AddLineage(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=pipeline.id, type="pipeline"),
                    toEntity=EntityReference(id=table_entity.id, type="table"),
                )
            )
            operator.log.debug(f"to lineage {lineage}")
            client.add_lineage(lineage)

    except Exception as exc:  # pylint: disable=broad-except
        operator.log.error(
            f"Failed to parse Airflow DAG task and publish to OpenMetadata due to {exc}"
        )
        operator.log.error(traceback.format_exc())


def get_or_create_pipeline_service(
    operator: "BaseOperator", client: OpenMetadata, config: OpenMetadataLineageConfig
) -> PipelineService:
    """
    Check if we already have the airflow instance as a PipelineService,
    otherwise create it.

    :param operator: task from which we extract the lienage
    :param client: OpenMetadata API wrapper
    :param config: lineage config
    :return: PipelineService
    """
    operator.log.info("Get Airflow Service ID")
    airflow_service_entity = client.get_by_name(
        entity=PipelineService, fqdn=config.airflow_service_name
    )

    if airflow_service_entity is None:
        pipeline_service = CreatePipelineServiceEntityRequest(
            name=config.airflow_service_name,
            serviceType=PipelineServiceType.Airflow,
            pipelineUrl=conf.get("webserver", "base_url"),
        )
        airflow_service_entity = client.create_or_update(pipeline_service)
        operator.log.info("Created airflow service entity {}", airflow_service_entity)

    return airflow_service_entity
