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


from airflow import DAG
from openmetadata.workflows.ingestion.common import (
    build_dag,
    build_workflow_config_property,
    metadata_ingestion_workflow,
)

from metadata.generated.schema.metadataIngestion.workflow import (
    BulkSink,
    OpenMetadataWorkflowConfig,
    Processor,
    Stage,
)

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

import tempfile

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)


def build_usage_workflow_config(
    ingestion_pipeline: IngestionPipeline,
) -> OpenMetadataWorkflowConfig:
    """
    Given an airflow_pipeline, prepare the workflow config JSON
    """

    usage_source = ingestion_pipeline.source
    usage_source.type = f"{usage_source.type}-usage"

    with tempfile.NamedTemporaryFile() as tmp_file:

        workflow_config = OpenMetadataWorkflowConfig(
            source=usage_source,
            processor=Processor(type="query-parser", config={"filter": ""}),
            stage=Stage(type="table-usage", config={"filename": tmp_file.name}),
            bulkSink=BulkSink(
                type="metadata-usage", config={"filename": tmp_file.name}
            ),
            workflowConfig=build_workflow_config_property(ingestion_pipeline),
        )

    return workflow_config


def build_usage_dag(airflow_pipeline: IngestionPipeline) -> DAG:
    """
    Build a simple metadata workflow DAG
    """
    workflow_config = build_usage_workflow_config(airflow_pipeline)
    dag = build_dag(
        task_name="usage_task",
        ingestion_pipeline=airflow_pipeline,
        workflow_config=workflow_config,
        workflow_fn=metadata_ingestion_workflow,
    )

    return dag
