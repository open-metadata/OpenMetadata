from dataclasses import field, dataclass, Field
from typing import List, Iterable, Optional

from metadata.config.common import ConfigModel
from metadata.ingestion.api.common import IncludeFilterPattern, Record, logger, WorkflowContext
from metadata.ingestion.api.source import SourceStatus, Source
from fastavro import json_reader
from fastavro import parse_schema

import confluent_kafka
from confluent_kafka.schema_registry.schema_registry_client import (
    Schema,
    SchemaRegistryClient,
)


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
    consumer: confluent_kafka.Consumer
    report: KafkaSourceStatus

    def __init__(self, config: KafkaSourceConfig, ctx: WorkflowContext):
        super().__init__(ctx)
        self.config = config
        self.status = KafkaSourceStatus()
        self.schema_registry_client = SchemaRegistryClient(
            {"url": self.config.schema_registry_url}
        )
        self.consumer = confluent_kafka.Consumer(
            {
                "group.id": "test",
                "bootstrap.servers": self.config.bootstrap_servers,
                **self.config.consumer_config,
            }
        )

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = KafkaSourceConfig.parse_obj(config_dict)
        return cls(config, ctx)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[Record]:
        topics = self.consumer.list_topics().topics
        for t in topics:
            if self.config.filter_pattern.included(t):
                topic_schema = self._parse_topic_metadata(t)
                self.status.topic_scanned(t)
                yield topic_schema
            else:
                self.status.dropped(t)

    def _parse_topic_metadata(self, topic: str) -> Record:
        logger.debug(f"topic = {topic}")
        dataset_name = topic

        schema: Optional[Schema] = None
        try:
            registered_schema = self.schema_registry_client.get_latest_version(
                topic + "-value"
            )
            schema = registered_schema.schema
        except Exception as e:
            self.status.warning(topic, f"failed to get schema: {e} for topic {topic}")

        # Parse the schema
        fields: List[str] = []
        if schema and schema.schema_type == "AVRO":
            # "value.id" or "value.[type=string]id"
            parsed_schema = parse_schema(schema.schema_str)
        elif schema is not None:
            self.status.warning(
                topic,
                f"{schema.schema_type} is not supported"
            )
            # Fetch key schema from the registry
        key_schema: Optional[Schema] = None
        try:
            registered_schema = self.schema_registry_client.get_latest_version(
                topic + "-key"
            )
            key_schema = registered_schema.schema
        except Exception as e:
            # do not report warnings because it is okay to not have key schemas
            logger.debug(f"{topic}: no key schema found. {e}")
            pass

            # Parse the key schema
        key_fields: List[str] = []
        if key_schema and schema.schema_type == "AVRO":
            print(key_schema.schema_str)
        elif key_schema is not None:
            self.status.warning(
                topic,
                f"Parsing kafka schema type {key_schema.schema_type} is currently not implemented",
            )

        key_schema_str: Optional[str] = None
        return None

    def get_status(self):
        return self.status

    def close(self):
        if self.consumer:
            self.consumer.close()
