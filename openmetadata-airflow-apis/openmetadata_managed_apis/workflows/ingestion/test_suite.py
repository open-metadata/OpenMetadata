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
testSuite DAG function builder
"""

from airflow import DAG
from openmetadata_managed_apis.workflows.ingestion.common import (
    build_dag,
    build_source,
    test_suite_workflow,
)

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


def build_test_suite_workflow_config(
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
            type="orm-test-runner",
            config={},
        ),
        workflowConfig=WorkflowConfig(
            loggerLevel=ingestion_pipeline.loggerLevel or LogLevels.INFO,
            openMetadataServerConfig=ingestion_pipeline.openMetadataServerConnection,
        ),
    )

    return workflow_config


def build_test_suite_dag(ingestion_pipeline: IngestionPipeline) -> DAG:
    """Build a simple testSuite DAG"""
    workflow_config = build_test_suite_workflow_config(ingestion_pipeline)
    dag = build_dag(
        task_name="test_suite_task",
        ingestion_pipeline=ingestion_pipeline,
        workflow_config=workflow_config,
        workflow_fn=test_suite_workflow,
    )

    return dag
