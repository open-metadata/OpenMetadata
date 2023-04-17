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
Data Insights DAG function builder
"""
import json

from airflow import DAG
from openmetadata_managed_apis.utils.logger import set_operator_logger
from openmetadata_managed_apis.workflows.ingestion.common import (
    ClientInitializationError,
    build_dag,
)
from openmetadata_managed_apis.workflows.ingestion.elasticsearch_sink import (
    build_elasticsearch_sink,
)

from metadata.data_insight.api.workflow import DataInsightWorkflow
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)
from metadata.generated.schema.entity.services.metadataService import MetadataService
from metadata.generated.schema.metadataIngestion.workflow import (
    LogLevels,
    OpenMetadataWorkflowConfig,
    Processor,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    SourceConfig,
    WorkflowConfig,
)
from metadata.ingestion.models.encoders import show_secrets_encoder
from metadata.ingestion.ometa.ometa_api import OpenMetadata


def data_insight_workflow(workflow_config: OpenMetadataWorkflowConfig):
    """Task that creates and runs the data insight workflow.

    The workflow_config gets created form the incoming
    ingestionPipeline.

    This is the callable used to create the PythonOperator

    Args:
        workflow_config (OpenMetadataWorkflowConfig): _description_
    """
    set_operator_logger(workflow_config)

    config = json.loads(workflow_config.json(encoder=show_secrets_encoder))
    workflow = DataInsightWorkflow.create(config)

    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


def build_data_insight_workflow_config(
    ingestion_pipeline: IngestionPipeline,
) -> OpenMetadataWorkflowConfig:
    """
    Given an airflow_pipeline, prepare the workflow config JSON
    """

    try:
        metadata = OpenMetadata(config=ingestion_pipeline.openMetadataServerConnection)
    except Exception as exc:
        raise ClientInitializationError(f"Failed to initialize the client: {exc}")

    openmetadata_service = metadata.get_by_name(
        entity=MetadataService, fqn=ingestion_pipeline.service.fullyQualifiedName
    )

    if not openmetadata_service:
        raise ValueError(
            "Could not retrieve the OpenMetadata service! This should not happen."
        )

    sink = build_elasticsearch_sink(
        openmetadata_service.connection.config, ingestion_pipeline
    )

    workflow_config = OpenMetadataWorkflowConfig(
        source=WorkflowSource(
            type="dataInsight",
            serviceName=ingestion_pipeline.service.name,
            sourceConfig=SourceConfig(),  # Source Config not needed here. Configs are passed to ES Sink.
        ),
        sink=sink,
        processor=Processor(
            type="data-insight-processor",
            config={},
        ),
        workflowConfig=WorkflowConfig(
            loggerLevel=ingestion_pipeline.loggerLevel or LogLevels.INFO,
            openMetadataServerConfig=ingestion_pipeline.openMetadataServerConnection,
        ),
        ingestionPipelineFQN=ingestion_pipeline.fullyQualifiedName.__root__,
    )

    return workflow_config


def build_data_insight_dag(ingestion_pipeline: IngestionPipeline) -> DAG:
    """Build a simple Data Insight DAG"""
    workflow_config = build_data_insight_workflow_config(ingestion_pipeline)
    dag = build_dag(
        task_name="data_insight_task",
        ingestion_pipeline=ingestion_pipeline,
        workflow_config=workflow_config,
        workflow_fn=data_insight_workflow,
    )

    return dag
