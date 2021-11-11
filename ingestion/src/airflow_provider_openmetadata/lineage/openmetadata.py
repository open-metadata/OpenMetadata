import json
import traceback
from typing import TYPE_CHECKING, Dict, List, Optional

import dateutil
from airflow.configuration import conf
from airflow.lineage.backend import LineageBackend

from metadata.generated.schema.api.data.createPipeline import (
    CreatePipelineEntityRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineage
from metadata.generated.schema.api.services.createPipelineService import (
    CreatePipelineServiceEntityRequest,
)
from metadata.generated.schema.entity.data.pipeline import Task
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.utils.helpers import convert_epoch_to_iso

if TYPE_CHECKING:
    from airflow import DAG
    from airflow.models.baseoperator import BaseOperator

from metadata.config.common import ConfigModel


class OpenMetadataLineageConfig(ConfigModel):
    airflow_service_name: str = "airflow"
    api_endpoint: str = "http://localhost:8585"
    auth_provider_type: str = "no-auth"
    secret_key: str = None


def get_lineage_config() -> OpenMetadataLineageConfig:
    """Load the lineage config from airflow_provider_openmetadata.cfg."""
    airflow_service_name = conf.get(
        "lineage", "airflow_service_name", fallback="airflow"
    )
    api_endpoint = conf.get(
        "lineage", "openmetadata_api_endpoint", fallback="http://localhost:8585"
    )
    auth_provider_type = conf.get("lineage", "auth_provider_type", fallback="no-auth")
    secret_key = conf.get("lineage", "secret_key", fallback=None)
    return OpenMetadataLineageConfig.parse_obj(
        {
            "airflow_service_name": airflow_service_name,
            "api_endpoint": api_endpoint,
            "auth_provider_type": auth_provider_type,
            "secret_key": secret_key,
        }
    )


allowed_task_keys = [
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
]
allowed_flow_keys = [
    "_access_control",
    "_concurrency",
    "_default_view",
    "catchup",
    "fileloc",
    "is_paused_upon_creation",
    "start_date",
    "tags",
    "timezone",
]


def parse_lineage_to_openmetadata(
    config: OpenMetadataLineageConfig,
    context: Dict,
    operator: "BaseOperator",
    inlets: List,
    outlets: List,
    client: OpenMetadata,
):
    import ast

    from airflow.serialization.serialized_objects import (
        SerializedBaseOperator,
        SerializedDAG,
    )

    operator.log.info("Parsing Lineage for OpenMetadata")
    dag: "DAG" = context["dag"]
    task: BaseOperator = context["task"]

    pipeline_service_url = conf.get("webserver", "base_url")
    dag_url = f"{pipeline_service_url}/tree?dag_id={dag.dag_id}"
    task_url = f"{pipeline_service_url}/taskinstance/list/?flt1_dag_id_equals={dag.dag_id}&_flt_3_task_id={task.task_id}"

    dag_properties: Dict[str, str] = {
        key: repr(value) for (key, value) in SerializedDAG.serialize_dag(dag).items()
    }
    for key in dag.get_serialized_fields():
        if key not in dag_properties:
            dag_properties[key] = repr(getattr(dag, key))
    task_properties: Dict[str, str] = {
        key: repr(value)
        for (key, value) in SerializedBaseOperator.serialize_operator(task).items()
    }
    for key in task.get_serialized_fields():
        if key not in task_properties:
            task_properties[key] = repr(getattr(task, key))

    task_properties = {
        k: v for (k, v) in task_properties.items() if k in allowed_task_keys
    }

    dag_properties = {
        k: v for (k, v) in dag_properties.items() if k in allowed_flow_keys
    }

    operator.log.info("Task Properties {}".format(task_properties))
    operator.log.info("DAG properties {}".format(dag_properties))
    # operator.log.info("Pipeline Context {}".format(context))

    timestamp = int(dateutil.parser.parse(context["ts"]).timestamp() * 1000)
    owner = dag.owner
    tags = dag.tags
    airflow_service_entity = None
    operator.log.info("Get Airflow Service ID")
    airflow_service_entity = client.get_by_name(
        entity=PipelineService, fqdn=config.airflow_service_name
    )
    if airflow_service_entity is None:
        pipeline_service = CreatePipelineServiceEntityRequest(
            name=config.airflow_service_name,
            serviceType=PipelineServiceType.Airflow,
            pipelineUrl=pipeline_service_url,
        )
        airflow_service_entity = client.create_or_update(pipeline_service)

    operator.log.info("airflow service entity {}", airflow_service_entity)
    operator.log.info(task_properties)
    operator.log.info(dag_properties)
    downstream_tasks = []
    dag_start_date = convert_epoch_to_iso(int(float(dag_properties["start_date"])))

    if "_downstream_task_ids" in task_properties:
        downstream_tasks = ast.literal_eval(task_properties["_downstream_task_ids"])

    operator.log.info("downstream tasks {}".format(downstream_tasks))
    task_start_date = (
        task_properties["start_date"].isoformat()
        if "start_time" in task_properties
        else None
    )
    task_end_date = (
        task_properties["end_date"].isoformat()
        if "end_time" in task_properties
        else None
    )

    task = Task(
        name=task_properties["task_id"],
        displayName=task_properties["label"],
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
        tasks=[task],
        service=EntityReference(id=airflow_service_entity.id, type="pipelineService"),
    )
    pipeline = client.create_or_update(create_pipeline)
    operator.log.info("Create Pipeline {}".format(pipeline))

    operator.log.info("Parsing Lineage")
    for table in inlets:
        table_entity = client.get_by_name(entity=Table, fqdn=table.fullyQualifiedName)
        operator.log.debug("from entity {}".format(table_entity))
        lineage = AddLineage(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=table_entity.id, type="table"),
                toEntity=EntityReference(id=pipeline.id, type="pipeline"),
            )
        )
        operator.log.debug("from lineage {}".format(lineage))
        client.add_lineage(lineage)

    for table in outlets:
        table_entity = client.get_by_name(entity=Table, fqdn=table.fullyQualifiedName)
        operator.log.debug("to entity {}".format(table_entity))
        lineage = AddLineage(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=pipeline.id, type="pipeline"),
                toEntity=EntityReference(id=table_entity.id, type="table"),
            )
        )
        operator.log.debug("to lineage {}".format(lineage))
        client.add_lineage(lineage)


