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
Metadata DAG common functions
"""
import json
from datetime import datetime
from typing import Any, Dict

from airflow import DAG

from metadata.generated.schema.type import basic

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from airflow_provider_openmetadata.lineage.callback import (
    failure_callback,
    success_callback,
)
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.workflow import Workflow


def metadata_ingestion_workflow(workflow_config: OpenMetadataWorkflowConfig):
    """
    Task that creates and runs the ingestion workflow.

    The workflow_config gets cooked form the incoming
    airflow_pipeline.

    This is the callable used to create the PythonOperator
    """
    config = json.loads(workflow_config.json())

    workflow = Workflow.create(config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


def get_start_date(ingestion_pipeline: IngestionPipeline) -> datetime:
    """
    Prepare the DAG start_date based on the incoming
    airflowPipeline payload from the OM server
    """
    basic_date: basic.Date = ingestion_pipeline.airflowConfig.startDate

    return datetime.strptime(str(basic_date.__root__), "%Y-%m-%d")


def build_default_args() -> Dict[str, Any]:
    """
    Build the default_args dict to be passed
    to the DAG regardless of the airflow_pipeline
    payload.
    """
    return {
        # Run the lineage backend callbacks to gather the Pipeline info
        "on_failure_callback": failure_callback,
        "on_success_callback": success_callback,
    }


def build_ingestion_dag(
    task_name: str,
    ingestion_pipeline: IngestionPipeline,
    workflow_config: Dict[str, Any],
) -> DAG:
    """
    Build a simple metadata workflow DAG
    """

    with DAG(
        dag_id=ingestion_pipeline.name.__root__,
        default_args=build_default_args(),
        description=ingestion_pipeline.description,
        start_date=get_start_date(ingestion_pipeline),
        is_paused_upon_creation=ingestion_pipeline.airflowConfig.pausePipeline or False,
        catchup=ingestion_pipeline.airflowConfig.pipelineCatchup or False,
    ) as dag:

        PythonOperator(
            task_id=task_name,
            python_callable=metadata_ingestion_workflow,
            op_kwargs={"workflow_config": workflow_config},
        )

        return dag
