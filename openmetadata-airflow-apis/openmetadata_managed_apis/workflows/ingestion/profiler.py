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
Profiler DAG function builder
"""
import json

from airflow import DAG
from openmetadata_managed_apis.workflows.ingestion.common import build_dag, build_source

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    LogLevels,
    OpenMetadataWorkflowConfig,
    Processor,
    Sink,
    WorkflowConfig,
)
from metadata.ingestion.models.encoders import show_secrets_encoder
from metadata.orm_profiler.api.workflow import ProfilerWorkflow
from metadata.utils.logger import set_loggers_level


def profiler_workflow(workflow_config: OpenMetadataWorkflowConfig):
    """
    Task that creates and runs the profiler workflow.

    The workflow_config gets cooked form the incoming
    ingestionPipeline.

    This is the callable used to create the PythonOperator
    """

    set_loggers_level(workflow_config.workflowConfig.loggerLevel.value)

    config = json.loads(workflow_config.json(encoder=show_secrets_encoder))
    workflow = ProfilerWorkflow.create(config)

    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


def build_profiler_workflow_config(
    ingestion_pipeline: IngestionPipeline,
) -> OpenMetadataWorkflowConfig:
    """
    Given an airflow_pipeline, prepare the workflow config JSON
    """
    workflow_config = OpenMetadataWorkflowConfig(
        source=build_source(ingestion_pipeline),
        sink=Sink(
            type="metadata-rest",
            config={},
        ),
        processor=Processor(
            type="orm-profiler",
            config={},
        ),
        workflowConfig=WorkflowConfig(
            loggerLevel=ingestion_pipeline.loggerLevel or LogLevels.INFO,
            openMetadataServerConfig=ingestion_pipeline.openMetadataServerConnection,
        ),
        ingestionPipelineFQN=ingestion_pipeline.fullyQualifiedName.__root__,
    )

    return workflow_config


def build_profiler_dag(ingestion_pipeline: IngestionPipeline) -> DAG:
    """
    Build a simple metadata workflow DAG
    """
    workflow_config = build_profiler_workflow_config(ingestion_pipeline)
    dag = build_dag(
        task_name="profiler_task",
        ingestion_pipeline=ingestion_pipeline,
        workflow_config=workflow_config,
        workflow_fn=profiler_workflow,
    )

    return dag
