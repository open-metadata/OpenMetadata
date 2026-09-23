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
Metadata DAG common functions
"""

import json
import uuid
from collections.abc import Callable
from datetime import datetime, timedelta
from functools import partial

from airflow import DAG
from airflow.utils import timezone
from pydantic import ValidationError
from requests.utils import quote

from metadata.generated.schema.entity.services.apiService import ApiService
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.driveService import DriveService
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
from metadata.workflow.base import BaseWorkflow
from openmetadata_managed_apis.api.utils import clean_dag_id

# pylint: disable=ungrouped-imports
try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from croniter import croniter

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
    PipelineState,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    LogLevels,
    OpenMetadataWorkflowConfig,
    WorkflowConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.parser import (
    InvalidWorkflowException,
    ParsingConfigurationError,
)
from metadata.ingestion.ometa.utils import model_str
from metadata.workflow.metadata import MetadataWorkflow
from openmetadata_managed_apis.utils.airflow_version import is_airflow_3_or_higher
from openmetadata_managed_apis.utils.logger import set_operator_logger, workflow_logger
from openmetadata_managed_apis.utils.parser import (
    parse_service_connection,
    parse_validation_err,
)
from openmetadata_managed_apis.utils.pipeline_run_id import pipeline_run_id

logger = workflow_logger()

PIPELINE_RUN_ID_PARAM = "pipelineRunId"
SOURCE_CONFIG_OVERRIDE_PARAM = "sourceConfigOverride"

ENTITY_CLASS_MAP = {
    "apiService": ApiService,
    "databaseService": DatabaseService,
    "driveService": DriveService,
    "pipelineService": PipelineService,
    "dashboardService": DashboardService,
    "messagingService": MessagingService,
    "mlmodelService": MlModelService,
    "metadataService": MetadataService,
    "storageService": StorageService,
    "searchService": SearchService,
}


class InvalidServiceException(Exception):  # noqa: N818
    """
    The service type we received is not supported
    """


class GetServiceException(Exception):  # noqa: N818
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
        raise ClientInitializationError(  # noqa: B904
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
                object_error = getattr(scoped_error, "title", None) or "workflow"
                raise ParsingConfigurationError(  # noqa: B904
                    f"We encountered an error parsing the configuration of your {object_error}.\n"
                    f"{parse_validation_err(scoped_error)}"
                )
            raise scoped_error  # noqa: TRY201
        raise ParsingConfigurationError(  # noqa: B904
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


def execute_workflow(workflow: BaseWorkflow, workflow_config: OpenMetadataWorkflowConfig) -> None:
    """
    Execute the workflow and handle the status
    """
    workflow.execute()
    workflow.stop()
    if workflow_config.workflowConfig.raiseOnError:
        workflow.raise_from_status()


def metadata_ingestion_workflow(workflow_config: OpenMetadataWorkflowConfig):
    """
    Task that creates and runs the ingestion workflow.

    The workflow_config gets cooked form the incoming
    ingestionPipeline.

    This is the callable used to create the PythonOperator
    """

    set_operator_logger(workflow_config)

    config = json.loads(workflow_config.model_dump_json(exclude_defaults=False, mask_secrets=False))
    workflow = MetadataWorkflow.create(config)
    execute_workflow(workflow, workflow_config)


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
        raiseOnError=ingestion_pipeline.raiseOnError,
        openMetadataServerConfig=ingestion_pipeline.openMetadataServerConnection,
    )


def clean_name_tag(tag: str) -> str | None:
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
    # Determine start_date based on schedule_interval using croniter
    schedule_interval = ingestion_pipeline.airflowConfig.scheduleInterval
    if is_airflow_3_or_higher():
        # We want start_date to be close to "now" (not in the past) so Airflow 3
        # doesn't immediately fire a catch-up run on creation even with catchup
        # disabled. But `build_dag_configs` runs on every DAG-processor reparse,
        # and `timezone.utcnow()` recomputes to a new "now" each time — so the
        # cron interval measured from start_date never elapses and the DAG never
        # fires on its own schedule (#32505). Anchor on the pipeline's own
        # `updatedAt` instead: it only changes when the pipeline is actually
        # (re)configured (a no-op redeploy leaves version/updatedAt untouched),
        # so start_date stays stable across routine reparses/redeploys while
        # still resetting close to "now" whenever the schedule is genuinely
        # edited — preserving the original intent without the instability.
        start_date = (
            timezone.from_timestamp(ingestion_pipeline.updatedAt.root / 1000)
            if ingestion_pipeline.updatedAt
            else timezone.utcnow()
        )
    else:
        now = datetime.now()

        if schedule_interval is None:
            # On-demand DAG, set start_date to now
            start_date = now
        elif croniter.is_valid(schedule_interval):
            cron = croniter(schedule_interval, now)
            start_date = cron.get_prev(datetime)
        else:
            # Handle invalid cron expressions if necessary
            start_date = now

    dag_kwargs = {
        "dag_id": clean_dag_id(ingestion_pipeline.name.root),
        "description": ingestion_pipeline.description.root if ingestion_pipeline.description is not None else None,
        "start_date": start_date,
        "end_date": ingestion_pipeline.airflowConfig.endDate.root if ingestion_pipeline.airflowConfig.endDate else None,
        "max_active_runs": ingestion_pipeline.airflowConfig.maxActiveRuns,
        "dagrun_timeout": timedelta(ingestion_pipeline.airflowConfig.workflowTimeout)
        if ingestion_pipeline.airflowConfig.workflowTimeout
        else None,
        "is_paused_upon_creation": ingestion_pipeline.airflowConfig.pausePipeline or False,
        "catchup": ingestion_pipeline.airflowConfig.pipelineCatchup or False,
        "tags": [
            "OpenMetadata",
            clean_name_tag(ingestion_pipeline.displayName) or clean_name_tag(ingestion_pipeline.name.root),
            f"type:{ingestion_pipeline.pipelineType.value}",
            f"service:{clean_name_tag(ingestion_pipeline.service.name)}",
        ],
    }

    if is_airflow_3_or_higher():
        dag_kwargs["schedule"] = schedule_interval
    else:
        dag_kwargs["schedule_interval"] = schedule_interval

    if not is_airflow_3_or_higher():
        dag_kwargs["default_view"] = ingestion_pipeline.airflowConfig.workflowDefaultView
        dag_kwargs["orientation"] = ingestion_pipeline.airflowConfig.workflowDefaultViewOrientation

    concurrency = ingestion_pipeline.airflowConfig.concurrency
    if concurrency is not None:
        if is_airflow_3_or_higher():
            dag_kwargs["max_active_tasks"] = concurrency
        else:
            dag_kwargs["concurrency"] = concurrency

    return dag_kwargs


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
    try:
        logger.info("Sending failed status from callback...")

        metadata_config = workflow_config.workflowConfig.openMetadataServerConfig
        metadata = OpenMetadata(config=metadata_config)

        if workflow_config.ingestionPipelineFQN:
            logger.info(f"Sending status to Ingestion Pipeline {workflow_config.ingestionPipelineFQN}")

            pipeline_status = metadata.get_pipeline_status(
                workflow_config.ingestionPipelineFQN,
                str(workflow_config.pipelineRunId.root),
            )
            pipeline_status.endDate = Timestamp(int(datetime.now().timestamp() * 1000))
            pipeline_status.pipelineState = PipelineState.failed

            metadata.create_or_update_pipeline_status(workflow_config.ingestionPipelineFQN, pipeline_status)
            logger.info(f"Successfully sent failed status for {workflow_config.ingestionPipelineFQN}")
        else:
            logger.info("Workflow config does not have ingestionPipelineFQN informed. We won't update the status.")
    except Exception as exc:
        logger.error(f"Failed to send failed status callback: {exc}", exc_info=True)


def send_failed_run_status_callback(workflow_config: OpenMetadataWorkflowConfig, context) -> None:
    """
    DAG-level on_failure_callback. A task that fails before it starts - its runner killed, or
    unable to reach the API server - never runs the task-level callback, so a run the server
    recorded as queued would stay pending until the queued timeout, blocking on-demand runs of the
    pipeline until then. Airflow still fails the DAG run and calls this, so report the failure
    under the run id the trigger conf carried. Scheduled runs carry no run id and are left to the
    task-level callback.
    """
    dag_run_conf = getattr(context.get("dag_run"), "conf", None) or {}
    run_id = dag_run_conf.get(PIPELINE_RUN_ID_PARAM) or (context.get("params") or {}).get(PIPELINE_RUN_ID_PARAM)
    if run_id:
        send_failed_status_callback(workflow_config.model_copy(update={"pipelineRunId": Uuid(run_id)}))


def apply_source_config_override(
    workflow_config: OpenMetadataWorkflowConfig, source_config_override: dict | None
) -> None:
    """
    Lay a run's source config override over the config the DAG was deployed with. Airflow bakes a
    DAG's config at deploy time, so what applies to one run only - the test case a scoped test suite
    run executes, the filters narrowing a profiler or metadata run to one table - can reach it only
    through the trigger conf. Top-level keys of the override replace the deployed ones.

    The result is validated through the source config union, not the deployed config's class: a
    sparse deployed config can fit several variants - an auto classification config with no database
    fields parses as the messaging one - and only the fields the override adds settle which it is.
    Empty fields are left out of the deployed side, so one variant's empty fields cannot rule out
    another.
    """
    if not source_config_override:
        return
    source_config = workflow_config.source.sourceConfig
    deployed = source_config.config.model_dump(mode="json", exclude_none=True)
    overridden = {**deployed, **source_config_override}
    workflow_config.source.sourceConfig = type(source_config).model_validate({"config": overridden})


class CustomPythonOperator(PythonOperator):
    def execute(self, context):
        """
        A run triggered from the server carries the run id the server already recorded as queued.
        Reporting under that id, instead of the one minted when the DAG was parsed, makes the
        workflow's statuses - and the failure callback's, which shares this config - update the
        queued run rather than show up as a separate one. It may also carry a source config
        override that applies to this run alone; see apply_source_config_override.

        For scheduled runs (which carry no `params.pipelineRunId`), derive the run id from
        `dag_run.run_id` using the same `pipeline_run_id()` helper the response layer uses
        (`format_dag_run_state` in api/response.py). Without this, the parse-time random UUID
        from `build_dag` diverges from the deterministic UUIDv5 the status API reports for the
        same run, and the server tracks two separate runs (one from the response layer, one
        from the worker's status callback).
        """
        params = context.get("params") or {}
        workflow_config = self.op_kwargs.get("workflow_config")
        if workflow_config:
            run_id = params.get(PIPELINE_RUN_ID_PARAM)
            if run_id:
                workflow_config.pipelineRunId = Uuid(run_id)
            else:
                dag_run = context.get("dag_run")
                if dag_run is not None:
                    workflow_config.pipelineRunId = Uuid(
                        pipeline_run_id(dag_run.dag_id, dag_run.run_id)
                    )
            apply_source_config_override(workflow_config, params.get(SOURCE_CONFIG_OVERRIDE_PARAM))
        return super().execute(context)

    def on_kill(self) -> None:
        """
        Override this method to clean up subprocesses when a task instance
        gets killed. Any use of the threading, subprocess or multiprocessing
        module within an operator needs to be cleaned up, or it will leave
        ghost processes behind.
        """
        # First call parent on_kill to ensure proper cleanup
        super().on_kill()

        # Then send failed status callback
        try:
            workflow_config = self.op_kwargs.get("workflow_config")
            if workflow_config:
                logger.info(f"Task killed, sending failed status for workflow: {workflow_config.ingestionPipelineFQN}")
                send_failed_status_callback(workflow_config)
            else:
                logger.warning("on_kill called but no workflow_config found in op_kwargs")
        except Exception as exc:
            # Log the error but don't raise - we don't want to prevent cleanup
            logger.error(f"Error in on_kill callback: {exc}", exc_info=True)


def build_dag(
    task_name: str,
    ingestion_pipeline: IngestionPipeline,
    workflow_config: OpenMetadataWorkflowConfig | OpenMetadataApplicationConfig,
    workflow_fn: Callable,
    params: dict | None = None,
) -> DAG:
    """
    Build a simple metadata workflow DAG
    :param task_name: Name of the task
    :param ingestion_pipeline: Pipeline configs
    :param workflow_config: Workflow configurations
    :param workflow_fn: Function to be executed
    :param params: Optional parameters to pass to the operator
    :return: DAG
    """

    # Build the DAG and attach the task with an explicit `dag=` reference instead of
    # the `with DAG(...) as dag:` context manager. The context manager relies on
    # Airflow 3.x's process-global DagContext autoregister, which races when multiple
    # DAG files are parsed concurrently in the same process and raises a KeyError on
    # __exit__ (see issue #28500). The DAG is registered into the module globals
    # explicitly by WorkflowFactory.register_dag, so autoregister is not needed here.
    dag = DAG(
        **build_dag_configs(ingestion_pipeline),
        on_failure_callback=partial(send_failed_run_status_callback, workflow_config),
    )

    # Initialize with random UUID4. Will be used by the callback instead of
    # generating it inside the Workflow itself.
    workflow_config.pipelineRunId = Uuid(uuid.uuid4())

    CustomPythonOperator(
        task_id=task_name,
        python_callable=workflow_fn,
        op_kwargs={
            "workflow_config": workflow_config,
        },
        # There's no need to retry if we have had an error. Wait until the next schedule or manual rerun.
        retries=ingestion_pipeline.airflowConfig.retries or 0,
        # each DAG will call its own OpenMetadataWorkflowConfig
        on_failure_callback=partial(send_failed_status_callback, workflow_config),
        # Add tag and ownership to easily identify DAGs generated by OM
        owner=ingestion_pipeline.owners.root[0].name
        if (ingestion_pipeline.owners and ingestion_pipeline.owners.root)
        else "openmetadata",
        # Declared so the trigger conf can override it; see CustomPythonOperator.execute
        params={PIPELINE_RUN_ID_PARAM: None, SOURCE_CONFIG_OVERRIDE_PARAM: None, **(params or {})},
        dag=dag,
    )

    return dag
