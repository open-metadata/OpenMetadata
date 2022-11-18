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
ElasticSearch reindex DAG function builder
"""
from airflow import DAG
from openmetadata_managed_apis.workflows.ingestion.common import (
    ClientInitializationError,
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
from metadata.generated.schema.metadataIngestion.workflow import (
    SourceConfig,
    WorkflowConfig,
)
from metadata.generated.schema.type.basic import ComponentConfig
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
        raise ValueError(
            "Could not retrieve the OpenMetadata service! This should not happen."
        )

    om_service_elasticsearch_dict = {
        key: value
        for key, value in openmetadata_service.connection.config.elasticsSearch.config.dict().items()
        if value
    }

    ingestion_pipeline_elasticsearch_source_config = {
        key: value
        for key, value in ingestion_pipeline.sourceConfig.config.dict().items()
        if value and key != "type"
    }

    workflow_config = OpenMetadataWorkflowConfig(
        source=WorkflowSource(
            type="metadata_elasticsearch",
            serviceName=ingestion_pipeline.service.fullyQualifiedName,
            serviceConnection=MetadataConnection(config=MetadataESConnection()),
            sourceConfig=SourceConfig(),
        ),
        sink=Sink(
            type="elasticsearch",
            config=ComponentConfig(
                **om_service_elasticsearch_dict,
                **ingestion_pipeline_elasticsearch_source_config,
            ),
        ),
        workflowConfig=WorkflowConfig(
            loggerLevel=ingestion_pipeline.loggerLevel or LogLevels.INFO,
            openMetadataServerConfig=ingestion_pipeline.openMetadataServerConnection,
        ),
        ingestionPipelineFQN=ingestion_pipeline.fullyQualifiedName.__root__,
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
