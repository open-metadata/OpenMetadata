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
Metadata DAG common functions
"""
import json
from datetime import datetime, timedelta
from typing import Callable, Optional

from airflow import DAG

from metadata.generated.schema.type import basic
from metadata.ingestion.models.encoders import show_secrets_encoder
from metadata.orm_profiler.api.workflow import ProfilerWorkflow
from metadata.utils.logger import set_loggers_level

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    LogLevels,
    OpenMetadataWorkflowConfig,
    WorkflowConfig,
)
from metadata.ingestion.api.workflow import Workflow


def metadata_ingestion_workflow(workflow_config: OpenMetadataWorkflowConfig):
    """
    Task that creates and runs the ingestion workflow.

    The workflow_config gets cooked form the incoming
    ingestionPipeline.

    This is the callable used to create the PythonOperator
    """
    set_loggers_level(workflow_config.workflowConfig.loggerLevel.value)

    config = json.loads(workflow_config.json(encoder=show_secrets_encoder))

    workflow = Workflow.create(config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


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


def date_to_datetime(
    date: Optional[basic.Date], date_format: str = "%Y-%m-%d"
) -> Optional[datetime]:
    """
    Format a basic.Date to datetime
    """
    if date is None:
        return

    return datetime.strptime(str(date.__root__), date_format)


def build_workflow_config_property(
    ingestion_pipeline: IngestionPipeline,
) -> WorkflowConfig:
    """
    Prepare the workflow config with logLevels and openMetadataServerConfig
    :param ingestion_pipeline: Received payload from REST
    :return: WorkflowConfig
    """
    return WorkflowConfig(
        loggerLevel=ingestion_pipeline.loggerLevel or LogLevels.INFO,
        openMetadataServerConfig=ingestion_pipeline.openMetadataServerConnection,
    )


def build_dag_configs(ingestion_pipeline: IngestionPipeline) -> dict:
    """
    Prepare kwargs to send to DAG
    :param ingestion_pipeline: pipeline configs
    :return: dict to use as kwargs
    """
    return {
        "dag_id": ingestion_pipeline.name.__root__,
        "description": ingestion_pipeline.description,
        "start_date": date_to_datetime(ingestion_pipeline.airflowConfig.startDate),
        "end_date": date_to_datetime(ingestion_pipeline.airflowConfig.endDate),
        "concurrency": ingestion_pipeline.airflowConfig.concurrency,
        "max_active_runs": ingestion_pipeline.airflowConfig.maxActiveRuns,
        "default_view": ingestion_pipeline.airflowConfig.workflowDefaultView,
        "orientation": ingestion_pipeline.airflowConfig.workflowDefaultViewOrientation,
        "dagrun_timeout": timedelta(ingestion_pipeline.airflowConfig.workflowTimeout)
        if ingestion_pipeline.airflowConfig.workflowTimeout
        else None,
        "is_paused_upon_creation": ingestion_pipeline.airflowConfig.pausePipeline
        or False,
        "catchup": ingestion_pipeline.airflowConfig.pipelineCatchup or False,
        "schedule_interval": ingestion_pipeline.airflowConfig.scheduleInterval,
    }


def build_dag(
    task_name: str,
    ingestion_pipeline: IngestionPipeline,
    workflow_config: OpenMetadataWorkflowConfig,
    workflow_fn: Callable,
) -> DAG:
    """
    Build a simple metadata workflow DAG
    """

    with DAG(**build_dag_configs(ingestion_pipeline)) as dag:

        PythonOperator(
            task_id=task_name,
            python_callable=workflow_fn,
            op_kwargs={"workflow_config": workflow_config},
            retries=ingestion_pipeline.airflowConfig.retries,
            retry_delay=ingestion_pipeline.airflowConfig.retryDelay,
        )

        return dag
