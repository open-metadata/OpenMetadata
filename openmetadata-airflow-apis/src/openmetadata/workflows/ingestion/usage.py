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
Metadata DAG function builder
"""

from typing import Any, Dict

from airflow import DAG
from openmetadata.workflows.ingestion.common import build_ingestion_dag

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)


def build_usage_workflow_config(airflow_pipeline: IngestionPipeline) -> Dict[str, Any]:
    """
    Given an airflow_pipeline, prepare the workflow config JSON
    """
    ...


def build_usage_dag(airflow_pipeline: IngestionPipeline) -> DAG:
    """
    Build a simple metadata workflow DAG
    """
    workflow_config = build_usage_workflow_config(airflow_pipeline)
    dag = build_ingestion_dag(
        task_name="usage_task",
        ingestion_pipeline=airflow_pipeline,
        workflow_config=workflow_config,
    )

    return dag
