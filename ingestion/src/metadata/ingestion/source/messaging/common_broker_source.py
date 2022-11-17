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
Common Broker for fetching metadata
"""

import concurrent.futures
import traceback
from abc import ABC
from typing import Iterable, Optional

import confluent_kafka
from confluent_kafka import KafkaError, KafkaException
from confluent_kafka.admin import ConfigResource
from confluent_kafka.schema_registry.schema_registry_client import Schema

from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.entity.data.topic import SchemaType, TopicSampleData
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.messaging.messaging_service import (
    BrokerTopicDetails,
    MessagingServiceSource,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class CommonBrokerSource(MessagingServiceSource, ABC):
    """
    Common Broker Source Class
    to fetch topics from Broker based sources
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__(config, metadata_config)
        self.generate_sample_data = self.config.sourceConfig.config.generateSampleData
        self.admin_client = self.connection.admin_client
        self.schema_registry_client = self.connection.schema_registry_client
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
    ) -> Iterable[CreateTopicRequest]:
        try:
            logger.info(f"Fetching topic schema {topic_details.topic_name}")
            topic_schema = self._parse_topic_metadata(topic_details.topic_name)
            logger.info(f"Fetching topic config {topic_details.topic_name}")
            topic = CreateTopicRequest(
                name=topic_details.topic_name,
                service=EntityReference(
                    id=self.context.messaging_service.id.__root__,
                    type="messagingService",
                ),
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
                topic.schemaText = topic_schema.schema_str
                if topic_schema.schema_type.lower() == SchemaType.Avro.value.lower():
                    topic.schemaType = SchemaType.Avro.name
                    if self.generate_sample_data:
                        topic.sampleData = self._get_sample_data(topic.name)
                elif (
                    topic_schema.schema_type.lower() == SchemaType.Protobuf.name.lower()
                ):
                    topic.schemaType = SchemaType.Protobuf.name
                elif topic_schema.schema_type.lower() == SchemaType.JSON.name.lower():
                    topic.schemaType = SchemaType.JSON.name
                else:
                    topic.schemaType = SchemaType.Other.name

            self.status.topic_scanned(topic.name.__root__)
            yield topic

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unexpected exception to yield topic [{topic_details.topic_name}]: {exc}"
            )
            self.status.failures.append(
                f"{self.config.serviceName}.{topic_details.topic_name}"
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

    def _parse_topic_metadata(self, topic_name: str) -> Optional[Schema]:
        try:
            if self.schema_registry_client:
                registered_schema = self.schema_registry_client.get_latest_version(
                    topic_name + "-value"
                )
                return registered_schema.schema
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to get schema for topic [{topic_name}]: {exc}")
            self.status.warning(
                topic_name, f"failed to get schema: {exc} for topic {topic_name}"
            )
        return None

    def _get_sample_data(self, topic_name):
        sample_data = []
        try:
            self.consumer_client.subscribe([topic_name.__root__])
            logger.info(
                f"Broker consumer polling for sample messages in topic {topic_name.__root__}"
            )
            messages = self.consumer_client.consume(num_messages=10, timeout=10)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to fetch sample data from topic {topic_name.__root__}: {exc}"
            )
        else:
            if messages:
                for message in messages:
                    sample_data.append(
                        str(
                            self.consumer_client._serializer.decode_message(  # pylint: disable=protected-access
                                message.value()
                            )
                        )
                    )
        self.consumer_client.unsubscribe()
        return TopicSampleData(messages=sample_data)

    def close(self):
        if self.generate_sample_data and self.consumer_client:
            self.consumer_client.close()
