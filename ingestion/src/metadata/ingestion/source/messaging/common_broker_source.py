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
Common Broker for fetching metadata
"""

import concurrent.futures
import traceback
from abc import ABC
from typing import Iterable, Optional

import confluent_kafka
from confluent_kafka import KafkaError, KafkaException
from confluent_kafka.admin import ConfigResource
from confluent_kafka.schema_registry.avro import AvroDeserializer
from confluent_kafka.schema_registry.schema_registry_client import Schema

from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.entity.data.topic import Topic as TopicEntity
from metadata.generated.schema.entity.data.topic import TopicSampleData
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.schema import SchemaType, Topic
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.ometa_topic_data import OMetaTopicSampleData
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.messaging.messaging_service import (
    BrokerTopicDetails,
    MessagingServiceSource,
)
from metadata.parsers.schema_parsers import (
    InvalidSchemaTypeException,
    schema_parser_config_registry,
)
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.messaging_utils import merge_and_clean_protobuf_schema

logger = ingestion_logger()


def on_partitions_assignment_to_consumer(consumer, partitions):
    # get offset tuple from the first partition
    for partition in partitions:
        last_offset = consumer.get_watermark_offsets(partition)
        # get latest 50 messages, if there are no more than 50 messages we try to fetch from beginning of the queue
        partition.offset = last_offset[1] - 50 if last_offset[1] > 50 else 0
    consumer.assign(partitions)


class CommonBrokerSource(MessagingServiceSource, ABC):
    """
    Common Broker Source Class
    to fetch topics from Broker based sources
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.generate_sample_data = self.config.sourceConfig.config.generateSampleData
        self.service_connection = self.config.serviceConnection.root.config
        self.admin_client = self.connection.admin_client
        self.schema_registry_client = self.connection.schema_registry_client
        self.context.processed_schemas = {}
        if self.generate_sample_data:
            self.consumer_client = self.connection.consumer_client

    def get_topic_list(self) -> Iterable[BrokerTopicDetails]:
        topics_dict = self.admin_client.list_topics().topics
        for topic_name, topic_metadata in topics_dict.items():
            yield BrokerTopicDetails(
                topic_name=topic_name, topic_metadata=topic_metadata
            )

    def get_topic_name(self, topic_details: BrokerTopicDetails) -> str:
        """
        Get Topic Name
        """
        return topic_details.topic_name

    def yield_topic(
        self, topic_details: BrokerTopicDetails
    ) -> Iterable[Either[CreateTopicRequest]]:
        try:
            schema_type_map = {
                key.lower(): value.value
                for key, value in SchemaType.__members__.items()
            }
            logger.info(f"Fetching topic schema {topic_details.topic_name}")
            topic_schema = self._parse_topic_metadata(topic_details.topic_name)
            logger.info(f"Fetching topic config {topic_details.topic_name}")
            topic = CreateTopicRequest(
                name=EntityName(topic_details.topic_name),
                service=FullyQualifiedEntityName(self.context.get().messaging_service),
                partitions=len(topic_details.topic_metadata.partitions),
                replicationFactor=len(
                    topic_details.topic_metadata.partitions.get(0).replicas
                ),
            )
            topic_config_resource = self.admin_client.describe_configs(
                [
                    ConfigResource(
                        confluent_kafka.admin.RESOURCE_TOPIC, topic_details.topic_name
                    )
                ]
            )
            self.add_properties_to_topic_from_resource(topic, topic_config_resource)
            if topic_schema is not None:
                schema_type = topic_schema.schema_type.lower()
                load_parser_fn = schema_parser_config_registry.registry.get(schema_type)
                if not load_parser_fn:
                    raise InvalidSchemaTypeException(
                        f"Cannot find {schema_type} in parser providers registry."
                    )
                schema_text = topic_schema.schema_str

                # In protobuf schema, we need to merge all the schema text with references
                if schema_type == SchemaType.Protobuf.value.lower():
                    schema_text = merge_and_clean_protobuf_schema(
                        self._get_schema_text_with_references(schema=topic_schema)
                    )
                schema_fields = load_parser_fn(topic_details.topic_name, schema_text)

                topic.messageSchema = Topic(
                    schemaText=topic_schema.schema_str,
                    schemaType=schema_type_map.get(
                        topic_schema.schema_type.lower(), SchemaType.Other.value
                    ),
                    schemaFields=schema_fields if schema_fields is not None else [],
                )
            else:
                topic.messageSchema = Topic(
                    schemaText="", schemaType=SchemaType.Other, schemaFields=[]
                )
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

    @staticmethod
    def add_properties_to_topic_from_resource(
        topic: CreateTopicRequest, topic_config_resource: dict
    ) -> None:
        """
        Stateful operation that adds new properties to a given Topic
        """
        try:
            for resource_value in concurrent.futures.as_completed(
                iter(topic_config_resource.values())
            ):
                config_response = resource_value.result(timeout=10)
                if "max.message.bytes" in config_response:
                    topic.maximumMessageSize = config_response.get(
                        "max.message.bytes", {}
                    ).value

                if "min.insync.replicas" in config_response:
                    topic.minimumInSyncReplicas = config_response.get(
                        "min.insync.replicas"
                    ).value

                if "retention.ms" in config_response:
                    topic.retentionTime = config_response.get("retention.ms").value

                if "retention.bytes" in config_response:
                    topic.retentionSize = config_response.get("retention.bytes").value

                if "cleanup.policy" in config_response:
                    cleanup_policies = config_response.get("cleanup.policy").value
                    topic.cleanupPolicies = cleanup_policies.split(",")

                topic_config = {}
                for key, conf_response in config_response.items():
                    topic_config[key] = conf_response.value
                topic.topicConfig = topic_config

        except (KafkaException, KafkaError) as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Exception adding properties to topic [{topic.name}]: {exc}"
            )

    def _get_schema_text_with_references(self, schema) -> Optional[str]:
        """
        Returns the schema text with references resolved using recursive calls
        """
        try:
            if schema:
                schema_text = schema.schema_str
                for reference in schema.references or []:
                    if not self.context.processed_schemas.get(reference.name):
                        self.context.processed_schemas[reference.name] = True
                        reference_schema = (
                            self.schema_registry_client.get_latest_version(
                                reference.name
                            )
                        )
                        if reference_schema.schema.references:
                            schema_text = (
                                schema_text
                                + self._get_schema_text_with_references(
                                    reference_schema.schema
                                )
                            )
                        else:
                            schema_text = (
                                schema_text + reference_schema.schema.schema_str
                            )
                return schema_text
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to get schema with references: {exc}")
        return None

    def _parse_topic_metadata(self, topic_name: str) -> Optional[Schema]:

        # To find topic in artifact registry, dafault is "<topic_name>-value"
        # But suffix can be overridden using schemaRegistryTopicSuffixName
        topic_schema_registry_name = (
            topic_name + self.service_connection.schemaRegistryTopicSuffixName
        )

        try:
            if self.schema_registry_client:
                registered_schema = self.schema_registry_client.get_latest_version(
                    topic_schema_registry_name
                )
                return registered_schema.schema
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                (
                    f"Failed to get schema for topic [{topic_name}] "
                    f"(looking for {topic_schema_registry_name}) in registry: {exc}"
                )
            )
            self.status.warning(
                topic_name, f"failed to get schema: {exc} for topic {topic_name}"
            )
        return None

    def yield_topic_sample_data(
        self, topic_details: BrokerTopicDetails
    ) -> Iterable[Either[TopicSampleData]]:
        """
        Method to Get Sample Data of Messaging Entity
        """
        topic_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Topic,
            service_name=self.context.get().messaging_service,
            topic_name=self.context.get().topic,
        )
        topic_entity = self.metadata.get_by_name(entity=TopicEntity, fqn=topic_fqn)
        if topic_entity and self.generate_sample_data:
            topic_name = topic_details.topic_name
            sample_data = []
            messages = None
            try:
                if self.consumer_client:
                    self.consumer_client.subscribe(
                        [topic_name], on_assign=on_partitions_assignment_to_consumer
                    )
                    logger.info(
                        f"Broker consumer polling for sample messages in topic {topic_name}"
                    )
                    messages = self.consumer_client.consume(num_messages=10, timeout=10)
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=topic_details.topic_name,
                        error=f"Failed to fetch sample data from topic {topic_name}: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )
            else:
                if messages:
                    for message in messages:
                        try:
                            value = message.value()
                            sample_data.append(
                                self.decode_message(
                                    value,
                                    topic_entity.messageSchema.schemaText,
                                    topic_entity.messageSchema.schemaType,
                                )
                            )
                        except Exception as exc:
                            logger.warning(
                                f"Failed to decode sample data from topic {topic_name}: {exc}"
                            )
            if self.consumer_client:
                self.consumer_client.unsubscribe()
            yield Either(
                right=OMetaTopicSampleData(
                    topic=topic_entity,
                    sample_data=TopicSampleData(messages=sample_data),
                )
            )

    def decode_message(self, record: bytes, schema: str, schema_type: SchemaType):
        if schema_type == SchemaType.Avro:
            deserializer = AvroDeserializer(
                schema_str=schema, schema_registry_client=self.schema_registry_client
            )
            return str(deserializer(record, None))
        if schema_type == SchemaType.Protobuf:
            logger.debug("Protobuf deserializing sample data is not supported")
            return ""
        return str(record.decode("utf-8"))

    def close(self):
        if self.generate_sample_data and self.consumer_client:
            self.consumer_client.close()
