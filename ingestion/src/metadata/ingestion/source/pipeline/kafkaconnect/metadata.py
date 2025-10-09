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
from typing import Any, Iterable, List, Optional

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
from metadata.ingestion.source.pipeline.kafkaconnect.client import parse_cdc_topic_name
from metadata.ingestion.source.pipeline.kafkaconnect.models import (
    ConnectorType,
    KafkaConnectPipelineDetails,
    KafkaConnectTopics,
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

# CDC envelope field names used for Debezium detection and parsing
CDC_ENVELOPE_FIELDS = {"after", "before", "op"}


def get_field_name(field_name: Any) -> str:
    """
    Extract string name from FieldName object or string.

    Args:
        field_name: FieldName object with .root attribute, or plain string

    Returns:
        String representation of the field name
    """
    return field_name.root if hasattr(field_name, "root") else str(field_name)


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
                description=(
                    Markdown(pipeline_details.description)
                    if pipeline_details.description
                    else None
                ),
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

    def _get_entity_column_fqn(self, entity: T, column_name: str) -> Optional[str]:
        """
        Get column FQN for any supported entity type.
        Dispatch based on entity type.

        Args:
            entity: Table or Topic entity
            column_name: Column/field name

        Returns:
            Fully qualified column name or None
        """
        if isinstance(entity, Topic):
            return self._get_topic_field_fqn(entity, column_name)
        elif isinstance(entity, Table):
            return get_column_fqn(table_entity=entity, column=column_name)
        else:
            logger.warning(
                f"Unsupported entity type for column FQN: {type(entity).__name__}"
            )
            return None

    def _parse_cdc_schema_columns(self, schema_text: str) -> List[str]:
        """
        Parse Debezium CDC schema JSON to extract table column names.

        Looks for columns in 'after' or 'before' fields within the schema,
        handling nullable oneOf structures.

        Args:
            schema_text: Raw JSON schema string from topic

        Returns:
            List of column names, or empty list if parsing fails
        """
        try:
            import json

            schema_dict = json.loads(schema_text)

            # Look for 'after' or 'before' field in the schema
            for field_name in ["after", "before"]:
                if field_name not in schema_dict.get("properties", {}):
                    continue

                field_def = schema_dict["properties"][field_name]

                # Handle oneOf (nullable types)
                if "oneOf" not in field_def:
                    continue

                for option in field_def["oneOf"]:
                    if isinstance(option, dict) and option.get("type") == "object":
                        columns = list(option.get("properties", {}).keys())
                        logger.debug(
                            f"Parsed {len(columns)} columns from CDC '{field_name}' field"
                        )
                        return columns

        except Exception as exc:
            logger.debug(f"Unable to parse CDC schema text: {exc}")

        return []

    def _extract_columns_from_entity(self, entity: T) -> List[str]:
        """
        Extract column/field names from Table or Topic entity.

        For Debezium CDC topics, extracts columns from the 'after' or 'before' field
        which contains the actual table structure, not the CDC envelope fields.

        Args:
            entity: Table or Topic entity

        Returns:
            List of column/field names
        """
        if isinstance(entity, Table):
            return [col.name.root for col in entity.columns or []]

        if hasattr(entity, "messageSchema") and entity.messageSchema:
            schema_fields = entity.messageSchema.schemaFields or []

            # Check if this is a Debezium CDC envelope structure
            # Can be either flat (top-level: op, before, after) or nested (Envelope -> op, before, after)
            field_names = {get_field_name(f.name) for f in schema_fields}
            is_debezium_cdc = CDC_ENVELOPE_FIELDS.issubset(field_names)

            # Fallback: Check schemaText for CDC structure if schemaFields doesn't indicate CDC
            if not is_debezium_cdc and entity.messageSchema.schemaText:
                try:
                    import json

                    schema_dict = json.loads(entity.messageSchema.schemaText)
                    schema_props = schema_dict.get("properties", {})
                    # Check if schemaText has CDC envelope fields
                    is_debezium_cdc = CDC_ENVELOPE_FIELDS.issubset(
                        set(schema_props.keys())
                    )
                except Exception:
                    pass

            logger.debug(
                f"Topic {get_field_name(entity.name) if hasattr(entity, 'name') else 'unknown'}: field_names={field_names}, is_debezium_cdc={is_debezium_cdc}"
            )

            # Check for nested Debezium CDC structure (single Envelope field with CDC children)
            if not is_debezium_cdc and len(schema_fields) == 1:
                envelope_field = schema_fields[0]
                if envelope_field.children:
                    envelope_child_names = {
                        get_field_name(c.name) for c in envelope_field.children
                    }
                    is_debezium_cdc = CDC_ENVELOPE_FIELDS.issubset(envelope_child_names)
                    if is_debezium_cdc:
                        logger.debug(
                            f"Nested Debezium CDC envelope detected: {get_field_name(envelope_field.name)}"
                        )
                        schema_fields = (
                            envelope_field.children
                        )  # Use envelope children as schema fields

            if is_debezium_cdc:
                # For Debezium CDC, extract columns from the 'after' field (or 'before' as fallback)
                # The 'after' field contains the complete record structure after the change
                for field in schema_fields:
                    field_name_str = get_field_name(field.name)
                    # Prefer 'after' for source connectors (contains new/updated record state)
                    if field_name_str == "after" and field.children:
                        columns = [
                            get_field_name(child.name) for child in field.children
                        ]
                        logger.debug(
                            f"Debezium CDC: extracted {len(columns)} columns from 'after' field"
                        )
                        return columns

                # Fallback to 'before' if 'after' has no children
                for field in schema_fields:
                    field_name_str = get_field_name(field.name)
                    if field_name_str == "before" and field.children:
                        columns = [
                            get_field_name(child.name) for child in field.children
                        ]
                        logger.debug(
                            f"Debezium CDC: extracted {len(columns)} columns from 'before' field"
                        )
                        return columns

                # Final fallback: Parse schemaText if after/before don't have children
                if entity.messageSchema.schemaText:
                    columns = self._parse_cdc_schema_columns(
                        entity.messageSchema.schemaText
                    )
                    if columns:
                        logger.debug(
                            f"Debezium CDC: extracted {len(columns)} columns from schemaText"
                        )
                        return columns

                logger.debug(
                    "Debezium CDC detected but unable to extract columns from after/before fields"
                )
                return []

            # Non-CDC topic: extract all fields
            columns = []
            for field in schema_fields:
                if field.children:
                    columns.extend(
                        [get_field_name(child.name) for child in field.children]
                    )
                else:
                    columns.append(get_field_name(field.name))
            return columns

        return []

    def _get_topic_field_fqn(
        self, topic_entity: Topic, field_name: str
    ) -> Optional[str]:
        """
        Get the fully qualified name for a field in a Topic's schema.
        Handles nested structures where fields may be children of a parent RECORD.
        For Debezium CDC topics, searches for fields inside after/before envelope children.
        """
        if (
            not topic_entity.messageSchema
            or not topic_entity.messageSchema.schemaFields
        ):
            logger.debug(
                f"Topic {get_field_name(topic_entity.name)} has no message schema"
            )
            return None

        # Search for the field in the schema (including nested fields)
        for field in topic_entity.messageSchema.schemaFields:
            field_name_str = get_field_name(field.name)

            # Check if it's a direct field
            if field_name_str == field_name:
                return (
                    field.fullyQualifiedName.root if field.fullyQualifiedName else None
                )

            # Check if it's a child field (nested - one level deep)
            if field.children:
                # For Debezium CDC, prioritize 'after' over 'before' when searching for grandchildren
                children_to_search = field.children
                after_child = None
                before_child = None

                for child in field.children:
                    child_name = get_field_name(child.name)
                    if child_name == "after":
                        after_child = child
                    elif child_name == "before":
                        before_child = child
                    # Check direct child match
                    if child_name == field_name:
                        return (
                            child.fullyQualifiedName.root
                            if child.fullyQualifiedName
                            else None
                        )

                # Search grandchildren - prefer 'after' over 'before' for CDC topics
                for cdc_child in [after_child, before_child]:
                    if cdc_child and cdc_child.children:
                        for grandchild in cdc_child.children:
                            if get_field_name(grandchild.name) == field_name:
                                return (
                                    grandchild.fullyQualifiedName.root
                                    if grandchild.fullyQualifiedName
                                    else None
                                )

                # Search other grandchildren (non-CDC fields)
                for child in field.children:
                    if child not in [after_child, before_child] and child.children:
                        for grandchild in child.children:
                            if get_field_name(grandchild.name) == field_name:
                                return (
                                    grandchild.fullyQualifiedName.root
                                    if grandchild.fullyQualifiedName
                                    else None
                                )

        # For Debezium CDC topics, columns might only exist in schemaText (not as field objects)
        # Manually construct FQN: topicFQN.Envelope.columnName
        for field in topic_entity.messageSchema.schemaFields:
            field_name_str = get_field_name(field.name)
            # Check if this is a CDC envelope field
            if "Envelope" in field_name_str and field.fullyQualifiedName:
                # Construct FQN manually for CDC column
                envelope_fqn = field.fullyQualifiedName.root
                return f"{envelope_fqn}.{field_name}"

        logger.debug(
            f"Field {field_name} not found in topic {get_field_name(topic_entity.name)} schema"
        )
        return None

    def build_column_lineage(
        self,
        from_entity: T,
        to_entity: T,
        topic_entity: Topic,
        pipeline_details: KafkaConnectPipelineDetails,
    ) -> Optional[List[ColumnLineage]]:
        """
        Build column-level lineage between source table, topic, and target table.
        For source connectors: Table columns -> Topic schema fields
        For sink connectors: Topic schema fields -> Table columns
        """
        try:
            column_lineages = []

            # Get column mappings from connector config if available
            if pipeline_details.dataset and pipeline_details.dataset.column_mappings:
                # Use explicit column mappings from connector config
                for mapping in pipeline_details.dataset.column_mappings:
                    if pipeline_details.conn_type == ConnectorType.SINK.value:
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
                if pipeline_details.conn_type == ConnectorType.SINK.value:
                    source_entity = topic_entity
                    target_entity = to_entity
                else:
                    source_entity = from_entity
                    target_entity = topic_entity

                # Extract columns from both entities
                source_columns = self._extract_columns_from_entity(source_entity)
                target_columns = self._extract_columns_from_entity(target_entity)

                logger.debug(
                    f"Column matching for {pipeline_details.name}: "
                    f"source={len(source_columns)} cols from {source_entity.__class__.__name__}, "
                    f"target={len(target_columns)} cols from {target_entity.__class__.__name__}"
                )
                logger.debug(f"Source columns: {source_columns[:5]}")  # First 5
                logger.debug(f"Target columns: {target_columns}")

                # Create lookup dictionary for O(n) performance instead of O(n²)
                target_cols_map = {str(col).lower(): col for col in target_columns}

                # Match columns by name (case-insensitive)
                for source_col_name in source_columns:
                    source_key = str(source_col_name).lower()
                    if source_key in target_cols_map:
                        target_col_name = target_cols_map[source_key]
                        logger.debug(
                            f"Matched column: {source_col_name} -> {target_col_name}"
                        )
                        try:
                            # Get fully qualified names for source and target columns
                            from_col = self._get_entity_column_fqn(
                                source_entity, source_col_name
                            )
                            to_col = self._get_entity_column_fqn(
                                target_entity, target_col_name
                            )

                            logger.debug(f"FQNs: from_col={from_col}, to_col={to_col}")

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
                        except (KeyError, AttributeError) as exc:
                            logger.debug(
                                f"Error creating column lineage for {source_col_name} -> {target_col_name}: {exc}"
                            )

            if column_lineages:
                logger.debug(
                    f"Created {len(column_lineages)} column lineages for {pipeline_details.name}"
                )
            return column_lineages if column_lineages else None

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to build column lineage: {exc}")

        return None

    def _query_cdc_topics_from_messaging_service(
        self, database_server_name: str
    ) -> List[KafkaConnectTopics]:
        """
        Query topics from messaging service and filter by CDC naming pattern.

        Used for CDC connectors without explicit topic lists - discovers topics
        by matching against database.server.name prefix.

        Args:
            database_server_name: The database.server.name or topic.prefix from connector config

        Returns:
            List of matching CDC topics
        """
        topics_found = []

        try:
            logger.debug(
                f"CDC connector without topics list - querying messaging service "
                f"for pattern: {database_server_name}.*"
            )

            # List topics from the configured messaging service only
            topics_list = self.metadata.list_entities(
                entity=Topic,
                fields=["name", "fullyQualifiedName", "service"],
                params={"service": self.service_connection.messagingServiceName},
            ).entities

            # Filter topics that match the CDC naming pattern
            for topic_entity in topics_list or []:
                topic_name = (
                    topic_entity.name.root
                    if hasattr(topic_entity.name, "root")
                    else str(topic_entity.name)
                )

                # Parse the topic to see if it's a CDC topic related to this connector
                topic_info = parse_cdc_topic_name(topic_name, database_server_name)
                if topic_info:
                    topics_found.append(KafkaConnectTopics(name=topic_name))
                    logger.debug(f"Matched CDC topic: {topic_name} -> {topic_info}")

        except Exception as exc:
            logger.debug(f"Unable to query topics from messaging service: {exc}")

        return topics_found

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

            # Get database.server.name or topic.prefix for CDC topic parsing
            # These are ONLY set by Debezium CDC connectors
            database_server_name = None
            if pipeline_details.config:
                database_server_name = pipeline_details.config.get(
                    "database.server.name"
                ) or pipeline_details.config.get("topic.prefix")

            # For CDC connectors without explicit topics, query topics from messaging service
            # and filter by CDC naming pattern
            # Only do this for Debezium CDC connectors (identified by database.server.name or topic.prefix)
            topics_to_process = pipeline_details.topics or []
            if (
                not topics_to_process
                and database_server_name
                and pipeline_details.conn_type == ConnectorType.SOURCE.value
            ):
                topics_to_process = self._query_cdc_topics_from_messaging_service(
                    database_server_name
                )

            for topic in topics_to_process:
                topic_fqn = fqn.build(
                    metadata=self.metadata,
                    entity_type=Topic,
                    service_name=self.service_connection.messagingServiceName,
                    topic_name=str(topic.name),
                )

                topic_entity = self.metadata.get_by_name(entity=Topic, fqn=topic_fqn)

                if topic_entity is None:
                    continue

                # If no dataset entity from config, try to parse table info from CDC topic name
                current_dataset_entity = dataset_entity
                if (
                    current_dataset_entity is None
                    and pipeline_details.conn_type == ConnectorType.SOURCE.value
                ):
                    # Parse CDC topic name to extract table information
                    topic_info = parse_cdc_topic_name(
                        str(topic.name), database_server_name
                    )
                    if topic_info.get("database") and topic_info.get("table"):
                        logger.debug(
                            f"Parsed CDC topic {topic.name}: database={topic_info['database']}, table={topic_info['table']}"
                        )
                        # Try to find the table entity
                        for (
                            dbservicename
                        ) in self.source_config.lineageInformation.dbServiceNames or [
                            "*"
                        ]:
                            table_fqn = fqn.build(
                                metadata=self.metadata,
                                entity_type=Table,
                                table_name=topic_info["table"],
                                database_name=None,
                                schema_name=topic_info["database"],
                                service_name=dbservicename,
                            )
                            current_dataset_entity = self.metadata.get_by_name(
                                entity=Table, fqn=table_fqn
                            )
                            if current_dataset_entity:
                                logger.debug(f"Found table entity: {table_fqn}")
                                break

                if current_dataset_entity is None:
                    # No table entity found, skip this topic
                    continue

                if pipeline_details.conn_type == ConnectorType.SINK.value:
                    from_entity, to_entity = topic_entity, current_dataset_entity
                else:
                    from_entity, to_entity = current_dataset_entity, topic_entity

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
                timestamp=Timestamp(datetime_to_ts(datetime.now())),
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
