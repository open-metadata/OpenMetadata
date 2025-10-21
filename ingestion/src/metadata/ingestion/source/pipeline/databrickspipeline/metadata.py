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
    extract_dlt_table_dependencies,
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

    def __init__(self, config, metadata):
        super().__init__(config, metadata)
        # Cache for Databricks services to avoid repeated API calls
        self._databricks_services_cached = False
        self._databricks_services: List[str] = []

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
            if not pipeline_details.settings or not pipeline_details.settings.tasks:
                return None

            job_url = f"https://{self.service_connection.hostPort}/#job/{pipeline_details.job_id}"

            return [
                Task(
                    name=str(task.name),
                    taskType=pipeline_details.settings.task_type,
                    sourceUrl=SourceUrl(job_url),
                    description=(
                        Markdown(task.description) if task.description else None
                    ),
                    downstreamTasks=[
                        depend_task.name for depend_task in task.depends_on or []
                    ],
                )
                for task in pipeline_details.settings.tasks
            ]
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

    def _get_databricks_services(self) -> List[str]:
        """
        Get list of all Databricks/Unity Catalog database service names from OpenMetadata

        Caches the result to avoid repeated API calls during lineage extraction.
        Returns list of service names that are of type Databricks or UnityCatalog.
        """
        # Return cached services if already fetched
        if self._databricks_services_cached:
            logger.debug(
                f"Using cached Databricks services: {self._databricks_services}"
            )
            return self._databricks_services

        try:
            from metadata.generated.schema.entity.services.databaseService import (
                DatabaseService,
            )

            logger.info("Fetching Databricks/Unity Catalog database services...")

            # List all database services
            services = self.metadata.list_all_entities(
                entity=DatabaseService, fields=["serviceType"]
            )

            databricks_services = []
            for service in services or []:
                try:
                    service_type = (
                        service.serviceType.value
                        if hasattr(service, "serviceType")
                        else None
                    )
                    service_name = (
                        service.name.root
                        if hasattr(service.name, "root")
                        else service.name
                    )

                    logger.debug(f"  Service: {service_name}, Type: {service_type}")

                    # Check if it's a Databricks or Unity Catalog service
                    if service_type and service_type.lower() in [
                        "databricks",
                        "unitycatalog",
                    ]:
                        databricks_services.append(service_name)
                        logger.debug(
                            f"    ✓ Databricks/Unity Catalog service: {service_name}"
                        )

                except Exception as exc:
                    logger.debug(f"  Error processing service: {exc}")
                    continue

            # Cache the results
            self._databricks_services = databricks_services
            self._databricks_services_cached = True

            logger.info(
                f"Found {len(databricks_services)} Databricks/Unity Catalog service(s): {databricks_services}"
            )
            return databricks_services

        except Exception as exc:
            logger.warning(f"Error fetching Databricks services: {exc}")
            logger.debug(traceback.format_exc())
            # Cache empty list to avoid repeated failures
            self._databricks_services = []
            self._databricks_services_cached = True
            return []

    def _find_dlt_table(
        self, table_name: str, catalog: Optional[str], schema: Optional[str]
    ) -> Optional[Table]:
        """
        Find DLT table in OpenMetadata by iterating through Databricks services

        DLT pipelines only write to Databricks/Unity Catalog Delta tables.
        Uses catalog.schema.table_name from DLT spec to build FQN for each Databricks service.

        Args:
            table_name: Table name extracted from notebook code
            catalog: Catalog name from DLT pipeline spec (database in OpenMetadata)
            schema: Schema name from DLT pipeline spec

        Returns:
            Table entity if found, None otherwise
        """
        try:
            logger.debug(
                f"Searching for DLT table: catalog={catalog}, schema={schema}, table={table_name}"
            )

            # Get all Databricks/Unity Catalog services (uses cache)
            databricks_services = self._get_databricks_services()

            if not databricks_services:
                logger.warning(
                    "No Databricks/Unity Catalog services found in OpenMetadata"
                )
                # Fall back to configured dbServiceNames if available
                databricks_services = self.get_db_service_names() or []
                if databricks_services:
                    logger.info(
                        f"Using configured database services: {databricks_services}"
                    )

            if not databricks_services:
                return None

            logger.debug(f"Trying {len(databricks_services)} Databricks service(s)")

            # Try each Databricks service with exact case
            for service_name in databricks_services:
                try:
                    # Build FQN: service.catalog.schema.table
                    table_fqn = fqn.build(
                        metadata=self.metadata,
                        entity_type=Table,
                        service_name=service_name,
                        database_name=catalog,
                        schema_name=schema,
                        table_name=table_name,
                    )

                    logger.debug(f"  Trying FQN: {table_fqn}")

                    # Try to get table
                    table = self.metadata.get_by_name(entity=Table, fqn=table_fqn)
                    if table:
                        logger.info(f"Found DLT table with FQN: {table_fqn}")
                        return table

                except Exception as exc:
                    logger.debug(f"  Error checking service {service_name}: {exc}")
                    continue

            # If no exact match found, try case-insensitive (Unity Catalog lowercases table names)
            logger.debug("Exact match not found, trying lowercase variants...")
            for service_name in databricks_services:
                try:
                    table_fqn = fqn.build(
                        metadata=self.metadata,
                        entity_type=Table,
                        service_name=service_name,
                        database_name=catalog.lower() if catalog else None,
                        schema_name=schema.lower() if schema else None,
                        table_name=table_name.lower(),
                    )

                    logger.debug(f"  Trying lowercase FQN: {table_fqn}")

                    table = self.metadata.get_by_name(entity=Table, fqn=table_fqn)
                    if table:
                        logger.info(
                            f"Found DLT table with FQN (lowercase): {table_fqn}"
                        )
                        return table

                except Exception as exc:
                    logger.debug(
                        f"  Error checking service {service_name} (lowercase): {exc}"
                    )
                    continue

        except Exception as exc:
            logger.debug(f"Could not find DLT table {table_name}: {exc}")
            logger.debug(traceback.format_exc())

        logger.warning(
            f"DLT table not found: {catalog}.{schema}.{table_name}. "
            f"Ensure the table is ingested from a Databricks/Unity Catalog database service."
        )
        return None

    def _find_kafka_topic(self, topic_name: str) -> Optional[Topic]:
        """
        Find Kafka topic in OpenMetadata using Elasticsearch search

        Handles topic names with dots (e.g., "dev.ern.cashout.moneyRequest_v1")
        by searching with wildcard pattern: *.topic_name

        Topic FQN format: MessagingServiceName.TopicName
        When TopicName has dots, it's quoted: MessagingServiceName."dev.ern.topic"
        """
        try:
            logger.debug(
                f"Searching for topic {topic_name} across all messaging services"
            )

            # Use ES search with wildcard pattern to find topic regardless of service
            # Pattern: *.topic_name or *."topic.with.dots"
            from metadata.utils.elasticsearch import ES_INDEX_MAP

            # Quote the topic name if it contains dots
            search_topic_name = f'"{topic_name}"' if "." in topic_name else topic_name
            search_pattern = f"*.{search_topic_name}"

            logger.debug(f"Using search pattern: {search_pattern}")

            # Search using ES field query for FQN pattern matching
            query_string = f"/search/fieldQuery?fieldName=fullyQualifiedName&fieldValue={search_pattern}&from=0&size=10&index={ES_INDEX_MAP['Topic']}&deleted=false"

            try:
                response = self.metadata.client.get(query_string)
                if response and response.get("hits", {}).get("hits"):
                    # Get the first matching topic
                    hit = response["hits"]["hits"][0]
                    topic_fqn = hit["_source"]["fullyQualifiedName"]

                    # Fetch full topic entity
                    topic = self.metadata.get_by_name(entity=Topic, fqn=topic_fqn)
                    if topic:
                        logger.info(f"Found topic {topic_name} with FQN: {topic_fqn}")
                        return topic
            except Exception as search_exc:
                logger.debug(f"ES search error: {search_exc}")
                logger.debug(traceback.format_exc())

        except Exception as exc:
            logger.debug(f"Could not find topic {topic_name}: {exc}")
            logger.debug(traceback.format_exc())

        logger.warning(
            f"Topic {topic_name} not found in OpenMetadata. "
            f"Ensure the topic is ingested from a messaging service."
        )
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
            logger.info("=" * 80)
            logger.info(f"KAFKA LINEAGE EXTRACTION STARTED")
            logger.info(
                f"Pipeline: {pipeline_details.name if hasattr(pipeline_details, 'name') else 'N/A'}"
            )
            logger.info(f"Job ID: {pipeline_details.job_id}")
            logger.info(f"Pipeline ID: {pipeline_details.pipeline_id}")
            logger.info("=" * 80)

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
                                    f"✓ Found DLT pipeline_id from job task: {pipeline_id} for job {pipeline_details.job_id}"
                                )
                                break
                except Exception as exc:
                    logger.debug(f"Error checking for pipeline tasks: {exc}")
                    logger.debug(traceback.format_exc())

            # Only process if we have a DLT pipeline_id
            if not pipeline_id:
                logger.info(
                    f"⊗ No DLT pipeline_id found - skipping Kafka lineage extraction"
                )
                logger.info(f"   Job ID: {pipeline_details.job_id}")
                logger.info(f"   Pipeline ID: {pipeline_details.pipeline_id}")
                logger.info("=" * 80)
                return

            logger.info(f"✓ Processing Kafka lineage for DLT pipeline: {pipeline_id}")

            # Get pipeline configuration and extract target catalog/schema
            target_catalog = None
            target_schema = None
            notebook_paths = []
            try:
                logger.info(f"⟳ Fetching pipeline configuration for {pipeline_id}...")
                pipeline_config = self.client.get_pipeline_details(pipeline_id)
                if not pipeline_config:
                    logger.warning(
                        f"✗ Could not fetch pipeline config for {pipeline_id}"
                    )
                    logger.info("=" * 80)
                    return

                logger.debug(f"✓ Pipeline config fetched successfully")
                logger.debug(f"   Config keys: {list(pipeline_config.keys())}")

                # Extract spec for detailed configuration
                spec = pipeline_config.get("spec", {})
                logger.info(f"✓ Pipeline spec extracted")
                logger.info(f"   Spec keys: {list(spec.keys()) if spec else 'None'}")

                # Extract target catalog and schema for DLT tables
                target_catalog = spec.get("catalog") if spec else None
                # Schema can be in 'target' or 'schema' field
                target_schema = (
                    spec.get("target") or spec.get("schema") if spec else None
                )
                logger.info(f"✓ DLT Target Location:")
                logger.info(f"   Catalog: {target_catalog or 'NOT SET'}")
                logger.info(f"   Schema: {target_schema or 'NOT SET'}")

                # Extract notebook/file paths from libraries in spec
                notebook_paths = []
                if spec and "libraries" in spec:
                    libraries = spec["libraries"]
                    logger.info(
                        f"⟳ Extracting notebook paths from {len(libraries)} libraries..."
                    )
                    for idx, lib in enumerate(libraries):
                        logger.debug(f"   Library {idx + 1}: {lib}")
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
                                    logger.info(f"   ✓ Found notebook: {path}")
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
                                            f"   ✓ Found glob pattern, using base path: {base_path}"
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
                            f"   ✓ Found source_path in pipeline spec: {source_path}"
                        )
                        notebook_paths.append(source_path)

                logger.info(f"✓ Total notebook paths found: {len(notebook_paths)}")
                for idx, path in enumerate(notebook_paths):
                    logger.info(f"   {idx + 1}. {path}")
            except Exception as exc:
                logger.error(
                    f"✗ Failed to fetch pipeline config for {pipeline_id}: {exc}"
                )
                logger.debug(traceback.format_exc())
                logger.info("=" * 80)
                return

            if not notebook_paths:
                logger.warning(f"✗ No notebook paths found for pipeline {pipeline_id}")
                logger.info(
                    "   Cannot extract Kafka lineage without notebook source code"
                )
                logger.info("=" * 80)
                return

            # Expand directories to individual notebook files
            logger.info(f"⟳ Expanding directory paths to individual notebooks...")
            expanded_paths = []
            for path in notebook_paths:
                # If path ends with /, it's a directory - list all notebooks in it
                if path.endswith("/"):
                    try:
                        logger.debug(f"   Listing directory: {path}")
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
                                            f"   ✓ Found {obj_type.lower()}: {notebook_path}"
                                        )
                        if not expanded_paths:
                            logger.debug(f"   ⊗ No notebooks found in directory {path}")
                    except Exception as exc:
                        logger.warning(f"   ✗ Could not list directory {path}: {exc}")
                        logger.debug(traceback.format_exc())
                else:
                    expanded_paths.append(path)
                    logger.debug(f"   Direct path: {path}")

            logger.info(f"✓ Total notebooks to process: {len(expanded_paths)}")

            # Process each notebook to extract Kafka sources and DLT tables
            logger.info("-" * 80)
            logger.info(f"PROCESSING NOTEBOOKS FOR KAFKA LINEAGE")
            logger.info("-" * 80)

            for idx, lib_path in enumerate(expanded_paths, 1):
                try:
                    logger.info(f"\n📓 Notebook {idx}/{len(expanded_paths)}: {lib_path}")
                    logger.info(f"⟳ Exporting notebook source code...")

                    source_code = self.client.export_notebook_source(lib_path)
                    if not source_code:
                        logger.warning(f"✗ Could not export source for {lib_path}")
                        continue

                    logger.info(
                        f"✓ Source code exported ({len(source_code)} characters)"
                    )

                    # Log full source code for debugging
                    logger.debug(f"   ===== FULL NOTEBOOK SOURCE CODE =====")
                    for i, line in enumerate(source_code.split("\n"), 1):
                        logger.debug(f"   {i:3d}: {line}")
                    logger.debug(f"   ===== END OF SOURCE CODE =====")

                    # Extract Kafka topics
                    logger.info(f"⟳ Parsing Kafka sources from notebook...")
                    logger.debug(f"   Looking for patterns:")
                    logger.debug(
                        f"   - Kafka: .format('kafka')...option('subscribe', 'topic')"
                    )
                    logger.debug(f"   - DLT: @dlt.table(name='table_name')")
                    kafka_sources = extract_kafka_sources(source_code)
                    if kafka_sources:
                        topics_found = [t for ks in kafka_sources for t in ks.topics]
                        logger.info(
                            f"✓ Found {len(kafka_sources)} Kafka source(s) with {len(topics_found)} topic(s):"
                        )
                        for ks_idx, ks in enumerate(kafka_sources, 1):
                            logger.info(f"   Kafka Source {ks_idx}:")
                            logger.info(f"     Topics: {ks.topics}")
                            logger.info(
                                f"     Bootstrap Servers: {ks.bootstrap_servers or 'NOT SET'}"
                            )
                            logger.info(
                                f"     Group ID Prefix: {ks.group_id_prefix or 'NOT SET'}"
                            )
                    else:
                        logger.info(f"⊗ No Kafka sources found in notebook")

                    # Extract DLT table dependencies
                    logger.info(f"⟳ Parsing DLT table dependencies from notebook...")
                    dlt_dependencies = extract_dlt_table_dependencies(source_code)
                    if dlt_dependencies:
                        logger.info(
                            f"✓ Found {len(dlt_dependencies)} DLT table(s) with dependencies"
                        )
                        for dep in dlt_dependencies:
                            s3_info = (
                                f", reads_from_s3={dep.reads_from_s3}, s3_locations={dep.s3_locations}"
                                if dep.reads_from_s3
                                else ""
                            )
                            logger.info(
                                f"   - {dep.table_name}: depends_on={dep.depends_on}, "
                                f"reads_from_kafka={dep.reads_from_kafka}{s3_info}"
                            )
                    else:
                        logger.info(f"⊗ No DLT table dependencies found in notebook")

                    # Check if we have anything to process
                    has_kafka = kafka_sources and len(kafka_sources) > 0
                    has_s3 = any(dep.reads_from_s3 for dep in dlt_dependencies)
                    has_tables = dlt_dependencies and len(dlt_dependencies) > 0

                    if not dlt_dependencies:
                        logger.warning(
                            f"⊗ Skipping lineage for this notebook - no DLT tables found"
                        )
                        continue

                    if not has_kafka and not has_s3:
                        logger.info(
                            f"⊗ No external sources (Kafka or S3) found in this notebook - only table-to-table lineage will be created"
                        )

                    logger.info(f"✓ Notebook has DLT tables - creating lineage...")
                    if has_kafka:
                        logger.info(f"   Kafka sources: {len(kafka_sources)}")
                    if has_s3:
                        s3_count = sum(
                            len(dep.s3_locations)
                            for dep in dlt_dependencies
                            if dep.reads_from_s3
                        )
                        logger.info(f"   S3 sources: {s3_count} location(s)")

                    # Create lineage edges based on dependencies
                    logger.info(f"\n⟳ Creating lineage edges...")
                    lineage_created = 0

                    # Step 1: Create Kafka topic -> DLT table lineage
                    # Build a map to identify which tables/views read from external sources (Kafka/S3)
                    external_sources_map = {}
                    for dep in dlt_dependencies:
                        if dep.reads_from_kafka or dep.reads_from_s3:
                            external_sources_map[dep.table_name] = True

                    for kafka_config in kafka_sources:
                        for topic_name in kafka_config.topics:
                            try:
                                logger.info(
                                    f"\n   🔍 Processing Kafka topic: {topic_name}"
                                )

                                kafka_topic = self._find_kafka_topic(topic_name)
                                if not kafka_topic:
                                    logger.warning(
                                        f"   ✗ Kafka topic '{topic_name}' not found in OpenMetadata"
                                    )
                                    continue

                                logger.info(
                                    f"   ✓ Topic found: {kafka_topic.fullyQualifiedName.root if hasattr(kafka_topic.fullyQualifiedName, 'root') else kafka_topic.fullyQualifiedName}"
                                )

                                # Find tables that read directly from Kafka OR from an external source view
                                for dep in dlt_dependencies:
                                    is_kafka_consumer = dep.reads_from_kafka or any(
                                        src in external_sources_map
                                        for src in dep.depends_on
                                    )

                                    if is_kafka_consumer:
                                        logger.info(
                                            f"   🔍 Processing table: {dep.table_name}"
                                        )

                                        target_table = self._find_dlt_table(
                                            table_name=dep.table_name,
                                            catalog=target_catalog,
                                            schema=target_schema,
                                        )

                                        if target_table:
                                            table_fqn = (
                                                target_table.fullyQualifiedName.root
                                                if hasattr(
                                                    target_table.fullyQualifiedName,
                                                    "root",
                                                )
                                                else target_table.fullyQualifiedName
                                            )
                                            logger.info(
                                                f"   ✅ Creating lineage: {topic_name} -> {table_fqn}"
                                            )

                                            yield Either(
                                                right=AddLineageRequest(
                                                    edge=EntitiesEdge(
                                                        fromEntity=EntityReference(
                                                            id=kafka_topic.id,
                                                            type="topic",
                                                        ),
                                                        toEntity=EntityReference(
                                                            id=target_table.id.root
                                                            if hasattr(
                                                                target_table.id, "root"
                                                            )
                                                            else target_table.id,
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
                                            lineage_created += 1
                                        else:
                                            logger.warning(
                                                f"   ✗ Table '{dep.table_name}' not found"
                                            )

                            except Exception as exc:
                                logger.error(
                                    f"   ✗ Failed to process topic {topic_name}: {exc}"
                                )
                                logger.debug(traceback.format_exc())
                                continue

                    # Step 2: Create table-to-table lineage for downstream dependencies
                    for dep in dlt_dependencies:
                        if dep.depends_on:
                            for source_table_name in dep.depends_on:
                                try:
                                    logger.info(
                                        f"\n   🔍 Processing table dependency: {source_table_name} -> {dep.table_name}"
                                    )

                                    # Check if source is a view/table that reads from S3
                                    source_dep = next(
                                        (
                                            d
                                            for d in dlt_dependencies
                                            if d.table_name == source_table_name
                                        ),
                                        None,
                                    )

                                    # If source reads from S3, create container → table lineage
                                    if (
                                        source_dep
                                        and source_dep.reads_from_s3
                                        and source_dep.s3_locations
                                    ):
                                        target_table = self._find_dlt_table(
                                            table_name=dep.table_name,
                                            catalog=target_catalog,
                                            schema=target_schema,
                                        )

                                        if target_table:
                                            for s3_location in source_dep.s3_locations:
                                                logger.info(
                                                    f"   🔍 Looking for S3 container: {s3_location}"
                                                )
                                                # Search for container by S3 path
                                                storage_location = s3_location.rstrip(
                                                    "/"
                                                )
                                                container_entity = self.metadata.es_search_container_by_path(
                                                    full_path=storage_location
                                                )

                                                if (
                                                    container_entity
                                                    and container_entity[0]
                                                ):
                                                    logger.info(
                                                        f"   ✅ Creating lineage: {container_entity[0].fullyQualifiedName.root if hasattr(container_entity[0].fullyQualifiedName, 'root') else container_entity[0].fullyQualifiedName} -> {target_table.fullyQualifiedName.root if hasattr(target_table.fullyQualifiedName, 'root') else target_table.fullyQualifiedName}"
                                                    )

                                                    yield Either(
                                                        right=AddLineageRequest(
                                                            edge=EntitiesEdge(
                                                                fromEntity=EntityReference(
                                                                    id=container_entity[
                                                                        0
                                                                    ].id,
                                                                    type="container",
                                                                ),
                                                                toEntity=EntityReference(
                                                                    id=target_table.id.root
                                                                    if hasattr(
                                                                        target_table.id,
                                                                        "root",
                                                                    )
                                                                    else target_table.id,
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
                                                    lineage_created += 1
                                                else:
                                                    logger.warning(
                                                        f"   ✗ S3 container not found for path: {storage_location}"
                                                    )
                                                    logger.info(
                                                        f"      Make sure the S3 container is ingested in OpenMetadata"
                                                    )
                                        else:
                                            logger.warning(
                                                f"   ✗ Target table '{dep.table_name}' not found"
                                            )
                                        continue

                                    # Otherwise, create table → table lineage
                                    source_table = self._find_dlt_table(
                                        table_name=source_table_name,
                                        catalog=target_catalog,
                                        schema=target_schema,
                                    )
                                    target_table = self._find_dlt_table(
                                        table_name=dep.table_name,
                                        catalog=target_catalog,
                                        schema=target_schema,
                                    )

                                    if source_table and target_table:
                                        source_fqn = (
                                            source_table.fullyQualifiedName.root
                                            if hasattr(
                                                source_table.fullyQualifiedName, "root"
                                            )
                                            else source_table.fullyQualifiedName
                                        )
                                        target_fqn = (
                                            target_table.fullyQualifiedName.root
                                            if hasattr(
                                                target_table.fullyQualifiedName, "root"
                                            )
                                            else target_table.fullyQualifiedName
                                        )
                                        logger.info(
                                            f"   ✅ Creating lineage: {source_fqn} -> {target_fqn}"
                                        )

                                        yield Either(
                                            right=AddLineageRequest(
                                                edge=EntitiesEdge(
                                                    fromEntity=EntityReference(
                                                        id=source_table.id.root
                                                        if hasattr(
                                                            source_table.id, "root"
                                                        )
                                                        else source_table.id,
                                                        type="table",
                                                    ),
                                                    toEntity=EntityReference(
                                                        id=target_table.id.root
                                                        if hasattr(
                                                            target_table.id, "root"
                                                        )
                                                        else target_table.id,
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
                                        lineage_created += 1
                                    else:
                                        if not source_table:
                                            logger.warning(
                                                f"   ✗ Source table '{source_table_name}' not found"
                                            )
                                        if not target_table:
                                            logger.warning(
                                                f"   ✗ Target table '{dep.table_name}' not found"
                                            )

                                except Exception as exc:
                                    logger.error(
                                        f"   ✗ Failed to process dependency {source_table_name} -> {dep.table_name}: {exc}"
                                    )
                                    logger.debug(traceback.format_exc())
                                    continue

                    logger.info(
                        f"\n✓ Lineage edges created for this notebook: {lineage_created}"
                    )
                except Exception as exc:
                    logger.error(f"✗ Failed to process notebook {lib_path}: {exc}")
                    logger.debug(traceback.format_exc())
                    logger.info(f"   Continuing with next notebook...")
                    continue

            logger.info("\n" + "=" * 80)
            logger.info(f"KAFKA LINEAGE EXTRACTION COMPLETED")
            logger.info(
                f"Pipeline: {pipeline_details.name if hasattr(pipeline_details, 'name') else 'N/A'}"
            )
            logger.info("=" * 80)

        except Exception as exc:
            logger.error(f"✗ Unexpected error in Kafka lineage extraction: {exc}")
            logger.error(f"   Job ID: {pipeline_details.job_id}")
            logger.error(
                f"   Pipeline ID: {pipeline_details.pipeline_id if hasattr(pipeline_details, 'pipeline_id') else 'N/A'}"
            )
            logger.debug(traceback.format_exc())
            logger.info("=" * 80)

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
