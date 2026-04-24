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
from collections import defaultdict
from typing import Iterable, Optional

import confluent_kafka
from confluent_kafka import ConsumerGroupTopicPartitions, KafkaError, KafkaException
from confluent_kafka.admin import ConfigResource
from confluent_kafka.error import (
    ConsumeError,
    KeyDeserializationError,
    ValueDeserializationError,
)
from confluent_kafka.schema_registry.avro import AvroDeserializer
from confluent_kafka.schema_registry.schema_registry_client import Schema

from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.entity.data.topic import (
    ConsumerGroup,
    ConsumerGroupMember,
    ConsumerGroupPartitionOffset,
)
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

ADMIN_CLIENT_TIMEOUT_SECONDS = 10
END_OFFSET_BATCH_SIZE = 500
SAMPLE_DATA_MESSAGE_LOOKBACK = 50


def on_partitions_assignment_to_consumer(consumer, partitions) -> None:
    for partition in partitions:
        last_offset = consumer.get_watermark_offsets(partition)
        partition.offset = (
            last_offset[1] - SAMPLE_DATA_MESSAGE_LOOKBACK
            if last_offset[1] > SAMPLE_DATA_MESSAGE_LOOKBACK
            else 0
        )
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
        if (
            self.generate_sample_data
            and self._is_sample_data_storing_globally_disabled()
        ):
            self.generate_sample_data = False
        self.service_connection = self.config.serviceConnection.root.config
        self.admin_client = self.connection.admin_client
        self.schema_registry_client = self.connection.schema_registry_client
        self.context.processed_schemas = {}
        self.extract_consumer_groups = (
            self.config.sourceConfig.config.extractConsumerGroups
        )
        self._topic_consumer_groups = None
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
            if self.extract_consumer_groups:
                topic.consumerGroups = self._get_consumer_groups_for_topic(
                    topic_details.topic_name
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
                config_response = resource_value.result(
                    timeout=ADMIN_CLIENT_TIMEOUT_SECONDS
                )
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
                    # DeserializingConsumer does not implement consume(), use poll() in a loop instead.
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
                        except ConsumeError as exc:
                            logger.warning(
                                f"Consumer error polling topic {topic_name}: {exc}"
                            )
                            continue
                        except (
                            KeyDeserializationError,
                            ValueDeserializationError,
                        ) as exc:
                            logger.warning(
                                f"Failed to deserialize message from topic {topic_name}: {exc}"
                            )
                            continue
                        if msg is None:
                            break
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

    @staticmethod
    def _map_consumer_group_state(state) -> str:
        """Map confluent_kafka ConsumerGroupState to schema enum values."""
        if state is None:
            return "Unknown"
        state_name = state.name if hasattr(state, "name") else str(state)
        state_mapping = {
            "STABLE": "Stable",
            "PREPARING_REBALANCE": "PreparingRebalance",
            "COMPLETING_REBALANCE": "CompletingRebalance",
            "EMPTY": "Empty",
            "DEAD": "Dead",
        }
        return state_mapping.get(state_name.upper(), "Unknown")

    def _build_topic_consumer_groups_map(self) -> dict:
        """
        Build a mapping of topic_name -> {group_id -> group_info} with
        members, state, and committed offsets. Calls list_consumer_groups
        and describe_consumer_groups once per run, then fetches committed
        offsets per group (confluent_kafka's list_consumer_group_offsets
        accepts only one group per request).
        """
        topic_cg_map = {}
        try:
            list_future = self.admin_client.list_consumer_groups()
            list_result = list_future.result(timeout=ADMIN_CLIENT_TIMEOUT_SECONDS)
            for error in list_result.errors or []:
                logger.warning(f"Failed to list some consumer groups: {error}")
            group_ids = [g.group_id for g in list_result.valid]
            if not group_ids:
                return topic_cg_map

            describe_futures = self.admin_client.describe_consumer_groups(group_ids)
            for group_id, future in describe_futures.items():
                try:
                    group_desc = future.result(timeout=ADMIN_CLIENT_TIMEOUT_SECONDS)
                except Exception as exc:
                    logger.debug(f"Failed to describe consumer group {group_id}: {exc}")
                    continue
                self._index_group_by_topic(group_id, group_desc, topic_cg_map)

            self._fetch_consumer_group_offsets(group_ids, topic_cg_map)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to extract consumer groups: {exc}")
        return topic_cg_map

    def _index_group_by_topic(
        self, group_id: str, group_desc, topic_cg_map: dict
    ) -> None:
        """Index a described consumer group into topic_cg_map by topic."""
        state = self._map_consumer_group_state(group_desc.state)
        assignor = group_desc.partition_assignor
        for member in group_desc.members:
            if not member.assignment or not member.assignment.topic_partitions:
                continue
            partitions_by_topic = defaultdict(list)
            for tp in member.assignment.topic_partitions:
                partitions_by_topic[tp.topic].append(tp.partition)
            for topic, partitions in partitions_by_topic.items():
                cg_entry = topic_cg_map.setdefault(topic, {})
                if group_id not in cg_entry:
                    cg_entry[group_id] = {
                        "state": state,
                        "partition_assignor": assignor,
                        "members": {},
                        "offsets": {},
                    }
                cg_entry[group_id]["members"][member.member_id] = {
                    "client_id": member.client_id,
                    "host": member.host,
                    "group_instance_id": getattr(member, "group_instance_id", None),
                    "partitions": partitions,
                }

    def _fetch_consumer_group_offsets(
        self, group_ids: list, topic_cg_map: dict
    ) -> None:
        """Fetch committed offsets and compute lag for each consumer group."""
        committed = self._collect_committed_offsets(group_ids, topic_cg_map)
        end_offsets = self._batch_get_end_offsets(committed)
        for group_id, partitions in committed.items():
            for tp_key, current_offset in partitions.items():
                topic, partition = tp_key
                end_offset = end_offsets.get(tp_key, -1)
                lag = max(0, end_offset - current_offset) if end_offset >= 0 else None
                topic_cg_map[topic][group_id]["offsets"][partition] = {
                    "current_offset": current_offset,
                    "end_offset": end_offset if end_offset >= 0 else None,
                    "lag": lag,
                }

    def _collect_committed_offsets(self, group_ids: list, topic_cg_map: dict) -> dict:
        """Collect committed offsets per group.

        Returns {group_id: {(topic, partition): offset}}.
        """
        committed = {}
        for group_id in group_ids:
            try:
                offsets = self._fetch_group_committed_offsets(group_id, topic_cg_map)
            except Exception as exc:
                logger.debug(
                    f"Failed to fetch offsets for consumer group {group_id}: {exc}"
                )
                continue
            if offsets:
                committed[group_id] = offsets
        return committed

    def _fetch_group_committed_offsets(self, group_id: str, topic_cg_map: dict) -> dict:
        """Fetch committed offsets for a single group.

        confluent_kafka's list_consumer_group_offsets accepts only one
        ConsumerGroupTopicPartitions per call, and returns a dict of
        futures keyed by group_id with exactly one entry.
        """
        request = [ConsumerGroupTopicPartitions(group_id)]
        offset_futures = self.admin_client.list_consumer_group_offsets(request)
        future = next(iter(offset_futures.values()))
        result = future.result(timeout=ADMIN_CLIENT_TIMEOUT_SECONDS)
        group_offsets = {}
        for tp in result.topic_partitions:
            if tp.offset < 0:
                continue
            if tp.topic not in topic_cg_map:
                continue
            if group_id not in topic_cg_map[tp.topic]:
                continue
            group_offsets[(tp.topic, tp.partition)] = tp.offset
        return group_offsets

    def _batch_get_end_offsets(
        self, committed: dict, batch_size: int = END_OFFSET_BATCH_SIZE
    ) -> dict:
        """Fetch end offsets for all unique topic-partitions in batched RPCs."""
        from confluent_kafka.admin import OffsetSpec

        unique_tps = set()
        for partitions in committed.values():
            unique_tps.update(partitions.keys())

        if not unique_tps:
            return {}

        end_offsets = {}
        tp_list = list(unique_tps)
        for i in range(0, len(tp_list), batch_size):
            chunk = tp_list[i : i + batch_size]
            tp_spec = {
                confluent_kafka.TopicPartition(topic, partition): OffsetSpec.latest()
                for topic, partition in chunk
            }
            try:
                result = self.admin_client.list_offsets(tp_spec)
                for tp, future in result.items():
                    try:
                        offset_info = future.result(
                            timeout=ADMIN_CLIENT_TIMEOUT_SECONDS
                        )
                        end_offsets[(tp.topic, tp.partition)] = offset_info.offset
                    except Exception:
                        end_offsets[(tp.topic, tp.partition)] = -1
            except Exception as exc:
                logger.debug(f"Failed to batch-fetch end offsets: {exc}")
                for topic, partition in chunk:
                    end_offsets.setdefault((topic, partition), -1)
        return end_offsets

    def _get_consumer_groups_for_topic(self, topic_name: str) -> Optional[list]:
        """
        Get consumer group details for a specific topic.
        Lazily builds the mapping on first call.
        """
        if self._topic_consumer_groups is None:
            self._topic_consumer_groups = self._build_topic_consumer_groups_map()

        cg_entries = self._topic_consumer_groups.get(topic_name, {})
        consumer_groups = []
        for group_id, info in cg_entries.items():
            members = []
            for member_id, member_info in info.get("members", {}).items():
                members.append(
                    ConsumerGroupMember(
                        memberId=member_id,
                        clientId=member_info.get("client_id"),
                        host=member_info.get("host"),
                        groupInstanceId=member_info.get("group_instance_id"),
                        assignedPartitions=member_info.get("partitions", []),
                    )
                )
            partition_offsets = []
            total_lag = 0
            for partition, offset_info in sorted(info.get("offsets", {}).items()):
                lag = offset_info.get("lag")
                partition_offsets.append(
                    ConsumerGroupPartitionOffset(
                        partition=partition,
                        currentOffset=offset_info.get("current_offset"),
                        endOffset=offset_info.get("end_offset"),
                        lag=lag,
                    )
                )
                if lag is not None:
                    total_lag += lag
            consumer_groups.append(
                ConsumerGroup(
                    groupId=group_id,
                    state=info.get("state", "Unknown"),
                    partitionAssignor=info.get("partition_assignor"),
                    memberCount=len(members),
                    members=members,
                    partitionOffsets=partition_offsets if partition_offsets else None,
                    totalLag=total_lag if partition_offsets else None,
                )
            )
        return consumer_groups if consumer_groups else None

    def close(self):
        if self.generate_sample_data and self.consumer_client:
            self.consumer_client.close()
        ssl_manager = getattr(self, "ssl_manager", None)
        if ssl_manager:
            ssl_manager.cleanup_temp_files()
