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

# This import verifies that the dependencies are available.

import concurrent.futures
from dataclasses import dataclass, field
from typing import Iterable, List, Optional

import confluent_kafka
from confluent_kafka.admin import AdminClient, ConfigResource
from confluent_kafka.schema_registry.schema_registry_client import (
    Schema,
    SchemaRegistryClient,
)

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.entity.data.topic import SchemaType
from metadata.generated.schema.entity.services.messagingService import (
    MessagingServiceType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import IncludeFilterPattern, logger
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.utils.helpers import get_messaging_service_or_create


@dataclass
class KafkaSourceStatus(SourceStatus):
    topics_scanned: List[str] = field(default_factory=list)
    filtered: List[str] = field(default_factory=list)

    def topic_scanned(self, topic: str) -> None:
        self.topics_scanned.append(topic)

    def dropped(self, topic: str) -> None:
        self.filtered.append(topic)


class KafkaSourceConfig(ConfigModel):
    bootstrap_servers: str = "localhost:9092"
    schema_registry_url: str = "http://localhost:8081"
    consumer_config: dict = {}
    service_name: str
    service_type: str = MessagingServiceType.Kafka.value
    filter_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()


@dataclass
class KafkaSource(Source[CreateTopicRequest]):
    config: KafkaSourceConfig
    admin_client: AdminClient
    report: KafkaSourceStatus

    def __init__(
        self,
        config: KafkaSourceConfig,
        metadata_config: MetadataServerConfig,
    ):
        super().__init__()
        self.config = config
        self.metadata_config = metadata_config
        self.status = KafkaSourceStatus()
        self.service = get_messaging_service_or_create(
            service_name=config.service_name,
            message_service_type=MessagingServiceType.Kafka.name,
            schema_registry_url=config.schema_registry_url,
            brokers=config.bootstrap_servers.split(","),
            metadata_config=metadata_config,
        )
        self.schema_registry_client = SchemaRegistryClient(
            {"url": self.config.schema_registry_url}
        )
        self.admin_client = AdminClient(
            {
                "bootstrap.servers": self.config.bootstrap_servers,
                "session.timeout.ms": 6000,
            }
        )

    @classmethod
    def create(cls, config_dict, metadata_config_dict):
        config = KafkaSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[CreateTopicRequest]:
        topics_dict = self.admin_client.list_topics().topics
        for topic_name, topic_metadata in topics_dict.items():
            try:
                if self.config.filter_pattern.included(topic_name):
                    logger.info("Fetching topic schema {}".format(topic_name))
                    topic_schema = self._parse_topic_metadata(topic_name)
                    logger.info("Fetching topic config {}".format(topic_name))
                    topic_request = CreateTopicRequest(
                        name=topic_name,
                        service=EntityReference(
                            id=self.service.id, type="messagingService"
                        ),
                        partitions=len(topic_metadata.partitions),
                        replicationFactor=len(
                            topic_metadata.partitions.get(0).replicas
                        ),
                    )
                    topic_configResource = self.admin_client.describe_configs(
                        [
                            ConfigResource(
                                confluent_kafka.admin.RESOURCE_TOPIC, topic_name
                            )
                        ]
                    )
                    for j in concurrent.futures.as_completed(
                        iter(topic_configResource.values())
                    ):
                        config_response = j.result(timeout=10)
                        topic_request.maximumMessageSize = config_response.get(
                            "max.message.bytes"
                        ).value
                        topic_request.minimumInSyncReplicas = config_response.get(
                            "min.insync.replicas"
                        ).value
                        topic_request.retentionTime = config_response.get(
                            "retention.ms"
                        ).value
                        topic_request.cleanupPolicies = [
                            config_response.get("cleanup.policy").value
                        ]
                        topic_config = {}
                        for key, conf_response in config_response.items():
                            topic_config[key] = conf_response.value
                        topic_request.topicConfig = topic_config

                    if topic_schema is not None:
                        topic_request.schemaText = topic_schema.schema_str
                        if topic_schema.schema_type == "AVRO":
                            topic_request.schemaType = SchemaType.Avro.name
                        elif topic_schema.schema_type == "PROTOBUF":
                            topic_request.schemaType = SchemaType.Protobuf.name
                        elif topic_schema.schema_type == "JSON":
                            topic_request.schemaType = SchemaType.JSON.name
                        else:
                            topic_request.schemaType = SchemaType.Other.name

                    self.status.topic_scanned(topic_request.name.__root__)
                    yield topic_request
                else:
                    self.status.dropped(topic_name)
            except Exception as err:
                logger.error(repr(err))
                self.status.failure(topic_name)

    def _parse_topic_metadata(self, topic: str) -> Optional[Schema]:
        logger.debug(f"topic = {topic}")
        schema: Optional[Schema] = None
        try:
            registered_schema = self.schema_registry_client.get_latest_version(
                topic + "-value"
            )
            schema = registered_schema.schema
        except Exception as e:
            self.status.warning(topic, f"failed to get schema: {e} for topic {topic}")

        return schema

    def get_status(self):
        return self.status

    def close(self):
        pass
