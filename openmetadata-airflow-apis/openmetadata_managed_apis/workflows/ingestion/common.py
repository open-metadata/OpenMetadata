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
from typing import Callable, Optional, Union

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
from metadata.generated.schema.entity.services.searchService import SearchService
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.generated.schema.metadataIngestion.application import (
    OpenMetadataApplicationConfig,
)
from metadata.generated.schema.type.basic import Timestamp, Uuid
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn

# pylint: disable=ungrouped-imports
try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from openmetadata_managed_apis.utils.logger import set_operator_logger, workflow_logger
from openmetadata_managed_apis.utils.parser import (
    parse_service_connection,
    parse_validation_err,
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
from metadata.ingestion.ometa.utils import model_str
from metadata.workflow.metadata import MetadataWorkflow

logger = workflow_logger()

ENTITY_CLASS_MAP = {
    "databaseService": DatabaseService,
    "pipelineService": PipelineService,
    "dashboardService": DashboardService,
    "messagingService": MessagingService,
    "mlmodelService": MlModelService,
    "metadataService": MetadataService,
    "storageService": StorageService,
    "searchService": SearchService,
}


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
            f"Could not get service from type [{service_type}]. This means that the"
            " OpenMetadata client running in the Airflow host had issues getting"
            f" the service [{service_name}]. Make sure the ingestion-bot JWT token"
            " is valid and that the Workflow is deployed with the latest one. If this error"
            " persists, recreate the JWT token and redeploy the Workflow."
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

    try:
        metadata = OpenMetadata(config=ingestion_pipeline.openMetadataServerConnection)

        # check we can access OM server
        metadata.health_check()
    except Exception as exc:
        raise ClientInitializationError(
            f"Failed to initialize the OpenMetadata client due to: {exc}."
            " Make sure that the Airflow host can reach the OpenMetadata"
            f" server running at {ingestion_pipeline.openMetadataServerConnection.hostPort}"
            " and that the client and server are in the same version."
        )

    service_type = ingestion_pipeline.service.type

    entity_class = ENTITY_CLASS_MAP.get(service_type)
    try:
        if service_type == "testSuite":
            return WorkflowSource(
                type=service_type,
                serviceName=ingestion_pipeline.service.name,
                sourceConfig=ingestion_pipeline.sourceConfig,
                # retrieved from the test suite workflow using the `sourceConfig.config.entityFullyQualifiedName`
                serviceConnection=None,
            )

        if entity_class is None:
            raise InvalidServiceException(f"Invalid Service Type: {service_type}")

        service = metadata.get_by_name(
            entity=entity_class,
            fqn=ingestion_pipeline.service.name,
            nullable=False,
        )

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
        serviceName=service.name.root,
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

    set_operator_logger(workflow_config)

    config = json.loads(workflow_config.model_dump_json(exclude_defaults=False))
    workflow = MetadataWorkflow.create(config)

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


def clean_name_tag(tag: str) -> Optional[str]:
    """
    Clean the tag to be used in Airflow.
    Airflow supports 100 characters. We'll keep just 90
    since we add prefixes on the tags
    """
    if not tag:
        return None
    try:
        return fqn.split(tag)[-1][:90]
    except Exception as exc:
        logger.warning("Error cleaning tag: %s", exc)
        return tag[:90]


def build_dag_configs(ingestion_pipeline: IngestionPipeline) -> dict:
    """
    Prepare kwargs to send to DAG
    :param ingestion_pipeline: pipeline configs
    :return: dict to use as kwargs
    """

    if ingestion_pipeline.airflowConfig.startDate:
        start_date = ingestion_pipeline.airflowConfig.startDate.root
    else:
        start_date = datetime.now() - timedelta(days=1)

    return {
        "dag_id": clean_dag_id(ingestion_pipeline.name.root),
        "description": ingestion_pipeline.description.root
        if ingestion_pipeline.description is not None
        else None,
        "start_date": start_date,
        "end_date": ingestion_pipeline.airflowConfig.endDate.root
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
            clean_name_tag(ingestion_pipeline.displayName)
            or clean_name_tag(ingestion_pipeline.name.root),
            f"type:{ingestion_pipeline.pipelineType.value}",
            f"service:{clean_name_tag(ingestion_pipeline.service.name)}",
        ],
    }


def send_failed_status_callback(workflow_config: OpenMetadataWorkflowConfig, *_, **__):
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
            workflow_config.ingestionPipelineFQN,
            str(workflow_config.pipelineRunId.root),
        )
        pipeline_status.endDate = Timestamp(int(datetime.now().timestamp() * 1000))
        pipeline_status.pipelineState = PipelineState.failed

        metadata.create_or_update_pipeline_status(
            workflow_config.ingestionPipelineFQN, pipeline_status
        )
    else:
        logger.info(
            "Workflow config does not have ingestionPipelineFQN informed. We won't update the status."
        )


class CustomPythonOperator(PythonOperator):
    def on_kill(self) -> None:
        """
        Override this method to clean up subprocesses when a task instance
        gets killed. Any use of the threading, subprocess or multiprocessing
        module within an operator needs to be cleaned up, or it will leave
        ghost processes behind.
        """
        workflow_config = self.op_kwargs.get("workflow_config")
        if workflow_config:
            send_failed_status_callback(workflow_config)


def build_dag(
    task_name: str,
    ingestion_pipeline: IngestionPipeline,
    workflow_config: Union[OpenMetadataWorkflowConfig, OpenMetadataApplicationConfig],
    workflow_fn: Callable,
) -> DAG:
    """
    Build a simple metadata workflow DAG
    """

    with DAG(**build_dag_configs(ingestion_pipeline)) as dag:
        # Initialize with random UUID4. Will be used by the callback instead of
        # generating it inside the Workflow itself.
        workflow_config.pipelineRunId = Uuid(uuid.uuid4())

        CustomPythonOperator(
            task_id=task_name,
            python_callable=workflow_fn,
            op_kwargs={"workflow_config": workflow_config},
            # There's no need to retry if we have had an error. Wait until the next schedule or manual rerun.
            retries=ingestion_pipeline.airflowConfig.retries or 0,
            # each DAG will call its own OpenMetadataWorkflowConfig
            on_failure_callback=partial(send_failed_status_callback, workflow_config),
            # Add tag and ownership to easily identify DAGs generated by OM
            owner=ingestion_pipeline.owners.root[0].name
            if (ingestion_pipeline.owners and ingestion_pipeline.owners.root)
            else "openmetadata",
        )

        return dag
