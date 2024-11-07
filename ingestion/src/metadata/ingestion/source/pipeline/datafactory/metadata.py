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
Azure Datafactory source to extract metadata from OM UI
"""
import traceback
from typing import Iterable, List, Optional

from azure.mgmt.datafactory.models import PipelineResource

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.pipeline.datafactoryConnection import (
    DataFactoryConnection,
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
    Timestamp,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.helpers import datetime_to_ts
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

STATUS_MAP = {
    "Queued": StatusType.Pending.value,
    "InProgress": StatusType.Pending.value,
    "Succeeded": StatusType.Successful.value,
    "Failed": StatusType.Failed.value,
    "Canceling": StatusType.Skipped.value,
    "Cancelled": StatusType.Skipped.value,
}


class DataFactorySource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Azure Data Factory
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: DataFactoryConnection = config.serviceConnection.root.config
        if not isinstance(connection, DataFactoryConnection):
            raise InvalidSourceException(
                f"Expected DataFactoryConnection, but got {connection}"
            )
        return cls(config, metadata)

    def _get_task_list(self, pipeline_name: str) -> Optional[List[Task]]:
        """
        Method to collect all the tasks from azure data factory pipeline and return it in a task list
        """
        try:
            task_list: List[Task] = []
            runs = self.client.get_pipeline_runs(pipeline_name=pipeline_name)
            if runs:
                task_list = [
                    Task(
                        name=str(run.run_id),
                        startDate=str(run.run_start),
                        endDate=str(run.run_end),
                        description=Markdown(run.message) if run.message else None,
                    )
                    for run in runs or []
                ]
            return task_list or None
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to get tasks list due to : {exc}")
        return None

    def _get_lineage_entities(
        self, pipeline_details: PipelineResource
    ) -> Optional[dict]:
        """
        Get the Lineage Details for the pipeline
        """
        lineage_entities = {"sources": [], "targets": []}

        def fetch_entity(dataset, is_source=True):
            """
            Helper function to fetch entities based on dataset attributes and append to lineage_entities.
            """
            entity_list = (
                lineage_entities["sources"]
                if is_source
                else lineage_entities["targets"]
            )

            if hasattr(dataset, "table"):
                for db_service_name in self.get_db_service_names():
                    entity = self.metadata.get_entity_reference(
                        entity=Table,
                        fqn=fqn.build(
                            metadata=self.metadata,
                            entity_type=Table,
                            table_name=dataset.table,
                            database_name=None,
                            schema_name=dataset.schema_type_properties_schema,
                            service_name=db_service_name,
                        ),
                    )
                    if entity:
                        entity_list.append(entity)
                        break

            elif hasattr(dataset, "location") and hasattr(
                dataset.location, "bucket_name"
            ):
                for storage_service_name in self.get_storage_service_names():
                    entity = self.metadata.get_entity_reference(
                        entity=Container,
                        fqn=fqn.build(
                            metadata=self.metadata,
                            entity_type=Container,
                            service_name=storage_service_name,
                            parent_container="",
                            container_name=dataset.location.bucket_name,
                        ),
                    )
                    if entity:
                        entity_list.append(entity)
                        break

        try:
            for activity in pipeline_details.activities:
                if activity.inputs:
                    for activity_input in activity.inputs:
                        dataset_input = self.client.get_dataset_info(
                            activity_input.reference_name
                        )
                        fetch_entity(dataset_input, is_source=True)

                if activity.outputs:
                    for activity_output in activity.outputs:
                        dataset_output = self.client.get_dataset_info(
                            activity_output.reference_name
                        )
                        fetch_entity(dataset_output, is_source=False)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to get lineage details for pipeline: {pipeline_details} due to: {exc}"
            )

        return lineage_entities

    def yield_pipeline(self, pipeline_details: PipelineResource):
        """Method to Get Pipeline Entity"""
        try:
            pipeline_request = CreatePipelineRequest(
                name=EntityName(pipeline_details.name),
                description=Markdown(pipeline_details.description)
                if pipeline_details.description
                else None,
                sourceUrl=self.client.get_pipeline_url(pipeline_id=pipeline_details.id),
                tasks=self._get_task_list(pipeline_name=pipeline_details.name),
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
        self, pipeline_details: PipelineResource
    ) -> Iterable[Either[AddLineageRequest]]:
        """Get lineage between pipeline and data sources"""
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

            lineage_enities = self._get_lineage_entities(pipeline_details)
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
                    name=pipeline_details.name,
                    error=f"Wild error ingesting pipeline lineage {pipeline_details} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_pipelines_list(self) -> Iterable[PipelineResource]:
        """Get List of all pipelines"""
        try:
            yield from self.client.get_all_pipelines()
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get pipeline list due to : {exc}")

    def get_pipeline_name(self, pipeline_details: PipelineResource) -> str:
        """Get Pipeline Name"""
        try:
            return pipeline_details.name
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get pipeline name due to : {exc}")

        return None

    def yield_pipeline_status(
        self, pipeline_details: PipelineResource
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """Get Pipeline Status"""
        try:
            for task in (
                self.client.get_pipeline_runs(pipeline_name=pipeline_details.name) or []
            ):
                run_start = (
                    Timestamp(datetime_to_ts(task.run_start))
                    if task.run_start
                    else None
                )
                run_end = (
                    Timestamp(datetime_to_ts(task.run_end)) if task.run_end else None
                )
                task_status = [
                    TaskStatus(
                        name=str(task.run_id),
                        executionStatus=STATUS_MAP.get(task.status, StatusType.Pending),
                        startTime=run_start,
                        endTime=run_end,
                    )
                ]

                pipeline_status = PipelineStatus(
                    executionStatus=STATUS_MAP.get(task.status, StatusType.Pending),
                    taskStatus=task_status,
                    timestamp=run_start,
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
                    name=pipeline_details.name,
                    error=f"Wild error ingesting pipeline status {pipeline_details} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
