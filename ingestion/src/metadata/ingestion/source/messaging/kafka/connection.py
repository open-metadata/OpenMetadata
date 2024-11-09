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
from copy import deepcopy
from dataclasses import dataclass
from typing import Optional, Union

from confluent_kafka.admin import AdminClient, KafkaException
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
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class InvalidKafkaCreds(Exception):
    """
    Class to indicate invalid kafka credentials exception
    """


class SchemaRegistryException(Exception):
    """
    Class to indicate invalid schema registry not initialized
    """


TIMEOUT_SECONDS = 10


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
    consumer_config = deepcopy(connection.consumerConfig) or {}
    schema_registry_config = deepcopy(connection.schemaRegistryConfig) or {}
    if connection.saslUsername or connection.saslPassword or connection.saslMechanism:
        if connection.saslUsername:
            consumer_config["sasl.username"] = connection.saslUsername
        if connection.saslPassword:
            consumer_config[
                "sasl.password"
            ] = connection.saslPassword.get_secret_value()
        if connection.saslMechanism:
            consumer_config["sasl.mechanism"] = connection.saslMechanism.value

        if (
            connection.consumerConfig.get("security.protocol") is None
            and connection.securityProtocol
        ):
            consumer_config["security.protocol"] = connection.securityProtocol.value

    if connection.basicAuthUserInfo:
        schema_registry_config[
            "basic.auth.user.info"
        ] = connection.basicAuthUserInfo.get_secret_value()

    admin_client_config = consumer_config
    admin_client_config["bootstrap.servers"] = connection.bootstrapServers
    admin_client = AdminClient(admin_client_config)

    schema_registry_client = None
    consumer_client = None
    if connection.schemaRegistryURL:
        schema_registry_config["url"] = str(connection.schemaRegistryURL)
        schema_registry_client = SchemaRegistryClient(schema_registry_config)
        consumer_config["bootstrap.servers"] = connection.bootstrapServers
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
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    def custom_executor():
        try:
            client.admin_client.list_topics(timeout=TIMEOUT_SECONDS).topics
        except KafkaException as err:
            raise InvalidKafkaCreds(
                f"Failed to fetch topics due to: {err}. "
                "Please validate credentials and check if you are using correct security protocol"
            )

    def schema_registry_test():
        if client.schema_registry_client:
            client.schema_registry_client.get_subjects()
        else:
            raise SchemaRegistryException(
                "Schema Registry not initialized, please provide schema registry "
                "credentials in case you want topic schema and sample data to be ingested"
            )

    test_fn = {
        "GetTopics": custom_executor,
        "CheckSchemaRegistry": schema_registry_test,
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
