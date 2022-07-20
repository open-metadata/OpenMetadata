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

import concurrent.futures
import sys
import traceback
from dataclasses import dataclass
from typing import Any, List, Optional

import confluent_kafka
from confluent_kafka.admin import AdminClient, ConfigResource
from confluent_kafka.schema_registry.schema_registry_client import Schema

from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.entity.data.topic import SchemaType, TopicSampleData

# This import verifies that the dependencies are available.
from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
    KafkaConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import logger
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.messaging.messaging_service import MessagingServiceSource
from metadata.utils.connection_clients import KafkaClient
from metadata.utils.connections import get_connection, test_connection
from metadata.utils.filters import filter_by_topic


@dataclass
class KafkaTopicDetails:
    """
    Wrapper Class to combine the topic_name with topic_metadata
    """

    topic_name: str
    topic_metadata: Any

    def __init__(self, topic_name: str, topic_metadata: Any) -> None:
        self.topic_name = topic_name
        self.topic_metadata = topic_metadata


class KafkaSource(MessagingServiceSource):
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

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: KafkaConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, KafkaConnection):
            raise InvalidSourceException(
                f"Expected KafkaConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_topic_list(self) -> Optional[List[Any]]:
        topics_dict = self.admin_client.list_topics().topics
        for topic_name, topic_metadata in topics_dict.items():
            yield KafkaTopicDetails(topic_name, topic_metadata)

    def get_topic_name(self, topic_details: KafkaTopicDetails) -> str:
        """
        Get Topic Name
        """
        return topic_details.topic_name

    def yield_topic(self, topic_details: KafkaTopicDetails) -> Any:
        logger.info("Fetching topic schema {}".format(topic_details.topic_name))
        topic_schema = self._parse_topic_metadata(topic_details.topic_name)
        logger.info("Fetching topic config {}".format(topic_details.topic_name))
        topic = CreateTopicRequest(
            name=topic_details.topic_name,
            service=EntityReference(
                id=self.context.messaging_service.id.__root__, type="messagingService"
            ),
            partitions=len(topic_details.topic_metadata.partitions),
            replicationFactor=len(
                topic_details.topic_metadata.partitions.get(0).replicas
            ),
        )
        topic_configResource = self.admin_client.describe_configs(
            [
                ConfigResource(
                    confluent_kafka.admin.RESOURCE_TOPIC, topic_details.topic_name
                )
            ]
        )
        for j in concurrent.futures.as_completed(iter(topic_configResource.values())):
            config_response = j.result(timeout=10)
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

        if topic_schema is not None:
            topic.schemaText = topic_schema.schema_str
            if topic_schema.schema_type == "AVRO":
                topic.schemaType = SchemaType.Avro.name
                if self.generate_sample_data:
                    topic.sampleData = self._get_sample_data(topic.name)
            elif topic_schema.schema_type == "PROTOBUF":
                topic.schemaType = SchemaType.Protobuf.name
            elif topic_schema.schema_type == "JSON":
                topic.schemaType = SchemaType.JSON.name
            else:
                topic.schemaType = SchemaType.Other.name

        self.status.topic_scanned(topic.name.__root__)
        yield topic

    def _parse_topic_metadata(self, topic: str) -> Optional[Schema]:
        schema: Optional[Schema] = None
        try:
            registered_schema = self.schema_registry_client.get_latest_version(
                topic + "-value"
            )
            schema = registered_schema.schema
        except Exception as e:
            self.status.warning(topic, f"failed to get schema: {e} for topic {topic}")

        return schema

    def _get_sample_data(self, topic_name):
        sample_data = []
        try:
            self.consumer_client.subscribe([topic_name.__root__])
            logger.info(
                f"Kafka consumer polling for sample messages in topic {topic_name.__root__}"
            )
            messages = self.consumer_client.consume(num_messages=10, timeout=10)
        except Exception as e:
            logger.error(
                f"Failed to fetch sample data from topic {topic_name.__root__}"
            )
            logger.error(traceback.format_exc())
            logger.error(sys.exc_info()[2])
        else:
            if messages:
                for message in messages:
                    sample_data.append(
                        str(
                            self.consumer_client._serializer.decode_message(
                                message.value()
                            )
                        )
                    )
        self.consumer_client.unsubscribe()
        return TopicSampleData(messages=sample_data)

    def close(self):
        if self.generate_sample_data and self.consumer_client:
            self.consumer_client.close()
