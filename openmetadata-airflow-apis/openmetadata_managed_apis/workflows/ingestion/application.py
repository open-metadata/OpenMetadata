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
Generic Workflow entrypoint to execute Applications
"""
import json

from airflow import DAG
from openmetadata_managed_apis.utils.logger import set_operator_logger
from openmetadata_managed_apis.workflows.ingestion.common import (
    build_dag,
    build_workflow_config_property,
)

from metadata.generated.schema.entity.applications.configuration.applicationConfig import (
    AppConfig,
    PrivateConfig,
)
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)
from metadata.generated.schema.metadataIngestion.application import (
    OpenMetadataApplicationConfig,
)
from metadata.generated.schema.metadataIngestion.applicationPipeline import (
    ApplicationPipeline,
)
from metadata.workflow.application import ApplicationWorkflow


def application_workflow(workflow_config: OpenMetadataApplicationConfig):
    """
    Task that creates and runs the ingestion workflow.

    The workflow_config gets cooked form the incoming
    ingestionPipeline.

    This is the callable used to create the PythonOperator
    """

    set_operator_logger(workflow_config)

    config = json.loads(workflow_config.model_dump_json(exclude_defaults=False))
    workflow = ApplicationWorkflow.create(config)

    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


def build_application_workflow_config(
    ingestion_pipeline: IngestionPipeline,
) -> OpenMetadataApplicationConfig:
    """
    Given an airflow_pipeline, prepare the workflow config JSON
    """

    # Here we have an application pipeline, so the Source Config is of type ApplicationPipeline
    application_pipeline_conf: ApplicationPipeline = (
        ingestion_pipeline.sourceConfig.config
    )

    application_workflow_config = OpenMetadataApplicationConfig(
        sourcePythonClass=application_pipeline_conf.sourcePythonClass,
        # We pass the generic class and let each app cast the actual object
        appConfig=AppConfig(
            root=application_pipeline_conf.appConfig.root,
        )
        if application_pipeline_conf.appConfig
        else None,
        appPrivateConfig=PrivateConfig(
            root=application_pipeline_conf.appPrivateConfig.root
        )
        if application_pipeline_conf.appPrivateConfig
        else None,
        workflowConfig=build_workflow_config_property(ingestion_pipeline),
        ingestionPipelineFQN=ingestion_pipeline.fullyQualifiedName.root,
    )

    return application_workflow_config


def build_application_dag(ingestion_pipeline: IngestionPipeline) -> DAG:
    """
    Build a simple metadata workflow DAG
    """
    application_workflow_config = build_application_workflow_config(ingestion_pipeline)
    dag = build_dag(
        task_name="application_task",
        ingestion_pipeline=ingestion_pipeline,
        workflow_config=application_workflow_config,
        workflow_fn=application_workflow,
    )

    return dag
