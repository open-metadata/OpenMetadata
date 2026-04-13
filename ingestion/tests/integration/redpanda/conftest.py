import os.path
import uuid

import pytest
import testcontainers.core.network
from docker.types import EndpointConfig
from testcontainers.core.container import DockerContainer
from testcontainers.core.waiting_utils import wait_for_logs

from _openmetadata_testutils.kafka import load_csv_data
from metadata.generated.schema.api.services.createMessagingService import (
    CreateMessagingServiceRequest,
)
from metadata.generated.schema.entity.services.connections.messaging.redpandaConnection import (
    RedpandaConnection,
)
from metadata.generated.schema.entity.services.messagingService import (
    MessagingConnection,
    MessagingService,
    MessagingServiceType,
)
from metadata.generated.schema.metadataIngestion.messagingServiceMetadataPipeline import (
    MessagingMetadataConfigType,
)


def _connect_to_network(
    ctr: DockerContainer, network: testcontainers.core.network, alias: str
):
    ctr.with_kwargs(
        network=network.name,
        networking_config={network.name: EndpointConfig("1.33", aliases=[alias])},
    )


class RedpandaContainer(DockerContainer):
    """Redpanda broker container using the official Redpanda image.

    Redpanda is Kafka API-compatible — uses the same confluent_kafka client.
    It also bundles a built-in Schema Registry and Admin API.
    """

    REDPANDA_PORT = 9092
    EXTERNAL_PORT = 19092
    ADMIN_API_PORT = 9644
    SCHEMA_REGISTRY_PORT = 8081

    def __init__(
        self,
        image: str = "docker.redpanda.com/redpandadata/redpanda:v24.1.1",
        **kwargs,
    ):
        super().__init__(image, **kwargs)
        self.with_exposed_ports(
            self.EXTERNAL_PORT, self.ADMIN_API_PORT, self.SCHEMA_REGISTRY_PORT
        )
        self.with_command(
            "redpanda start"
            " --smp 1"
            " --memory 256M"
            " --mode dev-container"
            " --default-log-level=warn"
            f" --kafka-addr internal://0.0.0.0:{self.REDPANDA_PORT},"
            f"external://0.0.0.0:{self.EXTERNAL_PORT}"
            f" --advertise-kafka-addr internal://redpanda:{self.REDPANDA_PORT},"
            f"external://localhost:{self.EXTERNAL_PORT}"
            f" --pandaproxy-addr internal://0.0.0.0:8082,"
            f"external://0.0.0.0:18082"
            f" --advertise-pandaproxy-addr internal://redpanda:8082,"
            f"external://localhost:18082"
            f" --schema-registry-addr internal://0.0.0.0:{self.SCHEMA_REGISTRY_PORT},"
            f"external://0.0.0.0:18081"
        )

    def start(self, timeout=90) -> "RedpandaContainer":
        super().start()
        # Redpanda prints the Admin API listener message once fully started
        wait_for_logs(
            self, r".*admin_api_server.*Insecure Admin API listener.*", timeout=timeout
        )
        return self

    def get_bootstrap_server(self) -> str:
        host = self.get_container_host_ip()
        port = self.get_exposed_port(self.EXTERNAL_PORT)
        return f"{host}:{port}"

    def get_schema_registry_url(self) -> str:
        host = self.get_container_host_ip()
        port = self.get_exposed_port(self.SCHEMA_REGISTRY_PORT)
        return f"http://{host}:{port}"

    def get_admin_api_url(self) -> str:
        host = self.get_container_host_ip()
        port = self.get_exposed_port(self.ADMIN_API_PORT)
        return f"http://{host}:{port}"


@pytest.fixture(scope="module")
def docker_network():
    with testcontainers.core.network.Network() as network:
        yield network


