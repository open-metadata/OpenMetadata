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

from typing import cast

from airflow import DAG
from openmetadata_managed_apis.workflows.ingestion.common import (
    ClientInitializationError,
    build_dag,
    data_insight_workflow,
)

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)
from metadata.generated.schema.entity.services.metadataService import MetadataService
from metadata.generated.schema.metadataIngestion.workflow import (
    LogLevels,
    OpenMetadataWorkflowConfig,
    Processor,
    Sink,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.metadataIngestion.workflow import WorkflowConfig
from metadata.generated.schema.type.basic import ComponentConfig
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import ES_SOURCE_TO_ES_OBJ_ARGS


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

    elasticsearch_service_config_dict = (
        openmetadata_service.connection.config.elasticsSearch.config.dict()
    )

    elasticsearch_source_config_dict = {
        ES_SOURCE_TO_ES_OBJ_ARGS[key]: value
        for key, value in ingestion_pipeline.sourceConfig.config.dict().items()
        if value and key != "type"
    }

    sink = Sink(
        type="elasticsearch",
        config=ComponentConfig(
            **elasticsearch_service_config_dict,
            **elasticsearch_source_config_dict,
        ),
    )

    openmetadata_service = cast(MetadataService, openmetadata_service)

    workflow_config = OpenMetadataWorkflowConfig(
        source=WorkflowSource(
            type="dataInsight",
            serviceName=ingestion_pipeline.service.name,
            sourceConfig=ingestion_pipeline.sourceConfig,
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
