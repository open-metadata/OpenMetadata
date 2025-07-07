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

    def get_lineage_details(self, job) -> Optional[dict]:
        """
        Get the Lineage Details of the pipeline
        """
        lineage_details = {"sources": [], "targets": []}
        try:
            job_details = JobNodeResponse.model_validate(
                self.glue.get_job(JobName=job)
            ).Job
            if job_details and job_details.config_nodes:
                nodes = job_details.config_nodes
                for _, node in nodes.items():
                    for key, entity in node.items():
                        table_model, storage_model = None, None
                        if key in TABLE_MODEL_MAP:
                            table_model = TABLE_MODEL_MAP[key].model_validate(entity)
                        elif "Catalog" in key:
                            table_model = CatalogSource.model_validate(entity)
                        elif key in STORAGE_MODEL_MAP:
                            storage_model = STORAGE_MODEL_MAP[key].model_validate(
                                entity
                            )
                        if table_model:
                            for db_service_name in self.get_db_service_names():
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
                                            lineage_details["sources"].append(
                                                storage_entity
                                            )
                                        else:
                                            lineage_details["targets"].append(
                                                storage_entity
                                            )
                                        break

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to get lineage details for job : {job} due to : {exc}"
            )
        return lineage_details

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
