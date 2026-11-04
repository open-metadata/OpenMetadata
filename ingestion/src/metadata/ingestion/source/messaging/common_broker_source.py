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
import time
import traceback
from abc import ABC
from collections.abc import Iterable
from typing import Any

import confluent_kafka.admin
from cachetools import LRUCache
from confluent_kafka import KafkaError, KafkaException
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
from metadata.generated.schema.type.schema import FieldModel, SchemaType, Topic
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.ometa_topic_data import OMetaTopicSampleData
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.messaging.messaging_service import (
    BrokerTopicDetails,
    MessagingServiceSource,
)
from metadata.ingestion.source.messaging.protobuf_decoder import (
    ProtobufMessageDecoder,
    ProtobufSchema,
    read_writer_schema_id,
)
from metadata.parsers.protobuf_parser import ProtobufParser, ProtobufParserConfig
from metadata.parsers.schema_parsers import (
    InvalidSchemaTypeException,
    schema_parser_config_registry,
)
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.messaging_utils import clean_protobuf_schema

logger = ingestion_logger()

# Confluent wire format: a zero magic byte followed by a 4-byte schema id.
CONFLUENT_MAGIC_BYTE = 0
CONFLUENT_HEADER_LENGTH = 5

AVRO_DESERIALIZER_CACHE_SIZE = 100
PROTOBUF_DECODER_CACHE_SIZE = 100
PROTOBUF_SCHEMA_CACHE_SIZE = 100


