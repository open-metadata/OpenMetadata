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
DBTcloud source to extract metadata from OM UI
"""
import traceback
from datetime import datetime
from typing import Iterable, List, Optional

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.data.table import (
    PipelineObservability,
    PipelineObservabilityItem,
    Schedule,
    Table,
)
from metadata.generated.schema.entity.services.connections.pipeline.dbtCloudConnection import (
    DBTCloudConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    SourceUrl,
    Timestamp,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.dbtcloud.models import DBTJob
from metadata.ingestion.source.pipeline.pipeline_service import (
    PipelineObservabilityLink,
    PipelineServiceSource,
)
from metadata.utils import fqn
from metadata.utils.helpers import clean_uri, datetime_to_ts
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

STATUS_MAP = {
    "Success": StatusType.Successful.value,
    "Error": StatusType.Failed.value,
    "Cancelled": StatusType.Skipped.value,
    "Running": StatusType.Pending.value,
    "Starting": StatusType.Pending.value,
    "Queued": StatusType.Pending.value,
    0: StatusType.Pending.value,
    1: StatusType.Successful.value,
    2: StatusType.Skipped.value,
}


class DbtcloudSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from DBT cloud
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: DBTCloudConnection = config.serviceConnection.root.config
        if not isinstance(connection, DBTCloudConnection):
            raise InvalidSourceException(
                f"Expected DBTCloudConnection, but got {connection}"
            )
        return cls(config, metadata)

    def _get_task_list(self, job_id: int) -> Optional[List[Task]]:
        """
        Method to collect all the tasks from dbt cloud job and return it in a task list
        """
        self.context.get().latest_run_id = None
        try:
            task_list: List[Task] = []
            runs = self.client.get_runs(job_id=job_id)
            if runs:
                for run in runs or []:
                    task = Task(
                        name=str(run.id),
                        sourceUrl=SourceUrl(run.href),
                        startDate=str(run.started_at),
                        endDate=str(run.finished_at),
                    )
                    task_list.append(task)
                self.context.get().latest_run_id = (
                    task_list[0].name if task_list else None
                )
            return task_list or None
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to get tasks list due to : {exc}")
        return None

    def yield_pipeline(
        self, pipeline_details: DBTJob
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """
        Method to Get Pipeline Entity
        """
        try:
            connection_url = (
                f"{clean_uri(self.service_connection.host)}/deploy/"
                f"{self.service_connection.accountId}/projects/"
                f"{pipeline_details.project_id}/jobs/{pipeline_details.id}"
            )

            pipeline_request = CreatePipelineRequest(
                name=EntityName(pipeline_details.name),
                description=Markdown(pipeline_details.description),
                sourceUrl=SourceUrl(connection_url),
                tasks=self._get_task_list(job_id=int(pipeline_details.id)),
                scheduleInterval=(
                    str(pipeline_details.schedule.cron)
                    if pipeline_details.schedule
                    else None
                ),
                service=FullyQualifiedEntityName(self.context.get().pipeline_service),
            )
            yield Either(right=pipeline_request)
            self.register_record(pipeline_request=pipeline_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=f"Wild error ingesting pipeline {pipeline_details} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_pipeline_lineage_details(
        self, pipeline_details: DBTJob
    ) -> Iterable[Either[AddLineageRequest | PipelineObservabilityLink]]:
        """
        Get lineage between pipeline and data sources, and also handle pipeline observability
        """
        try:  # pylint: disable=too-many-nested-blocks
            if self.source_config.lineageInformation:
                pipeline_fqn = fqn.build(
                    metadata=self.metadata,
                    entity_type=Pipeline,
                    service_name=self.context.get().pipeline_service,
                    pipeline_name=self.context.get().pipeline,
                )

                pipeline_entity = self.metadata.get_by_name(
                    entity=Pipeline, fqn=pipeline_fqn
                )

                # Get the latest runs for pipeline observability data
                runs = self.client.get_runs(job_id=pipeline_details.id)
                latest_run = runs[0] if runs else None

                dbt_models = self.client.get_model_details(
                    job_id=pipeline_details.id, run_id=self.context.get().latest_run_id
                )

                dbt_parents = self.client.get_models_and_seeds_details(
                    job_id=pipeline_details.id, run_id=self.context.get().latest_run_id
                )

                for model in dbt_models or []:
                    for dbservicename in (
                        self.source_config.lineageInformation.dbServiceNames or []
                    ):
                        to_entity = self.metadata.get_by_name(
                            entity=Table,
                            fqn=fqn.build(
                                metadata=self.metadata,
                                entity_type=Table,
                                table_name=model.name,
                                database_name=model.database,
                                schema_name=model.dbtschema,
                                service_name=dbservicename,
                            ),
                        )

                        if to_entity is None:
                            continue

                        # Create pipeline observability for this table
                        if latest_run:
                            pipeline_obs = self._create_pipeline_observability(
                                pipeline_details, latest_run
                            )
                            if pipeline_obs:
                                pipeline_obs_link = PipelineObservabilityLink(
                                    table_entity=to_entity,
                                    pipeline_observability=pipeline_obs,
                                )
                                yield Either(right=pipeline_obs_link)

                        # Process lineage relationships
                        for unique_id in model.dependsOn or []:
                            parents = [
                                d for d in dbt_parents if d.uniqueId == unique_id
                            ]
                            if parents:
                                from_entity = self.metadata.get_by_name(
                                    entity=Table,
                                    fqn=fqn.build(
                                        metadata=self.metadata,
                                        entity_type=Table,
                                        table_name=parents[0].name,
                                        database_name=parents[0].database,
                                        schema_name=parents[0].dbtschema,
                                        service_name=dbservicename,
                                    ),
                                )

                                if from_entity is None:
                                    continue

                                # Create pipeline observability for parent table
                                if latest_run:
                                    pipeline_obs = self._create_pipeline_observability(
                                        pipeline_details, latest_run
                                    )
                                    if pipeline_obs:
                                        pipeline_obs_link = PipelineObservabilityLink(
                                            table_entity=from_entity,
                                            pipeline_observability=pipeline_obs,
                                        )
                                        # yield Either(right=pipeline_obs_link)

                                lineage_details = LineageDetails(
                                    pipeline=EntityReference(
                                        id=pipeline_entity.id.root, type="pipeline"
                                    ),
                                    source=LineageSource.PipelineLineage,
                                    # pipeline_obs=Observ ???  
                                )

                                yield Either(
                                    right=AddLineageRequest(
                                        edge=EntitiesEdge(
                                            fromEntity=EntityReference(
                                                id=from_entity.id,
                                                type="table",
                                            ),
                                            toEntity=EntityReference(
                                                id=to_entity.id,
                                                type="table",
                                            ),
                                            lineageDetails=lineage_details,
                                        )
                                    )
                                )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=f"Wild error ingesting pipeline lineage {pipeline_details} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_pipelines_list(self) -> Iterable[DBTJob]:
        """
        Get List of all pipelines
        """
        try:
            yield from self.client.get_jobs()
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get pipeline list due to : {exc}")

    def get_pipeline_name(self, pipeline_details: DBTJob) -> str:
        """
        Get Pipeline Name
        """
        try:
            return pipeline_details.name
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get pipeline name due to : {exc}")

        return None

    def _find_table_entity(self, model) -> Optional[Table]:
        """
        Find table entity for a DBT model across configured database services
        """
        if not (model.database and model.dbtschema and model.name):
            return None

        for db_service_name in self.get_db_service_names() or ["*"]:
            try:
                table_fqn = fqn.build(
                    metadata=self.metadata,
                    entity_type=Table,
                    service_name=db_service_name,
                    database_name=model.database,
                    schema_name=model.dbtschema,
                    table_name=model.name,
                )

                table_entity = self.metadata.get_by_name(entity=Table, fqn=table_fqn)
                if table_entity:
                    return table_entity

            except Exception as exc:
                logger.debug(
                    f"Failed to find table {model.name} in service {db_service_name}: {exc}"
                )
                continue

        logger.debug(f"Could not find table entity for model {model.name}")
        return None

    def _create_pipeline_observability(
        self, pipeline_details: DBTJob, latest_run
    ) -> PipelineObservability:
        """
        Create pipeline observability data from job details and run information
        """
        pipeline_entity = self._get_pipeline_entity(pipeline_details.name)
        if not pipeline_entity:
            return None

        # Create a single PipelineObservabilityItem
        pipeline_obs_item = PipelineObservabilityItem(
            pipeline=pipeline_entity.entityReference,
            schedule=Schedule(
                scheduleInterval=(
                    pipeline_details.schedule.cron
                    if pipeline_details.schedule
                    else None
                )
            ),
            lastRunTime=(
                Timestamp(latest_run.finished_at)
                if latest_run and latest_run.finished_at
                else None
            ),
            lastRunStatus=(
                STATUS_MAP.get(latest_run.state, StatusType.Failed.value)
                if latest_run
                else None
            ),
        )

        return PipelineObservability([pipeline_obs_item])

    def yield_pipeline_observability(
        self, pipeline_details: DBTJob
    ) -> Iterable[Either[PipelineObservabilityLink]]:
        """
        Get Pipeline Observability for a table
        """
        try:
            # Get the latest runs for this job to extract observability data
            runs = self.client.get_runs(job_id=pipeline_details.id)
            if not runs:
                logger.debug(f"No runs found for job {pipeline_details.name}")
                return

            latest_run = runs[0] if runs else None

            # Get models associated with this job using the latest run
            if latest_run:
                dbt_models = self.client.get_model_details(
                    job_id=pipeline_details.id, run_id=self.context.get().latest_run_id
                )

                dbt_parents = self.client.get_models_and_seeds_details(
                    job_id=pipeline_details.id, run_id=self.context.get().latest_run_id
                )

                if dbt_models:
                    for model in dbt_models:
                        for db_service_name in (
                            self.source_config.lineageInformation.dbServiceNames or []
                            if self.source_config.lineageInformation
                            else self.get_db_service_names() or ["*"]
                        ):
                            table_entity = self.metadata.get_by_name(
                                entity=Table,
                                fqn=fqn.build(
                                    metadata=self.metadata,
                                    entity_type=Table,
                                    table_name=model.name,
                                    database_name=model.database,
                                    schema_name=model.dbtschema,
                                    service_name=db_service_name,
                                ),
                            )

                            if table_entity:
                                # Create pipeline observability data for the model table
                                pipeline_obs = self._create_pipeline_observability(
                                    pipeline_details, latest_run
                                )
                                if pipeline_obs:
                                    # Create the link between table and pipeline observability
                                    pipeline_obs_link = PipelineObservabilityLink(
                                        table_entity=table_entity,
                                        pipeline_observability=pipeline_obs,
                                    )
                                    yield Either(right=pipeline_obs_link)

                                # Process parent dependencies (same as lineage logic)
                                for unique_id in model.dependsOn or []:
                                    parents = [
                                        d for d in dbt_parents if d.uniqueId == unique_id
                                    ]
                                    if parents:
                                        parent_entity = self.metadata.get_by_name(
                                            entity=Table,
                                            fqn=fqn.build(
                                                metadata=self.metadata,
                                                entity_type=Table,
                                                table_name=parents[0].name,
                                                database_name=parents[0].database,
                                                schema_name=parents[0].dbtschema,
                                                service_name=db_service_name,
                                            ),
                                        )

                                        if parent_entity:
                                            # Create pipeline observability for parent table
                                            parent_pipeline_obs = self._create_pipeline_observability(
                                                pipeline_details, latest_run
                                            )
                                            if parent_pipeline_obs:
                                                parent_obs_link = PipelineObservabilityLink(
                                                    table_entity=parent_entity,
                                                    pipeline_observability=parent_pipeline_obs,
                                                )
                                                yield Either(right=parent_obs_link)
                                
                                break  # Found the table, no need to check other services

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=f"Wild error ingesting pipeline observability {pipeline_details} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_pipeline_status(
        self, pipeline_details: DBTJob
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """
        Get Pipeline Status
        """
        try:

            pipeline_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Pipeline,
                service_name=self.context.get().pipeline_service,
                pipeline_name=self.context.get().pipeline,
            )

            for task in self.client.get_runs(job_id=int(pipeline_details.id)) or []:
                task_status = TaskStatus(
                    name=str(task.id),
                    executionStatus=STATUS_MAP.get(task.state, StatusType.Pending),
                    startTime=(
                        Timestamp(
                            datetime_to_ts(
                                datetime.strptime(
                                    task.started_at, "%Y-%m-%d %H:%M:%S.%f%z"
                                )
                            )
                        )
                        if task.started_at
                        else None
                    ),
                    endTime=(
                        Timestamp(
                            datetime_to_ts(
                                datetime.strptime(
                                    task.finished_at, "%Y-%m-%d %H:%M:%S.%f%z"
                                )
                            )
                        )
                        if task.finished_at
                        else None
                    ),
                )

                pipeline_status = PipelineStatus(
                    executionStatus=task_status.executionStatus,
                    taskStatus=[task_status],
                    timestamp=task_status.endTime
                    if task_status.endTime
                    else task_status.startTime,
                )

                yield Either(
                    right=OMetaPipelineStatus(
                        pipeline_fqn=pipeline_fqn,
                        pipeline_status=pipeline_status,
                    )
                )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=f"Wild error ingesting pipeline status {pipeline_details} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
