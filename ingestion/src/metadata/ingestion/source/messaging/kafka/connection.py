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
Source connection handler
"""

from copy import deepcopy

from confluent_kafka import Consumer
from confluent_kafka.admin import AdminClient, KafkaException
from confluent_kafka.schema_registry.schema_registry_client import SchemaRegistryClient

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
    KafkaConnection as KafkaConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.messaging.redpandaConnection import (
    RedpandaConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class InvalidKafkaCreds(Exception):  # noqa: N818
    """
    Class to indicate invalid kafka credentials exception
    """


class SchemaRegistryException(Exception):  # noqa: N818
    """
    Class to indicate invalid schema registry not initialized
    """


TIMEOUT_SECONDS = 10


# librdkafka rejects nothing, so consumer-only keys would silently ride along.
CONSUMER_ONLY_CONFIG_KEYS = ("group.id", "enable.auto.commit", "auto.offset.reset")


class KafkaClient:
    def __init__(self, admin_client, schema_registry_client, consumer_factory) -> None:
        self.admin_client = admin_client
        self.schema_registry_client = schema_registry_client  # Optional
        self._consumer_factory = consumer_factory
        self._consumer_client = None

    @property
    def consumer_client(self):
        """Built on first use. Only sample-data runs need a consumer, and creating
        one dials the broker — needless work on every other ingestion."""
        if self._consumer_client is None:
            self._consumer_client = self._consumer_factory()
        return self._consumer_client

    def close_consumer(self) -> None:
        if self._consumer_client is not None:
            self._consumer_client.close()
            self._consumer_client = None


def get_connection(connection: KafkaConnectionConfig | RedpandaConnection) -> KafkaClient:
    """
    Create connection
    """
    consumer_config = deepcopy(connection.consumerConfig) or {}
    schema_registry_config = deepcopy(connection.schemaRegistryConfig) or {}

    if connection.saslUsername or connection.saslPassword or connection.saslMechanism:
        if connection.saslUsername:
            consumer_config["sasl.username"] = connection.saslUsername
        if connection.saslPassword:
            consumer_config["sasl.password"] = connection.saslPassword.get_secret_value()
        if connection.saslMechanism:
            consumer_config["sasl.mechanism"] = connection.saslMechanism.value

        if connection.consumerConfig.get("security.protocol") is None and connection.securityProtocol:
            consumer_config["security.protocol"] = connection.securityProtocol.value

    if connection.basicAuthUserInfo:
        schema_registry_config["basic.auth.user.info"] = connection.basicAuthUserInfo.get_secret_value()

    admin_client_config = {k: v for k, v in consumer_config.items() if k not in CONSUMER_ONLY_CONFIG_KEYS}
    admin_client_config["bootstrap.servers"] = connection.bootstrapServers
    admin_client = AdminClient(admin_client_config)

    schema_registry_client = None
    if connection.schemaRegistryURL:
        schema_registry_config["url"] = str(connection.schemaRegistryURL)
        schema_registry_client = SchemaRegistryClient(schema_registry_config)

    # Messages are handed back as raw bytes and decoded per topic, so sample data
    # works for every schema type and does not require a Schema Registry.
    consumer_config["bootstrap.servers"] = connection.bootstrapServers
    consumer_config.setdefault("group.id", "openmetadata-consumer")
    consumer_config.setdefault("auto.offset.reset", "largest")
    consumer_config["enable.auto.commit"] = False

    return KafkaClient(
        admin_client=admin_client,
        schema_registry_client=schema_registry_client,
        consumer_factory=lambda: Consumer(consumer_config),
    )


def test_connection(
    metadata: OpenMetadata,
    client: KafkaClient,
    service_connection: KafkaConnectionConfig | RedpandaConnection,
    automation_workflow: AutomationWorkflow | None = None,
    timeout_seconds: int | None = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    def custom_executor():
        try:
            client.admin_client.list_topics(timeout=TIMEOUT_SECONDS).topics  # noqa: B018
        except KafkaException as err:
            raise InvalidKafkaCreds(  # noqa: B904
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


class KafkaConnection(BaseConnection[KafkaConnectionConfig, KafkaClient]):
    def _get_client(self) -> KafkaClient:
        client = get_connection(self.service_connection)
        self._on_close(client.close_consumer)
        return client

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: AutomationWorkflow | None = None,
        timeout_seconds: int | None = THREE_MIN,
    ) -> TestConnectionResult:
        return test_connection(
            metadata,
            self.client,
            self.service_connection,
            automation_workflow,
            timeout_seconds,
        )
