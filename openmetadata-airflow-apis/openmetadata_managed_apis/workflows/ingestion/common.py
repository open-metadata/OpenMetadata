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
from typing import Callable, Optional, Union

import airflow
from airflow import DAG
from openmetadata_managed_apis.api.utils import clean_dag_id

from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.mlmodelService import MlModelService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.generated.schema.type import basic
from metadata.ingestion.models.encoders import show_secrets_encoder
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.orm_profiler.api.workflow import ProfilerWorkflow
from metadata.test_suite.api.workflow import TestSuiteWorkflow
from metadata.utils.logger import set_loggers_level

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from openmetadata_managed_apis.workflows.ingestion.credentials_builder import (
    build_secrets_manager_credentials,
)

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    LogLevels,
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.metadataIngestion.workflow import WorkflowConfig
from metadata.ingestion.api.workflow import Workflow


class InvalidServiceException(Exception):
    """
    Exception to be thrown when couldn't fetch the service from server
    """


class ClientInitializationError(Exception):
    """
    Exception to be thrown when couldn't initialize the Openmetadata Client
    """


def build_source(ingestion_pipeline: IngestionPipeline) -> WorkflowSource:
    """
    Use the service EntityReference to build the Source.
    Building the source dynamically helps us to not store any
    sensitive info.
    :param ingestion_pipeline: With the service ref
    :return: WorkflowSource
    """
    secrets_manager = (
        ingestion_pipeline.openMetadataServerConnection.secretsManagerProvider
    )
    ingestion_pipeline.openMetadataServerConnection.secretsManagerCredentials = (
        build_secrets_manager_credentials(secrets_manager)
    )

    try:
        metadata = OpenMetadata(config=ingestion_pipeline.openMetadataServerConnection)
    except Exception as exc:
        raise ClientInitializationError(f"Failed to initialize the client: {exc}")

    service_type = ingestion_pipeline.service.type
    service: Optional[
        Union[DatabaseService, MessagingService, PipelineService, DashboardService]
    ] = None

    if service_type == "testSuite":
        service = metadata.get_by_name(
            entity=TestSuite, fqn=ingestion_pipeline.service.name
        )  # check we are able to access OM server
        if not service:
            raise InvalidServiceException(
                f"Could not get service from type {service_type}"
            )
        return WorkflowSource(
            type=service_type,
            serviceName=ingestion_pipeline.service.name,
            sourceConfig=ingestion_pipeline.sourceConfig,
        )

    if service_type == "databaseService":
        service: DatabaseService = metadata.get_by_name(
            entity=DatabaseService, fqn=ingestion_pipeline.service.name
        )
    elif service_type == "pipelineService":
        service: PipelineService = metadata.get_by_name(
            entity=PipelineService, fqn=ingestion_pipeline.service.name
        )
    elif service_type == "dashboardService":
        service: DashboardService = metadata.get_by_name(
            entity=DashboardService, fqn=ingestion_pipeline.service.name
        )
    elif service_type == "messagingService":
        service: MessagingService = metadata.get_by_name(
            entity=MessagingService, fqn=ingestion_pipeline.service.name
        )
    elif service_type == "mlmodelService":
        service: MlModelService = metadata.get_by_name(
            entity=MlModelService, fqn=ingestion_pipeline.service.name
        )

    if not service:
        raise InvalidServiceException(f"Could not get service from type {service_type}")

    return WorkflowSource(
        type=service.serviceType.value.lower(),
        serviceName=service.name.__root__,
        serviceConnection=service.connection,
        sourceConfig=ingestion_pipeline.sourceConfig,
    )


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


def test_suite_workflow(workflow_config: OpenMetadataWorkflowConfig):
    """
    Task that creates and runs the test suite workflow.

    The workflow_config gets cooked form the incoming
    ingestionPipeline.

    This is the callable used to create the PythonOperator
    """

    set_loggers_level(workflow_config.workflowConfig.loggerLevel.value)

    config = json.loads(workflow_config.json(encoder=show_secrets_encoder))

    workflow = TestSuiteWorkflow.create(config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


def date_to_datetime(
    date: Optional[basic.DateTime], date_format: str = "%Y-%m-%dT%H:%M:%S%z"
) -> Optional[datetime]:
    """
    Format a basic.DateTime to datetime. ISO 8601 format by default.
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
        "dag_id": clean_dag_id(ingestion_pipeline.name.__root__),
        "description": ingestion_pipeline.description,
        "start_date": ingestion_pipeline.airflowConfig.startDate.__root__
        if ingestion_pipeline.airflowConfig.startDate
        else airflow.utils.dates.days_ago(1),
        "end_date": ingestion_pipeline.airflowConfig.endDate.__root__
        if ingestion_pipeline.airflowConfig.endDate
        else None,
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
