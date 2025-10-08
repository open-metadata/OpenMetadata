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
KafkaConnect source to extract metadata from OM UI
"""
import traceback
from datetime import datetime
from typing import Iterable, Optional

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
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.pipeline.kafkaConnectConnection import (
    KafkaConnectConnection,
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
from metadata.ingestion.lineage.sql_lineage import get_column_fqn
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata, T
from metadata.ingestion.source.pipeline.kafkaconnect.models import (
    KafkaConnectPipelineDetails,
)
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.constants import ENTITY_REFERENCE_TYPE_MAP
from metadata.utils.helpers import clean_uri, datetime_to_ts
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

STATUS_MAP = {
    "RUNNING": StatusType.Successful.value,
    "FAILED": StatusType.Failed.value,
    "PAUSED": StatusType.Pending.value,
    "UNASSIGNED": StatusType.Pending.value,
}


class KafkaconnectSource(PipelineServiceSource):
    """
    Implements the necessary methods to extract
    Pipeline metadata from Kafka Connect
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: KafkaConnectConnection = config.serviceConnection.root.config
        if not isinstance(connection, KafkaConnectConnection):
            raise InvalidSourceException(
                f"Expected KafkaConnectConnection, but got {connection}"
            )
        return cls(config, metadata)

    def yield_pipeline(
        self, pipeline_details: KafkaConnectPipelineDetails
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

    def get_dataset_entity(
        self, pipeline_details: KafkaConnectPipelineDetails
    ) -> Optional[T]:
        """
        Get lineage dataset entity
        """
        try:
            dataset_details = pipeline_details.dataset
            if dataset_details:
                if dataset_details.dataset_type == Table:
                    for (
                        dbservicename
                    ) in self.source_config.lineageInformation.dbServiceNames or ["*"]:
                        dataset_entity = self.metadata.get_by_name(
                            entity=dataset_details.dataset_type,
                            fqn=fqn.build(
                                metadata=self.metadata,
                                entity_type=dataset_details.dataset_type,
                                table_name=dataset_details.table,
                                database_name=None,
                                schema_name=dataset_details.database,
                                service_name=dbservicename,
                            ),
                        )

                        if dataset_entity:
                            return dataset_entity

                if dataset_details.dataset_type == Container:
                    for (
                        storageservicename
                    ) in self.source_config.lineageInformation.storageServiceNames or [
                        "*"
                    ]:
                        storage_entity = self.metadata.get_by_name(
                            entity=dataset_details.dataset_type,
                            fqn=fqn.build(
                                metadata=self.metadata,
                                entity_type=dataset_details.dataset_type,
                                container_name=dataset_details.container_name,
                                service_name=storageservicename,
                                parent_container=None,
                            ),
                        )

                        if storage_entity:
                            return storage_entity

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get dataset entity {exc}")

        return None

    def _get_topic_field_fqn(
        self, topic_entity: Topic, field_name: str
    ) -> Optional[str]:
        """
        Get the fully qualified name for a field in a Topic's schema.
        Handles nested structures where fields may be children of a parent RECORD.
        """
        if (
            not topic_entity.messageSchema
            or not topic_entity.messageSchema.schemaFields
        ):
            logger.debug(f"Topic {topic_entity.name.root} has no message schema")
            return None

        # Search for the field in the schema (including nested fields)
        for field in topic_entity.messageSchema.schemaFields:
            # Extract the actual field name (handle FieldName objects)
            field_name_str = (
                field.name.root if hasattr(field.name, "root") else str(field.name)
            )

            # Check if it's a direct field
            if field_name_str == field_name:
                return (
                    field.fullyQualifiedName.root if field.fullyQualifiedName else None
                )

            # Check if it's a child field (nested)
            if field.children:
                for child in field.children:
                    child_name_str = (
                        child.name.root
                        if hasattr(child.name, "root")
                        else str(child.name)
                    )
                    if child_name_str == field_name:
                        return (
                            child.fullyQualifiedName.root
                            if child.fullyQualifiedName
                            else None
                        )

        logger.debug(
            f"Field {field_name} not found in topic {topic_entity.name.root} schema"
        )
        return None

    def build_column_lineage(
        self,
        from_entity: T,
        to_entity: T,
        topic_entity: Topic,
        pipeline_details: KafkaConnectPipelineDetails,
    ) -> Optional[list[ColumnLineage]]:
        """
        Build column-level lineage between source table, topic, and target table.
        For source connectors: Table columns -> Topic schema fields
        For sink connectors: Topic schema fields -> Table columns
        """
        try:
            column_lineages = []

            logger.debug(
                f"Building column lineage for {pipeline_details.name}, type: {pipeline_details.conn_type}"
            )

            # Get column mappings from connector config if available
            if pipeline_details.dataset and pipeline_details.dataset.column_mappings:
                # Use explicit column mappings from connector config
                for mapping in pipeline_details.dataset.column_mappings:
                    if pipeline_details.conn_type.lower() == "sink":
                        from_col = get_column_fqn(
                            table_entity=topic_entity, column=mapping.source_column
                        )
                        to_col = get_column_fqn(
                            table_entity=to_entity, column=mapping.target_column
                        )
                    else:
                        from_col = get_column_fqn(
                            table_entity=from_entity, column=mapping.source_column
                        )
                        to_col = get_column_fqn(
                            table_entity=topic_entity, column=mapping.target_column
                        )

                    if from_col and to_col:
                        column_lineages.append(
                            ColumnLineage(
                                fromColumns=[from_col],
                                toColumn=to_col,
                                function=None,
                            )
                        )
            else:
                # Infer 1:1 column mappings based on matching column names
                if pipeline_details.conn_type.lower() == "sink":
                    source_entity = topic_entity
                    target_entity = to_entity
                else:
                    source_entity = from_entity
                    target_entity = topic_entity

                # Get columns/fields from both entities
                source_columns = []
                target_columns = []

                if isinstance(source_entity, Table):
                    source_columns = [
                        col.name.root for col in source_entity.columns or []
                    ]
                elif isinstance(source_entity, Topic) and source_entity.messageSchema:
                    # Handle nested Avro schema structure (e.g., top-level RECORD with children)
                    source_columns = []
                    for field in source_entity.messageSchema.schemaFields or []:
                        if field.children:
                            # If field has children, use the children names (nested structure)
                            source_columns.extend(
                                [
                                    child.name.root
                                    if hasattr(child.name, "root")
                                    else str(child.name)
                                    for child in field.children
                                ]
                            )
                        else:
                            # Otherwise use the field name directly
                            source_columns.append(
                                field.name.root
                                if hasattr(field.name, "root")
                                else str(field.name)
                            )

                if isinstance(target_entity, Table):
                    target_columns = [
                        col.name.root for col in target_entity.columns or []
                    ]
                elif isinstance(target_entity, Topic) and target_entity.messageSchema:
                    # Handle nested schema structure (Avro, Protobuf, or JSONSchema with nested fields)
                    target_columns = []
                    for field in target_entity.messageSchema.schemaFields or []:
                        if field.children:
                            # If field has children, use the children names (nested structure)
                            target_columns.extend(
                                [
                                    child.name.root
                                    if hasattr(child.name, "root")
                                    else str(child.name)
                                    for child in field.children
                                ]
                            )
                        else:
                            # Otherwise use the field name directly
                            target_columns.append(
                                field.name.root
                                if hasattr(field.name, "root")
                                else str(field.name)
                            )

                logger.debug(
                    f"Source entity type: {type(source_entity).__name__}, columns: {source_columns[:5] if len(source_columns) > 5 else source_columns}"
                )
                logger.debug(
                    f"Target entity type: {type(target_entity).__name__}, columns: {target_columns[:5] if len(target_columns) > 5 else target_columns}"
                )

                # Match columns by name (case-insensitive)
                for source_col_name in source_columns:
                    for target_col_name in target_columns:
                        if str(source_col_name).lower() == str(target_col_name).lower():
                            try:
                                # For Topic entities with nested schema, we need to find the full path
                                if isinstance(source_entity, Topic):
                                    from_col = self._get_topic_field_fqn(
                                        source_entity, source_col_name
                                    )
                                else:
                                    from_col = get_column_fqn(
                                        table_entity=source_entity,
                                        column=source_col_name,
                                    )

                                if isinstance(target_entity, Topic):
                                    to_col = self._get_topic_field_fqn(
                                        target_entity, target_col_name
                                    )
                                else:
                                    to_col = get_column_fqn(
                                        table_entity=target_entity,
                                        column=target_col_name,
                                    )

                                if from_col and to_col:
                                    column_lineages.append(
                                        ColumnLineage(
                                            fromColumns=[from_col],
                                            toColumn=to_col,
                                            function=None,
                                        )
                                    )
                                    logger.debug(
                                        f"Added column lineage: {from_col} -> {to_col}"
                                    )
                                else:
                                    logger.debug(
                                        f"Could not create column lineage: from_col={from_col}, to_col={to_col}"
                                    )
                            except Exception as exc:
                                logger.debug(
                                    f"Error creating column lineage for {source_col_name} -> {target_col_name}: {exc}"
                                )

            logger.debug(f"Total column lineages created: {len(column_lineages)}")
            return column_lineages if column_lineages else None

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to build column lineage: {exc}")

        return None

    def yield_pipeline_lineage_details(
        self, pipeline_details: KafkaConnectPipelineDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Get lineage between pipeline and data sources
        """
        try:
            if not self.service_connection.messagingServiceName:
                logger.debug("Kafka messagingServiceName not found")
                return

            pipeline_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Pipeline,
                service_name=self.context.get().pipeline_service,
                pipeline_name=self.context.get().pipeline,
            )

            pipeline_entity = self.metadata.get_by_name(
                entity=Pipeline, fqn=pipeline_fqn
            )

            dataset_entity = self.get_dataset_entity(pipeline_details=pipeline_details)

            for topic in pipeline_details.topics or []:
                topic_fqn = fqn.build(
                    metadata=self.metadata,
                    entity_type=Topic,
                    service_name=self.service_connection.messagingServiceName,
                    topic_name=str(topic.name),
                )

                topic_entity = self.metadata.get_by_name(entity=Topic, fqn=topic_fqn)

                if topic_entity is None or dataset_entity is None:
                    continue

                if pipeline_details.conn_type.lower() == "sink":
                    from_entity, to_entity = topic_entity, dataset_entity
                else:
                    from_entity, to_entity = dataset_entity, topic_entity

                # Build column-level lineage (best effort - don't fail entity-level lineage)
                column_lineage = None
                try:
                    column_lineage = self.build_column_lineage(
                        from_entity=from_entity,
                        to_entity=to_entity,
                        topic_entity=topic_entity,
                        pipeline_details=pipeline_details,
                    )
                except Exception as exc:
                    logger.warning(
                        f"Failed to build column-level lineage for {pipeline_details.name}: {exc}. "
                        "Entity-level lineage will still be created."
                    )
                    logger.debug(traceback.format_exc())

                lineage_details = LineageDetails(
                    pipeline=EntityReference(
                        id=pipeline_entity.id.root, type="pipeline"
                    ),
                    source=LineageSource.PipelineLineage,
                    columnsLineage=column_lineage,
                )

                yield Either(
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=from_entity.id,
                                type=ENTITY_REFERENCE_TYPE_MAP[
                                    type(from_entity).__name__
                                ],
                            ),
                            toEntity=EntityReference(
                                id=to_entity.id,
                                type=ENTITY_REFERENCE_TYPE_MAP[
                                    type(to_entity).__name__
                                ],
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

    def get_pipelines_list(self) -> Iterable[KafkaConnectPipelineDetails]:
        """
        Get List of all pipelines
        """
        try:
            yield from self.client.get_connector_list()
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get pipeline list due to : {exc}")

    def get_pipeline_name(self, pipeline_details: KafkaConnectPipelineDetails) -> str:
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
        self, pipeline_details: KafkaConnectPipelineDetails
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
                timestamp=Timestamp(datetime_to_ts(datetime.now()))
                # Kafka connect doesn't provide any details with exec time
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
