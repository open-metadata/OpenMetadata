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
Metadata DAG function builder
"""
import json
import tempfile

from airflow import DAG
from openmetadata_managed_apis.utils.logger import set_operator_logger
from openmetadata_managed_apis.workflows.ingestion.common import (
    build_dag,
    build_source,
    build_workflow_config_property,
    execute_workflow,
)

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    BulkSink,
    OpenMetadataWorkflowConfig,
    Processor,
    Stage,
)
from metadata.workflow.usage import UsageWorkflow


def usage_workflow(
    workflow_config: OpenMetadataWorkflowConfig,
):
    """
    Task that creates and runs the ingestion workflow.

    The workflow_config gets cooked form the incoming
    ingestionPipeline.

    This is the callable used to create the PythonOperator
    """

    set_operator_logger(workflow_config)

    config = json.loads(
        workflow_config.model_dump_json(exclude_defaults=False, mask_secrets=False)
    )
    workflow = UsageWorkflow.create(config)
    execute_workflow(workflow, workflow_config)


def build_usage_config_from_file(
    ingestion_pipeline: IngestionPipeline, filename: str
) -> OpenMetadataWorkflowConfig:
    """
    Given a filename for the staging location, build
    the OpenMetadataWorkflowConfig
    :param ingestion_pipeline: IngestionPipeline with workflow info
    :param filename: staging location file
    :return: OpenMetadataWorkflowConfig
    """

    source = build_source(ingestion_pipeline)
    source.type = f"{source.type}-usage"  # Mark the source as usage

    return OpenMetadataWorkflowConfig(
        source=source,
        processor=Processor(type="query-parser", config={}),
        stage=Stage(
            type="table-usage",
            config={"filename": filename},
        ),
        bulkSink=BulkSink(
            type="metadata-usage",
            config={"filename": filename},
        ),
        workflowConfig=build_workflow_config_property(ingestion_pipeline),
        ingestionPipelineFQN=ingestion_pipeline.fullyQualifiedName.root,
    )


def build_usage_workflow_config(
    ingestion_pipeline: IngestionPipeline,
) -> OpenMetadataWorkflowConfig:
    """
    Given an airflow_pipeline, prepare the workflow config JSON
    """
    location = ingestion_pipeline.sourceConfig.config.stageFileLocation

    if not location:
        with tempfile.NamedTemporaryFile() as tmp_file:
            workflow_config = build_usage_config_from_file(ingestion_pipeline, tmp_file)

    else:
        workflow_config = build_usage_config_from_file(ingestion_pipeline, location)

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
        workflow_fn=usage_workflow,
    )

    return dag
