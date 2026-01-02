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
Google Cloud Pub/Sub source ingestion
"""
import traceback
from typing import Iterable, List, Optional, Union

from google.api_core.exceptions import GoogleAPIError
from google.protobuf.duration_pb2 import Duration
from google.pubsub_v1.types import Schema as GcpSchema
from google.pubsub_v1.types import Topic as GcpTopic

from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.messaging.pubSubConnection import (
    PubSubConnection,
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
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.schema import SchemaType
from metadata.generated.schema.type.schema import Topic as TopicSchema
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_topic_data import OMetaTopicSampleData
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.messaging.messaging_service import (
    BrokerTopicDetails,
    MessagingServiceSource,
)
from metadata.ingestion.source.messaging.pubsub.models import (
    PubSubBigQueryConfig,
    PubSubSchemaInfo,
    PubSubSubscription,
    PubSubTopicMetadata,
)
from metadata.parsers.schema_parsers import schema_parser_config_registry
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class PubsubSource(MessagingServiceSource):
    """
    Implements the necessary methods to extract
    topic metadata from Google Cloud Pub/Sub
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.generate_sample_data = self.config.sourceConfig.config.generateSampleData
        self.pubsub = self.connection
        self.project_id = self.pubsub.project_id

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: PubSubConnection = config.serviceConnection.root.config
        if not isinstance(connection, PubSubConnection):
            raise InvalidSourceException(
                f"Expected PubSubConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_topic_list(self) -> Iterable[BrokerTopicDetails]:
        """
        Method to yield topic details from Pub/Sub
        """
        project_path = f"projects/{self.project_id}"
        try:
            topics = self.pubsub.publisher.list_topics(
                request={"project": project_path}
            )
            for topic in topics:
                topic_name = topic.name.split("/")[-1]
                try:
                    topic_metadata = self._get_topic_metadata(topic)
                    yield BrokerTopicDetails(
                        topic_name=topic_name,
                        topic_metadata=topic_metadata,
                    )
                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Failed to get metadata for topic {topic_name}: {err}"
                    )
        except GoogleAPIError as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to list topics from Pub/Sub: {err}")

    def get_topic_name(self, topic_details: BrokerTopicDetails) -> str:
        return topic_details.topic_name

    def _get_topic_metadata(self, topic: GcpTopic) -> PubSubTopicMetadata:
        """
        Get detailed metadata for a topic including subscriptions and schema.

        Args:
            topic: GCP Pub/Sub Topic object from the API.

        Returns:
            PubSubTopicMetadata with all extracted information.
        """
        subscriptions = []
        if self.service_connection.includeSubscriptions:
            subscriptions = self._get_topic_subscriptions(topic.name)

        schema_info = None
        if (
            self.service_connection.schemaRegistryEnabled
            and topic.schema_settings
            and topic.schema_settings.schema
        ):
            schema_info = self._get_schema_info(topic.schema_settings.schema)

        retention_duration = self._format_duration(topic.message_retention_duration)

        return PubSubTopicMetadata(
            name=topic.name,
            labels=dict(topic.labels) if topic.labels else None,
            message_retention_duration=retention_duration,
            schema_settings=schema_info,
            subscriptions=subscriptions,
            ordering_enabled=getattr(topic, "message_ordering_enabled", False),
            kms_key_name=topic.kms_key_name if topic.kms_key_name else None,
        )

    def _get_topic_subscriptions(self, topic_name: str) -> List[PubSubSubscription]:
        """
        Get all subscriptions for a topic
        """
        subscriptions = []
        try:
            subscription_paths = self.pubsub.publisher.list_topic_subscriptions(
                request={"topic": topic_name}
            )
            for sub_path in subscription_paths:
                try:
                    sub_info = self.pubsub.subscriber.get_subscription(
                        request={"subscription": sub_path}
                    )
                    bigquery_config = None
                    if (
                        hasattr(sub_info, "bigquery_config")
                        and sub_info.bigquery_config
                    ):
                        bigquery_config = PubSubBigQueryConfig(
                            table=sub_info.bigquery_config.table,
                            use_topic_schema=getattr(
                                sub_info.bigquery_config, "use_topic_schema", None
                            ),
                            write_metadata=getattr(
                                sub_info.bigquery_config, "write_metadata", None
                            ),
                            drop_unknown_fields=getattr(
                                sub_info.bigquery_config, "drop_unknown_fields", None
                            ),
                        )

                    subscriptions.append(
                        PubSubSubscription(
                            name=sub_path.split("/")[-1],
                            ack_deadline_seconds=sub_info.ack_deadline_seconds,
                            message_retention_duration=self._format_duration(
                                sub_info.message_retention_duration
                            ),
                            dead_letter_topic=(
                                sub_info.dead_letter_policy.dead_letter_topic
                                if sub_info.dead_letter_policy
                                else None
                            ),
                            push_endpoint=(
                                sub_info.push_config.push_endpoint
                                if sub_info.push_config
                                else None
                            ),
                            filter=sub_info.filter if sub_info.filter else None,
                            bigquery_config=bigquery_config,
                            enable_exactly_once_delivery=getattr(
                                sub_info, "enable_exactly_once_delivery", None
                            ),
                        )
                    )
                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.warning(f"Failed to get subscription {sub_path}: {err}")
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to list subscriptions for {topic_name}: {err}")
        return subscriptions

    def _get_schema_info(self, schema_name: str) -> Optional[PubSubSchemaInfo]:
        """
        Get schema information from Pub/Sub Schema Registry
        """
        if not schema_name or not self.pubsub.schema_client:
            return None
        try:
            schema = self.pubsub.schema_client.get_schema(request={"name": schema_name})
            schema_type_name = GcpSchema.Type(schema.type_).name
            return PubSubSchemaInfo(
                name=schema.name.split("/")[-1],
                schema_type=schema_type_name,
                definition=schema.definition,
                revision_id=schema.revision_id if schema.revision_id else None,
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to get schema {schema_name}: {err}")
        return None

    def yield_topic(
        self, topic_details: BrokerTopicDetails
    ) -> Iterable[Either[CreateTopicRequest]]:
        """
        Method to yield the create topic request
        """
        try:
            logger.info(f"Fetching topic details {topic_details.topic_name}")

            metadata: PubSubTopicMetadata = topic_details.topic_metadata

            source_url = (
                f"https://console.cloud.google.com/cloudpubsub/topic/detail/"
                f"{topic_details.topic_name}?project={self.project_id}"
            )

            partitions = len(metadata.subscriptions) if metadata.subscriptions else 1
            retention_time = self._parse_retention(metadata.message_retention_duration)

            topic = CreateTopicRequest(
                name=EntityName(topic_details.topic_name),
                service=FullyQualifiedEntityName(self.context.get().messaging_service),
                partitions=partitions,
                retentionTime=retention_time,
                sourceUrl=SourceUrl(source_url),
            )

            if metadata.schema_settings and metadata.schema_settings.definition:
                schema_type = self._map_schema_type(
                    metadata.schema_settings.schema_type
                )
                schema_fields = self._parse_schema(
                    topic_details.topic_name,
                    metadata.schema_settings.definition,
                    schema_type,
                )
                topic.messageSchema = TopicSchema(
                    schemaText=metadata.schema_settings.definition,
                    schemaType=schema_type,
                    schemaFields=schema_fields or [],
                )

            topic_config = {}
            if metadata.subscriptions:
                topic_config["subscriptions"] = [s.name for s in metadata.subscriptions]
            if metadata.ordering_enabled:
                topic_config["ordering_enabled"] = metadata.ordering_enabled
            if metadata.labels:
                topic_config["labels"] = metadata.labels
            if metadata.kms_key_name:
                topic_config["kms_key_name"] = metadata.kms_key_name
            if topic_config:
                topic.topicConfig = topic_config

            yield Either(right=topic)
            self.register_record(topic_request=topic)

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=topic_details.topic_name,
                    error=f"Unexpected exception to yield topic [{topic_details}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _format_duration(
        self, duration: Optional[Union[Duration, str]]
    ) -> Optional[str]:
        """
        Format a Duration protobuf or string to a string representation.

        Args:
            duration: Either a protobuf Duration object or a string.

        Returns:
            String representation of the duration in seconds format (e.g., "604800s").
        """
        if not duration:
            return None
        if isinstance(duration, Duration):
            total_seconds = duration.seconds + (duration.nanos / 1e9)
            return f"{total_seconds}s"
        return str(duration)

    def _parse_retention(self, duration: Optional[Union[Duration, str]]) -> float:
        """
        Parse retention duration to milliseconds.

        Args:
            duration: Either a protobuf Duration object or a string.

        Returns:
            Duration in milliseconds as a float.
        """
        if not duration:
            return 0.0

        try:
            if isinstance(duration, Duration):
                total_seconds = duration.seconds + (duration.nanos / 1e9)
                return total_seconds * 1000

            duration_str = str(duration)
            if "seconds" in duration_str:
                seconds = float(duration_str.split()[0])
                return seconds * 1000
            if duration_str.endswith("s"):
                return float(duration_str[:-1]) * 1000
        except (ValueError, IndexError, AttributeError):
            logger.debug(f"Failed to parse duration: {duration}")
        return 0.0

    def _map_schema_type(self, pubsub_type: str) -> SchemaType:
        """
        Map Pub/Sub schema type to OpenMetadata SchemaType
        """
        mapping = {
            "AVRO": SchemaType.Avro,
            "PROTOCOL_BUFFER": SchemaType.Protobuf,
        }
        return mapping.get(pubsub_type, SchemaType.Other)

    def _parse_schema(
        self, topic_name: str, schema_text: str, schema_type: SchemaType
    ) -> Optional[List]:
        """
        Parse schema text using the schema parser registry.

        Args:
            topic_name: Name of the topic for logging purposes.
            schema_text: Raw schema definition text.
            schema_type: Type of schema (Avro, Protobuf, etc.).

        Returns:
            List of parsed schema fields or None if parsing fails.
        """
        try:
            load_parser_fn = schema_parser_config_registry.registry.get(
                schema_type.value.lower()
            )
            if load_parser_fn:
                return load_parser_fn(topic_name, schema_text)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to parse schema for {topic_name}: {exc}")
        return None

    def yield_topic_sample_data(
        self, topic_details: BrokerTopicDetails
    ) -> Iterable[Either[OMetaTopicSampleData]]:
        """
        Method to get sample data of topic entity.

        Note: Pub/Sub requires pulling from a subscription to get messages.
        This is more complex than Kafka as messages are not stored on topics.
        Sample data extraction requires creating and consuming from a subscription.
        """
        if not self.generate_sample_data:
            return

        try:
            topic_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Topic,
                service_name=self.context.get().messaging_service,
                topic_name=self.context.get().topic,
            )
            topic_entity = self.metadata.get_by_name(entity=Topic, fqn=topic_fqn)
            if topic_entity:
                logger.info(
                    f"Sample data extraction for Pub/Sub topic {topic_fqn} "
                    "requires subscription-based message pulling, which is not "
                    "implemented in this version."
                )
        except Exception as err:
            yield Either(
                left=StackTraceError(
                    name=topic_details.topic_name,
                    error=(
                        f"Error while yielding topic sample data for topic: "
                        f"{topic_details.topic_name} - {err}"
                    ),
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_bigquery_lineage(
        self, topic_details: BrokerTopicDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Yield lineage from Pub/Sub topic to BigQuery tables via BigQuery subscriptions
        """
        metadata: PubSubTopicMetadata = topic_details.topic_metadata
        if not metadata.subscriptions:
            return

        for subscription in metadata.subscriptions:
            if (
                not subscription.bigquery_config
                or not subscription.bigquery_config.table
            ):
                continue

            try:
                bq_table_fqn = subscription.bigquery_config.table
                parts = bq_table_fqn.split(".")
                if len(parts) >= 3:
                    table_fqn = f"{parts[0]}.{parts[1]}.{parts[2]}"
                else:
                    table_fqn = bq_table_fqn

                table_entity = self.metadata.get_by_name(entity=Table, fqn=table_fqn)
                if not table_entity:
                    logger.debug(
                        f"BigQuery table {table_fqn} not found for lineage from "
                        f"topic {topic_details.topic_name}"
                    )
                    continue

                topic_fqn = fqn.build(
                    metadata=self.metadata,
                    entity_type=Topic,
                    service_name=self.context.get().messaging_service,
                    topic_name=topic_details.topic_name,
                )
                topic_entity = self.metadata.get_by_name(entity=Topic, fqn=topic_fqn)
                if not topic_entity:
                    continue

                yield Either(
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=topic_entity.id,
                                type="topic",
                            ),
                            toEntity=EntityReference(
                                id=table_entity.id,
                                type="table",
                            ),
                            lineageDetails=LineageDetails(
                                source=LineageSource.PipelineLineage,
                                description=(
                                    f"BigQuery subscription '{subscription.name}' "
                                    f"writes from Pub/Sub topic to BigQuery table"
                                ),
                            ),
                        )
                    )
                )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Failed to create lineage for subscription {subscription.name}: {exc}"
                )
