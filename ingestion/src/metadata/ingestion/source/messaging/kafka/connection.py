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
from typing import Optional, Union

from confluent_kafka.admin import AdminClient
from confluent_kafka.avro import AvroConsumer
from confluent_kafka.schema_registry.schema_registry_client import SchemaRegistryClient

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
    KafkaConnection,
)
from metadata.generated.schema.entity.services.connections.messaging.redpandaConnection import (
    RedpandaConnection,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
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
    if connection.saslUsername or connection.saslPassword or connection.saslMechanism:
        connection.consumerConfig = connection.consumerConfig or {}
        if connection.saslUsername:
            connection.consumerConfig["sasl.username"] = connection.saslUsername
        if connection.saslPassword:
            connection.consumerConfig[
                "sasl.password"
            ] = connection.saslPassword.get_secret_value()
        if connection.saslMechanism:
            connection.consumerConfig["sasl.mechanism"] = connection.saslMechanism

    if connection.basicAuthUserInfo:
        connection.schemaRegistryConfig = connection.schemaRegistryConfig or {}
        connection.schemaRegistryConfig[
            "basic.auth.user.info"
        ] = connection.basicAuthUserInfo

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
            consumer_config["auto.offset.reset"] = "largest"
        consumer_config["enable.auto.commit"] = False
        logger.debug(f"Using Kafka consumer config: {consumer_config}")
        consumer_client = AvroConsumer(
            consumer_config, schema_registry=schema_registry_client
        )

    return KafkaClient(
        admin_client=admin_client,
        schema_registry_client=schema_registry_client,
        consumer_client=consumer_client,
    )


def test_connection(
    metadata: OpenMetadata,
    client: KafkaClient,
    service_connection: Union[KafkaConnection, RedpandaConnection],
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    def custom_executor():
        _ = client.admin_client.list_topics().topics

    test_fn = {"GetTopics": custom_executor}

    test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_fqn=service_connection.type.value,
        automation_workflow=automation_workflow,
    )
