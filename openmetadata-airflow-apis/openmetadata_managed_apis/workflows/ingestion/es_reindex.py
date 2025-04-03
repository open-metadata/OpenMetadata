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
ElasticSearch reindex DAG function builder
"""
from airflow import DAG
from openmetadata_managed_apis.workflows.ingestion.common import (
    ClientInitializationError,
    GetServiceException,
    build_dag,
    metadata_ingestion_workflow,
)

from metadata.generated.schema.entity.services.connections.metadata.metadataESConnection import (
    MetadataESConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)
from metadata.generated.schema.entity.services.metadataService import (
    MetadataConnection,
    MetadataService,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    LogLevels,
    OpenMetadataWorkflowConfig,
    Sink,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.metadataIngestion.workflow import WorkflowConfig
from metadata.ingestion.ometa.ometa_api import OpenMetadata


def build_es_reindex_workflow_config(
    ingestion_pipeline: IngestionPipeline,
) -> OpenMetadataWorkflowConfig:
    """
    Given an airflow_pipeline, prepare the workflow config JSON
    """

    try:
        metadata = OpenMetadata(config=ingestion_pipeline.openMetadataServerConnection)
    except Exception as exc:
        raise ClientInitializationError(f"Failed to initialize the client: {exc}")

    openmetadata_service: MetadataService = metadata.get_by_name(
        entity=MetadataService, fqn=ingestion_pipeline.service.fullyQualifiedName
    )
    if not openmetadata_service:
        raise GetServiceException(service_type="metadata", service_name="OpenMetadata")

    sink = Sink(type="metadata-rest", config={})

    workflow_config = OpenMetadataWorkflowConfig(
        source=WorkflowSource(
            type="metadata_elasticsearch",
            serviceName=ingestion_pipeline.service.fullyQualifiedName,
            serviceConnection=MetadataConnection(config=MetadataESConnection()),
            sourceConfig=ingestion_pipeline.sourceConfig,
        ),
        sink=sink,
        workflowConfig=WorkflowConfig(
            loggerLevel=ingestion_pipeline.loggerLevel or LogLevels.INFO,
            openMetadataServerConfig=ingestion_pipeline.openMetadataServerConnection,
        ),
        ingestionPipelineFQN=ingestion_pipeline.fullyQualifiedName.root,
    )

    return workflow_config


def build_es_reindex_dag(ingestion_pipeline: IngestionPipeline) -> DAG:
    """Build a simple Data Insight DAG"""
    workflow_config = build_es_reindex_workflow_config(ingestion_pipeline)
    dag = build_dag(
        task_name="elasticsearch_reindex_task",
        ingestion_pipeline=ingestion_pipeline,
        workflow_config=workflow_config,
        workflow_fn=metadata_ingestion_workflow,
    )

    return dag
