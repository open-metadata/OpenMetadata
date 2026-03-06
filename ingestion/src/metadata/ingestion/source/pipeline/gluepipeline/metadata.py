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
Glue pipeline source to extract metadata
"""

import re
import traceback
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlparse

from metadata.clients.aws_client import AWSClient
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
from metadata.generated.schema.entity.services.connections.pipeline.gluePipelineConnection import (
    GluePipelineConnection,
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
from metadata.ingestion.source.pipeline.gluepipeline.models import (
    AmazonRedshift,
    CatalogSource,
    JDBCSource,
    JobNodeResponse,
    S3Source,
    S3Target,
)
from metadata.ingestion.source.pipeline.gluepipeline.script_parser import (
    ScriptLineageResult,
    parse_glue_script,
)
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.time_utils import datetime_to_timestamp

logger = ingestion_logger()

GRAPH = "Graph"
NODES = "Nodes"
NAME = "Name"
JOB_TYPE = "JOB"
STATUS_MAP = {
    "cancelled": StatusType.Failed,
    "succeeded": StatusType.Successful,
    "failed": StatusType.Failed,
    "running": StatusType.Pending,
    "incomplete": StatusType.Failed,
    "pending": StatusType.Pending,
}
TABLE_MODEL_MAP = {
    "AmazonRedshiftSource": AmazonRedshift,
    "AmazonRedshiftTarget": AmazonRedshift,
    "AthenaConnectorSource": JDBCSource,
    "JDBCConnectorSource": JDBCSource,
    "JDBCConnectorTarget": JDBCSource,
    "DirectJDBCSource": CatalogSource,
    "RedshiftSource": CatalogSource,
    "RedshiftTarget": CatalogSource,
    "DirectJDBC": CatalogSource,
}
STORAGE_MODEL_MAP = {
    "S3CsvSource": S3Source,
    "S3JsonSource": S3Source,
    "S3ParquetSource": S3Source,
    "S3HudiSource": S3Source,
    "S3DeltaSource": S3Source,
    "S3DirectTarget": S3Target,
    "S3DeltaDirectTarget": S3Target,
    "S3GlueParquetTarget": S3Target,
    "S3HudiDirectTarget": S3Target,
}


class GluepipelineSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Glue Pipeline's metadata db
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.task_id_mapping = {}
        self.job_name_list = set()
        self.glue = self.connection
        self._s3_client = None
        self._glue_connection_cache: Dict[str, Optional[dict]] = {}

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: GluePipelineConnection = config.serviceConnection.root.config
        if not isinstance(connection, GluePipelineConnection):
            raise InvalidSourceException(
                f"Expected GlueConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_pipelines_list(self) -> Iterable[dict]:
        for workflow in self.glue.list_workflows()["Workflows"]:
            jobs = self.glue.get_workflow(Name=workflow, IncludeGraph=True)["Workflow"]
            yield jobs

    def get_pipeline_name(self, pipeline_details: dict) -> str:
        return pipeline_details[NAME]

    def yield_pipeline(
        self, pipeline_details: Any
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """Method to Get Pipeline Entity"""
        source_url = SourceUrl(
            f"https://{self.service_connection.awsConfig.awsRegion}.console.aws.amazon.com/glue/home?"
            f"region={self.service_connection.awsConfig.awsRegion}#/v2/etl-configuration/"
            f"workflows/view/{pipeline_details[NAME]}"
        )
        self.job_name_list = set()
        pipeline_request = CreatePipelineRequest(
            name=EntityName(pipeline_details[NAME]),
            displayName=pipeline_details[NAME],
            tasks=self.get_tasks(pipeline_details),
            service=FullyQualifiedEntityName(self.context.get().pipeline_service),
            sourceUrl=source_url,
        )
        yield Either(right=pipeline_request)
        self.register_record(pipeline_request=pipeline_request)

    def get_tasks(self, pipeline_details: Any) -> List[Task]:
        task_list = []
        for task in pipeline_details["Graph"]["Nodes"]:
            self.task_id_mapping[task["UniqueId"]] = task["Name"][:128]
            if task["Type"] == JOB_TYPE:
                self.job_name_list.add(task[NAME])
        for task in pipeline_details[GRAPH][NODES]:
            task_list.append(
                Task(
                    name=task[NAME],
                    displayName=task[NAME],
                    taskType=task["Type"],
                    downstreamTasks=self.get_downstream_tasks(
                        task["UniqueId"], pipeline_details[GRAPH]
                    ),
                )
            )
        return task_list

    def get_downstream_tasks(self, task_unique_id, tasks):
        downstream_tasks = []
        for edges in tasks["Edges"]:
            if edges["SourceId"] == task_unique_id and self.task_id_mapping.get(
                edges["DestinationId"]
            ):
                downstream_tasks.append(self.task_id_mapping[edges["DestinationId"]])
        return downstream_tasks

    @property
    def s3_client(self):
        if self._s3_client is None:
            self._s3_client = AWSClient(
                self.service_connection.awsConfig
            ).get_s3_client()
        return self._s3_client

    def get_lineage_details(self, job) -> Optional[dict]:
        """
        Get the Lineage Details of the pipeline.

        First tries to parse Visual ETL CodeGenConfigurationNodes.
        Falls back to downloading and parsing the job script for
        GlueContext/Spark lineage patterns.
        """
        lineage_details = {"sources": [], "targets": []}
        try:
            job_details = JobNodeResponse.model_validate(
                self.glue.get_job(JobName=job)
            ).Job
            if job_details and job_details.config_nodes:
                self._extract_visual_etl_lineage(
                    job_details.config_nodes, lineage_details
                )
            elif (
                job_details
                and job_details.command
                and job_details.command.ScriptLocation
            ):
                self._extract_script_lineage(
                    job_details.command.ScriptLocation, lineage_details
                )

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to get lineage details for job : {job} due to : {exc}"
            )
        return lineage_details

    def _extract_visual_etl_lineage(self, config_nodes: dict, lineage_details: dict):
        for _, node in config_nodes.items():
            for key, entity in node.items():
                table_model, storage_model = None, None
                if key in TABLE_MODEL_MAP:
                    table_model = TABLE_MODEL_MAP[key].model_validate(entity)
                elif "Catalog" in key:
                    table_model = CatalogSource.model_validate(entity)
                elif key in STORAGE_MODEL_MAP:
                    storage_model = STORAGE_MODEL_MAP[key].model_validate(entity)
                if table_model:
                    for db_service_name in self.get_db_service_names() or ["*"]:
                        table_entity = self.metadata.get_entity_reference(
                            entity=Table,
                            fqn=fqn.build(
                                metadata=self.metadata,
                                entity_type=Table,
                                table_name=table_model.table_name,
                                database_name=table_model.database_name,
                                schema_name=table_model.schema_name,
                                service_name=db_service_name,
                            ),
                        )
                        if table_entity:
                            if key.endswith("Source"):
                                lineage_details["sources"].append(table_entity)
                            else:
                                lineage_details["targets"].append(table_entity)
                            break
                if storage_model:
                    for path in storage_model.Paths or [storage_model.Path]:
                        container = self.metadata.es_search_container_by_path(
                            full_path=path
                        )
                        if container and container[0]:
                            storage_entity = EntityReference(
                                id=container[0].id,
                                type="container",
                                name=container[0].name.root,
                                fullyQualifiedName=container[
                                    0
                                ].fullyQualifiedName.root,
                            )
                            if storage_entity:
                                if key.endswith("Source"):
                                    lineage_details["sources"].append(storage_entity)
                                else:
                                    lineage_details["targets"].append(storage_entity)
                                break

    def _extract_script_lineage(
        self, script_location: str, lineage_details: dict
    ):
        script_content = self._download_s3_script(script_location)
        if not script_content:
            return

        result = parse_glue_script(script_content)
        if not result.has_lineage:
            logger.debug(f"No lineage found in script: {script_location}")
            return

        self._resolve_s3_entities(result.s3_sources, lineage_details, "sources")
        self._resolve_s3_entities(result.s3_targets, lineage_details, "targets")
        self._resolve_catalog_entities(
            result.catalog_sources, lineage_details, "sources"
        )
        self._resolve_catalog_entities(
            result.catalog_targets, lineage_details, "targets"
        )
        self._resolve_jdbc_entities(result.jdbc_sources, lineage_details, "sources")
        self._resolve_jdbc_entities(result.jdbc_targets, lineage_details, "targets")

    def _download_s3_script(self, s3_uri: str) -> Optional[str]:
        try:
            parsed = urlparse(s3_uri)
            bucket = parsed.netloc
            key = parsed.path.lstrip("/")
            if not bucket or not key:
                logger.warning(f"Invalid S3 URI for script: {s3_uri}")
                return None
            response = self.s3_client.get_object(Bucket=bucket, Key=key)
            return response["Body"].read().decode("utf-8")
        except Exception as exc:
            logger.warning(f"Failed to download script from {s3_uri}: {exc}")
            logger.debug(traceback.format_exc())
            return None

    def _resolve_s3_entities(
        self, paths: List[str], lineage_details: dict, direction: str
    ):
        for path in paths:
            try:
                # Normalize: try both with and without trailing slash
                normalized = path.rstrip("/")
                container = self.metadata.es_search_container_by_path(
                    full_path=normalized
                )
                if not container or not container[0]:
                    container = self.metadata.es_search_container_by_path(
                        full_path=normalized + "/"
                    )
                if container and container[0]:
                    storage_entity = EntityReference(
                        id=container[0].id,
                        type="container",
                        name=container[0].name.root,
                        fullyQualifiedName=container[0].fullyQualifiedName.root,
                    )
                    lineage_details[direction].append(storage_entity)
                else:
                    logger.warning(
                        f"Could not find container entity for S3 path: {path}. "
                        "Ensure the S3 storage service has been ingested."
                    )
            except Exception as exc:
                logger.debug(f"Failed to resolve S3 path {path}: {exc}")

    def _resolve_catalog_entities(
        self, refs: list, lineage_details: dict, direction: str
    ):
        for ref in refs:
            for db_service_name in self.get_db_service_names() or ["*"]:
                try:
                    table_entity = self.metadata.get_entity_reference(
                        entity=Table,
                        fqn=fqn.build(
                            metadata=self.metadata,
                            entity_type=Table,
                            table_name=ref.table,
                            database_name=ref.database,
                            schema_name=None,
                            service_name=db_service_name,
                        ),
                    )
                    if table_entity:
                        lineage_details[direction].append(table_entity)
                        break
                except Exception as exc:
                    logger.debug(
                        f"Failed to resolve catalog ref {ref.database}.{ref.table} "
                        f"in service {db_service_name}: {exc}"
                    )

    def _resolve_jdbc_entities(
        self, refs: list, lineage_details: dict, direction: str
    ):
        for ref in refs:
            database_name = ref.database
            table_name = ref.table
            schema_name = None

            if ref.connection_name:
                conn_info = self._resolve_glue_connection(ref.connection_name)
                if conn_info:
                    database_name = database_name or conn_info.get("database")
                    schema_name = conn_info.get("schema")

            if ref.jdbc_url:
                parsed = self._parse_jdbc_url(ref.jdbc_url)
                if parsed:
                    database_name = database_name or parsed.get("database")
                    schema_name = schema_name or parsed.get("schema")

            if not table_name:
                continue

            for db_service_name in self.get_db_service_names() or ["*"]:
                try:
                    table_entity = self.metadata.get_entity_reference(
                        entity=Table,
                        fqn=fqn.build(
                            metadata=self.metadata,
                            entity_type=Table,
                            table_name=table_name,
                            database_name=database_name,
                            schema_name=schema_name,
                            service_name=db_service_name,
                        ),
                    )
                    if table_entity:
                        lineage_details[direction].append(table_entity)
                        break
                except Exception as exc:
                    logger.debug(
                        f"Failed to resolve JDBC ref {table_name} "
                        f"in service {db_service_name}: {exc}"
                    )

    def _resolve_glue_connection(self, connection_name: str) -> Optional[dict]:
        if connection_name in self._glue_connection_cache:
            return self._glue_connection_cache[connection_name]

        try:
            response = self.glue.get_connection(
                Name=connection_name, HidePassword=True
            )
            props = response.get("Connection", {}).get("ConnectionProperties", {})
            jdbc_url = props.get("JDBC_CONNECTION_URL", "")
            result = self._parse_jdbc_url(jdbc_url)
            self._glue_connection_cache[connection_name] = result
            return result
        except Exception as exc:
            logger.debug(
                f"Failed to resolve Glue connection '{connection_name}': {exc}"
            )
            self._glue_connection_cache[connection_name] = None
            return None

    @staticmethod
    def _parse_jdbc_url(jdbc_url: str) -> Optional[dict]:
        if not jdbc_url:
            return None
        # jdbc:redshift://host:port/database
        # jdbc:postgresql://host:port/database
        # jdbc:mysql://host:port/database
        match = re.match(
            r"jdbc:\w+://[^/]+/([^?;]+)", jdbc_url
        )
        if match:
            db_name = match.group(1)
            return {"database": db_name, "schema": None}
        return None

    def yield_pipeline_status(
        self, pipeline_details: Any
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        pipeline_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Pipeline,
            service_name=self.context.get().pipeline_service,
            pipeline_name=self.context.get().pipeline,
        )
        for job in self.job_name_list:
            try:
                runs = self.glue.get_job_runs(JobName=job)
                runs = runs.get("JobRuns", [])
                for attempt in runs:
                    task_status = []
                    task_status.append(
                        TaskStatus(
                            name=attempt["JobName"],
                            executionStatus=STATUS_MAP.get(
                                attempt["JobRunState"].lower(), StatusType.Pending
                            ).value,
                            startTime=Timestamp(
                                datetime_to_timestamp(
                                    attempt["StartedOn"], milliseconds=True
                                )
                            ),
                            endTime=Timestamp(
                                datetime_to_timestamp(
                                    attempt["CompletedOn"], milliseconds=True
                                )
                            ),
                        )
                    )
                    pipeline_status = PipelineStatus(
                        taskStatus=task_status,
                        timestamp=Timestamp(
                            datetime_to_timestamp(
                                attempt["StartedOn"], milliseconds=True
                            )
                        ),
                        executionStatus=STATUS_MAP.get(
                            attempt["JobRunState"].lower(), StatusType.Pending
                        ).value,
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
                        name=pipeline_fqn,
                        error=f"Failed to yield pipeline status for job {job}: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_pipeline_lineage_details(
        self, pipeline_details: Any
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Get lineage between pipeline and data sources
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

            for job in self.job_name_list:
                lineage_enities = self.get_lineage_details(job)
                for source in lineage_enities.get("sources"):
                    for target in lineage_enities.get("targets"):
                        yield Either(
                            right=AddLineageRequest(
                                edge=EntitiesEdge(
                                    fromEntity=source,
                                    toEntity=target,
                                    lineageDetails=lineage_details,
                                )
                            )
                        )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.get(NAME),
                    error=f"Wild error ingesting pipeline lineage {pipeline_details} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