@pytest.fixture(scope="module")
def redpanda_container(docker_network):
    container = RedpandaContainer()
    _connect_to_network(container, docker_network, "redpanda")
    with container:
        # Load test data via Kafka-compatible producer
        load_csv_data.main(
            kafka_broker=container.get_bootstrap_server(),
            schema_registry_url=container.get_schema_registry_url(),
            csv_directory=os.path.dirname(__file__) + "/data",
        )
        yield container


@pytest.fixture(scope="module")
def create_service_request(redpanda_container):
    return CreateMessagingServiceRequest(
        name=f"docker_test_redpanda_{uuid.uuid4().hex[:8]}",
        serviceType=MessagingServiceType.Redpanda,
        connection=MessagingConnection(
            config=RedpandaConnection(
                bootstrapServers=redpanda_container.get_bootstrap_server(),
                schemaRegistryURL=redpanda_container.get_schema_registry_url(),
            )
        ),
    )


@pytest.fixture(scope="module")
def create_service_request_with_admin_api(redpanda_container):
    """Service request that includes the Admin API URL for transform lineage tests."""
    return CreateMessagingServiceRequest(
        name=f"docker_test_redpanda_admin_{uuid.uuid4().hex[:8]}",
        serviceType=MessagingServiceType.Redpanda,
        connection=MessagingConnection(
            config=RedpandaConnection(
                bootstrapServers=redpanda_container.get_bootstrap_server(),
                schemaRegistryURL=redpanda_container.get_schema_registry_url(),
                redpandaAdminApiUrl=redpanda_container.get_admin_api_url(),
            )
        ),
    )


@pytest.fixture(scope="module")
def db_service(metadata, create_service_request, unmask_password):
    """Create the Redpanda messaging service for tests.
    Named db_service for compatibility with the base conftest fixtures."""
    service_entity = metadata.create_or_update(data=create_service_request)
    fqn = service_entity.fullyQualifiedName.root
    yield unmask_password(service_entity)
    service_entity = metadata.get_by_name(MessagingService, fqn)
    if service_entity:
        metadata.delete(
            entity=MessagingService,
            entity_id=service_entity.id,
            recursive=True,
            hard_delete=True,
        )


@pytest.fixture(scope="module")
def ingestion_config(db_service, workflow_config, sink_config):
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
def ingestion_config_with_consumer_groups(db_service, workflow_config, sink_config):
    return {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": MessagingMetadataConfigType.MessagingMetadata.value,
                    "extractConsumerGroups": True,
                }
            },
            "serviceConnection": db_service.connection.model_dump(),
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


@pytest.fixture(scope="module")
def ingestion_config_with_sample_data(db_service, workflow_config, sink_config):
    return {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": MessagingMetadataConfigType.MessagingMetadata.value,
                    "generateSampleData": True,
                }
            },
            "serviceConnection": db_service.connection.model_dump(),
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


@pytest.fixture(scope="module")
def redpanda_consumer_group_service(
    redpanda_container, metadata, workflow_config, sink_config
):
    """Dedicated service for consumer group testing."""
    svc_request = CreateMessagingServiceRequest(
        name=f"rp_cg_test_{uuid.uuid4().hex[:8]}",
        serviceType=MessagingServiceType.Redpanda,
        connection=MessagingConnection(
            config=RedpandaConnection(
                bootstrapServers=redpanda_container.get_bootstrap_server(),
                schemaRegistryURL=redpanda_container.get_schema_registry_url(),
            )
        ),
    )
    svc = metadata.create_or_update(data=svc_request)
    config = {
        "source": {
            "type": "redpanda",
            "serviceName": svc.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": MessagingMetadataConfigType.MessagingMetadata.value,
                    "extractConsumerGroups": True,
                }
            },
            "serviceConnection": svc.connection.model_dump(),
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }
    yield svc, config
    svc = metadata.get_by_name(MessagingService, svc.fullyQualifiedName.root)
    if svc:
        metadata.delete(
            entity=MessagingService,
            entity_id=svc.id,
            recursive=True,
            hard_delete=True,
        )


@pytest.fixture(scope="module")
def unmask_password():
    def patch_password(service):
        return service

    return patch_password