def is_airflow_version_1() -> bool:
    try:
        from airflow.hooks.base import BaseHook

        return False
    except ModuleNotFoundError:
        from airflow.hooks.base_hook import BaseHook

        return True


class OpenMetadataLineageBackend(LineageBackend):
    """
    Sends lineage data from tasks to OpenMetadata.
    Configurable via ``airflow_provider_openmetadata.cfg`` as follows: ::
    [lineage]
    backend = airflow_provider_openmetadata.lineage.OpenMetadataLineageBackend
    airflow_service_name = airflow #make sure this service_name matches the one configured in openMetadata
    openmetadata_api_endpoint = http://localhost:8585
    auth_provider_type = no-auth # use google here if you are configuring google as SSO
    secret_key = google-client-secret-key # it needs to be configured only if you are using google as SSO
    """

    def __init__(self) -> None:
        super().__init__()
        _ = get_lineage_config()

    @staticmethod
    def send_lineage(
        operator: "BaseOperator",
        inlets: Optional[List] = None,
        outlets: Optional[List] = None,
        context: Dict = None,
    ) -> None:

        try:
            config = get_lineage_config()
            metadata_config = MetadataServerConfig.parse_obj(
                {
                    "api_endpoint": config.api_endpoint,
                    "auth_provider_type": config.auth_provider_type,
                    "secret_key": config.secret_key,
                }
            )
            client = OpenMetadata(metadata_config)
            op_inlets = []
            op_outlets = []
            if (
                isinstance(operator._inlets, list)
                and len(operator._inlets) == 1
                and isinstance(operator._inlets[0], dict)
                and not is_airflow_version_1()
            ):
                op_inlets = operator._inlets[0].get("tables", [])

            if (
                isinstance(operator._outlets, list)
                and len(operator._outlets) == 1
                and isinstance(operator._outlets[0], dict)
                and not is_airflow_version_1()
            ):
                op_outlets = operator._outlets[0].get("tables", [])
            if len(op_inlets) == 0 and len(operator.inlets) != 0:
                op_inlets = operator.inlets
            if len(op_outlets) == 0 and len(operator.outlets) != 0:
                op_outlets = operator.outlets

            parse_lineage_to_openmetadata(
                config, context, operator, op_inlets, op_outlets, client
            )
        except Exception as e:
            operator.log.error(traceback.format_exc())
            operator.log.error(e)
