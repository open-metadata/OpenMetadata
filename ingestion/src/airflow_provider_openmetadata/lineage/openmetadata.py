import json
from typing import TYPE_CHECKING, Dict, List, Optional

import dateutil
from airflow.configuration import conf
from airflow.lineage.backend import LineageBackend

if TYPE_CHECKING:
    from airflow import DAG
    from airflow.models.baseoperator import BaseOperator

from metadata.config.common import ConfigModel


class OpenMetadataLineageConfig(ConfigModel):
    openmetadata_conn_id: str = "openmetadata_api_default"


def get_lineage_config() -> OpenMetadataLineageConfig:
    """Load the lineage config from airflow_provider_openmetadata.cfg."""

    openmetadata_conn_id = conf.get("lineage", "openmetadata_conn_id", fallback=None)
    return OpenMetadataLineageConfig.parse_obj({'openmetadata_conn_id': openmetadata_conn_id})


def parse_lineage_to_openmetadata(config: OpenMetadataLineageConfig,
                                  context: Dict,
                                  operator: "BaseOperator",
                                  inlets: List,
                                  outlets: List):
    from airflow.serialization.serialized_objects import (
        SerializedBaseOperator,
        SerializedDAG,
    )
    operator.log.info("Parsing Lineage for OpenMetadata")
    dag: DAG = context["dag"]
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
    job_property_bag = {
        k: v for (k, v) in task_properties.items() if k in allowed_task_keys
    }
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
    flow_property_bag = {
        k: v for (k, v) in dag_properties.items() if k in allowed_flow_keys
    }

    timestamp = int(dateutil.parser.parse(context["ts"]).timestamp() * 1000)
    owner = dag.owner
    tags = dag.tags
    operator.log.info("OpenMetadata logging")
    operator.log.info(flow_property_bag)
    operator.log.info(task_url)
    operator.log.info(owner)
    operator.log.info(tags)
    operator.log.info(job_property_bag)

class OpenMetadataLineageBackend(LineageBackend):
    """
        Sends lineage data from tasks to OpenMetadata.
        Configurable via ``airflow_provider_openmetadata.cfg`` as follows: ::
            # For REST-based:
            airflow_provider_openmetadata connections add  --conn-type 'openmetadata_api' 'openmetadata_api_default' --conn-host 'http://localhost:8585'
            [lineage]
            backend = airflow_provider_openmetadata.lineage.OpenMetadataLineageBackend
            openmetadata_conn_id = "openmetadata_api_default"
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
        config = get_lineage_config()

        try:
            parse_lineage_to_openmetadata(
                config, context, operator, operator.inlets, operator.outlets
            )
        except Exception as e:
            if config.graceful_exceptions:
                operator.log.error(e)
                operator.log.info("Supressing error because graceful_exceptions is set")
            else:
                raise




