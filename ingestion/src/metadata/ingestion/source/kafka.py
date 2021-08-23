import concurrent
import uuid
from dataclasses import field, dataclass, Field
from typing import List, Iterable, Optional

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createTopic import CreateTopic
from metadata.generated.schema.entity.data.topic import Topic, SchemaType
from metadata.generated.schema.entity.services.messagingService import MessagingServiceType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import IncludeFilterPattern, Record, logger, WorkflowContext
from metadata.ingestion.api.source import SourceStatus, Source
from fastavro import json_reader
from fastavro import parse_schema

import confluent_kafka
from confluent_kafka.admin import AdminClient, ConfigResource
from confluent_kafka.schema_registry.schema_registry_client import (
    Schema,
    SchemaRegistryClient,
)
import concurrent.futures
from metadata.ingestion.ometa.auth_provider import MetadataServerConfig
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
    service_type: str
    filter_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()


@dataclass
class KafkaSource(Source):
    config: KafkaSourceConfig
    admin_client: AdminClient
    report: KafkaSourceStatus

    def __init__(self, config: KafkaSourceConfig, metadata_config: MetadataServerConfig, ctx: WorkflowContext):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = KafkaSourceStatus()
        self.service = get_messaging_service_or_create(config.service_name,
                                                       MessagingServiceType.Kafka.name,
                                                       config.schema_registry_url,
                                                       config.bootstrap_servers.split(","),
                                                       metadata_config)
        self.schema_registry_client = SchemaRegistryClient(
            {"url": self.config.schema_registry_url}
        )
        self.admin_client = AdminClient(
            {
                "bootstrap.servers": self.config.bootstrap_servers,
                "session.timeout.ms": 6000
            }
        )

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = KafkaSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[Topic]:
        topics = self.admin_client.list_topics().topics
        for t in topics:
            if self.config.filter_pattern.included(t):
                logger.info("Fetching topic schema {}".format(t))
                topic_schema = self._parse_topic_metadata(t)
                topic = CreateTopic(name=t,
                                    service=EntityReference(id=self.service.id, type="messagingService"),
                                    partitions=1)
                if topic_schema is not None:
                    topic.schema_ = topic_schema.schema_str
                    if topic_schema.schema_type == "AVRO":
                        topic.schemaType = SchemaType.Avro.name
                    elif topic_schema.schema_type == "PROTOBUF":
                        topic.schemaType = SchemaType.Protobuf.name
                    elif topic_schema.schema_type == "JSON":
                        topic.schemaType = SchemaType.JSON.name
                    else:
                        topic.schemaType = SchemaType.Other.name

                self.status.topic_scanned(topic.name.__root__)
                yield topic
            else:
                self.status.dropped(t)

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
