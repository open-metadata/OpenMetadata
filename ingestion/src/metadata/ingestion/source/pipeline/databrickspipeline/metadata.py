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
Databricks pipeline source to extract metadata
"""

import traceback
from typing import Iterable, List, Optional, Tuple

from pydantic import ValidationError

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
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.pipeline.databricksPipelineConnection import (
    DatabricksPipelineConnection,
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
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.sql_lineage import get_column_fqn
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.databrickspipeline.kafka_parser import (
    extract_kafka_sources,
    get_pipeline_libraries,
)
from metadata.ingestion.source.pipeline.databrickspipeline.models import (
    DataBrickPipelineDetails,
    DBRun,
)
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


STATUS_MAP = {
    "SUCCESS": StatusType.Successful,
    "FAILED": StatusType.Failed,
    "TIMEOUT": StatusType.Failed,
    "CANCELED": StatusType.Failed,
    "PENDING": StatusType.Pending,
    "RUNNING": StatusType.Pending,
    "TERMINATING": StatusType.Pending,
    "SKIPPED": StatusType.Failed,
    "INTERNAL_ERROR": StatusType.Failed,
}


class DatabrickspipelineSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Databricks Jobs API
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: DatabricksPipelineConnection = config.serviceConnection.root.config
        if not isinstance(connection, DatabricksPipelineConnection):
            raise InvalidSourceException(
                f"Expected DatabricksPipelineConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_pipelines_list(self) -> Iterable[DataBrickPipelineDetails]:
        """
        Fetch both Databricks Jobs AND DLT Pipelines

        - Jobs from /api/2.1/jobs (existing functionality)
        - DLT Pipelines from /api/2.0/pipelines (new - for direct pipeline access)
        """
        # Fetch regular jobs (existing)
        try:
            for workflow in self.client.list_jobs() or []:
                try:
                    yield DataBrickPipelineDetails(**workflow)
                except Exception as exc:
                    logger.debug(f"Error creating job details: {exc}")
                    continue
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get jobs list due to : {exc}")

        # Fetch DLT pipelines directly (new)
        try:
            for pipeline in self.client.list_pipelines() or []:
                try:
                    # Convert DLT pipeline format to job format for compatibility
                    # DLT pipelines don't have job_id, so we use pipeline_id
                    pipeline_as_job = {
                        "job_id": pipeline.get(
                            "pipeline_id"
                        ),  # Use pipeline_id as job_id
                        "creator_user_name": pipeline.get("creator_user_name"),
                        "created_time": pipeline.get("creation_time", 0),
                        "settings": {
                            "name": pipeline.get("name", "Unnamed Pipeline"),
                            "description": f"DLT Pipeline - {pipeline.get('state', 'UNKNOWN')}",
                            # Add a marker so we know this is a direct DLT pipeline
                            "_is_dlt_pipeline": True,
                            "_pipeline_id": pipeline.get("pipeline_id"),
                        },
                    }
                    yield DataBrickPipelineDetails(**pipeline_as_job)
                    logger.debug(
                        f"Added DLT pipeline: {pipeline.get('name')} ({pipeline.get('pipeline_id')})"
                    )
                except Exception as exc:
                    logger.debug(f"Error creating DLT pipeline details: {exc}")
                    logger.debug(traceback.format_exc())
                    continue
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to get DLT pipelines list due to : {exc}")

        return None

    def get_pipeline_name(
        self, pipeline_details: DataBrickPipelineDetails
    ) -> Optional[str]:
        try:
            return pipeline_details.settings.name
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get pipeline name due to : {exc}")

        return None

    def get_owner(self, owner_name: str) -> Optional[EntityReferenceList]:
        """
        Fetch owner by name from OpenMetadata
        Uses the creator_user_name field from Databricks pipeline/job
        """
        try:
            if owner_name:
                return self.metadata.get_reference_by_name(
                    name=owner_name, is_owner=True
                )
        except Exception as exc:
            logger.warning(f"Error while getting details of user {owner_name} - {exc}")
        return None

    def yield_pipeline(
        self, pipeline_details: DataBrickPipelineDetails
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """Method to Get Pipeline Entity"""
        try:
            description = pipeline_details.settings.description
            pipeline_request = CreatePipelineRequest(
                name=EntityName(str(pipeline_details.job_id)),
                displayName=pipeline_details.settings.name,
                description=Markdown(description) if description else None,
                tasks=self.get_tasks(pipeline_details),
                scheduleInterval=(
                    str(pipeline_details.settings.schedule.cron)
                    if pipeline_details.settings.schedule
                    else None
                ),
                service=FullyQualifiedEntityName(self.context.get().pipeline_service),
                owners=self.get_owner(pipeline_details.creator_user_name),
            )
            yield Either(right=pipeline_request)
            self.register_record(pipeline_request=pipeline_request)

        except TypeError as err:
            yield Either(
                left=StackTraceError(
                    name="Pipeline",
                    error=(
                        f"Error building Databricks Pipeline information from {pipeline_details}."
                        f" There might be Databricks Jobs API version incompatibilities - {err}"
                    ),
                    stackTrace=traceback.format_exc(),
                )
            )
        except ValidationError as err:
            yield Either(
                left=StackTraceError(
                    name="Pipeline",
                    error=f"Error building pydantic model for {pipeline_details} - {err}",
                    stackTrace=traceback.format_exc(),
                )
            )
        except Exception as err:
            yield Either(
                left=StackTraceError(
                    name="Pipeline",
                    error=f"Wild error ingesting pipeline {pipeline_details} - {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_tasks(self, pipeline_details: DataBrickPipelineDetails) -> List[Task]:
        try:
            task_list = []
            for run in self.client.get_job_runs(job_id=pipeline_details.job_id) or []:
                run = DBRun(**run)
                task_list.extend(
                    [
                        Task(
                            name=str(task.name),
                            taskType=pipeline_details.settings.task_type,
                            sourceUrl=(
                                SourceUrl(run.run_page_url)
                                if run.run_page_url
                                else None
                            ),
                            description=(
                                Markdown(task.description) if task.description else None
                            ),
                            downstreamTasks=[
                                depend_task.name
                                for depend_task in task.depends_on or []
                            ],
                        )
                        for task in run.tasks or []
                    ]
                )
            return task_list
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to get tasks list due to : {exc}")
        return None

    def yield_pipeline_status(
        self, pipeline_details: DataBrickPipelineDetails
    ) -> Iterable[OMetaPipelineStatus]:
        try:
            for run in self.client.get_job_runs(job_id=pipeline_details.job_id) or []:
                run = DBRun(**run)
                task_status = [
                    TaskStatus(
                        name=str(task.name),
                        executionStatus=STATUS_MAP.get(
                            run.state.result_state, StatusType.Failed
                        ),
                        startTime=Timestamp(run.start_time),
                        endTime=Timestamp(run.end_time) if run.end_time else None,
                        logLink=run.run_page_url,
                    )
                    for task in run.tasks or []
                ]
                pipeline_status = PipelineStatus(
                    taskStatus=task_status,
                    timestamp=Timestamp(run.start_time),
                    executionStatus=STATUS_MAP.get(
                        run.state.result_state,
                        StatusType.Failed,
                    ),
                )
                pipeline_fqn = fqn.build(
                    metadata=self.metadata,
                    entity_type=Pipeline,
                    service_name=self.context.get().pipeline_service,
                    pipeline_name=self.context.get().pipeline,
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
                    name=pipeline_details.job_id,
                    error=f"Failed to yield pipeline status: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _process_and_validate_column_lineage(
        self,
        column_lineage: List[Tuple[str, str]],
        from_entity: Table,
        to_entity: Table,
    ) -> List[ColumnLineage]:
        """
        Process and validate column lineage
        """
        processed_column_lineage = []
        if column_lineage:
            for column_tuple in column_lineage or []:
                try:
                    if len(column_tuple) < 2:
                        logger.debug(f"Skipping invalid column tuple: {column_tuple}")
                        continue

                    source_col = column_tuple[0]
                    target_col = column_tuple[-1]

                    if not source_col or not target_col:
                        logger.debug(
                            f"Skipping column tuple with empty values: source={source_col}, "
                            f"target={target_col}, to_entity={to_entity.name}"
                        )
                        continue

                    from_column = get_column_fqn(
                        table_entity=from_entity, column=str(source_col)
                    )
                    to_column = get_column_fqn(
                        table_entity=to_entity,
                        column=str(target_col),
                    )
                    if from_column and to_column:
                        processed_column_lineage.append(
                            ColumnLineage(
                                fromColumns=[from_column],
                                toColumn=to_column,
                            )
                        )
                except Exception as err:
                    logger.warning(
                        f"Error processing column lineage {column_tuple}: {err}"
                    )
                    logger.debug(traceback.format_exc())
                    continue
        if not processed_column_lineage:
            logger.warning(
                f"No column lineage found for {from_entity.name} to {to_entity.name}"
            )
        return processed_column_lineage or []

    def _find_kafka_topic(self, topic_name: str) -> Optional[Topic]:
        """
        Find Kafka topic in OpenMetadata using smart discovery

        Strategy:
        1. If messagingServiceNames configured -> search only those (faster)
        2. Else -> search ALL messaging services using search API
        """
        # Strategy 1: Search configured services (fast path)
        if getattr(self.source_config, "messagingServiceNames", None):
            for service_name in self.source_config.messagingServiceNames:
                try:
                    topic_fqn = fqn.build(
                        metadata=self.metadata,
                        entity_type=Topic,
                        service_name=service_name,
                        topic_name=topic_name,
                    )
                    topic = self.metadata.get_by_name(entity=Topic, fqn=topic_fqn)
                    if topic:
                        logger.debug(
                            f"Found topic {topic_name} in configured service {service_name}"
                        )
                        return topic
                except Exception as exc:
                    logger.debug(
                        f"Could not find topic {topic_name} in service {service_name}: {exc}"
                    )
                    continue
        else:
            # Strategy 2: Search across ALL services using search API
            try:
                logger.debug(
                    f"No messaging services configured, searching all services for {topic_name}"
                )

                # Use OpenMetadata's search API to find topic by name
                search_results = self.metadata.es_search_from_fqn(
                    entity_type=Topic,
                    fqn_search_string=topic_name,
                )

                # Get first matching result
                if search_results and search_results.get("hits", {}).get("hits"):
                    for hit in search_results["hits"]["hits"]:
                        source = hit.get("_source", {})
                        # Match exact topic name (not FQN prefix match)
                        if source.get("name") == topic_name:
                            topic_fqn = source.get("fullyQualifiedName")
                            if topic_fqn:
                                topic = self.metadata.get_by_name(
                                    entity=Topic, fqn=topic_fqn
                                )
                                if topic:
                                    logger.info(
                                        f"Found topic {topic_name} via search: {topic_fqn}"
                                    )
                                    return topic

            except Exception as exc:
                logger.debug(f"Search failed for topic {topic_name}: {exc}")

        logger.debug(f"Topic {topic_name} not found")
        return None

    def _yield_kafka_lineage(
        self, pipeline_details: DataBrickPipelineDetails, pipeline_entity: Pipeline
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Extract and yield Kafka topic lineage from DLT pipeline source code
        Continues processing even if individual steps fail
        Uses smart topic discovery - works with or without messagingServiceNames config
        """
        try:
            # Check for pipeline_id - either from direct DLT pipeline or from job's pipeline_task
            pipeline_id = None

            # Method 1: Check if this is a direct DLT pipeline (has _pipeline_id marker)
            try:
                if hasattr(pipeline_details.settings, "__dict__"):
                    settings_dict = pipeline_details.settings.__dict__
                    if settings_dict.get("_is_dlt_pipeline"):
                        pipeline_id = settings_dict.get("_pipeline_id")
                        logger.info(
                            f"Processing direct DLT pipeline: {pipeline_id} ({pipeline_details.settings.name})"
                        )
            except Exception as exc:
                logger.debug(f"Error checking for direct DLT pipeline: {exc}")

            # Method 2: Check for pipeline_task in job settings (existing logic)
            if not pipeline_id:
                try:
                    # Try to get tasks from __root_fields__ first (Pydantic v2)
                    tasks = getattr(pipeline_details.settings, "tasks", None)

                    # If not found, try __dict__ (raw data)
                    if not tasks:
                        raw_dict = getattr(pipeline_details, "__dict__", {})
                        settings_dict = raw_dict.get("settings", {})
                        if isinstance(settings_dict, dict):
                            tasks = settings_dict.get("tasks")

                    logger.debug(f"Found tasks type: {type(tasks)}, value: {tasks}")

                    if tasks:
                        for task in tasks:
                            # Check if task has pipeline_task attribute
                            pipeline_task = getattr(task, "pipeline_task", None)
                            if not pipeline_task and isinstance(task, dict):
                                pipeline_task = task.get("pipeline_task")

                            if pipeline_task:
                                if isinstance(pipeline_task, dict):
                                    pipeline_id = pipeline_task.get("pipeline_id")
                                else:
                                    pipeline_id = getattr(
                                        pipeline_task, "pipeline_id", None
                                    )

                                if pipeline_id:
                                    logger.info(
                                        f"Found DLT pipeline_id from job task: {pipeline_id} for job {pipeline_details.job_id}"
                                    )
                                    break
                except Exception as exc:
                    logger.debug(f"Error checking for pipeline tasks: {exc}")
                    logger.debug(traceback.format_exc())

            if not pipeline_id:
                logger.debug(f"No DLT pipeline found for job {pipeline_details.job_id}")
                return None

            # Get pipeline configuration
            try:
                pipeline_config = self.client.get_pipeline_details(pipeline_id)
                if not pipeline_config:
                    logger.debug(f"Could not fetch pipeline config for {pipeline_id}")
                    return None
            except Exception as exc:
                logger.warning(
                    f"Failed to fetch pipeline config for {pipeline_id}: {exc}"
                )
                return None

            # Extract notebook/file paths from libraries (pass client for glob expansion)
            try:
                library_paths = get_pipeline_libraries(
                    pipeline_config, client=self.client
                )
                logger.debug(
                    f"Found {len(library_paths)} libraries for pipeline {pipeline_id}"
                )
            except Exception as exc:
                logger.warning(f"Failed to extract library paths: {exc}")
                return None

            # Process each library to extract Kafka sources
            for lib_path in library_paths:
                try:
                    source_code = self.client.export_notebook_source(lib_path)
                    if not source_code:
                        logger.debug(f"Could not export source for {lib_path}")
                        continue

                    kafka_sources = extract_kafka_sources(source_code)
                    logger.debug(
                        f"Found {len(kafka_sources)} Kafka sources in {lib_path}"
                    )

                    # Create lineage for each Kafka topic found
                    for kafka_config in kafka_sources:
                        for topic_name in kafka_config.topics:
                            try:
                                # Use smart discovery to find topic
                                kafka_topic = self._find_kafka_topic(topic_name)

                                if kafka_topic:
                                    logger.info(
                                        f"Creating Kafka lineage: {topic_name} -> Pipeline {pipeline_details.job_id}"
                                    )

                                    yield Either(
                                        right=AddLineageRequest(
                                            edge=EntitiesEdge(
                                                fromEntity=EntityReference(
                                                    id=kafka_topic.id,
                                                    type="topic",
                                                ),
                                                toEntity=EntityReference(
                                                    id=pipeline_entity.id.root,
                                                    type="pipeline",
                                                ),
                                                lineageDetails=LineageDetails(
                                                    pipeline=EntityReference(
                                                        id=pipeline_entity.id.root,
                                                        type="pipeline",
                                                    ),
                                                    source=LineageSource.PipelineLineage,
                                                ),
                                            )
                                        )
                                    )
                                else:
                                    logger.debug(
                                        f"Kafka topic {topic_name} not found in any messaging service"
                                    )
                            except Exception as exc:
                                logger.warning(
                                    f"Failed to process topic {topic_name}: {exc}"
                                )
                                continue
                except Exception as exc:
                    logger.warning(
                        f"Failed to process library {lib_path}: {exc}. Continuing with next library."
                    )
                    continue

        except Exception as exc:
            logger.error(
                f"Unexpected error in Kafka lineage extraction for job {pipeline_details.job_id}: {exc}"
            )
            logger.debug(traceback.format_exc())

    def yield_pipeline_lineage_details(
        self, pipeline_details: DataBrickPipelineDetails
    ) -> Iterable[Either[AddLineageRequest]]:
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

            # Extract Kafka topic lineage from source code
            # Works automatically - no configuration required!
            yield from self._yield_kafka_lineage(pipeline_details, pipeline_entity)

            table_lineage_list = self.client.get_table_lineage(
                job_id=pipeline_details.job_id
            )
            logger.debug(
                f"Processing pipeline lineage for job {pipeline_details.job_id}"
            )
            if table_lineage_list:
                for table_lineage in table_lineage_list:
                    source_table_full_name = table_lineage.get("source_table_full_name")
                    target_table_full_name = table_lineage.get("target_table_full_name")
                    if source_table_full_name and target_table_full_name:
                        source = fqn.split_table_name(source_table_full_name)
                        target = fqn.split_table_name(target_table_full_name)
                        for dbservicename in self.get_db_service_names() or ["*"]:

                            from_entity = self.metadata.get_by_name(
                                entity=Table,
                                fqn=fqn.build(
                                    metadata=self.metadata,
                                    entity_type=Table,
                                    table_name=source.get("table"),
                                    database_name=source.get("database"),
                                    schema_name=source.get("database_schema"),
                                    service_name=dbservicename,
                                ),
                            )

                            if from_entity is None:
                                continue

                            to_entity = self.metadata.get_by_name(
                                entity=Table,
                                fqn=fqn.build(
                                    metadata=self.metadata,
                                    entity_type=Table,
                                    table_name=target.get("table"),
                                    database_name=target.get("database"),
                                    schema_name=target.get("database_schema"),
                                    service_name=dbservicename,
                                ),
                            )

                            if to_entity is None:
                                continue

                            processed_column_lineage = (
                                self._process_and_validate_column_lineage(
                                    column_lineage=self.client.get_column_lineage(
                                        job_id=pipeline_details.job_id,
                                        TableKey=(
                                            source_table_full_name,
                                            target_table_full_name,
                                        ),
                                    ),
                                    from_entity=from_entity,
                                    to_entity=to_entity,
                                )
                            )

                            lineage_details = LineageDetails(
                                pipeline=EntityReference(
                                    id=pipeline_entity.id.root, type="pipeline"
                                ),
                                source=LineageSource.PipelineLineage,
                                columnsLineage=processed_column_lineage,
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

                else:
                    logger.debug(
                        f"No source or target table full name found for job {pipeline_details.job_id}"
                    )
            else:
                logger.debug(
                    f"No table lineage found for job {pipeline_details.job_id}"
                )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.job_id,
                    error=f"Wild error ingesting pipeline lineage {pipeline_details} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
