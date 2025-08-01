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
OpenMetadata Airflow Lineage Backend
"""
import logging
import traceback
from typing import TYPE_CHECKING, Dict

from airflow_provider_openmetadata.lineage.config.loader import get_lineage_config
from airflow_provider_openmetadata.lineage.status import add_status
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.ingestion.ometa.ometa_api import OpenMetadata

if TYPE_CHECKING:
    from airflow.models.baseoperator import BaseOperator


def failure_callback(context: Dict[str, str]) -> None:
    """
    Add this function to the args of your DAG or Task
    as the value of `on_failure_callback` to track
    task status and lineage on failures.

    :param context: Airflow runtime context
    """
    try:
        config = get_lineage_config()
        metadata = OpenMetadata(config.metadata_config)

        operator: "BaseOperator" = context["task"]
        dag: "DAG" = context["dag"]

        operator.log.info("Updating pipeline status on error...")

        airflow_service_entity: PipelineService = metadata.get_by_name(
            entity=PipelineService, fqn=config.airflow_service_name
        )
        pipeline: Pipeline = metadata.get_by_name(
            entity=Pipeline,
            fqn=f"{airflow_service_entity.name.root}.{dag.dag_id}",
        )

        if pipeline:
            add_status(
                operator=operator,
                pipeline=pipeline,
                metadata=metadata,
                context=context,
            )
        else:
            logging.warning(
                f"Pipeline {airflow_service_entity.name.root}.{dag.dag_id} not found. Skipping status update."
            )

    except Exception as exc:  # pylint: disable=broad-except
        logging.error(traceback.format_exc())
        logging.error("Lineage Callback exception %s", exc)


def success_callback(context: Dict[str, str]) -> None:
    """
    Add this function to the args of your DAG or Task
    as the value of `on_success_callback` to track
    task status on task success

    :param context: Airflow runtime context
    """
    try:
        config = get_lineage_config()
        metadata = OpenMetadata(config.metadata_config)

        operator: "BaseOperator" = context["task"]
        dag: "DAG" = context["dag"]

        operator.log.info("Updating pipeline status on success...")

        airflow_service_entity: PipelineService = metadata.get_by_name(
            entity=PipelineService, fqn=config.airflow_service_name
        )
        pipeline: Pipeline = metadata.get_by_name(
            entity=Pipeline,
            fqn=f"{airflow_service_entity.name.root}.{dag.dag_id}",
        )

        add_status(
            operator=operator,
            pipeline=pipeline,
            metadata=metadata,
            context=context,
        )

    except Exception as exc:  # pylint: disable=broad-except
        logging.error(traceback.format_exc())
        logging.error("Lineage Callback exception %s", exc)
