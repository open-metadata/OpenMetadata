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
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.entity.services.messagingService import MessagingService
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
from metadata.ingestion.source.pipeline.kafkaconnect.client import (
    CONNECTOR_CLASS_TO_SERVICE_TYPE,
    MESSAGING_ENDPOINT_KEYS,
    SERVICE_TYPE_HOSTNAME_KEYS,
    parse_cdc_topic_name,
)
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

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        # Track lineage results for summary reporting
        self.lineage_results = []
        # Cache services for hostname matching (lazy loaded)
        self._database_services_cache = None
        self._messaging_services_cache = None

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

    @property
    def database_services(self) -> List[DatabaseService]:
        """Lazily load and cache database services for hostname matching"""
        if self._database_services_cache is None:
            self._database_services_cache = list(
                self.metadata.list_all_entities(entity=DatabaseService, limit=100)
            )
            logger.debug(
                f"Cached {len(self._database_services_cache)} database services for hostname matching"
            )
        return self._database_services_cache

    @property
    def messaging_services(self) -> List[MessagingService]:
        """Lazily load and cache messaging services for broker matching"""
        if self._messaging_services_cache is None:
            self._messaging_services_cache = list(
                self.metadata.list_all_entities(entity=MessagingService, limit=100)
            )
            logger.debug(
                f"Cached {len(self._messaging_services_cache)} messaging services for broker matching"
            )
        return self._messaging_services_cache

    def _extract_hostname(self, host_string: str) -> str:
        """
        Extract just the hostname from a connection string by removing protocol and port.

        Args:
            host_string: Connection string (e.g., "SASL_SSL://host:9092", "host:3306", "host")

        Returns:
            Just the hostname part (e.g., "host")
        """
        if not host_string:
            return ""

        # Remove protocol prefix (e.g., "SASL_SSL://", "http://", "jdbc:mysql://")
        if "://" in host_string:
            host_string = host_string.split("://", 1)[1]

        # Remove port suffix (e.g., ":9092", ":3306")
        if ":" in host_string:
            host_string = host_string.split(":")[0]

        return host_string.strip()

    def find_database_service_by_hostname(
        self, service_type: str, hostname: str
    ) -> Optional[str]:
        """
        Find database service by matching serviceType and hostname.

        Args:
            service_type: OpenMetadata service type (e.g., "Mysql", "Postgres")
            hostname: Hostname from Kafka Connect config (e.g., "localhost:3306", "db.example.com")

        Returns:
            Service name if found, None otherwise
        """
        try:
            # Use cached database services
            all_services = self.database_services

            # Filter by serviceType first to reduce the search space
            filtered_services = [
                svc
                for svc in all_services
                if svc.serviceType and svc.serviceType.value == service_type
            ]

            logger.debug(
                f"Found {len(filtered_services)} services with serviceType={service_type} "
                f"out of {len(all_services)} total database services"
            )

            # Extract just the hostname (no protocol, no port)
            connector_host = self._extract_hostname(hostname).lower()

            # Match by hostname in service connection config
            for service in filtered_services:
                if not service.connection or not service.connection.config:
                    continue

                service_config = service.connection.config

                # Extract hostPort from service config
                # Different services use different field names
                host_port = None
                if hasattr(service_config, "hostPort") and service_config.hostPort:
                    host_port = service_config.hostPort
                elif hasattr(service_config, "host") and service_config.host:
                    host_port = service_config.host

                if host_port:
                    # Extract just the hostname (no protocol, no port)
                    service_host = self._extract_hostname(host_port).lower()

                    # Match hostname (case-insensitive)
                    if service_host == connector_host:
                        logger.info(
                            f"Matched database service: {service.name} "
                            f"(type={service_type}, hostname={connector_host})"
                        )
                        return str(
                            service.name.root
                            if hasattr(service.name, "root")
                            else service.name
                        )

            logger.debug(
                f"No database service found matching serviceType={service_type}, hostname={connector_host}"
            )
            return None

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to find database service by hostname: {exc}")
            return None

    def find_messaging_service_by_brokers(self, brokers: str) -> Optional[str]:
        """
        Find messaging service by matching broker endpoints.

        Args:
            brokers: Comma-separated broker list from Kafka Connect config
                    (e.g., "SASL_SSL://broker1:9092,broker2:9092")

        Returns:
            Service name if found, None otherwise
        """
        try:
            # Use cached messaging services
            all_services = self.messaging_services

            logger.debug(f"Searching for messaging service matching brokers: {brokers}")

            # Parse connector brokers into a set of hostnames (no protocol, no port)
            connector_brokers = set(
                self._extract_hostname(broker.strip()).lower()
                for broker in brokers.split(",")
            )

            # Match by brokers in service connection config
            for service in all_services:
                if not service.connection or not service.connection.config:
                    continue

                service_config = service.connection.config

                # Extract bootstrapServers from Kafka connection
                if (
                    hasattr(service_config, "bootstrapServers")
                    and service_config.bootstrapServers
                ):
                    # Parse service brokers into hostnames (no protocol, no port)
                    service_brokers = set(
                        self._extract_hostname(broker.strip()).lower()
                        for broker in service_config.bootstrapServers.split(",")
                    )

                    # Check if any broker hostname matches
                    matched_brokers = (
                        connector_brokers & service_brokers
                    )  # Set intersection
                    if matched_brokers:
                        logger.info(
                            f"Matched messaging service: {service.name} "
                            f"(matched broker hostnames: {matched_brokers})"
                        )
                        return str(
                            service.name.root
                            if hasattr(service.name, "root")
                            else service.name
                        )

            logger.debug(
                f"No messaging service found matching broker hostnames: {connector_brokers}"
            )
            return None

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to find messaging service by brokers: {exc}")
            return None

    def get_service_from_connector_config(
        self, pipeline_details: KafkaConnectPipelineDetails
    ) -> tuple[Optional[str], Optional[str]]:
        """
        Extract and match database and messaging service names from connector configuration.

        Args:
            pipeline_details: Kafka Connect pipeline details with config

        Returns:
            Tuple of (database_service_name, messaging_service_name)
            Either or both can be None if not found
        """
        db_service_name = None
        messaging_service_name = None

        if not pipeline_details.config:
            return db_service_name, messaging_service_name

        try:
            # Extract connector class to determine service type
            connector_class = pipeline_details.config.get("connector.class", "")

            # Get the class name without package (e.g., "MySqlCdcSource" from "io.debezium.connector.mysql.MySqlCdcSource")
            if connector_class:
                class_name = connector_class.split(".")[-1]
                service_type = CONNECTOR_CLASS_TO_SERVICE_TYPE.get(class_name)

                if service_type:
                    # Extract hostname from connector config
                    hostname_keys = SERVICE_TYPE_HOSTNAME_KEYS.get(service_type, [])
                    for key in hostname_keys:
                        hostname = pipeline_details.config.get(key)
                        if hostname:
                            logger.debug(
                                f"Found hostname '{hostname}' for service type '{service_type}' "
                                f"from config key '{key}'"
                            )
                            # Match database service
                            db_service_name = self.find_database_service_by_hostname(
                                service_type=service_type, hostname=hostname
                            )
                            if db_service_name:
                                break

            # Extract broker endpoints for messaging service
            for key in MESSAGING_ENDPOINT_KEYS:
                brokers = pipeline_details.config.get(key)
                if brokers:
                    logger.debug(f"Found brokers '{brokers}' from config key '{key}'")
                    messaging_service_name = self.find_messaging_service_by_brokers(
                        brokers=brokers
                    )
                    if messaging_service_name:
                        break

            return db_service_name, messaging_service_name

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unable to extract service names from connector config: {exc}"
            )
            return None, None

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
                    # Try to match database service from connector config first
                    db_service_name, _ = self.get_service_from_connector_config(
                        pipeline_details
                    )

                    # Priority 1: Use matched service from connector config
                    if db_service_name:
                        logger.info(
                            f"Using matched database service '{db_service_name}' from connector config"
                        )
                        dataset_entity = self.metadata.get_by_name(
                            entity=dataset_details.dataset_type,
                            fqn=fqn.build(
                                metadata=self.metadata,
                                entity_type=dataset_details.dataset_type,
                                table_name=dataset_details.table,
                                database_name=None,
                                schema_name=dataset_details.database,
                                service_name=db_service_name,
                            ),
                        )
                        if dataset_entity:
                            return dataset_entity

                    # Priority 2: Use configured dbServiceNames
                    if (
                        hasattr(self.source_config, "lineageInformation")
                        and hasattr(
                            self.source_config.lineageInformation, "dbServiceNames"
                        )
                        and self.source_config.lineageInformation.dbServiceNames
                    ):
                        for (
                            dbservicename
                        ) in self.source_config.lineageInformation.dbServiceNames:
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

                    # Priority 3: Fallback to search across all database services
                    logger.info(
                        f"No service match found - searching all database services for table {dataset_details.table}"
                    )
                    # Build search string: schema.table format (with proper quoting for special chars)
                    search_string = (
                        f"{fqn.quote_name(dataset_details.database)}.{fqn.quote_name(dataset_details.table)}"
                        if dataset_details.database
                        else fqn.quote_name(dataset_details.table)
                    )
                    dataset_entity = self.metadata.search_in_any_service(
                        entity_type=Table,
                        fqn_search_string=search_string,
                    )
                    if dataset_entity:
                        logger.debug(
                            f"Found table {dataset_details.table} via search in service {dataset_entity.service.name if dataset_entity.service else 'unknown'}"
                        )
                        return dataset_entity

                if dataset_details.dataset_type == Container:
                    # If storageServiceNames is configured, use it to build FQN directly
                    if (
                        hasattr(self.source_config, "lineageInformation")
                        and hasattr(
                            self.source_config.lineageInformation, "storageServiceNames"
                        )
                        and self.source_config.lineageInformation.storageServiceNames
                    ):
                        for (
                            storageservicename
                        ) in self.source_config.lineageInformation.storageServiceNames:
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
                    else:
                        # Search across all storage services
                        logger.info(
                            f"storageServiceNames not configured - searching all storage services for container {dataset_details.container_name}"
                        )
                        storage_entity = self.metadata.search_in_any_service(
                            entity_type=Container,
                            fqn_search_string=fqn.quote_name(
                                dataset_details.container_name
                            ),
                        )
                        if storage_entity:
                            logger.debug(
                                f"Found container {dataset_details.container_name} via search in service {storage_entity.service.name if storage_entity.service else 'unknown'}"
                            )
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

    def _search_topics_by_prefix(
        self, database_server_name: str, messaging_service_name: Optional[str] = None
    ) -> List[KafkaConnectTopics]:
        """
        Search for topics in the messaging service that match the database.server.name prefix.

        This is a fallback when table.include.list is not configured in the connector.
        It relies on topics being already ingested in the messaging service.

        Args:
            database_server_name: The database.server.name prefix to search for
            messaging_service_name: Optional messaging service name to narrow search

        Returns:
            List of KafkaConnectTopics that match the prefix
        """
        topics_found = []

        try:
            if not database_server_name:
                return topics_found

            logger.info(
                f"Searching messaging service for topics with prefix: {database_server_name}"
            )

            # Search for topics matching the prefix
            # Use wildcard pattern: <service>."<prefix>.*"
            search_pattern = f"{database_server_name}.*"

            if messaging_service_name:
                # Search in specific messaging service
                from metadata.utils import fqn as fqn_utils

                search_fqn = f"{fqn_utils.quote_name(messaging_service_name)}.{fqn_utils.quote_name(search_pattern)}"
                logger.debug(f"Searching for topics with FQN pattern: {search_fqn}")

                # Get all topics from the messaging service
                from metadata.generated.schema.entity.data.topic import Topic

                topics = list(
                    self.metadata.list_all_entities(
                        entity=Topic,
                        params={"service": messaging_service_name},
                    )
                )

                # Filter topics that start with the database_server_name prefix
                for topic in topics:
                    topic_name = str(
                        topic.name.root if hasattr(topic.name, "root") else topic.name
                    )
                    if topic_name.startswith(database_server_name + "."):
                        # Build full FQN for this topic
                        topic_fqn = (
                            topic.fullyQualifiedName.root
                            if hasattr(topic.fullyQualifiedName, "root")
                            else topic.fullyQualifiedName
                        )
                        topics_found.append(
                            KafkaConnectTopics(name=topic_name, fqn=topic_fqn)
                        )
                        logger.debug(
                            f"Found matching topic: {topic_name} (FQN: {topic_fqn})"
                        )

            if topics_found:
                logger.info(
                    f"Found {len(topics_found)} topics matching prefix '{database_server_name}' "
                    f"in messaging service"
                )
            else:
                logger.warning(
                    f"No topics found matching prefix '{database_server_name}'. "
                    f"Ensure the messaging service has ingested topics before running Kafka Connect ingestion."
                )

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to search topics by prefix: {exc}")

        return topics_found

    def _parse_cdc_topics_from_config(
        self, pipeline_details: KafkaConnectPipelineDetails, database_server_name: str
    ) -> List[KafkaConnectTopics]:
        """
        Parse CDC topic names from connector config using table.include.list.

        For CDC connectors, topics follow pattern: {database.server.name}.{schema}.{table}
        Extracts table list from config and constructs expected topic names.

        Args:
            pipeline_details: Kafka Connect pipeline details with config
            database_server_name: The database.server.name from connector config

        Returns:
            List of KafkaConnectTopics with topic names
        """
        topics_found = []

        try:
            if not pipeline_details.config:
                return topics_found

            # Get table include list from connector config
            table_include_list = None
            for key in ["table.include.list", "table.whitelist"]:
                if pipeline_details.config.get(key):
                    table_include_list = pipeline_details.config.get(key)
                    logger.debug(
                        f"Found table list from config key '{key}': {table_include_list}"
                    )
                    break

            if not table_include_list:
                logger.warning(
                    f"⚠️  CDC connector '{pipeline_details.name}' is missing table.include.list or table.whitelist.\n"
                    f"   Without this configuration, lineage cannot be created automatically.\n"
                    f'   Add to connector config: "table.include.list": "schema1.table1,schema2.table2"\n'
                )
                return topics_found

            # Parse table list (format: "schema1.table1,schema2.table2")
            for table_entry in table_include_list.split(","):
                table_entry = table_entry.strip()
                if not table_entry:
                    continue

                # Construct CDC topic name: {database.server.name}.{schema}.{table}
                # table_entry is already "schema.table" format
                topic_name = f"{database_server_name}.{table_entry}"

                topics_found.append(KafkaConnectTopics(name=topic_name))
                logger.debug(f"Parsed CDC topic from config: {topic_name}")

            logger.info(
                f"Parsed {len(topics_found)} CDC topics from table.include.list"
            )

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to parse CDC topics from connector config: {exc}")

        return topics_found

    def yield_pipeline_lineage_details(
        self, pipeline_details: KafkaConnectPipelineDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Get lineage between pipeline and data sources
        """
        try:
            # Try to match messaging service from connector config
            _, messaging_service_name = self.get_service_from_connector_config(
                pipeline_details
            )

            # Use matched service if found, otherwise fall back to configured name
            effective_messaging_service = messaging_service_name or (
                self.service_connection.messagingServiceName
                if hasattr(self.service_connection, "messagingServiceName")
                else None
            )

            if effective_messaging_service:
                logger.info(
                    f"Using messaging service '{effective_messaging_service}' "
                    f"({'matched from config' if messaging_service_name else 'from configuration'})"
                )
            else:
                logger.info(
                    "No messaging service specified - will search all messaging services for topics"
                )

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

            # For CDC connectors without explicit topics, parse topics from connector config
            # using table.include.list and database.server.name
            # Only do this for Debezium CDC connectors (identified by database.server.name or topic.prefix)
            topics_to_process = pipeline_details.topics or []
            if (
                not topics_to_process
                and database_server_name
                and pipeline_details.conn_type == ConnectorType.SOURCE.value
            ):
                # Try to parse topics from table.include.list first
                topics_to_process = self._parse_cdc_topics_from_config(
                    pipeline_details=pipeline_details,
                    database_server_name=database_server_name,
                )

                # If table.include.list is not available, fallback to searching topics by prefix
                # This requires topics to be already ingested in the messaging service
                if not topics_to_process and effective_messaging_service:
                    logger.info(
                        f"Falling back to searching topics by prefix in messaging service '{effective_messaging_service}'"
                    )
                    topics_to_process = self._search_topics_by_prefix(
                        database_server_name=database_server_name,
                        messaging_service_name=effective_messaging_service,
                    )

            for topic in topics_to_process:
                topic_entity = None

                logger.info(f"Processing topic: {topic.name}")

                # If we have FQN from CDC topic discovery, use it directly
                if topic.fqn:
                    logger.info(f"Searching for topic using pre-built FQN: {topic.fqn}")
                    topic_entity = self.metadata.get_by_name(
                        entity=Topic, fqn=topic.fqn
                    )
                    if topic_entity:
                        logger.info(f"✓ Found topic using stored FQN: {topic.fqn}")
                    else:
                        logger.warning(f"✗ Topic NOT found using FQN: {topic.fqn}")
                # If messaging service is known (matched or configured), use it to build FQN
                elif effective_messaging_service:
                    # fqn.build() already quotes each component (service_name and topic_name)
                    topic_fqn = fqn.build(
                        metadata=self.metadata,
                        entity_type=Topic,
                        service_name=effective_messaging_service,
                        topic_name=str(topic.name),
                    )
                    logger.info(
                        f"Built topic FQN: {topic_fqn} "
                        f"(service={effective_messaging_service}, topic_name={topic.name})"
                    )
                    topic_entity = self.metadata.get_by_name(
                        entity=Topic, fqn=topic_fqn
                    )
                    if topic_entity:
                        logger.info(f"✓ Found topic using built FQN: {topic_fqn}")
                    else:
                        logger.warning(
                            f"✗ Topic NOT found using FQN: {topic_fqn} "
                            f"(service={effective_messaging_service}, topic_name={topic.name})"
                        )
                else:
                    # Fallback: Search across all messaging services
                    search_string = f"*.{fqn.quote_name(str(topic.name))}"
                    logger.info(
                        f"Searching for topic across all services using pattern: {search_string}"
                    )
                    topic_entity = self.metadata.search_in_any_service(
                        entity_type=Topic,
                        fqn_search_string=search_string,
                    )
                    if topic_entity:
                        logger.info(
                            f"✓ Found topic via search: {topic.name} in service "
                            f"{topic_entity.service.name if topic_entity.service else 'unknown'}"
                        )
                    else:
                        logger.warning(f"✗ Topic NOT found via search: {search_string}")

                # If topic not found, we'll still try to create table → pipeline lineage
                if topic_entity is None:
                    logger.warning(
                        f"Topic {topic.name} not found in OpenMetadata - will create direct table → pipeline lineage"
                    )
                else:
                    logger.info(f"✓ Successfully found topic entity: {topic.name}")

                # If no dataset entity from config, try to parse table info from CDC topic name
                current_dataset_entity = dataset_entity
                if current_dataset_entity:
                    logger.info(
                        f"Using dataset entity from config: {current_dataset_entity.fullyQualifiedName.root if hasattr(current_dataset_entity.fullyQualifiedName, 'root') else current_dataset_entity.fullyQualifiedName}"
                    )

                if (
                    current_dataset_entity is None
                    and pipeline_details.conn_type == ConnectorType.SOURCE.value
                ):
                    # Parse CDC topic name to extract table information
                    logger.info(
                        f"Parsing CDC topic name to extract table info: {topic.name}"
                    )
                    topic_info = parse_cdc_topic_name(
                        str(topic.name), database_server_name
                    )
                    if topic_info.get("database") and topic_info.get("table"):
                        logger.info(
                            f"Parsed CDC topic {topic.name}: schema={topic_info['database']}, table={topic_info['table']}"
                        )

                        # Get matched database service name
                        db_service_name, _ = self.get_service_from_connector_config(
                            pipeline_details
                        )

                        # Try to find the table entity
                        # Use wildcard search pattern since we don't know the database name
                        # Pattern: service.*.schema.table
                        if db_service_name:
                            # Use matched database service first with wildcard search
                            logger.info(
                                f"Using matched database service: {db_service_name}"
                            )
                            # Build wildcard FQN: service.*.schema.table
                            search_pattern = f"{fqn.quote_name(db_service_name)}.*.{fqn.quote_name(topic_info['database'])}.{fqn.quote_name(topic_info['table'])}"
                            logger.info(
                                f"Searching for table with pattern: {search_pattern} "
                                f"(service={db_service_name}, schema={topic_info['database']}, table={topic_info['table']})"
                            )

                            current_dataset_entity = (
                                self.metadata.search_in_any_service(
                                    entity_type=Table,
                                    fqn_search_string=search_pattern,
                                )
                            )
                            if current_dataset_entity:
                                logger.info(
                                    f"✓ Found table using matched service pattern: {search_pattern}"
                                )
                            else:
                                logger.warning(
                                    f"✗ Table NOT found using matched service pattern: {search_pattern}"
                                )

                        if (
                            not current_dataset_entity
                            and hasattr(self.source_config, "lineageInformation")
                            and hasattr(
                                self.source_config.lineageInformation, "dbServiceNames"
                            )
                            and self.source_config.lineageInformation.dbServiceNames
                        ):
                            # Try configured database services with wildcard search
                            logger.info(
                                f"Trying configured database services: {self.source_config.lineageInformation.dbServiceNames}"
                            )
                            for (
                                dbservicename
                            ) in self.source_config.lineageInformation.dbServiceNames:
                                # Build wildcard FQN: service.*.schema.table
                                search_pattern = f"{fqn.quote_name(dbservicename)}.*.{fqn.quote_name(topic_info['database'])}.{fqn.quote_name(topic_info['table'])}"
                                logger.info(
                                    f"Searching for table with pattern: {search_pattern}"
                                )

                                current_dataset_entity = (
                                    self.metadata.search_in_any_service(
                                        entity_type=Table,
                                        fqn_search_string=search_pattern,
                                    )
                                )
                                if current_dataset_entity:
                                    logger.info(
                                        f"✓ Found table in service {dbservicename}: {search_pattern}"
                                    )
                                    break
                                else:
                                    logger.debug(
                                        f"✗ Table NOT found in service {dbservicename}"
                                    )

                        if not current_dataset_entity:
                            # Search across all database services
                            search_string = f"{fqn.quote_name(topic_info['database'])}.{fqn.quote_name(topic_info['table'])}"
                            logger.info(
                                f"Searching for table across all services using pattern: {search_string}"
                            )
                            current_dataset_entity = (
                                self.metadata.search_in_any_service(
                                    entity_type=Table,
                                    fqn_search_string=search_string,
                                )
                            )
                            if current_dataset_entity:
                                logger.info(
                                    f"✓ Found table via search in service "
                                    f"{current_dataset_entity.service.name if current_dataset_entity.service else 'unknown'}: "
                                    f"{current_dataset_entity.fullyQualifiedName.root if hasattr(current_dataset_entity.fullyQualifiedName, 'root') else current_dataset_entity.fullyQualifiedName}"
                                )
                            else:
                                logger.warning(
                                    f"✗ Table NOT found via search: {search_string}"
                                )
                    else:
                        logger.warning(
                            f"Failed to parse table info from CDC topic name: {topic.name}"
                        )

                # Lineage must always be between data assets (Table ↔ Topic)
                # The pipeline is referenced in lineageDetails, not as a node in the graph
                # Skip lineage if we don't have BOTH table and topic
                if current_dataset_entity is None or topic_entity is None:
                    # Get table FQN for tracking
                    if current_dataset_entity:
                        table_fqn_str = (
                            current_dataset_entity.fullyQualifiedName.root
                            if hasattr(
                                current_dataset_entity.fullyQualifiedName, "root"
                            )
                            else str(current_dataset_entity.fullyQualifiedName)
                        )
                    else:
                        # Table not found - construct debug message with search details
                        table_fqn_str = "NOT FOUND"

                        # Get matched database service name and hostname
                        (
                            db_service_name_for_debug,
                            _,
                        ) = self.get_service_from_connector_config(pipeline_details)

                        # Extract hostname from connector config
                        db_hostname_for_debug = "NOT SET"
                        if pipeline_details.config:
                            db_hostname_for_debug = (
                                pipeline_details.config.get("database.hostname")
                                or pipeline_details.config.get("database.server")
                                or pipeline_details.config.get("connection.host")
                                or "NOT SET"
                            )

                        # Build debug message with what we searched for
                        if (
                            "topic_info" in locals()
                            and topic_info.get("database")
                            and topic_info.get("table")
                        ):
                            search_details = (
                                f"{topic_info['database']}.{topic_info['table']}"
                            )
                            if db_service_name_for_debug:
                                table_fqn_str = f"NOT FOUND (service: {db_service_name_for_debug}, searched: {search_details})"
                            else:
                                table_fqn_str = f"NOT FOUND (searched: {search_details}, hostname: {db_hostname_for_debug}, no service matched)"
                        else:
                            table_fqn_str = f"NOT FOUND (hostname: {db_hostname_for_debug}, no CDC topic info)"

                    # Get topic FQN for tracking (show expected FQN even if not found)
                    if topic_entity:
                        # Topic exists - use actual FQN
                        topic_fqn_str = (
                            topic_entity.fullyQualifiedName.root
                            if hasattr(topic_entity.fullyQualifiedName, "root")
                            else str(topic_entity.fullyQualifiedName)
                        )
                    else:
                        # Topic not found - construct expected FQN with service name and quoting
                        if effective_messaging_service and topic:
                            # Build expected FQN: service."topic.name"
                            topic_fqn_str = fqn.build(
                                metadata=self.metadata,
                                entity_type=Topic,
                                service_name=effective_messaging_service,
                                topic_name=str(topic.name),
                            )
                        elif topic:
                            # No service configured - show quoted topic name
                            topic_fqn_str = f'"{fqn.quote_name(str(topic.name))}"'
                        else:
                            topic_fqn_str = "NOT FOUND"

                    # Track failure reason
                    if current_dataset_entity is None and topic_entity is None:
                        failure_reason = "Missing both table and topic"
                    elif current_dataset_entity is None:
                        failure_reason = "Missing table"
                    else:
                        failure_reason = "Missing topic"

                    self.lineage_results.append(
                        {
                            "connector": pipeline_details.name,
                            "table_fqn": table_fqn_str,
                            "topic_fqn": topic_fqn_str,
                            "status": "FAILED",
                            "reason": failure_reason,
                        }
                    )
                    logger.warning("=" * 80)
                    logger.warning(
                        f"⚠️  SKIPPING LINEAGE for connector: {pipeline_details.name}"
                    )
                    logger.warning("=" * 80)

                    # Log connector configuration for debugging FQN construction
                    logger.debug(
                        "\n📋 CONNECTOR CONFIGURATION (used for FQN construction):"
                    )
                    if pipeline_details.config:
                        # Extract key config values used for FQN building
                        connector_class = pipeline_details.config.get(
                            "connector.class", "NOT SET"
                        )
                        db_hostname = (
                            pipeline_details.config.get("database.hostname")
                            or pipeline_details.config.get("database.server")
                            or pipeline_details.config.get("connection.host")
                            or "NOT SET"
                        )
                        bootstrap_servers = (
                            pipeline_details.config.get("kafka.bootstrap.servers")
                            or pipeline_details.config.get("bootstrap.servers")
                            or "NOT SET"
                        )
                        table_include_list = (
                            pipeline_details.config.get("table.include.list")
                            or pipeline_details.config.get("table.whitelist")
                            or "NOT SET"
                        )

                        logger.debug(
                            f"   • connector.class: {connector_class}\n"
                            f"   • database.server.name: {database_server_name or 'NOT SET'}\n"
                            f"   • database.hostname: {db_hostname}\n"
                            f"   • table.include.list: {table_include_list}\n"
                            f"   • bootstrap.servers: {bootstrap_servers}\n"
                            f"   • Connector type: {pipeline_details.conn_type}"
                        )
                    else:
                        logger.debug("   NO CONFIG AVAILABLE")

                    # Build expected topic FQN with proper quoting
                    expected_topic_fqn = None
                    topic_fqn_params = {}
                    if effective_messaging_service:
                        topic_fqn_params = {
                            "service_name": effective_messaging_service,
                            "topic_name": str(topic.name),
                        }
                        expected_topic_fqn = fqn.build(
                            metadata=self.metadata,
                            entity_type=Topic,
                            **topic_fqn_params,
                        )

                    # Build expected table FQN if we parsed CDC topic info
                    expected_table_fqn = None
                    table_fqn_params = {}
                    if (
                        "topic_info" in locals()
                        and topic_info.get("database")
                        and topic_info.get("table")
                    ):
                        # Get matched database service name
                        (
                            db_service_name_for_log,
                            _,
                        ) = self.get_service_from_connector_config(pipeline_details)
                        if db_service_name_for_log:
                            # Use wildcard pattern since we don't know the database name
                            # Pattern: service.*.schema.table
                            table_fqn_params = {
                                "service_name": db_service_name_for_log,
                                "schema_name": topic_info["database"],
                                "table_name": topic_info["table"],
                                "database_name": "* (wildcard - database name unknown)",
                            }
                            expected_table_fqn = f"{fqn.quote_name(db_service_name_for_log)}.*.{fqn.quote_name(topic_info['database'])}.{fqn.quote_name(topic_info['table'])}"

                    # Log FQN construction details
                    logger.debug("\n🔧 FQN CONSTRUCTION DETAILS:")
                    if expected_topic_fqn:
                        logger.debug(f"   Topic FQN built with: {topic_fqn_params}")
                        logger.debug(f"   → Result: {expected_topic_fqn}")
                    else:
                        logger.debug(
                            f"   Topic FQN: NOT BUILT (messaging service not configured)"
                        )

                    if expected_table_fqn:
                        logger.debug(f"   Table FQN built with: {table_fqn_params}")
                        logger.debug(f"   → Result: {expected_table_fqn}")
                    elif "topic_info" in locals() and topic_info:
                        logger.debug(
                            f"   Table FQN: NOT BUILT (parsed topic_info: {topic_info}, but no db service matched)"
                        )
                    else:
                        logger.debug(
                            f"   Table FQN: NOT BUILT (no CDC topic info parsed)"
                        )

                    # Get bootstrap servers from config
                    bootstrap_servers = "NOT SET"
                    if pipeline_details.config:
                        bootstrap_servers = (
                            pipeline_details.config.get("kafka.bootstrap.servers")
                            or pipeline_details.config.get("bootstrap.servers")
                            or "NOT SET"
                        )

                    if current_dataset_entity is None and topic_entity is None:
                        expected_fqn_display = (
                            expected_topic_fqn
                            or f'<messaging-service>."{topic.name}" (messaging service not configured)'
                        )

                        logger.warning(
                            f"❌ MISSING BOTH SOURCE AND SINK:\n"
                            f"   • Table: NOT FOUND (searched for table related to topic '{topic.name}')\n"
                            f"   • Topic: NOT FOUND (searched for topic '{topic.name}')\n"
                            f"\n"
                            f"💡 ACTION REQUIRED:\n"
                            f"   1. Ensure the topic is ingested in OpenMetadata:\n"
                            f"      - Topic name: {topic.name}\n"
                            f"      - Expected FQN: {expected_fqn_display}\n"
                            f"      - Messaging service: {effective_messaging_service or 'NOT CONFIGURED - will search all services'}\n"
                            f"      - Run messaging service metadata ingestion if needed\n"
                            f"   2. Ensure the source table exists in OpenMetadata:\n"
                            f"      - Verify database service is connected and metadata is ingested\n"
                            f"\n"
                            f"⚠️  Lineage requires BOTH table and topic to be present in OpenMetadata"
                        )
                    elif current_dataset_entity is None:
                        # Extract topic details
                        topic_service = (
                            topic_entity.service.name
                            if hasattr(topic_entity, "service") and topic_entity.service
                            else "UNKNOWN"
                        )
                        topic_fqn_full = (
                            topic_entity.fullyQualifiedName.root
                            if hasattr(topic_entity.fullyQualifiedName, "root")
                            else topic_entity.fullyQualifiedName
                        )

                        logger.warning(
                            f"❌ MISSING SOURCE (Table):\n"
                            f"   • Table: NOT FOUND\n"
                            f"   • Topic: FOUND ✓\n"
                            f"      - FQN: {topic_fqn_full}\n"
                            f"      - Service: {topic_service}\n"
                            f"      - Topic name: {topic.name}\n"
                            f"\n"
                            f"💡 ACTION REQUIRED:\n"
                            f"   1. Ensure the source table is ingested in OpenMetadata:\n"
                            f"      - For CDC connectors: Check table from schema '{topic_info.get('database') if 'topic_info' in locals() else 'UNKNOWN'}'\n"
                            f"      - Table name: {topic_info.get('table') if 'topic_info' in locals() else 'UNKNOWN'}\n"
                            f"      - Verify the table exists in database service\n"
                            f"   2. Check connector configuration:\n"
                            f"      - Connector type: {pipeline_details.conn_type}\n"
                            f"      - Database server: {database_server_name or 'NOT SET'}\n"
                            f"      - Table include list: {pipeline_details.config.get('table.include.list', 'NOT SET') if pipeline_details.config else 'NO CONFIG'}\n"
                            f"\n"
                            f"⚠️  Cannot create lineage without both source (table) and sink (topic)"
                        )
                    else:
                        # Extract table details - split FQN to show components
                        table_fqn_full = (
                            current_dataset_entity.fullyQualifiedName.root
                            if hasattr(
                                current_dataset_entity.fullyQualifiedName, "root"
                            )
                            else current_dataset_entity.fullyQualifiedName
                        )
                        table_service = (
                            current_dataset_entity.service.name
                            if hasattr(current_dataset_entity, "service")
                            and current_dataset_entity.service
                            else "UNKNOWN"
                        )

                        # Parse table FQN: service.database.schema.table
                        table_fqn_parts = str(table_fqn_full).split(".")
                        if len(table_fqn_parts) >= 4:
                            table_db_service = table_fqn_parts[0]
                            table_database = table_fqn_parts[1]
                            table_schema = table_fqn_parts[2]
                            table_name = ".".join(
                                table_fqn_parts[3:]
                            )  # Handle quoted names with dots
                        else:
                            table_db_service = table_service
                            table_database = "UNKNOWN"
                            table_schema = "UNKNOWN"
                            table_name = "UNKNOWN"

                        expected_topic_fqn_display = (
                            expected_topic_fqn or f'<messaging-service>."{topic.name}"'
                        )

                        logger.warning(
                            f"❌ MISSING SINK (Topic):\n"
                            f"   • Table: FOUND ✓\n"
                            f"      - FQN: {table_fqn_full}\n"
                            f"      - Service: {table_db_service}\n"
                            f"      - Database: {table_database}\n"
                            f"      - Schema: {table_schema}\n"
                            f"      - Table: {table_name}\n"
                            f"   • Topic: NOT FOUND\n"
                            f"      - Searched for: {topic.name}\n"
                            f"      - Expected FQN: {expected_topic_fqn_display}\n"
                            f"\n"
                            f"💡 ACTION REQUIRED:\n"
                            f"   1. Ensure the topic is ingested in OpenMetadata:\n"
                            f"      - Topic name in Kafka: {topic.name}\n"
                            f"      - Expected FQN in OM: {expected_topic_fqn_display}\n"
                            f"      - Messaging service: {effective_messaging_service or 'NOT CONFIGURED - will search all services'}\n"
                            f"      - Note: Topics with dots (.) in the name are quoted in FQN\n"
                            f"   2. Run messaging service metadata ingestion:\n"
                            f"      - Ingest topics from messaging service '{effective_messaging_service or 'your-kafka-service'}'\n"
                            f"      - Verify topic '{topic.name}' exists in Kafka cluster\n"
                            f"   3. Check Kafka Connect configuration:\n"
                            f"      - Connector type: {pipeline_details.conn_type}\n"
                            f"      - Bootstrap servers: {bootstrap_servers}\n"
                            f"      - Database server (CDC): {database_server_name or 'NOT SET'}\n"
                            f"\n"
                            f"⚠️  Cannot create lineage without both source (table) and sink (topic)"
                        )

                    logger.warning("=" * 80)
                    continue

                # We have both table and topic - create lineage between them
                logger.info(f"✓ Found both table and topic entities for lineage")

                # Determine lineage direction based on connector type
                if pipeline_details.conn_type == ConnectorType.SINK.value:
                    # SINK: topic → table
                    from_entity, to_entity = topic_entity, current_dataset_entity
                    logger.info(
                        f"Creating SINK lineage: {topic_entity.fullyQualifiedName.root if hasattr(topic_entity.fullyQualifiedName, 'root') else topic_entity.fullyQualifiedName} "
                        f"→ {current_dataset_entity.fullyQualifiedName.root if hasattr(current_dataset_entity.fullyQualifiedName, 'root') else current_dataset_entity.fullyQualifiedName}"
                    )
                else:
                    # SOURCE: table → topic
                    from_entity, to_entity = current_dataset_entity, topic_entity
                    logger.info(
                        f"Creating SOURCE lineage: {current_dataset_entity.fullyQualifiedName.root if hasattr(current_dataset_entity.fullyQualifiedName, 'root') else current_dataset_entity.fullyQualifiedName} "
                        f"→ {topic_entity.fullyQualifiedName.root if hasattr(topic_entity.fullyQualifiedName, 'root') else topic_entity.fullyQualifiedName}"
                    )

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

                # Log entity details before creating lineage request
                from_entity_type = type(from_entity).__name__
                to_entity_type = type(to_entity).__name__
                from_entity_id = (
                    from_entity.id.root
                    if hasattr(from_entity.id, "root")
                    else from_entity.id
                )
                to_entity_id = (
                    to_entity.id.root if hasattr(to_entity.id, "root") else to_entity.id
                )
                from_entity_fqn = (
                    from_entity.fullyQualifiedName.root
                    if hasattr(from_entity.fullyQualifiedName, "root")
                    else from_entity.fullyQualifiedName
                )
                to_entity_fqn = (
                    to_entity.fullyQualifiedName.root
                    if hasattr(to_entity.fullyQualifiedName, "root")
                    else to_entity.fullyQualifiedName
                )

                logger.info(
                    f"Creating lineage edge:\n"
                    f"  FROM: {from_entity_type} | ID={from_entity_id} | FQN={from_entity_fqn}\n"
                    f"  TO:   {to_entity_type} | ID={to_entity_id} | FQN={to_entity_fqn}"
                )

                lineage_details = LineageDetails(
                    pipeline=EntityReference(
                        id=pipeline_entity.id.root, type="pipeline"
                    ),
                    source=LineageSource.PipelineLineage,
                    columnsLineage=column_lineage,
                )

                lineage_request = AddLineageRequest(
                    edge=EntitiesEdge(
                        fromEntity=EntityReference(
                            id=from_entity.id,
                            type=ENTITY_REFERENCE_TYPE_MAP[type(from_entity).__name__],
                        ),
                        toEntity=EntityReference(
                            id=to_entity.id,
                            type=ENTITY_REFERENCE_TYPE_MAP[type(to_entity).__name__],
                        ),
                        lineageDetails=lineage_details,
                    )
                )

                # Track successful lineage creation
                table_fqn_str = (
                    current_dataset_entity.fullyQualifiedName.root
                    if hasattr(current_dataset_entity.fullyQualifiedName, "root")
                    else str(current_dataset_entity.fullyQualifiedName)
                )
                topic_fqn_str = (
                    topic_entity.fullyQualifiedName.root
                    if hasattr(topic_entity.fullyQualifiedName, "root")
                    else str(topic_entity.fullyQualifiedName)
                )
                self.lineage_results.append(
                    {
                        "connector": pipeline_details.name,
                        "table_fqn": table_fqn_str,
                        "topic_fqn": topic_fqn_str,
                        "status": "SUCCESS",
                        "reason": f"{from_entity_type} → {to_entity_type}",
                    }
                )

                # Log successful lineage creation (debug level - details in summary table)
                logger.debug("=" * 80)
                logger.debug(
                    f"✅ LINEAGE CREATED SUCCESSFULLY for connector: {pipeline_details.name}"
                )
                logger.debug("=" * 80)

                # Extract service names for logging
                from_service = "UNKNOWN"
                to_service = "UNKNOWN"
                if hasattr(from_entity, "service") and from_entity.service:
                    from_service = (
                        from_entity.service.name
                        if hasattr(from_entity.service.name, "root")
                        else from_entity.service.name
                    )
                if hasattr(to_entity, "service") and to_entity.service:
                    to_service = (
                        to_entity.service.name
                        if hasattr(to_entity.service.name, "root")
                        else to_entity.service.name
                    )

                logger.debug(
                    f"📊 LINEAGE DETAILS:\n"
                    f"   • FROM: {from_entity_type}\n"
                    f"      - FQN: {from_entity_fqn}\n"
                    f"      - Service: {from_service}\n"
                    f"   • TO: {to_entity_type}\n"
                    f"      - FQN: {to_entity_fqn}\n"
                    f"      - Service: {to_service}\n"
                    f"   • PIPELINE: {pipeline_details.name}\n"
                    f"      - Type: {pipeline_details.conn_type}\n"
                    f"      - Pipeline FQN: {pipeline_fqn}\n"
                    f"   • COLUMN LINEAGE: {len(column_lineage) if column_lineage else 0} column mappings\n"
                )
                logger.debug("=" * 80)

                yield Either(right=lineage_request)
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

    def print_lineage_summary(self):
        """
        Print a summary table of lineage creation results
        """
        if not self.lineage_results:
            return

        logger.info("\n" + "=" * 180)
        logger.info("LINEAGE CREATION SUMMARY")
        logger.info("=" * 180)

        # Count successes and failures
        successes = [r for r in self.lineage_results if r["status"] == "SUCCESS"]
        failures = [r for r in self.lineage_results if r["status"] == "FAILED"]

        # Print header
        logger.info(
            f"{'Connector':<35} | {'Table FQN':<50} | {'Topic FQN':<50} | {'Status':<10} | {'Details':<20}"
        )
        logger.info("-" * 180)

        # Print all results
        for result in self.lineage_results:
            status_icon = "✅" if result["status"] == "SUCCESS" else "❌"
            logger.info(
                f"{result['connector']:<35} | "
                f"{result['table_fqn']:<50} | "
                f"{result['topic_fqn']:<50} | "
                f"{status_icon} {result['status']:<8} | "
                f"{result['reason']:<20}"
            )

        # Print summary stats
        logger.info("=" * 180)
        total = len(self.lineage_results)
        success_count = len(successes)
        failure_count = len(failures)
        success_pct = (success_count / total * 100) if total > 0 else 0

        logger.info(
            f"Total: {total} | Success: {success_count} ({success_pct:.1f}%) | Failed: {failure_count}"
        )
        logger.info("=" * 180 + "\n")

    def close(self):
        """
        Called at the end of the ingestion workflow to cleanup and print summary
        """
        self.print_lineage_summary()
        super().close()
