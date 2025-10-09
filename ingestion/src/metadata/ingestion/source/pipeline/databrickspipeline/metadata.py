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
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.sql_lineage import get_column_fqn
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.databrickspipeline.kafka_parser import (
    extract_dlt_table_names,
    extract_kafka_sources,
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
        try:
            for workflow in self.client.list_jobs() or []:
                yield DataBrickPipelineDetails(**workflow)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get jobs list due to : {exc}")

        # Fetch DLT pipelines directly (new)
        try:
            for pipeline in self.client.list_pipelines() or []:
                try:
                    yield DataBrickPipelineDetails(**pipeline)
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
            if pipeline_details.pipeline_id:
                return pipeline_details.name
            return pipeline_details.settings.name if pipeline_details.settings else None
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get pipeline name due to : {exc}")

        return None

    def yield_pipeline(
        self, pipeline_details: DataBrickPipelineDetails
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """Method to Get Pipeline Entity"""
        try:
            if pipeline_details.pipeline_id:
                description = None
                display_name = pipeline_details.name
                entity_name = str(pipeline_details.pipeline_id)
                schedule_interval = None
            else:
                description = (
                    pipeline_details.settings.description
                    if pipeline_details.settings
                    else None
                )
                display_name = (
                    pipeline_details.settings.name
                    if pipeline_details.settings
                    else None
                )
                entity_name = str(pipeline_details.job_id)
                schedule_interval = (
                    str(pipeline_details.settings.schedule.cron)
                    if pipeline_details.settings and pipeline_details.settings.schedule
                    else None
                )

            pipeline_request = CreatePipelineRequest(
                name=EntityName(entity_name),
                displayName=display_name,
                description=Markdown(description) if description else None,
                tasks=self.get_tasks(pipeline_details),
                scheduleInterval=schedule_interval,
                service=FullyQualifiedEntityName(self.context.get().pipeline_service),
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
            if not pipeline_details.job_id:
                return []

            task_list = []
            for run in self.client.get_job_runs(job_id=pipeline_details.job_id) or []:
                run = DBRun(**run)
                task_list.extend(
                    [
                        Task(
                            name=str(task.name),
                            taskType=(
                                pipeline_details.settings.task_type
                                if pipeline_details.settings
                                else None
                            ),
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
            if not pipeline_details.job_id:
                return

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
                    name=pipeline_details.id,
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
        try:
            topic_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Topic,
                service_name=None,
                topic_name=topic_name,
                skip_es_search=False,
            )
            topic = self.metadata.get_by_name(entity=Topic, fqn=topic_fqn)
            if topic:
                logger.debug(f"Found topic {topic_name}")
                return topic
        except Exception as exc:
            logger.debug(f"Could not find topic {topic_name}: {exc}")
        logger.debug(f"Topic {topic_name} not found")
        return None

    def _yield_kafka_lineage(
        self, pipeline_details: DataBrickPipelineDetails, pipeline_entity: Pipeline
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Extract and yield Kafka topic lineage from DLT pipeline source code
        Only processes DLT pipelines (with pipeline_id), not regular jobs
        Creates lineage: Kafka topic -> DLT table (with pipeline in lineageDetails)
        """
        try:
            # Only process DLT pipelines - check for pipeline_id
            # For pure DLT pipelines, pipeline_id is set directly
            pipeline_id = pipeline_details.pipeline_id

            # For jobs with DLT pipeline tasks, check settings
            if not pipeline_id and pipeline_details.settings:
                try:
                    tasks = pipeline_details.settings.tasks
                    logger.debug(
                        f"Checking for DLT pipeline in job {pipeline_details.job_id}: "
                        f"{len(tasks) if tasks else 0} tasks found"
                    )

                    if tasks:
                        for task in tasks:
                            logger.debug(
                                f"Task: {task.name}, has pipeline_task: {task.pipeline_task is not None}"
                            )
                            # Check for direct DLT pipeline task
                            if task.pipeline_task and task.pipeline_task.pipeline_id:
                                pipeline_id = task.pipeline_task.pipeline_id
                                logger.info(
                                    f"Found DLT pipeline_id from job task: {pipeline_id} for job {pipeline_details.job_id}"
                                )
                                break
                except Exception as exc:
                    logger.debug(f"Error checking for pipeline tasks: {exc}")
                    logger.debug(traceback.format_exc())

            # Only process if we have a DLT pipeline_id
            if not pipeline_id:
                logger.debug(
                    f"No DLT pipeline_id found for {pipeline_details.job_id or pipeline_details.pipeline_id}, skipping Kafka lineage"
                )
                return

            logger.info(f"Processing Kafka lineage for DLT pipeline: {pipeline_id}")

            # Get pipeline configuration and extract target catalog/schema
            target_catalog = None
            target_schema = None
            notebook_paths = []
            try:
                pipeline_config = self.client.get_pipeline_details(pipeline_id)
                if not pipeline_config:
                    logger.debug(f"Could not fetch pipeline config for {pipeline_id}")
                    return

                # Extract spec for detailed configuration
                spec = pipeline_config.get("spec", {})
                logger.info(
                    f"Pipeline spec keys: {list(spec.keys()) if spec else 'None'}"
                )

                # Extract target catalog and schema for DLT tables
                target_catalog = spec.get("catalog") if spec else None
                # Schema can be in 'target' or 'schema' field
                target_schema = (
                    spec.get("target") or spec.get("schema") if spec else None
                )
                logger.debug(
                    f"DLT pipeline target: catalog={target_catalog}, schema={target_schema}"
                )

                # Extract notebook/file paths from libraries in spec
                notebook_paths = []
                if spec and "libraries" in spec:
                    libraries = spec["libraries"]
                    logger.info(f"Found {len(libraries)} libraries in spec")
                    for lib in libraries:
                        # Library can be dict or have different structures
                        if isinstance(lib, dict):
                            # Check for notebook path
                            if "notebook" in lib and lib["notebook"]:
                                notebook = lib["notebook"]
                                if isinstance(notebook, dict):
                                    path = notebook.get("path")
                                else:
                                    path = notebook
                                if path:
                                    notebook_paths.append(path)
                                    logger.info(f"Found notebook in library: {path}")
                            # Check for glob pattern
                            elif "glob" in lib and lib["glob"]:
                                glob_pattern = lib["glob"]
                                if isinstance(glob_pattern, dict):
                                    include_pattern = glob_pattern.get("include")
                                    if include_pattern:
                                        # Convert glob pattern to directory path
                                        # e.g., "/path/**" -> "/path/"
                                        base_path = include_pattern.replace(
                                            "/**", "/"
                                        ).replace("**", "")
                                        notebook_paths.append(base_path)
                                        logger.info(
                                            f"Found glob pattern, using base path: {base_path}"
                                        )

                # Also check for source path in spec configuration
                if not notebook_paths and spec:
                    source_path = None

                    # Check spec.configuration for source path
                    if "configuration" in spec:
                        config = spec["configuration"]
                        source_path = config.get("source_path") or config.get("source")

                    # Check development settings
                    if not source_path and "development" in spec:
                        source_path = spec["development"].get("source_path")

                    if source_path:
                        logger.info(
                            f"Found source_path in pipeline spec: {source_path}"
                        )
                        notebook_paths.append(source_path)

                logger.debug(
                    f"Found {len(notebook_paths)} notebook paths for pipeline {pipeline_id}"
                )
            except Exception as exc:
                logger.warning(
                    f"Failed to fetch pipeline config for {pipeline_id}: {exc}"
                )
                return

            if not notebook_paths:
                logger.debug(f"No notebook paths found for pipeline {pipeline_id}")
                return

            # Expand directories to individual notebook files
            expanded_paths = []
            for path in notebook_paths:
                # If path ends with /, it's a directory - list all notebooks in it
                if path.endswith("/"):
                    try:
                        # List workspace directory to get all notebooks
                        objects = self.client.list_workspace_objects(path)
                        if objects:
                            for obj in objects:
                                obj_type = obj.get("object_type")
                                if obj_type in ("NOTEBOOK", "FILE"):
                                    notebook_path = obj.get("path")
                                    if notebook_path:
                                        expanded_paths.append(notebook_path)
                                        logger.info(
                                            f"Found {obj_type.lower()} in directory: {notebook_path}"
                                        )
                        if not expanded_paths:
                            logger.debug(f"No notebooks found in directory {path}")
                    except Exception as exc:
                        logger.debug(f"Could not list directory {path}: {exc}")
                else:
                    expanded_paths.append(path)

            logger.info(
                f"Processing {len(expanded_paths)} notebook(s) for pipeline {pipeline_id}"
            )

            # Process each notebook to extract Kafka sources and DLT tables
            for lib_path in expanded_paths:
                try:
                    source_code = self.client.export_notebook_source(lib_path)
                    if not source_code:
                        logger.debug(f"Could not export source for {lib_path}")
                        continue

                    # Extract Kafka topics
                    kafka_sources = extract_kafka_sources(source_code)
                    if kafka_sources:
                        topics_found = [t for ks in kafka_sources for t in ks.topics]
                        logger.info(
                            f"Found {len(kafka_sources)} Kafka sources with topics {topics_found} in {lib_path}"
                        )
                    else:
                        logger.debug(f"No Kafka sources found in {lib_path}")

                    # Extract DLT table names
                    dlt_table_names = extract_dlt_table_names(source_code)
                    if dlt_table_names:
                        logger.info(
                            f"Found {len(dlt_table_names)} DLT tables in {lib_path}: {dlt_table_names}"
                        )
                    else:
                        logger.debug(f"No DLT tables found in {lib_path}")

                    if not dlt_table_names or not kafka_sources:
                        logger.debug(
                            f"Skipping Kafka lineage for {lib_path} - need both Kafka sources and DLT tables"
                        )
                        continue

                    # Create lineage for each Kafka topic -> DLT table
                    for kafka_config in kafka_sources:
                        for topic_name in kafka_config.topics:
                            try:
                                # Use smart discovery to find topic
                                kafka_topic = self._find_kafka_topic(topic_name)

                                if not kafka_topic:
                                    logger.debug(
                                        f"Kafka topic {topic_name} not found in any messaging service"
                                    )
                                    continue

                                # Create lineage to each DLT table in this notebook
                                for table_name in dlt_table_names:
                                    # Build table FQN: catalog.schema.table
                                    for (
                                        dbservicename
                                    ) in self.get_db_service_names() or ["*"]:
                                        target_table_fqn = fqn.build(
                                            metadata=self.metadata,
                                            entity_type=Table,
                                            table_name=table_name,
                                            database_name=target_catalog,
                                            schema_name=target_schema,
                                            service_name=dbservicename,
                                        )

                                        target_table_entity = self.metadata.get_by_name(
                                            entity=Table, fqn=target_table_fqn
                                        )

                                        if target_table_entity:
                                            logger.info(
                                                f"Creating Kafka lineage: {topic_name} -> {target_catalog}.{target_schema}.{table_name} (via pipeline {pipeline_id})"
                                            )

                                            yield Either(
                                                right=AddLineageRequest(
                                                    edge=EntitiesEdge(
                                                        fromEntity=EntityReference(
                                                            id=kafka_topic.id,
                                                            type="topic",
                                                        ),
                                                        toEntity=EntityReference(
                                                            id=target_table_entity.id.root,
                                                            type="table",
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
                                            break
                                        else:
                                            logger.debug(
                                                f"Target table not found in OpenMetadata: {target_table_fqn}"
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

            if not pipeline_details.job_id:
                return

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
                    name=pipeline_details.id,
                    error=f"Wild error ingesting pipeline lineage {pipeline_details} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
