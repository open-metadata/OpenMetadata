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
import uuid
from datetime import datetime, timedelta
from functools import partial
from typing import Callable

import airflow
from airflow import DAG
from openmetadata_managed_apis.api.utils import clean_dag_id
from pydantic import ValidationError
from requests.utils import quote

from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.metadataService import MetadataService
from metadata.generated.schema.entity.services.mlmodelService import MlModelService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.ingestion.models.encoders import show_secrets_encoder
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import set_loggers_level

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from openmetadata_managed_apis.utils.logger import workflow_logger
from openmetadata_managed_apis.utils.parser import (
    parse_service_connection,
    parse_validation_err,
)
from openmetadata_managed_apis.workflows.ingestion.credentials_builder import (
    build_secrets_manager_credentials,
)

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
    PipelineState,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    LogLevels,
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.metadataIngestion.workflow import WorkflowConfig
from metadata.ingestion.api.parser import (
    InvalidWorkflowException,
    ParsingConfigurationError,
)
from metadata.ingestion.api.workflow import Workflow
from metadata.ingestion.ometa.utils import model_str

logger = workflow_logger()


class InvalidServiceException(Exception):
    """
    The service type we received is not supported
    """


class GetServiceException(Exception):
    """
    Exception to be thrown when couldn't fetch the service from server
    """

    def __init__(self, service_type: str, service_name: str):
        self.message = (
            f"Could not get service from type {service_type}. This means that the"
            " OpenMetadata client running in the Airflow host had issues getting"
            f" the service {service_name}. Validate your ingestion-bot authentication."
        )
        super().__init__(self.message)


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
        raise ClientInitializationError(
            f"Failed to initialize the OpenMetadata client due to: {exc}."
            " Make sure that the Airflow host can reach the OpenMetadata"
            f" server running at {ingestion_pipeline.openMetadataServerConnection.hostPort}"
            " and that the client and server are in the same version."
        )

    service_type = ingestion_pipeline.service.type

    if service_type == "testSuite":
        service = metadata.get_by_name(
            entity=TestSuite, fqn=ingestion_pipeline.service.name
        )  # check we are able to access OM server
        if not service:
            raise GetServiceException(service_type, ingestion_pipeline.service.name)

        return WorkflowSource(
            type=service_type,
            serviceName=ingestion_pipeline.service.name,
            sourceConfig=ingestion_pipeline.sourceConfig,
        )

    entity_class = None
    try:
        if service_type == "databaseService":
            entity_class = DatabaseService
            service: DatabaseService = metadata.get_by_name(
                entity=entity_class, fqn=ingestion_pipeline.service.name
            )
        elif service_type == "pipelineService":
            entity_class = PipelineService
            service: PipelineService = metadata.get_by_name(
                entity=entity_class, fqn=ingestion_pipeline.service.name
            )
        elif service_type == "dashboardService":
            entity_class = DashboardService
            service: DashboardService = metadata.get_by_name(
                entity=entity_class, fqn=ingestion_pipeline.service.name
            )
        elif service_type == "messagingService":
            entity_class = MessagingService
            service: MessagingService = metadata.get_by_name(
                entity=entity_class, fqn=ingestion_pipeline.service.name
            )
        elif service_type == "mlmodelService":
            entity_class = MlModelService
            service: MlModelService = metadata.get_by_name(
                entity=entity_class, fqn=ingestion_pipeline.service.name
            )
        elif service_type == "metadataService":
            entity_class = MetadataService
            service: MetadataService = metadata.get_by_name(
                entity=entity_class, fqn=ingestion_pipeline.service.name
            )
        else:
            raise InvalidServiceException(f"Invalid Service Type: {service_type}")
    except ValidationError as original_error:
        try:
            resp = metadata.client.get(
                f"{metadata.get_suffix(entity_class)}/name/{quote(model_str(ingestion_pipeline.service.name), safe='')}"
            )
            parse_service_connection(resp)
        except (ValidationError, InvalidWorkflowException) as scoped_error:
            if isinstance(scoped_error, ValidationError):
                # Let's catch validations of internal Workflow models, not the Workflow itself
                object_error = (
                    scoped_error.model.__name__
                    if scoped_error.model is not None
                    else "workflow"
                )
                raise ParsingConfigurationError(
                    f"We encountered an error parsing the configuration of your {object_error}.\n"
                    f"{parse_validation_err(scoped_error)}"
                )
            raise scoped_error
        raise ParsingConfigurationError(
            f"We encountered an error parsing the configuration of your workflow.\n"
            f"{parse_validation_err(original_error)}"
        )

    if not service:
        raise GetServiceException(service_type, ingestion_pipeline.service.name)

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
        "tags": [
            "OpenMetadata",
            ingestion_pipeline.pipelineType.value,
        ],
    }


def send_failed_status_callback(workflow_config: OpenMetadataWorkflowConfig, _):
    """
    Airflow on_failure_callback to update workflow status if something unexpected
    happens or if the DAG is externally killed.

    We don't want to initialize the full workflow as it might be failing
    on the `__init__` call as well. We'll manually prepare the status sending
    logic.

    In this callback we just care about:
    - instantiating the ometa client
    - getting the IngestionPipeline FQN
    - if exists, update with `Failed` status

    Here the workflow_config is already properly shaped, otherwise
    the DAG deployment would fail.

    More info on context variables here
    https://airflow.apache.org/docs/apache-airflow/stable/templates-ref.html#templates-variables
    """
    logger.info("Sending failed status from callback...")

    metadata_config = workflow_config.workflowConfig.openMetadataServerConfig
    metadata = OpenMetadata(config=metadata_config)

    if workflow_config.ingestionPipelineFQN:
        logger.info(
            f"Sending status to Ingestion Pipeline {workflow_config.ingestionPipelineFQN}"
        )

        pipeline_status = metadata.get_pipeline_status(
            workflow_config.ingestionPipelineFQN, str(workflow_config.pipelineRunId)
        )
        pipeline_status.endDate = datetime.now().timestamp() * 1000
        pipeline_status.pipelineState = PipelineState.failed

        metadata.create_or_update_pipeline_status(
            workflow_config.ingestionPipelineFQN, pipeline_status
        )
    else:
        logger.info(
            "Workflow config does not have ingestionPipelineFQN informed. We won't update the status."
        )


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

        # Initialize with random UUID4. Will be used by the callback instead of
        # generating it inside the Workflow itself.
        workflow_config.pipelineRunId = str(uuid.uuid4())

        PythonOperator(
            task_id=task_name,
            python_callable=workflow_fn,
            op_kwargs={"workflow_config": workflow_config},
            # There's no need to retry if we have had an error. Wait until the next schedule or manual rerun.
            retries=0,
            # each DAG will call its own OpenMetadataWorkflowConfig
            on_failure_callback=partial(send_failed_status_callback, workflow_config),
            # Add tag and ownership to easily identify DAGs generated by OM
            owner=ingestion_pipeline.owner.name
            if ingestion_pipeline.owner
            else "openmetadata",
        )

        return dag
