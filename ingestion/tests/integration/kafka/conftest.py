import os.path
import uuid
from textwrap import dedent

import pytest
import testcontainers.core.network
from docker.types import EndpointConfig
from testcontainers.core.container import DockerContainer
from testcontainers.kafka import KafkaContainer

from _openmetadata_testutils.kafka import load_csv_data
from _openmetadata_testutils.kafka.schema_registry_container import (
    SchemaRegistryContainer,
)
from metadata.generated.schema.api.services.createMessagingService import (
    CreateMessagingServiceRequest,
)
from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
    KafkaConnection,
)
from metadata.generated.schema.entity.services.messagingService import (
    MessagingConnection,
    MessagingServiceType,
)
from metadata.generated.schema.metadataIngestion.messagingServiceMetadataPipeline import (
    MessagingMetadataConfigType,
)


def _connect_to_network(
    ctr: DockerContainer, network: testcontainers.core.network, alias: str
):
    # Needed until https://github.com/testcontainers/testcontainers-python/issues/645 is fixed
    ctr.with_kwargs(
        network=network.name,
        networking_config={network.name: EndpointConfig("1.33", aliases=[alias])},
    )


class CustomKafkaContainer(KafkaContainer):
    def __init__(self):
        super().__init__()
        self.security_protocol_map += ",EXTERNAL:PLAINTEXT"
        self.with_env(
            "KAFKA_LISTENER_SECURITY_PROTOCOL_MAP", self.security_protocol_map
        )

        self.listeners = f"PLAINTEXT://0.0.0.0:29092,BROKER://0.0.0.0:9092,EXTERNAL://0.0.0.0:{self.port}"
        self.with_env("KAFKA_LISTENERS", self.listeners)

    def tc_start(self):
        listeners = ",".join(
            [
                f"EXTERNAL://{self.get_bootstrap_server()}",
                f"PLAINTEXT://{self._get_network_alias()}:29092",
                "BROKER://$(hostname -i | cut -d' ' -f1):9092",
            ]
        )
        data = (
            dedent(
                f"""
                #!/bin/bash
                {self.boot_command}
                export KAFKA_ADVERTISED_LISTENERS={listeners}
                . /etc/confluent/docker/bash-config
                /etc/confluent/docker/configure
                /etc/confluent/docker/launch
                """
            )
            .strip()
            .encode("utf-8")
        )
        self.create_file(data, KafkaContainer.TC_START_SCRIPT)


@pytest.fixture(scope="module")
def docker_network():
    with testcontainers.core.network.Network() as network:
        yield network


@pytest.fixture(scope="module")
def schema_registry_container(docker_network, kafka_container):
    with SchemaRegistryContainer(
        schema_registry_kafkastore_bootstrap_servers="PLAINTEXT://kafka:9092",
        schema_registry_host_name="schema-registry",
    ).with_network(docker_network).with_network_aliases("schema-registry") as container:
        load_csv_data.main(
            kafka_broker=kafka_container.get_bootstrap_server(),
            schema_registry_url=container.get_connection_url(),
            csv_directory=os.path.dirname(__file__) + "/data",
        )
        yield container


@pytest.fixture(scope="module")
def kafka_container(docker_network):
    container = CustomKafkaContainer()
    _connect_to_network(container, docker_network, "kafka")
    with container:
        yield container


@pytest.fixture(scope="module")
def create_service_request(kafka_container, schema_registry_container):
    return CreateMessagingServiceRequest(
        name=f"docker_test_kafka_{uuid.uuid4().hex[:8]}",
        serviceType=MessagingServiceType.Kafka,
        connection=MessagingConnection(
            config=KafkaConnection(
                bootstrapServers=kafka_container.get_bootstrap_server(),
                schemaRegistryURL=schema_registry_container.get_connection_url(),
            )
        ),
    )


@pytest.fixture(scope="module")
def ingestion_config(db_service, metadata, workflow_config, sink_config):
    return {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {"type": MessagingMetadataConfigType.MessagingMetadata.value}
            },
            "serviceConnection": db_service.connection.model_dump(),
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


@pytest.fixture(scope="module")
def unmask_password():
    def patch_password(service):
        return service

    return patch_password