def strip_confluent_framing(record: bytes) -> bytes:
    """Drop the Confluent wire-format header from a payload that carries one."""
    if len(record) >= CONFLUENT_HEADER_LENGTH and record[0] == CONFLUENT_MAGIC_BYTE:
        return record[CONFLUENT_HEADER_LENGTH:]
    return record


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
        source_config = self.config.sourceConfig.config
        self.generate_sample_data = getattr(source_config, "storeSampleData", None) or getattr(
            source_config, "generateSampleData", False
        )  # pyright: ignore[reportAttributeAccessIssue]
        if self.generate_sample_data and self._is_sample_data_storing_globally_disabled():
            self.generate_sample_data = False
        self.service_connection = self.config.serviceConnection.root.config
        self.admin_client = self.connection.admin_client
        self.schema_registry_client = self.connection.schema_registry_client
        self._avro_deserializers = LRUCache(maxsize=AVRO_DESERIALIZER_CACHE_SIZE)
        # Protobuf schema with its imported files per topic, held from yield_topic until its
        # sample data is read: the stored schema text lacks its references.
        self._protobuf_schemas = LRUCache(maxsize=PROTOBUF_SCHEMA_CACHE_SIZE)
        # Protobuf schema per writer schema id, or the error that fetching it raised.
        self._protobuf_writer_schemas = LRUCache(maxsize=PROTOBUF_SCHEMA_CACHE_SIZE)
        self._protobuf_decoders = LRUCache(maxsize=PROTOBUF_DECODER_CACHE_SIZE)
        if self.generate_sample_data:
            self.consumer_client = self.connection.consumer_client

    def get_topic_list(self) -> Iterable[BrokerTopicDetails]:
        topics_dict = self.admin_client.list_topics().topics
        for topic_name, topic_metadata in topics_dict.items():
            yield BrokerTopicDetails(topic_name=topic_name, topic_metadata=topic_metadata)

    def get_topic_name(self, topic_details: BrokerTopicDetails) -> str:
        """
        Get Topic Name
        """
        return topic_details.topic_name

    def yield_topic(self, topic_details: BrokerTopicDetails) -> Iterable[Either[CreateTopicRequest]]:
        try:
            schema_type_map = {key.lower(): value for key, value in SchemaType.__members__.items()}
            logger.info(f"Fetching topic schema {topic_details.topic_name}")
            topic_schema = self._parse_topic_metadata(topic_details.topic_name)
            logger.info(f"Fetching topic config {topic_details.topic_name}")
            topic = CreateTopicRequest(
                name=EntityName(topic_details.topic_name),
                service=FullyQualifiedEntityName(self.context.get().messaging_service),
                partitions=len(topic_details.topic_metadata.partitions),
                replicationFactor=len(topic_details.topic_metadata.partitions.get(0).replicas),
            )
            # confluent_kafka.admin ships py.typed but declares no __all__, so every name
            # it exposes reads as a private import to the type checker.
            config_resource = confluent_kafka.admin.ConfigResource(  # pyright: ignore[reportPrivateImportUsage]
                confluent_kafka.admin.RESOURCE_TOPIC,  # pyright: ignore[reportPrivateImportUsage]
                topic_details.topic_name,
            )
            topic_config_resource = self.admin_client.describe_configs([config_resource])
            self.add_properties_to_topic_from_resource(topic, topic_config_resource)
            if topic_schema is not None and topic_schema.schema_type is not None:
                schema_type = topic_schema.schema_type.lower()
                load_parser_fn = schema_parser_config_registry.registry.get(schema_type)
                if not load_parser_fn:
                    raise InvalidSchemaTypeException(f"Cannot find {schema_type} in parser providers registry.")  # noqa: TRY301
                if schema_type == SchemaType.Protobuf.value.lower():
                    schema_fields = self._parse_protobuf_topic_schema(topic_details.topic_name, topic_schema)
                else:
                    schema_fields = load_parser_fn(topic_details.topic_name, topic_schema.schema_str)

                topic.messageSchema = Topic(
                    schemaText=topic_schema.schema_str,
                    schemaType=schema_type_map.get(schema_type, SchemaType.Other),
                    schemaFields=schema_fields if schema_fields is not None else [],
                )
            else:
                topic.messageSchema = Topic(schemaText="", schemaType=SchemaType.Other, schemaFields=[])
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
    def add_properties_to_topic_from_resource(topic: CreateTopicRequest, topic_config_resource: dict) -> None:
        """
        Stateful operation that adds new properties to a given Topic
        """
        try:
            for resource_value in concurrent.futures.as_completed(iter(topic_config_resource.values())):
                config_response = resource_value.result(timeout=10)
                if "max.message.bytes" in config_response:
                    topic.maximumMessageSize = config_response.get("max.message.bytes", {}).value

                if "min.insync.replicas" in config_response:
                    topic.minimumInSyncReplicas = config_response.get("min.insync.replicas").value

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

        # KafkaError is an error-detail object, not a BaseException subclass, so it
        # cannot appear in an except clause -- Python raises TypeError on match.
        except KafkaException as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Exception adding properties to topic [{topic.name}]: {exc}")

    def _parse_protobuf_topic_schema(self, topic_name: str, topic_schema: Schema) -> list[FieldModel] | None:
        """Schema fields of a Protobuf topic. Its schema is kept to read the topic's sample data."""
        try:
            protobuf_schema = self._get_protobuf_schema(topic_schema)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the Protobuf references of topic [%s]: %s", topic_name, exc)
            return None
        if self.generate_sample_data:
            self._protobuf_schemas[topic_name] = protobuf_schema
        parser = ProtobufParser(
            ProtobufParserConfig(
                schema_name=topic_name,
                schema_text=protobuf_schema.text,
                dependencies=dict(protobuf_schema.dependencies),
            )
        )
        return parser.parse_protobuf_schema()

    def _get_protobuf_schema(self, schema: Schema) -> ProtobufSchema:
        """
        A Protobuf schema with the files it imports, at the versions its references pin. Each file
        keeps its own package, so they are compiled side by side rather than merged into one.
        """
        dependencies: dict[str, str] = {}
        self._collect_protobuf_references(schema, dependencies)
        return ProtobufSchema(
            text=clean_protobuf_schema(schema.schema_str or "", dependencies),
            dependencies=tuple(
                (name, clean_protobuf_schema(text, dependencies)) for name, text in dependencies.items()
            ),
        )

    def _collect_protobuf_references(self, schema: Schema, dependencies: dict[str, str]) -> None:
        """Add the text of each file `schema` imports, and of theirs, to `dependencies` by import name."""
        for reference in schema.references or []:
            if not reference.name or reference.name in dependencies:
                continue
            if reference.subject and reference.version is not None:
                registered = self.schema_registry_client.get_version(reference.subject, reference.version)
            else:
                registered = self.schema_registry_client.get_latest_version(reference.name)
            dependencies[reference.name] = registered.schema.schema_str or ""
            self._collect_protobuf_references(registered.schema, dependencies)

    def _parse_topic_metadata(self, topic_name: str) -> Schema | None:

        # To find topic in artifact registry, dafault is "<topic_name>-value"
        # But suffix can be overridden using schemaRegistryTopicSuffixName
        topic_schema_registry_name = topic_name + self.service_connection.schemaRegistryTopicSuffixName

        try:
            if self.schema_registry_client:
                registered_schema = self.schema_registry_client.get_latest_version(topic_schema_registry_name)
                return registered_schema.schema
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                (  # noqa: UP034
                    f"Failed to get schema for topic [{topic_name}] "
                    f"(looking for {topic_schema_registry_name}) in registry: {exc}"
                )
            )
            self.status.warning(topic_name, f"failed to get schema: {exc} for topic {topic_name}")
        return None

    def yield_topic_sample_data(self, topic_details: BrokerTopicDetails) -> Iterable[Either[TopicSampleData]]:
        """
        Method to Get Sample Data of Messaging Entity
        """
        topic_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Topic,
            service_name=self.context.get().messaging_service,
            topic_name=self.context.get().topic,
        )
        topic_protobuf_schema = self._protobuf_schemas.pop(topic_details.topic_name, None)
        topic_entity = self.metadata.get_by_name(entity=TopicEntity, fqn=topic_fqn)
        if topic_entity and self.generate_sample_data:
            topic_name = topic_details.topic_name
            sample_data = []
            messages = None
            try:
                if self.consumer_client:
                    self.consumer_client.subscribe([topic_name], on_assign=on_partitions_assignment_to_consumer)
                    logger.info(f"Broker consumer polling for sample messages in topic {topic_name}")
                    messages = []
                    n_poll = 10
                    total_timeout = 10
                    # Total timeout for polling messages is 10 seconds from now.
                    deadline = time.monotonic() + total_timeout
                    for _ in range(n_poll):
                        try:
                            remaining = deadline - time.monotonic()
                            if remaining <= 0:
                                break
                            msg = self.consumer_client.poll(timeout=remaining)
                        except KafkaException as exc:
                            logger.warning(f"Consumer error polling topic {topic_name}: {exc}")
                            continue
                        if msg is None:
                            break
                        if msg.error():
                            # End of a partition is not a failure; other partitions may still have data.
                            if msg.error().code() != KafkaError._PARTITION_EOF:
                                logger.warning(f"Consumer error polling topic {topic_name}: {msg.error()}")
                            continue
                        messages.append(msg)
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
                    schema = topic_protobuf_schema or topic_entity.messageSchema.schemaText
                    for message in messages:
                        try:
                            value = message.value()
                            sample_data.append(
                                self.decode_message(
                                    value,
                                    schema,
                                    topic_entity.messageSchema.schemaType,
                                    topic_name=topic_name,
                                )
                            )
                        except Exception as exc:
                            logger.warning(f"Failed to decode sample data from topic {topic_name}: {exc}")
            if self.consumer_client:
                self.consumer_client.unsubscribe()
            yield Either(
                right=OMetaTopicSampleData(
                    topic=topic_entity,
                    sample_data=TopicSampleData(messages=sample_data),
                )
            )

    def decode_message(self, record: Any, schema: str | ProtobufSchema, schema_type: SchemaType, topic_name: str = ""):
        if not isinstance(record, (bytes, bytearray, memoryview)):
            return str(record)
        if schema_type == SchemaType.Avro:
            # One deserializer per schema: this runs once per sampled message.
            deserializer = self._avro_deserializers.get(schema)
            if deserializer is None:
                # confluent_kafka.schema_registry.avro stacks `import *` from _async, _sync
                # and common, so a type checker binds AvroDeserializer to the wrong class;
                # at runtime _sync wins and these keywords are correct.
                deserializer = AvroDeserializer(
                    schema_str=schema,  # pyright: ignore[reportCallIssue]
                    schema_registry_client=self.schema_registry_client,  # pyright: ignore[reportCallIssue]
                )
                self._avro_deserializers[schema] = deserializer
            return str(deserializer(bytes(record), None))
        if schema_type == SchemaType.Protobuf:
            if isinstance(schema, str):
                schema = ProtobufSchema(schema)
            schema = self._get_protobuf_writer_schema(bytes(record)) or schema
            # One decoder per schema: compiling it runs protoc, so a failure is kept too.
            key = (topic_name, schema)
            decoder = self._protobuf_decoders.get(key)
            if decoder is None:
                try:
                    decoder = ProtobufMessageDecoder(topic_name, schema.text, dict(schema.dependencies))
                except Exception as exc:
                    decoder = exc
                self._protobuf_decoders[key] = decoder
            if isinstance(decoder, Exception):
                raise decoder
            return decoder(bytes(record))
        # Strict: a binary payload we cannot type (Avro with no registry configured)
        # must be skipped by the caller, not stored as mojibake.
        return strip_confluent_framing(bytes(record)).decode("utf-8")

    def _get_protobuf_writer_schema(self, record: bytes) -> ProtobufSchema | None:
        """
        The schema a framed record was written with. Its message indexes are
        positions in that schema, so a later version that adds or moves a message would make
        them name the wrong one. None means the record is unframed: read it with the topic's schema.
        Raises when the writer schema cannot be fetched, so the record is skipped rather than
        read with a schema that may not match it, as the Avro deserializer does.
        """
        writer_id = read_writer_schema_id(record)
        if writer_id is None or not self.schema_registry_client:
            return None
        if writer_id not in self._protobuf_writer_schemas:
            try:
                if isinstance(writer_id, int):
                    writer_schema = self.schema_registry_client.get_schema(writer_id)
                else:
                    writer_schema = self.schema_registry_client.get_schema_by_guid(writer_id)
                self._protobuf_writer_schemas[writer_id] = self._get_protobuf_schema(writer_schema)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                # Kept, so the registry is asked once per schema rather than once per record.
                self._protobuf_writer_schemas[writer_id] = exc
        protobuf_schema = self._protobuf_writer_schemas[writer_id]
        if isinstance(protobuf_schema, Exception):
            raise protobuf_schema
        return protobuf_schema

    def close(self):
        # The consumer belongs to the connection, which closes it on teardown.
        super().close()
