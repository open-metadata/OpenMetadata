import os
import uuid

import pytest
import requests
from tenacity import retry, stop_after_delay, wait_fixed
from testcontainers.core.container import DockerContainer

from _openmetadata_testutils.helpers.docker import try_bind
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.connections.database.druidConnection import (
    DruidConnection,
    DruidScheme,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)


@pytest.fixture(scope="module")
def druid_container():
    """Start a Druid container in single-node nano-quickstart mode."""
    container = DockerContainer("apache/druid:30.0.0")
    container.with_exposed_ports(8082)
    container.with_env("DRUID_SINGLE_NODE_CONF", "nano-quickstart")

    with (
        try_bind(container, 8082, None) if not os.getenv("CI") else container
    ) as container:
        host = container.get_container_host_ip()
        port = container.get_exposed_port(8082)

        @retry(wait=wait_fixed(3), stop=stop_after_delay(180))
        def _wait_for_broker():
            resp = requests.get(f"http://{host}:{port}/status/health")
            assert resp.status_code == 200 and resp.text == "true"

        _wait_for_broker()
        yield container


@pytest.fixture(scope="module")
def create_service_request(druid_container):
    return CreateDatabaseServiceRequest(
        name=f"docker_test_druid_{uuid.uuid4().hex[:8]}",
        serviceType=DatabaseServiceType.Druid,
        connection=DatabaseConnection(
            config=DruidConnection(
                scheme=DruidScheme.druid,
                hostPort=f"{druid_container.get_container_host_ip()}:{druid_container.get_exposed_port(8082)}",
            )
        ),
    )
