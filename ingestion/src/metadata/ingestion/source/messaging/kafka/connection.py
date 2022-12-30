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
Source connection handler
"""
from dataclasses import dataclass
from typing import Union

from confluent_kafka.admin import AdminClient
from confluent_kafka.avro import AvroConsumer
from confluent_kafka.schema_registry.schema_registry_client import SchemaRegistryClient

from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
    KafkaConnection,
)
from metadata.generated.schema.entity.services.connections.messaging.redpandaConnection import (
    RedpandaConnection,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


@dataclass
class KafkaClient:
    def __init__(self, admin_client, schema_registry_client, consumer_client) -> None:
        self.admin_client = admin_client
        self.schema_registry_client = schema_registry_client  # Optional
        self.consumer_client = consumer_client


def get_connection(
    connection: Union[KafkaConnection, RedpandaConnection]
) -> KafkaClient:
    """
    Create connection
    """
    admin_client_config = connection.consumerConfig
    admin_client_config["bootstrap.servers"] = connection.bootstrapServers
    admin_client = AdminClient(admin_client_config)

    schema_registry_client = None
    consumer_client = None
    if connection.schemaRegistryURL:
        connection.schemaRegistryConfig["url"] = connection.schemaRegistryURL
        schema_registry_client = SchemaRegistryClient(connection.schemaRegistryConfig)
        connection.schemaRegistryConfig["url"] = str(connection.schemaRegistryURL)
        consumer_config = {
            **connection.consumerConfig,
            "bootstrap.servers": connection.bootstrapServers,
        }
        if "group.id" not in consumer_config:
            consumer_config["group.id"] = "openmetadata-consumer"
        if "auto.offset.reset" not in consumer_config:
            consumer_config["auto.offset.reset"] = "earliest"
        logger.debug(f"Using Kafka consumer config: {consumer_config}")
        consumer_client = AvroConsumer(
            consumer_config, schema_registry=schema_registry_client
        )

    return KafkaClient(
        admin_client=admin_client,
        schema_registry_client=schema_registry_client,
        consumer_client=consumer_client,
    )


def test_connection(client: KafkaClient) -> None:
    """
    Test connection
    """
    try:
        _ = client.admin_client.list_topics().topics
        if client.schema_registry_client:
            _ = client.schema_registry_client.get_subjects()
    except Exception as exc:
        msg = f"Unknown error connecting with {client}: {exc}."
        raise SourceConnectionException(msg) from exc
