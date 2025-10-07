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
ConfluentCDC source to extract CDC pipeline metadata with column-level lineage
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
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.pipeline.confluentCdcConnection import (
    ConfluentCdcConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
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
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.confluentcdc.models import (
    ConfluentCdcPipelineDetails,
)
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.helpers import clean_uri, datetime_to_ts
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

STATUS_MAP = {
    "RUNNING": StatusType.Successful.value,
    "FAILED": StatusType.Failed.value,
    "PAUSED": StatusType.Pending.value,
    "UNASSIGNED": StatusType.Pending.value,
}


class ConfluentcdcSource(PipelineServiceSource):
    """
    Implements the necessary methods to extract
    CDC Pipeline metadata from Confluent CDC / Kafka Connect with column-level lineage
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: ConfluentCdcConnection = config.serviceConnection.root.config
        if not isinstance(connection, ConfluentCdcConnection):
            raise InvalidSourceException(
                f"Expected ConfluentCdcConnection, but got {connection}"
            )
        return cls(config, metadata)

    def yield_pipeline(
        self, pipeline_details: ConfluentCdcPipelineDetails
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """
        Method to Get Pipeline Entity
        """
        try:
            connection_url = SourceUrl(f"{clean_uri(self.service_connection.hostPort)}")

            pipeline_request = CreatePipelineRequest(
                name=EntityName(pipeline_details.name),
                sourceUrl=connection_url,
                tasks=[
                    Task(
                        name=str(task.id),
                    )
                    for task in pipeline_details.tasks or []
                ],
                service=self.context.get().pipeline_service,
                description=Markdown(pipeline_details.description)
                if pipeline_details.description
                else None,
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

    def _find_table_entity(
        self, database: Optional[str], schema: Optional[str], table: str
    ) -> Optional[Table]:
        """
        Find table entity by searching Elasticsearch with FQN pattern
        """
        try:
            fqn_search_string = fqn.build(
                metadata=self.metadata,
                entity_type=Table,
                table_name=table,
                database_name=database,
                schema_name=schema,
                service_name="*",
            )

            table_entities = self.metadata.es_search_from_fqn(
                entity_type=Table,
                fqn_search_string=fqn_search_string,
                size=1,
            )

            if table_entities:
                return table_entities[0]

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to find table {table}: {exc}")

        return None

    def _find_topic_entity(self, topic_name: str) -> Optional[Topic]:
        """
        Find topic entity by searching Elasticsearch with FQN pattern
        """
        try:
            fqn_search_string = fqn.build(
                metadata=self.metadata,
                entity_type=Topic,
                service_name="*",
                topic_name=topic_name,
            )

            topic_entities = self.metadata.es_search_from_fqn(
                entity_type=Topic,
                fqn_search_string=fqn_search_string,
                size=1,
            )

            if topic_entities:
                return topic_entities[0]

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to find topic {topic_name}: {exc}")

        return None

    def _build_table_to_table_column_lineage(
        self,
        from_entity: Table,
        to_entity: Table,
        column_mappings: list,
    ) -> List[ColumnLineage]:
        """
        Build column-level lineage from CDC column mappings (Table to Table)
        """
        column_lineages = []

        if not column_mappings:
            return column_lineages

        from_columns = {col.name.root: col for col in from_entity.columns or []}
        to_columns = {col.name.root: col for col in to_entity.columns or []}

        for mapping in column_mappings:
            source_col = from_columns.get(mapping.source_column)
            target_col = to_columns.get(mapping.target_column)

            if source_col and target_col:
                column_lineages.append(
                    ColumnLineage(
                        fromColumns=[
                            fqn.build(
                                metadata=self.metadata,
                                entity_type=Column,
                                service_name=from_entity.service.name,
                                database_name=from_entity.database.name,
                                schema_name=from_entity.databaseSchema.name,
                                table_name=from_entity.name.root,
                                column_name=source_col.name.root,
                            )
                        ],
                        toColumn=fqn.build(
                            metadata=self.metadata,
                            entity_type=Column,
                            service_name=to_entity.service.name,
                            database_name=to_entity.database.name,
                            schema_name=to_entity.databaseSchema.name,
                            table_name=to_entity.name.root,
                            column_name=target_col.name.root,
                        ),
                    )
                )

        return column_lineages

    def _build_table_to_topic_column_lineage(
        self,
        table_entity: Table,
        topic_entity: Topic,
        column_mappings: list,
    ) -> List[ColumnLineage]:
        """
        Build column-level lineage from table columns to topic schema fields
        """
        column_lineages = []

        if (
            not topic_entity.messageSchema
            or not topic_entity.messageSchema.schemaFields
        ):
            logger.debug(f"Topic {topic_entity.name.root} has no schema fields")
            return column_lineages

        table_columns = {col.name.root: col for col in table_entity.columns or []}
        topic_fields = {
            field.name: field for field in topic_entity.messageSchema.schemaFields
        }

        if column_mappings:
            for mapping in column_mappings:
                source_col = table_columns.get(mapping.source_column)
                topic_field = topic_fields.get(mapping.source_column)

                if source_col and topic_field:
                    column_lineages.append(
                        ColumnLineage(
                            fromColumns=[
                                fqn.build(
                                    metadata=self.metadata,
                                    entity_type=Column,
                                    service_name=table_entity.service.name,
                                    database_name=table_entity.database.name,
                                    schema_name=table_entity.databaseSchema.name,
                                    table_name=table_entity.name.root,
                                    column_name=source_col.name.root,
                                )
                            ],
                            toColumn=f"{topic_entity.fullyQualifiedName.root}.{topic_field.name}",
                        )
                    )
        else:
            for col_name, col in table_columns.items():
                if col_name in topic_fields:
                    column_lineages.append(
                        ColumnLineage(
                            fromColumns=[
                                fqn.build(
                                    metadata=self.metadata,
                                    entity_type=Column,
                                    service_name=table_entity.service.name,
                                    database_name=table_entity.database.name,
                                    schema_name=table_entity.databaseSchema.name,
                                    table_name=table_entity.name.root,
                                    column_name=col.name.root,
                                )
                            ],
                            toColumn=f"{topic_entity.fullyQualifiedName.root}.{col_name}",
                        )
                    )

        return column_lineages

    def _build_topic_to_table_column_lineage(
        self,
        topic_entity: Topic,
        table_entity: Table,
        column_mappings: list,
    ) -> List[ColumnLineage]:
        """
        Build column-level lineage from topic schema fields to table columns
        """
        column_lineages = []

        if (
            not topic_entity.messageSchema
            or not topic_entity.messageSchema.schemaFields
        ):
            logger.debug(f"Topic {topic_entity.name.root} has no schema fields")
            return column_lineages

        topic_fields = {
            field.name: field for field in topic_entity.messageSchema.schemaFields
        }
        table_columns = {col.name.root: col for col in table_entity.columns or []}

        if column_mappings:
            for mapping in column_mappings:
                topic_field = topic_fields.get(mapping.target_column)
                target_col = table_columns.get(mapping.target_column)

                if topic_field and target_col:
                    column_lineages.append(
                        ColumnLineage(
                            fromColumns=[
                                f"{topic_entity.fullyQualifiedName.root}.{topic_field.name}"
                            ],
                            toColumn=fqn.build(
                                metadata=self.metadata,
                                entity_type=Column,
                                service_name=table_entity.service.name,
                                database_name=table_entity.database.name,
                                schema_name=table_entity.databaseSchema.name,
                                table_name=table_entity.name.root,
                                column_name=target_col.name.root,
                            ),
                        )
                    )
        else:
            for field_name, field in topic_fields.items():
                if field_name in table_columns:
                    target_col = table_columns[field_name]
                    column_lineages.append(
                        ColumnLineage(
                            fromColumns=[
                                f"{topic_entity.fullyQualifiedName.root}.{field.name}"
                            ],
                            toColumn=fqn.build(
                                metadata=self.metadata,
                                entity_type=Column,
                                service_name=table_entity.service.name,
                                database_name=table_entity.database.name,
                                schema_name=table_entity.databaseSchema.name,
                                table_name=table_entity.name.root,
                                column_name=target_col.name.root,
                            ),
                        )
                    )

        return column_lineages

    def yield_pipeline_lineage_details(
        self, pipeline_details: ConfluentCdcPipelineDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Get lineage between CDC pipeline and data sources with column-level lineage
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

            for table_mapping in pipeline_details.table_mappings or []:
                source_table = self._find_table_entity(
                    table_mapping.source_database,
                    table_mapping.source_schema,
                    table_mapping.source_table,
                )

                if not source_table:
                    logger.warning(
                        f"Source table not found: {table_mapping.source_table}"
                    )
                    continue

                for topic in pipeline_details.topics or []:
                    topic_entity = self._find_topic_entity(topic.name)

                    if not topic_entity:
                        logger.warning(f"Topic not found: {topic.name}")
                        continue

                    table_to_topic_lineage = self._build_table_to_topic_column_lineage(
                        source_table, topic_entity, table_mapping.column_mappings
                    )

                    table_to_topic_lineage_details = LineageDetails(
                        pipeline=EntityReference(
                            id=pipeline_entity.id.root, type="pipeline"
                        ),
                        source=LineageSource.PipelineLineage,
                        columnsLineage=table_to_topic_lineage
                        if table_to_topic_lineage
                        else None,
                    )

                    yield Either(
                        right=AddLineageRequest(
                            edge=EntitiesEdge(
                                fromEntity=EntityReference(
                                    id=source_table.id,
                                    type="table",
                                ),
                                toEntity=EntityReference(
                                    id=topic_entity.id,
                                    type="topic",
                                ),
                                lineageDetails=table_to_topic_lineage_details,
                            )
                        )
                    )

                target_table = self._find_table_entity(
                    table_mapping.target_database,
                    table_mapping.target_schema,
                    table_mapping.target_table,
                )

                if not target_table:
                    logger.warning(
                        f"Target table not found: {table_mapping.target_table}"
                    )
                    continue

                table_to_table_lineage = self._build_table_to_table_column_lineage(
                    source_table, target_table, table_mapping.column_mappings
                )

                for topic in pipeline_details.topics or []:
                    topic_entity = self._find_topic_entity(topic.name)

                    if not topic_entity:
                        continue

                    topic_to_table_lineage = self._build_topic_to_table_column_lineage(
                        topic_entity, target_table, table_mapping.column_mappings
                    )

                    topic_to_table_lineage_details = LineageDetails(
                        pipeline=EntityReference(
                            id=pipeline_entity.id.root, type="pipeline"
                        ),
                        source=LineageSource.PipelineLineage,
                        columnsLineage=topic_to_table_lineage
                        if topic_to_table_lineage
                        else table_to_table_lineage,
                    )

                    yield Either(
                        right=AddLineageRequest(
                            edge=EntitiesEdge(
                                fromEntity=EntityReference(
                                    id=topic_entity.id,
                                    type="topic",
                                ),
                                toEntity=EntityReference(
                                    id=target_table.id,
                                    type="table",
                                ),
                                lineageDetails=topic_to_table_lineage_details,
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

    def get_pipelines_list(self) -> Iterable[ConfluentCdcPipelineDetails]:
        """
        Get List of all CDC pipelines
        """
        try:
            yield from self.client.get_connector_list()
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get pipeline list due to : {exc}")

    def get_pipeline_name(self, pipeline_details: ConfluentCdcPipelineDetails) -> str:
        """
        Get Pipeline Name
        """
        try:
            return pipeline_details.name
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get pipeline name to : {exc}")
        return None

    def yield_pipeline_status(
        self, pipeline_details: ConfluentCdcPipelineDetails
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """
        Get Pipeline Status
        """
        try:
            task_status = [
                TaskStatus(
                    name=str(task.id),
                    executionStatus=STATUS_MAP.get(task.state, StatusType.Pending),
                )
                for task in pipeline_details.tasks or []
            ]

            pipeline_status = PipelineStatus(
                executionStatus=STATUS_MAP.get(
                    pipeline_details.status, StatusType.Pending
                ),
                taskStatus=task_status,
                timestamp=Timestamp(datetime_to_ts(datetime.now())),
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
