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
Dataflow pipeline source to extract metadata
"""
import re
import traceback
from typing import Any, Iterable, List, Optional

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.pipeline.dataflowConnection import (
    DataflowConnection,
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
from metadata.ingestion.source.pipeline.dataflow.client import DataflowClient
from metadata.ingestion.source.pipeline.dataflow.models import (
    DataflowIO,
    DataflowJob,
    DataflowLineage,
)
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

STATUS_MAP = {
    "JOB_STATE_STOPPED": StatusType.Failed,
    "JOB_STATE_RUNNING": StatusType.Pending,
    "JOB_STATE_DONE": StatusType.Successful,
    "JOB_STATE_FAILED": StatusType.Failed,
    "JOB_STATE_CANCELLED": StatusType.Failed,
    "JOB_STATE_UPDATED": StatusType.Successful,
    "JOB_STATE_DRAINING": StatusType.Pending,
    "JOB_STATE_DRAINED": StatusType.Successful,
    "JOB_STATE_PENDING": StatusType.Pending,
    "JOB_STATE_CANCELLING": StatusType.Pending,
}


class DataflowSource(PipelineServiceSource):
    """
    Implements the necessary methods to extract Pipeline metadata from Google Cloud Dataflow
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.client: DataflowClient = self.connection

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: DataflowConnection = config.serviceConnection.root.config
        if not isinstance(connection, DataflowConnection):
            raise InvalidSourceException(
                f"Expected DataflowConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_pipelines_list(self) -> Iterable[DataflowJob]:
        """
        Get list of all Dataflow jobs
        """
        try:
            for job in self.client.list_jobs():
                yield job
        except Exception as exc:
            logger.error(f"Failed to list Dataflow jobs: {exc}")
            logger.debug(traceback.format_exc())

    def get_pipeline_name(self, pipeline_details: DataflowJob) -> str:
        """
        Get pipeline name from job details
        """
        return pipeline_details.name

    def yield_pipeline(
        self, pipeline_details: DataflowJob
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """
        Create pipeline entity from Dataflow job
        """
        try:
            source_url = SourceUrl(
                f"https://console.cloud.google.com/dataflow/jobs/{pipeline_details.location}/{pipeline_details.id}?"
                f"project={pipeline_details.project_id}"
            )

            job_details = self.client.get_job(
                job_id=pipeline_details.id, location=pipeline_details.location
            )

            tasks = self._extract_tasks(job_details) if job_details else []

            pipeline_request = CreatePipelineRequest(
                name=EntityName(pipeline_details.name),
                displayName=pipeline_details.name,
                description=f"Dataflow {pipeline_details.type} job in {pipeline_details.location}",
                tasks=tasks,
                service=FullyQualifiedEntityName(self.context.get().pipeline_service),
                sourceUrl=source_url,
            )
            yield Either(right=pipeline_request)
            self.register_record(pipeline_request=pipeline_request)

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=f"Failed to create pipeline: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _extract_tasks(self, job_details: Any) -> List[Task]:
        """
        Extract tasks from job execution graph
        """
        tasks = []
        try:
            if hasattr(job_details, "execution_info") and hasattr(
                job_details.execution_info, "stages"
            ):
                stages = job_details.execution_info.stages or {}
                for stage_id, stage in stages.items():
                    task = Task(
                        name=stage.name or f"stage_{stage_id}",
                        displayName=stage.name or f"Stage {stage_id}",
                        taskType="DataflowStage",
                    )
                    tasks.append(task)

            if hasattr(job_details, "pipeline_description") and hasattr(
                job_details.pipeline_description, "execution_pipeline_stage"
            ):
                for step in (
                    job_details.pipeline_description.execution_pipeline_stage or []
                ):
                    if hasattr(step, "name"):
                        task = Task(
                            name=step.name,
                            displayName=step.name,
                            taskType="DataflowStep",
                        )
                        tasks.append(task)

        except Exception as exc:
            logger.debug(f"Failed to extract tasks: {exc}")

        return tasks or [
            Task(
                name="default_task",
                displayName="Dataflow Job",
                taskType="DataflowJob",
            )
        ]

    def yield_pipeline_status(
        self, pipeline_details: DataflowJob
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """
        Get pipeline execution status
        """
        try:
            pipeline_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Pipeline,
                service_name=self.context.get().pipeline_service,
                pipeline_name=self.context.get().pipeline,
            )

            execution_status = STATUS_MAP.get(
                pipeline_details.current_state, StatusType.Pending
            )

            task_status = [
                TaskStatus(
                    name=pipeline_details.name,
                    executionStatus=execution_status.value,
                    startTime=Timestamp(
                        int(pipeline_details.start_time.timestamp() * 1000)
                    )
                    if pipeline_details.start_time
                    else None,
                )
            ]

            pipeline_status = PipelineStatus(
                taskStatus=task_status,
                timestamp=Timestamp(
                    int(pipeline_details.create_time.timestamp() * 1000)
                )
                if pipeline_details.create_time
                else None,
                executionStatus=execution_status.value,
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
                    error=f"Failed to yield pipeline status: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _extract_lineage_from_job(self, job_details: Any) -> Optional[DataflowLineage]:
        """
        Extract lineage information from Dataflow job
        """
        lineage = DataflowLineage()

        try:
            if hasattr(job_details, "pipeline_description"):
                pipeline_desc = job_details.pipeline_description

                if hasattr(pipeline_desc, "display_data"):
                    for display_item in pipeline_desc.display_data or []:
                        self._parse_display_data(display_item, lineage)

            if hasattr(job_details, "transform_name_mapping"):
                for (
                    transform_name,
                    details,
                ) in job_details.transform_name_mapping.items():
                    self._parse_transform(transform_name, details, lineage)

            if hasattr(job_details, "environment") and hasattr(
                job_details.environment, "user_agent"
            ):
                self._parse_user_agent(job_details.environment.user_agent, lineage)

        except Exception as exc:
            logger.debug(f"Failed to extract lineage from job: {exc}")

        return lineage

    def _parse_display_data(self, display_item: Any, lineage: DataflowLineage) -> None:
        """
        Parse display data for lineage information
        """
        try:
            if not hasattr(display_item, "key") or not hasattr(
                display_item, "str_value"
            ):
                return

            key = display_item.key.lower()
            value = display_item.str_value

            if "bigquery" in key or "table" in key:
                if ":" in value:
                    self._add_bigquery_entity(value, lineage, is_source="input" in key)
            elif "gcs" in key or "bucket" in key or "gs://" in value:
                self._add_gcs_entity(value, lineage, is_source="input" in key)

        except Exception as exc:
            logger.debug(f"Failed to parse display data: {exc}")

    def _parse_transform(
        self, transform_name: str, details: Any, lineage: DataflowLineage
    ) -> None:
        """
        Parse transform information for lineage
        """
        try:
            transform_lower = transform_name.lower()

            if "readfrombigquery" in transform_lower or "bigquery" in transform_lower:
                if hasattr(details, "display_data"):
                    for item in details.display_data or []:
                        if hasattr(item, "str_value") and ":" in item.str_value:
                            self._add_bigquery_entity(
                                item.str_value, lineage, is_source=True
                            )

            if "readfromtext" in transform_lower or "gcsio" in transform_lower:
                if hasattr(details, "display_data"):
                    for item in details.display_data or []:
                        if hasattr(item, "str_value") and "gs://" in item.str_value:
                            self._add_gcs_entity(
                                item.str_value, lineage, is_source=True
                            )

            if "writetobigquery" in transform_lower:
                if hasattr(details, "display_data"):
                    for item in details.display_data or []:
                        if hasattr(item, "str_value") and ":" in item.str_value:
                            self._add_bigquery_entity(
                                item.str_value, lineage, is_source=False
                            )

            if "writetotext" in transform_lower or "writeto" in transform_lower:
                if hasattr(details, "display_data"):
                    for item in details.display_data or []:
                        if hasattr(item, "str_value") and "gs://" in item.str_value:
                            self._add_gcs_entity(
                                item.str_value, lineage, is_source=False
                            )

        except Exception as exc:
            logger.debug(f"Failed to parse transform {transform_name}: {exc}")

    def _parse_user_agent(self, user_agent: Any, lineage: DataflowLineage) -> None:
        """
        Parse user agent data for additional lineage hints
        """
        try:
            if isinstance(user_agent, dict):
                for key, value in user_agent.items():
                    if isinstance(value, str):
                        if "bigquery" in value.lower() and ":" in value:
                            parts = re.findall(r"[\w-]+:[\w-]+\.[\w-]+", value)
                            for part in parts:
                                self._add_bigquery_entity(part, lineage, is_source=True)
                        elif "gs://" in value:
                            paths = re.findall(r"gs://[^\s,]+", value)
                            for path in paths:
                                self._add_gcs_entity(path, lineage, is_source=True)

        except Exception as exc:
            logger.debug(f"Failed to parse user agent: {exc}")

    def _add_bigquery_entity(
        self, table_ref: str, lineage: DataflowLineage, is_source: bool
    ) -> None:
        """
        Add BigQuery table to lineage
        """
        try:
            if ":" in table_ref:
                parts = table_ref.split(":")
                if len(parts) == 2:
                    project = parts[0]
                    dataset_table = parts[1].split(".")
                    if len(dataset_table) == 2:
                        dataset, table = dataset_table
                        io_entity = DataflowIO(
                            type="bigquery",
                            project=project,
                            dataset=dataset,
                            table=table,
                        )
                        if is_source:
                            lineage.sources.append(io_entity)
                        else:
                            lineage.sinks.append(io_entity)

        except Exception as exc:
            logger.debug(f"Failed to add BigQuery entity {table_ref}: {exc}")

    def _add_gcs_entity(
        self, path: str, lineage: DataflowLineage, is_source: bool
    ) -> None:
        """
        Add GCS path to lineage
        """
        try:
            if path.startswith("gs://"):
                path_clean = path.replace("gs://", "")
                parts = path_clean.split("/", 1)
                if len(parts) >= 1:
                    bucket = parts[0]
                    file_path = parts[1] if len(parts) > 1 else ""

                    io_entity = DataflowIO(
                        type="gcs", bucket=bucket, path=f"gs://{path_clean}"
                    )
                    if is_source:
                        lineage.sources.append(io_entity)
                    else:
                        lineage.sinks.append(io_entity)

        except Exception as exc:
            logger.debug(f"Failed to add GCS entity {path}: {exc}")

    def yield_pipeline_lineage_details(
        self, pipeline_details: DataflowJob
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Extract lineage between pipeline and data sources/sinks
        """
        try:
            pipeline_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Pipeline,
                service_name=self.context.get().pipeline_service,
                pipeline_name=self.context.get().pipeline,
            )

            pipeline_entity = self.metadata.get_by_name(
                entity=Pipeline, fqn=pipeline_fqn
            )

            lineage_details = LineageDetails(
                pipeline=EntityReference(id=pipeline_entity.id.root, type="pipeline"),
                source=LineageSource.PipelineLineage,
            )

            job_details = self.client.get_job(
                job_id=pipeline_details.id, location=pipeline_details.location
            )

            if not job_details:
                logger.debug(f"No job details found for {pipeline_details.name}")
                return

            dataflow_lineage = self._extract_lineage_from_job(job_details)

            if not dataflow_lineage:
                logger.debug(f"No lineage extracted for {pipeline_details.name}")
                return

            for source in dataflow_lineage.sources:
                for sink in dataflow_lineage.sinks:
                    source_entity = self._get_entity_reference(source)
                    sink_entity = self._get_entity_reference(sink)

                    if source_entity and sink_entity:
                        yield Either(
                            right=AddLineageRequest(
                                edge=EntitiesEdge(
                                    fromEntity=source_entity,
                                    toEntity=sink_entity,
                                    lineageDetails=lineage_details,
                                )
                            )
                        )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=f"Failed to yield pipeline lineage: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _get_entity_reference(self, io_entity: DataflowIO) -> Optional[EntityReference]:
        """
        Get entity reference for BigQuery table or GCS container
        """
        try:
            if io_entity.type == "bigquery":
                for db_service_name in self.get_db_service_names():
                    table_fqn = fqn.build(
                        metadata=self.metadata,
                        entity_type=Table,
                        service_name=db_service_name,
                        database_name=io_entity.project,
                        schema_name=io_entity.dataset,
                        table_name=io_entity.table,
                    )

                    table_entity = self.metadata.get_entity_reference(
                        entity=Table, fqn=table_fqn
                    )

                    if table_entity:
                        return table_entity

            elif io_entity.type == "gcs":
                for storage_service_name in self.get_storage_service_names():
                    container = self.metadata.es_search_container_by_path(
                        full_path=io_entity.path
                    )

                    if container:
                        return EntityReference(
                            id=container[0].id,
                            type="container",
                            name=container[0].name.root,
                            fullyQualifiedName=container[0].fullyQualifiedName.root,
                        )

        except Exception as exc:
            logger.debug(f"Failed to get entity reference for {io_entity}: {exc}")

        return None
